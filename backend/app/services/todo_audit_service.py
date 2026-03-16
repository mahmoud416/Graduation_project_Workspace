"""Service helpers for TODO completion analytics."""
from datetime import datetime
from typing import Any

from bson import ObjectId

from app.db.collections import TODO_AUDIT_COLLECTION


class TodoAuditService:
    """Persists checklist interactions for downstream analytics."""

    @staticmethod
    async def log_event(
        db,
        *,
        todo_id: str,
        task_id: str,
        project_id: str,
        user_id: Any,
        action: str,
    ) -> None:
        if action not in {"checked", "unchecked"}:
            raise ValueError("Invalid TODO audit action")
        if isinstance(user_id, ObjectId):
            stored_user = user_id
        elif ObjectId.is_valid(str(user_id)):
            stored_user = ObjectId(str(user_id))
        else:
            stored_user = str(user_id)

        doc = {
            "todo_id": todo_id,
            "task_id": task_id,
            "project_id": project_id,
            "checked_by": stored_user,
            "action": action,
            "timestamp": datetime.utcnow(),
        }
        await db[TODO_AUDIT_COLLECTION].insert_one(doc)
