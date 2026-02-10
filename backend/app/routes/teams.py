"""
Team management API routes.
Handles team CRUD operations with RBAC enforcement.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from typing import List

from app.schemas.team import TeamCreate, TeamUpdate, TeamResponse
from app.services.team_service import TeamService
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_team_admin, require_team_member
from app.db.mongodb import get_database


router = APIRouter(prefix="/teams", tags=["Teams"])


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a new team.
    
    The creating user automatically becomes the team Admin.
    """
    team = await TeamService.create_team(
        db,
        name=team_data.name,
        created_by_id=current_user["_id"],
        description=team_data.description
    )
    
    # Convert ObjectIds to strings
    team["_id"] = str(team["_id"])
    team["created_by"] = str(team["created_by"])
    
    return team


@router.get("", response_model=List[TeamResponse])
async def list_my_teams(
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    List all teams the current user belongs to.
    
    Returns teams with the user's role in each team.
    """
    teams = await TeamService.list_user_teams(db, current_user["_id"])
    
    # Convert ObjectIds to strings
    for team in teams:
        team["_id"] = str(team["_id"])
        team["created_by"] = str(team["created_by"])
    
    return teams


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    membership = Depends(require_team_member),
    db = Depends(get_database)
):
    """
    Get team details.
    
    Requires: User must be a member of the team.
    """
    try:
        team_obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID format"
        )
    
    team = await TeamService.get_team(db, team_obj_id)
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Convert ObjectIds to strings
    team["_id"] = str(team["_id"])
    team["created_by"] = str(team["created_by"])
    
    return team


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    team_data: TeamUpdate,
    membership = Depends(require_team_admin),
    db = Depends(get_database)
):
    """
    Update team information.
    
    Requires: Admin role in the team.
    """
    try:
        team_obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID format"
        )
    
    team = await TeamService.update_team(
        db,
        team_obj_id,
        name=team_data.name,
        description=team_data.description
    )
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Convert ObjectIds to strings
    team["_id"] = str(team["_id"])
    team["created_by"] = str(team["created_by"])
    
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: str,
    membership = Depends(require_team_admin),
    db = Depends(get_database)
):
    """
    Delete a team and all related data (memberships and tasks).
    
    Requires: Admin role in the team.
    
    **Warning**: This action is irreversible!
    """
    try:
        team_obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID format"
        )
    
    deleted = await TeamService.delete_team(db, team_obj_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    return None
