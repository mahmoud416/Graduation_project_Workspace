"""Task board API routes."""
from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any, List, Optional, Union
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse

from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import PROJECTS_COLLECTION, USERS_COLLECTION
from app.schemas.task_board import (
    MemberListResponse,
    TaskBoardResponse,
    TaskBoardMemberRequest,
    TaskBoardMemberPatch,
    TaskBoardTaskCreate,
    TaskBoardTaskPatch,
    TaskBoardUpdate,
)
from app.services.task_board_service import TaskBoardService, StoredUpload
from app.services.todo_audit_service import TodoAuditService
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/task-boards", tags=["Task Boards"])

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"
TASKFLOW_UPLOAD_ROOT = UPLOADS_ROOT / "taskflow"
TASKFLOW_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


@router.get("/{project_id}", response_model=TaskBoardResponse)
async def get_task_board(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    board = await TaskBoardService.get_board_by_project(db, normalized_id)
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)
    if normalized_id == TaskBoardService.PUBLIC_PROJECT_ID:
        board = await TaskBoardService.ensure_public_board(db)
    return TaskBoardService.serialize(board, current_user)


@router.patch("/{project_id}", response_model=TaskBoardResponse)
async def update_task_board_overview(
    project_id: str,
    payload: TaskBoardUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    board = await TaskBoardService.get_board_by_project(db, _stringify_project_id(project))
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)

    overview_updates = {
        "title": payload.title,
        "description": payload.description,
        "status_badge": payload.status_badge,
        "progress": payload.progress,
    }
    updated = await TaskBoardService.update_overview(db, _stringify_project_id(project), overview_updates)
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to update task board")
    return TaskBoardService.serialize(updated, current_user)


@router.post("/{project_id}/todos", response_model=TaskBoardResponse, status_code=status.HTTP_201_CREATED)
async def add_task_board_todo(
    project_id: str,
    payload: TaskBoardTaskCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    board = await TaskBoardService.get_board_by_project(db, _stringify_project_id(project))
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)

    submitted_by = str(current_user.get("_id", ""))
    submitted_by_name = current_user.get("name") or current_user.get("email", "")

    updated = await TaskBoardService.add_task(
        db,
        _stringify_project_id(project),
        title=payload.title,
        assignee=payload.assignee or "Unassigned",
        due=payload.due or "TBD",
        done=payload.done,
        submitted_by=submitted_by,
        submitted_by_name=submitted_by_name,
        extra_fields={
            "visibility": payload.visibility or "team",
            "report_type": payload.report_type,
            "description": payload.description,
            "assignee_ids": payload.assignee_ids or [],
            "created_by": submitted_by,
            "completed_by": [],
            "completed_by_names": [],
            "status": payload.status or "todo",
            "priority": payload.priority or "medium",
        },
    )
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create to-do entry")
    return TaskBoardService.serialize(updated, current_user)


@router.patch("/{project_id}/todos/{task_id}", response_model=TaskBoardResponse)
async def update_task_board_todo(
    project_id: str,
    task_id: str,
    payload: TaskBoardTaskPatch,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    board = await TaskBoardService.get_board_by_project(db, normalized_id)
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)

    # Structural edits (title, assignees, due, report_type, visibility, priority) are
    # manager-only.  Status/completion updates are allowed for all project members.
    role = (current_user.get("role") or "").lower()
    is_mgr = role in {"admin", "sub_admin", "manager"}
    structural_fields = {"title", "description", "assignee", "assignee_ids",
                         "due", "visibility", "report_type", "priority"}
    wants_structural = any(
        getattr(payload, f, None) is not None for f in structural_fields
    )
    if wants_structural and not is_mgr:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Only managers can edit task details. You can still update status and completion."
        )

    updates = {
        "title": payload.title,
        "description": payload.description,
        "assignee": payload.assignee,
        "assignee_ids": payload.assignee_ids,
        "due": payload.due,
        "done": payload.done,
        "visibility": payload.visibility,
        "report_type": payload.report_type,
        "completed_by": payload.completed_by,
        "completed_by_names": payload.completed_by_names,
        "status": payload.status,
        "priority": payload.priority,
    }
    # Remove None values so we don't overwrite existing fields with null
    updates = {k: v for k, v in updates.items() if v is not None}
    updated = await TaskBoardService.update_task(db, normalized_id, task_id, updates)
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task entry not found")

    if payload.done is not None:
        action = "checked" if payload.done else "unchecked"
        await TodoAuditService.log_event(
            db,
            todo_id=task_id,
            task_id=task_id,
            project_id=normalized_id,
            user_id=current_user.get("_id"),
            action=action,
        )
    return TaskBoardService.serialize(updated, current_user)


