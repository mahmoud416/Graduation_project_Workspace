"""
MongoDB connection and database management.
Motor is used for async MongoDB operations.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
from app.core.config import settings


class MongoDB:
    """MongoDB connection manager."""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


# Global MongoDB instance
mongodb = MongoDB()


async def connect_to_mongo():
    """
    Establish connection to MongoDB.
    Called on application startup.
    """
    mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
    mongodb.db = mongodb.client[settings.MONGODB_DB_NAME]
    print(f"✓ Connected to MongoDB: {settings.MONGODB_DB_NAME}")


async def close_mongo_connection():
    """
    Close MongoDB connection.
    Called on application shutdown.
    """
    if mongodb.client:
        mongodb.client.close()
        print("✓ MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    """
    Get the database instance for dependency injection.
    
    Returns:
        AsyncIOMotorDatabase instance
    """
    return mongodb.db
