"""
Task service.
Handles task CRUD operations with RBAC enforcement.
"""
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime

from app.models.task import TaskModel, TaskStatus, TaskPriority
from app.db.collections import TASKS_COLLECTION, USERS_COLLECTION, TEAMS_COLLECTION, MEMBERSHIPS_COLLECTION


class TaskService:
    """Service for task management operations."""
    
    @staticmethod
    async def create_task(
        db,
        title: str,
        team_id: ObjectId,
        assigned_to: ObjectId,
        created_by: ObjectId,
        description: str = "",
        status: TaskStatus = TaskStatus.TODO,
        priority: TaskPriority = TaskPriority.MEDIUM
    ) -> Dict[str, Any]:
        """
        Create a new task.
        
        Args:
            db: Database instance
            title: Task title
            team_id: Team ObjectId
            assigned_to: User ObjectId to assign the task
            created_by: User ObjectId creating the task
            description: Task description
            status: Initial status
            priority: Task priority
            
        Returns:
            Created task document
            
        Raises:
            ValueError: If assignee is not a member of the team
        """
        # Verify assignee is a member of the team
        assignee_membership = await db[MEMBERSHIPS_COLLECTION].find_one({
            "user_id": assigned_to,
            "team_id": team_id
        })
        if not assignee_membership:
            raise ValueError("Assigned user is not a member of this team")
        
        # Create task document
        task_doc = TaskModel.create_document(
            title=title,
            team_id=team_id,
            assigned_to=assigned_to,
            created_by=created_by,
            description=description,
            status=status,
            priority=priority
        )
        
        # Insert task
        result = await db[TASKS_COLLECTION].insert_one(task_doc)
        task_doc["_id"] = result.inserted_id
        
        return task_doc
    
    @staticmethod
    async def get_task(db, task_id: ObjectId) -> Optional[Dict[str, Any]]:
        """
        Get task by ID.
        
        Args:
            db: Database instance
            task_id: Task ObjectId
            
        Returns:
            Task document or None if not found
        """
        return await db[TASKS_COLLECTION].find_one({"_id": task_id})
    
    @staticmethod
    async def list_tasks(
        db,
        filter_criteria: Dict[str, Any],
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        List tasks matching filter criteria.
        
        Args:
            db: Database instance
            filter_criteria: MongoDB filter (from RBAC dependency)
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            
        Returns:
            List of task documents
        """
        tasks = await db[TASKS_COLLECTION].find(
            filter_criteria
        ).skip(skip).limit(limit).to_list(length=limit)
        
        # Populate related data
        for task in tasks:
            # Get assignee name
            assignee = await db[USERS_COLLECTION].find_one({"_id": task["assigned_to"]})
            if assignee:
                task["assigned_to_name"] = assignee["full_name"]
            
            # Get creator name
            creator = await db[USERS_COLLECTION].find_one({"_id": task["created_by"]})
            if creator:
                task["created_by_name"] = creator["full_name"]
            
            # Get team name
            team = await db[TEAMS_COLLECTION].find_one({"_id": task["team_id"]})
            if team:
                task["team_name"] = team["name"]
        
        return tasks
    
    @staticmethod
    async def update_task(
        db,
        task_id: ObjectId,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Update task information.
        
        Args:
            db: Database instance
            task_id: Task ObjectId
            title: Optional new title
            description: Optional new description
            status: Optional new status
            priority: Optional new priority
            
        Returns:
            Updated task document or None if not found
        """
        update_data = {"updated_at": datetime.utcnow()}
        
        if title is not None:
            update_data["title"] = title
        if description is not None:
            update_data["description"] = description
        if status is not None:
            update_data["status"] = status.value
        if priority is not None:
            update_data["priority"] = priority.value
        
        result = await db[TASKS_COLLECTION].find_one_and_update(
            {"_id": task_id},
            {"$set": update_data},
            return_document=True
        )
        
        return result
    
    @staticmethod
    async def assign_task(
        db,
        task_id: ObjectId,
        assigned_to: ObjectId,
        team_id: ObjectId
    ) -> Optional[Dict[str, Any]]:
        """
        Reassign a task to a different user.
        
        Args:
            db: Database instance
            task_id: Task ObjectId
            assigned_to: New assignee User ObjectId
            team_id: Team ObjectId for validation
            
        Returns:
            Updated task document or None if not found
            
        Raises:
            ValueError: If new assignee is not a member of the team
        """
        # Verify new assignee is a member of the team
        assignee_membership = await db[MEMBERSHIPS_COLLECTION].find_one({
            "user_id": assigned_to,
            "team_id": team_id
        })
        if not assignee_membership:
            raise ValueError("Assigned user is not a member of this team")
        
        result = await db[TASKS_COLLECTION].find_one_and_update(
            {"_id": task_id},
            {"$set": {
                "assigned_to": assigned_to,
                "updated_at": datetime.utcnow()
            }},
            return_document=True
        )
        
        return result
    
    @staticmethod
    async def delete_task(db, task_id: ObjectId) -> bool:
        """
        Delete a task.
        
        Args:
            db: Database instance
            task_id: Task ObjectId
            
        Returns:
            True if deleted, False if not found
        """
        result = await db[TASKS_COLLECTION].delete_one({"_id": task_id})
        return result.deleted_count > 0
