"""
Workspace calendar events — admin creates, everyone reads.
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from pymongo import ReturnDocument

from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import EVENTS_COLLECTION

router = APIRouter(prefix="/events", tags=["Events"])


# ─── Schemas ───────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: str          # "YYYY-MM-DD"
    color: str = "bg-blue-500"


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    color: Optional[str] = None


class EventResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    date: str
    color: str
    created_by: str
    created_at: Optional[str] = None


# ─── Helpers ───────────────────────────────────────────────────────────────

def _serialize(doc) -> EventResponse:
    return EventResponse(
        id=doc.get("event_id", str(doc["_id"])),
        title=doc.get("title", ""),
        description=doc.get("description"),
        date=doc.get("date", ""),
        color=doc.get("color", "bg-blue-500"),
        created_by=doc.get("created_by", ""),
        created_at=doc["created_at"].isoformat() if doc.get("created_at") else None,
    )


def _require_admin(current_user):
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage calendar events",
        )


# ─── Routes ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[EventResponse])
async def list_events(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Return all calendar events — visible to every authenticated user."""
    docs = await db[EVENTS_COLLECTION].find({}).sort("date", 1).to_list(length=None)
    return [_serialize(d) for d in docs]


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a new calendar event — admin only."""
    _require_admin(current_user)

    doc = {
        "_id": ObjectId(),
        "event_id": str(uuid4()),
        "title": payload.title.strip(),
        "description": payload.description,
        "date": payload.date,
        "color": payload.color,
        "created_by": str(current_user.get("_id") or current_user.get("id", "")),
        "created_at": datetime.utcnow(),
    }
    await db[EVENTS_COLLECTION].insert_one(doc)
    return _serialize(doc)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    payload: EventUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update a calendar event — admin only."""
    _require_admin(current_user)

    fields: dict = {}
    if payload.title is not None:
        fields["title"] = payload.title.strip()
    if payload.description is not None:
        fields["description"] = payload.description
    if payload.date is not None:
        fields["date"] = payload.date
    if payload.color is not None:
        fields["color"] = payload.color

    if not fields:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    updated = await db[EVENTS_COLLECTION].find_one_and_update(
        {"event_id": event_id},
        {"$set": fields},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Event not found")
    return _serialize(updated)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete a calendar event — admin only."""
    _require_admin(current_user)

    result = await db[EVENTS_COLLECTION].delete_one({"event_id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Event not found")
