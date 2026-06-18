"""
Pydantic schemas for Entity-related API requests and responses.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class EntityCreate(BaseModel):
    """Schema for creating a new entity."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""
    quality_framework_ids: Optional[List[str]] = None
    subscription_tier: Optional[str] = "Basic"
    quality_system: Optional[str] = None


class AssignITStaffRequest(BaseModel):
    """Schema for assigning IT staff to an entity."""
    it_staff_ids: List[str] = Field(..., description="List of user IDs (IT Staff) to assign")


class EntityResponse(BaseModel):
    """Schema for entity data in responses."""
    id: str = Field(..., alias="_id")
    name: str
    description: Optional[str] = ""
    founder_id: Optional[str] = ""
    it_staff_ids: Optional[List[str]] = []
    team_ids: Optional[List[str]] = []
    quality_framework_ids: Optional[List[str]] = []
    subscription_tier: Optional[str] = "Basic"
    quality_system: Optional[str] = None
    max_teams: Optional[int] = 5
    ai_quota: Optional[int] = 0
    ai_tokens_used: Optional[int] = 0
    user_count: Optional[int] = 0
    status: Optional[str] = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        extra = "ignore"
