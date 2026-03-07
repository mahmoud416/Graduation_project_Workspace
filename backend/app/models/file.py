"""File/upload model for MongoDB."""
from datetime import datetime
from typing import Optional
from bson import ObjectId


class FileModel:
    """File document structure for MongoDB."""

    @staticmethod
    def create_document(
        project_id: ObjectId,
        uploaded_by: ObjectId,
        original_name: str,
        stored_name: str,
        mime_type: str,
        size_bytes: int,
        storage_path: str,
        context: str = "resource",
        context_id: Optional[ObjectId] = None,
    ) -> dict:
        return {
            "project_id":    project_id,
            "uploaded_by":   uploaded_by,
            "original_name": original_name,
            "stored_name":   stored_name,
            "mime_type":     mime_type,
            "size_bytes":    size_bytes,
            "storage_path":  storage_path,
            "context":       context,
            "context_id":    context_id,
            "created_at":    datetime.utcnow(),
        }
