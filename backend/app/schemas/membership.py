"""
Pydantic schemas for Membership-related API requests and responses.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.membership import Role


class MembershipCreate(BaseModel):
    """Schema for adding a member to a team."""
    user_id: str = Field(..., description="User ID to add to the team")
    role: Role = Field(default=Role.MEMBER, description="Role for the new member")
    managed_by: Optional[str] = Field(None, description="Sub-Admin managing this member (for members only)")


class MembershipUpdate(BaseModel):
    """Schema for updating a member's role."""
    role: Role = Field(..., description="New role for the member")
    managed_by: Optional[str] = Field(None, description="Sub-Admin managing this member")


class MembershipResponse(BaseModel):
    """Schema for membership data in responses."""
    id: str = Field(..., alias="_id")
    user_id: str
    team_id: str
    role: str
    managed_by: Optional[str] = None
    joined_at: datetime
    
    # Populated user details
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    
    class Config:
        populate_by_name = True
