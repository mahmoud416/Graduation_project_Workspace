import asyncio
from app.db.mongodb import get_database, connect_to_mongo
from app.db.collections import USERS_COLLECTION, PROJECTS_COLLECTION
from app.routes.projects import _visibility_filter

async def main():
    await connect_to_mongo()
    db = get_database()
    staff_user = await db[USERS_COLLECTION].find_one({"role": "staff"})
    if staff_user:
        print(f"Testing for staff user: {staff_user['email']} / {staff_user['_id']}")
        query = _visibility_filter(staff_user)
        print("Query:", query)
        projects = await db[PROJECTS_COLLECTION].find(query).to_list(length=None)
        print("Projects found:")
        for p in projects:
            print(f"- {p.get('_id')} (type: {type(p.get('_id'))})")

if __name__ == "__main__":
    asyncio.run(main())
