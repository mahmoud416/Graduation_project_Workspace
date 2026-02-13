"""
Project service.
Handles CRUD logic and view-model shaping for projects.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from bson import ObjectId
from pymongo import ReturnDocument

from app.models.project import ProjectModel, ProjectStatus
from app.db.collections import PROJECTS_COLLECTION, USERS_COLLECTION


class ProjectService:
    """Service helper methods for Project operations."""

    @staticmethod
    async def create_project(
        db,
        title: str,
        description: str,
        owner_id: Any,
        status: ProjectStatus,
        progress: int,
        sub_admin_ids: List[Any],
        staff_ids: List[Any],
        team_id: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Insert a new project document."""
        project_doc = ProjectModel.create_document(
            title=title,
            description=description,
            owner_id=owner_id,
            status=status,
            progress=progress,
            sub_admin_ids=sub_admin_ids,
            staff_ids=staff_ids,
            team_id=team_id
        )
        result = await db[PROJECTS_COLLECTION].insert_one(project_doc)
        project_doc["_id"] = result.inserted_id
        return project_doc

    @staticmethod
    async def ensure_default_groups(db, owner_id: Any) -> None:
        """Upsert the two default groups so they always exist in Mongo."""
        now = datetime.utcnow()
        defaults = [
            {
                "_id": "public-group",
                "title": "Public",
                "description": "Stores and manages all workspace users in a single public group.",
                "status": ProjectStatus.ACTIVE.value,
                "progress": 100,
                "owner_id": owner_id,
                "sub_admin_ids": [],
                "staff_ids": [],
                "team_id": None,
                "created_at": now,
            },
            {
                "_id": "all-sub-admin",
                "title": "All_SubAdmin",
                "description": "Dedicated group holding every sub-admin for oversight and control.",
                "status": ProjectStatus.ACTIVE.value,
                "progress": 100,
                "owner_id": owner_id,
                "sub_admin_ids": [],
                "staff_ids": [],
                "team_id": None,
                "created_at": now,
            },
        ]

        for doc in defaults:
            await db[PROJECTS_COLLECTION].update_one(
                {"_id": doc["_id"]},
                {
                    "$setOnInsert": doc,
                    # Only touch updated_at on existing docs to avoid owner_id conflicts
                    "$set": {"updated_at": now},
                },
                upsert=True,
            )

    @staticmethod
    async def list_projects(db, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Return all projects matching the supplied filters sorted by recency."""
        cursor = db[PROJECTS_COLLECTION].find(filters or {}).sort("updated_at", -1)
        return await cursor.to_list(length=None)

    @staticmethod
    async def get_project(db, project_id: ObjectId) -> Optional[Dict[str, Any]]:
        """Fetch a single project by ObjectId."""
        return await db[PROJECTS_COLLECTION].find_one({"_id": project_id})

    @staticmethod
    async def update_project(db, project_id: ObjectId, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Patch a project document and return the updated copy."""
        if not updates:
            return await ProjectService.get_project(db, project_id)

        updates["updated_at"] = datetime.utcnow()
        return await db[PROJECTS_COLLECTION].find_one_and_update(
            {"_id": project_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER
        )

    @staticmethod
    async def add_staff(db, project_id: ObjectId, staff_ids: List[ObjectId]) -> Optional[Dict[str, Any]]:
        """Attach one or more staff members to a project (idempotent)."""
        return await db[PROJECTS_COLLECTION].find_one_and_update(
            {"_id": project_id},
            {
                "$addToSet": {"staff_ids": {"$each": staff_ids}},
                "$set": {"updated_at": datetime.utcnow()}
            },
            return_document=ReturnDocument.AFTER
        )

    @staticmethod
    async def delete_project(db, project_id: Any) -> bool:
        """Remove a project document by id."""
        result = await db[PROJECTS_COLLECTION].delete_one({"_id": project_id})
        return result.deleted_count == 1

    # ------------------------------------------------------------------
    # Serialization helpers
    # ------------------------------------------------------------------
    @staticmethod
    async def serialize_many(db, projects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Attach user profile data to the provided project documents."""
        if not projects:
            return []

        user_ids: Set[Any] = set()
        for project in projects:
            sub_ids = project.get("sub_admin_ids") or []
            if not sub_ids and project.get("sub_admin_id"):
                sub_ids = [project["sub_admin_id"]]
            for sub_id in sub_ids:
                user_ids.add(sub_id)
            for staff_id in project.get("staff_ids", []):
                user_ids.add(staff_id)

        user_map: Dict[Any, Dict[str, Any]] = {}
        if user_ids:
            users = await db[USERS_COLLECTION].find({"_id": {"$in": list(user_ids)}}).to_list(length=None)
            user_map = {user["_id"]: user for user in users}

        return [ProjectService._serialize(project, user_map) for project in projects]

    @staticmethod
    def _serialize(project: Dict[str, Any], user_map: Dict[Any, Dict[str, Any]]) -> Dict[str, Any]:
        """Convert a raw MongoDB document into an API-friendly dict."""
        def initials_from(name: str | None, email: str | None) -> str:
            if name:
                parts = name.strip().split()
                if len(parts) >= 2:
                    return f"{parts[0][0]}{parts[-1][0]}".upper()
                return name[:2].upper()
            if email:
                return email[:2].upper()
            return "TM"

        owner_id = project.get("owner_id")
        team_id = project.get("team_id")
        response: Dict[str, Any] = {
            "_id": str(project["_id"]),
            "title": project.get("title", "Untitled Project"),
            "description": project.get("description", ""),
            "status": ProjectService._display_status(project.get("status", ProjectStatus.ACTIVE.value)),
            "progress": int(project.get("progress", 0)),
            "owner_id": str(owner_id) if owner_id else "",
            "team_id": str(team_id) if team_id else None,
            "created_at": project.get("created_at"),
            "updated_at": project.get("updated_at")
        }

        # Sub-Admin profile
        sub_admin_entries: List[Dict[str, Any]] = []
        sub_ids = project.get("sub_admin_ids") or []
        if not sub_ids and project.get("sub_admin_id"):
            sub_ids = [project["sub_admin_id"]]

        for sub_admin_id in sub_ids:
            user = user_map.get(sub_admin_id)
            if not user:
                continue
            person_initials = initials_from(user.get("name") or user.get("full_name"), user.get("email"))
            sub_admin_entries.append({
                "_id": str(user["_id"]),
                "name": user.get("name") or user.get("full_name", "Sub Admin"),
                "email": user.get("email", ""),
                "initials": person_initials
            })

        response["sub_admins"] = sub_admin_entries
        response["sub_admin"] = sub_admin_entries[0] if sub_admin_entries else None

        staff_entries: List[Dict[str, Any]] = []
        staff_initials: List[str] = []
        for staff_id in project.get("staff_ids", []):
            user = user_map.get(staff_id)
            if not user:
                continue
            person_initials = initials_from(user.get("name") or user.get("full_name"), user.get("email"))
            staff_entries.append({
                "_id": str(user["_id"]),
                "name": user.get("name") or user.get("full_name", "Staff"),
                "email": user.get("email", ""),
                "initials": person_initials
            })
            staff_initials.append(person_initials)

        response["staff"] = staff_entries
        response["staff_initials"] = staff_initials
        return response

    @staticmethod
    def _display_status(raw_status: str) -> str:
        """Convert stored enums into the labels expected by the UI."""
        if raw_status == ProjectStatus.ON_HOLD.value:
            return "ON HOLD"
        return raw_status.upper()
