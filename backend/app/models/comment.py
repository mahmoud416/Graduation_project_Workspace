"""Comment model for MongoDB."""
from datetime import datetime
from typing import Optional
from bson import ObjectId


class CommentModel:
    """Comment document structure for MongoDB."""

    @staticmethod
    def create_document(
        project_id: ObjectId,
        author_id: ObjectId,
        content: str,
        task_id: Optional[ObjectId] = None,
    ) -> dict:
        now = datetime.utcnow()
        return {
            "project_id": project_id,
            "task_id":    task_id,
            "author_id":  author_id,
            "content":    content,
            "is_deleted": False,
            "created_at": now,
            "updated_at": now,
        }
