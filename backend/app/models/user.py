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
        sub_manager_id: Optional[str] = None,
        phone: Optional[str] = None,
        status: str = "active"
    ) -> dict:
        """Create a new user document. Password must already be hashed."""
        return {
            "email":         email.lower(),
            "password":      password,  # Must be bcrypt hash
            "name":          full_name,
            "role":          role or "staff",
            "admin_id":      admin_id,
            "sub_manager_id":  sub_manager_id,
            "phone":         phone,
            "status":        status or "active",
            "created_at":    datetime.utcnow(),
            "last_login":    None,
            "last_seen":     None,
            # Ordered list of login timestamps for the IT oversight layer.
            # Capped at 50 entries via $slice in AuthService — oldest entries
            # are dropped automatically, so the array never grows unbounded.
            "login_history": [],
            "is_active":     True,
        }
