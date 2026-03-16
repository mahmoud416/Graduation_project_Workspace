"""
Pydantic schemas for Quality Control API requests and responses.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Literal


# ---------------------------------------------------------------------------
# Quality Rule (embedded in standard)
# ---------------------------------------------------------------------------

class QualityRule(BaseModel):
    id: str
    rule: str
    category: str = "general"   # "text" | "image" | "file" | "general"
    is_active: bool = True


class QualityRuleCreate(BaseModel):
    rule: str = Field(..., min_length=3)
    category: str = "general"
    is_active: bool = True


# ---------------------------------------------------------------------------
# QC Standard
# ---------------------------------------------------------------------------

class QCStandardCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=5)
    standard_type: Literal["text_rules", "dataset"] = Field("text_rules", description="text_rules or dataset")
    rules: Optional[List[QualityRuleCreate]] = []
    scope: Literal["global", "project"] = Field("global", description="global or project")
    project_ids: Optional[List[str]] = []


class QCStandardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[List[QualityRule]] = None
    scope: Optional[str] = None
    project_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class QCStandardResponse(BaseModel):
    id: str = Field(..., alias="_id")
    created_by: str
    title: str
    description: str
    standard_type: str
    rules: List[dict] = []
    dataset_files: List[dict] = []
    scope: str
    project_ids: List[str] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        extra = "ignore"


# ---------------------------------------------------------------------------
# QC Analysis Request / Response
# ---------------------------------------------------------------------------

class QCAnalysisRequest(BaseModel):
    task_id: str
    project_id: str
    task_title: str
    task_description: str
    standard_ids: Optional[List[str]] = []   # Empty = use all applicable


class PassedStandard(BaseModel):
    standard_id: str
    rule: str
    result: str


class FailedStandard(BaseModel):
    standard_id: str
    rule: str
    reason: str


class FileAnalysisResult(BaseModel):
    file_name: str
    file_type: str
    analysis_result: str


class QCAnalysisResponse(BaseModel):
    id: str = Field(..., alias="_id")
    analyzed_by: str
    task_id: str
    project_id: str
    task_title: str
    task_description: str
    compliance_score: float
    passed_standards: List[dict] = []
    failed_standards: List[dict] = []
    suggestions: List[str] = []
    files_analyzed: List[dict] = []
    model_used: str
    created_at: datetime

    class Config:
        populate_by_name = True
        extra = "ignore"


# ---------------------------------------------------------------------------
# Todo Tracking
# ---------------------------------------------------------------------------

class TodoTrackRequest(BaseModel):
    task_id: str
    project_id: str
    todo_id: str
    todo_title: str
    action: Literal["checked", "unchecked"] = "checked"


class TodoTrackResponse(BaseModel):
    id: str = Field(..., alias="_id")
    user_id: str
    user_name: str
    task_id: str
    project_id: str
    todo_id: str
    todo_title: str
    action: str
    timestamp: datetime

    class Config:
        populate_by_name = True
        extra = "ignore"


# ---------------------------------------------------------------------------
# Roadmap Assistant
# ---------------------------------------------------------------------------

class RoadmapAnalysisRequest(BaseModel):
    project_id: str
    project_title: str
    project_description: Optional[str] = ""
    tasks_summary: Optional[List[str]] = []   # List of task titles in project
    context: Optional[str] = ""               # Extra context from user


class RoadmapAnalysisResponse(BaseModel):
    project_id: str
    issues_detected: List[str]
    suggested_tasks: List[str]
    workflow_improvements: List[str]
    best_practices: List[str]
    overall_assessment: str


# ---------------------------------------------------------------------------
# QC Chat
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    task_id: str
    project_id: str
    task_title: str
    task_description: Optional[str] = ""
    analysis_summary: Optional[str] = ""   # JSON-stringified previous analysis
    conversation: List[ChatMessage] = []
    message: str


class ChatResponse(BaseModel):
    reply: str


# ---------------------------------------------------------------------------
# Dashboard / Analytics
# ---------------------------------------------------------------------------

class QCDashboardStats(BaseModel):
    total_standards: int
    total_analyses: int
    avg_compliance_score: float
    tasks_passing_qc: int
    tasks_failing_qc: int
    tasks_awaiting_qc: int = 0
    total_todo_completions: int
    recent_analyses: List[dict] = []
    quality_trend_14d: List[dict] = []
    compliance_by_project: List[dict] = []
