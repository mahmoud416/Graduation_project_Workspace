"""
MongoDB collection names and index definitions.
Centralizes collection naming for consistency.
"""

# Collection names
USERS_COLLECTION = "users"
TEAMS_COLLECTION = "teams"
MEMBERSHIPS_COLLECTION = "memberships"
TASKS_COLLECTION = "tasks"
PROJECTS_COLLECTION = "projects"
TASK_BOARDS_COLLECTION = "task_boards"


async def create_indexes(db):
    """
    Create database indexes for optimal query performance.
    Should be called once on application startup.
    
    Args:
        db: AsyncIOMotorDatabase instance
    """
    
    # Users collection indexes
    await db[USERS_COLLECTION].create_index("email", unique=True)
    
    # Memberships collection indexes
    # Compound index to ensure user can't join same team twice
    await db[MEMBERSHIPS_COLLECTION].create_index(
        [("user_id", 1), ("team_id", 1)],
        unique=True
    )
    await db[MEMBERSHIPS_COLLECTION].create_index("team_id")
    await db[MEMBERSHIPS_COLLECTION].create_index("managed_by")
    
    # Tasks collection indexes
    await db[TASKS_COLLECTION].create_index("team_id")
    await db[TASKS_COLLECTION].create_index("assigned_to")
    await db[TASKS_COLLECTION].create_index("created_by")

    # Projects collection indexes
    await db[PROJECTS_COLLECTION].create_index("owner_id")
    await db[PROJECTS_COLLECTION].create_index("sub_admin_id")
    await db[PROJECTS_COLLECTION].create_index("staff_ids")

    # Task boards collection indexes
    await db[TASK_BOARDS_COLLECTION].create_index("project_id", unique=True)
    await db[TASK_BOARDS_COLLECTION].create_index("members.user_id")
    
    print("✓ Database indexes created")
