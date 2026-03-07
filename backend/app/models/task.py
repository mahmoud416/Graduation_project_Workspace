"""
Task model for MongoDB.
Represents tasks/work items assigned within a project.
"""
from datetime import datetime
from typing import Optional
from bson import ObjectId
from enum import Enum


class TaskStatus(str, Enum):
    """Task status values matching the four-stage workflow."""
    TODO        = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    REVIEW      = "REVIEW"
    DONE        = "DONE"


class TaskPriority(str, Enum):
    """Task priority levels."""
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"


class TaskModel:
    """
    Task document structure for MongoDB.

    Fields:
        _id:         ObjectId (auto-generated)
        project_id:  Reference to Project ObjectId
        team_id:     Legacy reference kept for backward compatibility
        title:       Task title
        description: Details
        assigned_to: ObjectId of assignee (optional)
        created_by:  ObjectId of creator
        status:      TODO | IN_PROGRESS | REVIEW | DONE
        priority:    low | medium | high
        deadline:    Optional due date
        order:       Integer for drag-and-drop ordering
        created_at:  Timestamp
        updated_at:  Timestamp
    """

    @staticmethod
    def create_document(
        title: str,
        project_id: ObjectId,
        created_by: ObjectId,
        assigned_to: Optional[ObjectId] = None,
        description: str = "",
        status: TaskStatus = TaskStatus.TODO,
        priority: TaskPriority = TaskPriority.MEDIUM,
        deadline: Optional[datetime] = None,
        order: int = 0,
        team_id: Optional[ObjectId] = None,
    ) -> dict:
        now = datetime.utcnow()
        doc = {
            "title":       title,
            "description": description,
            "project_id":  project_id,
            "assigned_to": assigned_to,
            "created_by":  created_by,
            "status":      status.value,
            "priority":    priority.value,
            "deadline":    deadline,
            "order":       order,
            "created_at":  now,
            "updated_at":  now,
        }
        if team_id is not None:
            doc["team_id"] = team_id
        return doc
