"""
IT-layer routes — system-wide oversight for the IT administrator role.

The IT role sits above all other roles and grants cross-team visibility:
  - Full user directory with login history per account
  - Create users with any role (including admin / it)
  - Update the role or status of any existing user
  - Read all tasks and comments across every team without membership restrictions

All endpoints in this module are gated by require_it_role, so a single
403 guard at the dependency level covers the entire router.
"""
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING, ReturnDocument

from app.db.collections import (
    COMMENTS_COLLECTION,
    TASKS_COLLECTION,
    USERS_COLLECTION,
)
from app.db.mongodb import get_database
from app.dependencies.rbac import require_it_role, require_admin_or_it
from app.models.user import UserModel
from app.core.security import hash_password

router = APIRouter(prefix="/it", tags=["IT"])

# ── helpers ──────────────────────────────────────────────────────────────────

def _serialize_user(doc: Dict[str, Any], include_history: bool = False) -> dict:
    """
    Convert a raw MongoDB user document to a plain dict safe for JSON responses.

    login_history is stripped by default and only included when the caller
    explicitly requests it (e.g. the single-user detail endpoint), keeping
    list responses lean.
    """
    out = {
        "_id":          str(doc["_id"]),
        "email":        doc.get("email", ""),
        "name":         doc.get("name", ""),
        "role":         doc.get("role", "staff"),
        "status":       doc.get("status", "active"),
        "phone":        doc.get("phone"),
        "admin_id":     doc.get("admin_id"),
        "sub_manager_id": doc.get("sub_manager_id"),
        "created_at":   doc.get("created_at"),
        "last_login":   doc.get("last_login"),
        # last_seen is updated on every authenticated request — used by the
        # IT portal to derive the user's online/offline presence status.
        "last_seen":    doc.get("last_seen"),
        "is_active":    doc.get("is_active", True),
        "login_history": [],
    }
    if include_history:
        # Reverse so the most recent entry comes first in the response.
        raw = doc.get("login_history") or []
        out["login_history"] = list(reversed(raw))
    return out


# ── user endpoints ────────────────────────────────────────────────────────────

@router.get("/users", summary="List all users (IT / Admin)")
async def list_all_users(
    role: Optional[str] = Query(default=None, description="Filter by role"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    _it: Dict[str, Any] = Depends(require_admin_or_it),
    db=Depends(get_database),
) -> List[dict]:
    """
    Return all user accounts in the system.

    Results are sorted by creation date (newest first) and paginated.
    login_history is omitted here — use GET /it/users/{id} to fetch it.
    """
    query: Dict[str, Any] = {}
    if role:
        query["role"] = role

    docs = (
        await db[USERS_COLLECTION]
        .find(query)
        .sort("created_at", DESCENDING)
        .skip(skip)
        .limit(limit)
        .to_list(length=None)
    )
    return [_serialize_user(d) for d in docs]


@router.get("/users/{user_id}", summary="Get single user with full login history (IT / Admin)")
async def get_user_detail(
    user_id: str,
    _it: Dict[str, Any] = Depends(require_admin_or_it),
    db=Depends(get_database),
) -> dict:
    """
    Return a single user's full profile including the complete login_history array.

    This is intentionally a separate endpoint from the list so that the
    potentially large history array is only fetched when the caller needs it.
    """
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    doc = await db[USERS_COLLECTION].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return _serialize_user(doc, include_history=True)


@router.post("/users", status_code=status.HTTP_201_CREATED, summary="Create a user (IT / Admin)")
async def create_user(
    payload: Dict[str, Any],
    _it: Dict[str, Any] = Depends(require_admin_or_it),
    db=Depends(get_database),
) -> dict:
    """
    Create a new user account.

    Unlike the public /auth/register endpoint, this one:
      - Accepts any role value, including 'admin' and 'it'
      - Does not issue a token — the account is created for someone else

    Expected body: { email, password, full_name, role?, phone?, status? }
    """
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    full_name = (payload.get("full_name") or "").strip()

    if not email or not password or not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="email, password, and full_name are required"
        )

    existing = await db[USERS_COLLECTION].find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    doc = UserModel.create_document(
        email=email,
        password=hash_password(password),
        full_name=full_name,
        role=payload.get("role") or "staff",
        admin_id=payload.get("admin_id"),
        sub_manager_id=payload.get("sub_manager_id"),
        phone=payload.get("phone"),
        status=payload.get("status") or "active",
    )
    result = await db[USERS_COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_user(doc)


@router.patch("/users/{user_id}", summary="Update user role / status (IT / Admin)")
async def update_user(
    user_id: str,
    payload: Dict[str, Any],
    _it: Dict[str, Any] = Depends(require_admin_or_it),
    db=Depends(get_database),
) -> dict:
    """
    Partial update for any user account.

    Allowed fields: role, status, name, phone.
    The IT role can promote users to any role, including 'admin' or 'it'.
    """
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    allowed = {"role", "status", "name", "phone"}
    updates = {k: v for k, v in payload.items() if k in allowed and v is not None}

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields supplied. Allowed: role, status, name, phone"
        )

    updated = await db[USERS_COLLECTION].find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return _serialize_user(updated)


