"""Service helpers for task board operations."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Set, TypedDict
from uuid import uuid4

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument

from app.db.collections import PROJECTS_COLLECTION, TASK_BOARDS_COLLECTION, USERS_COLLECTION
from app.models.task_board import TaskBoardModel


class StoredUpload(TypedDict):
    file_name: str
    relative_path: str
    size: int


class TaskBoardService:
    """Encapsulates TaskFlow board persistence logic."""

    PUBLIC_PROJECT_ID = "public-group"
    SUBADMIN_PROJECT_ID = "all-sub-admin"

    @staticmethod
    async def ensure_board_for_project(db, project_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch or create the board for the supplied project document."""
        project_identifier = TaskBoardService._stringify_id(project_doc.get("_id"))
        existing = await db[TASK_BOARDS_COLLECTION].find_one({"project_id": project_identifier})
        if existing:
            if project_identifier == TaskBoardService.PUBLIC_PROJECT_ID:
                return await TaskBoardService._sync_public_members_if_needed(db, existing)
            if project_identifier == TaskBoardService.SUBADMIN_PROJECT_ID:
                return await TaskBoardService._sync_sub_admin_members_if_needed(db, existing)
            return existing

        members = await TaskBoardService._build_member_profiles(db, project_doc)
        description = TaskBoardService._default_description(project_doc, members)
        status_label = TaskBoardService._status_label(project_doc.get("status"))
        progress = int(project_doc.get("progress", 0))

        doc = TaskBoardModel.create_document(
            project_id=project_identifier,
            project_title=project_doc.get("title", "Task Board"),
            description=description,
            status_label=status_label,
            progress=progress,
            members=members,
        )
        result = await db[TASK_BOARDS_COLLECTION].insert_one(doc)
        doc["_id"] = result.inserted_id
        if project_identifier == TaskBoardService.PUBLIC_PROJECT_ID:
            return await TaskBoardService._sync_public_members_if_needed(db, doc)
        if project_identifier == TaskBoardService.SUBADMIN_PROJECT_ID:
            return await TaskBoardService._sync_sub_admin_members_if_needed(db, doc)
        return doc

    @staticmethod
    async def get_board_by_project(db, project_id: str) -> Optional[Dict[str, Any]]:
        """Return the board linked to the provided project id string."""
        return await db[TASK_BOARDS_COLLECTION].find_one({"project_id": project_id})

    @staticmethod
    async def ensure_public_board(db) -> Dict[str, Any]:
        """Guarantee the public board exists even if defaults have not been seeded."""
        project = await db[PROJECTS_COLLECTION].find_one({"_id": TaskBoardService.PUBLIC_PROJECT_ID})
        if not project:
            project = TaskBoardService._default_public_project_doc()
            await db[PROJECTS_COLLECTION].update_one(
                {"_id": project["_id"]},
                {"$setOnInsert": project, "$set": {"updated_at": datetime.utcnow()}},
                upsert=True,
            )
            project = await db[PROJECTS_COLLECTION].find_one({"_id": TaskBoardService.PUBLIC_PROJECT_ID})
        return await TaskBoardService.ensure_board_for_project(db, project)

    @staticmethod
    async def ensure_sub_admin_board(db) -> Dict[str, Any]:
        """Guarantee the sub-admin board exists."""
        project = await db[PROJECTS_COLLECTION].find_one({"_id": TaskBoardService.SUBADMIN_PROJECT_ID})
        if not project:
            project = TaskBoardService._default_sub_admin_project_doc()
            await db[PROJECTS_COLLECTION].update_one(
                {"_id": project["_id"]},
                {"$setOnInsert": project, "$set": {"updated_at": datetime.utcnow()}},
                upsert=True,
            )
            project = await db[PROJECTS_COLLECTION].find_one({"_id": TaskBoardService.SUBADMIN_PROJECT_ID})
        return await TaskBoardService.ensure_board_for_project(db, project)

    @staticmethod
    async def ensure_public_membership_for_user(db, user_doc: Dict[str, Any]) -> None:
        """Add the provided user to the default board membership lists."""
        await TaskBoardService.ensure_public_board(db)
        await TaskBoardService._upsert_member_entry(db, TaskBoardService.PUBLIC_PROJECT_ID, user_doc)
        role = (user_doc.get("role") or "").lower()
        if role == "sub_admin":
            await TaskBoardService.ensure_sub_admin_board(db)
            await TaskBoardService._upsert_member_entry(db, TaskBoardService.SUBADMIN_PROJECT_ID, user_doc)

    @staticmethod
    async def update_overview(db, project_id: str, overview_updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Apply overview-level updates and return the refreshed board."""
        set_payload: Dict[str, Any] = {}
        for key, value in overview_updates.items():
            if value is None:
                continue
            set_payload[f"overview.{key}"] = value
        if not set_payload:
            return await TaskBoardService.get_board_by_project(db, project_id)
        set_payload["updated_at"] = datetime.utcnow()
        return await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id},
            {"$set": set_payload},
            return_document=ReturnDocument.AFTER,
        )

    @staticmethod
    async def add_task(
        db,
        project_id: str,
        title: str,
        assignee: str,
        due: str,
        done: bool,
    ) -> Optional[Dict[str, Any]]:
        """Append a new to-do entry to the board and sync progress."""
        task_id = TaskBoardService._generate_task_id()
        task_doc = TaskBoardModel.default_task_structure(task_id, title, assignee, due, done)
        board = await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id},
            {
                "$push": {"tasks": task_doc},
                "$set": {"updated_at": datetime.utcnow()},
            },
            return_document=ReturnDocument.AFTER,
        )
        await TaskBoardService._sync_progress(db, project_id, board)
        return board

    @staticmethod
    async def update_task(
        db,
        project_id: str,
        task_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Patch a single to-do entry and sync progress."""
        task_updates: Dict[str, Any] = {}
        for key, value in updates.items():
            if value is None:
                continue
            task_updates[f"tasks.$.{key}"] = value
        if not task_updates:
            return await TaskBoardService.get_board_by_project(db, project_id)
        task_updates["updated_at"] = datetime.utcnow()
        board = await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id, "tasks.id": task_id},
            {"$set": task_updates},
            return_document=ReturnDocument.AFTER,
        )
        await TaskBoardService._sync_progress(db, project_id, board)
        return board

    @staticmethod
    async def delete_task(
        db,
        project_id: str,
        task_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Remove a to-do entry from the board and sync progress."""
        board = await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id},
            {
                "$pull": {"tasks": {"id": task_id}},
                "$set": {"updated_at": datetime.utcnow()},
            },
            return_document=ReturnDocument.AFTER,
        )
        await TaskBoardService._sync_progress(db, project_id, board)
        return board

    @staticmethod
    def serialize(board: Dict[str, Any], current_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Convert a Mongo document into an API payload."""
        overview = board.get("overview", {})
        return {
            "_id": str(board.get("_id")) if board.get("_id") else None,
            "project_id": board.get("project_id"),
            "overview": {
                "title": overview.get("title", "Task Board"),
                "description": overview.get("description", ""),
                "status_badge": overview.get("status_badge", "IN PROGRESS"),
                "progress": int(overview.get("progress", 0)),
            },
            "tasks": board.get("tasks", []),
            "members": TaskBoardService._serialize_members(board.get("members", [])),
            "resources": TaskBoardService._serialize_resources(board, current_user),
            "comments": TaskBoardService._serialize_comments(board),
            "created_at": board.get("created_at"),
            "updated_at": board.get("updated_at"),
        }

    # ------------------------------------------------------------------
    # Progress helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _tasks_progress(tasks: List[Dict[str, Any]]) -> int:
        """Calculate 0-100 progress from a task list based on done count."""
        if not tasks:
            return 0
        done = sum(1 for t in tasks if t.get("done"))
        return round(done / len(tasks) * 100)

    @staticmethod
    async def _sync_progress(db, project_id: str, board: Optional[Dict[str, Any]]) -> None:
        """Recalculate progress from tasks and persist to both task_board and project."""
        if not board:
            return
        tasks = board.get("tasks", [])
        progress = TaskBoardService._tasks_progress(tasks)
        now = datetime.utcnow()

        # Update board overview.progress
        await db[TASK_BOARDS_COLLECTION].update_one(
            {"project_id": project_id},
            {"$set": {"overview.progress": progress, "updated_at": now}},
        )

        # Sync back to the project card — handle both ObjectId and string _id
        try:
            project_filter: Dict[str, Any] = {"_id": ObjectId(project_id)}
        except (InvalidId, TypeError):
            project_filter = {"_id": project_id}
        await db[PROJECTS_COLLECTION].update_one(
            project_filter,
            {"$set": {"progress": progress, "updated_at": now}},
        )

        # Mutate in-memory so the caller's serialize() sees the fresh value
        board.setdefault("overview", {})["progress"] = progress

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _serialize_members(members: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize member entries for API consumers."""
        serialized: List[Dict[str, Any]] = []
        for member in members or []:
            serialized.append({
                "user_id": member.get("user_id"),
                "name": member.get("name"),
                "role": member.get("role"),
                "avatar": member.get("avatar"),
                "email": member.get("email"),
                "responsibility": member.get("responsibility"),
                "online": bool(member.get("online", False)),
            })
        return serialized

    @staticmethod
    def _serialize_resources(board: Dict[str, Any], current_user: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Return resources filtered by the viewer's role."""
        resources = board.get("resources", []) or []
        if not resources:
            return []

        project_id = TaskBoardService._stringify_id(board.get("project_id")) if board.get("project_id") else None
        scoped_resources = [
            resource
            for resource in resources
            if TaskBoardService._resource_matches_board(resource, project_id)
        ]
        if not scoped_resources:
            return []

        filtered = TaskBoardService._filter_resources_for_user(scoped_resources, current_user)
        payload: List[Dict[str, Any]] = []
        for resource in filtered:
            resource_id = resource.get("_id") or resource.get("id")
            payload.append({
                "_id": str(resource_id) if resource_id else None,
                "id": str(resource_id) if resource_id else None,
                "file_name": resource.get("file_name"),
                "path": resource.get("path"),
                "uploaded_by": resource.get("uploaded_by"),
                "uploader_role": resource.get("uploader_role"),
                "uploader_name": resource.get("uploader_name"),
                "visible_to": resource.get("visible_to", "all"),
                "created_at": resource.get("created_at"),
                "download_url": f"/task-boards/{board.get('project_id')}/resources/{resource_id}",
            })
        return payload

    @staticmethod
    def _serialize_comments(board: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Normalize stored comments with attachment metadata."""
        project_id = board.get("project_id")
        comments = board.get("comments", []) or []
        serialized: List[Dict[str, Any]] = []
        for comment in comments:
            comment_id = comment.get("_id")
            attachments_payload: List[Dict[str, Any]] = []
            for attachment in comment.get("attachments", []) or []:
                attachment_id = attachment.get("_id")
                attachments_payload.append({
                    "_id": attachment_id,
                    "file_name": attachment.get("file_name"),
                    "path": attachment.get("path"),
                    "size": attachment.get("size"),
                    "download_url": f"/task-boards/{project_id}/comments/{comment_id}/attachments/{attachment_id}",
                })

            serialized.append({
                "_id": comment_id,
                "user_id": comment.get("user_id"),
                "user_name": comment.get("user_name"),
                "user_avatar": comment.get("user_avatar"),
                "message": comment.get("message"),
                "created_at": comment.get("created_at"),
                "attachments": attachments_payload,
            })
        return serialized

    @staticmethod
    async def _build_member_profiles(db, project_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Collect user snapshots referenced by the project."""
        user_ids: List[ObjectId] = []
        owner_id = project_doc.get("owner_id")
        if isinstance(owner_id, ObjectId):
            user_ids.append(owner_id)

        for field in ("sub_admin_ids", "staff_ids"):
            for identifier in project_doc.get(field, []) or []:
                if isinstance(identifier, ObjectId):
                    user_ids.append(identifier)

        if not user_ids:
            return []

        users = await db[USERS_COLLECTION].find({"_id": {"$in": list(set(user_ids))}}).to_list(length=None)
        return [TaskBoardService._member_payload_from(user) for user in users]

    @staticmethod
    def _default_description(project_doc: Dict[str, Any], members: List[Dict[str, Any]]) -> str:
        """Craft a friendly overview sentence for the board."""
        project_title = project_doc.get("title", "the project")
        if not members:
            return f"Central channel for {project_title} updates across the workspace."
        names = ", ".join(member["name"] for member in members[:5])
        extra = "" if len(members) <= 5 else f" +{len(members) - 5}"
        return f"Hub for {project_title} involving {names}{extra}."

    @staticmethod
    def _default_public_project_doc() -> Dict[str, Any]:
        """Fallback project payload for the workspace-wide channel."""
        now = datetime.utcnow()
        return {
            "_id": TaskBoardService.PUBLIC_PROJECT_ID,
            "title": "Public TaskFlow",
            "description": "Workspace-wide board connecting every member.",
            "status": "ACTIVE",
            "progress": 100,
            "owner_id": None,
            "sub_admin_ids": [],
            "staff_ids": [],
            "team_id": None,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def _default_sub_admin_project_doc() -> Dict[str, Any]:
        """Fallback project payload for the sub-admin coordination channel."""
        now = datetime.utcnow()
        return {
            "_id": TaskBoardService.SUBADMIN_PROJECT_ID,
            "title": "All_SubAdmin",
            "description": "Dedicated group holding every sub-admin for oversight and control.",
            "status": "ACTIVE",
            "progress": 100,
            "owner_id": None,
            "sub_admin_ids": [],
            "staff_ids": [],
            "team_id": None,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def _status_label(raw_status: Optional[str]) -> str:
        if not raw_status:
            return "IN PROGRESS"
        return str(raw_status).upper()

    @staticmethod
    def _member_payload_from(user: Dict[str, Any]) -> Dict[str, Any]:
        name = user.get("name") or user.get("full_name") or user.get("email", "Workspace Member")
        return {
            "user_id": TaskBoardService._stringify_id(user.get("_id")),
            "name": name,
            "role": TaskBoardService._normalize_role(user.get("role")),
            "avatar": TaskBoardService._initials_from(name),
            "email": user.get("email"),
            "responsibility": user.get("responsibility"),
            "online": False,
        }

    @staticmethod
    def _normalize_role(role: Optional[str]) -> str:
        if not role:
            return "Member"
        return role.replace("_", " ").title()

    @staticmethod
    def _stringify_id(identifier: Any) -> str:
        if isinstance(identifier, ObjectId):
            return str(identifier)
        return str(identifier)

    @staticmethod
    def _initials_from(name: str) -> str:
        parts = name.strip().split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        return name[:2].upper()

    @staticmethod
    def _generate_task_id() -> str:
        timestamp = int(datetime.utcnow().timestamp() * 1000)
        return f"task-{timestamp}"

    @staticmethod
    def _filter_resources_for_user(resources: List[Dict[str, Any]], current_user: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not current_user:
            return [res for res in resources if res.get("visible_to", "all") == "all"]

        role = (current_user.get("role") or "staff").lower()
        viewer_id = TaskBoardService._stringify_id(current_user.get("_id"))

        filtered: List[Dict[str, Any]] = []
        for resource in resources:
            scope = resource.get("visible_to", "all")
            if scope == "all":
                filtered.append(resource)
                continue
            if scope == "leaders" and role in {"admin", "sub_admin"}:
                filtered.append(resource)
                continue
            if scope == "self" and resource.get("uploaded_by") == viewer_id:
                filtered.append(resource)
        return filtered

    @staticmethod
    def _resource_matches_board(resource: Dict[str, Any], project_id: Optional[str]) -> bool:
        if not project_id:
            return True
        path = resource.get("path")
        if not isinstance(path, str) or not path:
            return True
        normalized_path = path.replace("\\", "/")
        needle = f"/{project_id}/"
        if needle in normalized_path:
            return True
        return normalized_path.startswith(f"{project_id}/")

    @staticmethod
    def _build_resource_doc(file_name: str, relative_path: str, uploader: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.utcnow()
        raw_role = (uploader.get("role") or "staff").lower()
        return {
            "_id": str(uuid4()),
            "file_name": file_name,
            "path": relative_path,
            "uploaded_by": TaskBoardService._stringify_id(uploader.get("_id")),
            "uploader_role": TaskBoardService._normalize_role(raw_role),
            "uploader_name": uploader.get("name") or uploader.get("full_name") or uploader.get("email"),
            "visible_to": TaskBoardService._visibility_scope(raw_role),
            "created_at": now,
        }

    @staticmethod
    def _visibility_scope(role: str) -> str:
        normalized = (role or "staff").lower()
        if normalized in {"admin", "sub_admin"}:
            return "leaders"
        return "all"

    @staticmethod
    def _build_comment_doc(message: str, author: Dict[str, Any], stored_files: Optional[List[StoredUpload]]) -> Dict[str, Any]:
        now = datetime.utcnow()
        normalized_message = (message or "").strip()
        user_name = author.get("name") or author.get("full_name") or author.get("email", "Workspace Member")
        attachments: List[Dict[str, Any]] = []
        for stored in stored_files or []:
            attachments.append({
                "_id": str(uuid4()),
                "file_name": stored["file_name"],
                "path": stored["relative_path"],
                "size": stored["size"],
                "created_at": now,
            })

        return {
            "_id": str(uuid4()),
            "user_id": TaskBoardService._stringify_id(author.get("_id")),
            "user_name": user_name,
            "user_avatar": TaskBoardService._initials_from(user_name),
            "message": normalized_message,
            "attachments": attachments,
            "created_at": now,
        }

    @staticmethod
    async def add_member(db, project_id: str, user_doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        await TaskBoardService._upsert_member_entry(db, project_id, user_doc)
        return await TaskBoardService.get_board_by_project(db, project_id)

    @staticmethod
    async def add_resource_entry(
        db,
        project_id: str,
        file_name: str,
        relative_path: str,
        uploader: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        resource_doc = TaskBoardService._build_resource_doc(file_name, relative_path, uploader)
        return await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id},
            {
                "$push": {"resources": resource_doc},
                "$set": {"updated_at": datetime.utcnow()},
            },
            return_document=ReturnDocument.AFTER,
        )

    @staticmethod
    async def add_comment(
        db,
        project_id: str,
        message: str,
        author: Dict[str, Any],
        stored_files: Optional[List[StoredUpload]] = None,
    ) -> Optional[Dict[str, Any]]:
        comment_doc = TaskBoardService._build_comment_doc(message, author, stored_files)
        return await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id},
            {
                "$push": {"comments": comment_doc},
                "$set": {"updated_at": datetime.utcnow()},
            },
            return_document=ReturnDocument.AFTER,
        )

    @staticmethod
    async def delete_resource_entry(db, project_id: str, resource_id: str) -> Optional[Dict[str, Any]]:
        return await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id},
            {
                "$pull": {"resources": {"_id": resource_id}},
                "$set": {"updated_at": datetime.utcnow()},
            },
            return_document=ReturnDocument.AFTER,
        )

    @staticmethod
    async def find_resource(db, project_id: str, resource_id: str) -> Optional[Dict[str, Any]]:
        projection = {"resources": {"$elemMatch": {"_id": resource_id}}, "project_id": 1}
        board = await db[TASK_BOARDS_COLLECTION].find_one({"project_id": project_id}, projection)
        if not board:
            return None
        resources = board.get("resources", [])
        if not resources:
            return None
        resource = resources[0]
        resource["project_id"] = board.get("project_id")
        return resource

    @staticmethod
    async def find_comment_attachment(
        db,
        project_id: str,
        comment_id: str,
        attachment_id: str,
    ) -> Optional[Dict[str, Any]]:
        projection = {"comments": {"$elemMatch": {"_id": comment_id}}, "project_id": 1}
        board = await db[TASK_BOARDS_COLLECTION].find_one({"project_id": project_id}, projection)
        if not board:
            return None
        comments = board.get("comments", [])
        if not comments:
            return None
        comment = comments[0]
        for attachment in comment.get("attachments", []) or []:
            if attachment.get("_id") == attachment_id:
                payload = attachment.copy()
                payload["project_id"] = board.get("project_id")
                payload["comment_id"] = comment_id
                return payload
        return None

    @staticmethod
    async def get_comment(db, project_id: str, comment_id: str) -> Optional[Dict[str, Any]]:
        projection = {"comments": {"$elemMatch": {"_id": comment_id}}, "project_id": 1}
        board = await db[TASK_BOARDS_COLLECTION].find_one({"project_id": project_id}, projection)
        if not board:
            return None
        comment_bucket = board.get("comments", [])
        if not comment_bucket:
            return None
        comment = comment_bucket[0].copy()
        comment["project_id"] = board.get("project_id")
        return comment

    @staticmethod
    async def delete_comment(db, project_id: str, comment_id: str) -> Optional[Dict[str, Any]]:
        return await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id},
            {
                "$pull": {"comments": {"_id": comment_id}},
                "$set": {"updated_at": datetime.utcnow()},
            },
            return_document=ReturnDocument.AFTER,
        )

    @staticmethod
    async def remove_member(db, project_id: str, member_id: str) -> Optional[Dict[str, Any]]:
        return await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id},
            {
                "$pull": {"members": {"user_id": member_id}},
                "$set": {"updated_at": datetime.utcnow()},
            },
            return_document=ReturnDocument.AFTER,
        )

    @staticmethod
    async def delete_board(db, project_id: str) -> None:
        """Remove the task board associated with the supplied project id."""
        await db[TASK_BOARDS_COLLECTION].delete_one({"project_id": project_id})

    @staticmethod
    async def update_member_profile(
        db,
        project_id: str,
        member_id: str,
        responsibility: Optional[str] = None,
        role_label: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        updates: Dict[str, Any] = {}
        if responsibility is not None:
            updates["members.$.responsibility"] = responsibility
        if role_label is not None:
            updates["members.$.role"] = TaskBoardService._normalize_role(role_label)
        if not updates:
            return await TaskBoardService.get_board_by_project(db, project_id)
        updates["updated_at"] = datetime.utcnow()
        return await db[TASK_BOARDS_COLLECTION].find_one_and_update(
            {"project_id": project_id, "members.user_id": member_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )

    @staticmethod
    async def _upsert_member_entry(db, project_id: str, user_doc: Dict[str, Any]) -> None:
        member_payload = TaskBoardService._member_payload_from(user_doc)
        update_target = {
            "project_id": project_id,
            "members.user_id": member_payload["user_id"],
        }
        update_payload = {
            "$set": {
                "members.$.name": member_payload["name"],
                "members.$.role": member_payload["role"],
                "members.$.avatar": member_payload["avatar"],
                "members.$.email": member_payload.get("email"),
                "members.$.responsibility": member_payload.get("responsibility"),
                "members.$.online": False,
                "updated_at": datetime.utcnow(),
            }
        }
        result = await db[TASK_BOARDS_COLLECTION].update_one(update_target, update_payload)
        if result.matched_count:
            return
        member_payload.setdefault("responsibility", "")
        await db[TASK_BOARDS_COLLECTION].update_one(
            {"project_id": project_id},
            {
                "$addToSet": {"members": member_payload},
                "$set": {"updated_at": datetime.utcnow()},
            },
        )

    @staticmethod
    async def _sync_public_members_if_needed(db, board: Dict[str, Any]) -> Dict[str, Any]:
        member_ids: Set[str] = set(
            member.get("user_id") for member in board.get("members", []) if member.get("user_id")
        )
        total_users = await db[USERS_COLLECTION].count_documents({})
        if len(member_ids) >= total_users and total_users > 0:
            return board

        cursor = db[USERS_COLLECTION].find({})
        async for user in cursor:
            user_id = TaskBoardService._stringify_id(user.get("_id"))
            if user_id in member_ids:
                continue
            await TaskBoardService._upsert_member_entry(db, TaskBoardService.PUBLIC_PROJECT_ID, user)
            member_ids.add(user_id)

        refreshed = await TaskBoardService.get_board_by_project(db, TaskBoardService.PUBLIC_PROJECT_ID)
        return refreshed or board

    @staticmethod
    async def _sync_sub_admin_members_if_needed(db, board: Dict[str, Any]) -> Dict[str, Any]:
        member_ids: Set[str] = set(
            member.get("user_id") for member in board.get("members", []) if member.get("user_id")
        )
        total_sub_admins = await db[USERS_COLLECTION].count_documents({"role": "sub_admin"})
        if len(member_ids) >= total_sub_admins and total_sub_admins > 0:
            return board

        cursor = db[USERS_COLLECTION].find({"role": "sub_admin"})
        async for user in cursor:
            user_id = TaskBoardService._stringify_id(user.get("_id"))
            if user_id in member_ids:
                continue
            await TaskBoardService._upsert_member_entry(db, TaskBoardService.SUBADMIN_PROJECT_ID, user)
            member_ids.add(user_id)

        refreshed = await TaskBoardService.get_board_by_project(db, TaskBoardService.SUBADMIN_PROJECT_ID)
        return refreshed or board
