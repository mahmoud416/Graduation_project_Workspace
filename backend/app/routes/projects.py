"""
Project management API routes.
Allows admins to create initiatives and assign sub-managers/staff.
"""
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectStaffUpdate,
    ProjectTogglesUpdate,
    ProjectUpdate,
)
from app.services.project_service import ProjectService
from app.services.task_board_service import TaskBoardService
from app.models.project import ProjectStatus
from app.db.mongodb import get_database
from app.db.collections import PROJECTS_COLLECTION, USERS_COLLECTION
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])
PUBLIC_GROUP_ID = "public-group"
SUB_MANAGER_GROUP_ID = "all-sub-admin"
DEFAULT_GROUP_IDS = {PUBLIC_GROUP_ID, SUB_MANAGER_GROUP_ID}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_user_id(value: Optional[str], label: str) -> Optional[str]:
    """Accept either ObjectId-looking strings or plain string IDs from existing data."""
    if value is None:
        return None
    trimmed = value.strip()
    # If it looks like an ObjectId, validate; otherwise accept raw string
    if len(trimmed) == 24:
        try:
            return ObjectId(trimmed)
        except Exception as exc:  # pragma: no cover - defensive
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid {label} format"
            ) from exc
    return trimmed


def _ensure_admin(current_user):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this action"
        )


def _visibility_filter(current_user) -> dict:
    role = current_user.get("role")
    user_id = current_user.get("_id")
    if role == "admin":
        return {}
    if role == "sub_manager":
        clauses = [{"_id": {"$in": list(DEFAULT_GROUP_IDS)}}]
        if user_id is not None:
            clauses.extend([
                {"sub_manager_ids": user_id},
                {"owner_id": user_id}
            ])
        return {"$or": clauses}

    clauses = [{"_id": PUBLIC_GROUP_ID}]
    if user_id is not None:
        clauses.append({"staff_ids": user_id})
    return {"$or": clauses}


async def _ensure_user_exists(db, user_id: str, expected_role: str, label: str):
    user = await db[USERS_COLLECTION].find_one({"_id": user_id, "role": expected_role})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} is invalid or does not have the required role"
        )


