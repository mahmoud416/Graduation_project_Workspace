"""
Membership management API routes.
Handles adding/removing team members and role management.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from typing import List

from app.schemas.membership import MembershipCreate, MembershipUpdate, MembershipResponse
from app.services.membership_service import MembershipService
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_team_admin, require_team_member, can_manage_user
from app.db.mongodb import get_database
from app.models.membership import Role


router = APIRouter(prefix="/teams/{team_id}/members", tags=["Memberships"])


@router.post("", response_model=MembershipResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    team_id: str,
    member_data: MembershipCreate,
    membership = Depends(require_team_admin),
    db = Depends(get_database)
):
    """
    Add a new member to the team.
    
    Requires: Admin role in the team.
    
    - Admin can add members with any role
    - If adding a Member with a Sub-Admin manager, specify `managed_by`
    """
    try:
        team_obj_id = ObjectId(team_id)
        user_obj_id = ObjectId(member_data.user_id)
        managed_by_obj_id = ObjectId(member_data.managed_by) if member_data.managed_by else None
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    try:
        new_membership = await MembershipService.add_member(
            db,
            user_id=user_obj_id,
            team_id=team_obj_id,
            role=member_data.role,
            managed_by=managed_by_obj_id
        )
        
        # Convert ObjectIds to strings
        new_membership["_id"] = str(new_membership["_id"])
        new_membership["user_id"] = str(new_membership["user_id"])
        new_membership["team_id"] = str(new_membership["team_id"])
        if new_membership.get("managed_by"):
            new_membership["managed_by"] = str(new_membership["managed_by"])
        
        return new_membership
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=List[MembershipResponse])
async def list_members(
    team_id: str,
    membership = Depends(require_team_member),
    db = Depends(get_database)
):
    """
    List all members of the team.
    
    Requires: Team membership (any role).
    """
    try:
        team_obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID format"
        )
    
    members = await MembershipService.get_team_members(db, team_obj_id)
    
    # Convert ObjectIds to strings
    for member in members:
        member["_id"] = str(member["_id"])
        member["user_id"] = str(member["user_id"])
        member["team_id"] = str(member["team_id"])
        if member.get("managed_by"):
            member["managed_by"] = str(member["managed_by"])
    
    return members


@router.put("/{user_id}", response_model=MembershipResponse)
async def update_member_role(
    team_id: str,
    user_id: str,
    update_data: MembershipUpdate,
    membership = Depends(require_team_admin),
    db = Depends(get_database)
):
    """
    Update a member's role in the team.
    
    Requires: Admin role in the team.
    """
    try:
        team_obj_id = ObjectId(team_id)
        user_obj_id = ObjectId(user_id)
        managed_by_obj_id = ObjectId(update_data.managed_by) if update_data.managed_by else None
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    updated_membership = await MembershipService.update_member_role(
        db,
        user_id=user_obj_id,
        team_id=team_obj_id,
        new_role=update_data.role,
        managed_by=managed_by_obj_id
    )
    
    if not updated_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    
    # Convert ObjectIds to strings
    updated_membership["_id"] = str(updated_membership["_id"])
    updated_membership["user_id"] = str(updated_membership["user_id"])
    updated_membership["team_id"] = str(updated_membership["team_id"])
    if updated_membership.get("managed_by"):
        updated_membership["managed_by"] = str(updated_membership["managed_by"])
    
    return updated_membership


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    team_id: str,
    user_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Remove a member from the team.
    
    Requires:
    - Admin: Can remove anyone
    - Sub-Admin: Can remove members they manage
    """
    try:
        team_obj_id = ObjectId(team_id)
        user_obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Check if current user can manage the target user
    await can_manage_user(team_id, user_id, current_user, db)
    
    removed = await MembershipService.remove_member(db, user_obj_id, team_obj_id)
    
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    
    return None
