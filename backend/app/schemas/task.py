"""
Pydantic schemas for Task-related API requests and responses.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models.task import TaskStatus, TaskPriority


class TaskCreate(BaseModel):
    """Schema for task creation request."""
    title:         str          = Field(..., min_length=1, max_length=200)
    description:   Optional[str] = Field(default="", max_length=2000)
    team_id:       Optional[str] = Field(default=None, description="Legacy team ID (use project_id)")
    project_id:    Optional[str] = Field(default=None, description="Project card ID")
    assigned_to:   Optional[str] = Field(default=None, description="Primary assignee user ID (kept for backward-compat)")
    assignees:     List[str]    = Field(default_factory=list, description="List of assignee user IDs")
    visibility:    str          = Field(default="team", description="'team' = visible to all, 'private' = only assignees")
    status:        TaskStatus   = Field(default=TaskStatus.TODO)
    priority:      TaskPriority = Field(default=TaskPriority.MEDIUM)
    deadline:      Optional[datetime] = None
    report_type:   Optional[str] = Field(default=None, description="QC report type key")
    template_id:   Optional[str] = Field(default=None, description="Report template ID")
    assign_to_all: bool         = Field(default=False, description="Auto-assign to all team members")


class TaskUpdate(BaseModel):
    """Schema for task update request."""
    title:       Optional[str]      = Field(None, min_length=1, max_length=200)
    description: Optional[str]      = Field(None, max_length=2000)
    status:      Optional[TaskStatus]   = None
    priority:    Optional[TaskPriority] = None
    deadline:    Optional[datetime]     = None
    assigned_to: Optional[str]          = None
    assignees:   Optional[List[str]]    = None
    visibility:  Optional[str]          = None


class TaskAssign(BaseModel):
    """Schema for task assignment/reassignment."""
    assigned_to: str = Field(..., description="User ID to assign the task to")


class TaskStatusUpdate(BaseModel):
    """Schema for updating only the task status."""
    status: TaskStatus


class TaskResponse(BaseModel):
    """Schema returned to the frontend for task details."""
    id:             str      = Field(..., alias="_id")
    title:          str
    description:    str
    project_id:     Optional[str] = None
    team_id:        Optional[str] = None  # legacy
    assigned_to:    Optional[str] = None
    assignees:      List[str]     = Field(default_factory=list)
    visibility:     str           = "team"
    created_by:     str
    status:         str
    priority:       str
    deadline:       Optional[datetime] = None
    order:          int = 0
    report_type:    Optional[str] = None
    template_id:    Optional[str] = None
    assign_to_all:  bool = False
    creator_name:   Optional[str] = None
    creator_avatar: Optional[str] = None
    created_at:     datetime
    updated_at:     datetime

    assigned_to_name: Optional[str] = None
    created_by_name:  Optional[str] = None
    assignees_names:  List[str]     = Field(default_factory=list)

    class Config:
        populate_by_name = True
