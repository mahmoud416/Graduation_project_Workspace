"""
MongoDB collection names and index definitions.
"""

# Collection names
USERS_COLLECTION            = "users"
TEAMS_COLLECTION            = "teams"
MEMBERSHIPS_COLLECTION      = "memberships"
TASKS_COLLECTION            = "tasks"
PROJECTS_COLLECTION         = "projects"
TASK_BOARDS_COLLECTION      = "task_boards"
COMMENTS_COLLECTION         = "comments"
FILES_COLLECTION            = "files"
FILE_UPLOAD_RULES_COLLECTION = "file_upload_rules"
NOTIFICATIONS_COLLECTION    = "notifications"
EVENTS_COLLECTION           = "events"


async def _safe_create_index(collection, keys, **kwargs):
    """
    Create an index safely.
    Silently skips if the index already exists with the same or compatible options.
    Raises on genuine failures (e.g. key conflict with different unique setting).
    """
    from pymongo.errors import OperationFailure
    try:
        await collection.create_index(keys, **kwargs)
    except OperationFailure as exc:
        # Code 85 = IndexOptionsConflict, code 86 = IndexKeySpecsConflict
        # Both mean the index already exists — safe to skip.
        if exc.code in (85, 86):
            pass
        else:
            raise


async def create_indexes(db):
    """
    Create database indexes for optimal query performance.
    Called once on application startup.
    Uses _safe_create_index to tolerate pre-existing indexes.
    """

    # users
    await _safe_create_index(db[USERS_COLLECTION], "email", unique=True)
    await _safe_create_index(db[USERS_COLLECTION], [("role", 1)])

    # memberships — compound unique per project
    await _safe_create_index(
        db[MEMBERSHIPS_COLLECTION],
        [("user_id", 1), ("project_id", 1)],
        unique=True
    )
    await _safe_create_index(db[MEMBERSHIPS_COLLECTION], "project_id")
    await _safe_create_index(db[MEMBERSHIPS_COLLECTION], "managed_by")

    # Legacy membership index (team_id) — already exists in DB, skip if conflicts
    await _safe_create_index(
        db[MEMBERSHIPS_COLLECTION],
        [("user_id", 1), ("team_id", 1)],
        unique=True
    )
    await _safe_create_index(db[MEMBERSHIPS_COLLECTION], "team_id")

    # tasks
    await _safe_create_index(db[TASKS_COLLECTION], [("project_id", 1), ("status", 1)])
    await _safe_create_index(db[TASKS_COLLECTION], [("project_id", 1), ("assigned_to", 1)])
    await _safe_create_index(db[TASKS_COLLECTION], [("project_id", 1), ("order", 1)])
    await _safe_create_index(db[TASKS_COLLECTION], "deadline")
    await _safe_create_index(db[TASKS_COLLECTION], "team_id")
    await _safe_create_index(db[TASKS_COLLECTION], "assigned_to")
    await _safe_create_index(db[TASKS_COLLECTION], "created_by")

    # projects
    await _safe_create_index(db[PROJECTS_COLLECTION], "owner_id")
    await _safe_create_index(db[PROJECTS_COLLECTION], "sub_admin_ids")
    await _safe_create_index(db[PROJECTS_COLLECTION], "staff_ids")
    await _safe_create_index(db[PROJECTS_COLLECTION], "type")

    # task_boards
    await _safe_create_index(db[TASK_BOARDS_COLLECTION], "project_id", unique=True)
    await _safe_create_index(db[TASK_BOARDS_COLLECTION], "members.user_id")

    # comments
    await _safe_create_index(
        db[COMMENTS_COLLECTION],
        [("project_id", 1), ("created_at", -1)]
    )
    await _safe_create_index(db[COMMENTS_COLLECTION], "task_id")
    await _safe_create_index(db[COMMENTS_COLLECTION], "author_id")

    # files
    await _safe_create_index(
        db[FILES_COLLECTION],
        [("project_id", 1), ("context", 1)]
    )
    await _safe_create_index(db[FILES_COLLECTION], "uploaded_by")

    # file_upload_rules — one doc per project
    await _safe_create_index(
        db[FILE_UPLOAD_RULES_COLLECTION],
        "project_id",
        unique=True
    )

    # notifications — TTL: auto-delete after 30 days
    await _safe_create_index(db[NOTIFICATIONS_COLLECTION], "user_id")
    await _safe_create_index(
        db[NOTIFICATIONS_COLLECTION],
        [("user_id", 1), ("is_read", 1)]
    )
    await _safe_create_index(
        db[NOTIFICATIONS_COLLECTION],
        "created_at",
        expireAfterSeconds=30 * 86400
    )

    # events
    await _safe_create_index(db[EVENTS_COLLECTION], [("date", 1)])
    await _safe_create_index(db[EVENTS_COLLECTION], "created_by")

    print("✓ Database indexes created")
