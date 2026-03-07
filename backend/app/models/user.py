"""
User model for MongoDB.
Represents user accounts with authentication credentials.
"""
from datetime import datetime
from typing import Optional


class UserModel:
    """User document structure for MongoDB."""

    @staticmethod
    def create_document(
        email: str,
        password: str,
        full_name: str,
        role: str = "staff",
        admin_id: Optional[str] = None,
        sub_admin_id: Optional[str] = None,
        phone: Optional[str] = None,
        status: str = "active"
    ) -> dict:
        """Create a new user document. Password must already be hashed."""
        return {
            "email":        email.lower(),
            "password":     password,  # Must be bcrypt hash
            "name":         full_name,
            "role":         role or "staff",
            "admin_id":     admin_id,
            "sub_admin_id": sub_admin_id,
            "phone":        phone,
            "status":       status or "active",
            "created_at":   datetime.utcnow(),
            "last_login":   None,
            "is_active":    True,
        }
