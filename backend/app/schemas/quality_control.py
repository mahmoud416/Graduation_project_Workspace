"""Pydantic schemas for the Quality Control role."""
from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class RuleDefinition(BaseModel):
    """Single quality rule definition."""

    rule_id: Optional[str] = Field(default=None, description="Client-generated identifier")
    label: str = Field(..., min_length=3, max_length=200)
    instructions: Optional[str] = Field(default=None, max_length=2000)
    weight: float = Field(default=1.0, ge=0.0, le=1.0)


class DatasetReference(BaseModel):
    """Reference to an uploaded dataset artifact."""

    file_id: str = Field(..., description="File identifier or relative path for the stored artifact")
    file_path: Optional[str] = Field(default=None, description="Relative path inside uploads directory")
    file_type: Literal["image", "document", "other"] = "image"
    tags: List[str] = Field(default_factory=list)
    size_bytes: Optional[int] = Field(default=None, ge=0)


class ScopeDefinition(BaseModel):
    """Scope that determines which projects/groups the standard applies to."""

    level: Literal["all", "group", "project"] = "all"
    ids: List[str] = Field(default_factory=list)


class QualityStandardBase(BaseModel):
    """Shared fields for quality standards."""

    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    type: Literal["text", "dataset"] = "text"
    rules: List[RuleDefinition] = Field(default_factory=list)
    dataset_refs: List[DatasetReference] = Field(default_factory=list)
    scope: ScopeDefinition = Field(default_factory=ScopeDefinition)
    status: Literal["active", "archived"] = "active"


class QualityStandardCreate(QualityStandardBase):
    """Payload for creating a new quality standard."""


class QualityStandardUpdate(BaseModel):
    """Partial update payload for quality standards."""

    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    type: Optional[Literal["text", "dataset"]] = None
    rules: Optional[List[RuleDefinition]] = None
    dataset_refs: Optional[List[DatasetReference]] = None
    scope: Optional[ScopeDefinition] = None
    status: Optional[Literal["active", "archived"]] = None


class QualityStandardResponse(QualityStandardBase):
    """Standard response returned to API clients."""

    id: str = Field(..., alias="_id")
    created_by: Optional[str] = None
    version: Optional[int] = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda value: value.isoformat() if value else None}


class QualityAnalysisRequest(BaseModel):
    """Metadata captured when triggering an AI evaluation."""

    task_id: Optional[str] = None
    project_id: Optional[str] = None
    task_title: str
    task_description: Optional[str] = None
    standard_ids: List[str] = Field(default_factory=list)
    triggered_by: Optional[str] = None
    description_override: Optional[str] = None
    report_type: Optional[str] = None


class QualityAnalysisResult(BaseModel):
    """Structured result returned after an AI evaluation."""

    analysis_id: str = Field(..., alias="_id")
    task_id: Optional[str] = None
    project_id: Optional[str] = None
    score: float = Field(..., ge=0.0, le=100.0)
    passed_rules: List[dict] = Field(default_factory=list)
    failed_rules: List[dict] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    status: str = Field(default="pending")
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class TodoAuditEntry(BaseModel):
    """Audit log entry for TODO checklist interactions."""

    todo_id: str
    task_id: str
    project_id: Optional[str] = None
    checked_by: str
    action: Literal["checked", "unchecked"] = "checked"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
