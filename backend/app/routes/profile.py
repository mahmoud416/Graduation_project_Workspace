"""
User profile & portfolio API routes.
Provides read/update profile + computed portfolio stats.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from pymongo import ReturnDocument

from app.schemas.profile import ProfileUpdate, ProfileResponse, PortfolioResponse, PortfolioProject
from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import (
    USERS_COLLECTION,
    TASKS_COLLECTION,
    PROJECTS_COLLECTION,
    MEMBERSHIPS_COLLECTION,
)

router = APIRouter(prefix="/profile", tags=["Profile"])

QUALITY_SCORES_COLLECTION = "quality_scores"


def _to_profile(doc: dict) -> ProfileResponse:
    return ProfileResponse(
        _id=str(doc["_id"]),
        email=doc.get("email", ""),
        name=doc.get("name") or doc.get("full_name", ""),
        role=doc.get("role", "staff"),
        avatar_url=doc.get("avatar_url"),
        bio=doc.get("bio"),
        department=doc.get("department"),
        phone=doc.get("phone"),
        created_at=doc.get("created_at"),
        is_active=doc.get("is_active", True),
    )


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    current_user=Depends(get_current_user),
):
    """Get the authenticated user's profile."""
    return _to_profile(current_user)


@router.patch("/me", response_model=ProfileResponse)
async def update_my_profile(
    payload: ProfileUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update the authenticated user's profile fields."""
    update_fields: dict = {}
    if payload.name is not None:
        update_fields["name"] = payload.name
    if payload.avatar_url is not None:
        update_fields["avatar_url"] = payload.avatar_url
    if payload.bio is not None:
        update_fields["bio"] = payload.bio
    if payload.department is not None:
        update_fields["department"] = payload.department
    if payload.phone is not None:
        update_fields["phone"] = payload.phone

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    updated = await db[USERS_COLLECTION].find_one_and_update(
        {"_id": current_user["_id"]},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return _to_profile(updated)


@router.get("/{user_id}", response_model=ProfileResponse)
async def get_user_profile(
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get any user's public profile."""
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    user = await db[USERS_COLLECTION].find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return _to_profile(user)


@router.get("/{user_id}/portfolio", response_model=PortfolioResponse)
async def get_user_portfolio(
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Compute portfolio stats for a user: projects, tasks, accuracy."""
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    user = await db[USERS_COLLECTION].find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Tasks assigned to this user
    tasks = await db[TASKS_COLLECTION].find(
        {"$or": [{"assigned_to": obj_id}, {"assignees": obj_id}]}
    ).to_list(length=None)

    tasks_total = len(tasks)
    tasks_completed = sum(1 for t in tasks if t.get("status") == "DONE")

    # Projects the user is part of
    project_ids = list({t["project_id"] for t in tasks if t.get("project_id")})
    projects = await db[PROJECTS_COLLECTION].find(
        {"_id": {"$in": project_ids}}
    ).to_list(length=None) if project_ids else []

    recent_projects = []
    for p in projects[:10]:
        p_tasks = [t for t in tasks if t.get("project_id") == p["_id"]]
        recent_projects.append(PortfolioProject(
            project_id=str(p["_id"]),
            title=p.get("title", "Untitled"),
            status=p.get("status", "ACTIVE"),
            tasks_total=len(p_tasks),
            tasks_done=sum(1 for t in p_tasks if t.get("status") == "DONE"),
        ))

    # Average accuracy from quality scores
    avg_accuracy = 0.0
    try:
        pipeline = [
            {"$match": {"user_id": obj_id}},
            {"$group": {"_id": None, "avg": {"$avg": "$score"}}},
        ]
        result = await db[QUALITY_SCORES_COLLECTION].aggregate(pipeline).to_list(length=1)
        if result:
            avg_accuracy = round(result[0].get("avg", 0), 1)
    except Exception:
        pass  # collection may not exist yet

    return PortfolioResponse(
        user_id=str(obj_id),
        name=user.get("name") or user.get("full_name", ""),
        projects_count=len(projects),
        tasks_completed=tasks_completed,
        tasks_total=tasks_total,
        avg_accuracy=avg_accuracy,
        recent_projects=recent_projects,
    )
