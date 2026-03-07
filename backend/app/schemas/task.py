"""
Pydantic schemas for Task-related API requests and responses.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.task import TaskStatus, TaskPriority


class TaskCreate(BaseModel):
    """Schema for task creation request."""
    title:       str          = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=2000)
    team_id:     Optional[str] = Field(default=None, description="Legacy team ID (use project_id)")
    project_id:  Optional[str] = Field(default=None, description="Project card ID")
    assigned_to: Optional[str] = Field(default=None, description="User ID to assign the task to")
    status:      TaskStatus   = Field(default=TaskStatus.TODO)
    priority:    TaskPriority = Field(default=TaskPriority.MEDIUM)
    deadline:    Optional[datetime] = None


class TaskUpdate(BaseModel):
    """Schema for task update request."""
    title:       Optional[str]      = Field(None, min_length=1, max_length=200)
    description: Optional[str]      = Field(None, max_length=2000)
    status:      Optional[TaskStatus]   = None
    priority:    Optional[TaskPriority] = None
    deadline:    Optional[datetime]     = None
    assigned_to: Optional[str]          = None


class TaskAssign(BaseModel):
    """Schema for task assignment/reassignment."""
    assigned_to: str = Field(..., description="User ID to assign the task to")


class TaskStatusUpdate(BaseModel):
    """Schema for updating only the task status."""
    status: TaskStatus


class TaskResponse(BaseModel):
    """Schema returned to the frontend for task details."""
    id:          str      = Field(..., alias="_id")
    title:       str
    description: str
    project_id:  Optional[str] = None
    team_id:     Optional[str] = None  # legacy
    assigned_to: Optional[str] = None
    created_by:  str
    status:      str
    priority:    str
    deadline:    Optional[datetime] = None
    order:       int = 0
    created_at:  datetime
    updated_at:  datetime

    assigned_to_name: Optional[str] = None
    created_by_name:  Optional[str] = None

    class Config:
        populate_by_name = True
