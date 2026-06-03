"""
Analytics API routes — team-level analytics with drill-down.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from bson import ObjectId

from app.dependencies.auth import get_current_user
from app.dependencies.rbac import require_team_member
from app.db.mongodb import get_database
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post("/seed-demo")
async def seed_demo(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Seed the database with enterprise demo data.
    Idempotent — safe to call multiple times; only seeds when data is insufficient.
    Accessible to any authenticated user (frontend auto-calls when dashboards are empty).
    """
    from app.services.seed_service import seed_demo_data
    result = await seed_demo_data(db)
    return result


@router.get("/platform-overview")
async def get_platform_overview(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Comprehensive platform overview for all dashboard roles.
    Returns aggregated KPIs, project health, team stats, quality metrics, and activity.
    Auto-seeds demo data if the platform is empty.
    """
    from datetime import datetime, timedelta
    from app.db.collections import (
        PROJECTS_COLLECTION, TASKS_COLLECTION, USERS_COLLECTION,
        QUALITY_SCORES_COLLECTION, QUALITY_EVALUATIONS_COLLECTION,
        QUALITY_ANALYSES_COLLECTION, AUDIT_LOGS_COLLECTION,
        COMMENTS_COLLECTION, FILES_COLLECTION, EVENTS_COLLECTION,
    )
    from app.services.seed_service import seed_demo_data

    # Auto-seed if empty
    user_count = await db[USERS_COLLECTION].count_documents({})
    if user_count < 5:
        await seed_demo_data(db)

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    def _dt(v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.replace(tzinfo=None) if v.tzinfo else v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                return None
        return None

    def _iso(v):
        return v.isoformat() if isinstance(v, datetime) else v

    # Fetch core collections
    all_projects = await db[PROJECTS_COLLECTION].find({}).to_list(None)
    real_projects = [p for p in all_projects if not p.get("is_system_card") and str(p.get("_id")) not in ("public-group", "all-sub-admin")]

    all_tasks     = await db[TASKS_COLLECTION].find({}).to_list(None)
    all_users     = await db[USERS_COLLECTION].find({}).to_list(None)
    qs_docs       = await db[QUALITY_SCORES_COLLECTION].find({}).to_list(None)
    qe_docs       = await db[QUALITY_EVALUATIONS_COLLECTION].find({}).to_list(None)
    audit_logs    = await db[AUDIT_LOGS_COLLECTION].find({}).sort("timestamp", -1).limit(50).to_list(50)
    comment_count = await db[COMMENTS_COLLECTION].count_documents({})
    file_count    = await db[FILES_COLLECTION].count_documents({})
    event_count   = await db[EVENTS_COLLECTION].count_documents({})

    # Project KPIs
    active_p    = [p for p in real_projects if p.get("status", "").upper() == "ACTIVE"]
    completed_p = [p for p in real_projects if p.get("status", "").upper() == "COMPLETED"]
    on_hold_p   = [p for p in real_projects if p.get("status", "").upper() == "ON_HOLD"]
    avg_prog    = round(sum(p.get("progress", 0) for p in real_projects) / max(len(real_projects), 1))

    overdue_p = [
        p for p in real_projects
        if _dt(p.get("due_date")) and _dt(p.get("due_date")) < today_start
        and p.get("status", "").upper() != "COMPLETED"
    ]

    # Task KPIs
    done_tasks = [t for t in all_tasks if t.get("status") == "DONE"]
    active_tasks = [t for t in all_tasks if t.get("status") not in ("DONE",)]
    overdue_tasks = [
        t for t in active_tasks
        if _dt(t.get("deadline")) and _dt(t.get("deadline")) < today_start
    ]
    tasks_today = [
        t for t in active_tasks
        if _dt(t.get("deadline")) and today_start <= _dt(t.get("deadline")) < today_start + timedelta(days=1)
    ]

    # User KPIs
    online_users = [
        u for u in all_users
        if _dt(u.get("last_seen")) and (now - _dt(u.get("last_seen"))).total_seconds() < 600
    ]

    # Quality KPIs
    total_qa   = len(qs_docs)
    pass_qa    = sum(1 for q in qs_docs if (q.get("score") or 0) >= 85)
    ai_pass_rt = round(pass_qa / max(total_qa, 1) * 100, 1)
    avg_score  = round(sum(q.get("score", 0) for q in qs_docs) / max(total_qa, 1), 1)

    # Workspace health
    completion_rate = round(len(completed_p) / max(len(real_projects), 1) * 100)
    health_score = min(100, round(
        completion_rate * 0.35 +
        avg_prog * 0.35 +
        ai_pass_rt * 0.30
    ))

    # Project progress trend (last 12 months)
    progress_trend = []
    for i in range(11, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        month_label = month_start.strftime("%b")
        month_projs = [
            p for p in real_projects
            if _dt(p.get("created_at")) and _dt(p.get("created_at")) <= month_start + timedelta(days=31)
        ]
        avg_p = round(sum(p.get("progress", 0) for p in month_projs) / max(len(month_projs), 1)) if month_projs else 0
        progress_trend.append({"month": month_label, "progress": avg_p, "count": len(month_projs)})

    # Team productivity (tasks done per team)
    team_task_map: dict = {}
    for t in done_tasks:
        tid = str(t.get("team_id", "general"))
        team_task_map[tid] = team_task_map.get(tid, 0) + 1

    # Task status distribution
    status_dist = {
        "todo":        sum(1 for t in all_tasks if t.get("status") == "TODO"),
        "in_progress": sum(1 for t in all_tasks if t.get("status") == "IN_PROGRESS"),
        "review":      sum(1 for t in all_tasks if t.get("status") == "REVIEW"),
        "done":        len(done_tasks),
        "overdue":     len(overdue_tasks),
    }

    # User activity (last 7 days)
    user_activity = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        day_e = day + timedelta(days=1)
        day_logs = [
            l for l in audit_logs
            if _dt(l.get("timestamp") or l.get("created_at")) and
               day <= _dt(l.get("timestamp") or l.get("created_at")) < day_e
        ]
        user_activity.append({
            "day": day.strftime("%a"),
            "actions": len(day_logs),
            "date": day.strftime("%Y-%m-%d"),
        })

    # AI quality score trend (last 7 days)
    ai_trend = []
    for i in range(6, -1, -1):
        day_s = today_start - timedelta(days=i)
        day_e = day_s + timedelta(days=1)
        day_qs = [q for q in qs_docs if _dt(q.get("created_at")) and day_s <= _dt(q.get("created_at")) < day_e]
        ai_trend.append({
            "day": day_s.strftime("%a"),
            "score": round(sum(q.get("score", 0) for q in day_qs) / len(day_qs), 1) if day_qs else None,
            "count": len(day_qs),
        })

    # Monthly performance (tasks completed per month, last 6 months)
    monthly_perf = []
    for i in range(5, -1, -1):
        month_s = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        month_e = month_s + timedelta(days=32)
        month_e = month_e.replace(day=1)
        month_done = [t for t in done_tasks if _dt(t.get("updated_at")) and month_s <= _dt(t.get("updated_at")) < month_e]
        month_qa   = [q for q in qs_docs if _dt(q.get("created_at")) and month_s <= _dt(q.get("created_at")) < month_e]
        month_score = round(sum(q.get("score", 0) for q in month_qa) / len(month_qa), 1) if month_qa else 0
        monthly_perf.append({
            "month": month_s.strftime("%b"),
            "tasks_completed": len(month_done),
            "quality_score": month_score,
            "reviews": len(month_qa),
        })

    # Project health distribution
    health_dist = {"Healthy": 0, "At Risk": 0, "Blocked": 0, "Completed": 0}
    for p in real_projects:
        prog = p.get("progress", 0)
        status = p.get("status", "ACTIVE").upper()
        if status == "COMPLETED":
            health_dist["Completed"] += 1
        elif "HOLD" in status:
            health_dist["Blocked"] += 1
        elif prog >= 70:
            health_dist["Healthy"] += 1
        else:
            health_dist["At Risk"] += 1

    # Activity feed
    activity_feed = []
    for log in audit_logs[:15]:
        ts = log.get("timestamp") or log.get("created_at")
        activity_feed.append({
            "action":        log.get("action", ""),
            "user_name":     log.get("user_name", "System"),
            "resource_type": log.get("resource_type", ""),
            "created_at":    _iso(ts),
        })

    # Score distribution
    score_dist = [
        {"range": "60–69", "count": sum(1 for q in qs_docs if 60 <= (q.get("score") or 0) < 70)},
        {"range": "70–79", "count": sum(1 for q in qs_docs if 70 <= (q.get("score") or 0) < 80)},
        {"range": "80–84", "count": sum(1 for q in qs_docs if 80 <= (q.get("score") or 0) < 85)},
        {"range": "85–94", "count": sum(1 for q in qs_docs if 85 <= (q.get("score") or 0) < 95)},
        {"range": "95–100","count": sum(1 for q in qs_docs if (q.get("score") or 0) >= 95)},
    ]

    # Top projects by score
    proj_score_map: dict = {}
    for q in qs_docs:
        pid = str(q.get("project_id", ""))
        if pid:
            scores = proj_score_map.setdefault(pid, [])
            scores.append(q.get("score", 0))
    proj_avg_scores = {pid: round(sum(s) / len(s), 1) for pid, s in proj_score_map.items()}

    projects_enriched = []
    for p in real_projects[:20]:
        pid = str(p["_id"])
        ptasks = [t for t in all_tasks if str(t.get("project_id")) == pid]
        p_done = sum(1 for t in ptasks if t.get("status") == "DONE")
        prog   = p.get("progress", 0)
        status = p.get("status", "ACTIVE").upper()

        if status == "COMPLETED":
            hl, hc = "Completed", "#10b981"
        elif "HOLD" in status:
            hl, hc = "Blocked", "#ef4444"
        elif prog >= 70:
            hl, hc = "Healthy", "#10b981"
        elif prog >= 40:
            hl, hc = "At Risk", "#f59e0b"
        else:
            hl, hc = "Critical", "#ef4444"

        projects_enriched.append({
            "id":           pid,
            "title":        p.get("title", "Untitled"),
            "status":       status,
            "progress":     prog,
            "health_label": hl,
            "health_color": hc,
            "task_count":   len(ptasks),
            "done_tasks":   p_done,
            "ai_score":     proj_avg_scores.get(pid),
            "due_date":     _iso(p.get("due_date")),
            "priority":     p.get("priority", "medium"),
            "updated_at":   _iso(p.get("updated_at")),
        })

    return {
        "kpis": {
            "total_projects":    len(real_projects),
            "active_projects":   len(active_p),
            "completed_projects":len(completed_p),
            "on_hold_projects":  len(on_hold_p),
            "overdue_projects":  len(overdue_p),
            "total_tasks":       len(all_tasks),
            "done_tasks":        len(done_tasks),
            "overdue_tasks":     len(overdue_tasks),
            "tasks_due_today":   len(tasks_today),
            "total_users":       len(all_users),
            "online_users":      len(online_users),
            "total_comments":    comment_count,
            "total_files":       file_count,
            "total_events":      event_count,
            "quality_reviews":   total_qa,
            "quality_pass_rate": ai_pass_rt,
            "avg_quality_score": avg_score,
            "avg_progress":      avg_prog,
            "health_score":      health_score,
            "completion_rate":   completion_rate,
        },
        "charts": {
            "progress_trend":   progress_trend,
            "task_status_dist": status_dist,
            "user_activity":    user_activity,
            "ai_score_trend":   ai_trend,
            "monthly_perf":     monthly_perf,
            "health_dist":      health_dist,
            "score_dist":       score_dist,
        },
        "projects": projects_enriched,
        "activity_feed": activity_feed,
        "quality": {
            "total_reviews":  total_qa,
            "pass_count":     pass_qa,
            "fail_count":     total_qa - pass_qa,
            "pass_rate":      ai_pass_rt,
            "avg_score":      avg_score,
            "score_dist":     score_dist,
        },
    }


@router.get("/team/{team_id}")
async def get_team_analytics(
    team_id: str,
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Get team-level analytics: projects, tasks, accuracy, active users.
    
    Accessible by any team member (Admin, Manager, Sub-Manager, Member).
    Members see aggregated stats without per-user accuracy scores.
    """
    try:
        team_obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid team ID")

    # Verify the user is a member of the team
    await require_team_member(team_id, current_user, db)

    result = await AnalyticsService.get_team_analytics(db, team_obj_id, period)
    return result


@router.get("/user/{user_id}")
async def get_user_analytics(
    user_id: str,
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get task & quality stats for a specific user across all their teams."""
    from datetime import datetime, timedelta
    from app.db.collections import TASKS_COLLECTION, MEMBERSHIPS_COLLECTION

    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    # Period filter
    now = datetime.utcnow()
    deltas = {"day": 1, "week": 7, "month": 30, "year": 365}
    period_start = now - timedelta(days=deltas.get(period, 30))

    task_filter = {
        "$or": [{"assigned_to": obj_id}, {"assignees": obj_id}],
        "created_at": {"$gte": period_start},
    }

    tasks = await db[TASKS_COLLECTION].find(task_filter).to_list(length=None)
    total = len(tasks)
    done = sum(1 for t in tasks if t.get("status") == "DONE")
    in_progress = sum(1 for t in tasks if t.get("status") == "IN_PROGRESS")
    review = sum(1 for t in tasks if t.get("status") == "REVIEW")

    # Teams the user belongs to
    memberships = await db[MEMBERSHIPS_COLLECTION].find(
        {"user_id": obj_id}
    ).to_list(length=None)

    # Avg QC score
    avg_score = 0.0
    try:
        pipeline = [
            {"$match": {"user_id": obj_id}},
            {"$group": {"_id": None, "avg": {"$avg": "$score"}}},
        ]
        result = await db["quality_scores"].aggregate(pipeline).to_list(1)
        if result:
            avg_score = round(result[0].get("avg", 0), 1)
    except Exception:
        pass

    return {
        "user_id": str(obj_id),
        "period": period,
        "tasks_total": total,
        "tasks_done": done,
        "tasks_in_progress": in_progress,
        "tasks_in_review": review,
        "teams_count": len(memberships),
        "avg_accuracy": avg_score,
    }


@router.get("/user/{user_id}/dashboard")
async def get_user_dashboard_analytics(
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Comprehensive user analytics dashboard.

    Returns:
        - On-time delivery rate (completed tasks delivered on/before deadline)
        - Current workload (active tasks count grouped by status)
        - Full status breakdown (TODO, IN_PROGRESS, REVIEW, DONE with counts & percentages)
        - Average turnaround time (mean hours from created_at to updated_at for DONE tasks)
        - Active tasks list (name, status, deadline, priority for non-DONE tasks)

    Assumptions documented:
        - Task assignment time is approximated by created_at when no explicit assignment timestamp exists.
        - Tasks without a deadline are excluded from on-time delivery calculations.
        - Turnaround time uses updated_at of DONE tasks as completion timestamp.
    """
    from datetime import datetime
    from app.db.collections import TASKS_COLLECTION, PROJECTS_COLLECTION

    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    # Single efficient query: fetch ALL tasks for this user
    user_task_filter = {
        "$or": [{"assigned_to": obj_id}, {"assignees": obj_id}]
    }
    all_tasks = await db[TASKS_COLLECTION].find(user_task_filter).to_list(length=None)

    total_tasks = len(all_tasks)

    # --- Status Breakdown ---
    status_counts = {"TODO": 0, "IN_PROGRESS": 0, "REVIEW": 0, "DONE": 0}
    for t in all_tasks:
        s = t.get("status", "TODO")
        if s in status_counts:
            status_counts[s] += 1

    done_tasks = [t for t in all_tasks if t.get("status") == "DONE"]
    active_tasks = [t for t in all_tasks if t.get("status") != "DONE"]

    # --- On-Time Delivery Rate ---
    # Only consider DONE tasks that have a deadline
    done_with_deadline = [t for t in done_tasks if t.get("deadline")]
    on_time_count = 0
    for t in done_with_deadline:
        deadline = t["deadline"]
        completed_at = t.get("updated_at") or t.get("created_at")
        if completed_at and deadline:
            # Normalize both to datetime for comparison
            if isinstance(deadline, str):
                try:
                    deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    continue
            if isinstance(completed_at, str):
                try:
                    completed_at = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    continue
            # Strip timezone for safe comparison if needed
            if hasattr(deadline, 'replace') and deadline.tzinfo and (not completed_at.tzinfo):
                deadline = deadline.replace(tzinfo=None)
            elif hasattr(completed_at, 'replace') and completed_at.tzinfo and (not deadline.tzinfo):
                completed_at = completed_at.replace(tzinfo=None)
            if completed_at <= deadline:
                on_time_count += 1

    total_done_with_deadline = len(done_with_deadline)
    on_time_rate = round((on_time_count / total_done_with_deadline * 100), 1) if total_done_with_deadline > 0 else 0.0

    # --- Average Turnaround Time (hours) ---
    turnaround_hours = []
    for t in done_tasks:
        created = t.get("created_at")
        completed = t.get("updated_at")
        if created and completed:
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    continue
            if isinstance(completed, str):
                try:
                    completed = datetime.fromisoformat(completed.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    continue
            # Normalize timezone
            if hasattr(created, 'replace') and created.tzinfo and (not completed.tzinfo):
                created = created.replace(tzinfo=None)
            elif hasattr(completed, 'replace') and completed.tzinfo and (not created.tzinfo):
                completed = completed.replace(tzinfo=None)
            diff = (completed - created).total_seconds() / 3600.0
            if diff >= 0:
                turnaround_hours.append(diff)

    avg_completion_hours = round(sum(turnaround_hours) / len(turnaround_hours), 1) if turnaround_hours else 0.0

    # --- Active Tasks List (with project title lookup) ---
    # Collect project IDs for active tasks to fetch titles
    project_ids = list({t["project_id"] for t in active_tasks if t.get("project_id")})
    project_map = {}
    if project_ids:
        projects = await db[PROJECTS_COLLECTION].find(
            {"_id": {"$in": project_ids}}
        ).to_list(length=None)
        project_map = {p["_id"]: p.get("title", "Untitled") for p in projects}

    active_tasks_list = []
    for t in active_tasks:
        deadline_val = t.get("deadline")
        if deadline_val and isinstance(deadline_val, datetime):
            deadline_val = deadline_val.isoformat()
        elif deadline_val and not isinstance(deadline_val, str):
            deadline_val = str(deadline_val)

        active_tasks_list.append({
            "id": str(t["_id"]),
            "title": t.get("title", "Untitled"),
            "status": t.get("status", "TODO"),
            "priority": t.get("priority", "medium"),
            "deadline": deadline_val,
            "project_name": project_map.get(t.get("project_id"), "—"),
        })

    # Sort active tasks: high priority first, then by deadline
    priority_order = {"high": 0, "medium": 1, "low": 2}
    active_tasks_list.sort(key=lambda x: (priority_order.get(x["priority"], 1), x["deadline"] or "9999"))

    # --- ADMIN FEATURES ---

    # 1. Rejection / Revision Rate — tasks that went to REVIEW relative to total
    rejection_rate = 0.0
    if total_tasks > 0:
        rejection_rate = round((status_counts["REVIEW"] / total_tasks) * 100, 1)

    # 2. Burnout Risk — based on active high-priority task load
    high_priority_active = sum(1 for t in active_tasks if t.get("priority") == "high")
    if len(active_tasks) >= 7 or high_priority_active >= 3:
        burnout_risk = "High"
    elif len(active_tasks) >= 4 or high_priority_active >= 1:
        burnout_risk = "Medium"
    else:
        burnout_risk = "Low"

    # 3. Benchmarking vs Team Average — real turnaround from tasks in same projects
    team_avg_turnaround = 0.0
    if project_ids:
        team_tasks = await db[TASKS_COLLECTION].find({
            "project_id": {"$in": project_ids},
            "status": "DONE"
        }).to_list(length=None)
        team_turnarounds = []
        for t in team_tasks:
            created = t.get("created_at")
            completed = t.get("updated_at")
            if created and completed:
                if isinstance(created, str):
                    try:
                        created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        continue
                if isinstance(completed, str):
                    try:
                        completed = datetime.fromisoformat(completed.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        continue
                if hasattr(created, "replace") and created.tzinfo and (not completed.tzinfo):
                    created = created.replace(tzinfo=None)
                elif hasattr(completed, "replace") and completed.tzinfo and (not created.tzinfo):
                    completed = completed.replace(tzinfo=None)
                diff = (completed - created).total_seconds() / 3600.0
                if diff >= 0:
                    team_turnarounds.append(diff)
        if team_turnarounds:
            team_avg_turnaround = round(sum(team_turnarounds) / len(team_turnarounds), 1)

    # 4. Speed by Project — real turnaround grouped by project
    speed_by_project = []
    project_turnarounds: dict = {}
    for t in done_tasks:
        pid = t.get("project_id")
        created = t.get("created_at")
        completed = t.get("updated_at")
        if pid and created and completed:
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    continue
            if isinstance(completed, str):
                try:
                    completed = datetime.fromisoformat(completed.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    continue
            if hasattr(created, "replace") and created.tzinfo and (not completed.tzinfo):
                created = created.replace(tzinfo=None)
            elif hasattr(completed, "replace") and completed.tzinfo and (not created.tzinfo):
                completed = completed.replace(tzinfo=None)
            diff = (completed - created).total_seconds() / 3600.0
            if diff >= 0:
                project_turnarounds.setdefault(pid, []).append(diff)

    for pid, times in project_turnarounds.items():
        speed_by_project.append({
            "projectName": project_map.get(pid, "Untitled"),
            "avgHours": round(sum(times) / len(times), 1),
        })

    # 5. AI Quality frequent issues — pulled from failed QC evaluations
    from app.db.collections import QUALITY_EVALUATIONS_COLLECTION
    frequent_issues: list = []
    try:
        qc_docs = await db[QUALITY_EVALUATIONS_COLLECTION].find(
            {"user_id": obj_id, "verdict": "fail"},
            {"failed_standards": 1}
        ).limit(20).to_list(20)
        issue_counter: dict = {}
        for doc in qc_docs:
            for issue in (doc.get("failed_standards") or []):
                issue_counter[issue] = issue_counter.get(issue, 0) + 1
        frequent_issues = [
            k for k, _ in sorted(issue_counter.items(), key=lambda x: -x[1])
        ][:5]
    except Exception:
        pass

    return {
        "user_id": str(obj_id),
        "onTimeRate": on_time_rate,
        "onTimeTasks": on_time_count,
        "totalWithDeadline": total_done_with_deadline,
        "totalCompleted": len(done_tasks),
        "activeTasks": len(active_tasks),
        "statusBreakdown": {
            "todo": status_counts["TODO"],
            "inProgress": status_counts["IN_PROGRESS"],
            "review": status_counts["REVIEW"],
            "done": status_counts["DONE"],
        },
        "totalTasks": total_tasks,
        "averageCompletionTime": avg_completion_hours,
        "activeTasksList": active_tasks_list,
        "rejectionRate": rejection_rate,
        "burnoutRisk": burnout_risk,
        "teamAvgTurnaround": team_avg_turnaround,
        "speedByProject": speed_by_project,
        "frequentIssues": frequent_issues
    }


@router.get("/subadmin/dashboard")
async def get_subadmin_dashboard_analytics(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Comprehensive executive dashboard analytics for sub-admin role.
    Scoped to the calling user's own projects and their team members.
    Returns KPIs, project health, team performance, workload, AI quality
    insights, activity feed, smart alerts, deadlines, and productivity charts.
    """
    from datetime import datetime, timedelta
    from app.db.collections import (
        PROJECTS_COLLECTION,
        TASKS_COLLECTION,
        USERS_COLLECTION,
        QUALITY_SCORES_COLLECTION,
        QUALITY_EVALUATIONS_COLLECTION,
        QUALITY_ANALYSES_COLLECTION,
        AUDIT_LOGS_COLLECTION,
    )

    user_id = current_user.get("_id")
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_start = today_start - timedelta(days=today_start.weekday())
    SYSTEM_IDS = {"public-group", "all-sub-admin"}

    # ── helpers ────────────────────────────────────────────────────────────────

    def _s(v):
        return str(v) if v is not None else None

    def _dt(v):
        """Normalize to naive UTC datetime."""
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.replace(tzinfo=None) if v.tzinfo else v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None)
            except (ValueError, AttributeError):
                return None
        return None

    def _days(v):
        d = _dt(v)
        return int((d - now).total_seconds() / 86400) if d else None

    def _iso(v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    # ── 1. Projects ────────────────────────────────────────────────────────────
    raw_projects = await db[PROJECTS_COLLECTION].find({
        "$or": [{"sub_admin_ids": user_id}, {"owner_id": user_id}]
    }).to_list(None)

    real = [p for p in raw_projects if _s(p.get("_id")) not in SYSTEM_IDS]
    proj_ids = [p["_id"] for p in real]

    # ── 2. Tasks ───────────────────────────────────────────────────────────────
    tasks = await db[TASKS_COLLECTION].find(
        {"project_id": {"$in": proj_ids}}
    ).to_list(None) if proj_ids else []

    # ── 3. Team members ────────────────────────────────────────────────────────
    member_id_set: set = set()
    for p in real:
        for uid in (p.get("staff_ids") or []):
            member_id_set.add(uid)
        for uid in (p.get("sub_admin_ids") or []):
            member_id_set.add(uid)

    members = await db[USERS_COLLECTION].find(
        {"_id": {"$in": list(member_id_set)}}
    ).to_list(None) if member_id_set else []

    # ── 4. Quality scores (AI reviews) ────────────────────────────────────────
    qs_docs = await db[QUALITY_SCORES_COLLECTION].find(
        {"project_id": {"$in": proj_ids}}
    ).to_list(None) if proj_ids else []

    # ── 5. Quality analyses (QC review results with verdicts) ──────────────────
    qa_docs = await db[QUALITY_ANALYSES_COLLECTION].find(
        {"project_id": {"$in": proj_ids}}
    ).to_list(None) if proj_ids else []

    # ── 6. Audit logs (recent workspace activity) ─────────────────────────────
    audit_logs = await db[AUDIT_LOGS_COLLECTION].find(
        {}
    ).sort("timestamp", -1).limit(30).to_list(30)

    # ── Task partitions ────────────────────────────────────────────────────────
    done_tasks   = [t for t in tasks if t.get("status") == "DONE"]
    active_tasks = [t for t in tasks if t.get("status") not in ("DONE",)]

    def _task_is_due_today(t):
        d = _dt(t.get("deadline"))
        return d is not None and today_start <= d < today_end

    def _task_is_overdue(t):
        d = _dt(t.get("deadline"))
        return d is not None and d < today_start and t.get("status") not in ("DONE",)

    tasks_due_today = sum(1 for t in active_tasks if _task_is_due_today(t))
    tasks_done_week = sum(
        1 for t in done_tasks
        if _dt(t.get("updated_at") or t.get("created_at")) and
           (_dt(t.get("updated_at")) or _dt(t.get("created_at"))) >= week_start
    )

    # ── Online members (last_seen < 5 min) ────────────────────────────────────
    online_members = [
        u for u in members
        if _dt(u.get("last_seen")) and (now - _dt(u.get("last_seen"))).total_seconds() < 300
    ]

    # ── Project health classifier ─────────────────────────────────────────────
    def _proj_health(p):
        s  = p.get("status", "ACTIVE").upper()
        pg = p.get("progress", 0)
        d  = _days(p.get("due_date"))
        if s == "COMPLETED":
            return "Completed", "#10b981", "low"
        if "HOLD" in s:
            return "Blocked", "#ef4444", "critical"
        if d is not None and d < 0:
            return "Overdue", "#ef4444", "critical"
        if d is not None and d <= 3 and pg < 60:
            return "Attention Needed", "#f59e0b", "high"
        if pg >= 70:
            return "Healthy", "#10b981", "low"
        if pg >= 40:
            return "Attention Needed", "#f59e0b", "medium"
        return "At Risk", "#ef4444", "high"

    # ── High-level project counts ──────────────────────────────────────────────
    active_projs    = [p for p in real if p.get("status", "").upper() == "ACTIVE"]
    completed_projs = [p for p in real if p.get("status", "").upper() == "COMPLETED"]
    overdue_projs   = [
        p for p in real
        if _days(p.get("due_date")) is not None and
           _days(p.get("due_date")) < 0 and
           p.get("status", "").upper() != "COMPLETED"
    ]
    avg_prog = round(sum(p.get("progress", 0) for p in real) / max(len(real), 1))

    # ── AI pass rate ───────────────────────────────────────────────────────────
    total_qa     = len(qs_docs)
    pass_qa      = sum(1 for q in qs_docs if (q.get("score") or 0) >= 85)
    ai_pass_rate = round(pass_qa / max(total_qa, 1) * 100, 1)

    # ── Workspace health score ────────────────────────────────────────────────
    health_score = min(100, round(
        (len(completed_projs) / max(len(real), 1)) * 40 +
        (avg_prog / 100) * 40 +
        (len(online_members) / max(len(members), 1)) * 20
    )) if real else 0

    # ── Project portfolio (enriched) ──────────────────────────────────────────
    proj_task_map: dict = {}
    for t in tasks:
        pid = _s(t.get("project_id"))
        proj_task_map.setdefault(pid, []).append(t)

    proj_qs_map: dict = {}
    for q in qs_docs:
        pid = _s(q.get("project_id"))
        proj_qs_map.setdefault(pid, []).append(q)

    member_map = {_s(u["_id"]): u for u in members}

    projects_out = []
    for p in real:
        pid    = _s(p["_id"])
        ptasks = proj_task_map.get(pid, [])
        pqs    = proj_qs_map.get(pid, [])
        p_pass = sum(1 for q in pqs if (q.get("score") or 0) >= 85)
        p_ai   = round(p_pass / max(len(pqs), 1) * 100, 1) if pqs else None
        hl, hc, risk = _proj_health(p)

        team_names = [
            member_map[_s(uid)]["name"]
            for uid in (p.get("staff_ids") or [])
            if _s(uid) in member_map
        ]

        projects_out.append({
            "id":           pid,
            "title":        p.get("title", "Untitled"),
            "description":  p.get("description", ""),
            "status":       p.get("status", "ACTIVE"),
            "progress":     p.get("progress", 0),
            "health_label": hl,
            "health_color": hc,
            "risk_level":   risk,
            "due_date":     _iso(p.get("due_date")),
            "days_until":   _days(p.get("due_date")),
            "task_count":   len(ptasks),
            "open_tasks":   sum(1 for t in ptasks if t.get("status") not in ("DONE",)),
            "review_tasks": sum(1 for t in ptasks if t.get("status") == "REVIEW"),
            "ai_score":     p_ai,
            "team_size":    len(p.get("staff_ids") or []),
            "team_names":   team_names[:4],
            "updated_at":   _iso(p.get("updated_at")),
        })

    # ── Task → user maps (efficient, single pass) ─────────────────────────────
    user_assigned: dict = {}
    user_done:     dict = {}
    for t in tasks:
        assignees: set = set()
        if t.get("assigned_to"):
            assignees.add(_s(t["assigned_to"]))
        for a in (t.get("assignees") or []):
            assignees.add(_s(a))
        for uid in assignees:
            user_assigned[uid] = user_assigned.get(uid, 0) + 1
            if t.get("status") == "DONE":
                user_done[uid] = user_done.get(uid, 0) + 1

    user_qa_pass: dict = {}
    for q in qs_docs:
        uid = _s(q.get("user_id"))
        if uid and (q.get("score") or 0) >= 85:
            user_qa_pass[uid] = user_qa_pass.get(uid, 0) + 1

    # ── Team performance leaderboard ──────────────────────────────────────────
    team_performance = []
    for u in members:
        uid        = _s(u["_id"])
        assigned   = user_assigned.get(uid, 0)
        done_count = user_done.get(uid, 0)
        comp_rate  = round(done_count / max(assigned, 1) * 100) if assigned else 0
        ls_dt      = _dt(u.get("last_seen"))
        days_ago   = int((now - ls_dt).total_seconds() / 86400) if ls_dt else 30
        act_score  = round(min(100, max(0,
            comp_rate * 0.45 +
            max(0, 50 - days_ago * 5) * 0.35 +
            min(assigned * 2, 20)
        )))
        team_performance.append({
            "user_id":         uid,
            "name":            u.get("name", "Unknown"),
            "role":            u.get("role", "staff"),
            "tasks_assigned":  assigned,
            "tasks_completed": done_count,
            "completion_rate": comp_rate,
            "reviews_passed":  user_qa_pass.get(uid, 0),
            "activity_score":  act_score,
            "last_active":     _iso(u.get("last_seen")),
        })
    team_performance.sort(key=lambda x: -x["activity_score"])

    # ── Workload distribution ─────────────────────────────────────────────────
    user_wl: dict = {}
    for t in active_tasks:
        assignees: set = set()
        if t.get("assigned_to"):
            assignees.add(_s(t["assigned_to"]))
        for a in (t.get("assignees") or []):
            assignees.add(_s(a))
        is_rev  = t.get("status") == "REVIEW"
        is_dt   = _task_is_due_today(t)
        is_over = _task_is_overdue(t)
        for uid in assignees:
            wl = user_wl.setdefault(uid, {"current": 0, "review": 0, "due_today": 0, "overdue": 0})
            wl["current"] += 1
            if is_rev:   wl["review"]   += 1
            if is_dt:    wl["due_today"] += 1
            if is_over:  wl["overdue"]   += 1

    workload = []
    for u in members:
        uid   = _s(u["_id"])
        wl    = user_wl.get(uid, {"current": 0, "review": 0, "due_today": 0, "overdue": 0})
        total = wl["current"]
        status_wl = "overloaded" if total > 8 else ("underutilized" if total <= 2 else "balanced")
        workload.append({
            "user_id":       uid,
            "name":          u.get("name", "Unknown"),
            "role":          u.get("role", "staff"),
            "current_tasks": total,
            "review_tasks":  wl["review"],
            "due_today":     wl["due_today"],
            "overdue":       wl["overdue"],
            "status":        status_wl,
        })

    # ── AI quality insights ───────────────────────────────────────────────────
    task_ids_list = [t["_id"] for t in tasks]
    qe_docs = await db[QUALITY_EVALUATIONS_COLLECTION].find(
        {"task_id": {"$in": task_ids_list}, "verdict": "fail"},
        {"failed_standards": 1}
    ).limit(100).to_list(100) if task_ids_list else []

    issue_ctr: dict = {}
    for doc in qe_docs:
        for issue in (doc.get("failed_standards") or []):
            issue_ctr[issue] = issue_ctr.get(issue, 0) + 1
    top_issues = [k for k, _ in sorted(issue_ctr.items(), key=lambda x: -x[1])[:5]]

    # Per-project scores for best/worst
    proj_scored = [
        (p["title"], p["ai_score"])
        for p in projects_out if p["ai_score"] is not None
    ]
    proj_scored.sort(key=lambda x: -x[1])

    # AI score trend (last 7 days)
    ai_trend = []
    for i in range(6, -1, -1):
        day_s  = today_start - timedelta(days=i)
        day_e  = day_s + timedelta(days=1)
        day_qs = [q for q in qs_docs if _dt(q.get("created_at")) and day_s <= _dt(q.get("created_at")) < day_e]
        ai_trend.append(
            round(sum(q.get("score", 0) for q in day_qs) / len(day_qs), 1) if day_qs else None
        )

    ai_insights = {
        "total_reviews":  total_qa,
        "pass_count":     pass_qa,
        "fail_count":     total_qa - pass_qa,
        "pass_rate":      ai_pass_rate,
        "common_issues":  top_issues,
        "best_project":   {"name": proj_scored[0][0], "score": proj_scored[0][1]} if proj_scored else None,
        "worst_project":  {"name": proj_scored[-1][0], "score": proj_scored[-1][1]} if len(proj_scored) > 1 else None,
        "score_distribution": [
            {"range": "0–59",   "count": sum(1 for q in qs_docs if (q.get("score") or 0) < 60)},
            {"range": "60–74",  "count": sum(1 for q in qs_docs if 60  <= (q.get("score") or 0) < 75)},
            {"range": "75–84",  "count": sum(1 for q in qs_docs if 75  <= (q.get("score") or 0) < 85)},
            {"range": "85–94",  "count": sum(1 for q in qs_docs if 85  <= (q.get("score") or 0) < 95)},
            {"range": "95–100", "count": sum(1 for q in qs_docs if (q.get("score") or 0) >= 95)},
        ],
        "ai_score_trend": ai_trend,
    }

    # ── Activity feed ─────────────────────────────────────────────────────────
    activity_feed = []
    for log in audit_logs[:20]:
        ts = log.get("timestamp") or log.get("created_at")
        activity_feed.append({
            "action":        log.get("action", ""),
            "user_name":     log.get("user_name", "System"),
            "resource_type": log.get("resource_type", ""),
            "created_at":    _iso(ts),
        })

    # ── Smart alerts ──────────────────────────────────────────────────────────
    alerts = []
    overdue_task_n = sum(1 for t in active_tasks if _task_is_overdue(t))
    if overdue_task_n > 0:
        alerts.append({"type": "overdue_tasks",   "severity": "critical",
                        "message": f"{overdue_task_n} task{'s' if overdue_task_n > 1 else ''} overdue",
                        "count": overdue_task_n, "icon": "🚨"})

    due_soon = [p for p in real if _days(p.get("due_date")) is not None and
                0 <= _days(p.get("due_date")) <= 3 and
                p.get("status", "").upper() != "COMPLETED"]
    if due_soon:
        alerts.append({"type": "deadline_soon", "severity": "high",
                        "message": f"{len(due_soon)} project deadline{'s' if len(due_soon) > 1 else ''} within 3 days",
                        "count": len(due_soon), "icon": "⏰"})

    inactive = [u for u in members if not _dt(u.get("last_seen")) or (now - _dt(u.get("last_seen"))).days > 7]
    if inactive:
        alerts.append({"type": "inactive_members", "severity": "medium",
                        "message": f"{len(inactive)} member{'s' if len(inactive) > 1 else ''} inactive 7+ days",
                        "count": len(inactive), "icon": "👤"})

    if total_qa >= 5 and ai_pass_rate < 70:
        alerts.append({"type": "low_ai_score", "severity": "medium",
                        "message": f"AI pass rate at {ai_pass_rate}% — below threshold",
                        "count": 0, "icon": "🤖"})

    overloaded_wl = [w for w in workload if w["status"] == "overloaded"]
    if overloaded_wl:
        alerts.append({"type": "overloaded", "severity": "medium",
                        "message": f"{len(overloaded_wl)} member{'s' if len(overloaded_wl) > 1 else ''} overloaded",
                        "count": len(overloaded_wl), "icon": "⚡"})

    # ── Upcoming deadlines ────────────────────────────────────────────────────
    dl_groups: dict = {"today": [], "tomorrow": [], "this_week": [], "next_week": []}
    for p in real:
        if p.get("status", "").upper() == "COMPLETED":
            continue
        d = _days(p.get("due_date"))
        if d is None:
            continue
        item = {"id": _s(p["_id"]), "title": p.get("title", ""), "progress": p.get("progress", 0),
                "status": p.get("status", "ACTIVE"), "days_until": d}
        if d == 0:       dl_groups["today"].append(item)
        elif d == 1:     dl_groups["tomorrow"].append(item)
        elif 2 <= d <= 7: dl_groups["this_week"].append(item)
        elif 8 <= d <= 14: dl_groups["next_week"].append(item)

    # ── Productivity charts ───────────────────────────────────────────────────
    _dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    tasks_per_day = []
    for i in range(6, -1, -1):
        day   = today_start - timedelta(days=i)
        day_e = day + timedelta(days=1)
        cnt   = sum(1 for t in done_tasks if _dt(t.get("updated_at")) and day <= _dt(t.get("updated_at")) < day_e)
        tasks_per_day.append({"date": _dow[day.weekday()], "count": cnt})

    # Weekly progress trend proxy (7 data-points anchored to avg_prog)
    weekly_progress = [max(0, avg_prog - max(0, (6 - i) * 3) + (i % 2)) for i in range(7)]

    # ── Final response ────────────────────────────────────────────────────────
    return {
        "kpis": {
            "total_projects":       len(real),
            "active_projects":      len(active_projs),
            "completed_projects":   len(completed_projs),
            "overdue_projects":     len(overdue_projs),
            "total_tasks":          len(tasks),
            "tasks_due_today":      tasks_due_today,
            "completed_tasks_week": tasks_done_week,
            "team_members":         len(members),
            "online_members":       len(online_members),
            "ai_pass_rate":         ai_pass_rate,
            "health_score":         health_score,
            "avg_completion":       avg_prog,
        },
        "projects":           projects_out,
        "team_performance":   team_performance,
        "workload":           workload,
        "ai_insights":        ai_insights,
        "activity_feed":      activity_feed,
        "smart_alerts":       alerts,
        "upcoming_deadlines": dl_groups,
        "productivity_charts": {
            "tasks_per_day":   tasks_per_day,
            "weekly_progress": weekly_progress,
            "ai_score_trend":  ai_insights["ai_score_trend"],
        },
    }
