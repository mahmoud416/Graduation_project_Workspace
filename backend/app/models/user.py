"""
User model for MongoDB.
Represents user accounts with authentication credentials.
"""
from datetime import datetime
from typing import Optional, List


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
        status: str = "active",
        roles: Optional[List[str]] = None
    ) -> dict:
        """Create a new user document. Password must already be hashed."""
        normalized_role = (role or "staff").strip().lower()
        role_list = roles or [normalized_role]
        deduped_roles = []
        for r in role_list:
            if not r:
                continue
            normalized = r.strip().lower()
            if normalized not in deduped_roles:
                deduped_roles.append(normalized)
        return {
            "email":        email.lower(),
            "password":     password,  # Must be bcrypt hash
            "name":         full_name,
            "role":         normalized_role,
            "roles":        deduped_roles or [normalized_role],
            "admin_id":     admin_id,
            "sub_admin_id": sub_admin_id,
            "phone":        phone,
            "status":       status or "active",
            "created_at":   datetime.utcnow(),
            "last_login":   None,
            "is_active":    True,
        }
