"""
Project model for MongoDB.
Represents project cards — the core collaboration hub of Hericle.
"""
from datetime import datetime
from typing import Any, List, Optional
from enum import Enum


class ProjectStatus(str, Enum):
    """Project lifecycle status values."""
    ACTIVE    = "ACTIVE"
    ON_HOLD   = "ON_HOLD"
    COMPLETED = "COMPLETED"


class ProjectType(str, Enum):
    """
    Card types:
      public       — workspace-wide channel (all registered users)
      all_subadmin — sub-admin coordination channel
      custom       — regular project card created by admin
    """
    PUBLIC       = "public"
    ALL_SUBADMIN = "all_subadmin"
    CUSTOM       = "custom"


class ProjectModel:
    """Project document structure for MongoDB."""

    @staticmethod
    def create_document(
        title: str,
        description: str,
        owner_id: Any,
        card_type: ProjectType = ProjectType.CUSTOM,
        status: ProjectStatus = ProjectStatus.ACTIVE,
        progress: int = 0,
        sub_admin_ids: Optional[List[Any]] = None,
        staff_ids: Optional[List[Any]] = None,
        team_id: Optional[Any] = None,
        comments_enabled: bool = True,
        uploads_enabled: bool = True,
    ) -> dict:
        """Create a new project document for insertion into MongoDB."""
        now = datetime.utcnow()
        is_system = card_type in (ProjectType.PUBLIC, ProjectType.ALL_SUBADMIN)
        return {
            "title":            title,
            "description":      description,
            "type":             card_type.value,
            "status":           status.value,
            "progress":         progress,
            "owner_id":         owner_id,
            "sub_admin_ids":    sub_admin_ids or [],
            "staff_ids":        staff_ids or [],
            "comments_enabled": comments_enabled,
            "uploads_enabled":  uploads_enabled,
            "is_system_card":   is_system,
            "team_id":          team_id,
            "created_at":       now,
            "updated_at":       now,
        }
