"""
User directory routes for admin tooling.
"""
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import USERS_COLLECTION
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


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
        password=user_doc.get("password")
    )


@router.get("", response_model=List[UserResponse])
async def list_users(
    role: Optional[str] = Query(default=None, description="Filter by role: admin, sub_admin, staff"),
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Return directory information for admins to populate dropdowns."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access the user directory"
        )

    query = {"role": {"$ne": "founder"}}
    if role:
        if role.lower() == "founder":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot query founders")
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

    return _serialize_user(updated_user)
