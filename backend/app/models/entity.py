"""
Entity model for MongoDB.
Represents an organization that can own multiple teams.
"""
from datetime import datetime
from typing import Optional, List
from bson import ObjectId


class EntityModel:
    """Entity document structure for MongoDB."""

    @staticmethod
    def create_document(
        name: str,
        founder_id: ObjectId,
        description: str = "",
        it_staff_ids: Optional[List[ObjectId]] = None,
        team_ids: Optional[List[ObjectId]] = None,
    ) -> dict:
        """Create a new entity document."""
        return {
            "name": name.strip(),
            "description": description.strip(),
            "founder_id": founder_id,
            "it_staff_ids": it_staff_ids or [],
            "team_ids": team_ids or [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
