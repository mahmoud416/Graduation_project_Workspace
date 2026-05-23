# ClickUp-like SaaS Platform - Feature Extensions

This README documents the extensive feature upgrades built on top of the original task and team management system.

## 🚀 1. What Was Added (New Features)

- **Manager Role System**: A new `manager` role at the team membership level. A manager has full control over exactly ONE team (managing users, projects, and tasks) without affecting system-level roles (Admin/Sub-Admin).
- **Task System Enhancements**:
  - `assign_to_all`: Ability to assign a single task to all members of a team at once.
  - `template_id`: Links tasks to specific report templates.
  - `visibility`: Tasks can now be public (`team`) or restricted only to assigned users (`private`).
- **Task Creator Attribution**: Tasks now visually carry the creator's name (`creator_name`) and profile picture (`creator_avatar`).
- **User Profile & Portfolio**:
  - Profiles now support `avatar_url`, `bio`, and `department`.
  - Computed Portfolio: Dynamic generation of user stats (number of completed tasks, active projects, average AI quality accuracy).
- **AI Quality Control (QC) Scoring**:
  - The Gemini AI evaluation now outputs a strict `0-100` compliance score.
  - Scores are aggregated automatically to power user portfolios and team analytics.
- **Team Analytics System**:
  - Aggregation engine to compute `projects count`, `tasks count`, `average accuracy`, and `active users`.
  - Detailed drill-down per user.
  - Time-based filtering (`day`, `week`, `month`, `year`).

## 🔄 2. What Was Changed (Modified Files)

- **Task Creation Flow (`task_service.py` & `routes/tasks.py`)**: Modified to accept multi-assignees, process the `assign_to_all` flag, and extract creator details from the user database.
- **Task Model (`models/task.py` & `schemas/task.py`)**: Added fields for `assignees[]`, `visibility`, `template_id`, `assign_to_all`, `creator_name`, and `creator_avatar`.
- **Quality Analysis Service (`quality_analysis_service.py`)**: Modified the AI evaluation runner to extract the numerical score from Gemini and save it into the new `quality_scores` database collection.
- **Collections Indexing (`db/collections.py`)**: Added indexes for the new `quality_scores` collection to ensure fast aggregation queries.
- **FastAPI Registration (`main.py`)**: Registered the new routers (`profile`, `analytics`).
- **RBAC Dependencies (`dependencies/rbac.py`)**: Added Manager-specific rules (`require_team_manager_or_admin`) allowing full team control while isolating them from other teams.

## 🛡️ 3. What Was NOT Touched (Preserved Core)

To ensure the system remained completely stable, the following were **STRICTLY PRESERVED**:
- **Existing User Roles**: `admin`, `sub_admin`, and `staff` permissions remain completely unchanged.
- **Authentication**: JWT token generation, login, and registration flows (`auth_service.py`).
- **Core AI Evaluation Logic**: `qc_service.py` prompt structure and offline fallbacks were kept intact; we only added a wrapper to log the scores.
- **Frontend Core Components**: No existing UI layouts or design tokens were broken. New UI will just plug into the existing routing.

## 🔌 4. New APIs

### Profile & Portfolio
- `GET /api/v1/profile/me` - Fetch authenticated user profile.
- `PATCH /api/v1/profile/me` - Update profile (bio, avatar_url, department).
- `GET /api/v1/profile/{user_id}/portfolio` - Fetch user's computed stats and accuracy score.

### Analytics
- `GET /api/v1/analytics/team/{team_id}?period=month` - Fetch aggregated team stats (tasks, projects, active users, avg accuracy).
- `GET /api/v1/analytics/user/{user_id}?period=month` - Fetch individual user performance over time.

## 🗄️ 5. New DB Changes

### New Collections
- `quality_scores`: Stores individual AI compliance scores for tasks.
  - *Schema*: `task_id`, `user_id`, `team_id`, `project_id`, `score`, `verdict`, `created_at`.

### Updated Collections
- `tasks`: Added `assign_to_all`, `template_id`, `creator_name`, `creator_avatar`.
- `users`: Added `avatar_url`, `bio`, `department`.
- `memberships`: The `role` enum now officially supports `"manager"`. Note: This enables the Many-to-Many entity relationship where a user can have multiple membership documents across different teams.

## 🛠️ 6. How to Use New Features

1. **Assigning a Manager**: An Admin can invite a user to a team and set their membership role to `manager`. The manager will then have authority to add tasks, invite users to that specific team, and view the team's analytics.
2. **Assign to All**: When creating a task, set `"assign_to_all": true`. The backend will automatically expand the `assignees` array to include every user ID currently in the team.
3. **Viewing Portfolios**: Call the `/portfolio` endpoint with a user ID. It will instantly calculate their task completion rate and fetch their average AI score from the `quality_scores` table.
4. **Team Analytics**: Managers can hit the `/analytics/team/{id}` endpoint to get a snapshot of how many tasks are `IN_PROGRESS` (active users) and the team's overall quality accuracy over the last day, week, month, or year.

## 🤖 7. AI History

**What data is shown:**
The AI History section displays recent task evaluations that have an AI compliance score assigned. It shows the `Task Title`, `Task ID`, numerical `Score` (0-100), `Status`, and `Timestamp`.

**API Used:**
- `GET /api/v1/ai/history` - Fetches evaluated tasks history.

**Filtering logic:**
- Only tasks where `aiScore != null` are retrieved.
- Results are sorted by `updated_at` DESC.
- Output is limited to the most recent 10 items.
- Only tasks visible to the current user (based on created_by or assignees) are shown, unless the user has an `admin` or `founder` role.
