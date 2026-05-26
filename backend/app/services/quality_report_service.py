"""Aggregations and exports for Quality Control reports."""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.db.collections import (
    QUALITY_EVALUATIONS_COLLECTION,
    TODO_AUDIT_COLLECTION,
    TASKS_COLLECTION,
)


class QualityReportService:
    """Generates analytics for QC dashboards."""

    @staticmethod
    def _maybe_object_id(value: Optional[str]) -> Optional[ObjectId]:
        if value and ObjectId.is_valid(value):
            return ObjectId(value)
        return None

    @staticmethod
    async def quality_overview(
        db,
        *,
        project_id: Optional[str] = None,
        days: int = 30,
    ) -> Dict[str, Any]:
        start_date = datetime.utcnow() - timedelta(days=days)
        project_oid = QualityReportService._maybe_object_id(project_id)

        score_trend = await QualityReportService._score_trend(db, start_date, project_oid)
        completion_trend = await QualityReportService._completion_trend(db, start_date, project_oid)
        project_scores = await QualityReportService._project_scores(db)
        recent_analyses = await QualityReportService._recent_analyses(db, project_oid)
        todo_stats = await QualityReportService._todo_totals(db, start_date, project_oid)

        admin_insights = {
            "globalRejectionRate": 12.4, # Mock global rejection rate
            "burnoutRiskUsers": 3, # Mock high burnout users
            "bottlenecks": [
                {"name": "API Microservices", "avgHours": 32.5},
                {"name": "Database Migration", "avgHours": 28.0}
            ],
            "globalIssues": [
                "Uncaught exceptions in API",
                "Missing mobile responsiveness",
                "Authentication token expiration bugs"
            ]
        }

        return {
            "scoreTrend": score_trend,
            "completionTrend": completion_trend,
            "projectScores": project_scores,
            "aiHistory": recent_analyses,
            "todoStats": todo_stats,
            "adminInsights": admin_insights,
        }

    @staticmethod
    async def _score_trend(db, start_date: datetime, project_id: Optional[ObjectId]) -> List[Dict[str, Any]]:
        match_stage: Dict[str, Any] = {"created_at": {"$gte": start_date}}
        if project_id:
            match_stage["project_id"] = project_id

        pipeline = [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": {
                        "day": {
                            "$dateToString": {
                                "format": "%Y-%m-%d",
                                "date": "$created_at",
                            }
                        }
                    },
                    "avgScore": {"$avg": "$compliance_score"},
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id.day": 1}},
        ]
        docs = await db[QUALITY_EVALUATIONS_COLLECTION].aggregate(pipeline).to_list(length=120)
        return [
            {
                "date": item["_id"]["day"],
                "avgScore": round(item.get("avgScore", 0), 2),
                "evaluations": item.get("count", 0),
            }
            for item in docs
        ]

    @staticmethod
    async def _completion_trend(db, start_date: datetime, project_id: Optional[ObjectId]) -> List[Dict[str, Any]]:
        match_stage: Dict[str, Any] = {"timestamp": {"$gte": start_date}}
        if project_id:
            match_stage["project_id"] = project_id

        pipeline = [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": {
                        "day": {
                            "$dateToString": {
                                "format": "%Y-%m-%d",
                                "date": "$timestamp",
                            }
                        }
                    },
                    "checked": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$action", "checked"]},
                                1,
                                0,
                            ]
                        }
                    },
                    "unchecked": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$action", "unchecked"]},
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
            {"$sort": {"_id.day": 1}},
        ]
        docs = await db[TODO_AUDIT_COLLECTION].aggregate(pipeline).to_list(length=120)
        return [
            {
                "date": item["_id"]["day"],
                "checked": item.get("checked", 0),
                "unchecked": item.get("unchecked", 0),
            }
            for item in docs
        ]

    @staticmethod
    async def _project_scores(db) -> List[Dict[str, Any]]:
        pipeline = [
            {
                "$group": {
                    "_id": "$project_id",
                    "avgScore": {"$avg": "$compliance_score"},
                    "evaluations": {"$sum": 1},
                }
            },
            {"$sort": {"avgScore": -1}},
        ]
        docs = await db[QUALITY_EVALUATIONS_COLLECTION].aggregate(pipeline).to_list(length=50)
        result = []
        for item in docs:
            project_id = item.get("_id")
            result.append(
                {
                    "projectId": str(project_id) if isinstance(project_id, ObjectId) else project_id,
                    "avgScore": round(item.get("avgScore", 0), 2),
                    "evaluations": item.get("evaluations", 0),
                }
            )
        return result

    @staticmethod
    async def _recent_analyses(db, project_id: Optional[ObjectId]) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if project_id:
            query["project_id"] = project_id
        docs = (
            await db[QUALITY_EVALUATIONS_COLLECTION]
            .find(query)
            .sort("created_at", -1)
            .limit(20)
            .to_list(length=20)
        )
        
        # Fetch the underlying tasks to determine true completion status
        task_ids = [doc.get("task_id") for doc in docs if doc.get("task_id")]
        # Filter out anything that's not a valid ObjectId or string
        valid_task_ids = []
        for tid in task_ids:
            if isinstance(tid, ObjectId):
                valid_task_ids.append(tid)
            elif isinstance(tid, str) and ObjectId.is_valid(tid):
                valid_task_ids.append(ObjectId(tid))
                
        tasks_map = {}
        if valid_task_ids:
            tasks = await db[TASKS_COLLECTION].find({"_id": {"$in": valid_task_ids}}, {"status": 1}).to_list(length=None)
            for t in tasks:
                tasks_map[str(t["_id"])] = t.get("status")

        history = []
        for doc in docs:
            t_id = str(doc.get("task_id")) if doc.get("task_id") else None
            t_status = tasks_map.get(t_id)
            
            if t_status == "DONE":
                display_status = "Completed"
            else:
                display_status = "Not Completed Yet"

            history.append(
                {
                    "analysisId": str(doc.get("_id")),
                    "taskTitle": doc.get("task_title", "Unknown Task"),
                    "score": doc.get("compliance_score", 0),
                    "createdAt": doc.get("created_at").isoformat() if doc.get("created_at") else None,
                    "status": display_status,
                }
            )
        return history

    @staticmethod
    async def _todo_totals(db, start_date: datetime, project_id: Optional[ObjectId]) -> Dict[str, Any]:
        match_stage: Dict[str, Any] = {"timestamp": {"$gte": start_date}}
        if project_id:
            match_stage["project_id"] = project_id

        pipeline = [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": None,
                    "checked": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$action", "checked"]},
                                1,
                                0,
                            ]
                        }
                    },
                    "unchecked": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$action", "unchecked"]},
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ]
        agg = await db[TODO_AUDIT_COLLECTION].aggregate(pipeline).to_list(length=1)
        if not agg:
            return {"checked": 0, "unchecked": 0}
        data = agg[0]
        return {
            "checked": data.get("checked", 0),
            "unchecked": data.get("unchecked", 0),
        }
