"""
Authentication service.
Handles user registration and login with bcrypt password hashing.
"""
from datetime import datetime
from typing import Optional, Dict, Any
from bson import ObjectId

from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import UserModel
from app.db.collections import USERS_COLLECTION


class AuthService:
    """Service for authentication operations."""

    @staticmethod
    async def register_user(
        db,
        email: str,
        password: str,
        full_name: str,
        role: str = "staff",
        admin_id: Optional[str] = None,
        sub_manager_id: Optional[str] = None,
        phone: Optional[str] = None,
        status: str = "active"
    ) -> Dict[str, Any]:
        """Register a new user with bcrypt-hashed password."""
        existing = await db[USERS_COLLECTION].find_one({"email": email.lower()})
        if existing:
            raise ValueError("Email already registered")

        hashed = hash_password(password)

        user_doc = UserModel.create_document(
            email=email,
            password=hashed,
            full_name=full_name,
            role=role or "staff",
            admin_id=admin_id,
            sub_manager_id=sub_manager_id,
            phone=phone,
            status=status or "active"
        )

        result = await db[USERS_COLLECTION].insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        return user_doc

    @staticmethod
    async def authenticate_user(
        db,
        email: str,
        password: str
    ) -> Optional[Dict[str, Any]]:
        """
        Authenticate a user. Supports both bcrypt hashes and plain-text
        passwords (for accounts created before the security upgrade).
        """
        user = await db[USERS_COLLECTION].find_one({"email": email.lower()})
        if not user:
            return None

        stored = user.get("password", "")

        # Try bcrypt verification first
        authenticated = False
        if stored.startswith("$2b$") or stored.startswith("$2a$"):
            authenticated = verify_password(password, stored)
        else:
            # Legacy plain-text comparison — migrate on successful login
            if password == stored:
                authenticated = True
                # Migrate to bcrypt
                hashed = hash_password(password)
                await db[USERS_COLLECTION].update_one(
                    {"_id": user["_id"]},
                    {"$set": {"password": hashed}}
                )

        if not authenticated:
            return None

        now = datetime.utcnow()
        await db[USERS_COLLECTION].update_one(
            {"_id": user["_id"]},
            {
                "$set": {"last_login": now},
                # Append a new login entry and keep only the 50 most recent ones.
                # $slice: -50 discards the oldest entries from the front of the array,
                # so the document size stays bounded regardless of login frequency.
                "$push": {
                    "login_history": {
                        "$each":  [{"timestamp": now}],
                        "$slice": -50,
                    }
                },
            }
        )
        return user

    @staticmethod
    def generate_token(user: Dict[str, Any]) -> str:
        """Generate a JWT access token for a user."""
        return create_access_token(
            user_id=str(user["_id"]),
            role=user.get("role", "staff"),
            name=user.get("name", "")
        )

    @staticmethod
    async def update_password(db, user_id: str, new_password: str) -> bool:
        """Update a user's password with bcrypt hashing."""
        try:
            object_id = ObjectId(user_id)
        except Exception:
            return False

        hashed = hash_password(new_password)
        result = await db[USERS_COLLECTION].update_one(
            {"_id": object_id},
            {"$set": {"password": hashed, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count == 1
