"""
Task management API routes.
Handles task CRUD operations with RBAC-based visibility filtering.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from typing import List, Optional

from app.schemas.task import TaskCreate, TaskUpdate, TaskAssign, TaskResponse
from app.services.task_service import TaskService
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_team_member, filter_visible_tasks
from app.db.mongodb import get_database
from app.models.membership import Role


router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a new task.
    
    Requires: Team membership.
    
    The assigned user must be a member of the specified team.
    """
    try:
        team_obj_id = ObjectId(task_data.team_id)
        assigned_to_obj_id = ObjectId(task_data.assigned_to)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Verify current user is a member of the team
    await require_team_member(task_data.team_id, current_user, db)
    
    try:
        task = await TaskService.create_task(
            db,
            title=task_data.title,
            team_id=team_obj_id,
            assigned_to=assigned_to_obj_id,
            created_by=current_user["_id"],
            description=task_data.description,
            status=task_data.status,
            priority=task_data.priority
        )
        
        # Convert ObjectIds to strings
        task["_id"] = str(task["_id"])
        task["team_id"] = str(task["team_id"])
        task["assigned_to"] = str(task["assigned_to"])
        task["created_by"] = str(task["created_by"])
        
        return task
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    team_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    List tasks with RBAC filtering.
    
    Task visibility based on role:
    - **Admin**: All tasks in the team
    - **Sub-Admin**: Tasks of users they manage
    - **Member**: Only their own tasks
    
    Query parameters:
    - team_id: Filter by team (required)
    - skip: Number of records to skip (pagination)
    - limit: Maximum records to return (1-100)
    """
    # Get RBAC filter for visible tasks
    task_filter = await filter_visible_tasks(team_id, current_user, db)
    
    tasks = await TaskService.list_tasks(db, task_filter, skip, limit)
    
    # Convert ObjectIds to strings
    for task in tasks:
        task["_id"] = str(task["_id"])
        task["team_id"] = str(task["team_id"])
        task["assigned_to"] = str(task["assigned_to"])
        task["created_by"] = str(task["created_by"])
    
    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get task details.
    
    Visibility check: User can only view tasks they have access to based on their role.
    """
    try:
        task_obj_id = ObjectId(task_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task ID format"
        )
    
    task = await TaskService.get_task(db, task_obj_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check if user has access to this task
    team_id_str = str(task["team_id"])
    task_filter = await filter_visible_tasks(team_id_str, current_user, db)
    
    # Verify task matches visibility filter
    task_filter["_id"] = task_obj_id
    visible_task = await db.tasks.find_one(task_filter)
    
    if not visible_task:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this task"
        )
    
    # Convert ObjectIds to strings
    task["_id"] = str(task["_id"])
    task["team_id"] = str(task["team_id"])
    task["assigned_to"] = str(task["assigned_to"])
    task["created_by"] = str(task["created_by"])
    
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_data: TaskUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Update task information.
    
    Permissions:
    - Task creator can update their tasks
    - Task assignee can update status/priority
    - Team Admin can update any task
    """
    try:
        task_obj_id = ObjectId(task_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task ID format"
        )
    
    # Get task
    task = await TaskService.get_task(db, task_obj_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check permissions: creator, assignee, or admin can update
    team_id_str = str(task["team_id"])
    task_filter = await filter_visible_tasks(team_id_str, current_user, db)
    task_filter["_id"] = task_obj_id
    
    visible_task = await db.tasks.find_one(task_filter)
    
    if not visible_task:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task"
        )
    
    # Update task
    updated_task = await TaskService.update_task(
        db,
        task_obj_id,
        title=task_data.title,
        description=task_data.description,
        status=task_data.status,
        priority=task_data.priority
    )
    
    # Convert ObjectIds to strings
    updated_task["_id"] = str(updated_task["_id"])
    updated_task["team_id"] = str(updated_task["team_id"])
    updated_task["assigned_to"] = str(updated_task["assigned_to"])
    updated_task["created_by"] = str(updated_task["created_by"])
    
    return updated_task


@router.patch("/{task_id}/assign", response_model=TaskResponse)
async def assign_task(
    task_id: str,
    assign_data: TaskAssign,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Reassign a task to a different user.
    
    Requires: Admin or Sub-Admin managing the current/new assignee.
    """
    try:
        task_obj_id = ObjectId(task_id)
        new_assignee_obj_id = ObjectId(assign_data.assigned_to)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Get task
    task = await TaskService.get_task(db, task_obj_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Only Admin or managing Sub-Admin can reassign
    team_id_str = str(task["team_id"])
    membership = await require_team_member(team_id_str, current_user, db)
    
    if membership["role"] not in [Role.ADMIN, Role.SUBADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or Sub-Admin can reassign tasks"
        )
    
    try:
        updated_task = await TaskService.assign_task(
            db,
            task_obj_id,
            new_assignee_obj_id,
            ObjectId(team_id_str)
        )
        
        if not updated_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Convert ObjectIds to strings
        updated_task["_id"] = str(updated_task["_id"])
        updated_task["team_id"] = str(updated_task["team_id"])
        updated_task["assigned_to"] = str(updated_task["assigned_to"])
        updated_task["created_by"] = str(updated_task["created_by"])
        
        return updated_task
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Delete a task.
    
    Requires: Task creator or Team Admin.
    """
    try:
        task_obj_id = ObjectId(task_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task ID format"
        )
    
    # Get task
    task = await TaskService.get_task(db, task_obj_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check permissions: creator or admin can delete
    team_id_str = str(task["team_id"])
    membership = await require_team_member(team_id_str, current_user, db)
    
    is_creator = task["created_by"] == current_user["_id"]
    is_admin = membership["role"] == Role.ADMIN
    
    if not (is_creator or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only task creator or team admin can delete tasks"
        )
    
    deleted = await TaskService.delete_task(db, task_obj_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    return None
