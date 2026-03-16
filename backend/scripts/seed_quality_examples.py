"""Seed curated quality standards and datasets used by the QC lab demo."""
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.db.collections import (
    QUALITY_DATASETS_COLLECTION,
    QUALITY_STANDARDS_COLLECTION,
)
from app.schemas.quality_control import QualityStandardCreate
from app.services.quality_standard_service import QualityStandardService

SYSTEM_USER_ID = ObjectId("000000000000000000000001")
UPLOADS_ROOT = Path(__file__).resolve().parents[1] / "uploads"


def _build_dataset_ref(file_path: str, *, file_type: str, tags: List[str]) -> Dict[str, Any]:
    """Return a dataset reference entry with the on-disk file size."""
    absolute_path = UPLOADS_ROOT / file_path
    size_bytes = absolute_path.stat().st_size if absolute_path.exists() else 0
    return {
        "file_id": f"seed-{absolute_path.stem}",
        "file_path": file_path.replace("\\", "/"),
        "file_type": file_type,
        "tags": tags,
        "size_bytes": size_bytes,
    }


STANDARD_PRESETS: List[Dict[str, Any]] = [
    {
        "title": "Bubblein Landing QA Gate",
        "payload": {
            "title": "Bubblein Landing QA Gate",
            "description": "Blocks Bubblein landing tasks unless hero, proof, and CTA copy hit the automation promise.",
            "type": "text",
            "rules": [
                {
                    "label": "Hero copy references automation promise",
                    "instructions": "Mention Bubblein by name plus an automation outcome inside the first sentence.",
                    "weight": 0.35,
                },
                {
                    "label": "Primary CTA is action-specific",
                    "instructions": "CTA label must be 'Start Free QA Audit', 'Book QA Pilot', or 'Talk To QA Engineer'.",
                    "weight": 0.25,
                },
                {
                    "label": "Proof stack highlights regulated logo",
                    "instructions": "Provide at least one fintech or healthcare customer with a quantified win.",
                    "weight": 0.2,
                },
                {
                    "label": "Handoff package is complete",
                    "instructions": "Figma export includes annotated frames plus ZIP with SVG, Lottie, and copy deck.",
                    "weight": 0.2,
                },
            ],
            "dataset_refs": [
                _build_dataset_ref(
                    "qc_datasets/bubblein/bubblein-copy-baseline.md",
                    file_type="document",
                    tags=["bubblein", "copy", "baseline"],
                ),
                _build_dataset_ref(
                    "qc_datasets/bubblein/bubblein-ux-checklist.csv",
                    file_type="document",
                    tags=["bubblein", "ux", "checklist"],
                ),
            ],
            "scope": {"level": "project", "ids": ["bubblein-web"]},
            "status": "active",
        },
    },
    {
        "title": "Workspace Accessibility Baseline",
        "payload": {
            "title": "Workspace Accessibility Baseline",
            "description": "Workspace-wide WCAG checks enforced on every marketing artifact before release.",
            "type": "text",
            "rules": [
                {
                    "label": "Paragraph contrast",
                    "instructions": "Body copy pairs must meet WCAG AA contrast ratio >= 4.5:1.",
                    "weight": 0.3,
                },
                {
                    "label": "Alt text completeness",
                    "instructions": "Every marketing hero and carousel image needs descriptive alt text.",
                    "weight": 0.25,
                },
                {
                    "label": "Motion accessibility",
                    "instructions": "Animated assets must offer a reduced-motion variant or a static fallback.",
                    "weight": 0.2,
                },
                {
                    "label": "Keyboard navigation",
                    "instructions": "Primary CTA and secondary links must be reachable via tab order <= 4 steps.",
                    "weight": 0.25,
                },
            ],
            "dataset_refs": [],
            "scope": {"level": "all", "ids": []},
            "status": "active",
        },
    },
]


QUALITY_DATASETS_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "Bubblein QA Patterns v1",
        "description": "Handcrafted examples extracted from the Bubblein landing revamp initiative.",
        "data": [
            {
                "pattern": "Hero copy mentioned Bubblein but skipped automation outcome",
                "signal": "score -15",
                "severity": "critical",
                "remedy": "Rewrite headline to mention AI QA automation and quantified outcome.",
            },
            {
                "pattern": "CTA label used a generic 'Learn more' text",
                "signal": "score -10",
                "severity": "major",
                "remedy": "Swap CTA label to 'Start Free QA Audit'.",
            },
            {
                "pattern": "Proof stack missing regulated logo",
                "signal": "score -8",
                "severity": "major",
                "remedy": "Add fintech client card with KPI uplift.",
            },
            {
                "pattern": "Handoff ZIP lacked annotated frames",
                "signal": "score -5",
                "severity": "minor",
                "remedy": "Export Figma page with layer naming convention before upload.",
            },
        ],
    },
    {
        "name": "Accessibility Regression Tests",
        "description": "Baseline accessibility issues caught across workspace marketing drops.",
        "data": [
            {
                "pattern": "CTA contrast dipped below AA threshold",
                "signal": "contrast 3.2:1",
                "severity": "critical",
                "remedy": "Darken background overlay or lighten CTA fill to hit >= 4.5:1.",
            },
            {
                "pattern": "Missing alt text on hero animation",
                "signal": "alt attribute empty",
                "severity": "major",
                "remedy": "Provide short description of animation focus state.",
            },
            {
                "pattern": "Motion-only cue for success state",
                "signal": "blink animation only",
                "severity": "minor",
                "remedy": "Add icon + copy to reflect success in static form.",
            },
        ],
    },
]


async def seed_standards(db) -> None:
    for preset in STANDARD_PRESETS:
        existing = await db[QUALITY_STANDARDS_COLLECTION].find_one({"title": preset["title"]})
        if existing:
            print(f"• Skipping standard '{preset['title']}' (already exists)")
            continue
        payload = QualityStandardCreate(**preset["payload"])
        await QualityStandardService.create_standard(db, payload, created_by=SYSTEM_USER_ID)
        print(f"✓ Inserted standard '{preset['title']}'")


async def seed_datasets(db) -> None:
    collection = db[QUALITY_DATASETS_COLLECTION]
    for entry in QUALITY_DATASETS_PRESETS:
        existing = await collection.find_one({"name": entry["name"]})
        if existing:
            print(f"• Skipping dataset '{entry['name']}' (already exists)")
            continue
        doc = {
            "name": entry["name"],
            "description": entry["description"],
            "data": entry["data"],
            "uploaded_by": SYSTEM_USER_ID,
            "version": 1,
            "created_at": datetime.utcnow(),
        }
        await collection.insert_one(doc)
        print(f"✓ Inserted dataset '{entry['name']}'")


async def main() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    try:
        await seed_standards(db)
        await seed_datasets(db)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
