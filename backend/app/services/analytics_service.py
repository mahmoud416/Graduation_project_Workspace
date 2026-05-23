"""
Analytics service — MongoDB aggregation pipelines for team-level analytics.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from bson import ObjectId

from app.db.collections import (
    TASKS_COLLECTION,
    PROJECTS_COLLECTION,
    MEMBERSHIPS_COLLECTION,
    USERS_COLLECTION,
)

QUALITY_SCORES_COLLECTION = "quality_scores"


def _period_start(period: str) -> Optional[datetime]:
    """Return the start datetime for the given period filter."""
    now = datetime.utcnow()
    mapping = {
        "day": timedelta(days=1),
        "week": timedelta(weeks=1),
        "month": timedelta(days=30),
        "year": timedelta(days=365),
    }
    delta = mapping.get(period)
    return (now - delta) if delta else None


class AnalyticsService:
    """Computes team-level analytics using MongoDB aggregations."""

    @staticmethod
    async def get_team_analytics(
        db, team_id: ObjectId, period: str = "month"
    ) -> Dict[str, Any]:
        period_start = _period_start(period)
        task_filter: Dict[str, Any] = {"team_id": team_id}
        if period_start:
            task_filter["created_at"] = {"$gte": period_start}

        # --- Task stats ---
        tasks = await db[TASKS_COLLECTION].find(task_filter).to_list(length=None)
        tasks_count = len(tasks)
        tasks_completed = sum(1 for t in tasks if t.get("status") == "DONE")
        tasks_in_progress = sum(1 for t in tasks if t.get("status") == "IN_PROGRESS")

        # --- Projects ---
        project_ids = list({t["project_id"] for t in tasks if t.get("project_id")})
        projects_count = len(project_ids)

        # --- Team members ---
        memberships = await db[MEMBERSHIPS_COLLECTION].find(
            {"team_id": team_id}
        ).to_list(length=None)
        member_ids = [m["user_id"] for m in memberships]

        # Fetch user details
        users = {}
        if member_ids:
            user_docs = await db[USERS_COLLECTION].find(
                {"_id": {"$in": member_ids}}
            ).to_list(length=None)
            users = {u["_id"]: u for u in user_docs}

        # --- Per-member stats ---
        active_user_ids = set()
        member_stats: List[Dict[str, Any]] = []
        for m in memberships:
            uid = m["user_id"]
            user_doc = users.get(uid, {})
            user_tasks = [
                t for t in tasks
                if t.get("assigned_to") == uid or uid in t.get("assignees", [])
            ]
            done = sum(1 for t in user_tasks if t.get("status") == "DONE")
            in_progress = sum(1 for t in user_tasks if t.get("status") == "IN_PROGRESS")
            if in_progress > 0:
                active_user_ids.add(uid)

            # Avg accuracy from quality_scores
            avg_score = 0.0
            try:
                pipeline = [
                    {"$match": {"user_id": uid, "team_id": team_id}},
                    {"$group": {"_id": None, "avg": {"$avg": "$score"}}},
                ]
                result = await db[QUALITY_SCORES_COLLECTION].aggregate(pipeline).to_list(1)
                if result:
                    avg_score = round(result[0].get("avg", 0), 1)
            except Exception:
                pass

            member_stats.append({
                "user_id": str(uid),
                "name": user_doc.get("name") or user_doc.get("full_name", "Unknown"),
                "email": user_doc.get("email", ""),
                "role": m.get("role", "member"),
                "avatar_url": user_doc.get("avatar_url"),
                "tasks_total": len(user_tasks),
                "tasks_done": done,
                "tasks_in_progress": in_progress,
                "avg_score": avg_score,
                "status": "active" if uid in active_user_ids else "idle",
            })

        # --- Team-wide avg accuracy ---
        avg_accuracy = 0.0
        try:
            pipeline = [
                {"$match": {"team_id": team_id}},
                {"$group": {"_id": None, "avg": {"$avg": "$score"}}},
            ]
            result = await db[QUALITY_SCORES_COLLECTION].aggregate(pipeline).to_list(1)
            if result:
                avg_accuracy = round(result[0].get("avg", 0), 1)
        except Exception:
            pass

        return {
            "team_id": str(team_id),
            "period": period,
            "projects_count": projects_count,
            "tasks_count": tasks_count,
            "tasks_completed": tasks_completed,
            "tasks_in_progress": tasks_in_progress,
            "avg_accuracy": avg_accuracy,
            "active_users": len(active_user_ids),
            "total_members": len(memberships),
            "members": member_stats,
        }
