"""Notification API routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from typing import List, Dict, Any

from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _serialize(n: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "_id":        str(n["_id"]),
        "type":       n.get("type"),
        "payload":    n.get("payload", {}),
        "is_read":    n.get("is_read", False),
        "created_at": n.get("created_at"),
    }


@router.get("")
async def list_notifications(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Return unread notifications for the current user."""
    items = await NotificationService.get_unread(db, current_user["_id"])
    return [_serialize(n) for n in items]


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Mark a single notification as read."""
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid notification ID")

    updated = await NotificationService.mark_read(
        db,
        ObjectId(notification_id),
        current_user["_id"]
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"success": True}


@router.patch("/read-all")
async def mark_all_read(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Mark all notifications for the current user as read."""
    count = await NotificationService.mark_all_read(db, current_user["_id"])
    return {"marked_read": count}
