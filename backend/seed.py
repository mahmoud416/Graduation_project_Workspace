#!/usr/bin/env python3
"""
Orbit Platform — Standalone Seed Script
Run: python seed.py

Connects to MongoDB and populates enterprise demo data.
Safe to run multiple times (idempotent).
"""
import asyncio
import os
import sys

# ── make sure the backend package is importable ───────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.services.seed_service import seed_demo_data


async def main() -> None:
    uri = settings.MONGO_URI or settings.MONGODB_URL
    print(f"[seed] Connecting to MongoDB: {uri[:40]}…")
    client = AsyncIOMotorClient(uri)
    db     = client[settings.MONGODB_DB_NAME]

    try:
        await db.command("ping")
        print("[seed] MongoDB connection OK")
    except Exception as exc:
        print(f"[seed] ERROR — cannot reach MongoDB: {exc}")
        sys.exit(1)

    print("[seed] Starting seed process…")
    result = await seed_demo_data(db)

    if result.get("already_seeded"):
        print(f"[seed] Already seeded — {result['users']} users, {result['projects']} projects found.")
    else:
        print("[seed] ✓ Seed complete!")
        for k, v in result.items():
            if k not in ("already_seeded", "message"):
                print(f"       {k:.<25} {v}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
