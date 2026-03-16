"""Seed demo AI analyses and checklist activity so the QC dashboard has live signals."""
import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.db.collections import (
    QUALITY_ANALYSES_COLLECTION,
    QUALITY_STANDARDS_COLLECTION,
    TODO_AUDIT_COLLECTION,
)

SYSTEM_USER_ID = ObjectId("000000000000000000000001")
PROJECT_ID = "bubblein-web"

ANALYSIS_TEMPLATES: List[Dict[str, Any]] = [
    {
        "task_id": "bubblein-task-001",
        "task_title": "Hero automation copy",
        "score": 82.5,
        "passed": [
            "Hero copy references automation promise",
            "Primary CTA is action-specific",
        ],
        "failed": [
            {
                "rule": "Proof stack highlights regulated logo",
                "reason": "Only SaaS logos were attached",
            }
        ],
        "suggestions": [
            "Add fintech customer logo with quantified KPI",
            "Attach SOC-2 proof link in footer",
        ],
        "days_ago": 5,
    },
    {
        "task_id": "bubblein-task-002",
        "task_title": "Proof assets refresh",
        "score": 74.0,
        "passed": [
            "Proof stack highlights regulated logo",
        ],
        "failed": [
            {
                "rule": "Handoff package is complete",
                "reason": "ZIP is missing annotated frames",
            }
        ],
        "suggestions": [
            "Export Figma page with layer annotations before upload",
        ],
        "days_ago": 3,
    },
    {
        "task_id": "bubblein-task-003",
        "task_title": "Accessibility sweep",
        "score": 91.2,
        "passed": [
            "Paragraph contrast",
            "Alt text completeness",
            "Keyboard navigation",
        ],
        "failed": [],
        "suggestions": [
            "Keep reduced-motion toggle in final build",
        ],
        "days_ago": 1,
    },
]

TODO_EVENTS = [
    {"todo_id": "todo-001", "task_id": "bubblein-task-001", "action": "checked", "days_ago": 5},
    {"todo_id": "todo-002", "task_id": "bubblein-task-001", "action": "unchecked", "days_ago": 4},
    {"todo_id": "todo-003", "task_id": "bubblein-task-002", "action": "checked", "days_ago": 3},
    {"todo_id": "todo-004", "task_id": "bubblein-task-002", "action": "checked", "days_ago": 2},
    {"todo_id": "todo-005", "task_id": "bubblein-task-003", "action": "checked", "days_ago": 1},
]


async def _resolve_standard_ids(db) -> List[ObjectId]:
    titles = ["Bubblein Landing QA Gate", "Workspace Accessibility Baseline"]
    cursor = db[QUALITY_STANDARDS_COLLECTION].find({"title": {"$in": titles}})
    docs = await cursor.to_list(length=5)
    ids = [doc["_id"] for doc in docs if isinstance(doc.get("_id"), ObjectId)]
    if len(ids) < 2:
        print("⚠️  Expected both Bubblein + Accessibility standards. Run seed_quality_examples first.")
    return ids


async def seed_analyses(db) -> None:
    collection = db[QUALITY_ANALYSES_COLLECTION]
    standard_ids = await _resolve_standard_ids(db)
    for template in ANALYSIS_TEMPLATES:
        existing = await collection.find_one({"task_id": template["task_id"]})
        if existing:
            print(f"• Skipping analysis for {template['task_id']} (already exists)")
            continue
        created_at = datetime.utcnow() - timedelta(days=template["days_ago"])
        doc = {
            "task_id": template["task_id"],
            "task_title": template["task_title"],
            "project_id": PROJECT_ID,
            "triggered_by": SYSTEM_USER_ID,
            "standards_applied": standard_ids,
            "score": template["score"],
            "passed_rules": [
                {"rule": rule, "status": "passed"}
                for rule in template["passed"]
            ],
            "failed_rules": [
                {"rule": item["rule"], "reason": item.get("reason")}
                for item in template["failed"]
            ],
            "suggestions": template["suggestions"],
            "files_analyzed": [
                {
                    "file_name": "bubblein-copy-baseline.md",
                    "source": "seed",
                }
            ],
            "status": "completed",
            "ai_mode": "demo-seed",
            "inputs": {
                "description_override": False,
                "standard_ids": [str(_id) for _id in standard_ids],
                "file_count": 1,
                "image_count": 0,
            },
            "created_at": created_at,
            "completed_at": created_at,
        }
        await collection.insert_one(doc)
        print(f"✓ Inserted analysis {template['task_id']}")


async def seed_todo_activity(db) -> None:
    collection = db[TODO_AUDIT_COLLECTION]
    for event in TODO_EVENTS:
        timestamp = datetime.utcnow() - timedelta(days=event["days_ago"])
        existing = await collection.find_one({"todo_id": event["todo_id"]})
        if existing:
            print(f"• Skipping todo {event['todo_id']} (already exists)")
            continue
        doc = {
            "todo_id": event["todo_id"],
            "task_id": event["task_id"],
            "project_id": PROJECT_ID,
            "checked_by": str(SYSTEM_USER_ID),
            "action": event["action"],
            "timestamp": timestamp,
        }
        await collection.insert_one(doc)
        print(f"✓ Logged todo event {event['todo_id']}")


async def main() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    try:
        await seed_analyses(db)
        await seed_todo_activity(db)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
