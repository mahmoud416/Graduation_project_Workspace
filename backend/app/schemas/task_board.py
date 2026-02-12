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
    assignee: str
    due: str
    done: bool = False


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
    assignee: Optional[str] = "Unassigned"
    due: Optional[str] = "TBD"
    done: bool = False


class TaskBoardTaskPatch(BaseModel):
    title: Optional[str] = None
    assignee: Optional[str] = None
    due: Optional[str] = None
    done: Optional[bool] = None


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
