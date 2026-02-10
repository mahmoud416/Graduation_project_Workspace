"""
Authentication dependencies for FastAPI using a simple header-based flow.

Clients must send `X-User-Id` with the MongoDB user id string. No JWT is used.
"""
from fastapi import Depends, Header, HTTPException, status
from bson import ObjectId
from typing import Dict, Any

from app.db.mongodb import get_database
from app.db.collections import USERS_COLLECTION


async def get_current_user(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    db = Depends(get_database)
) -> Dict[str, Any]:
    """
    Pull the current user from MongoDB using a plain header value.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id header"
        )

    try:
        user_obj_id = ObjectId(x_user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id format"
        )

    user = await db[USERS_COLLECTION].find_one({"_id": user_obj_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )

    return user
