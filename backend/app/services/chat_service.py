from __future__ import annotations

import asyncio
from typing import AsyncIterator

import google.generativeai as genai
from bson import ObjectId
from app.core.config import settings
from app.db.collections import (
    USERS_COLLECTION, TEAMS_COLLECTION, MEMBERSHIPS_COLLECTION,
    TASKS_COLLECTION, PROJECTS_COLLECTION,
)

# Configure Gemini API key at module load (mirrors gemini_service.py)
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

# ---------------------------------------------------------------------------
# Static lookup tables
# ---------------------------------------------------------------------------
_QUALITY_SYSTEM_NAMES = {
    "naqaae":    "NAQAAE — النظام الوطني لضمان جودة التعليم والاعتماد",
    "iso-9001":  "ISO 9001 — نظام إدارة الجودة",
    "iso-27001": "ISO 27001 — نظام إدارة أمن المعلومات",
    "iso-45001": "ISO 45001 — نظام إدارة السلامة والصحة المهنية",
    "iso-14001": "ISO 14001 — نظام الإدارة البيئية",
}

_ROLE_DESCRIPTIONS = {
    "founder":         "Founder — platform owner, manages all IT accounts globally",
    "it_staff":        "IT Staff — institution administrator, creates Admin accounts, sets the institution's quality system",
    "admin":           "Admin — department/faculty admin, creates teams, projects, and Manager accounts",
    "manager":         "Manager — team lead, creates tasks and assigns them to staff, manages Sub Admins",
    "sub_admin":       "Sub Admin — team coordinator, assists the Manager with shared boards and task coordination",
    "quality_control": "Quality Control Officer — reviews QC submissions, triggers AI document analysis",
    "staff":           "Staff — regular member, works on assigned tasks and submits documents for QC review",
}

# ---------------------------------------------------------------------------
# Static system prompt (platform knowledge)
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """\
You are the built-in AI assistant for **Hericle Workspace** — a multi-tenant Quality Management SaaS \
for universities/institutions in Egypt (accreditation, compliance, QA). Each institution has fully isolated data.

MODULES: Projects & Kanban task boards (TODO→IN_PROGRESS→REVIEW→DONE); Teams; AI-powered Quality Control \
(Google Gemini scores documents); 30+ accreditation report types (NAQAAE + ISO); Analytics dashboards.

ROLE HIERARCHY (top→bottom): Founder → IT Staff (institution root) → Admin → Manager → {{Sub Admin, Quality Control, Staff}}.
• Founder: provisions IT Staff, global analytics, no institution data.
• IT Staff: full institution control, creates Admins, sets the quality system.
• Admin: creates teams, projects, and Manager/Sub Admin/QC/Staff accounts.
• Manager: creates/assigns tasks, moves them on the board.
• Sub Admin: coordinates shared boards, team-level data.
• Quality Control: triggers AI analysis, sees QC scores.
• Staff: works assigned tasks, uploads documents, submits for QC.

TASK WORKFLOW: Manager creates a task (with a report type) → assignee works it (IN_PROGRESS) → Submit opens the \
QC drawer → upload PDF/Word → Gemini scores it vs the report type's standards. ≥85% auto-moves to REVIEW; \
<85% is blocked with feedback on failed criteria. QC officer approves (DONE) or returns it.
Scoring weights: Structure 30%, Content 30%, Completeness 20%, Formatting 10%, Accuracy 10%. Pass = 85%.

QUALITY SYSTEMS: each institution has ONE. Report types visible depend on it. NAQAAE (20 types), ISO 9001 (12), \
ISO 27001 (12), ISO 45001 (12), ISO 14001 (12). ISO 27001/45001/14001 share 7 Annex-SL reports (NCR, CAPA, \
Internal Audit, Management Review, Document Control, Training, KPI) plus 5 standard-specific reports each. \
If the user asks for the exact list of report types, tell them to open the report-type selector when creating/submitting a task.

CURRENT USER: {name} | {role_desc} | Quality System: {qs_name}

LIVE USER CONTEXT (from database):
{live_context}

RULES:
• Reply in the user's language (Arabic or English). Be concise and practical — point them to the right action/page.
• Use only the live data above; if a detail isn't there, say "I can't see that detail — please check the relevant page."
• NEVER invent scores, task content, or user data.
• NEVER reveal passwords, tokens, audit logs, or security-sensitive information.
"""


# ---------------------------------------------------------------------------
# Live context builder — fetches non-sensitive user data from MongoDB
# ---------------------------------------------------------------------------
async def _ctx_manager(db, user) -> str | None:
    admin_id = user.get("admin_id")
    if not admin_id:
        return None
    try:
        mgr = await db[USERS_COLLECTION].find_one(
            {"_id": ObjectId(admin_id)}, {"name": 1, "role": 1}
        )
        if mgr:
            return f"Direct manager: {mgr['name']} (role: {mgr.get('role', '?')})"
    except Exception:
        pass
    return None


