"""
JWT-based authentication dependency.
Clients must send: Authorization: Bearer <token>
"""
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId
from typing import Dict, Any, Optional

from app.db.mongodb import get_database
from app.db.collections import USERS_COLLECTION, BLACKLISTED_TOKENS_COLLECTION, SYSTEM_SETTINGS_COLLECTION
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
    token: Optional[str] = None

    # --- Primary: JWT Bearer token ---
    if credentials and credentials.credentials:
        token = credentials.credentials
        
        # Check blacklist
        is_blacklisted = await db[BLACKLISTED_TOKENS_COLLECTION].find_one({"token": token})
        if is_blacklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = decode_access_token(token)
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

    # Check maintenance mode
    settings = await db[SYSTEM_SETTINGS_COLLECTION].find_one({"_id": "global_settings"})
    if settings and settings.get("maintenance_mode", False):
        if user.get("role") not in ["admin", "it_staff"]:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="System is currently under maintenance",
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

    # Update last_seen passively on every authenticated request (fire-and-forget style)
    try:
        from datetime import datetime, timezone
        await db[USERS_COLLECTION].update_one(
            {"_id": lookup_id},
            {"$set": {"last_seen": datetime.now(timezone.utc)}}
        )
    except Exception:
        pass  # Never block the request for this

    return user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    db=Depends(get_database),
) -> Optional[Dict[str, Any]]:
    """Like get_current_user, but returns None instead of raising when there is
    no valid authentication. Used by endpoints that work both authenticated and
    anonymously (e.g. /register)."""
    try:
        return await get_current_user(credentials, x_user_id, db)
    except HTTPException:
        return None
