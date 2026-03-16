"""
Quality Control Todo Tracking model for MongoDB.
Records every todo check/uncheck action for AI analytics.
"""
from datetime import datetime


class QCTodoTrackingModel:
    """Todo tracking document structure for MongoDB."""

    @staticmethod
    def create_document(
        user_id: str,
        task_id: str,
        project_id: str,
        todo_id: str,
        todo_title: str,
        action: str = "checked",    # "checked" | "unchecked"
        user_name: str = "",
    ) -> dict:
        """Create a new todo tracking document."""
        return {
            "user_id":    user_id,
            "user_name":  user_name,
            "task_id":    task_id,
            "project_id": project_id,
            "todo_id":    todo_id,
            "todo_title": todo_title,
            "action":     action,
            "timestamp":  datetime.utcnow(),
        }
