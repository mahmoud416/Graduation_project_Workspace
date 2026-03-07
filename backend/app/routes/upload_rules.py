"""
Upload rule management routes.
Admin sets allowed file types, sizes, and naming rules per project.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from typing import List, Optional
from pydantic import BaseModel

from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import PROJECTS_COLLECTION, FILE_UPLOAD_RULES_COLLECTION

router = APIRouter(tags=["Upload Rules"])


class UploadRulesUpdate(BaseModel):
    allowed_types:      Optional[List[str]] = None
    max_size_mb:        Optional[int]       = None
    naming_pattern:     Optional[str]       = None
    naming_description: Optional[str]       = None


def _ensure_admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin only")


def _parse_project_id(project_id: str):
    if len(project_id) == 24 and ObjectId.is_valid(project_id):
        return ObjectId(project_id)
    return project_id


@router.get("/projects/{project_id}/upload-rules")
async def get_upload_rules(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get the file upload rules for a project."""
    pid = _parse_project_id(project_id)
    rules = await db[FILE_UPLOAD_RULES_COLLECTION].find_one({"project_id": pid})
    if not rules:
        return {
            "project_id":         project_id,
            "allowed_types":      [],
            "max_size_mb":        50,
            "naming_pattern":     None,
            "naming_description": None,
        }
    rules["_id"] = str(rules["_id"])
    rules["project_id"] = str(rules["project_id"])
    return rules


@router.put("/projects/{project_id}/upload-rules")
async def set_upload_rules(
    project_id: str,
    payload: UploadRulesUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Set file upload rules for a project. Admin only."""
    _ensure_admin(current_user)

    pid = _parse_project_id(project_id)
    project = await db[PROJECTS_COLLECTION].find_one({"_id": pid})
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")

    updates = {}
    if payload.allowed_types is not None:
        updates["allowed_types"] = payload.allowed_types
    if payload.max_size_mb is not None:
        updates["max_size_mb"] = payload.max_size_mb
    if payload.naming_pattern is not None:
        updates["naming_pattern"] = payload.naming_pattern
    if payload.naming_description is not None:
        updates["naming_description"] = payload.naming_description

    updates["project_id"] = pid
    updates["updated_by"] = current_user["_id"]

    from datetime import datetime
    updates["updated_at"] = datetime.utcnow()

    await db[FILE_UPLOAD_RULES_COLLECTION].update_one(
        {"project_id": pid},
        {"$set": updates},
        upsert=True
    )

    rules = await db[FILE_UPLOAD_RULES_COLLECTION].find_one({"project_id": pid})
    if rules:
        rules["_id"] = str(rules["_id"])
        rules["project_id"] = str(rules["project_id"])
    return rules