@router.delete("/{project_id}/todos/{task_id}", response_model=TaskBoardResponse)
async def delete_task_board_todo(
    project_id: str,
    task_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    board = await TaskBoardService.get_board_by_project(db, normalized_id)
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)

    _ensure_task_privileges(project, current_user, board)
    updated = await TaskBoardService.delete_task(db, _stringify_project_id(project), task_id)
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task entry not found")
    return TaskBoardService.serialize(updated, current_user)


@router.post("/{project_id}/members", response_model=TaskBoardResponse)
async def add_task_board_member(
    project_id: str,
    payload: TaskBoardMemberRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    _ensure_member_privileges(project, current_user)
    member_user = await _resolve_member_user(db, payload)
    normalized_id = _stringify_project_id(project)
    board = await TaskBoardService.get_board_by_project(db, normalized_id)
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)
    updated = await TaskBoardService.add_member(db, normalized_id, member_user)
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to add member")
    return TaskBoardService.serialize(updated, current_user)


@router.patch("/{project_id}/members/{member_id}", response_model=TaskBoardResponse)
async def patch_task_board_member(
    project_id: str,
    member_id: str,
    payload: TaskBoardMemberPatch,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    _ensure_member_privileges(project, current_user)
    normalized_id = _stringify_project_id(project)
    board = await TaskBoardService.get_board_by_project(db, normalized_id)
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)

    if payload.action == "remove":
        updated = await TaskBoardService.remove_member(db, normalized_id, member_id)
    else:
        updated = await TaskBoardService.update_member_profile(
            db,
            normalized_id,
            member_id,
            responsibility=payload.responsibility,
            role_label=payload.role,
        )

    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found or unchanged")
    return TaskBoardService.serialize(updated, current_user)


@router.get("/{project_id}/members/available", response_model=MemberListResponse)
async def list_available_members(
    project_id: str,
    search: str | None = None,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_member_privileges(project, current_user)
    normalized_id = _stringify_project_id(project)
    board = await TaskBoardService.get_board_by_project(db, normalized_id)
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)

    existing_ids = {member.get("user_id") for member in board.get("members", []) if member.get("user_id")}
    query: dict[str, Any] = {}
    filters = []
    if search:
        filters.append({"name": {"$regex": search, "$options": "i"}})
        filters.append({"email": {"$regex": search, "$options": "i"}})
    if filters:
        query["$or"] = filters
    if existing_ids:
        query["_id"] = {"$nin": [ObjectId(uid) for uid in existing_ids if len(uid) == 24]}

    users = await db[USERS_COLLECTION].find(query or {}).sort("name", 1).limit(25).to_list(length=None)
    members = [
        {
            "user_id": str(user["_id"]),
            "name": user.get("name") or user.get("full_name") or user.get("email", "Member"),
            "role": TaskBoardService._normalize_role(user.get("role")),
            "avatar": TaskBoardService._initials_from(user.get("name") or user.get("full_name") or user.get("email", "MB")),
            "email": user.get("email"),
        }
        for user in users
    ]
    return {"members": members}


