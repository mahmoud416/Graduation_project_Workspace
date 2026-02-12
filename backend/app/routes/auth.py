"""
Authentication API routes.
Handles user registration, login, and profile retrieval.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.user import UserCreate, UserLogin, UserResponse, PasswordUpdateRequest
from app.services.auth_service import AuthService
from app.services.task_board_service import TaskBoardService
from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db = Depends(get_database)
):
    """
    Register a new user account.
    
    - **email**: Valid email address (unique)
    - **password**: Simple password (plain text stored)
    - **full_name**: User's full name
    - **role**: admin / sub_admin / staff for dashboard redirect
    - **admin_id / sub_admin_id / phone / status**: Optional metadata from existing records
    
    Returns the created user data.
    """
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
        
        # Convert ObjectId to string for response
        user["_id"] = str(user["_id"])
        
        # Return simple dict without validation
        return {
            "_id": user["_id"],
            "email": user.get("email"),
            "name": user.get("name"),
            "role": user.get("role")
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login")
async def login(
    credentials: UserLogin,
    db = Depends(get_database)
):
    """
    Login with email and password.
    
    Returns the user data on successful authentication.
    """
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

    # Convert ObjectId to string for response
    user["_id"] = str(user["_id"])
    
    # Return simple dict without validation
    return {
        "_id": user["_id"],
        "email": user.get("email"),
        "name": user.get("name"),
        "role": user.get("role"),
        "password": user.get("password")
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user = Depends(get_current_user)
):
    """
    Get current authenticated user's profile.
    
    Requires valid JWT token in Authorization header.
    """
    # Convert ObjectId to string for response
    current_user["_id"] = str(current_user["_id"])
    return current_user


@router.post("/change-password")
async def change_password(
    payload: PasswordUpdateRequest,
    db = Depends(get_database)
):
    """Update a user's password using their identifier."""
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
