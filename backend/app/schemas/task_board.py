"""Pydantic schemas for task board endpoints."""
from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class TaskBoardResource(BaseModel):
    id: str = Field(..., alias="_id")
    file_name: str
    path: str
    uploaded_by: str
    uploader_role: str
    uploader_name: Optional[str] = None
    visible_to: Optional[str] = "all"
    created_at: datetime
    download_url: Optional[str] = None

    class Config:
        populate_by_name = True


class TaskBoardOverview(BaseModel):
    title: str
    description: str
    status_badge: str = Field(alias="status_badge")
    progress: int

    class Config:
        populate_by_name = True


class TaskBoardTask(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    assignee: str
    assignee_ids: Optional[List[str]] = Field(default_factory=list)
    due: str
    done: bool = False
    status: Optional[str] = None
    priority: Optional[str] = None
    visibility: Optional[str] = "team"
    report_type: Optional[str] = None
    completed_by: Optional[List[str]] = Field(default_factory=list)
    completed_by_names: Optional[List[str]] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    submitted_by: Optional[str] = None
    submitted_by_name: Optional[str] = None


class TaskBoardCommentAttachment(BaseModel):
    id: str = Field(..., alias="_id")
    file_name: str
    path: Optional[str] = None
    size: Optional[int] = None
    download_url: Optional[str] = None

    class Config:
        populate_by_name = True


class TaskBoardComment(BaseModel):
    id: str = Field(..., alias="_id")
    user_id: Optional[str] = None
    user_name: str
    user_avatar: str
    message: str
    created_at: datetime
    attachments: List[TaskBoardCommentAttachment] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class TaskBoardMember(BaseModel):
    user_id: Optional[str] = None
    name: str
    role: str
    avatar: str
    email: Optional[str] = None
    responsibility: Optional[str] = None
    online: bool = False


class TaskBoardResponse(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    project_id: str
    overview: TaskBoardOverview
    tasks: List[TaskBoardTask]
    members: List[TaskBoardMember]
    resources: List[TaskBoardResource] = Field(default_factory=list)
    comments: List[TaskBoardComment] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class TaskBoardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status_badge: Optional[str] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)


class TaskBoardTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee: Optional[str] = "Unassigned"
    assignee_ids: Optional[List[str]] = Field(default_factory=list)
    due: Optional[str] = "TBD"
    done: bool = False
    visibility: Optional[str] = "team"   # 'team' | 'private'
    report_type: Optional[str] = None
    created_by: Optional[str] = None
    status: Optional[Literal["todo", "in_progress", "review", "done"]] = "todo"
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = "medium"


class TaskBoardTaskPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee: Optional[str] = None
    assignee_ids: Optional[List[str]] = None
    due: Optional[str] = None
    done: Optional[bool] = None
    visibility: Optional[str] = None
    report_type: Optional[str] = None
    completed_by: Optional[List[str]] = None       # user_ids who checked
    completed_by_names: Optional[List[str]] = None  # display names
    status: Optional[Literal["todo", "in_progress", "review", "done"]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None


class TaskBoardMemberRequest(BaseModel):
    email: Optional[str] = Field(default=None, description="Email for lookup")
    user_id: Optional[str] = Field(default=None, description="Direct user id reference")


class TaskBoardMemberPatch(BaseModel):
    action: Literal["remove", "update"]
    responsibility: Optional[str] = None
    role: Optional[str] = None


class TaskBoardResourceResponse(BaseModel):
    resource: TaskBoardResource


class AvailableMember(BaseModel):
    user_id: str
    name: str
    role: str
    avatar: str
    email: Optional[str] = None


class MemberListResponse(BaseModel):
    members: List[AvailableMember]