async def _serialize_single(db, project_doc):
    if not project_doc:
        return None
    enriched = await ProjectService.serialize_many(db, [project_doc])
    return enriched[0]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Admins can create new projects and assign a sub-manager plus staff."""
    _ensure_admin(current_user)

    sub_manager_ids: list[str] = []
    for raw_sub in project_data.sub_manager_ids:
        parsed_sub = _parse_user_id(raw_sub, "sub_manager_id")
        if parsed_sub:
            sub_manager_ids.append(parsed_sub)

    single_sub = _parse_user_id(project_data.sub_manager_id, "sub_manager_id")
    if single_sub:
        sub_manager_ids.append(single_sub)
    if sub_manager_ids:
        sub_manager_ids = list(dict.fromkeys(sub_manager_ids))
    staff_ids: list[str] = []
    for staff_id in project_data.staff_ids:
        parsed = _parse_user_id(staff_id, "staff_id")
        if parsed:
            staff_ids.append(parsed)
    if staff_ids:
        # Remove duplicates while preserving order
        staff_ids = list(dict.fromkeys(staff_ids))

    # Validate referenced users
    if sub_manager_ids:
        sub_count = await db[USERS_COLLECTION].count_documents({
            "_id": {"$in": sub_manager_ids},
            "role": "sub_manager"
        })
        if sub_count != len(sub_manager_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more sub managers are invalid"
            )

    if staff_ids:
        staff_count = await db[USERS_COLLECTION].count_documents({
            "_id": {"$in": staff_ids},
            "role": "staff"
        })
        if staff_count != len(staff_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more staff members are invalid"
            )

    project = await ProjectService.create_project(
        db,
        title=project_data.title,
        description=project_data.description,
        owner_id=current_user["_id"],
        status=project_data.status,
        progress=project_data.progress,
        sub_manager_ids=sub_manager_ids,
        staff_ids=staff_ids,
        team_id=_parse_user_id(project_data.team_id, "team_id")
    )

    await TaskBoardService.ensure_board_for_project(db, project)

    return await _serialize_single(db, project)


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    status_filter: Optional[ProjectStatus] = Query(default=None, alias="status"),
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Return projects visible to the current user based on their role."""
    await ProjectService.ensure_default_groups(db, current_user.get("_id"))

    query = _visibility_filter(current_user)
    if status_filter:
        query["status"] = status_filter.value

    projects = await ProjectService.list_projects(db, query)
    return await ProjectService.serialize_many(db, projects)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get a single project if the user has visibility rights."""
    project_obj_id = _parse_user_id(project_id, "project_id")
    if project_obj_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project id")
    project = await ProjectService.get_project(db, project_obj_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    visible_filter = _visibility_filter(current_user)
    visible_filter["_id"] = project_obj_id
    allowed = await db[PROJECTS_COLLECTION].find_one(visible_filter)
    if not allowed and current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return await _serialize_single(db, project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    update_data: ProjectUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Allow admins or assigned sub-managers to update project metadata."""
    project_obj_id = _parse_user_id(project_id, "project_id")
    if project_obj_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project id")
    project = await ProjectService.get_project(db, project_obj_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    is_admin = current_user.get("role") == "admin"
    assigned_subs = project.get("sub_manager_ids") or []
    if not assigned_subs and project.get("sub_manager_id"):
        assigned_subs = [project.get("sub_manager_id")]
    is_assigned_sub_manager = current_user.get("_id") in assigned_subs
    if not (is_admin or is_assigned_sub_manager):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    updates = {}
    if update_data.title is not None:
        updates["title"] = update_data.title
    if update_data.description is not None:
        updates["description"] = update_data.description
    if update_data.status is not None:
        updates["status"] = update_data.status.value
    if update_data.progress is not None:
        updates["progress"] = update_data.progress
    if update_data.sub_manager_ids is not None:
        sub_list: List[str] = []
        for raw in update_data.sub_manager_ids:
            parsed = _parse_user_id(raw, "sub_manager_id")
            if parsed:
                sub_list.append(parsed)
        if sub_list:
            sub_list = list(dict.fromkeys(sub_list))
            sub_count = await db[USERS_COLLECTION].count_documents({
                "_id": {"$in": sub_list},
                "role": "sub_manager"
            })
            if sub_count != len(sub_list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One or more sub managers are invalid"
                )
        updates["sub_manager_ids"] = sub_list
    elif update_data.sub_manager_id is not None:
        sub_manager_id = _parse_user_id(update_data.sub_manager_id, "sub_manager_id")
        if sub_manager_id:
            await _ensure_user_exists(db, sub_manager_id, "sub_manager", "Sub Manager")
            updates["sub_manager_ids"] = [sub_manager_id]
        else:
            updates["sub_manager_ids"] = []

    updated = await ProjectService.update_project(db, project_obj_id, updates)
    return await _serialize_single(db, updated)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Allow admins to delete custom project cards."""
    _ensure_admin(current_user)
    project_obj_id = _parse_user_id(project_id, "project_id")
    if project_obj_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project id")

    identifier_str = str(project_obj_id)
    if identifier_str in DEFAULT_GROUP_IDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Default workspace groups cannot be deleted")

    deleted = await ProjectService.delete_project(db, project_obj_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    await TaskBoardService.delete_board(db, identifier_str)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/staff", response_model=ProjectResponse)
async def add_staff_to_project(
    project_id: str,
    staff_payload: ProjectStaffUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Attach staff members to a project. Admin-only."""
    _ensure_admin(current_user)
    project_obj_id = _parse_user_id(project_id, "project_id")
    if project_obj_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project id")

    staff_ids: List[str] = []
    for staff_id in staff_payload.staff_ids:
        parsed = _parse_user_id(staff_id, "staff_id")
        if parsed:
            staff_ids.append(parsed)
    if staff_ids:
        staff_ids = list(dict.fromkeys(staff_ids))

    if not staff_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No staff ids supplied")

    staff_count = await db[USERS_COLLECTION].count_documents({
        "_id": {"$in": staff_ids},
        "role": "staff"
    })
    if staff_count != len(staff_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more staff members are invalid"
        )

    updated = await ProjectService.add_staff(db, project_obj_id, staff_ids)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return await _serialize_single(db, updated)


@router.patch("/{project_id}/toggles", response_model=ProjectResponse)
async def toggle_project_settings(
    project_id: str,
    payload: ProjectTogglesUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Toggle comments_enabled and/or uploads_enabled. Admin only."""
    _ensure_admin(current_user)
    project_obj_id = _parse_user_id(project_id, "project_id")
    if project_obj_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project id")

    project = await ProjectService.get_project(db, project_obj_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    updates = {}
    if payload.comments_enabled is not None:
        updates["comments_enabled"] = payload.comments_enabled
    if payload.uploads_enabled is not None:
        updates["uploads_enabled"] = payload.uploads_enabled

    if not updates:
        return await _serialize_single(db, project)

    updated = await ProjectService.update_project(db, project_obj_id, updates)
    return await _serialize_single(db, updated)
