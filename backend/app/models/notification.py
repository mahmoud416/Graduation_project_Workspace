"""Notification model for MongoDB."""
from datetime import datetime
from typing import Any, Dict
from bson import ObjectId


class NotificationModel:
    """Notification document structure for MongoDB."""

    @staticmethod
    def create_document(
        user_id: ObjectId,
        notification_type: str,
        payload: Dict[str, Any],
    ) -> dict:
        return {
            "user_id":    user_id,
            "type":       notification_type,
            "payload":    payload,
            "is_read":    False,
            "created_at": datetime.utcnow(),
        }
