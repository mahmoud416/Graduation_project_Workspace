"""
AI Training Dataset model for MongoDB.
Stores datasets uploaded by the Quality Manager for model training.
"""
from datetime import datetime
from typing import List, Optional


class AITrainingDatasetModel:
    """AI Training Dataset document structure for MongoDB."""

    @staticmethod
    def create_document(
        uploaded_by: str,
        name: str,
        description: str,
        label: str = "good_quality",          # "good_quality" | "poor_quality"
        dataset_type: str = "task_examples",   # "task_examples" | "documentation" | "screenshots" | "mixed"
        files: Optional[List[dict]] = None,
        tags: Optional[List[str]] = None,
        version: int = 1,
    ) -> dict:
        """Create a new AI training dataset document."""
        return {
            "uploaded_by":   uploaded_by,
            "name":          name,
            "description":   description,
            "label":         label,
            "dataset_type":  dataset_type,
            "files":         files or [],
            # Each file: {id, file_name, file_path, file_type, file_size, content_preview}
            "tags":          tags or [],
            "version":       version,
            "is_active":     True,
            "used_in_training": False,
            "training_job_ids": [],
            "created_at":    datetime.utcnow(),
            "updated_at":    datetime.utcnow(),
        }
