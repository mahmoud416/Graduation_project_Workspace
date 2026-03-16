"""
Quality Control Service — business logic layer.
Handles CRUD for standards, analyses, tracking, and analytics.
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.db.collections import (
    QC_STANDARDS_COLLECTION,
    QC_ANALYSES_COLLECTION,
    QC_TODO_TRACKING_COLLECTION,
    TASK_BOARDS_COLLECTION,
)
from app.models.qc_standard import QCStandardModel
from app.models.qc_analysis import QCAnalysisModel
from app.models.qc_todo_tracking import QCTodoTrackingModel


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _str_id(doc: dict) -> dict:
    """Convert ObjectId _id fields to str for serialisation."""
    if doc and isinstance(doc.get("_id"), ObjectId):
        doc["_id"] = str(doc["_id"])
    return doc


# ---------------------------------------------------------------------------
# QC Standards CRUD
# ---------------------------------------------------------------------------

class QCService:

    # -- Standards -----------------------------------------------------------

    @staticmethod
    async def create_standard(db, created_by: str, title: str, description: str,
                               standard_type: str, rules: List[dict],
                               scope: str, project_ids: List[str]) -> dict:
        # Assign stable ids to rules
        for rule in rules:
            if not rule.get("id"):
                rule["id"] = uuid.uuid4().hex[:12]
            rule.setdefault("is_active", True)
            rule.setdefault("category", "general")

        doc = QCStandardModel.create_document(
            created_by=created_by,
            title=title,
            description=description,
            standard_type=standard_type,
            rules=rules,
            scope=scope,
            project_ids=project_ids,
        )
        result = await db[QC_STANDARDS_COLLECTION].insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc

    @staticmethod
    async def list_standards(db, scope_filter: Optional[str] = None,
                              project_id: Optional[str] = None,
                              active_only: bool = True) -> List[dict]:
        query: dict = {}
        if active_only:
            query["is_active"] = True
        if scope_filter and not project_id:
            # Only filter by scope when project_id is not specified
            query["scope"] = scope_filter
        if project_id:
            # When project_id is given, return global standards + project-specific ones
            query["$or"] = [
                {"scope": "global"},
                {"project_ids": project_id},
            ]

        docs = await db[QC_STANDARDS_COLLECTION].find(query).sort("created_at", -1).to_list(length=None)
        return [_str_id(d) for d in docs]

    @staticmethod
    async def get_standard(db, standard_id: str) -> Optional[dict]:
        try:
            oid = ObjectId(standard_id)
        except Exception:
            return None
        doc = await db[QC_STANDARDS_COLLECTION].find_one({"_id": oid})
        return _str_id(doc) if doc else None

    @staticmethod
    async def update_standard(db, standard_id: str, updates: dict) -> Optional[dict]:
        try:
            oid = ObjectId(standard_id)
        except Exception:
            return None
        updates["updated_at"] = datetime.utcnow()
        result = await db[QC_STANDARDS_COLLECTION].find_one_and_update(
            {"_id": oid},
            {"$set": updates},
            return_document=True,
        )
        return _str_id(result) if result else None

    @staticmethod
    async def delete_standard(db, standard_id: str) -> bool:
        try:
            oid = ObjectId(standard_id)
        except Exception:
            return False
        result = await db[QC_STANDARDS_COLLECTION].delete_one({"_id": oid})
        return result.deleted_count > 0

    @staticmethod
    async def add_dataset_file(db, standard_id: str, file_entry: dict) -> Optional[dict]:
        try:
            oid = ObjectId(standard_id)
        except Exception:
            return None
        result = await db[QC_STANDARDS_COLLECTION].find_one_and_update(
            {"_id": oid},
            {
                "$push": {"dataset_files": file_entry},
                "$set":  {"updated_at": datetime.utcnow()},
            },
            return_document=True,
        )
        return _str_id(result) if result else None

    # -- Analyses ------------------------------------------------------------

    @staticmethod
    async def save_analysis(db, analysis_data: dict) -> dict:
        result = await db[QC_ANALYSES_COLLECTION].insert_one(analysis_data)
        analysis_data["_id"] = str(result.inserted_id)
        return analysis_data

    @staticmethod
    async def list_analyses(db, project_id: Optional[str] = None,
                             limit: int = 50) -> List[dict]:
        query: dict = {}
        if project_id:
            query["project_id"] = project_id
        docs = await db[QC_ANALYSES_COLLECTION].find(query)\
            .sort("created_at", -1).limit(limit).to_list(length=None)
        return [_str_id(d) for d in docs]

    @staticmethod
    async def get_analysis(db, analysis_id: str) -> Optional[dict]:
        try:
            oid = ObjectId(analysis_id)
        except Exception:
            return None
        doc = await db[QC_ANALYSES_COLLECTION].find_one({"_id": oid})
        return _str_id(doc) if doc else None

    @staticmethod
    async def get_analyses_for_task(db, task_id: str) -> List[dict]:
        docs = await db[QC_ANALYSES_COLLECTION].find({"task_id": task_id})\
            .sort("created_at", -1).to_list(length=None)
        return [_str_id(d) for d in docs]

    # -- Todo Tracking -------------------------------------------------------

    @staticmethod
    async def track_todo(db, user_id: str, user_name: str, task_id: str,
                          project_id: str, todo_id: str, todo_title: str,
                          action: str) -> dict:
        doc = QCTodoTrackingModel.create_document(
            user_id=user_id,
            user_name=user_name,
            task_id=task_id,
            project_id=project_id,
            todo_id=todo_id,
            todo_title=todo_title,
            action=action,
        )
        result = await db[QC_TODO_TRACKING_COLLECTION].insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc

    @staticmethod
    async def get_todo_tracking(db, project_id: Optional[str] = None,
                                 task_id: Optional[str] = None,
                                 user_id: Optional[str] = None,
                                 limit: int = 200) -> List[dict]:
        query: dict = {}
        if project_id:
            query["project_id"] = project_id
        if task_id:
            query["task_id"] = task_id
        if user_id:
            query["user_id"] = user_id
        docs = await db[QC_TODO_TRACKING_COLLECTION].find(query)\
            .sort("timestamp", -1).limit(limit).to_list(length=None)
        return [_str_id(d) for d in docs]

    # -- Dashboard stats -----------------------------------------------------

    @staticmethod
    async def get_dashboard_stats(db) -> dict:
        total_standards   = await db[QC_STANDARDS_COLLECTION].count_documents({"is_active": True})
        total_analyses    = await db[QC_ANALYSES_COLLECTION].count_documents({})
        total_todos       = await db[QC_TODO_TRACKING_COLLECTION].count_documents({})

        # Average compliance score
        pipeline = [{"$group": {"_id": None, "avg": {"$avg": "$compliance_score"}}}]
        cursor   = db[QC_ANALYSES_COLLECTION].aggregate(pipeline)
        agg      = await cursor.to_list(length=1)
        avg_score = round(agg[0]["avg"], 1) if agg else 0.0

        # Passing vs failing (score >= 70 = passing)
        passing = await db[QC_ANALYSES_COLLECTION].count_documents({"compliance_score": {"$gte": 70}})
        failing = await db[QC_ANALYSES_COLLECTION].count_documents({"compliance_score": {"$lt": 70}})

        # Recent analyses (last 5)
        recent = await db[QC_ANALYSES_COLLECTION].find({}).sort("created_at", -1)\
            .limit(5).to_list(length=None)
        recent = [_str_id(d) for d in recent]

        # Compliance by project
        pipe2 = [
            {"$group": {
                "_id":   "$project_id",
                "avg":   {"$avg": "$compliance_score"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"avg": -1}},
            {"$limit": 10},
        ]
        cursor2     = db[QC_ANALYSES_COLLECTION].aggregate(pipe2)
        by_project  = await cursor2.to_list(length=None)

        # Tasks awaiting QC: todos in task boards not yet analyzed
        analyzed_task_ids = set(await db[QC_ANALYSES_COLLECTION].distinct("task_id"))
        pipe_todos = [
            {"$unwind": "$tasks"},
            {"$group": {"_id": "$tasks.id"}},
        ]
        all_todo_ids_cursor = db[TASK_BOARDS_COLLECTION].aggregate(pipe_todos)
        all_todo_ids = {d["_id"] async for d in all_todo_ids_cursor}
        tasks_awaiting = len(all_todo_ids - analyzed_task_ids)

        # 14-day mini quality score trend for dashboard chart
        since_14d = datetime.utcnow() - timedelta(days=14)
        pipe_mini = [
            {"$match": {"created_at": {"$gte": since_14d}}},
            {"$group": {
                "_id": {
                    "year":  {"$year":  "$created_at"},
                    "month": {"$month": "$created_at"},
                    "day":   {"$dayOfMonth": "$created_at"},
                },
                "avg": {"$avg": "$compliance_score"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}},
        ]
        mini_cursor = db[QC_ANALYSES_COLLECTION].aggregate(pipe_mini)
        mini_raw    = await mini_cursor.to_list(length=None)
        quality_trend_14d = [
            {
                "date":      f"{d['_id']['month']}/{d['_id']['day']}",
                "avg_score": round(d["avg"], 1),
                "count":     d["count"],
            }
            for d in mini_raw
        ]

        return {
            "total_standards":        total_standards,
            "total_analyses":         total_analyses,
            "avg_compliance_score":   avg_score,
            "tasks_passing_qc":       passing,
            "tasks_failing_qc":       failing,
            "tasks_awaiting_qc":      tasks_awaiting,
            "total_todo_completions": total_todos,
            "recent_analyses":        recent,
            "quality_trend_14d":      quality_trend_14d,
            "compliance_by_project":  [
                {"project_id": b["_id"], "avg_score": round(b["avg"], 1), "count": b["count"]}
                for b in by_project
            ],
        }

    # -- Analytics (for reports page) ----------------------------------------

    @staticmethod
    async def get_analytics(db, days: int = 30) -> dict:
        since = datetime.utcnow() - timedelta(days=days)

        # Quality score trend (daily average)
        pipe_trend = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {
                "_id": {
                    "year":  {"$year": "$created_at"},
                    "month": {"$month": "$created_at"},
                    "day":   {"$dayOfMonth": "$created_at"},
                },
                "avg_score": {"$avg": "$compliance_score"},
                "count":     {"$sum": 1},
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}},
        ]
        cursor_trend = db[QC_ANALYSES_COLLECTION].aggregate(pipe_trend)
        trend_data   = await cursor_trend.to_list(length=None)
        quality_trend = [
            {
                "date":      f"{d['_id']['year']}-{d['_id']['month']:02d}-{d['_id']['day']:02d}",
                "avg_score": round(d["avg_score"], 1),
                "count":     d["count"],
            }
            for d in trend_data
        ]

        # Status distribution (filtered to same time window)
        pipe_status = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {
                "_id":   {"$cond": [{"$gte": ["$compliance_score", 70]}, "passing", "failing"]},
                "count": {"$sum": 1},
            }}
        ]
        cursor_status  = db[QC_ANALYSES_COLLECTION].aggregate(pipe_status)
        status_data    = await cursor_status.to_list(length=None)
        status_dist    = {d["_id"]: d["count"] for d in status_data}

        # Todo completions trend
        pipe_todos = [
            {"$match": {"timestamp": {"$gte": since}, "action": "checked"}},
            {"$group": {
                "_id": {
                    "year":  {"$year": "$timestamp"},
                    "month": {"$month": "$timestamp"},
                    "day":   {"$dayOfMonth": "$timestamp"},
                },
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}},
        ]
        cursor_todos = db[QC_TODO_TRACKING_COLLECTION].aggregate(pipe_todos)
        todo_data    = await cursor_todos.to_list(length=None)
        todo_trend   = [
            {
                "date":  f"{d['_id']['year']}-{d['_id']['month']:02d}-{d['_id']['day']:02d}",
                "count": d["count"],
            }
            for d in todo_data
        ]

        # Failure rate per standard rule
        pipe_failures = [
            {"$unwind": "$failed_standards"},
            {"$group": {"_id": "$failed_standards.rule", "failures": {"$sum": 1}}},
            {"$sort": {"failures": -1}},
            {"$limit": 10},
        ]
        cursor_fail   = db[QC_ANALYSES_COLLECTION].aggregate(pipe_failures)
        failure_data  = await cursor_fail.to_list(length=None)
        failure_rates = [{"rule": d["_id"], "failures": d["failures"]} for d in failure_data]

        return {
            "quality_score_trend":    quality_trend,
            "status_distribution":    status_dist,
            "todo_completion_trend":  todo_trend,
            "top_failing_standards":  failure_rates,
        }

    # -- CSV Export ----------------------------------------------------------

    @staticmethod
    async def export_analyses_csv(db) -> str:
        analyses = await db[QC_ANALYSES_COLLECTION].find({}).sort("created_at", -1)\
            .limit(1000).to_list(length=None)
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "id", "task_id", "project_id", "task_title",
            "compliance_score", "passed_count", "failed_count",
            "analyzed_by", "created_at",
        ])
        writer.writeheader()
        for a in analyses:
            writer.writerow({
                "id":              str(a.get("_id", "")),
                "task_id":         a.get("task_id", ""),
                "project_id":      a.get("project_id", ""),
                "task_title":      a.get("task_title", ""),
                "compliance_score": a.get("compliance_score", 0),
                "passed_count":    len(a.get("passed_standards", [])),
                "failed_count":    len(a.get("failed_standards", [])),
                "analyzed_by":     a.get("analyzed_by", ""),
                "created_at":      str(a.get("created_at", "")),
            })
        return output.getvalue()
