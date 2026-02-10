"""
Pydantic schemas for Task-related API requests and responses.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.task import TaskStatus, TaskPriority


class TaskCreate(BaseModel):
    """Schema for task creation request."""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=2000)
    team_id: str = Field(..., description="Team ID for this task")
    assigned_to: str = Field(..., description="User ID to assign the task to")
    status: TaskStatus = Field(default=TaskStatus.TODO)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)


class TaskUpdate(BaseModel):
    """Schema for task update request."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None


class TaskAssign(BaseModel):
    """Schema for task assignment/reassignment."""
    assigned_to: str = Field(..., description="User ID to assign the task to")


class TaskResponse(BaseModel):
    """Schema for task data in responses."""
    id: str = Field(..., alias="_id")
    title: str
    description: str
    team_id: str
    assigned_to: str
    created_by: str
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    
    # Populated fields
    assigned_to_name: Optional[str] = None
    created_by_name: Optional[str] = None
    team_name: Optional[str] = None
    
    class Config:
        populate_by_name = True
