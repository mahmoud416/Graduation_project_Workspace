"""File upload rules model for MongoDB."""
from datetime import datetime
from typing import List, Optional
from bson import ObjectId


class FileUploadRuleModel:
    """Upload rules document structure — one per project."""

    @staticmethod
    def create_document(
        project_id: ObjectId,
        updated_by: ObjectId,
        allowed_types: Optional[List[str]] = None,
        max_size_mb: int = 50,
        naming_pattern: Optional[str] = None,
        naming_description: Optional[str] = None,
    ) -> dict:
        return {
            "project_id":         project_id,
            "allowed_types":      allowed_types or [],
            "max_size_mb":        max_size_mb,
            "naming_pattern":     naming_pattern,
            "naming_description": naming_description,
            "updated_by":         updated_by,
            "updated_at":         datetime.utcnow(),
        }
