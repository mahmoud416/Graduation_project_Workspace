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
        quality_framework_ids: Optional[List[ObjectId]] = None,
        subscription_tier: str = "Basic",
        max_teams: int = 5,
        ai_quota: int = 1000,
    ) -> dict:
        """Create a new entity document."""
        return {
            "name": name.strip(),
            "description": description.strip(),
            "founder_id": founder_id,
            "it_staff_ids": it_staff_ids or [],
            "team_ids": team_ids or [],
            "quality_framework_ids": quality_framework_ids or [],
            "subscription_tier": subscription_tier,
            "max_teams": max_teams,
            "ai_quota": ai_quota,
            "ai_tokens_used": 0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
