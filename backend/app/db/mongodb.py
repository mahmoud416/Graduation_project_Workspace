"""
MongoDB connection and database management.
Motor is used for async MongoDB operations.
MONGO_URI (Atlas) takes precedence over MONGODB_URL (localhost fallback).
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
from app.core.config import settings


class MongoDB:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


mongodb = MongoDB()


def _get_connection_uri() -> str:
    if settings.MONGO_URI and settings.MONGO_URI.strip():
        return settings.MONGO_URI.strip()
    return settings.MONGODB_URL


async def connect_to_mongo(max_retries: int = 3, retry_delay: float = 2.0):
    """
    Establish connection to MongoDB with retry logic.
    If Atlas URI is set but fails auth, automatically falls back to localhost.
    """
    primary_uri = _get_connection_uri()
    is_atlas = "mongodb+srv" in primary_uri or "mongodb.net" in primary_uri
    uris_to_try = [primary_uri]
    if is_atlas and settings.MONGODB_URL and settings.MONGODB_URL != primary_uri:
        uris_to_try.append(settings.MONGODB_URL)  # localhost fallback

    for uri_index, uri in enumerate(uris_to_try):
        source = "Atlas" if ("mongodb+srv" in uri or "mongodb.net" in uri) else "localhost"
        for attempt in range(1, max_retries + 1):
            try:
                client = AsyncIOMotorClient(
                    uri,
                    serverSelectionTimeoutMS=10000,
                    connectTimeoutMS=10000,
                    socketTimeoutMS=20000,
                )
                db_name = settings.MONGODB_DB_NAME
                db = client[db_name]
                await db.command("ping")
                mongodb.client = client
                mongodb.db = db
                print(f"[OK] Connected to MongoDB ({source}): {db_name}")
                return
            except Exception as exc:
                print(f"[WARN] MongoDB {source} attempt {attempt}/{max_retries} failed: {exc}")
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay)

        if uri_index == 0 and len(uris_to_try) > 1:
            print(f"[INFO] Atlas unreachable — falling back to localhost …")

    # All URIs exhausted — set a non-connected client so endpoints surface the error
    print("[ERROR] All MongoDB connection attempts failed. Server will start but DB ops will fail.")
    fallback = uris_to_try[-1]
    mongodb.client = AsyncIOMotorClient(fallback)
    mongodb.db = mongodb.client[settings.MONGODB_DB_NAME]


async def close_mongo_connection():
    if mongodb.client:
        mongodb.client.close()
        print("[OK] MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    return mongodb.db
