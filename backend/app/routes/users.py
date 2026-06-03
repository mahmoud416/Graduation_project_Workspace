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
from app.schemas.user import UserResponse, UserUpdate, SelfProfileUpdate

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
        plain_password=user_doc.get("plain_password"),
        avatar=user_doc.get("avatar"),
        last_seen=user_doc.get("last_seen"),
        bio=user_doc.get("bio"),
        department=user_doc.get("department"),
        job_title=user_doc.get("job_title"),
        country=user_doc.get("country"),
        timezone=user_doc.get("timezone"),
        username=user_doc.get("username"),
    )


@router.patch("/me/profile", response_model=UserResponse)
async def update_my_profile(
    payload: SelfProfileUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_database),
):
    """Allow any authenticated user to update their own profile fields."""
    field_map = {
        "name":       payload.name,
        "phone":      payload.phone,
        "avatar":     payload.avatar,
        "bio":        payload.bio,
        "department": payload.department,
        "job_title":  payload.job_title,
        "country":    payload.country,
        "timezone":   payload.timezone,
        "username":   payload.username,
    }
    update_fields = {k: v for k, v in field_map.items() if v is not None}

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    user_id = current_user.get("_id")
    updated = await db[USERS_COLLECTION].find_one_and_update(
        {"_id": user_id},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user(updated)


@router.delete("/me/avatar", status_code=status.HTTP_204_NO_CONTENT)
async def remove_my_avatar(
    current_user = Depends(get_current_user),
    db = Depends(get_database),
):
    """Remove the current user's profile picture (revert to initials avatar)."""
    await db[USERS_COLLECTION].update_one(
        {"_id": current_user.get("_id")},
        {"$unset": {"avatar": ""}}
    )
    return None


@router.get("/me/sessions")
async def get_my_sessions(
    current_user = Depends(get_current_user),
    db = Depends(get_database),
    limit: int = Query(10, le=20),
):
    """Return the calling user's own recent login sessions."""
    user_id = str(current_user.get("_id"))
    sessions = await db[USER_SESSIONS_COLLECTION].find(
        {"user_id": user_id}
    ).sort("login_time", -1).limit(limit).to_list(length=None)
    for s in sessions:
        s["_id"] = str(s["_id"])
    return sessions


@router.get("/me/activity")
async def get_my_activity(
    current_user = Depends(get_current_user),
    db = Depends(get_database),
):
    """Return the calling user's workspace activity statistics."""
    from app.db.collections import (
        PROJECTS_COLLECTION, TASKS_COLLECTION,
        QUALITY_ANALYSES_COLLECTION, COMMENTS_COLLECTION, FILES_COLLECTION,
    )
    user_id = current_user.get("_id")
    user_id_str = str(user_id)

    projects_count = await db[PROJECTS_COLLECTION].count_documents({
        "$or": [{"staff_ids": user_id}, {"sub_admin_ids": user_id}, {"owner_id": user_id}]
    })

    tasks_completed = await db[TASKS_COLLECTION].count_documents({
        "$or": [{"assigned_to": user_id}, {"assignees": user_id}],
        "status": "DONE",
    })

    ai_reviews = await db[QUALITY_ANALYSES_COLLECTION].count_documents(
        {"triggered_by": user_id}
    )

    comments_posted = await db[COMMENTS_COLLECTION].count_documents(
        {"author_id": user_id}
    )

    files_uploaded = await db[FILES_COLLECTION].count_documents(
        {"uploaded_by": user_id}
    )

    return {
        "projects_count":   projects_count,
        "tasks_completed":  tasks_completed,
        "ai_reviews":       ai_reviews,
        "comments_posted":  comments_posted,
        "files_uploaded":   files_uploaded,
    }


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


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_database),
):
    """Permanently delete a user account. IT staff and admins only. Cannot delete founders."""
    caller_role = current_user.get("role")
    if caller_role not in ["admin", "it_staff"]:
        raise HTTPException(status_code=403, detail="Only IT staff or admins can delete users")

    try:
        target_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")

    target = await db[USERS_COLLECTION].find_one({"_id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") in ("founder",):
        raise HTTPException(status_code=403, detail="Cannot delete a Founder account")
    if target.get("role") == "admin" and caller_role != "admin":
        raise HTTPException(status_code=403, detail="IT staff cannot delete admin accounts")

    await db[USERS_COLLECTION].delete_one({"_id": target_id})

    from app.db.collections import AUDIT_LOGS_COLLECTION
    await db[AUDIT_LOGS_COLLECTION].insert_one({
        "user_id": str(current_user["_id"]),
        "action_type": "DELETE",
        "entity_type": "User",
        "entity_id": str(target_id),
        "timestamp": datetime.now(timezone.utc),
        "metadata": {
            "deleted_email": target.get("email"),
            "deleted_role":  target.get("role"),
        },
    })
    return None


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
