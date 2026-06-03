"""
Orbit Platform — Demo Data Seed Service
Creates enterprise-grade demo data for showcasing all platform features.
Idempotent: skips seeding if sufficient data already exists.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta
from bson import ObjectId

import bcrypt


# ── helpers ────────────────────────────────────────────────────────────────────

def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _ago(days: int = 0, hours: int = 0) -> datetime:
    return datetime.utcnow() - timedelta(days=days, hours=hours)


def _rand_date(min_days: int, max_days: int) -> datetime:
    return _ago(days=random.randint(min_days, max_days))


def _future(min_days: int, max_days: int) -> datetime:
    return datetime.utcnow() + timedelta(days=random.randint(min_days, max_days))


PASS = _hash("Demo@1234")

# ── static data pools ──────────────────────────────────────────────────────────

FIRST_NAMES = [
    "Sarah", "James", "Emily", "Michael", "Priya", "David", "Aisha", "Robert",
    "Sophie", "Lucas", "Nina", "Carlos", "Fatima", "Ahmed", "Jessica", "Kevin",
    "Maria", "Daniel", "Yuki", "Thomas", "Leila", "Omar", "Hannah", "Mark",
    "Zoe", "Ivan", "Layla", "Patrick", "Chloe", "Hassan",
]
LAST_NAMES = [
    "Mitchell", "Richardson", "Chen", "Torres", "Sharma", "Kowalski", "Patel",
    "Martinez", "Anderson", "Brown", "Petrova", "Rivera", "Al-Hassan", "Ibrahim",
    "Taylor", "Park", "Gonzalez", "Schmidt", "Tanaka", "Wilson",
    "Khalid", "Hassan", "Berg", "O'Brien", "Dupont", "Kim", "Nasser", "Müller",
    "Santos", "Johansson",
]

PROJECT_TITLES = [
    "Annual Academic Quality Report 2024",
    "Curriculum Review & Accreditation",
    "Research Ethics Compliance Audit",
    "Faculty Performance Evaluation System",
    "Student Learning Outcomes Assessment",
    "ISO 9001 Quality Management Implementation",
    "Digital Transformation Roadmap",
    "Laboratory Safety Compliance Program",
    "Graduate Program Self-Study",
    "Community Engagement Initiative",
    "Financial Audit & Risk Assessment",
    "IT Infrastructure Security Review",
    "International Accreditation Preparation",
    "Course Specification Documentation",
    "Program Specification Update 2024",
]

PROJECT_DESCS = [
    "Comprehensive quality assessment covering all academic departments and administrative units.",
    "Full curriculum review aligned with national accreditation standards and industry benchmarks.",
    "Systematic audit of research protocols and ethical compliance procedures.",
    "360-degree evaluation system for faculty performance and professional development.",
    "Assessment of student learning outcomes across undergraduate and graduate programs.",
    "Implementation of ISO 9001:2015 quality management standards across the institution.",
    "Strategic roadmap for digital transformation initiatives across all departments.",
    "Annual safety compliance review for laboratory facilities and research spaces.",
    "Comprehensive self-study report for graduate program accreditation renewal.",
    "Structured engagement with local community organizations and industry partners.",
    "Independent financial audit with comprehensive risk assessment framework.",
    "Security review of IT infrastructure including network, data, and application security.",
    "Preparation package for international accreditation body review visit.",
    "Documentation of course specifications aligned with program learning outcomes.",
    "Complete update of program specifications to meet updated accreditation criteria.",
]

TASK_TITLES = [
    "Draft executive summary section",
    "Collect faculty performance data",
    "Review student satisfaction surveys",
    "Prepare compliance documentation",
    "Analyze assessment results",
    "Update quality standards matrix",
    "Schedule stakeholder interviews",
    "Compile supporting evidence",
    "Review previous audit findings",
    "Prepare presentation slides",
    "Coordinate with department heads",
    "Validate data accuracy",
    "Submit draft for peer review",
    "Incorporate reviewer feedback",
    "Finalize report sections",
    "Upload supporting documents",
    "Cross-reference accreditation criteria",
    "Prepare risk assessment matrix",
    "Document improvement actions",
    "Conduct gap analysis",
    "Review benchmark data",
    "Prepare team training materials",
    "Schedule quality review meeting",
    "Update project timeline",
    "Resolve outstanding issues",
    "Prepare monthly progress report",
    "Verify compliance checklist",
    "Archive completed deliverables",
    "Coordinate external reviewer visit",
    "Finalize action plan",
    "Draft recommendations section",
    "Review financial data",
    "Prepare statistical analysis",
    "Update quality indicators",
    "Conduct peer review session",
    "Document best practices",
    "Prepare accreditation self-study",
    "Review program outcomes data",
    "Submit final deliverable",
    "Post-completion review",
    "Update tracking spreadsheet",
    "Gather evidence portfolio",
    "Review international benchmarks",
    "Prepare survey instrument",
    "Analyze survey responses",
    "Write methodology section",
    "Review literature sources",
    "Update bibliography",
    "Format final document",
    "Distribute for final approval",
]

COMMENT_TEXTS = [
    "Great progress on this section. The data looks comprehensive.",
    "Need to double-check the figures in table 3.",
    "Excellent work! The analysis is thorough and well-structured.",
    "Can we schedule a review meeting for next week?",
    "The supporting evidence looks solid. Good job!",
    "Please add more context to the recommendation section.",
    "This is coming together nicely. Keep up the good work.",
    "I've reviewed the draft and have some minor suggestions.",
    "The methodology section needs more detail about the data collection process.",
    "Outstanding quality on this deliverable. Well done!",
    "Let me know if you need any additional resources.",
    "The timeline looks achievable. Should we add buffer time?",
    "Approved with minor revisions. Please address the highlighted areas.",
    "This section is complete and ready for final review.",
    "We need to align this with the accreditation criteria.",
    "The team has done an excellent job coordinating this effort.",
    "Please ensure all references are properly cited.",
    "The risk matrix needs to be updated with the latest data.",
    "Stakeholder feedback has been incorporated successfully.",
    "The executive summary is clear and concise. Well written.",
    "We need to schedule a follow-up meeting to discuss this.",
    "The findings are consistent with previous audit results.",
    "Excellent compliance rate achieved in this section.",
    "The improvement plan looks realistic and achievable.",
    "Please share this with the department head for review.",
]

QUALITY_STANDARDS = [
    {
        "name": "Academic Program Quality Standard",
        "description": "Evaluates program design, delivery, and alignment with accreditation requirements.",
        "type": "academic",
        "threshold": 85,
    },
    {
        "name": "Research Ethics Compliance",
        "description": "Ensures research activities meet ethical standards and regulatory requirements.",
        "type": "compliance",
        "threshold": 90,
    },
    {
        "name": "Faculty Qualification Standard",
        "description": "Verifies faculty qualifications, credentials, and professional development.",
        "type": "hr",
        "threshold": 85,
    },
    {
        "name": "Student Learning Outcomes",
        "description": "Measures achievement of defined learning outcomes across programs.",
        "type": "academic",
        "threshold": 80,
    },
    {
        "name": "Infrastructure & Resources",
        "description": "Assesses adequacy of physical and digital infrastructure.",
        "type": "operational",
        "threshold": 75,
    },
    {
        "name": "Financial Governance",
        "description": "Reviews financial controls, transparency, and audit compliance.",
        "type": "financial",
        "threshold": 90,
    },
    {
        "name": "Documentation Quality",
        "description": "Evaluates completeness and accuracy of institutional documentation.",
        "type": "documentation",
        "threshold": 85,
    },
    {
        "name": "Community Engagement",
        "description": "Measures meaningful engagement with local and national communities.",
        "type": "engagement",
        "threshold": 70,
    },
    {
        "name": "Data Management & Security",
        "description": "Assesses data governance, security protocols, and privacy compliance.",
        "type": "security",
        "threshold": 90,
    },
    {
        "name": "Continuous Improvement Process",
        "description": "Evaluates effectiveness of improvement cycles and feedback loops.",
        "type": "process",
        "threshold": 80,
    },
]

TEAM_NAMES = [
    "Software Engineering Team",
    "Research & Development",
    "Quality Assurance Unit",
    "Academic Affairs Division",
    "Business Analytics Team",
    "IT Infrastructure Group",
    "Documentation & Compliance",
    "Strategic Planning Team",
]

EVENT_TITLES = [
    "Quarterly Quality Review Meeting",
    "Accreditation Preparation Workshop",
    "Faculty Development Seminar",
    "Research Ethics Training",
    "IT Security Awareness Session",
    "Student Learning Assessment Review",
    "Annual Performance Appraisal",
    "Curriculum Development Workshop",
    "Compliance Audit Briefing",
    "Strategic Planning Session",
    "Team Building Activity",
    "Project Milestone Review",
    "Stakeholder Consultation Meeting",
    "Board of Directors Presentation",
    "Department Heads Coordination",
]

AUDIT_ACTIONS = [
    "project_created", "task_completed", "user_registered", "report_submitted",
    "quality_review_passed", "quality_review_failed", "project_updated",
    "task_assigned", "comment_added", "file_uploaded", "event_created",
    "user_login", "project_completed", "review_approved", "standard_updated",
]


# ══════════════════════════════════════════════════════════════════════════════
# MAIN SEED FUNCTION
# ══════════════════════════════════════════════════════════════════════════════

async def seed_demo_data(db) -> dict:
    """
    Seeds comprehensive demo data into MongoDB.
    Idempotent: checks user count first, skips if already seeded.
    Returns a summary of what was created.
    """
    from app.db.collections import (
        USERS_COLLECTION, TEAMS_COLLECTION, MEMBERSHIPS_COLLECTION,
        PROJECTS_COLLECTION, TASKS_COLLECTION, COMMENTS_COLLECTION,
        FILES_COLLECTION, EVENTS_COLLECTION, QUALITY_EVALUATIONS_COLLECTION,
        QUALITY_SCORES_COLLECTION, QUALITY_ANALYSES_COLLECTION,
        QUALITY_STANDARDS_COLLECTION, AUDIT_LOGS_COLLECTION,
        TASK_BOARDS_COLLECTION,
    )

    # ── Guard: skip if already seeded ─────────────────────────────────────────
    existing = await db[USERS_COLLECTION].count_documents({})
    if existing >= 10:
        proj_count = await db[PROJECTS_COLLECTION].count_documents({"type": "custom"})
        return {
            "already_seeded": True,
            "users": existing,
            "projects": proj_count,
            "message": "Demo data already exists. No changes made.",
        }

    summary = {}
    random.seed(42)  # deterministic

    # ── 1. USERS (30) ─────────────────────────────────────────────────────────
    role_dist = (
        [("founder", 1), ("admin", 2), ("sub_admin", 5), ("qc", 3)]
        + [("staff", 19)]
    )
    roles_flat = [r for r, n in role_dist for _ in range(n)]

    user_ids: list[ObjectId] = []
    user_docs = []
    seen_names: set[str] = set()

    for idx, role in enumerate(roles_flat):
        while True:
            fn = FIRST_NAMES[idx % len(FIRST_NAMES)]
            ln = LAST_NAMES[(idx * 3 + 7) % len(LAST_NAMES)]
            name = f"{fn} {ln}"
            if name not in seen_names:
                seen_names.add(name)
                break
            idx += 1

        uid = ObjectId()
        user_ids.append(uid)
        slug = name.lower().replace(" ", ".")
        last_seen = _ago(days=random.randint(0, 14), hours=random.randint(0, 23))
        user_docs.append({
            "_id":        uid,
            "email":      f"{slug}@orbit-demo.ai",
            "password":   PASS,
            "name":       name,
            "full_name":  name,
            "role":       role,
            "roles":      [role],
            "status":     "active",
            "is_active":  True,
            "phone":      f"+1-555-{random.randint(1000,9999)}",
            "avatar_url": None,
            "last_seen":  last_seen,
            "created_at": _rand_date(180, 90),
            "updated_at": last_seen,
        })

    await db[USERS_COLLECTION].insert_many(user_docs)
    summary["users"] = len(user_docs)

    # Index roles for easy lookup
    by_role: dict[str, list[ObjectId]] = {}
    for doc in user_docs:
        by_role.setdefault(doc["role"], []).append(doc["_id"])

    founder_id  = by_role["founder"][0]
    admin_ids   = by_role["admin"]
    sub_ids     = by_role["sub_admin"]
    qc_ids      = by_role["qc"]
    staff_ids   = by_role["staff"]

    # ── 2. TEAMS (8) ──────────────────────────────────────────────────────────
    team_ids: list[ObjectId] = []
    team_docs = []
    for i, tname in enumerate(TEAM_NAMES):
        tid = ObjectId()
        team_ids.append(tid)
        team_docs.append({
            "_id":        tid,
            "name":       tname,
            "description": f"Core team responsible for {tname.lower()} activities.",
            "created_by": admin_ids[i % len(admin_ids)],
            "created_at": _rand_date(150, 60),
            "updated_at": _rand_date(30, 1),
        })
    await db[TEAMS_COLLECTION].insert_many(team_docs)
    summary["teams"] = len(team_docs)

    # ── 3. PROJECTS (15) ──────────────────────────────────────────────────────
    statuses  = (["COMPLETED"] * 5 + ["ACTIVE"] * 6 + ["ACTIVE"] * 3 + ["ON_HOLD"] * 1)
    progress_map = {
        "COMPLETED": lambda: 100,
        "ACTIVE":    lambda: random.randint(30, 85),
        "ON_HOLD":   lambda: random.randint(15, 45),
    }
    priorities = ["high", "high", "medium", "medium", "medium", "low", "low",
                  "high", "medium", "medium", "low", "high", "medium", "medium", "low"]

    project_ids: list[ObjectId] = []
    project_docs = []
    for i, (title, desc, status, priority) in enumerate(
        zip(PROJECT_TITLES, PROJECT_DESCS, statuses, priorities)
    ):
        pid = ObjectId()
        project_ids.append(pid)

        sub_admin_pool = random.sample(sub_ids, min(2, len(sub_ids)))
        staff_pool     = random.sample(staff_ids, random.randint(2, 5))
        prog           = progress_map[status]()
        created_days   = random.randint(60, 180)
        due_days_from_now = random.randint(-10, 60) if status != "COMPLETED" else -random.randint(5, 90)

        project_docs.append({
            "_id":             pid,
            "title":           title,
            "description":     desc,
            "type":            "custom",
            "status":          status,
            "progress":        prog,
            "priority":        priority,
            "owner_id":        admin_ids[i % len(admin_ids)],
            "sub_admin_ids":   sub_admin_pool,
            "staff_ids":       staff_pool,
            "comments_enabled": True,
            "uploads_enabled": True,
            "is_system_card":  False,
            "team_id":         team_ids[i % len(team_ids)],
            "due_date":        (datetime.utcnow() + timedelta(days=due_days_from_now)).isoformat(),
            "created_at":      _ago(days=created_days),
            "updated_at":      _ago(days=random.randint(0, 10)),
        })

    await db[PROJECTS_COLLECTION].insert_many(project_docs)
    summary["projects"] = len(project_docs)

    # ── 4. TASKS (250) ────────────────────────────────────────────────────────
    task_statuses = (
        ["TODO"] * 40 + ["IN_PROGRESS"] * 70 + ["REVIEW"] * 50 + ["DONE"] * 90
    )
    random.shuffle(task_statuses)

    task_priorities = ["high", "medium", "medium", "low"]
    task_ids: list[ObjectId] = []
    task_docs = []

    for i in range(250):
        tid    = ObjectId()
        task_ids.append(tid)
        proj   = random.choice(project_docs)
        status = task_statuses[i]
        prio   = random.choice(task_priorities)

        # assignee: prefer project staff
        pool    = (proj["staff_ids"] or staff_ids[:5])
        assignee = random.choice(pool) if pool else staff_ids[0]
        creator  = random.choice(admin_ids + sub_ids)

        # deadline
        if status == "DONE":
            deadline = _ago(days=random.randint(1, 30))
        elif status in ("IN_PROGRESS", "REVIEW"):
            deadline = _future(min_days=1, max_days=14) if random.random() > 0.3 else _ago(days=random.randint(1, 5))
        else:  # TODO
            deadline = _future(min_days=3, max_days=30) if random.random() > 0.2 else None

        created_at = _rand_date(60, 1)
        updated_at = created_at + timedelta(hours=random.randint(1, 200)) if status == "DONE" else _ago(days=random.randint(0, 5))

        idx = i % len(TASK_TITLES)
        task_docs.append({
            "_id":          tid,
            "title":        f"{TASK_TITLES[idx]} — {proj['title'][:25]}",
            "description":  f"Complete this deliverable as part of {proj['title']}.",
            "project_id":   proj["_id"],
            "team_id":      proj.get("team_id"),
            "assigned_to":  assignee,
            "assignees":    [assignee],
            "created_by":   creator,
            "visibility":   "team",
            "status":       status,
            "priority":     prio,
            "deadline":     deadline,
            "order":        i,
            "report_type":  None,
            "template_id":  None,
            "assign_to_all": False,
            "creator_name": next((d["name"] for d in user_docs if d["_id"] == creator), "Admin"),
            "creator_avatar": None,
            "created_at":   created_at,
            "updated_at":   updated_at,
        })

    await db[TASKS_COLLECTION].insert_many(task_docs)
    summary["tasks"] = len(task_docs)

    # ── 5. COMMENTS (500) ─────────────────────────────────────────────────────
    comment_docs = []
    for _ in range(500):
        task  = random.choice(task_docs)
        proj  = next((p for p in project_docs if p["_id"] == task["project_id"]), project_docs[0])
        author = random.choice(user_ids)
        comment_docs.append({
            "_id":        ObjectId(),
            "project_id": proj["_id"],
            "task_id":    task["_id"],
            "author_id":  author,
            "content":    random.choice(COMMENT_TEXTS),
            "is_deleted": False,
            "created_at": _rand_date(60, 1),
            "updated_at": _rand_date(30, 0),
        })
    await db[COMMENTS_COLLECTION].insert_many(comment_docs)
    summary["comments"] = len(comment_docs)

    # ── 6. FILES (100) ────────────────────────────────────────────────────────
    file_types = [
        ("application/pdf", ".pdf", "Report"),
        ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx", "Document"),
        ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx", "Spreadsheet"),
        ("image/jpeg", ".jpg", "Image"),
    ]
    file_docs = []
    for i in range(100):
        proj     = random.choice(project_docs)
        task     = random.choice(task_docs)
        ft       = random.choice(file_types)
        uploader = random.choice(user_ids)
        fname    = f"{ft[2]}_{i+1:03d}{ft[1]}"
        file_docs.append({
            "_id":           ObjectId(),
            "project_id":    proj["_id"],
            "uploaded_by":   uploader,
            "original_name": fname,
            "stored_name":   f"demo_{ObjectId()}{ft[1]}",
            "mime_type":     ft[0],
            "size_bytes":    random.randint(50_000, 5_000_000),
            "storage_path":  f"uploads/demo/{fname}",
            "context":       "task",
            "context_id":    task["_id"],
            "created_at":    _rand_date(90, 1),
        })
    await db[FILES_COLLECTION].insert_many(file_docs)
    summary["files"] = len(file_docs)

    # ── 7. EVENTS (60) ────────────────────────────────────────────────────────
    event_docs = []
    event_types = ["meeting", "deadline", "review", "training", "workshop"]
    for i in range(60):
        organizer = random.choice(admin_ids + sub_ids)
        start     = _rand_date(-30, -90) if i < 30 else datetime.utcnow() + timedelta(days=random.randint(1, 60))
        event_docs.append({
            "_id":         ObjectId(),
            "title":       EVENT_TITLES[i % len(EVENT_TITLES)],
            "description": f"Scheduled {event_types[i % len(event_types)]} session.",
            "type":        event_types[i % len(event_types)],
            "start_date":  start,
            "end_date":    start + timedelta(hours=random.randint(1, 3)),
            "date":        start,
            "location":    random.choice(["Conference Room A", "Online – Teams", "Main Hall", "Lab 101"]),
            "visibility":  "public",
            "created_by":  organizer,
            "owner_id":    organizer,
            "attendee_ids": random.sample(user_ids, random.randint(3, 8)),
            "created_at":  _rand_date(90, 1),
        })
    await db[EVENTS_COLLECTION].insert_many(event_docs)
    summary["events"] = len(event_docs)

    # ── 8. QUALITY STANDARDS (10) ─────────────────────────────────────────────
    qs_ids: list[ObjectId] = []
    qs_docs = []
    for std in QUALITY_STANDARDS:
        qsid = ObjectId()
        qs_ids.append(qsid)
        qs_docs.append({
            "_id":          qsid,
            "name":         std["name"],
            "description":  std["description"],
            "type":         std["type"],
            "status":       "active",
            "scope": {
                "level": "workspace",
                "ids":   [],
            },
            "rules": [
                {"field": "completeness", "operator": "gte", "value": std["threshold"]},
            ],
            "acceptance_threshold": std["threshold"],
            "created_by":   admin_ids[0],
            "created_at":   _rand_date(120, 60),
            "updated_at":   _rand_date(30, 1),
        })
    await db[QUALITY_STANDARDS_COLLECTION].insert_many(qs_docs)
    summary["quality_standards"] = len(qs_docs)

    # ── 9. QUALITY EVALUATIONS (120) ──────────────────────────────────────────
    qe_docs = []
    failed_std_pool = [s["name"] for s in QUALITY_STANDARDS]
    for i in range(120):
        task  = random.choice(task_docs)
        proj  = next((p for p in project_docs if p["_id"] == task["project_id"]), project_docs[0])
        score = random.randint(60, 100)
        verdict = "pass" if score >= 85 else "fail"
        failed_stds = random.sample(failed_std_pool, random.randint(1, 3)) if verdict == "fail" else []
        qe_docs.append({
            "_id":              ObjectId(),
            "task_id":          task["_id"],
            "project_id":       proj["_id"],
            "user_id":          task["assigned_to"],
            "score":            score,
            "verdict":          verdict,
            "report_type":      random.choice(["course_report", "program_report", "self_study", "survey_analysis", "exam_results_analysis"]),
            "failed_standards": failed_stds,
            "suggestions":      ["Improve documentation", "Add more evidence"] if verdict == "fail" else [],
            "created_at":       _rand_date(90, 1),
            "updated_at":       _rand_date(30, 0),
        })
    await db[QUALITY_EVALUATIONS_COLLECTION].insert_many(qe_docs)
    summary["quality_evaluations"] = len(qe_docs)

    # ── 10. QUALITY SCORES (120) ──────────────────────────────────────────────
    qs_score_docs = []
    for qe in qe_docs:
        qs_score_docs.append({
            "_id":        ObjectId(),
            "task_id":    qe["task_id"],
            "project_id": qe["project_id"],
            "user_id":    qe["user_id"],
            "score":      qe["score"],
            "team_id":    random.choice(team_ids),
            "created_at": qe["created_at"],
        })
    await db[QUALITY_SCORES_COLLECTION].insert_many(qs_score_docs)
    summary["quality_scores"] = len(qs_score_docs)

    # ── 11. QUALITY ANALYSES / REPORTS (40) ───────────────────────────────────
    qa_docs = []
    for i in range(40):
        proj    = random.choice(project_docs)
        task    = random.choice(task_docs)
        score   = random.randint(65, 98)
        verdict = "pass" if score >= 85 else "fail"
        qa_docs.append({
            "_id":         ObjectId(),
            "project_id":  proj["_id"],
            "task_id":     task["_id"],
            "triggered_by": random.choice(sub_ids + qc_ids),
            "score":       score,
            "verdict":     verdict,
            "report_type": random.choice(["course_report", "program_specification", "self_study"]),
            "summary":     f"Quality analysis completed with {score}% compliance score.",
            "findings":    [
                {"category": "Documentation", "score": random.randint(60, 100)},
                {"category": "Completeness",  "score": random.randint(60, 100)},
                {"category": "Accuracy",      "score": random.randint(60, 100)},
            ],
            "created_at":  _rand_date(90, 1),
        })
    await db[QUALITY_ANALYSES_COLLECTION].insert_many(qa_docs)
    summary["quality_analyses"] = len(qa_docs)

    # ── 12. AUDIT LOGS (200) ──────────────────────────────────────────────────
    audit_docs = []
    resource_types = ["project", "task", "user", "report", "quality_review", "file"]
    for i in range(200):
        actor = random.choice(user_docs)
        action = random.choice(AUDIT_ACTIONS)
        ts    = _rand_date(90, 0)
        audit_docs.append({
            "_id":           ObjectId(),
            "action":        action,
            "user_id":       actor["_id"],
            "user_name":     actor["name"],
            "user_role":     actor["role"],
            "resource_type": random.choice(resource_types),
            "resource_id":   str(ObjectId()),
            "details":       f"{actor['name']} performed {action.replace('_', ' ')}",
            "ip_address":    f"192.168.{random.randint(1,5)}.{random.randint(10,200)}",
            "timestamp":     ts,
            "created_at":    ts,
        })
    await db[AUDIT_LOGS_COLLECTION].insert_many(audit_docs)
    summary["audit_logs"] = len(audit_docs)

    # ── 13. MEMBERSHIPS ───────────────────────────────────────────────────────
    membership_docs = []
    seen_pairs: set[tuple] = set()
    for proj in project_docs:
        all_members = list(set(
            [proj["owner_id"]]
            + proj["sub_admin_ids"]
            + proj["staff_ids"]
        ))
        for uid in all_members:
            key = (str(uid), str(proj["_id"]))
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            user_role_rec = next((d["role"] for d in user_docs if d["_id"] == uid), "staff")
            mem_role = (
                "admin" if user_role_rec == "admin" else
                "subadmin" if user_role_rec == "sub_admin" else
                "member"
            )
            membership_docs.append({
                "_id":        ObjectId(),
                "user_id":    uid,
                "project_id": proj["_id"],
                "team_id":    proj.get("team_id"),
                "role":       mem_role,
                "managed_by": proj["owner_id"],
                "joined_at":  _rand_date(150, 30),
            })
    if membership_docs:
        await db[MEMBERSHIPS_COLLECTION].insert_many(membership_docs, ordered=False)
    summary["memberships"] = len(membership_docs)

    # ── 14. TASK BOARDS ───────────────────────────────────────────────────────
    board_docs = []
    existing_boards = {
        str(b["project_id"])
        async for b in db[TASK_BOARDS_COLLECTION].find({}, {"project_id": 1})
    }
    for proj in project_docs:
        if str(proj["_id"]) in existing_boards:
            continue
        board_docs.append({
            "_id":          ObjectId(),
            "project_id":   proj["_id"],
            "project_title": proj["title"],
            "description":  proj["description"],
            "status_label": proj["status"],
            "progress":     proj["progress"],
            "members":      [{"user_id": uid, "role": "member"} for uid in proj["staff_ids"]],
            "tasks":        [],
            "resources":    [],
            "comments":     [],
            "created_at":   proj["created_at"],
            "updated_at":   proj["updated_at"],
        })
    if board_docs:
        await db[TASK_BOARDS_COLLECTION].insert_many(board_docs, ordered=False)
    summary["task_boards"] = len(board_docs)

    summary["already_seeded"] = False
    summary["message"] = "Demo data seeded successfully!"
    return summary