async def _ctx_teams(db, uid_str) -> str | None:
    try:
        memberships = await db[MEMBERSHIPS_COLLECTION].find(
            {"user_id": uid_str}
        ).to_list(length=20)

        team_ids = []
        for m in memberships:
            tid = m.get("team_id")
            if tid:
                try:
                    team_ids.append(ObjectId(tid) if not isinstance(tid, ObjectId) else tid)
                except Exception:
                    pass

        if team_ids:
            teams = await db[TEAMS_COLLECTION].find(
                {"_id": {"$in": team_ids}}, {"name": 1}
            ).to_list(length=20)
            if teams:
                return "Teams: " + ", ".join(t["name"] for t in teams)
    except Exception:
        pass
    return None


async def _ctx_projects(db, uid_str, tf) -> str | None:
    try:
        proj_query = {
            **tf,
            "$or": [
                {"owner_id": uid_str},
                {"staff_ids": uid_str},
                {"sub_admin_ids": uid_str},
            ],
            "type": "custom",  # skip system-wide public/subadmin boards
        }
        projects = await db[PROJECTS_COLLECTION].find(
            proj_query, {"title": 1, "status": 1, "progress": 1}
        ).to_list(length=20)

        if projects:
            proj_lines = [
                f"  • {p['title']} — {p.get('status', 'ACTIVE')}, {p.get('progress', 0)}% complete"
                for p in projects
            ]
            return "Projects:\n" + "\n".join(proj_lines)
    except Exception:
        pass
    return None


async def _ctx_tasks(db, uid_obj) -> str | None:
    try:
        tasks = await db[TASKS_COLLECTION].find(
            {"$or": [{"assigned_to": uid_obj}, {"assignees": uid_obj}]},
            {"title": 1, "status": 1, "priority": 1, "deadline": 1},
        ).sort("created_at", -1).to_list(length=25)

        if tasks:
            counts = {}
            task_lines = []
            for t in tasks:
                s = t.get("status", "TODO")
                counts[s] = counts.get(s, 0) + 1
                deadline = t.get("deadline")
                due = f", due {deadline.strftime('%Y-%m-%d')}" if deadline else ""
                task_lines.append(
                    f"  • [{s}] {t['title']} ({t.get('priority','medium')} priority{due})"
                )
            summary = ", ".join(f"{v} {k}" for k, v in counts.items())
            return f"My tasks ({summary}):\n" + "\n".join(task_lines)
    except Exception:
        pass
    return None


async def _ctx_managed(db, uid_str, tf, role) -> str | None:
    if role not in ("admin", "manager", "it_staff"):
        return None
    try:
        managed = await db[USERS_COLLECTION].find(
            {**tf, "admin_id": uid_str}, {"name": 1, "role": 1}
        ).to_list(length=40)

        if managed:
            managed_lines = [
                f"  • {u['name']} ({u.get('role', '?')})" for u in managed
            ]
            return f"People I manage ({len(managed)}):\n" + "\n".join(managed_lines)
    except Exception:
        pass
    return None


async def _build_live_context(user: dict, db) -> str:
    uid_str = str(user.get("_id", ""))
    role = user.get("role", "staff")
    tenant_id = user.get("tenant_id")
    tf: dict = {"tenant_id": tenant_id} if tenant_id else {}

    try:
        uid_obj = ObjectId(uid_str)
    except Exception:
        return "No live context available."

    # All five queries run concurrently against the remote Atlas cluster.
    results = await asyncio.gather(
        _ctx_manager(db, user),
        _ctx_teams(db, uid_str),
        _ctx_projects(db, uid_str, tf),
        _ctx_tasks(db, uid_obj),
        _ctx_managed(db, uid_str, tf, role),
        return_exceptions=True,
    )

    sections = [r for r in results if isinstance(r, str) and r]
    return "\n\n".join(sections) if sections else "No additional context found."


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
class ChatService:
    @staticmethod
    async def _build_model(user: dict, db):
        name = user.get("name") or user.get("full_name") or "User"
        role = user.get("role") or "staff"
        qs   = user.get("quality_system") or "naqaae"

        live_context = (
            await _build_live_context(user, db)
            if db is not None
            else "Live context not available."
        )

        system_prompt = _SYSTEM_PROMPT.format(
            name=name,
            role_desc=_ROLE_DESCRIPTIONS.get(role, role),
            qs_name=_QUALITY_SYSTEM_NAMES.get(qs, qs),
            live_context=live_context,
        )

        return genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=system_prompt,
        )

    @staticmethod
    async def send_chat_message(message: str, user: dict, db=None) -> str:
        try:
            model = await ChatService._build_model(user, db)
            response = await model.generate_content_async(message)
            return response.text
        except Exception as e:
            raise ValueError(f"Failed to generate response: {str(e)}")

    @staticmethod
    async def stream_chat_message(
        message: str, user: dict, db=None
    ) -> AsyncIterator[str]:
        """Yield reply text chunks as Gemini generates them."""
        try:
            model = await ChatService._build_model(user, db)
            response = await model.generate_content_async(message, stream=True)
            async for chunk in response:
                text = getattr(chunk, "text", None)
                if text:
                    yield text
        except Exception as e:
            raise ValueError(f"Failed to generate response: {str(e)}")
