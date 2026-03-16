"""
Quality Control API routes.
All endpoints require authentication. Most are restricted to the 'quality_control' role.
"""
from __future__ import annotations

import io
import uuid
from pathlib import Path
from typing import Any, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse

from app.db.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.models.qc_analysis import QCAnalysisModel
from app.schemas.qc import (
    QCStandardCreate,
    QCStandardUpdate,
    RoadmapAnalysisRequest,
    TodoTrackRequest,
    ChatRequest,
)
from app.services import ai_service
from app.services.qc_service import QCService

router = APIRouter(prefix="/qc", tags=["Quality Control"])

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "qc"
UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------

_QC_ROLES = {"quality_control", "quality_manager", "admin"}


def _require_qc_or_admin(current_user: dict) -> None:
    role = (current_user.get("role") or "").lower()
    if role not in _QC_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quality Control or Quality Manager role required",
        )


def _require_qc(current_user: dict) -> None:
    role = (current_user.get("role") or "").lower()
    if role not in _QC_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quality Control or Quality Manager role required",
        )


# ---------------------------------------------------------------------------
# QC Standards Endpoints
# ---------------------------------------------------------------------------

@router.post("/standards", status_code=status.HTTP_201_CREATED)
async def create_standard(
    payload: QCStandardCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a new quality standard (text rules or dataset)."""
    _require_qc_or_admin(current_user)

    rules_raw = [
        {
            "id":        uuid.uuid4().hex[:12],
            "rule":      r.rule,
            "category":  r.category,
            "is_active": r.is_active,
        }
        for r in (payload.rules or [])
    ]

    standard = await QCService.create_standard(
        db,
        created_by=str(current_user["_id"]),
        title=payload.title,
        description=payload.description,
        standard_type=payload.standard_type,
        rules=rules_raw,
        scope=payload.scope,
        project_ids=payload.project_ids or [],
    )
    return standard


@router.get("/standards")
async def list_standards(
    scope: Optional[str] = None,
    project_id: Optional[str] = None,
    active_only: bool = True,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all quality standards. QC/admin see all; others see standards for their projects."""
    standards = await QCService.list_standards(
        db,
        scope_filter=scope,
        project_id=project_id,
        active_only=active_only,
    )
    return {"standards": standards, "total": len(standards)}


@router.get("/standards/{standard_id}")
async def get_standard(
    standard_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get a single quality standard by ID."""
    standard = await QCService.get_standard(db, standard_id)
    if not standard:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Standard not found")
    return standard


@router.put("/standards/{standard_id}")
async def update_standard(
    standard_id: str,
    payload: QCStandardUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update a quality standard."""
    _require_qc_or_admin(current_user)
    updates = payload.model_dump(exclude_none=True)
    updated = await QCService.update_standard(db, standard_id, updates)
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Standard not found")
    return updated


@router.delete("/standards/{standard_id}")
async def delete_standard(
    standard_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete a quality standard."""
    _require_qc_or_admin(current_user)
    deleted = await QCService.delete_standard(db, standard_id)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Standard not found")
    return {"success": True}


@router.post("/standards/{standard_id}/dataset", status_code=status.HTTP_201_CREATED)
async def upload_dataset_file(
    standard_id: str,
    description: str = Form(""),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Upload a dataset file (example designs / documents) to a standard."""
    _require_qc_or_admin(current_user)

    standard = await QCService.get_standard(db, standard_id)
    if not standard:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Standard not found")

    # Save file
    original_name = Path(file.filename or "upload").name
    unique_name   = f"{uuid.uuid4().hex}_{original_name}"
    dest_dir      = UPLOADS_ROOT / standard_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / unique_name
    contents  = await file.read()
    dest_path.write_bytes(contents)

    file_entry = {
        "id":          uuid.uuid4().hex[:12],
        "file_name":   original_name,
        "file_path":   str(dest_path.relative_to(UPLOADS_ROOT.parent).as_posix()),
        "file_type":   file.content_type or "application/octet-stream",
        "description": description,
    }

    updated = await QCService.add_dataset_file(db, standard_id, file_entry)
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to attach file")
    return updated


# ---------------------------------------------------------------------------
# AI Task Analysis Endpoint
# ---------------------------------------------------------------------------

@router.post("/analyze", status_code=status.HTTP_200_OK)
async def analyze_task(
    task_id: str = Form(...),
    project_id: str = Form(...),
    task_title: str = Form(...),
    task_description: str = Form(""),
    standard_ids: str = Form(""),         # comma-separated list of standard IDs
    images: Optional[List[UploadFile]] = File(None),
    files: Optional[List[UploadFile]]  = File(None),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Analyze a task with AI against defined quality standards.
    Accepts task description, images, and files via multipart form.
    Returns compliance score, passed/failed standards, and suggestions.
    """
    _require_qc_or_admin(current_user)

    # Resolve applicable standards
    standard_id_list = [s.strip() for s in standard_ids.split(",") if s.strip()]
    if standard_id_list:
        standards_docs = []
        for sid in standard_id_list:
            s = await QCService.get_standard(db, sid)
            if s:
                standards_docs.append(s)
    else:
        # Auto-apply all active standards for this project
        standards_docs = await QCService.list_standards(db, project_id=project_id)

    if not standards_docs:
        # Fall back to global standards
        standards_docs = await QCService.list_standards(db, scope_filter="global")

    # Flatten all active rules
    all_rules: List[dict] = []
    for std in standards_docs:
        for rule in std.get("rules", []):
            if rule.get("is_active", True):
                all_rules.append({**rule, "standard_id": std["_id"]})

    # Read image bytes (max 3)
    image_bytes_list: List[bytes] = []
    if images:
        for img in images[:3]:
            if img and img.filename:
                image_bytes_list.append(await img.read())

    # Read text-extractable files
    file_texts: List[dict] = []
    if files:
        for f in files[:5]:
            if f and f.filename:
                content = await f.read()
                # Only try to decode text-like files
                ct = (f.content_type or "").lower()
                if any(t in ct for t in ["text", "json", "xml", "csv", "markdown"]):
                    try:
                        text = content.decode("utf-8", errors="ignore")
                        file_texts.append({
                            "file_name": f.filename,
                            "file_type": ct,
                            "content":   text,
                        })
                    except Exception:
                        pass

    # Call AI service (pass db so it can inject learned Quality Manager model patterns)
    ai_result = await ai_service.analyze_task_against_standards(
        task_title=task_title,
        task_description=task_description,
        standards_rules=all_rules,
        image_bytes_list=image_bytes_list if image_bytes_list else None,
        file_texts=file_texts if file_texts else None,
        db=db,
    )

    # Tag each result item with its standard_id if available
    passed = []
    for item in ai_result.get("passed_standards", []):
        matched = next((r for r in all_rules if r.get("rule") == item.get("rule")), {})
        passed.append({
            "standard_id": matched.get("standard_id", ""),
            "rule":        item.get("rule", ""),
            "result":      item.get("result", ""),
        })

    failed = []
    for item in ai_result.get("failed_standards", []):
        matched = next((r for r in all_rules if r.get("rule") == item.get("rule")), {})
        failed.append({
            "standard_id": matched.get("standard_id", ""),
            "rule":        item.get("rule", ""),
            "reason":      item.get("reason", ""),
        })

    # Persist to DB
    analysis_doc = QCAnalysisModel.create_document(
        analyzed_by=str(current_user["_id"]),
        task_id=task_id,
        project_id=project_id,
        task_title=task_title,
        task_description=task_description,
        compliance_score=ai_result.get("compliance_score", 0.0),
        passed_standards=passed,
        failed_standards=failed,
        suggestions=ai_result.get("suggestions", []),
        ai_raw_response=ai_result.get("_raw", ""),
        standards_applied=[s["_id"] for s in standards_docs],
        files_analyzed=ai_result.get("files_analyzed", []),
        model_used="gpt-4o",
    )
    saved = await QCService.save_analysis(db, analysis_doc)

    return {
        "analysis_id":      saved["_id"],
        "task_id":          task_id,
        "project_id":       project_id,
        "compliance_score": saved["compliance_score"],
        "passed_standards": saved["passed_standards"],
        "failed_standards": saved["failed_standards"],
        "suggestions":      saved["suggestions"],
        "files_analyzed":   saved["files_analyzed"],
        "standards_count":  len(all_rules),
        "model_used":       "gpt-4o",
    }


@router.get("/analyses")
async def list_analyses(
    project_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all AI analyses. Filtered by project if specified."""
    _require_qc_or_admin(current_user)
    analyses = await QCService.list_analyses(db, project_id=project_id, limit=limit)
    return {"analyses": analyses, "total": len(analyses)}


@router.get("/analyses/task/{task_id}")
async def get_analyses_for_task(
    task_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all AI analyses for a specific task."""
    analyses = await QCService.get_analyses_for_task(db, task_id)
    return {"analyses": analyses, "total": len(analyses)}


@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get a single AI analysis by ID."""
    analysis = await QCService.get_analysis(db, analysis_id)
    if not analysis:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    return analysis


# ---------------------------------------------------------------------------
# Todo Tracking
# ---------------------------------------------------------------------------

@router.post("/todo-tracking", status_code=status.HTTP_201_CREATED)
async def track_todo(
    payload: TodoTrackRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Track when a user checks or unchecks a todo item.
    Any authenticated user can call this.
    """
    tracking = await QCService.track_todo(
        db,
        user_id=str(current_user["_id"]),
        user_name=current_user.get("name", ""),
        task_id=payload.task_id,
        project_id=payload.project_id,
        todo_id=payload.todo_id,
        todo_title=payload.todo_title,
        action=payload.action,
    )
    return tracking


@router.get("/todo-tracking")
async def get_todo_tracking(
    project_id: Optional[str] = None,
    task_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(100, le=500),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get todo tracking records. QC/admin see all; staff see only their own."""
    role = (current_user.get("role") or "").lower()
    if role not in {"quality_control", "quality_manager", "admin", "sub_admin"}:
        user_id = str(current_user["_id"])

    records = await QCService.get_todo_tracking(
        db, project_id=project_id, task_id=task_id, user_id=user_id, limit=limit
    )
    return {"records": records, "total": len(records)}


# ---------------------------------------------------------------------------
# Reports & Analytics
# ---------------------------------------------------------------------------

@router.get("/reports/dashboard")
async def dashboard_stats(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get QC dashboard statistics."""
    _require_qc_or_admin(current_user)
    stats = await QCService.get_dashboard_stats(db)
    return stats


@router.get("/reports/analytics")
async def full_analytics(
    days: int = Query(30, le=365),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get full analytics data for charts and reports."""
    _require_qc_or_admin(current_user)
    analytics = await QCService.get_analytics(db, days=days)
    return analytics


@router.get("/reports/export/csv")
async def export_csv(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Export all analyses as CSV."""
    _require_qc_or_admin(current_user)
    csv_data = await QCService.export_analyses_csv(db)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=qc_analyses_export.csv"},
    )


@router.get("/reports/export/pdf")
async def export_pdf(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Export QC summary report as PDF."""
    _require_qc_or_admin(current_user)
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="PDF export requires reportlab. Install with: pip install reportlab",
        )

    stats    = await QCService.get_dashboard_stats(db)
    analyses = await QCService.list_analyses(db, limit=50)

    buffer = io.BytesIO()
    doc    = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story  = []

    story.append(Paragraph("Quality Control Report", styles["Title"]))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(f"Generated: {_now_str()}", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    # Summary section
    story.append(Paragraph("Summary", styles["Heading2"]))
    summary_data = [
        ["Metric", "Value"],
        ["Total Standards",     str(stats["total_standards"])],
        ["Total Analyses",      str(stats["total_analyses"])],
        ["Avg Compliance Score",f"{stats['avg_compliance_score']}%"],
        ["Tasks Passing QC",    str(stats["tasks_passing_qc"])],
        ["Tasks Failing QC",    str(stats["tasks_failing_qc"])],
        ["Todo Completions",    str(stats["total_todo_completions"])],
    ]
    t = Table(summary_data, colWidths=[8 * cm, 8 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
        ("ALIGN",      (1, 0), (1, -1), "CENTER"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Recent analyses
    story.append(Paragraph("Recent Analyses (last 50)", styles["Heading2"]))
    if analyses:
        table_data = [["Task", "Project", "Score", "Date"]]
        for a in analyses[:20]:
            table_data.append([
                (a.get("task_title") or "")[:40],
                (a.get("project_id") or "")[:20],
                f"{a.get('compliance_score', 0):.1f}%",
                str(a.get("created_at", ""))[:10],
            ])
        ta = Table(table_data, colWidths=[7 * cm, 4 * cm, 3 * cm, 4 * cm])
        ta.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
            ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
            ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",    (0, 0), (-1, -1), 8),
            ("GRID",        (0, 0), (-1, -1), 0.3, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EFF6FF")]),
        ]))
        story.append(ta)
    else:
        story.append(Paragraph("No analyses recorded yet.", styles["Normal"]))

    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=qc_report.pdf"},
    )


# ---------------------------------------------------------------------------
# AI Roadmap / Workflow Assistant
# ---------------------------------------------------------------------------

@router.post("/roadmap/analyze")
async def analyze_roadmap(
    payload: RoadmapAnalysisRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Analyze a project's workflow and suggest improvements using AI.
    Checks against quality standards and modern best practices.
    """
    _require_qc_or_admin(current_user)

    # Gather standards context for this project
    standards = await QCService.list_standards(db, project_id=payload.project_id)
    standards_context = ""
    for std in standards:
        rules_text = "; ".join(r.get("rule", "") for r in std.get("rules", []) if r.get("is_active"))
        if rules_text:
            standards_context += f"\n- {std['title']}: {rules_text}"

    result = await ai_service.analyze_project_roadmap(
        project_title=payload.project_title,
        project_description=payload.project_description or "",
        tasks_list=payload.tasks_summary or [],
        standards_context=standards_context,
        extra_context=payload.context or "",
    )

    return {
        "project_id":             payload.project_id,
        "issues_detected":        result.get("issues_detected", []),
        "suggested_tasks":        result.get("suggested_tasks", []),
        "workflow_improvements":  result.get("workflow_improvements", []),
        "best_practices":         result.get("best_practices", []),
        "overall_assessment":     result.get("overall_assessment", ""),
    }


@router.post("/roadmap/best-practices")
async def get_best_practices(
    project_type: str = Form(...),
    context: str = Form(""),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get industry best practices for a given project type via AI."""
    _require_qc_or_admin(current_user)
    practices = await ai_service.get_best_practices_for_project(project_type, context)
    return {"best_practices": practices}


@router.post("/web-search")
async def search_web(
    query: str = Form(...),
    max_results: int = Form(5),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Search the web for quality-related information."""
    _require_qc_or_admin(current_user)
    results = await ai_service.web_search(query, max_results=min(max_results, 10))
    return {"query": query, "results": results}


# ---------------------------------------------------------------------------
# QC Chat Assistant
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat_with_analysis(
    payload: ChatRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Chat with the AI about a task analysis result.
    Allows users to ask follow-up questions about why a task passed/failed standards.
    """
    conversation = [{"role": m.role, "content": m.content} for m in payload.conversation]
    reply = await ai_service.chat_with_analysis(
        task_title=payload.task_title,
        task_description=payload.task_description or "",
        analysis_summary=payload.analysis_summary or "",
        conversation=conversation,
        user_message=payload.message,
    )
    return {"reply": reply}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_str() -> str:
    from datetime import datetime
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
