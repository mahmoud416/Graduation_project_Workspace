import asyncio
from app.db.mongodb import get_database, connect_to_mongo
from app.db.collections import USERS_COLLECTION

async def main():
    await connect_to_mongo()
    db = get_database()
    users = await db[USERS_COLLECTION].find({"role": "staff"}).to_list(length=5)
    for u in users:
        print(f"Email: {u.get('email')} - Role: {u.get('role')}")

if __name__ == "__main__":
    asyncio.run(main())
