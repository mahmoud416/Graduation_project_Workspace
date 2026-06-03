"""Task board model for MongoDB.
Stores TaskFlow-style data that mirrors each project card.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional


class TaskBoardModel:
    """Structure helpers for task board documents."""

    @staticmethod
    def create_document(
        project_id: str,
        project_title: str,
        description: str,
        status_label: str,
        progress: int,
        members: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Return a ready-to-insert Mongo document."""
        now = datetime.utcnow()
        return {
            "project_id": project_id,
            "overview": {
                "title": project_title or "Task Board",
                "description": description or f"Updates hub for {project_title or 'the project'}.",
                "status_badge": status_label or "IN PROGRESS",
                "progress": progress,
            },
            "tasks": [],
            "members": members,
            "resources": [],
            "comments": [],
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def default_task_structure(
        task_id: str,
        title: str,
        assignee: str,
        due: str,
        done: bool,
        submitted_by: Optional[str] = None,
        submitted_by_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Helper object for to-do items."""
        return {
            "id": task_id,
            "title": title,
            "assignee": assignee,
            "due": due,
            "done": done,
            "status": "done" if done else "todo",
            "priority": "medium",
            "submitted_by": submitted_by,
            "submitted_by_name": submitted_by_name,
        }