# ── task endpoints ────────────────────────────────────────────────────────────

@router.get("/tasks", summary="List all tasks across all teams (IT / Admin)")
async def list_all_tasks(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    _it: Dict[str, Any] = Depends(require_admin_or_it),
    db=Depends(get_database),
) -> List[dict]:
    """
    Return every task in the system, sorted by creation date (newest first).

    No team-membership check is applied — the IT role has unrestricted read access.
    ObjectId fields are serialised to strings for JSON compatibility.
    """
    docs = (
        await db[TASKS_COLLECTION]
        .find({})
        .sort("created_at", DESCENDING)
        .skip(skip)
        .limit(limit)
        .to_list(length=None)
    )

    def _serialize_task(t: Dict[str, Any]) -> dict:
        t["_id"] = str(t["_id"])
        for field in ("project_id", "team_id", "assigned_to", "created_by"):
            if t.get(field):
                t[field] = str(t[field])
        return t

    return [_serialize_task(d) for d in docs]


# ── comment / message endpoints ───────────────────────────────────────────────

@router.get("/comments", summary="List all comments / messages (IT)")
async def list_all_comments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    _it: Dict[str, Any] = Depends(require_it_role),
    db=Depends(get_database),
) -> List[dict]:
    """
    Return every comment in the system with its author's name and email resolved.

    Comments are the primary communication channel between users (posted on
    task boards / projects).  The IT role can read all of them regardless of
    project membership.
    """
    docs = (
        await db[COMMENTS_COLLECTION]
        .find({"is_deleted": {"$ne": True}})
        .sort("created_at", DESCENDING)
        .skip(skip)
        .limit(limit)
        .to_list(length=None)
    )

    # Batch-resolve author names to avoid N+1 queries.
    author_ids = {d["author_id"] for d in docs if d.get("author_id")}
    authors: Dict[ObjectId, Dict[str, Any]] = {}
    if author_ids:
        cursor = db[USERS_COLLECTION].find(
            {"_id": {"$in": list(author_ids)}},
            {"name": 1, "email": 1},
        )
        async for u in cursor:
            authors[u["_id"]] = u

    def _serialize_comment(c: Dict[str, Any]) -> dict:
        author = authors.get(c.get("author_id"), {})
        return {
            "_id":         str(c["_id"]),
            "project_id":  str(c["project_id"]) if c.get("project_id") else None,
            "task_id":     str(c["task_id"]) if c.get("task_id") else None,
            "content":     c.get("content", ""),
            "author_id":   str(c["author_id"]) if c.get("author_id") else None,
            "author_name":  author.get("name", "Unknown"),
            "author_email": author.get("email", ""),
            "created_at":  c.get("created_at"),
        }

    return [_serialize_comment(d) for d in docs]
