import asyncio
from app.db.mongodb import get_database, connect_to_mongo
from app.db.collections import USERS_COLLECTION
from app.services.auth_service import AuthService
from app.core.security import hash_password

async def add_or_update_user(db, email, password, full_name, role, roles):
    # Check if the user already exists
    existing = await db[USERS_COLLECTION].find_one({"email": email.lower()})
    
    hashed = hash_password(password)
    
    if existing:
        # Update existing user to ensure correct role, roles list, and password
        await db[USERS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "name": full_name,
                "role": role,
                "roles": roles,
                "password": hashed,
                "is_active": True,
                "status": "active"
            }}
        )
        print(f"✓ User updated: {email} | Role: {role}")
    else:
        # Create new user document using AuthService
        user_doc = await AuthService.register_user(
            db=db,
            email=email,
            password=password,
            full_name=full_name,
            role=role,
            roles=roles
        )
        print(f"✓ User created: {email} | Role: {role}")

async def main():
    await connect_to_mongo()
    db = get_database()
    
    print("\n--- Seeding Founder and IT Staff Accounts ---")
    
    # 1. Founder Account
    await add_or_update_user(
        db=db,
        email="founder@hericle.com",
        password="FounderPassword123",
        full_name="System Founder",
        role="founder",
        roles=["founder"]
    )
    
    # 2. IT Staff Account
    await add_or_update_user(
        db=db,
        email="it@hericle.com",
        password="ITPassword123",
        full_name="IT Support Specialist",
        role="it_staff",
        roles=["it_staff"]
    )
    
    print("\n--- Current Users in Database ---")
    users = await db[USERS_COLLECTION].find({}).to_list(length=100)
    for u in users:
        print(f"Email: {u.get('email')} | Name: {u.get('name')} | Role: {u.get('role')} | Roles: {u.get('roles')}")

if __name__ == "__main__":
    asyncio.run(main())
