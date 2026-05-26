"""
Quality Control API routes.
Handles quality rules, AI task evaluation, training datasets, and reports.
Only accessible to quality_manager and admin roles (except report reads for sub_admin).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from bson import ObjectId
from typing import List, Optional, Any
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field

from app.db.mongodb import get_database
from app.db.collections import (
    QUALITY_RULES_COLLECTION,
    QUALITY_EVALUATIONS_COLLECTION,
    QUALITY_DATASETS_COLLECTION,
    QUALITY_TRAINING_RUNS_COLLECTION,
    AI_MODEL_STATE_COLLECTION,
    TASKS_COLLECTION,
    PROJECTS_COLLECTION,
)
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import ensure_roles, QC_ROLE, LEGACY_QM_ROLE
from app.services import qc_service


router = APIRouter(prefix="/quality", tags=["Quality Control"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_qc_or_admin(current_user: dict) -> None:
    ensure_roles(current_user, [QC_ROLE, LEGACY_QM_ROLE, "admin"])


def _require_qc_admin_or_subadmin(current_user: dict) -> None:
    ensure_roles(current_user, [QC_ROLE, LEGACY_QM_ROLE, "admin", "sub_admin"])


def _str_id(doc: dict) -> dict:
    """Convert ObjectId fields to strings for JSON serialisation."""
    for field in ("_id", "owner_id", "task_id", "project_id", "evaluated_by",
                  "dataset_id", "created_by", "uploaded_by"):
        if field in doc and isinstance(doc[field], ObjectId):
            doc[field] = str(doc[field])
    return doc


# ---------------------------------------------------------------------------
# Pydantic schemas (inline — no separate schemas file needed for now)
# ---------------------------------------------------------------------------

class RuleCreate(BaseModel):
    rule: str = Field(..., min_length=3, max_length=500)
    category: str = Field("general", description="text | image | file | general")
    is_active: bool = True


class RuleUpdate(BaseModel):
    rule: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


MAX_FILES = 5
MAX_IMAGES = 10
MAX_FILE_SIZE_B64 = 27_962_027  # ~20 MB decoded (20 * 1024 * 1024 * 4/3 rounded up)
MAX_IMAGE_SIZE_B64 = 13_981_014  # ~10 MB decoded


class EvaluateTaskRequest(BaseModel):
    task_title: str = Field(..., min_length=1, max_length=500)
    task_description: str = Field("", max_length=10_000)
    files: List[dict] = Field(default_factory=list, max_length=MAX_FILES)
    image_base64: List[str] = Field(default_factory=list, max_length=MAX_IMAGES)
    task_id: Optional[str] = None
    report_type: Optional[str] = None
    submission_notes: Optional[str] = Field(None, max_length=5_000)


class ChatRequest(BaseModel):
    task_title: str
    task_description: str = ""
    analysis_summary: str = ""
    conversation: List[dict] = []
    message: str


class RoadmapRequest(BaseModel):
    project_id: str
    extra_context: str = ""


class BestPracticesRequest(BaseModel):
    project_type: str
    context: str = ""


class DatasetCreate(BaseModel):
    name: str
    description: str = ""
    data: List[dict] = []


# ---------------------------------------------------------------------------
# Quality Rules
# ---------------------------------------------------------------------------

@router.post("/rules", status_code=status.HTTP_201_CREATED)
async def create_rule(
    body: RuleCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a quality standard rule. Requires quality_manager or admin."""
    _require_qc_or_admin(current_user)
    doc = {
        "rule": body.rule,
        "category": body.category,
        "is_active": body.is_active,
        "owner_id": current_user["_id"],
        "created_at": datetime.utcnow(),
    }
    result = await db[QUALITY_RULES_COLLECTION].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["owner_id"] = str(doc["owner_id"])
    # Mark RAG index stale so next evaluation re-indexes rules
    try:
        from app.services.rag_service import mark_rules_dirty
        await mark_rules_dirty(db)
    except Exception:
        pass
    return doc