@router.post("/{project_id}/comments", response_model=TaskBoardResponse, status_code=status.HTTP_201_CREATED)
async def add_task_board_comment(
    project_id: str,
    message: Annotated[Optional[str], Form()] = None,
    attachments: Annotated[Optional[Union[UploadFile, List[UploadFile]]], File()] = None,
    mentioned_user_ids: Annotated[Optional[Union[str, List[str]]], Form()] = None,
    reply_to_id: Annotated[Optional[str], Form()] = None,
    reply_to_preview: Annotated[Optional[str], Form()] = None,
    reply_to_author: Annotated[Optional[str], Form()] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    # Normalize mentioned_user_ids: single string → list (happens when only 1 mention)
    if isinstance(mentioned_user_ids, str):
        mentioned_user_ids = [mentioned_user_ids] if mentioned_user_ids else []

    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    board = await TaskBoardService.get_board_by_project(db, normalized_id)
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)

    role = current_user.get("role", "staff")
    if role == "staff" and not project.get("comments_enabled", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Comments are disabled for this project")

    attachment_payloads: List[StoredUpload] = []
    for upload in _coerce_uploads_to_list(attachments):
        stored = await _persist_upload_file(normalized_id, upload, folder="comments")
        attachment_payloads.append(stored)

    message_value = (message or "").strip()
    if not message_value and not attachment_payloads:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Comment text or attachment required")

    updated = await TaskBoardService.add_comment(
        db, normalized_id, message_value, current_user, attachment_payloads,
        reply_to_id=reply_to_id or None,
        reply_to_preview=reply_to_preview or None,
        reply_to_author=reply_to_author or None,
    )
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to add comment")

    # ── Create mention notifications ──────────────────────────────────────
    sender_name = current_user.get("name") or current_user.get("email", "Someone")
    board_title = (board.get("overview") or {}).get("title", "a channel")
    for uid_str in (mentioned_user_ids or []):
        try:
            uid_oid = ObjectId(uid_str)
            # Don't notify yourself
            if uid_oid == current_user.get("_id"):
                continue
            await NotificationService.create(
                db,
                user_id=uid_oid,
                notification_type="mention",
                payload={
                    "title": f"@{sender_name} mentioned you",
                    "body": f"In {board_title}: \"{message_value[:80]}{'…' if len(message_value) > 80 else ''}\"",
                    "project_id": normalized_id,
                    "sender_id": str(current_user.get("_id", "")),
                    "sender_name": sender_name,
                },
            )
        except Exception:
            pass  # Invalid ID or DB error — skip silently

    return TaskBoardService.serialize(updated, current_user)


@router.post("/{project_id}/resources", response_model=TaskBoardResponse, status_code=status.HTTP_201_CREATED)
async def upload_task_board_resource(
    project_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    board = await TaskBoardService.get_board_by_project(db, normalized_id)
    if not board:
        board = await TaskBoardService.ensure_board_for_project(db, project)

    role = current_user.get("role", "staff")
    if role == "staff" and not project.get("uploads_enabled", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="File uploads are disabled for this project")

    stored = await _persist_upload_file(normalized_id, file)
    updated = await TaskBoardService.add_resource_entry(
        db,
        normalized_id,
        file_name=stored["file_name"],
        relative_path=stored["relative_path"],
        uploader=current_user,
    )
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to store resource")
    return TaskBoardService.serialize(updated, current_user)


@router.delete("/{project_id}/resources/{resource_id}", response_model=TaskBoardResponse)
async def delete_task_board_resource(
    project_id: str,
    resource_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    resource = await TaskBoardService.find_resource(db, normalized_id, resource_id)
    if not resource:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _ensure_resource_access(resource, current_user)
    updated = await TaskBoardService.delete_resource_entry(db, normalized_id, resource_id)
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to delete resource")
    relative_path = resource.get("path")
    if isinstance(relative_path, str) and relative_path:
        _safe_delete_relative_path(relative_path)
    return TaskBoardService.serialize(updated, current_user)


@router.get("/{project_id}/resources/{resource_id}")
async def download_task_board_resource(
    project_id: str,
    resource_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    resource = await TaskBoardService.find_resource(db, normalized_id, resource_id)
    if not resource:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _ensure_resource_access(resource, current_user)
    relative_path = resource.get("path")
    if not isinstance(relative_path, str) or not relative_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Resource path missing")
    file_path = _resolve_storage_path(relative_path)
    if not file_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File missing on server")
    return FileResponse(path=file_path, filename=resource.get("file_name"))


@router.get("/{project_id}/comments/{comment_id}/attachments/{attachment_id}")
async def download_comment_attachment(
    project_id: str,
    comment_id: str,
    attachment_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    attachment = await TaskBoardService.find_comment_attachment(db, normalized_id, comment_id, attachment_id)
    if not attachment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    relative_path = attachment.get("path")
    if not isinstance(relative_path, str) or not relative_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Attachment path missing")
    file_path = _resolve_storage_path(relative_path)
    if not file_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File missing on server")
    return FileResponse(path=file_path, filename=attachment.get("file_name"))


@router.delete("/{project_id}/comments/{comment_id}", response_model=TaskBoardResponse)
async def delete_task_board_comment(
    project_id: str,
    comment_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    project = await _get_project_or_404(db, project_id)
    _ensure_project_visibility(project, current_user)
    normalized_id = _stringify_project_id(project)
    comment = await TaskBoardService.get_comment(db, normalized_id, comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Comment not found")

    role = (current_user.get("role") or "").lower()
    user_id = str(current_user.get("_id"))
    if role not in {"admin", "sub_admin"} and comment.get("user_id") != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only remove your own comment")

    attachments = comment.get("attachments", []) or []
    updated = await TaskBoardService.delete_comment(db, normalized_id, comment_id)
    if not updated:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to delete comment")

    for attachment in attachments:
        relative_path = attachment.get("path")
        if isinstance(relative_path, str) and relative_path:
            _safe_delete_relative_path(relative_path)

    return TaskBoardService.serialize(updated, current_user)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _get_project_or_404(db, project_id: str) -> dict[str, Any]:
    """Load a project document regardless of ObjectId vs string id."""
    normalized = _normalize_project_id(project_id)
    project = await db[PROJECTS_COLLECTION].find_one({"_id": normalized})
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _normalize_project_id(project_id: str) -> Any:
    """Allow 24-char ObjectId strings or literal identifiers."""
    if len(project_id) == 24:
        try:
            return ObjectId(project_id)
        except Exception:
            return project_id
    return project_id


def _stringify_project_id(project: dict[str, Any]) -> str:
    identifier = project.get("_id")
    return str(identifier)


def _ensure_project_visibility(project: dict[str, Any], current_user: dict[str, Any]) -> None:
    role = current_user.get("role")
    user_id = current_user.get("_id")
    project_str_id = _stringify_project_id(project)

    # Public channel — open to all authenticated users
    if project_str_id == TaskBoardService.PUBLIC_PROJECT_ID:
        return

    # Founder and admin see everything
    if role in ("founder", "admin"):
        return

    # Sub-admin channel — only founder/admin (handled above) and sub_admin
    if project_str_id == TaskBoardService.SUBADMIN_PROJECT_ID:
        if role == "sub_admin":
            return
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied")

    if role == "sub_admin":
        if user_id in (project.get("sub_admin_ids") or []) or project.get("owner_id") == user_id:
            return

    if role == "manager":
        if user_id in (project.get("sub_admin_ids") or []) or project.get("owner_id") == user_id:
            return

    if user_id in (project.get("staff_ids") or []):
        return

    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied")


async def _resolve_member_user(db, payload: TaskBoardMemberRequest) -> dict[str, Any]:
    if payload.user_id:
        try:
            lookup_id = ObjectId(payload.user_id)
        except Exception as exc:  # pragma: no cover - defensive
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid user id format") from exc
        user = await db[USERS_COLLECTION].find_one({"_id": lookup_id})
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    if payload.email:
        user = await db[USERS_COLLECTION].find_one({"email": payload.email.lower()})
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Provide either email or user_id")


def _ensure_member_privileges(project: dict[str, Any], current_user: dict[str, Any]) -> None:
    role = current_user.get("role")
    if role == "admin":
        return
    if role == "sub_admin":
        allowed_ids = project.get("sub_admin_ids") or []
        if current_user.get("_id") == project.get("owner_id") or current_user.get("_id") in allowed_ids:
            return
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only admins or assigned sub-managers can manage members")


def _ensure_resource_access(resource: dict[str, Any], current_user: dict[str, Any]) -> None:
    role = (current_user.get("role") or "").lower()
    if role in {"admin", "sub_admin"}:
        return
    viewer_id = str(current_user.get("_id"))
    if resource.get("uploaded_by") == viewer_id:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied to this resource")


def _coerce_uploads_to_list(value: Optional[Union[UploadFile, List[UploadFile]]]) -> List[UploadFile]:
    if value is None:
        return []
    if isinstance(value, list):
        return [upload for upload in value if upload is not None]
    return [value]


async def _persist_upload_file(project_id: str, upload: UploadFile, folder: str = "resources") -> StoredUpload:
    if not upload.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Missing filename")
    original_name = Path(upload.filename).name
    unique_name = f"{uuid4().hex}_{original_name}"
    project_dir = TASKFLOW_UPLOAD_ROOT / project_id / folder
    project_dir.mkdir(parents=True, exist_ok=True)
    destination = project_dir / unique_name
    contents = await upload.read()
    with destination.open("wb") as buffer:
        buffer.write(contents)
    relative_path = destination.relative_to(UPLOADS_ROOT).as_posix()
    return {"file_name": original_name, "relative_path": relative_path, "size": len(contents)}


def _resolve_storage_path(relative_path: str) -> Path:
    if not relative_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Resource path missing")
    candidate = (UPLOADS_ROOT / relative_path).resolve()
    uploads_root = UPLOADS_ROOT.resolve()
    if not str(candidate).startswith(str(uploads_root)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid resource path")
    return candidate


def _ensure_task_privileges(project: dict[str, Any], current_user: dict[str, Any], board: dict[str, Any] = None) -> None:
    """Only admin, sub_admin, or board manager can manage tasks."""
    role = (current_user.get("role") or "").lower()
    if role in {"admin", "sub_admin", "manager"}:
        return
        
    if board:
        user_id = str(current_user.get("_id"))
        for member in board.get("members", []):
            if member.get("user_id") == user_id and member.get("role", "").lower() == "manager":
                return
                
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only admins, sub-managers, or managers can manage tasks")


def _safe_delete_relative_path(relative_path: str) -> None:
    if not relative_path:
        return
    try:
        candidate = (UPLOADS_ROOT / relative_path).resolve()
        uploads_root = UPLOADS_ROOT.resolve()
        if not str(candidate).startswith(str(uploads_root)):
            return
        candidate.unlink(missing_ok=True)
    except Exception:
        return
