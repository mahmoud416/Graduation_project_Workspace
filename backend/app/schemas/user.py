"""
Pydantic schemas for User-related API requests and responses.
"""
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    """Schema for user registration request."""
    email: EmailStr
    password: str = Field(..., min_length=3, description="Simple password (no hashing)")
    full_name: str = Field(..., min_length=1, max_length=100)
    role: Optional[str] = Field("staff", description="Role controls which dashboard to open")
    admin_id: Optional[str] = None
    sub_admin_id: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = "active"


class UserUpdate(BaseModel):
    """Schema for partial updates triggered from the configuration center."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    role: Optional[str] = None
    admin_id: Optional[str] = None
    sub_admin_id: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None


class UserLogin(BaseModel):
    """Schema for user login request."""
    email: EmailStr
    password: str


class PasswordUpdateRequest(BaseModel):
    """Schema for password change requests."""
    user_id: str = Field(..., description="User identifier string")
    new_password: str = Field(..., min_length=3, description="New password in plain text")


class UserResponse(BaseModel):
    """Schema for user data in responses."""
    id: str = Field(..., alias="_id")
    email: str
    name: str = Field(..., alias="name")
    role: str
    admin_id: Optional[str] = None
    sub_admin_id: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    last_seen: Optional[datetime] = None

    class Config:
        populate_by_name = True
        extra = "ignore"
