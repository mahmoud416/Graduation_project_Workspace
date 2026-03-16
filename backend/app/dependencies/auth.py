"""
JWT-based authentication dependency.
Clients must send: Authorization: Bearer <token>
"""
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId
from typing import Dict, Any, Optional

from app.db.mongodb import get_database
from app.db.collections import USERS_COLLECTION
from app.core.security import decode_access_token


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    db=Depends(get_database),
) -> Dict[str, Any]:
    """
    Resolve the current user from a JWT Bearer token.
    Falls back to X-User-Id header for backward compatibility during migration.
    """
    user_id: Optional[str] = None

    # --- Primary: JWT Bearer token ---
    if credentials and credentials.credentials:
        payload = decode_access_token(credentials.credentials)
        if payload:
            user_id = payload.get("sub")

    # --- Fallback: legacy X-User-Id header ---
    if not user_id and x_user_id:
        user_id = x_user_id.strip()

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Look up user
    lookup_id: Any = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    user = await db[USERS_COLLECTION].find_one({"_id": lookup_id})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.get("is_active", True) or user.get("status") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended",
        )

    # Ensure roles array exists for downstream RBAC logic
    if not user.get("roles"):
        primary_role = (user.get("role") or "staff").strip().lower()
        user["roles"] = [primary_role]
    else:
        normalized_roles = []
        for role in user.get("roles", []):
            if not role:
                continue
            normalized = role.strip().lower()
            if normalized not in normalized_roles:
                normalized_roles.append(normalized)
        user["roles"] = normalized_roles or [(user.get("role") or "staff").strip().lower()]

    user["role"] = (user.get("role") or "staff").strip().lower()

    return user
