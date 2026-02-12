"""
Pydantic schemas for Project-related API requests and responses.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.project import ProjectStatus



class ProjectPerson(BaseModel):
    """Lightweight representation of a user linked to a project."""
    id: str = Field(..., alias="_id")
    name: str
    email: str
    initials: str

    class Config:
        populate_by_name = True


class ProjectBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=140)
    description: str = Field("", max_length=2000)
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE)
    progress: int = Field(0, ge=0, le=100)
    sub_admin_id: Optional[str] = Field(default=None, description="(Deprecated) Single sub-admin id")
    sub_admin_ids: List[str] = Field(default_factory=list, description="User IDs of the assigned sub-admins")
    staff_ids: List[str] = Field(default_factory=list, description="List of staff user IDs")
    team_id: Optional[str] = Field(default=None, description="Optional Team ID linkage")


class ProjectCreate(ProjectBase):
    """Schema for project creation."""
    pass


class ProjectUpdate(BaseModel):
    """Schema for partial project updates."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=140)
    description: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[ProjectStatus] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    sub_admin_id: Optional[str] = None
    sub_admin_ids: Optional[List[str]] = None


class ProjectStaffUpdate(BaseModel):
    """Schema for adding staff members to a project."""
    staff_ids: List[str] = Field(..., min_length=1, description="Staff user IDs to attach to the project")


class ProjectResponse(BaseModel):
    """Schema returned to the frontend for project details."""
    id: str = Field(..., alias="_id")
    title: str
    description: str
    status: str
    progress: int
    owner_id: str
    team_id: Optional[str] = None
    sub_admin: Optional[ProjectPerson] = None  # legacy single field for backward compatibility
    sub_admins: List[ProjectPerson] = Field(default_factory=list)
    staff: List[ProjectPerson] = Field(default_factory=list)
    staff_initials: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
