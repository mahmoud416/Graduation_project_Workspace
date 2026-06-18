"""
Team service.
Handles team CRUD operations.
"""
from typing import List, Dict, Any, Optional
from bson import ObjectId

from app.models.team import TeamModel
from app.models.membership import MembershipModel, Role
from app.db.collections import TEAMS_COLLECTION, MEMBERSHIPS_COLLECTION, TASKS_COLLECTION, PROJECTS_COLLECTION, USERS_COLLECTION


class TeamService:
    """Service for team management operations."""
    
    @staticmethod
    async def create_team(
        db,
        name: str,
        created_by_id: ObjectId,
        description: str = "",
        tenant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new team and add the creator as Admin.
        
        Args:
            db: Database instance
            name: Team name
            created_by_id: User ID of team creator
            description: Optional team description
            
        Returns:
            Created team document
        """
        # Create team document
        team_doc = TeamModel.create_document(
            name=name,
            created_by=created_by_id,
            description=description
        )
        team_doc["tenant_id"] = tenant_id

        # Insert team
        result = await db[TEAMS_COLLECTION].insert_one(team_doc)
        team_doc["_id"] = result.inserted_id
        
        # Add creator as Admin
        membership_doc = MembershipModel.create_document(
            user_id=created_by_id,
            team_id=team_doc["_id"],
            role=Role.ADMIN
        )
        await db[MEMBERSHIPS_COLLECTION].insert_one(membership_doc)
        
        return team_doc
    
    @staticmethod
    async def get_team(db, team_id: ObjectId) -> Optional[Dict[str, Any]]:
        """
        Get team by ID.
        
        Args:
            db: Database instance
            team_id: Team ObjectId
            
        Returns:
            Team document or None if not found
        """
        team = await db[TEAMS_COLLECTION].find_one({"_id": team_id})
        if team:
            team["memberCount"] = await db[MEMBERSHIPS_COLLECTION].count_documents({"team_id": team_id})
        return team
    
    @staticmethod
    async def list_user_teams(db, user_id: ObjectId) -> List[Dict[str, Any]]:
        """
        List all teams a user belongs to.
        
        Args:
            db: Database instance
            user_id: User ObjectId
            
        Returns:
            List of team documents with user's role
        """
        # Find all memberships for the user
        memberships = await db[MEMBERSHIPS_COLLECTION].find({
            "user_id": user_id
        }).to_list(length=None)
        
        if not memberships:
            return []
        
        # Get team IDs
        team_ids = [m["team_id"] for m in memberships]
        
        # Fetch teams
        teams = await db[TEAMS_COLLECTION].find({
            "_id": {"$in": team_ids}
        }).to_list(length=None)
        
        # Add user's role and member count to each team
        membership_map = {m["team_id"]: m["role"] for m in memberships}
        for team in teams:
            tid = team["_id"]
            team["user_role"] = membership_map.get(tid)
            team["memberCount"] = await db[MEMBERSHIPS_COLLECTION].count_documents({"team_id": tid})

            # Manager name — first MANAGER or ADMIN membership joined
            mgr_mem = await db[MEMBERSHIPS_COLLECTION].find_one(
                {"team_id": tid, "role": {"$in": ["manager", "admin"]}},
            )
            if mgr_mem:
                mgr_user = await db[USERS_COLLECTION].find_one({"_id": mgr_mem["user_id"]})
                team["manager_name"] = (
                    (mgr_user.get("full_name") or mgr_user.get("name")) if mgr_user else None
                )
            else:
                team["manager_name"] = None

            # Active project count + last activity from projects assigned to this team
            team_projects = await db[PROJECTS_COLLECTION].find(
                {"team_id": tid, "is_system_card": {"$ne": True}}
            ).to_list(length=None)
            active = [p for p in team_projects if (p.get("status") or "").upper() == "ACTIVE"]
            team["active_project_count"] = len(active)
            activities = [p["updated_at"] for p in team_projects if p.get("updated_at")]
            team["last_activity"] = max(activities) if activities else None
            team["status"] = "active" if active else ("inactive" if team_projects else "empty")

        return teams
    
    @staticmethod
    async def update_team(
        db,
        team_id: ObjectId,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Update team information.
        
        Args:
            db: Database instance
            team_id: Team ObjectId
            name: Optional new team name
            description: Optional new description
            
        Returns:
            Updated team document or None if not found
        """
        update_data = {}
        if name is not None:
            update_data["name"] = name
        if description is not None:
            update_data["description"] = description
        
        if not update_data:
            return await TeamService.get_team(db, team_id)
        
        result = await db[TEAMS_COLLECTION].find_one_and_update(
            {"_id": team_id},
            {"$set": update_data},
            return_document=True
        )
        
        return result
    
    @staticmethod
    async def delete_team(db, team_id: ObjectId) -> bool:
        """
        Delete a team and all related data (memberships and tasks).
        
        Args:
            db: Database instance
            team_id: Team ObjectId
            
        Returns:
            True if deleted, False if not found
        """
        # Delete team
        result = await db[TEAMS_COLLECTION].delete_one({"_id": team_id})
        if result.deleted_count == 0:
            return False
        
        # Delete all memberships
        await db[MEMBERSHIPS_COLLECTION].delete_many({"team_id": team_id})
        
        # Delete all tasks
        await db[TASKS_COLLECTION].delete_many({"team_id": team_id})
        
        return True
