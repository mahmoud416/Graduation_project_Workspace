"""Service layer for QC AI analyses."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.db.collections import QUALITY_ANALYSES_COLLECTION
from app.schemas.quality_control import QualityAnalysisRequest
from app.services import ai_service
from app.services.quality_standard_service import QualityStandardService


class QualityAnalysisService:
    """Handles AI-powered task evaluations."""

    @staticmethod
    def _maybe_object_id(value: Optional[str]):
        if value and ObjectId.is_valid(value):
            return ObjectId(value)
        return value

    @staticmethod
    def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
        data = dict(doc)
        for key in ("_id", "task_id", "project_id", "triggered_by"):
            if key in data and isinstance(data[key], ObjectId):
                data[key] = str(data[key])
        return data

    @staticmethod
    def _standards_to_rules(standards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        rules: List[Dict[str, Any]] = []
        for standard in standards:
            std_type = standard.get("type", "text")
            std_title = standard.get("title")
            for rule in standard.get("rules", []):
                rules.append(
                    {
                        "rule": rule.get("label") or std_title,
                        "category": std_type,
                        "is_active": standard.get("status", "active") == "active",
                        "instructions": rule.get("instructions"),
                        "weight": rule.get("weight", 1.0),
                    }
                )
            if std_type == "dataset" and standard.get("dataset_refs"):
                dataset_summary = ", ".join(
                    sorted({tag for ref in standard["dataset_refs"] for tag in ref.get("tags", [])})
                )
                rules.append(
                    {
                        "rule": f"Dataset reference '{std_title}' must align with approved samples",
                        "category": "dataset",
                        "is_active": standard.get("status", "active") == "active",
                        "instructions": dataset_summary or "Compare against uploaded dataset",
                        "weight": 1.0,
                    }
                )
        return rules

    @staticmethod
    async def run_analysis(
        db,
        request: QualityAnalysisRequest,
        *,
        triggered_by: Any,
        file_texts: Optional[List[Dict[str, Any]]] = None,
        image_bytes: Optional[List[bytes]] = None,
    ) -> Dict[str, Any]:
        standards = await QualityStandardService.fetch_applicable_standards(
            db,
            project_id=request.project_id,
            standard_ids=request.standard_ids or None,
        )
        if not standards:
            raise ValueError("No active quality standards available for this analysis")

        rules_for_ai = QualityAnalysisService._standards_to_rules(standards)
        description = request.description_override or request.task_description or ""

        ai_result = await ai_service.analyze_task_against_standards(
            task_title=request.task_title,
            task_description=description,
            standards_rules=rules_for_ai,
            image_bytes_list=image_bytes,
            file_texts=file_texts,
            db=db,
        )

        now = datetime.utcnow()
        analysis_doc: Dict[str, Any] = {
            "task_id": QualityAnalysisService._maybe_object_id(request.task_id),
            "task_title": request.task_title,
            "project_id": QualityAnalysisService._maybe_object_id(request.project_id),
            "triggered_by": triggered_by,
            "standards_applied": [std.get("_id") for std in standards if std.get("_id")],
            "score": ai_result.get("compliance_score", 0),
            "passed_rules": ai_result.get("passed_standards", []),
            "failed_rules": ai_result.get("failed_standards", []),
            "suggestions": ai_result.get("suggestions", []),
            "files_analyzed": ai_result.get("files_analyzed", []),
            "status": "completed",
            "ai_mode": ai_result.get("_mode", "online"),
            "inputs": {
                "description_override": bool(request.description_override),
                "standard_ids": request.standard_ids,
                "file_count": len(file_texts or []),
                "image_count": len(image_bytes or []),
            },
            "created_at": now,
            "completed_at": now,
        }

        result = await db[QUALITY_ANALYSES_COLLECTION].insert_one(analysis_doc)
        analysis_doc["_id"] = result.inserted_id
        return QualityAnalysisService._serialize(analysis_doc)

    @staticmethod
    async def list_analyses(
        db,
        *,
        project_id: Optional[str] = None,
        limit: int = 20,
        skip: int = 0,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if project_id:
            if ObjectId.is_valid(project_id):
                query["project_id"] = ObjectId(project_id)
            else:
                query["project_id"] = project_id

        cursor = (
            db[QUALITY_ANALYSES_COLLECTION]
            .find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [QualityAnalysisService._serialize(doc) for doc in docs]

    @staticmethod
    async def get_analysis(db, analysis_id: str) -> Dict[str, Any]:
        try:
            oid = ObjectId(analysis_id)
        except Exception:
            raise ValueError("Invalid analysis ID")

        doc = await db[QUALITY_ANALYSES_COLLECTION].find_one({"_id": oid})
        if not doc:
            raise ValueError("Analysis not found")
        return QualityAnalysisService._serialize(doc)

    @staticmethod
    async def latest_for_task(db, task_id: str) -> Optional[Dict[str, Any]]:
        query: Dict[str, Any]
        if ObjectId.is_valid(task_id):
            query = {"task_id": ObjectId(task_id)}
        else:
            query = {"task_id": task_id}
        doc = await db[QUALITY_ANALYSES_COLLECTION].find_one(
            query,
            sort=[("created_at", -1)],
        )
        if not doc:
            return None
        return QualityAnalysisService._serialize(doc)
