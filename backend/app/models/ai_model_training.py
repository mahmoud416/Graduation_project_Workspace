"""
AI Model Training Job model for MongoDB.
Tracks training runs, results, and model versioning.
"""
from datetime import datetime
from typing import List, Optional


class AIModelTrainingModel:
    """AI Model Training Job document structure for MongoDB."""

    @staticmethod
    def create_document(
        triggered_by: str,
        dataset_ids: List[str],
        model_version: str,
        notes: str = "",
    ) -> dict:
        """Create a new training job document."""
        return {
            "triggered_by":   triggered_by,
            "dataset_ids":    dataset_ids,
            "model_version":  model_version,
            "notes":          notes,
            # Status: "queued" | "running" | "completed" | "failed"
            "status":         "queued",
            "progress":       0,           # 0-100
            "started_at":     None,
            "completed_at":   None,
            "duration_secs":  None,
            # Training results
            "metrics": {
                "datasets_processed":   0,
                "files_processed":      0,
                "patterns_extracted":   0,
                "accuracy_estimate":    None,   # float 0-100
                "examples_learned":     0,
            },
            "patterns_summary":   [],      # List[str] of learned quality patterns
            "error_message":      None,
            "created_at":         datetime.utcnow(),
            "updated_at":         datetime.utcnow(),
        }

    @staticmethod
    def model_state_document(
        version: str,
        training_job_id: str,
        accuracy: float,
        patterns: List[str],
        dataset_ids: List[str],
        total_examples: int,
    ) -> dict:
        """Create / update the singleton model state document."""
        return {
            "version":          version,
            "training_job_id":  training_job_id,
            "accuracy":         accuracy,
            "patterns":         patterns,
            "dataset_ids":      dataset_ids,
            "total_examples":   total_examples,
            "created_at":       datetime.utcnow(),
        }
