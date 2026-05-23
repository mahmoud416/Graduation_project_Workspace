"""
Analytics API routes — team-level analytics with drill-down.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from bson import ObjectId

from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_team_member
from app.db.mongodb import get_database
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/team/{team_id}")
async def get_team_analytics(
    team_id: str,
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Get team-level analytics: projects, tasks, accuracy, active users.
    
    Accessible by any team member (Admin, Manager, Sub-Admin, Member).
    Members see aggregated stats without per-user accuracy scores.
    """
    try:
        team_obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid team ID")

    # Verify the user is a member of the team
    await require_team_member(team_id, current_user, db)

    result = await AnalyticsService.get_team_analytics(db, team_obj_id, period)
    return result


@router.get("/user/{user_id}")
async def get_user_analytics(
    user_id: str,
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get task & quality stats for a specific user across all their teams."""
    from datetime import datetime, timedelta
    from app.db.collections import TASKS_COLLECTION, MEMBERSHIPS_COLLECTION

    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    # Period filter
    now = datetime.utcnow()
    deltas = {"day": 1, "week": 7, "month": 30, "year": 365}
    period_start = now - timedelta(days=deltas.get(period, 30))

    task_filter = {
        "$or": [{"assigned_to": obj_id}, {"assignees": obj_id}],
        "created_at": {"$gte": period_start},
    }

    tasks = await db[TASKS_COLLECTION].find(task_filter).to_list(length=None)
    total = len(tasks)
    done = sum(1 for t in tasks if t.get("status") == "DONE")
    in_progress = sum(1 for t in tasks if t.get("status") == "IN_PROGRESS")
    review = sum(1 for t in tasks if t.get("status") == "REVIEW")

    # Teams the user belongs to
    memberships = await db[MEMBERSHIPS_COLLECTION].find(
        {"user_id": obj_id}
    ).to_list(length=None)

    # Avg QC score
    avg_score = 0.0
    try:
        pipeline = [
            {"$match": {"user_id": obj_id}},
            {"$group": {"_id": None, "avg": {"$avg": "$score"}}},
        ]
        result = await db["quality_scores"].aggregate(pipeline).to_list(1)
        if result:
            avg_score = round(result[0].get("avg", 0), 1)
    except Exception:
        pass

    return {
        "user_id": str(obj_id),
        "period": period,
        "tasks_total": total,
        "tasks_done": done,
        "tasks_in_progress": in_progress,
        "tasks_in_review": review,
        "teams_count": len(memberships),
        "avg_accuracy": avg_score,
    }
