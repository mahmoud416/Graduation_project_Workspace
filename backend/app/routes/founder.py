from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.dependencies.rbac import require_founder, ensure_roles
from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import (
    ENTITIES_COLLECTION, TEAMS_COLLECTION, USERS_COLLECTION,
    AUDIT_LOGS_COLLECTION, TASKS_COLLECTION, QUALITY_EVALUATIONS_COLLECTION,
    QUALITY_SCORES_COLLECTION, USER_SESSIONS_COLLECTION,
)
from app.core.security import hash_password
from app.utils.credentials import read_credentials
from bson import ObjectId
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/founder", tags=["Founder Dashboard"])


# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM METRICS  (real MongoDB data)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/metrics")
async def get_system_metrics(
    current_user=Depends(require_founder),
    db=Depends(get_database),
):
    now = datetime.now(timezone.utc)

    # Parallel counts
    total_entities = await db[ENTITIES_COLLECTION].count_documents({})
    total_teams    = await db[TEAMS_COLLECTION].count_documents({})
    total_users    = await db[USERS_COLLECTION].count_documents({})
    total_tasks    = await db[TASKS_COLLECTION].count_documents({})

    # Active users: sessions updated within the last 30 minutes
    active_cutoff = now - timedelta(minutes=30)
    active_now = await db[USER_SESSIONS_COLLECTION].count_documents(
        {"last_active": {"$gte": active_cutoff}}
    )
    if active_now == 0:
        # Fall back to sessions from today
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        active_now = await db[USER_SESSIONS_COLLECTION].count_documents(
            {"login_time": {"$gte": today_start}}
        )

    # Pending AI evaluations
    pending_ai_evals = await db[QUALITY_EVALUATIONS_COLLECTION].count_documents(
        {"status": {"$in": ["pending", "in_progress"]}}
    )

    # Average quality score from the quality_scores collection
    avg_pipeline = [
        {"$group": {"_id": None, "avg": {"$avg": "$score"}}},
    ]
    avg_result = await db[QUALITY_SCORES_COLLECTION].aggregate(avg_pipeline).to_list(1)
    avg_quality_score = round(avg_result[0]["avg"], 1) if avg_result else 0.0

    # SaaS financials based on entities
    entities = await db[ENTITIES_COLLECTION].find({}).to_list(length=None)
    mrr = 0
    tier_distribution = {"Basic": 0, "Pro": 0, "Enterprise": 0}
    for ent in entities:
        tier = ent.get("subscription_tier", "Basic")
        if tier in tier_distribution:
            tier_distribution[tier] += 1
            if tier == "Enterprise":
                mrr += 999
            elif tier == "Pro":
                mrr += 299
            else:
                mrr += 49

    # AI trends: quality evaluations grouped by day-of-week (last 7 days)
    week_ago = now - timedelta(days=7)
    evals_pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {
            "_id":      {"$dayOfWeek": "$created_at"},  # 1=Sun … 7=Sat
            "accepted": {"$sum": {"$cond": [{"$eq": ["$verdict", "pass"]}, 1, 0]}},
            "rejected": {"$sum": {"$cond": [{"$ne":  ["$verdict", "pass"]}, 1, 0]}},
        }},
    ]
    day_map = {1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat"}
    evals_by_day = {d: {"accepted": 0, "rejected": 0} for d in day_map.values()}
    async for row in db[QUALITY_EVALUATIONS_COLLECTION].aggregate(evals_pipeline):
        label = day_map.get(row["_id"], "?")
        evals_by_day[label]["accepted"] = row["accepted"]
        evals_by_day[label]["rejected"] = row["rejected"]
    ordered_days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    ai_trends = [
        {"day": d, "accepted": evals_by_day[d]["accepted"], "rejected": evals_by_day[d]["rejected"]}
        for d in ordered_days
    ]

    # System alerts from recent audit logs (errors / notable actions)
    recent_logs = await db[AUDIT_LOGS_COLLECTION].find(
        {},
        {"action_type": 1, "entity_type": 1, "metadata": 1, "timestamp": 1, "user_id": 1}
    ).sort("timestamp", -1).limit(5).to_list(length=5)

    system_alerts = []
    for i, log in enumerate(recent_logs):
        ts = log.get("timestamp")
        if ts:
            diff = now - ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else now - ts
            mins = int(diff.total_seconds() / 60)
            time_str = f"{mins} mins ago" if mins < 60 else f"{mins // 60} hours ago"
        else:
            time_str = "recently"
        action = log.get("action_type", "ACTION")
        entity = log.get("entity_type", "Entity")
        detail = (log.get("metadata") or {}).get("detail") or (log.get("metadata") or {}).get("action") or ""
        alert_type = "error" if action == "DELETE" else ("warning" if action == "UPDATE" else "info")
        system_alerts.append({
            "id":      i + 1,
            "type":    alert_type,
            "message": f"{action} on {entity}: {detail}".strip(": "),
            "time":    time_str,
        })

    # Total QC reports submitted
    total_reports = await db[QUALITY_EVALUATIONS_COLLECTION].count_documents({})
    passed_reports = await db[QUALITY_EVALUATIONS_COLLECTION].count_documents({"verdict": "pass"})
    pass_rate = round((passed_reports / total_reports * 100), 1) if total_reports > 0 else 0.0

    # Report type distribution
    rt_pipeline = [
        {"$group": {"_id": "$report_type", "count": {"$sum": 1}}}
    ]
    report_types: dict = {}
    async for row in db[QUALITY_EVALUATIONS_COLLECTION].aggregate(rt_pipeline):
        if row["_id"]:
            report_types[row["_id"]] = row["count"]

    return {
        "platform_health":       "100% Operational",
        "total_entities":        total_entities,
        "total_teams":           total_teams,
        "total_users":           total_users,
        "active_now":            active_now,
        "pending_ai_evals":      pending_ai_evals,
        "avg_quality_score":     avg_quality_score,
        "total_reports":         total_reports,
        "pass_rate":             pass_rate,
        "report_types":          report_types,
        "financials": {
            "mrr":              mrr,
            "tier_distribution": tier_distribution,
        },
        "ai_trends":             ai_trends,
        "system_alerts":         system_alerts,
        "total_tasks_processed": total_tasks,
    }


# ═══════════════════════════════════════════════════════════════════════════
# AUDIT LOGS  (real MongoDB data)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/audit-logs")
async def get_audit_logs(
    current_user=Depends(require_founder),
    db=Depends(get_database),
):
    now = datetime.now(timezone.utc)
    logs_cursor = db[AUDIT_LOGS_COLLECTION].find({}).sort("timestamp", -1).limit(50)
    logs = await logs_cursor.to_list(length=50)

    # Resolve user names
    user_id_set = {log.get("user_id") for log in logs if log.get("user_id")}
    user_map: Dict[str, str] = {}
    if user_id_set:
        valid_ids = [ObjectId(uid) for uid in user_id_set if ObjectId.is_valid(uid)]
        if valid_ids:
            users = await db[USERS_COLLECTION].find(
                {"_id": {"$in": valid_ids}}, {"name": 1, "email": 1}
            ).to_list(length=None)
            for u in users:
                user_map[str(u["_id"])] = u.get("name") or u.get("email") or "Unknown"

    result = []
    for log in logs:
        ts = log.get("timestamp")
        if ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            diff = now - ts
            mins = int(diff.total_seconds() / 60)
            time_str = f"{mins} mins ago" if mins < 60 else f"{mins // 60} hours ago"
        else:
            time_str = "—"

        action    = log.get("action_type", "ACTION")
        entity    = log.get("entity_type", "Entity")
        meta      = log.get("metadata") or {}
        detail    = meta.get("detail") or meta.get("action") or ""
        user_name = user_map.get(str(log.get("user_id")), "System")

        result.append({
            "id":          str(log["_id"]),
            "action":      f"{action} {entity}",
            "entity_name": detail or entity,
            "user":        user_name,
            "timestamp":   ts.isoformat() if ts else "",
            "time":        time_str,
            "status":      log.get("status", "success"),
        })

    return result


# ═══════════════════════════════════════════════════════════════════════════
# CREDENTIALS  (Founder-only)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/credentials", response_class=PlainTextResponse)
async def view_credentials(current_user=Depends(get_current_user)):
    """Return the full credentials registry. Accessible by founder and it_staff."""
    ensure_roles(current_user, ["it_staff"])
    return read_credentials()


@router.get("/credentials/download", response_class=PlainTextResponse)
async def download_credentials(current_user=Depends(get_current_user)):
    """Download credentials.txt as an attachment. Accessible by it_staff only."""
    ensure_roles(current_user, ["it_staff"])
    from fastapi.responses import Response
    content = read_credentials()
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=orbit_credentials.txt"},
    )


