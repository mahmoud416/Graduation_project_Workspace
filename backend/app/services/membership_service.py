"""
Membership service.
Handles team membership and role management.
"""
from typing import List, Dict, Any, Optional
from bson import ObjectId

from app.models.membership import MembershipModel, Role
from app.db.collections import MEMBERSHIPS_COLLECTION, USERS_COLLECTION


class MembershipService:
    """Service for membership management operations."""
    
    @staticmethod
    async def add_member(
        db,
        user_id: ObjectId,
        team_id: ObjectId,
        role: Role,
        managed_by: Optional[ObjectId] = None
    ) -> Dict[str, Any]:
        """
        Add a new member to a team.
        
        Args:
            db: Database instance
            user_id: User ObjectId to add
            team_id: Team ObjectId
            role: Member's role in the team
            managed_by: Optional Sub-Admin managing this member
            
        Returns:
            Created membership document
            
        Raises:
            ValueError: If user is already a member or user doesn't exist
        """
        # Check if user exists
        user = await db[USERS_COLLECTION].find_one({"_id": user_id})
        if not user:
            raise ValueError("User not found")
        
        # Check if membership already exists
        existing = await db[MEMBERSHIPS_COLLECTION].find_one({
            "user_id": user_id,
            "team_id": team_id
        })
        if existing:
            raise ValueError("User is already a member of this team")
        
        # Create membership document
        membership_doc = MembershipModel.create_document(
            user_id=user_id,
            team_id=team_id,
            role=role,
            managed_by=managed_by
        )
        
        # Insert membership
        result = await db[MEMBERSHIPS_COLLECTION].insert_one(membership_doc)
        membership_doc["_id"] = result.inserted_id
        
        return membership_doc
    
    @staticmethod
    async def get_team_members(db, team_id: ObjectId) -> List[Dict[str, Any]]:
        """
        Get all members of a team with their user details.
        
        Args:
            db: Database instance
            team_id: Team ObjectId
            
        Returns:
            List of membership documents with populated user data
        """
        # Get all memberships for the team
        memberships = await db[MEMBERSHIPS_COLLECTION].find({
            "team_id": team_id
        }).to_list(length=None)
        
        if not memberships:
            return []
        
        # Get user IDs
        user_ids = [m["user_id"] for m in memberships]
        
        # Fetch user details
        users = await db[USERS_COLLECTION].find({
            "_id": {"$in": user_ids}
        }).to_list(length=None)
        
        # Create user map
        user_map = {u["_id"]: u for u in users}
        
        # Populate user details in memberships
        for membership in memberships:
            user = user_map.get(membership["user_id"])
            if user:
                membership["user_email"] = user["email"]
                membership["user_full_name"] = user["full_name"]
        
        return memberships
    
    @staticmethod
    async def get_managed_members(
        db,
        team_id: ObjectId,
        subadmin_id: ObjectId
    ) -> List[Dict[str, Any]]:
        """
        Get all members managed by a specific Sub-Admin.
        
        Args:
            db: Database instance
            team_id: Team ObjectId
            subadmin_id: Sub-Admin User ObjectId
            
        Returns:
            List of membership documents
        """
        return await db[MEMBERSHIPS_COLLECTION].find({
            "team_id": team_id,
            "managed_by": subadmin_id
        }).to_list(length=None)
    
    @staticmethod
    async def update_member_role(
        db,
        user_id: ObjectId,
        team_id: ObjectId,
        new_role: Role,
        managed_by: Optional[ObjectId] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Update a member's role in a team.
        
        Args:
            db: Database instance
            user_id: User ObjectId
            team_id: Team ObjectId
            new_role: New role for the member
            managed_by: Optional new managing Sub-Admin
            
        Returns:
            Updated membership document or None if not found
        """
        update_data = {"role": new_role.value}
        if managed_by is not None:
            update_data["managed_by"] = managed_by
        
        result = await db[MEMBERSHIPS_COLLECTION].find_one_and_update(
            {"user_id": user_id, "team_id": team_id},
            {"$set": update_data},
            return_document=True
        )
        
        return result
    
    @staticmethod
    async def remove_member(
        db,
        user_id: ObjectId,
        team_id: ObjectId
    ) -> bool:
        """
        Remove a member from a team.
        
        Args:
            db: Database instance
            user_id: User ObjectId
            team_id: Team ObjectId
            
        Returns:
            True if removed, False if not found
        """
        result = await db[MEMBERSHIPS_COLLECTION].delete_one({
            "user_id": user_id,
            "team_id": team_id
        })
        
        return result.deleted_count > 0
