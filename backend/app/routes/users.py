"""
User directory routes for admin tooling.
"""
from typing import List, Optional
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import USERS_COLLECTION, USER_SESSIONS_COLLECTION
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/me/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
async def heartbeat(
    current_user = Depends(get_current_user),
    db = Depends(get_database),
):
    """Update last_seen timestamp for the current user (online presence) and session duration."""
    user_id = current_user.get("_id")
    now = datetime.now(timezone.utc)
    
    await db[USERS_COLLECTION].update_one(
        {"_id": user_id},
        {"$set": {"last_seen": now}}
    )
    
    # Update latest session
    latest_session = await db[USER_SESSIONS_COLLECTION].find_one(
        {"user_id": str(user_id)},
        sort=[("login_time", -1)]
    )
    
    if latest_session:
        # Calculate duration
        duration = int((now - latest_session["login_time"].replace(tzinfo=timezone.utc)).total_seconds() / 60)
        await db[USER_SESSIONS_COLLECTION].update_one(
            {"_id": latest_session["_id"]},
            {"$set": {"last_active": now, "duration_minutes": duration}}
        )
        
    return None


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user = Depends(get_current_user),
    db = Depends(get_database),
):
    """Return the authenticated user's profile."""
    user_id = current_user.get("_id")
    user = await db[USERS_COLLECTION].find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user(user)


def _serialize_user(user_doc) -> UserResponse:
    user_id = str(user_doc["_id"])
    return UserResponse(
        _id=user_id,
        email=user_doc.get("email", ""),
        name=user_doc.get("name") or user_doc.get("full_name", ""),
        role=user_doc.get("role", "staff"),
        admin_id=user_doc.get("admin_id"),
        sub_admin_id=user_doc.get("sub_admin_id"),
        phone=user_doc.get("phone"),
        status=user_doc.get("status"),
        created_at=user_doc.get("created_at"),
        is_active=user_doc.get("is_active", True),
        password=user_doc.get("password"),
        last_seen=user_doc.get("last_seen"),
    )


@router.get("", response_model=List[UserResponse])
async def list_users(
    role: Optional[str] = Query(default=None, description="Filter by role: admin, sub_admin, staff"),
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Return directory information for admins, managers, sub-admins, staff, and IT to populate dropdowns."""
    current_role = current_user.get("role")
    if current_role not in ["admin", "manager", "sub_admin", "staff", "it_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access the user directory"
        )

    # Everyone cannot query founders or admins (except IT/admin can see admins)
    excluded = ["founder"]
    if current_role not in ["admin", "it_staff"]:
        excluded.append("admin")
    
    query: dict = {"role": {"$nin": excluded}}
    if role:
        if role.lower() in excluded:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot query this role")
        query["role"] = role

    users = await db[USERS_COLLECTION].find(query).sort("name", 1).to_list(length=None)

    return [_serialize_user(user) for user in users]


@router.get("/count")
async def get_users_count(
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Return the total number of non-admin team members."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access the user directory"
        )
    count = await db[USERS_COLLECTION].count_documents({"role": {"$nin": ["admin", "founder"]}})
    return {"count": count}


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can modify user accounts"
        )

    try:
        target_id = ObjectId(user_id)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id format"
        ) from exc

    update_fields: dict = {}
    if payload.name is not None:
        update_fields["name"] = payload.name
    if payload.role is not None:
        if payload.role.lower() == "founder":
            raise HTTPException(status_code=403, detail="Cannot assign founder role")
        update_fields["role"] = payload.role
        update_fields["roles"] = [payload.role]
    if payload.phone is not None:
        update_fields["phone"] = payload.phone
    if payload.status is not None:
        update_fields["status"] = payload.status
    if payload.admin_id is not None:
        update_fields["admin_id"] = payload.admin_id or None
    if payload.sub_admin_id is not None:
        update_fields["sub_admin_id"] = payload.sub_admin_id or None

    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update fields supplied"
        )

    updated_user = await db[USERS_COLLECTION].find_one_and_update(
        {"_id": target_id},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER
    )

    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    from app.db.collections import AUDIT_LOGS_COLLECTION
    from datetime import datetime, timezone
    await db[AUDIT_LOGS_COLLECTION].insert_one({
        "user_id": str(current_user["_id"]),
        "action_type": "UPDATE",
        "entity_type": "User",
        "entity_id": str(target_id),
        "timestamp": datetime.now(timezone.utc),
        "metadata": {"updated_fields": list(update_fields.keys())}
    })

    return _serialize_user(updated_user)


@router.get("/sessions")
async def list_sessions(
    current_user = Depends(get_current_user),
    db = Depends(get_database),
    limit: int = Query(50, le=100)
):
    """Return recent user sessions for IT and Admin."""
    role = current_user.get("role")
    if role not in ["admin", "it_staff"]:
        raise HTTPException(status_code=403, detail="Not authorized to view session logs")

    sessions = await db[USER_SESSIONS_COLLECTION].find({}).sort("login_time", -1).limit(limit).to_list(length=None)
    
    # Format for response
    for s in sessions:
        s["_id"] = str(s["_id"])
        
    return sessions
