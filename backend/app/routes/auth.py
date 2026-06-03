"""
Authentication API routes.
Handles user registration, login, and profile retrieval.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.schemas.user import UserCreate, UserLogin, UserResponse, PasswordUpdateRequest
from app.services.auth_service import AuthService
from app.services.task_board_service import TaskBoardService
from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import (
    USERS_COLLECTION,
    USER_SESSIONS_COLLECTION,
    AUDIT_LOGS_COLLECTION,
    BLACKLISTED_TOKENS_COLLECTION,
)
from datetime import datetime, timezone


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db=Depends(get_database)
):
    """Register a new user account."""
    try:
        user = await AuthService.register_user(
            db,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            role=user_data.role or "staff",
            admin_id=user_data.admin_id,
            sub_admin_id=user_data.sub_admin_id,
            phone=user_data.phone,
            status=user_data.status or "active"
        )

        await TaskBoardService.ensure_public_membership_for_user(db, user)

        token = AuthService.generate_token(user)

        await db[AUDIT_LOGS_COLLECTION].insert_one({
            "user_id": str(user["_id"]),
            "action_type": "CREATE",
            "entity_type": "User",
            "entity_id": str(user["_id"]),
            "timestamp": datetime.now(timezone.utc),
            "metadata": {"action": "register", "role": user_data.role or "staff"}
        })

        return {
            "_id":   str(user["_id"]),
            "email": user.get("email"),
            "name":  user.get("name"),
            "role":  user.get("role"),
            "token": token,
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login")
async def login(
    credentials: UserLogin,
    db=Depends(get_database)
):
    """Login with email and password. Returns JWT token."""
    user = await AuthService.authenticate_user(
        db,
        email=credentials.email,
        password=credentials.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    now = datetime.now(timezone.utc)
    await db[USER_SESSIONS_COLLECTION].insert_one({
        "user_id": str(user["_id"]),
        "email": user.get("email"),
        "name": user.get("name") or user.get("full_name"),
        "role": user.get("role"),
        "login_time": now,
        "last_active": now,
        "duration_minutes": 0
    })

    await db[AUDIT_LOGS_COLLECTION].insert_one({
        "user_id": str(user["_id"]),
        "action_type": "LOGIN",
        "entity_type": "User",
        "entity_id": str(user["_id"]),
        "timestamp": now,
        "metadata": {"action": "login"}
    })

    token = AuthService.generate_token(user)

    return {
        "_id":   str(user["_id"]),
        "email": user.get("email"),
        "name":  user.get("name"),
        "role":  user.get("role"),
        "token": token,
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user=Depends(get_current_user)
):
    """Get current authenticated user's profile."""
    current_user["_id"] = str(current_user["_id"])
    return current_user


@router.post("/change-password")
async def change_password(
    payload: PasswordUpdateRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Update a user's password."""
    updated = await AuthService.update_password(
        db,
        user_id=payload.user_id,
        new_password=payload.new_password
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to update password"
        )

    return {"success": True}


# ─── First-time system initialization ───────────────────────────────────────

class FounderSetupPayload(BaseModel):
    full_name: str
    email: str
    password: str


@router.post("/setup", status_code=status.HTTP_201_CREATED)
async def setup_founder(
    payload: FounderSetupPayload,
    db=Depends(get_database)
):
    """
    First-time system initialization — creates the Founder account.
    Returns 409 if a Founder already exists (system already initialized).
    No authentication required. This endpoint is disabled after first use.
    """
    # ── Guard: system already initialized ─────────────────────────────────
    existing_founder = await db[USERS_COLLECTION].find_one({"role": "founder"})
    if existing_founder:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="System already initialized. Please sign in instead."
        )

    # ── Input validation ───────────────────────────────────────────────────
    name = payload.full_name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name is required.")
    if len(name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name must be at least 2 characters.")
    if "@" not in payload.email or "." not in payload.email.split("@")[-1]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email address.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")

    try:
        user = await AuthService.register_user(
            db,
            email=payload.email,
            password=payload.password,
            full_name=name,
            role="founder",
            status="active"
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    token = AuthService.generate_token(user)

    await db[AUDIT_LOGS_COLLECTION].insert_one({
        "user_id": str(user["_id"]),
        "action_type": "CREATE",
        "entity_type": "User",
        "entity_id": str(user["_id"]),
        "timestamp": datetime.now(timezone.utc),
        "metadata": {"action": "system_init", "role": "founder"}
    })

    return {
        "_id":  str(user["_id"]),
        "email": user.get("email"),
        "name":  user.get("name"),
        "role":  user.get("role"),
        "token": token,
    }


# ─── Logout ──────────────────────────────────────────────────────────────────

@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Logout the user by blacklisting their token."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        now = datetime.now(timezone.utc)
        await db[BLACKLISTED_TOKENS_COLLECTION].insert_one({
            "token": token,
            "user_id": str(current_user["_id"]),
            "timestamp": now
        })
        await db[AUDIT_LOGS_COLLECTION].insert_one({
            "user_id": str(current_user["_id"]),
            "action_type": "LOGOUT",
            "entity_type": "User",
            "entity_id": str(current_user["_id"]),
            "timestamp": now,
            "metadata": {"action": "logout"}
        })
    return {"status": "success"}
