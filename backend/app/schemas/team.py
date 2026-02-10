"""
Pydantic schemas for Team-related API requests and responses.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class TeamCreate(BaseModel):
    """Schema for team creation request."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default="", max_length=500)


class TeamUpdate(BaseModel):
    """Schema for team update request."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class TeamResponse(BaseModel):
    """Schema for team data in responses."""
    id: str = Field(..., alias="_id")
    name: str
    description: str
    created_by: str
    created_at: datetime
    
    class Config:
        populate_by_name = True