# ═══════════════════════════════════════════════════════════════════════════
# IT ACCOUNT MANAGEMENT  (Founder-only)
# ═══════════════════════════════════════════════════════════════════════════

class CreateITAccountPayload(BaseModel):
    full_name: str
    email: str
    password: str


class UpdateITAccountPayload(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


class ResetPasswordPayload(BaseModel):
    new_password: str


def _serialize_user(user: dict) -> dict:
    user = dict(user)
    user["_id"] = str(user["_id"])
    for k in ("admin_id", "sub_admin_id"):
        if k in user and user[k]:
            user[k] = str(user[k])
    user.pop("password", None)
    return user


@router.get("/accounts")
async def list_it_accounts(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user=Depends(require_founder),
    db=Depends(get_database),
):
    query: Dict[str, Any] = {"role": "it_staff"}
    if status_filter:
        query["status"] = status_filter
    if search:
        query["$or"] = [
            {"name":  {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    users = await db[USERS_COLLECTION].find(query).sort("created_at", -1).to_list(length=None)
    return [_serialize_user(u) for u in users]


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def create_it_account(
    payload: CreateITAccountPayload,
    current_user=Depends(require_founder),
    db=Depends(get_database),
):
    existing = await db[USERS_COLLECTION].find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    hashed = hash_password(payload.password)
    now = datetime.now(timezone.utc)
    doc = {
        "name":       payload.full_name,
        "email":      payload.email.lower(),
        "password":   hashed,
        "role":       "it_staff",
        "status":     "active",
        "is_active":  True,
        "created_at": now,
        "updated_at": now,
        "created_by": str(current_user["_id"]),
    }
    result = await db[USERS_COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id

    # Record credentials
    try:
        from app.utils.credentials import append_credential
        append_credential(
            name=payload.full_name, email=payload.email,
            role="it_staff", password=payload.password, created_at=now,
        )
    except Exception:
        pass

    await db[AUDIT_LOGS_COLLECTION].insert_one({
        "user_id":     str(current_user["_id"]),
        "action_type": "CREATE",
        "entity_type": "ITAccount",
        "entity_id":   str(result.inserted_id),
        "timestamp":   now,
        "metadata":    {"email": payload.email, "action": "create_it_account"},
    })

    return _serialize_user(doc)


@router.patch("/accounts/{account_id}")
async def update_it_account(
    account_id: str,
    payload: UpdateITAccountPayload,
    current_user=Depends(require_founder),
    db=Depends(get_database),
):
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid account ID")

    user = await db[USERS_COLLECTION].find_one({"_id": ObjectId(account_id), "role": "it_staff"})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IT account not found")

    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if payload.full_name:
        updates["name"] = payload.full_name
    if payload.email:
        collision = await db[USERS_COLLECTION].find_one(
            {"email": payload.email.lower(), "_id": {"$ne": ObjectId(account_id)}}
        )
        if collision:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        updates["email"] = payload.email.lower()

    await db[USERS_COLLECTION].update_one({"_id": ObjectId(account_id)}, {"$set": updates})
    updated = await db[USERS_COLLECTION].find_one({"_id": ObjectId(account_id)})
    return _serialize_user(updated)


@router.post("/accounts/{account_id}/reset-password")
async def reset_it_account_password(
    account_id: str,
    payload: ResetPasswordPayload,
    current_user=Depends(require_founder),
    db=Depends(get_database),
):
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid account ID")

    user = await db[USERS_COLLECTION].find_one({"_id": ObjectId(account_id), "role": "it_staff"})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IT account not found")

    hashed = hash_password(payload.new_password)
    await db[USERS_COLLECTION].update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"password": hashed, "updated_at": datetime.now(timezone.utc)}},
    )

    await db[AUDIT_LOGS_COLLECTION].insert_one({
        "user_id":     str(current_user["_id"]),
        "action_type": "UPDATE",
        "entity_type": "ITAccount",
        "entity_id":   account_id,
        "timestamp":   datetime.now(timezone.utc),
        "metadata":    {"action": "reset_password"},
    })
    return {"success": True}


@router.post("/accounts/{account_id}/toggle-status")
async def toggle_it_account_status(
    account_id: str,
    current_user=Depends(require_founder),
    db=Depends(get_database),
):
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid account ID")

    user = await db[USERS_COLLECTION].find_one({"_id": ObjectId(account_id), "role": "it_staff"})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IT account not found")

    new_status = "inactive" if user.get("status") == "active" else "active"
    await db[USERS_COLLECTION].update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"status": new_status, "is_active": new_status == "active",
                  "updated_at": datetime.now(timezone.utc)}},
    )

    await db[AUDIT_LOGS_COLLECTION].insert_one({
        "user_id":     str(current_user["_id"]),
        "action_type": "UPDATE",
        "entity_type": "ITAccount",
        "entity_id":   account_id,
        "timestamp":   datetime.now(timezone.utc),
        "metadata":    {"action": "toggle_status", "new_status": new_status},
    })
    return {"success": True, "status": new_status}


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_it_account(
    account_id: str,
    current_user=Depends(require_founder),
    db=Depends(get_database),
):
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid account ID")

    user = await db[USERS_COLLECTION].find_one({"_id": ObjectId(account_id), "role": "it_staff"})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IT account not found")

    await db[USERS_COLLECTION].delete_one({"_id": ObjectId(account_id)})

    await db[AUDIT_LOGS_COLLECTION].insert_one({
        "user_id":     str(current_user["_id"]),
        "action_type": "DELETE",
        "entity_type": "ITAccount",
        "entity_id":   account_id,
        "timestamp":   datetime.now(timezone.utc),
        "metadata":    {"action": "delete_it_account", "email": user.get("email")},
    })
