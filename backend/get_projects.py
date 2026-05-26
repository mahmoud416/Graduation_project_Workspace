import asyncio
from app.db.mongodb import get_database, connect_to_mongo
from app.db.collections import PROJECTS_COLLECTION

async def main():
    await connect_to_mongo()
    db = get_database()
    projects = await db[PROJECTS_COLLECTION].find({"_id": "public-group"}).to_list(length=5)
    for p in projects:
        print(f"ID: {p.get('_id')} - Title: {p.get('title')}")

if __name__ == "__main__":
    asyncio.run(main())
