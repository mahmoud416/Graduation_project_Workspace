"""
Pydantic schemas for User Profile & Portfolio.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ProfileUpdate(BaseModel):
    """Schema for updating user profile fields."""
    avatar_url:  Optional[str] = Field(None, max_length=500)
    bio:         Optional[str] = Field(None, max_length=1000)
    department:  Optional[str] = Field(None, max_length=200)
    phone:       Optional[str] = Field(None, max_length=30)
    name:        Optional[str] = Field(None, min_length=1, max_length=100)


class ProfileResponse(BaseModel):
    """Schema returned for user profile data."""
    id:          str = Field(..., alias="_id")
    email:       str
    name:        str
    role:        str
    avatar_url:  Optional[str] = None
    bio:         Optional[str] = None
    department:  Optional[str] = None
    phone:       Optional[str] = None
    created_at:  Optional[datetime] = None
    is_active:   Optional[bool] = None

    class Config:
        populate_by_name = True


class PortfolioProject(BaseModel):
    """A single project in the user's portfolio."""
    project_id:   str
    title:        str
    status:       str
    tasks_total:  int = 0
    tasks_done:   int = 0


class PortfolioResponse(BaseModel):
    """Computed portfolio stats for a user."""
    user_id:          str
    name:             str
    projects_count:   int = 0
    tasks_completed:  int = 0
    tasks_total:      int = 0
    avg_accuracy:     float = 0.0
    recent_projects:  List[PortfolioProject] = Field(default_factory=list)
