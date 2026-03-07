"""
Notification service.
Creates in-app notifications and can extend to push/email later.
"""
from typing import Any, Dict, List
from bson import ObjectId

from app.models.notification import NotificationModel
from app.db.collections import NOTIFICATIONS_COLLECTION


class NotificationService:

    @staticmethod
    async def create(
        db,
        user_id: ObjectId,
        notification_type: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        doc = NotificationModel.create_document(user_id, notification_type, payload)
        result = await db[NOTIFICATIONS_COLLECTION].insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    @staticmethod
    async def get_unread(db, user_id: ObjectId) -> List[Dict[str, Any]]:
        cursor = db[NOTIFICATIONS_COLLECTION].find(
            {"user_id": user_id, "is_read": False}
        ).sort("created_at", -1).limit(50)
        return await cursor.to_list(length=50)

    @staticmethod
    async def mark_read(db, notification_id: ObjectId, user_id: ObjectId) -> bool:
        result = await db[NOTIFICATIONS_COLLECTION].update_one(
            {"_id": notification_id, "user_id": user_id},
            {"$set": {"is_read": True}}
        )
        return result.modified_count == 1

    @staticmethod
    async def mark_all_read(db, user_id: ObjectId) -> int:
        result = await db[NOTIFICATIONS_COLLECTION].update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True}}
        )
        return result.modified_count
