"""
Role-Based Access Control (RBAC) dependencies.
Enforces permissions based on user roles within teams.
"""
from fastapi import Depends, HTTPException, status
from bson import ObjectId
from typing import Dict, Any, List, Optional

from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database
from app.db.collections import MEMBERSHIPS_COLLECTION, TASKS_COLLECTION
from app.models.membership import Role


async def get_user_membership(
    team_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_database)
) -> Dict[str, Any]:
    """
    Get user's membership in a specific team.
    
    Args:
        team_id: Team ID to check
        current_user: Current authenticated user
        db: Database instance
        
    Returns:
        Membership document
        
    Raises:
        HTTPException 403: If user is not a member of the team
    """
    try:
        team_obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID format"
        )
    
    membership = await db[MEMBERSHIPS_COLLECTION].find_one({
        "user_id": current_user["_id"],
        "team_id": team_obj_id
    })
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )
    
    return membership


async def require_team_member(
    team_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_database)
) -> Dict[str, Any]:
    """
    Ensure current user is a member of the team.
    
    Args:
        team_id: Team ID to check
        current_user: Current authenticated user
        db: Database instance
        
    Returns:
        Membership document
    """
    return await get_user_membership(team_id, current_user, db)


async def require_team_admin(
    team_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_database)
) -> Dict[str, Any]:
    """
    Ensure current user is an Admin of the team.
    
    Args:
        team_id: Team ID to check
        current_user: Current authenticated user
        db: Database instance
        
    Returns:
        Membership document
        
    Raises:
        HTTPException 403: If user is not an admin
    """
    membership = await get_user_membership(team_id, current_user, db)
    
    if membership["role"] != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this action"
        )
    
    return membership


async def can_manage_user(
    team_id: str,
    target_user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_database)
) -> bool:
    """
    Check if current user can manage the target user.
    
    Admin can manage anyone.
    Sub-Admin can manage only their assigned members.
    
    Args:
        team_id: Team ID
        target_user_id: User ID to be managed
        current_user: Current authenticated user
        db: Database instance
        
    Returns:
        True if user can manage target user
        
    Raises:
        HTTPException 403: If user cannot manage target user
    """
    try:
        team_obj_id = ObjectId(team_id)
        target_obj_id = ObjectId(target_user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Get current user's membership
    current_membership = await get_user_membership(team_id, current_user, db)
    
    # Admins can manage anyone
    if current_membership["role"] == Role.ADMIN:
        return True
    
    # Sub-Admins can only manage their assigned members
    if current_membership["role"] == Role.SUBADMIN:
        target_membership = await db[MEMBERSHIPS_COLLECTION].find_one({
            "user_id": target_obj_id,
            "team_id": team_obj_id
        })
        
        if not target_membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user is not a member of this team"
            )
        
        # Check if this member is managed by the current sub-admin
        if target_membership.get("managed_by") == current_user["_id"]:
            return True
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have permission to manage this user"
    )


async def filter_visible_tasks(
    team_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_database)
) -> Dict[str, Any]:
    """
    Build MongoDB filter for tasks visible to the current user based on their role.
    
    - Admin: All tasks in the team
    - Sub-Admin: Tasks assigned to users they manage
    - Member: Only their own tasks
    
    Args:
        team_id: Team ID to filter tasks for
        current_user: Current authenticated user
        db: Database instance
        
    Returns:
        Dictionary with MongoDB filter criteria
    """
    try:
        team_obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID format"
        )
    
    membership = await get_user_membership(team_id, current_user, db)
    
    # Base filter: tasks in this team
    base_filter = {"team_id": team_obj_id}
    
    # Admin sees all tasks in the team
    if membership["role"] == Role.ADMIN:
        return base_filter
    
    # Sub-Admin sees tasks of users they manage
    if membership["role"] == Role.SUBADMIN:
        # Find all members managed by this sub-admin
        managed_memberships = await db[MEMBERSHIPS_COLLECTION].find({
            "team_id": team_obj_id,
            "managed_by": current_user["_id"]
        }).to_list(length=None)
        
        managed_user_ids = [m["user_id"] for m in managed_memberships]
        
        # Include tasks assigned to managed users
        base_filter["assigned_to"] = {"$in": managed_user_ids}
        return base_filter
    
    # Member sees only their own tasks
    base_filter["assigned_to"] = current_user["_id"]
    return base_filter
