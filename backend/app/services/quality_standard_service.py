"""Service layer for managing Quality Control standards."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId

from app.db.collections import QUALITY_STANDARDS_COLLECTION
from app.schemas.quality_control import (
    QualityStandardCreate,
    QualityStandardUpdate,
    DatasetReference,
)


class QualityStandardService:
    """CRUD helper for quality standards."""

    @staticmethod
    def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
        data = dict(doc)
        if "_id" in data:
            data["_id"] = str(data["_id"])
        if isinstance(data.get("created_by"), ObjectId):
            data["created_by"] = str(data["created_by"])
        return data

    @staticmethod
    def _normalize_rule(rule: Dict[str, Any]) -> Dict[str, Any]:
        prepared = dict(rule)
        prepared["rule_id"] = prepared.get("rule_id") or str(uuid4())
        weight = prepared.get("weight")
        prepared["weight"] = float(weight) if weight is not None else 1.0
        return prepared

    @staticmethod
    async def create_standard(
        db,
        payload: QualityStandardCreate,
        created_by: Any,
    ) -> Dict[str, Any]:
        now = datetime.utcnow()
        doc = payload.model_dump()
        doc["rules"] = [
            QualityStandardService._normalize_rule(rule.model_dump())
            for rule in payload.rules
        ]
        doc["dataset_refs"] = [ref.model_dump() for ref in payload.dataset_refs]
        doc["scope"] = payload.scope.model_dump()
        doc["created_by"] = created_by
        doc["version"] = 1
        doc["created_at"] = now
        doc["updated_at"] = now

        result = await db[QUALITY_STANDARDS_COLLECTION].insert_one(doc)
        doc["_id"] = result.inserted_id
        return QualityStandardService._serialize(doc)

    @staticmethod
    async def list_standards(
        db,
        *,
        project_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status

        if project_id:
            query["$or"] = [
                {"scope.level": "all"},
                {"scope.level": "project", "scope.ids": project_id},
                {"scope.level": "group", "scope.ids": project_id},
            ]
        docs = await db[QUALITY_STANDARDS_COLLECTION].find(query).sort("updated_at", -1).to_list(length=200)
        return [QualityStandardService._serialize(doc) for doc in docs]

    @staticmethod
    async def get_standard(db, standard_id: str) -> Dict[str, Any]:
        try:
            oid = ObjectId(standard_id)
        except Exception:
            raise ValueError("Invalid standard ID")

        doc = await db[QUALITY_STANDARDS_COLLECTION].find_one({"_id": oid})
        if not doc:
            raise ValueError("Standard not found")
        return QualityStandardService._serialize(doc)

    @staticmethod
    async def update_standard(
        db,
        standard_id: str,
        payload: QualityStandardUpdate,
        *,
        bump_version: bool = True,
    ) -> Dict[str, Any]:
        try:
            oid = ObjectId(standard_id)
        except Exception:
            raise ValueError("Invalid standard ID")

        updates: Dict[str, Any] = {}
        data = payload.model_dump(exclude_unset=True)
        if "rules" in data and data["rules"] is not None:
            updates["rules"] = [
                QualityStandardService._normalize_rule(rule.model_dump())
                for rule in payload.rules or []
            ]
        if "dataset_refs" in data and data["dataset_refs"] is not None:
            updates["dataset_refs"] = [ref.model_dump() for ref in payload.dataset_refs or []]
        if "scope" in data and data["scope"] is not None:
            updates["scope"] = payload.scope.model_dump() if payload.scope else None
        for key in ("title", "description", "type", "status"):
            if key in data:
                updates[key] = data[key]

        if not updates:
            raise ValueError("No valid fields to update")

        updates.setdefault("updated_at", datetime.utcnow())

        update_payload: Dict[str, Any] = {"$set": updates}
        if bump_version:
            update_payload["$inc"] = {"version": 1}

        result = await db[QUALITY_STANDARDS_COLLECTION].find_one_and_update(
            {"_id": oid},
            update_payload,
            return_document=True,
        )
        if not result:
            raise ValueError("Standard not found")
        return QualityStandardService._serialize(result)

    @staticmethod
    async def archive_standard(db, standard_id: str) -> None:
        try:
            oid = ObjectId(standard_id)
        except Exception:
            raise ValueError("Invalid standard ID")

        await db[QUALITY_STANDARDS_COLLECTION].update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "archived",
                    "updated_at": datetime.utcnow(),
                }
            },
        )

    @staticmethod
    async def add_dataset_reference(
        db,
        standard_id: str,
        dataset_ref: DatasetReference,
    ) -> Dict[str, Any]:
        try:
            oid = ObjectId(standard_id)
        except Exception:
            raise ValueError("Invalid standard ID")

        update = {
            "$push": {"dataset_refs": dataset_ref.model_dump()},
            "$set": {"updated_at": datetime.utcnow()},
            "$inc": {"version": 1},
        }
        result = await db[QUALITY_STANDARDS_COLLECTION].find_one_and_update(
            {"_id": oid},
            update,
            return_document=True,
        )
        if not result:
            raise ValueError("Standard not found")
        return QualityStandardService._serialize(result)

    @staticmethod
    async def fetch_applicable_standards(
        db,
        *,
        project_id: Optional[str] = None,
        standard_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {"status": "active"}
        if standard_ids:
            object_ids = []
            for std_id in standard_ids:
                if ObjectId.is_valid(std_id):
                    object_ids.append(ObjectId(std_id))
            if object_ids:
                query["_id"] = {"$in": object_ids}
        elif project_id:
            query["$or"] = [
                {"scope.level": "all"},
                {"scope.level": "project", "scope.ids": project_id},
                {"scope.level": "group", "scope.ids": project_id},
            ]
        else:
            query["scope.level"] = "all"

        docs = await db[QUALITY_STANDARDS_COLLECTION].find(query).to_list(length=200)
        return docs
