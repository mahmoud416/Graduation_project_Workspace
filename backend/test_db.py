import asyncio
from app.db.mongodb import get_database, connect_to_mongo
from app.db.collections import QUALITY_RULES_COLLECTION

async def main():
    await connect_to_mongo()
    db = get_database()
    rules = await db[QUALITY_RULES_COLLECTION].find({}).to_list(length=None)
    for r in rules:
        print(f"[{r.get('category')}] {r.get('rule')} (Active: {r.get('is_active')})")

if __name__ == "__main__":
    asyncio.run(main())
