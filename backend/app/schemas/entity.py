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


class AssignITStaffRequest(BaseModel):
    """Schema for assigning IT staff to an entity."""
    it_staff_ids: List[str] = Field(..., description="List of user IDs (IT Staff) to assign")


class EntityResponse(BaseModel):
    """Schema for entity data in responses."""
    id: str = Field(..., alias="_id")
    name: str
    description: str
    founder_id: str
    it_staff_ids: List[str]
    team_ids: List[str]
    quality_framework_ids: Optional[List[str]] = []
    subscription_tier: str
    max_teams: int
    ai_quota: int
    ai_tokens_used: int
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        extra = "ignore"
