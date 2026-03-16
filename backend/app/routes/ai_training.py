"""
AI Model Training API routes.
Handles dataset uploads, training job management, and model metrics.
Accessible to: quality_manager, quality_control, admin
"""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any, List, Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from app.db.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.services.ai_training_service import AITrainingService, run_training_pipeline

router = APIRouter(prefix="/qc/ai", tags=["AI Model Training"])

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "ai_datasets"
UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------

_QM_ROLES = {"quality_manager", "quality_control", "admin"}

def _require_qm(current_user: dict) -> None:
    role = (current_user.get("role") or "").lower()
    if role not in _QM_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quality Manager, Quality Control, or Admin role required",
        )


# ---------------------------------------------------------------------------
# Dataset endpoints
# ---------------------------------------------------------------------------

@router.post("/datasets", status_code=status.HTTP_201_CREATED)
async def create_dataset(
    name: str = Form(...),
    description: str = Form(""),
    label: str = Form("good_quality"),          # good_quality | poor_quality
    dataset_type: str = Form("task_examples"),  # task_examples | documentation | screenshots | mixed
    tags: str = Form(""),                       # comma-separated
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Create a new training dataset record.
    Files are uploaded separately via POST /datasets/{id}/files.
    """
    _require_qm(current_user)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    dataset = await AITrainingService.create_dataset(
        db,
        uploaded_by=str(current_user["_id"]),
        name=name,
        description=description,
        label=label,
        dataset_type=dataset_type,
        tags=tag_list,
    )
    return dataset


@router.post("/datasets/{dataset_id}/files", status_code=status.HTTP_201_CREATED)
async def upload_dataset_file(
    dataset_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Upload a file (text, JSON, CSV, image) to a training dataset."""
    _require_qm(current_user)

    dataset = await AITrainingService.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    original_name = Path(file.filename or "upload").name
    unique_name   = f"{uuid.uuid4().hex}_{original_name}"
    dest_dir      = UPLOADS_ROOT / dataset_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / unique_name

    contents = await file.read()
    dest_path.write_bytes(contents)

    # Try to extract text preview for pattern learning
    content_preview = ""
    ct = (file.content_type or "").lower()
    if any(t in ct for t in ["text", "json", "xml", "csv", "markdown"]):
        try:
            decoded = contents.decode("utf-8", errors="ignore")
            content_preview = decoded[:3000]
        except Exception:
            pass
    elif ct == "application/json":
        try:
            import json
            data = json.loads(contents.decode("utf-8", errors="ignore"))
            content_preview = json.dumps(data, indent=2)[:3000]
        except Exception:
            pass

    file_entry = {
        "id":              uuid.uuid4().hex[:12],
        "file_name":       original_name,
        "file_path":       str(dest_path.relative_to(UPLOADS_ROOT.parent).as_posix()),
        "file_type":       file.content_type or "application/octet-stream",
        "file_size":       len(contents),
        "content_preview": content_preview,
    }

    updated = await AITrainingService.add_file_to_dataset(db, dataset_id, file_entry)
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to attach file")
    return updated


@router.get("/datasets")
async def list_datasets(
    label: Optional[str] = None,
    active_only: bool = True,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all training datasets."""
    _require_qm(current_user)
    datasets = await AITrainingService.list_datasets(db, active_only=active_only, label=label)
    return {"datasets": datasets, "total": len(datasets)}


@router.get("/datasets/{dataset_id}")
async def get_dataset(
    dataset_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get a single training dataset."""
    _require_qm(current_user)
    dataset = await AITrainingService.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete a training dataset."""
    _require_qm(current_user)
    deleted = await AITrainingService.delete_dataset(db, dataset_id)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Training Job endpoints
# ---------------------------------------------------------------------------

@router.post("/train", status_code=status.HTTP_201_CREATED)
async def trigger_training(
    background_tasks: BackgroundTasks,
    dataset_ids: str = Form(...),   # comma-separated
    notes: str = Form(""),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Trigger a model training run against selected datasets.
    Training runs as a background task; job status can be polled via /training-jobs/{id}.
    """
    _require_qm(current_user)

    id_list = [s.strip() for s in dataset_ids.split(",") if s.strip()]
    if not id_list:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="At least one dataset_id is required")

    # Validate datasets exist
    for did in id_list:
        ds = await AITrainingService.get_dataset(db, did)
        if not ds:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Dataset {did} not found")

    job = await AITrainingService.create_training_job(
        db,
        triggered_by=str(current_user["_id"]),
        dataset_ids=id_list,
        notes=notes,
    )

    # Launch training in background
    background_tasks.add_task(run_training_pipeline, db, job["_id"])

    return {
        "job_id":        job["_id"],
        "model_version": job["model_version"],
        "status":        job["status"],
        "message":       "Training job queued. Poll /qc/ai/training-jobs/{job_id} for progress.",
    }


@router.get("/training-jobs")
async def list_training_jobs(
    limit: int = Query(50, le=200),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all training job history."""
    _require_qm(current_user)
    jobs = await AITrainingService.list_training_jobs(db, limit=limit)
    return {"jobs": jobs, "total": len(jobs)}


@router.get("/training-jobs/{job_id}")
async def get_training_job(
    job_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get details of a specific training job."""
    _require_qm(current_user)
    job = await AITrainingService.get_training_job(db, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Training job not found")
    return job


# ---------------------------------------------------------------------------
# Model state & metrics endpoints
# ---------------------------------------------------------------------------

@router.get("/model-status")
async def get_model_status(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get current model version and status."""
    _require_qm(current_user)
    state = await AITrainingService.get_model_state(db)
    if not state:
        return {
            "status":   "untrained",
            "version":  "None",
            "accuracy": 0,
            "patterns": [],
            "message":  "No training runs completed yet. Upload datasets and trigger training.",
        }
    return {
        "status":         "trained",
        "version":        state["version"],
        "accuracy":       state["accuracy"],
        "patterns":       state["patterns"],
        "total_examples": state["total_examples"],
        "trained_at":     state.get("created_at", ""),
    }


@router.get("/model-metrics")
async def get_model_metrics(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get aggregated model performance metrics for the QM dashboard."""
    _require_qm(current_user)
    metrics = await AITrainingService.get_model_metrics(db)
    return metrics