@router.get("/rules")
async def list_rules(
    is_active: Optional[bool] = Query(None),
    category: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """List all quality rules. Accessible to qm, admin, sub_admin."""
    _require_qc_admin_or_subadmin(current_user)
    query: dict[str, Any] = {}
    if is_active is not None:
        query["is_active"] = is_active
    if category:
        query["category"] = category
    docs = await db[QUALITY_RULES_COLLECTION].find(query).to_list(length=500)
    return [_str_id(d) for d in docs]


@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: str,
    body: RuleUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Update a quality rule. Requires quality_manager or admin."""
    _require_qc_or_admin(current_user)
    try:
        oid = ObjectId(rule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rule ID")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db[QUALITY_RULES_COLLECTION].find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Rule not found")
    # Mark RAG index stale
    try:
        from app.services.rag_service import mark_rules_dirty
        await mark_rules_dirty(db)
    except Exception:
        pass
    return _str_id(result)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete a quality rule. Requires quality_manager or admin."""
    _require_qc_or_admin(current_user)
    try:
        oid = ObjectId(rule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rule ID")
    result = await db[QUALITY_RULES_COLLECTION].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    # Mark RAG index stale
    try:
        from app.services.rag_service import mark_rules_dirty
        await mark_rules_dirty(db)
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Report Types
# ---------------------------------------------------------------------------

@router.get("/report-types")
async def get_report_types(
    current_user: dict = Depends(get_current_user),
):
    """Return the list of accreditation report types for task classification. Accessible to all authenticated users."""
    return [
        {
            "key": key,
            "name_ar": rt["name_ar"],
            "name_en": rt["name_en"],
            "description": rt["description"],
            "required_elements": rt["required_elements"],
        }
        for key, rt in qc_service.REPORT_TYPES.items()
    ]


# ---------------------------------------------------------------------------
# Task Evaluation
# ---------------------------------------------------------------------------

@router.post("/evaluate")
async def evaluate_task(
    body: EvaluateTaskRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Run AI quality evaluation against all active rules.
    Optionally links the result to a task_id.
    """
    if body.report_type and body.report_type not in qc_service.REPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unknown report type. Use GET /quality/report-types for valid keys.",
        )

    for f in body.files:
        if len(f.get("content", "")) > MAX_FILE_SIZE_B64:
            raise HTTPException(status_code=400, detail=f"File '{f.get('file_name', '?')}' exceeds 20 MB limit")
    for idx, img in enumerate(body.image_base64):
        if len(img) > MAX_IMAGE_SIZE_B64:
            raise HTTPException(status_code=400, detail=f"Image #{idx + 1} exceeds 10 MB limit")

    # Load all active rules
    rules = await db[QUALITY_RULES_COLLECTION].find({"is_active": True}).to_list(length=500)

    # Decode images
    import base64
    image_bytes_list = []
    for b64 in body.image_base64:
        try:
            image_bytes_list.append(base64.b64decode(b64))
        except Exception:
            pass

    # Decode and extract text from files
    file_texts = []
    if body.files:
        from app.routes.qc import _extract_pdf_text, _extract_docx_text
        for f in body.files:
            file_name = f.get("file_name", "")
            content_b64 = f.get("content", "")
            file_type = f.get("file_type", "")
            try:
                content_bytes = base64.b64decode(content_b64)
                extracted_text = ""
                if file_name.lower().endswith(".pdf") or "pdf" in file_type.lower():
                    extracted_text = _extract_pdf_text(content_bytes)
                elif file_name.lower().endswith(".docx") or "word" in file_type.lower() or "document" in file_type.lower():
                    extracted_text = _extract_docx_text(content_bytes)
                else:
                    try:
                        extracted_text = content_bytes.decode('utf-8')
                    except UnicodeDecodeError:
                        extracted_text = "[Binary file, cannot extract text]"
                
                entry = {
                    "file_name": file_name,
                    "content": extracted_text,
                    "file_type": file_type,
                }
                if file_name.lower().endswith(".pdf") or "pdf" in file_type.lower():
                    entry["raw_b64"] = content_b64
                file_texts.append(entry)
            except Exception as e:
                print(f"Error decoding file {file_name}: {e}")

    result = await qc_service.analyze_task_against_standards(
        task_title=body.task_title,
        task_description=body.task_description,
        standards_rules=rules,
        image_bytes_list=image_bytes_list if image_bytes_list else None,
        file_texts=file_texts if file_texts else None,
        db=db,
        report_type=body.report_type,
    )

    # Attach report type info to result for frontend display
    if body.report_type and body.report_type in qc_service.REPORT_TYPES:
        rt = qc_service.REPORT_TYPES[body.report_type]
        result["report_type_key"] = body.report_type
        result["report_type_name_ar"] = rt["name_ar"]
        result["report_type_name_en"] = rt["name_en"]
        result.setdefault("report_type_compliance", {
            "is_compliant": None,
            "missing_elements": [],
            "compliance_note": "Could not determine compliance.",
        })

    # Persist evaluation
    def _safe_task_id(tid: str | None):
        if not tid:
            return None
        try:
            return ObjectId(tid)
        except Exception:
            return tid  # store as plain string if not a valid ObjectId

    score = result.get("compliance_score", 0)
    is_passed = score >= 85

    if is_passed:
        eval_doc = {
            "task_id": _safe_task_id(body.task_id),
            "task_title": body.task_title,
            "evaluated_by": current_user["_id"],
            "rules_count": len(rules),
            "compliance_score": score,
            "passed_standards": result.get("passed_standards", []),
            "failed_standards": result.get("failed_standards", []),
            "suggestions": result.get("suggestions", []),
            "files_analyzed": result.get("files_analyzed", []),
            "report_type": body.report_type,
            "report_type_compliance": result.get("report_type_compliance"),
            "ai_mode": result.get("_mode", "unknown"),
            "submission_notes": body.submission_notes,
            "created_at": datetime.utcnow(),
        }
        inserted = await db[QUALITY_EVALUATIONS_COLLECTION].insert_one(eval_doc)
        result["evaluation_id"] = str(inserted.inserted_id)

        # If linked to a task, update task QC fields
        if body.task_id:
            try:
                await db[TASKS_COLLECTION].update_one(
                    {"_id": ObjectId(body.task_id)},
                    {"$set": {
                        "qc_evaluation_id": inserted.inserted_id,
                        "status": "QC_REVIEW",
                        "qc_status": "pending",
                        "qc_reviewed_by": None,
                        "qc_reviewed_at": None,
                        "report_type": body.report_type,
                        "report_type_compliant": result.get("report_type_compliance", {}).get("is_compliant"),
                        "aiScore": score,
                        "submission_notes": body.submission_notes,
                        "updated_at": datetime.utcnow(),
                    }},
                )
            except Exception:
                pass
    else:
        result["evaluation_id"] = "failed_attempt"

    result.pop("_raw", None)
    return result


@router.get("/evaluations")
async def list_evaluations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """List all evaluations, newest first. Requires qm, admin, or sub_admin."""
    _require_qc_admin_or_subadmin(current_user)
    docs = (
        await db[QUALITY_EVALUATIONS_COLLECTION]
        .find()
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )
    return [_str_id(d) for d in docs]


@router.get("/evaluations/{evaluation_id}")
async def get_evaluation(
    evaluation_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get a single evaluation result."""
    _require_qc_admin_or_subadmin(current_user)
    try:
        oid = ObjectId(evaluation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid evaluation ID")
    doc = await db[QUALITY_EVALUATIONS_COLLECTION].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return _str_id(doc)


@router.patch("/tasks/{task_id}/verdict")
async def set_task_qc_verdict(
    task_id: str,
    verdict: str = Query(..., description="approved | rejected"),
    notes: str = Query("", description="Optional QM notes"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Set QC verdict on a task (approved or rejected).
    approved  → status moves to QC_APPROVED
    rejected  → status moves to QC_REJECTED (staff must rework)
    Requires quality_manager or admin.
    """
    _require_qc_or_admin(current_user)
    if verdict not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="verdict must be 'approved' or 'rejected'")
    try:
        oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    new_status = "QC_APPROVED" if verdict == "approved" else "QC_REJECTED"
    result = await db[TASKS_COLLECTION].find_one_and_update(
        {"_id": oid},
        {"$set": {
            "qc_status": verdict,
            "status": new_status,
            "qc_notes": notes,
            "qc_reviewed_by": current_user["_id"],
            "qc_reviewed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return _str_id(result)


# ---------------------------------------------------------------------------
# AI Chat follow-up
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat_about_evaluation(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Conversational follow-up about a QC evaluation result."""
    _require_qc_or_admin(current_user)
    reply = await qc_service.chat_with_analysis(
        task_title=body.task_title,
        task_description=body.task_description,
        analysis_summary=body.analysis_summary,
        conversation=body.conversation,
        user_message=body.message,
    )
    return {"reply": reply}


# ---------------------------------------------------------------------------
# Project Roadmap Analysis
# ---------------------------------------------------------------------------

@router.post("/roadmap")
async def analyze_roadmap(
    body: RoadmapRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Run AI roadmap analysis for a project. Requires quality_manager or admin."""
    _require_qc_or_admin(current_user)
    try:
        proj_oid = ObjectId(body.project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db[PROJECTS_COLLECTION].find_one({"_id": proj_oid})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = await db[TASKS_COLLECTION].find({"project_id": proj_oid}).to_list(length=500)
    task_titles = [t.get("title", "") for t in tasks]

    # Gather active rules as standards context
    rules = await db[QUALITY_RULES_COLLECTION].find({"is_active": True}).to_list(length=200)
    standards_context = "\n".join(f"- [{r['category']}] {r['rule']}" for r in rules)

    result = await qc_service.analyze_project_roadmap(
        project_title=project.get("name", "Unknown"),
        project_description=project.get("description", ""),
        tasks_list=task_titles,
        standards_context=standards_context,
        extra_context=body.extra_context,
    )
    return result


# ---------------------------------------------------------------------------
# Best Practices
# ---------------------------------------------------------------------------

@router.get("/best-practices")
async def best_practices(
    project_type: str = Query(...),
    context: str = Query(""),
    current_user: dict = Depends(get_current_user),
    _db=Depends(get_database),
):
    """Return AI-generated best practices for a given project type."""
    _require_qc_admin_or_subadmin(current_user)
    practices = await qc_service.get_best_practices_for_project(project_type, context)
    return {"best_practices": practices}


# ---------------------------------------------------------------------------
# Training Datasets
# ---------------------------------------------------------------------------

@router.post("/datasets", status_code=status.HTTP_201_CREATED)
async def create_dataset(
    body: DatasetCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Upload a quality training dataset. Requires quality_manager."""
    _require_qc_or_admin(current_user)
    doc = {
        "name": body.name,
        "description": body.description,
        "data": body.data,
        "uploaded_by": current_user["_id"],
        "version": 1,
        "created_at": datetime.utcnow(),
    }
    result = await db[QUALITY_DATASETS_COLLECTION].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["uploaded_by"] = str(doc["uploaded_by"])
    return doc


@router.get("/datasets")
async def list_datasets(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """List training datasets. Requires quality_manager or admin."""
    _require_qc_or_admin(current_user)
    docs = await db[QUALITY_DATASETS_COLLECTION].find().sort("created_at", -1).to_list(length=100)
    return [_str_id(d) for d in docs]


@router.post("/train", status_code=status.HTTP_201_CREATED)
async def trigger_training(
    dataset_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Trigger a training run: extracts patterns from the dataset and stores
    them in quality_model_state so the AI analysis picks them up automatically.
    Requires quality_manager or admin.
    """
    _require_qc_or_admin(current_user)
    try:
        ds_oid = ObjectId(dataset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid dataset ID")

    dataset = await db[QUALITY_DATASETS_COLLECTION].find_one({"_id": ds_oid})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Extract patterns from dataset entries
    patterns: list[str] = []
    for item in dataset.get("data", []):
        if isinstance(item, dict):
            for key in ("pattern", "rule", "standard", "note", "description"):
                if item.get(key):
                    patterns.append(str(item[key]))
                    break

    if not patterns:
        raise HTTPException(
            status_code=400,
            detail="Dataset contains no extractable patterns. "
                   "Each entry should have a 'pattern', 'rule', or 'standard' key."
        )

    # Get current version
    last_state = await db[AI_MODEL_STATE_COLLECTION].find_one(
        {}, sort=[("version", -1)]
    )
    new_version = (last_state.get("version", 0) + 1) if last_state else 1

    run_doc = {
        "dataset_id": ds_oid,
        "triggered_by": current_user["_id"],
        "patterns_count": len(patterns),
        "status": "completed",
        "version": new_version,
        "created_at": datetime.utcnow(),
    }
    run_result = await db[QUALITY_TRAINING_RUNS_COLLECTION].insert_one(run_doc)

    # Store the new model state
    state_doc = {
        "version": new_version,
        "patterns": patterns,
        "source_dataset_id": ds_oid,
        "created_by": current_user["_id"],
        "created_at": datetime.utcnow(),
    }
    await db[AI_MODEL_STATE_COLLECTION].insert_one(state_doc)

    # Mark RAG patterns stale so next evaluation re-indexes learned patterns
    try:
        from app.services.rag_service import mark_patterns_dirty
        await mark_patterns_dirty(db)
    except Exception:
        pass

    return {
        "run_id": str(run_result.inserted_id),
        "version": new_version,
        "patterns_extracted": len(patterns),
        "status": "completed",
    }


@router.get("/model/state")
async def get_model_state(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get the current trained model state."""
    _require_qc_admin_or_subadmin(current_user)
    state = await db[AI_MODEL_STATE_COLLECTION].find_one(
        {}, sort=[("version", -1)]
    )
    if not state:
        return {"version": 0, "patterns": [], "message": "No model trained yet"}
    return _str_id(state)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@router.get("/reports/project/{project_id}")
async def project_quality_report(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Return quality metrics for a specific project.
    Requires qm, admin, or sub_admin.
    """
    _require_qc_admin_or_subadmin(current_user)
    try:
        proj_oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    # All tasks for this project
    tasks = await db[TASKS_COLLECTION].find({"project_id": proj_oid}).to_list(length=1000)
    task_ids = [t["_id"] for t in tasks]

    # All evaluations linked to those tasks
    evaluations = []
    if task_ids:
        evaluations = await db[QUALITY_EVALUATIONS_COLLECTION].find(
            {"task_id": {"$in": task_ids}}
        ).sort("created_at", -1).to_list(length=1000)

    total_evals = len(evaluations)
    avg_score = (
        sum(e.get("compliance_score", 0) for e in evaluations) / total_evals
        if total_evals > 0 else 0
    )

    # Task status breakdown
    status_counts: dict[str, int] = {}
    for t in tasks:
        s = t.get("status", "UNKNOWN")
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "project_id": project_id,
        "total_tasks": len(tasks),
        "total_evaluations": total_evals,
        "average_compliance_score": round(avg_score, 1),
        "task_status_breakdown": status_counts,
        "recent_evaluations": [_str_id(e) for e in evaluations[:10]],
    }


@router.get("/reports/overview")
async def system_quality_overview(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    System-wide quality overview across all projects.
    Requires quality_manager or admin.
    """
    _require_qc_or_admin(current_user)

    total_evals = await db[QUALITY_EVALUATIONS_COLLECTION].count_documents({})
    total_rules = await db[QUALITY_RULES_COLLECTION].count_documents({"is_active": True})
    total_tasks = await db[TASKS_COLLECTION].count_documents({})

    # Average score across all evaluations
    pipeline = [
        {"$group": {"_id": None, "avg_score": {"$avg": "$compliance_score"}}}
    ]
    agg = await db[QUALITY_EVALUATIONS_COLLECTION].aggregate(pipeline).to_list(length=1)
    avg_score = round(agg[0]["avg_score"], 1) if agg else 0

    # Last 5 evaluations
    recent = (
        await db[QUALITY_EVALUATIONS_COLLECTION]
        .find()
        .sort("created_at", -1)
        .limit(5)
        .to_list(length=5)
    )

    return {
        "total_tasks": total_tasks,
        "total_evaluations": total_evals,
        "active_rules": total_rules,
        "average_compliance_score": avg_score,
        "recent_evaluations": [_str_id(e) for e in recent],
    }


# ---------------------------------------------------------------------------
# Template download
# ---------------------------------------------------------------------------

_TEMPLATES_DIR = Path(__file__).parent.parent.parent / "uploads" / "templates"

_TEMPLATE_FILES = {
    "course_report":         {"ar": "template_course_report_ar.docx",         "en": "template_course_report_en.docx"},
    "program_report":        {"ar": "template_program_report_ar.docx",         "en": "template_program_report_en.docx"},
    "course_specification":  {"ar": "template_course_specification_ar.docx",   "en": "template_course_specification_en.docx"},
    "program_specification": {"ar": "template_program_specification_ar.docx",  "en": "template_program_specification_en.docx"},
}

_TEMPLATE_DISPLAY_NAMES = {
    "course_report":         {"ar": "نموذج تقرير مقرر",         "en": "Course Report Template"},
    "program_report":        {"ar": "نموذج تقرير برنامج",        "en": "Program Report Template"},
    "course_specification":  {"ar": "نموذج توصيف مقرر",          "en": "Course Specification Template"},
    "program_specification": {"ar": "نموذج توصيف برنامج",        "en": "Program Specification Template"},
}


@router.get("/templates/{report_type_key}")
async def download_template(
    report_type_key: str,
    lang: str = Query("ar", regex="^(ar|en)$"),
    current_user: dict = Depends(get_current_user),
):
    """
    Download the .docx template for a given report type.
    lang: 'ar' (default) or 'en'
    """
    if report_type_key not in _TEMPLATE_FILES:
        raise HTTPException(status_code=404, detail=f"No template for report type '{report_type_key}'")

    filename = _TEMPLATE_FILES[report_type_key][lang]
    file_path = _TEMPLATES_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Template file not found on server")

    display = _TEMPLATE_DISPLAY_NAMES[report_type_key][lang]
    return FileResponse(
        path=str(file_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{display}.docx"'},
    )


@router.get("/templates")
async def list_templates(current_user: dict = Depends(get_current_user)):
    """List available template types."""
    return {
        key: {
            "ar": _TEMPLATE_DISPLAY_NAMES[key]["ar"],
            "en": _TEMPLATE_DISPLAY_NAMES[key]["en"],
        }
        for key in _TEMPLATE_FILES
    }
