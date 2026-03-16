"""
Quality Control Standard model for MongoDB.
Stores quality rules and datasets defined by QC users.
"""
from datetime import datetime
from typing import List, Optional


class QCStandardModel:
    """QC Standard document structure for MongoDB."""

    @staticmethod
    def create_document(
        created_by: str,
        title: str,
        description: str,
        standard_type: str = "text_rules",  # "text_rules" | "dataset"
        rules: Optional[List[dict]] = None,
        dataset_files: Optional[List[dict]] = None,
        scope: str = "global",             # "global" | "project"
        project_ids: Optional[List[str]] = None,
    ) -> dict:
        """Create a new QC standard document."""
        return {
            "created_by":    created_by,
            "title":         title,
            "description":   description,
            "standard_type": standard_type,
            "rules":         rules or [],
            # Each rule: {id, rule, category, is_active}
            # category: "text" | "image" | "file" | "general"
            "dataset_files": dataset_files or [],
            # Each file: {id, file_name, file_path, file_type, description}
            "scope":         scope,
            "project_ids":   project_ids or [],
            "is_active":     True,
            "created_at":    datetime.utcnow(),
            "updated_at":    datetime.utcnow(),
        }
