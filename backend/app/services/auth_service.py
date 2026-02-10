"""
Authentication service.
Handles user registration and login with a simple tokenless flow.
"""
from typing import Optional, Dict, Any
from bson import ObjectId

from app.core.security import verify_password
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
        role: str | None = "staff",
        admin_id: str | None = None,
        sub_admin_id: str | None = None,
        phone: str | None = None,
        status: str | None = "active"
    ) -> Dict[str, Any]:
        """
        Register a new user.
        
        Args:
            db: Database instance
            email: User's email address
            password: Plain text password
            full_name: User's full name
            role: Role string (admin / sub_admin / staff)
            admin_id: Optional admin identifier
            sub_admin_id: Optional sub-admin identifier
            phone: Optional phone number
            status: Account status
            
        Returns:
            Created user document
            
        Raises:
            ValueError: If email already exists
        """
        # Check if email already exists
        existing_user = await db[USERS_COLLECTION].find_one({"email": email.lower()})
        if existing_user:
            raise ValueError("Email already registered")
        
        # Create user document (password stored as-is per requirements)
        user_doc = UserModel.create_document(
            email=email,
            password=password,
            full_name=full_name,
            role=role or "staff",
            admin_id=admin_id,
            sub_admin_id=sub_admin_id,
            phone=phone,
            status=status or "active"
        )
        
        # Insert into database
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
        Authenticate a user with email and password.
        
        Args:
            db: Database instance
            email: User's email address
            password: Plain text password
            
        Returns:
            User document if authentication successful, None otherwise
        """
        # Find user by email
        user = await db[USERS_COLLECTION].find_one({"email": email.lower()})
        if not user:
            return None
        
        # Verify password (plain comparison)
        if not verify_password(password, user.get("password", "")):
            return None
        
        return user
