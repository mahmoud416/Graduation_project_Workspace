"""
Calendar events API — v2
RBAC: founder/admin = full access, sub_admin = create + edit/delete own, staff = view + RSVP
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import EVENTS_COLLECTION

router = APIRouter(prefix="/events", tags=["Events"])

# ─── Constants ─────────────────────────────────────────────────────────────

EVENT_TYPES = [
    "meeting", "project_deadline", "review_session", "training_session",
    "quality_audit", "team_event", "reminder", "personal_event",
    "task_deadline", "milestone",
]
VISIBILITIES = ["private", "team", "project_members", "workspace"]
PRIORITIES   = ["low", "medium", "high", "urgent"]
RECURRENCES  = ["none", "daily", "weekly", "monthly", "yearly"]

# ─── Schemas ───────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    title: str = Field(..., max_length=500)
    description: Optional[str] = Field(None, max_length=5000)
    type: str = "meeting"
    start_date: str                          # YYYY-MM-DD
    end_date: Optional[str] = None
    start_time: Optional[str] = None         # HH:MM
    end_time: Optional[str] = None
    priority: str = "medium"
    location: Optional[str] = Field(None, max_length=500)
    meeting_link: Optional[str] = Field(None, max_length=1000)
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    attendee_ids: List[str] = []
    visibility: str = "workspace"
    reminder_minutes: Optional[int] = None  # 15, 60, 720, 1440
    recurrence: str = "none"
    color: Optional[str] = None             # hex override


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    priority: Optional[str] = None
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    attendee_ids: Optional[List[str]] = None
    visibility: Optional[str] = None
    reminder_minutes: Optional[int] = None
    recurrence: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None


class EventResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    type: str = "meeting"
    start_date: str
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    priority: str = "medium"
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    owner_id: str
    attendee_ids: List[str] = []
    visibility: str = "workspace"
    reminder_minutes: Optional[int] = None
    recurrence: str = "none"
    color: Optional[str] = None
    status: str = "active"
    created_by: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RSVPRequest(BaseModel):
    status: str  # attending | declined | tentative


# ─── Helpers ───────────────────────────────────────────────────────────────

def _serialize(doc: dict) -> EventResponse:
    # backward-compat: old docs used `date` instead of `start_date`
    start_date = doc.get("start_date") or doc.get("date", "")
    return EventResponse(
        id=doc.get("event_id", str(doc["_id"])),
        title=doc.get("title", ""),
        description=doc.get("description"),
        type=doc.get("type", "meeting"),
        start_date=start_date,
        end_date=doc.get("end_date") or start_date,
        start_time=doc.get("start_time"),
        end_time=doc.get("end_time"),
        priority=doc.get("priority", "medium"),
        location=doc.get("location"),
        meeting_link=doc.get("meeting_link"),
        project_id=str(doc["project_id"]) if doc.get("project_id") else None,
        task_id=str(doc["task_id"]) if doc.get("task_id") else None,
        owner_id=str(doc.get("owner_id") or doc.get("created_by", "")),
        attendee_ids=[str(a) for a in (doc.get("attendee_ids") or [])],
        visibility=doc.get("visibility", "workspace"),
        reminder_minutes=doc.get("reminder_minutes"),
        recurrence=doc.get("recurrence", "none"),
        color=doc.get("color"),
        status=doc.get("status", "active"),
        created_by=str(doc.get("created_by", "")),
        created_at=doc["created_at"].isoformat() if doc.get("created_at") else None,
        updated_at=doc["updated_at"].isoformat() if doc.get("updated_at") else None,
    )


def _can_write(user: dict) -> bool:
    return (user.get("role") or "").lower() in {"founder", "admin", "sub_admin"}


def _can_admin(user: dict) -> bool:
    return (user.get("role") or "").lower() in {"founder", "admin"}


def _owns(doc: dict, user: dict) -> bool:
    uid = str(user.get("_id") or user.get("id", ""))
    return str(doc.get("created_by", "")) == uid or str(doc.get("owner_id", "")) == uid


# ─── Routes ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[EventResponse])
async def list_events(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str]   = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Return visible events, optionally filtered by date range."""
    query: dict = {}

    # Date range — matches start_date field (also handles legacy `date` field)
    if start_date or end_date:
        date_filter: dict = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["$or"] = [
            {"start_date": date_filter},
            {"date": date_filter},
        ]

    # Visibility restriction for staff
    role = (current_user.get("role") or "").lower()
    if role == "staff":
        uid = str(current_user.get("_id") or "")
        staff_vis = {
            "$or": [
                {"visibility": {"$in": ["workspace", "team"]}},
                {"attendee_ids": uid},
                {"owner_id": uid},
                {"created_by": uid},
            ]
        }
        existing = query.get("$and", [])
        query["$and"] = existing + [staff_vis]

    docs = await db[EVENTS_COLLECTION].find(query).sort("start_date", 1).to_list(length=500)
    return [_serialize(d) for d in docs]


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a calendar event. Requires founder, admin, or sub_admin role."""
    if not _can_write(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to create events")

    now = datetime.utcnow()
    uid = str(current_user.get("_id") or "")

    doc = {
        "_id":             ObjectId(),
        "event_id":        str(uuid4()),
        "title":           payload.title.strip(),
        "description":     payload.description,
        "type":            payload.type if payload.type in EVENT_TYPES else "meeting",
        "start_date":      payload.start_date,
        "end_date":        payload.end_date or payload.start_date,
        "start_time":      payload.start_time,
        "end_time":        payload.end_time,
        "priority":        payload.priority if payload.priority in PRIORITIES else "medium",
        "location":        payload.location,
        "meeting_link":    payload.meeting_link,
        "project_id":      payload.project_id,
        "task_id":         payload.task_id,
        "owner_id":        uid,
        "attendee_ids":    payload.attendee_ids,
        "visibility":      payload.visibility if payload.visibility in VISIBILITIES else "workspace",
        "reminder_minutes": payload.reminder_minutes,
        "recurrence":      payload.recurrence if payload.recurrence in RECURRENCES else "none",
        "color":           payload.color,
        "status":          "active",
        "created_by":      uid,
        "created_at":      now,
        "updated_at":      now,
    }
    await db[EVENTS_COLLECTION].insert_one(doc)
    return _serialize(doc)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    doc = await db[EVENTS_COLLECTION].find_one({"event_id": event_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Event not found")
    return _serialize(doc)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    payload: EventUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update an event. Sub_admin may only update their own events."""
    if not _can_write(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    doc = await db[EVENTS_COLLECTION].find_one({"event_id": event_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Event not found")

    if not _can_admin(current_user) and not _owns(doc, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only edit your own events")

    fields: dict = {"updated_at": datetime.utcnow()}
    if payload.title           is not None: fields["title"]           = payload.title.strip()
    if payload.description     is not None: fields["description"]     = payload.description
    if payload.type            is not None: fields["type"]            = payload.type
    if payload.start_date      is not None: fields["start_date"]      = payload.start_date
    if payload.end_date        is not None: fields["end_date"]        = payload.end_date
    if payload.start_time      is not None: fields["start_time"]      = payload.start_time
    if payload.end_time        is not None: fields["end_time"]        = payload.end_time
    if payload.priority        is not None: fields["priority"]        = payload.priority
    if payload.location        is not None: fields["location"]        = payload.location
    if payload.meeting_link    is not None: fields["meeting_link"]    = payload.meeting_link
    if payload.project_id      is not None: fields["project_id"]      = payload.project_id
    if payload.task_id         is not None: fields["task_id"]         = payload.task_id
    if payload.attendee_ids    is not None: fields["attendee_ids"]    = payload.attendee_ids
    if payload.visibility      is not None: fields["visibility"]      = payload.visibility
    if payload.reminder_minutes is not None: fields["reminder_minutes"] = payload.reminder_minutes
    if payload.recurrence      is not None: fields["recurrence"]      = payload.recurrence
    if payload.color           is not None: fields["color"]           = payload.color
    if payload.status          is not None: fields["status"]          = payload.status

    updated = await db[EVENTS_COLLECTION].find_one_and_update(
        {"event_id": event_id},
        {"$set": fields},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize(updated)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete an event. Sub_admin may only delete their own events."""
    if not _can_write(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    doc = await db[EVENTS_COLLECTION].find_one({"event_id": event_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Event not found")

    if not _can_admin(current_user) and not _owns(doc, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only delete your own events")

    await db[EVENTS_COLLECTION].delete_one({"event_id": event_id})


@router.post("/{event_id}/rsvp")
async def rsvp_event(
    event_id: str,
    payload: RSVPRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """RSVP to an event — available to all authenticated users."""
    doc = await db[EVENTS_COLLECTION].find_one({"event_id": event_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Event not found")

    uid = str(current_user.get("_id") or "")
    await db[EVENTS_COLLECTION].update_one(
        {"event_id": event_id},
        {"$set": {f"rsvp.{uid}": payload.status, "updated_at": datetime.utcnow()}},
    )
    return {"status": "ok", "rsvp": payload.status}
