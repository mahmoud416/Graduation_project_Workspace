"""
AI Pipeline Validation Script
==============================
Validates the full Quality Control AI pipeline:
    Test Data → AI Analysis → Result Generation → MongoDB Storage → Dashboard Output

Run from the backend/ directory:
    python -m scripts.validate_ai_pipeline
"""
import asyncio
import json
import sys
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import io

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# ── path bootstrap (run from backend/) ──────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# ── Force UTF-8 stdout/stderr on Windows ────────────────────────────────────
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from app.core.config import settings
from app.db.collections import (
    QUALITY_ANALYSES_COLLECTION,
    QUALITY_STANDARDS_COLLECTION,
    TODO_AUDIT_COLLECTION,
    TASKS_COLLECTION,
)
from app.schemas.quality_control import QualityAnalysisRequest, QualityStandardCreate
from app.services.ai_service import analyze_task_against_standards, _is_openai_configured
from app.services.quality_analysis_service import QualityAnalysisService
from app.services.quality_standard_service import QualityStandardService

# ── Constants ────────────────────────────────────────────────────────────────

VALIDATOR_USER_ID = ObjectId("000000000000000000000099")
TEST_PROJECT_ID = "validation-project-001"

SEPARATOR = "=" * 70
SUB_SEP = "-" * 70

# ── ANSI colour helpers ──────────────────────────────────────────────────────

def _c(text: str, code: str) -> str:
    """Wrap text in ANSI colour (skipped on Windows without a terminal)."""
    try:
        if sys.stdout.isatty():
            return f"\033[{code}m{text}\033[0m"
    except Exception:
        pass
    return text

OK  = lambda t: _c(t, "32")   # green
ERR = lambda t: _c(t, "31")   # red
WARN= lambda t: _c(t, "33")   # yellow
HDR = lambda t: _c(t, "36;1") # cyan bold


# ═══════════════════════════════════════════════════════════════════════════════
# 1. TEST DATA DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

QUALITY_STANDARDS_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "title": "[VALIDATION] General Task Quality Standard",
        "description": (
            "Baseline standard applied to every task: requires a clear description, "
            "acceptance criteria, and linked deliverables."
        ),
        "type": "text",
        "rules": [
            {
                "label": "Task has a clear, detailed description",
                "instructions": (
                    "The task description must be at least 30 words, explain the goal, "
                    "and specify what done looks like."
                ),
                "weight": 0.35,
            },
            {
                "label": "Acceptance criteria are explicitly defined",
                "instructions": (
                    "List measurable conditions that determine whether the task is complete "
                    "(e.g., 'login form submits without errors on mobile')."
                ),
                "weight": 0.30,
            },
            {
                "label": "Task is scoped to a single deliverable",
                "instructions": (
                    "One task should cover one logical deliverable. "
                    "If it covers more than one area, split it."
                ),
                "weight": 0.20,
            },
            {
                "label": "Priority and deadline are stated",
                "instructions": "Priority (low/medium/high) and target delivery date must be present.",
                "weight": 0.15,
            },
        ],
        "dataset_refs": [],
        "scope": {"level": "all", "ids": []},
        "status": "active",
    },
    {
        "title": "[VALIDATION] UI Task Quality Standard",
        "description": (
            "Applied to tasks that involve UI design or front-end implementation. "
            "Requires screenshots, responsive design notes, and component annotations."
        ),
        "type": "text",
        "rules": [
            {
                "label": "UI mockup or screenshot is attached",
                "instructions": (
                    "At least one wireframe, mockup, or screenshot must be provided "
                    "showing the intended layout."
                ),
                "weight": 0.30,
            },
            {
                "label": "Responsive breakpoints are documented",
                "instructions": (
                    "Describe how the UI behaves at mobile (≤768 px), tablet (769–1024 px), "
                    "and desktop (≥1025 px) widths."
                ),
                "weight": 0.25,
            },
            {
                "label": "Navigation and layout elements are labelled",
                "instructions": (
                    "Each element (header, nav, form, footer) must be labelled in the description "
                    "or annotated in the mockup."
                ),
                "weight": 0.25,
            },
            {
                "label": "Accessibility requirements are mentioned",
                "instructions": (
                    "State colour-contrast targets (WCAG AA minimum), keyboard-navigation "
                    "support, and ARIA roles for interactive controls."
                ),
                "weight": 0.20,
            },
        ],
        "dataset_refs": [],
        "scope": {"level": "all", "ids": []},
        "status": "active",
    },
    {
        "title": "[VALIDATION] Documentation Task Quality Standard",
        "description": (
            "Applied to tasks that produce technical or user documentation. "
            "Requires structured steps, code examples, and versioning."
        ),
        "type": "text",
        "rules": [
            {
                "label": "Documentation includes structured step-by-step instructions",
                "instructions": (
                    "Each procedure must use numbered steps. "
                    "Avoid prose-only explanations for operational content."
                ),
                "weight": 0.35,
            },
            {
                "label": "Code or command examples are provided",
                "instructions": (
                    "Any API endpoint, CLI command, or configuration block must be shown "
                    "in a code block with syntax highlighting language specified."
                ),
                "weight": 0.30,
            },
            {
                "label": "Document includes a version and change log",
                "instructions": (
                    "Header must state the document version, author, and date. "
                    "A changelog section is required for v2 and above."
                ),
                "weight": 0.20,
            },
            {
                "label": "Error scenarios and troubleshooting are covered",
                "instructions": (
                    "Add a 'Troubleshooting' or 'Common Errors' section with at least "
                    "two error cases and their resolutions."
                ),
                "weight": 0.15,
            },
        ],
        "dataset_refs": [],
        "scope": {"level": "all", "ids": []},
        "status": "active",
    },
]


# ── Test task definitions ── varying quality levels intentionally ─────────────

TEST_TASKS: List[Dict[str, Any]] = [
    # ── Task 1: HIGH QUALITY – UI task, well-described ────────────────────────
    {
        "id": "val-task-001",
        "title": "Create Login Page UI",
        "description": (
            "Design and implement a fully responsive login page for the Hericle web application.\n\n"
            "Requirements:\n"
            "- Email and password input fields with client-side validation (required, email format, min 8 chars).\n"
            "- 'Remember me' checkbox and 'Forgot password?' link.\n"
            "- Submit button disabled until both fields are non-empty.\n"
            "- Error banner for incorrect credentials (API response 401).\n"
            "- Redirect to /dashboard on successful login (JWT stored in httpOnly cookie).\n\n"
            "Responsive breakpoints:\n"
            "- Mobile (≤768 px): single-column centred card, full-width button.\n"
            "- Desktop (≥1025 px): centred card, max-width 420 px with drop shadow.\n\n"
            "Accessibility: WCAG AA contrast, tab order: email → password → remember → submit, "
            "ARIA labels on all inputs.\n\n"
            "Acceptance criteria:\n"
            "1. Form renders correctly on Chrome, Firefox, Safari (latest).\n"
            "2. Validation messages appear inline below each field.\n"
            "3. Login succeeds with valid credentials and fails gracefully with invalid ones.\n\n"
            "Priority: High  |  Deadline: 2026-03-28\n\n"
            "Mockup: Figma frame 'login-v2' (see attached screenshot).\n"
            "Navigation elements: top logo, centred card with header, footer link to sign-up."
        ),
        "standard_names": [
            "[VALIDATION] General Task Quality Standard",
            "[VALIDATION] UI Task Quality Standard",
        ],
        "attachments": {
            "file_texts": [
                {
                    "file_name": "login_component_spec.md",
                    "file_type": "document",
                    "content": (
                        "# Login Component Specification v1.0\n"
                        "Author: UX Team  |  Date: 2026-03-10\n\n"
                        "## Overview\nSingle-page login component built with React + Tailwind CSS.\n\n"
                        "## Props\n| Prop | Type | Default | Description |\n"
                        "|------|------|---------|-------------|\n"
                        "| onSuccess | Function | – | Callback after successful auth |\n"
                        "| redirectPath | string | '/dashboard' | Post-login route |\n\n"
                        "## Step-by-step usage\n"
                        "1. Import `<LoginForm />` from `@/components/auth/LoginForm`.\n"
                        "2. Wrap in `<AuthProvider>` context.\n"
                        "3. Pass `onSuccess` prop to handle post-login navigation.\n\n"
                        "## Error codes\n- 401: Invalid credentials → show inline alert.\n"
                        "- 429: Rate limited → show retry timer.\n"
                        "## Changelog\n- v1.0: Initial spec."
                    ),
                }
            ],
            "images": [],
        },
        "expected_quality": "HIGH",
    },

    # ── Task 2: MEDIUM QUALITY – Documentation task, missing some elements ───
    {
        "id": "val-task-002",
        "title": "Create API Documentation for Authentication Endpoints",
        "description": (
            "Write comprehensive documentation for the authentication API.\n\n"
            "Cover the following endpoints:\n"
            "- POST /api/v1/auth/login\n"
            "- POST /api/v1/auth/logout\n"
            "- POST /api/v1/auth/refresh\n\n"
            "For each endpoint include: HTTP method, URL, request body schema, "
            "response schema, and possible HTTP status codes.\n\n"
            "Use OpenAPI 3.0 format where applicable.\n\n"
            "Priority: Medium\n"
            "Target audience: backend developers and QA engineers."
        ),
        "standard_names": [
            "[VALIDATION] General Task Quality Standard",
            "[VALIDATION] Documentation Task Quality Standard",
        ],
        "attachments": {
            "file_texts": [
                {
                    "file_name": "auth_api_draft.md",
                    "file_type": "document",
                    "content": (
                        "# Authentication API\n\n"
                        "## POST /api/v1/auth/login\n"
                        "Authenticates a user and returns a JWT token.\n\n"
                        "Request body:\n```json\n{ \"email\": \"user@example.com\", \"password\": \"secret\" }\n```\n\n"
                        "Response 200:\n```json\n{ \"access_token\": \"eyJ...\", \"token_type\": \"bearer\" }\n```\n\n"
                        "Response 401: Invalid credentials.\n\n"
                        "## POST /api/v1/auth/logout\n"
                        "Invalidates the current session token.\n\n"
                        "## POST /api/v1/auth/refresh\n"
                        "Issues a new access token using a valid refresh token.\n"
                    ),
                }
            ],
            "images": [],
        },
        "expected_quality": "MEDIUM",
    },

    # ── Task 3: LOW QUALITY – vague, missing most standards ──────────────────
    {
        "id": "val-task-003",
        "title": "Fix the dashboard",
        "description": "The dashboard is broken. Please fix it.",
        "standard_names": [
            "[VALIDATION] General Task Quality Standard",
        ],
        "attachments": {"file_texts": [], "images": []},
        "expected_quality": "LOW",
    },

    # ── Task 4: MEDIUM-HIGH – Code review task, good description, no screenshots
    {
        "id": "val-task-004",
        "title": "Code Review: User Authentication Service Refactor",
        "description": (
            "Perform a thorough code review of the authentication service refactoring PR #142.\n\n"
            "Review checklist:\n"
            "1. Verify JWT signing algorithm is HS256 and key length >= 256 bits.\n"
            "2. Confirm password hashing uses bcrypt with cost factor >= 12.\n"
            "3. Check that refresh token rotation is implemented correctly "
            "(old token invalidated on use).\n"
            "4. Ensure all new functions have docstrings and type annotations.\n"
            "5. Validate that unit tests cover the happy path and at least two error paths.\n"
            "6. Confirm no secrets are hard-coded.\n\n"
            "Acceptance criteria:\n"
            "- All checklist items pass.\n"
            "- No critical or high-severity findings remain open.\n"
            "- PR approved and merged within sprint.\n\n"
            "Priority: High  |  Deadline: 2026-03-20\n"
            "Assigned to: Senior Backend Developer"
        ),
        "standard_names": [
            "[VALIDATION] General Task Quality Standard",
            "[VALIDATION] Documentation Task Quality Standard",
        ],
        "attachments": {"file_texts": [], "images": []},
        "expected_quality": "MEDIUM-HIGH",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# 2. HELPER: Print utilities
# ═══════════════════════════════════════════════════════════════════════════════

def _score_badge(score: float) -> str:
    if score >= 80:
        return OK(f"[{score:.1f}% – GOOD]")
    if score >= 55:
        return WARN(f"[{score:.1f}% – NEEDS WORK]")
    return ERR(f"[{score:.1f}% – POOR]")


def _print_section(title: str) -> None:
    print(f"\n{SEPARATOR}")
    print(HDR(f"  {title}"))
    print(SEPARATOR)


def _print_result(analysis: Dict[str, Any], task: Dict[str, Any]) -> None:
    score = analysis.get("score", 0.0)
    passed = analysis.get("passed_rules", [])
    failed = analysis.get("failed_rules", [])
    suggestions = analysis.get("suggestions", [])
    mode = analysis.get("ai_mode", "unknown")

    print(f"\n  Task  : {task['title']}")
    print(f"  ID    : {task['id']}")
    print(f"  Mode  : {'online (GPT-4o)' if mode == 'online' else 'offline (heuristic)'}")
    print(f"  Score : {_score_badge(score)}")
    print(f"  Expect: {task['expected_quality']}")

    print(f"\n  {OK('PASSED STANDARDS')} ({len(passed)})")
    if passed:
        for p in passed:
            rule_text = p.get("rule") or p.get("label") or "(unnamed rule)"
            print(f"    [+] {rule_text[:80]}")
    else:
        print("    (none)")

    print(f"\n  {ERR('FAILED STANDARDS')} ({len(failed)})")
    if failed:
        for f_item in failed:
            rule_text = f_item.get("rule") or f_item.get("label") or "(unnamed rule)"
            reason = f_item.get("reason", "")
            print(f"    [-] {rule_text[:70]}")
            if reason:
                print(f"        Reason: {reason[:80]}")
    else:
        print("    (none – all passed)")

    print(f"\n  {WARN('SUGGESTIONS')}")
    if suggestions:
        for s in suggestions[:4]:
            print(f"    >> {s[:100]}")
    else:
        print("    (no suggestions)")
    print(f"\n  {SUB_SEP}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. PIPELINE STEPS
# ═══════════════════════════════════════════════════════════════════════════════

async def step1_create_standards(db) -> Dict[str, ObjectId]:
    """Create (or reuse) validation quality standards. Returns title → _id map."""
    _print_section("STEP 1 — CREATE QUALITY STANDARDS")
    standard_ids: Dict[str, ObjectId] = {}
    for defn in QUALITY_STANDARDS_DEFINITIONS:
        existing = await db[QUALITY_STANDARDS_COLLECTION].find_one({"title": defn["title"]})
        if existing:
            standard_ids[defn["title"]] = existing["_id"]
            print(f"  [SKIP] '{defn['title']}' already exists → {existing['_id']}")
            continue
        payload = QualityStandardCreate(**defn)
        doc = await QualityStandardService.create_standard(
            db, payload, created_by=VALIDATOR_USER_ID
        )
        _id = ObjectId(doc["_id"]) if isinstance(doc["_id"], str) else doc["_id"]
        standard_ids[defn["title"]] = _id
        print(f"  {OK('[OK]')} Created '{defn['title']}' → {_id}")

    rules_total = sum(len(d["rules"]) for d in QUALITY_STANDARDS_DEFINITIONS)
    print(f"\n  Standards total : {len(standard_ids)}")
    print(f"  Rules total     : {rules_total}")
    return standard_ids


async def step2_prepare_tasks(db) -> List[Dict[str, Any]]:
    """Insert lightweight task placeholders so task_id is resolvable."""
    _print_section("STEP 2 — PREPARE TEST TASK RECORDS")
    prepared = []
    for task in TEST_TASKS:
        existing = await db[TASKS_COLLECTION].find_one({"_id": task["id"]})
        if not existing:
            doc = {
                "_id": task["id"],
                "title": task["title"],
                "description": task["description"],
                "project_id": TEST_PROJECT_ID,
                "status": "TODO",
                "priority": "high",
                "created_by": VALIDATOR_USER_ID,
                "created_at": datetime.utcnow(),
            }
            await db[TASKS_COLLECTION].insert_one(doc)
            print(f"  {OK('[OK]')} Inserted task '{task['title']}'")
        else:
            print(f"  [SKIP] Task '{task['title']}' already in DB")
        prepared.append(task)
    return prepared


async def step3_run_ai_analysis(
    db,
    tasks: List[Dict[str, Any]],
    standard_ids: Dict[str, ObjectId],
) -> List[Dict[str, Any]]:
    """Run AI analysis for each test task and persist results."""
    _print_section("STEP 3 — RUN AI ANALYSIS PIPELINE")

    mode_label = OK("ONLINE  (GPT-4o)") if _is_openai_configured() else WARN("OFFLINE (heuristic)")
    print(f"  AI mode: {mode_label}\n")

    results = []
    for task in tasks:
        print(f"  Analysing → '{task['title']}' …")

        # Resolve standard ObjectIds for this task
        std_ids = [
            str(standard_ids[name])
            for name in task["standard_names"]
            if name in standard_ids
        ]

        request = QualityAnalysisRequest(
            task_id=task["id"],
            project_id=TEST_PROJECT_ID,
            task_title=task["title"],
            task_description=task["description"],
            standard_ids=std_ids,
            triggered_by=str(VALIDATOR_USER_ID),
        )

        try:
            analysis_doc = await QualityAnalysisService.run_analysis(
                db,
                request,
                triggered_by=VALIDATOR_USER_ID,
                file_texts=task["attachments"].get("file_texts", []),
                image_bytes=task["attachments"].get("images", []),
            )
            results.append({"task": task, "analysis": analysis_doc, "error": None})
            score = analysis_doc.get("score", 0.0)
            print(f"  {OK('[OK]')} Score {score:.1f}%  –  analysis_id: {analysis_doc.get('_id', '?')}")
        except Exception as exc:
            print(f"  {ERR('[FAIL]')} {exc}")
            traceback.print_exc()
            results.append({"task": task, "analysis": None, "error": str(exc)})

    return results


async def step4_verify_db_storage(db, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Re-read each stored analysis from MongoDB and verify required fields."""
    _print_section("STEP 4 — VERIFY DATABASE STORAGE")

    required_fields = {
        "task_id", "task_title", "project_id", "score",
        "passed_rules", "failed_rules", "suggestions",
        "status", "created_at",
    }

    verified = []
    for row in results:
        if row["analysis"] is None:
            print(f"  {ERR('[SKIP]')} {row['task']['id']} – analysis failed, skipping DB check")
            verified.append({**row, "db_ok": False, "missing_fields": [], "db_doc": None})
            continue

        analysis_id = row["analysis"].get("_id")
        stored = None
        if analysis_id:
            try:
                stored = await db[QUALITY_ANALYSES_COLLECTION].find_one(
                    {"_id": ObjectId(str(analysis_id))} if ObjectId.is_valid(str(analysis_id))
                    else {"task_id": row["task"]["id"]}
                )
            except Exception:
                stored = await db[QUALITY_ANALYSES_COLLECTION].find_one(
                    {"task_id": row["task"]["id"]}
                )

        if not stored:
            stored = await db[QUALITY_ANALYSES_COLLECTION].find_one(
                {"task_id": row["task"]["id"]}
            )

        if stored:
            missing = [f for f in required_fields if f not in stored]
            ok_str = OK("[OK]") if not missing else WARN("[WARN]")
            print(f"  {ok_str} {row['task']['id']} – found in DB | "
                  f"score={stored.get('score', '?')} | "
                  f"missing_fields={missing or 'none'}")
            verified.append({**row, "db_ok": not missing, "missing_fields": missing, "db_doc": stored})
        else:
            print(f"  {ERR('[FAIL]')} {row['task']['id']} – NOT found in MongoDB!")
            verified.append({**row, "db_ok": False, "missing_fields": list(required_fields), "db_doc": None})

    return verified


# ═══════════════════════════════════════════════════════════════════════════════
# 4. REPORT GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def _print_ai_results(verified: List[Dict[str, Any]]) -> None:
    _print_section("STEP 5 — AI EVALUATION RESULTS")
    for row in verified:
        if row["analysis"]:
            _print_result(row["analysis"], row["task"])
        else:
            print(f"\n  {ERR('[FAIL]')} Task '{row['task']['title']}' – analysis error: {row.get('error')}\n")


def _print_db_examples(verified: List[Dict[str, Any]]) -> None:
    _print_section("STEP 6 — EXAMPLE DATABASE DOCUMENTS")
    for row in verified:
        doc = row.get("db_doc")
        if not doc:
            continue
        printable = {
            "task_id": doc.get("task_id"),
            "task_title": doc.get("task_title"),
            "project_id": doc.get("project_id"),
            "quality_score": doc.get("score"),
            "passed_standards": [
                p.get("rule") or p.get("label") for p in (doc.get("passed_rules") or [])
            ],
            "failed_standards": [
                {"rule": f.get("rule") or f.get("label"), "reason": f.get("reason")}
                for f in (doc.get("failed_rules") or [])
            ],
            "suggestions": doc.get("suggestions", []),
            "ai_mode": doc.get("ai_mode"),
            "status": doc.get("status"),
            "timestamp": str(doc.get("created_at", "")),
        }
        print(f"\n  Collection: quality_analyses")
        print(f"  Document  : {row['task']['id']}")
        print("  " + "-" * 60)
        print("  " + json.dumps(printable, indent=4, default=str).replace("\n", "\n  "))


def _print_pipeline_architecture() -> None:
    _print_section("PIPELINE ARCHITECTURE")
    print("""
  ┌─────────────────────────────────────────────────────────────┐
  │           HERICLE AI QUALITY CONTROL PIPELINE               │
  └─────────────────────────────────────────────────────────────┘

  ┌──────────────┐   task_id, title,    ┌──────────────────────┐
  │  QC User /   │──── description, ───▶│  POST /qc/tasks/     │
  │  API Client  │    standard_ids,     │  {id}/analyze        │
  │              │    attachments       │  (qc.py route)       │
  └──────────────┘                      └──────────┬───────────┘
                                                   │
                                        QualityAnalysisService
                                        .run_analysis()
                                                   │
                              ┌────────────────────▼────────────────────┐
                              │         QualityStandardService          │
                              │  fetch_applicable_standards(db, ids)    │
                              │  → resolves rules[] from MongoDB         │
                              └────────────────────┬────────────────────┘
                                                   │ standards_rules[]
                              ┌────────────────────▼────────────────────┐
                              │             ai_service.py               │
                              │  analyze_task_against_standards()       │
                              │                                         │
                              │  ┌──────────────┐  ┌─────────────────┐ │
                              │  │ OpenAI GPT-4o│  │ Offline         │ │
                              │  │ (online)     │  │ Heuristic       │ │
                              │  │ + Vision API │  │ (fallback)      │ │
                              │  │ + Web Search │  │                 │ │
                              │  └──────┬───────┘  └────────┬────────┘ │
                              │         └────────┬───────────┘         │
                              └──────────────────┼─────────────────────┘
                                                 │ JSON result:
                                                 │ {compliance_score,
                                                 │  passed_standards,
                                                 │  failed_standards,
                                                 │  suggestions}
                              ┌──────────────────▼─────────────────────┐
                              │          MongoDB Storage                │
                              │  quality_analyses collection           │
                              │  {task_id, score, passed_rules,        │
                              │   failed_rules, suggestions, …}        │
                              └──────────────────┬─────────────────────┘
                                                 │
                              ┌──────────────────▼─────────────────────┐
                              │        Dashboard / REST API             │
                              │  GET /qc/analyses          (list)      │
                              │  GET /qc/tasks/{id}/analysis/latest    │
                              │  GET /qc/reports/overview  (chart)     │
                              └─────────────────────────────────────────┘
""")


def _print_pipeline_validation(verified: List[Dict[str, Any]]) -> None:
    _print_section("PIPELINE VALIDATION SUMMARY")

    stages = [
        ("Quality Standards Created",   all(True for _ in QUALITY_STANDARDS_DEFINITIONS)),
        ("Test Tasks Inserted",          len(verified) == len(TEST_TASKS)),
        ("AI Analysis Completed",        all(r["analysis"] is not None for r in verified)),
        ("Results Stored in MongoDB",    all(r["db_ok"] for r in verified)),
        ("Dashboard Data Available",     any(r["db_doc"] is not None for r in verified)),
    ]

    all_pass = True
    for label, passed in stages:
        icon = OK("[PASS]") if passed else ERR("[FAIL]")
        print(f"  {icon}  {label}")
        if not passed:
            all_pass = False

    scores = [r["analysis"]["score"] for r in verified if r["analysis"]]
    if scores:
        avg = sum(scores) / len(scores)
        print(f"\n  Analyses run     : {len(scores)} / {len(TEST_TASKS)}")
        print(f"  Average score    : {avg:.1f}%")
        print(f"  Score range      : {min(scores):.1f}% – {max(scores):.1f}%")
        online_count = sum(
            1 for r in verified
            if r["analysis"] and r["analysis"].get("ai_mode") == "online"
        )
        mode_str = f"{online_count} online, {len(scores) - online_count} offline"
        print(f"  AI mode          : {mode_str}")

    print(f"\n  Overall pipeline : {OK('ALL STAGES PASS') if all_pass else ERR('ONE OR MORE STAGES FAILED')}")


def _print_improvements() -> None:
    _print_section("SUGGESTED IMPROVEMENTS TO THE AI SYSTEM")
    improvements = [
        (
            "1. PROMPT ENGINEERING",
            [
                "Add 'chain-of-thought' reasoning: ask the model to explain its score "
                "calculation before emitting JSON (improves consistency).",
                "Include a one-shot example in the system prompt showing a perfect "
                "(score=100) and a poor (score=20) evaluation to anchor the scoring scale.",
                "For UI tasks, instruct GPT-4o to list every visual element it identifies "
                "in attached screenshots before scoring – avoids hallucinated passes.",
            ],
        ),
        (
            "2. SCORING SYSTEM",
            [
                "Replace the current all-or-nothing per-rule pass/fail with a partial-credit "
                "model: each rule returns 0–1 and the compliance_score becomes "
                "Σ(rule_score × weight) / Σ(weights).",
                "Introduce a severity tier (critical / major / minor) so a missing "
                "critical rule caps the total score at 60 regardless of other passes.",
                "Store historical score distributions per standard so outlier analyses "
                "can be flagged automatically.",
            ],
        ),
        (
            "3. QUALITY RULES STRUCTURE",
            [
                "Add a `check_type` field to RuleDefinition: "
                "'presence' (binary), 'regex' (pattern match), 'length' (word count), "
                "'ai' (GPT judgement). Presence/regex/length checks run cheaply offline; "
                "only 'ai' rules consume tokens.",
                "Support rule inheritance so global rules (weight=0.1 baseline) can be "
                "overridden by project-specific rules without duplication.",
            ],
        ),
        (
            "4. IMAGE / SCREENSHOT ANALYSIS",
            [
                "Use GPT-4o 'detail: high' only for the first image; switch subsequent "
                "images to 'detail: low' to reduce token cost.",
                "Pre-process uploaded screenshots with a lightweight element-detection "
                "pass (e.g., detect_navigation_bar, detect_form_fields) before sending "
                "to the vision API – this allows offline image rules.",
                "Validate image dimensions before analysis: reject images smaller than "
                "200×200 px or larger than 4 MB, returning a clear error to the uploader.",
            ],
        ),
        (
            "5. RELIABILITY & OBSERVABILITY",
            [
                "Add a retry wrapper around OpenAI calls (3 attempts, exponential backoff) "
                "to handle transient 429/500 errors.",
                "Log token usage (prompt_tokens, completion_tokens) per analysis request "
                "to the quality_analyses document for cost tracking.",
                "Store the raw GPT response alongside the parsed result for audit – "
                "currently _raw is discarded before MongoDB insertion in QualityAnalysisService.",
                "Set analysis status='pending' immediately on job creation, then update to "
                "'completed' or 'failed' asynchronously – allows the API to return 202 "
                "instantly and let the client poll for results.",
            ],
        ),
        (
            "6. DUAL ROUTE CONSOLIDATION",
            [
                "The system has two parallel QC route modules (quality.py and qc.py). "
                "They use separate collections (quality_evaluations vs quality_analyses). "
                "Consolidate both flows into qc.py / QUALITY_ANALYSES_COLLECTION and "
                "deprecate the legacy quality.py endpoints to avoid split data.",
            ],
        ),
    ]

    for title, points in improvements:
        print(f"\n  {WARN(title)}")
        for point in points:
            # word-wrap at 80 chars
            words = point.split()
            line = "    • "
            for word in words:
                if len(line) + len(word) + 1 > 84:
                    print(line)
                    line = "      " + word + " "
                else:
                    line += word + " "
            if line.strip():
                print(line)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. CLEAN-UP (optional)
# ═══════════════════════════════════════════════════════════════════════════════

async def cleanup_validation_data(db) -> None:
    """Remove all documents created by this validation run."""
    print("\n  Cleaning up validation data …")
    task_ids = [t["id"] for t in TEST_TASKS]

    r1 = await db[QUALITY_ANALYSES_COLLECTION].delete_many({"task_id": {"$in": task_ids}})
    r2 = await db[TASKS_COLLECTION].delete_many({"_id": {"$in": task_ids}})
    r3 = await db[QUALITY_STANDARDS_COLLECTION].delete_many(
        {"title": {"$regex": "^\\[VALIDATION\\]"}}
    )
    print(f"  Removed: {r1.deleted_count} analyses, "
          f"{r2.deleted_count} tasks, "
          f"{r3.deleted_count} standards")


# ═══════════════════════════════════════════════════════════════════════════════
# 6. MAIN
# ═══════════════════════════════════════════════════════════════════════════════

async def main(cleanup: bool = False) -> None:
    print(f"\n{HDR(SEPARATOR)}")
    print(HDR("  HERICLE  –  AI QUALITY CONTROL PIPELINE VALIDATION"))
    print(HDR(f"  {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"))
    print(HDR(SEPARATOR))

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    print(f"\n  MongoDB : {settings.MONGODB_URL}")
    print(f"  DB name : {settings.MONGODB_DB_NAME}")
    print(f"  OpenAI  : {'configured' if _is_openai_configured() else 'NOT configured (offline mode)'}")

    try:
        # ── Pipeline stages ───────────────────────────────────────────────────
        standard_ids = await step1_create_standards(db)
        tasks        = await step2_prepare_tasks(db)
        results      = await step3_run_ai_analysis(db, tasks, standard_ids)
        verified     = await step4_verify_db_storage(db, results)

        # ── Reporting ─────────────────────────────────────────────────────────
        _print_ai_results(verified)
        _print_db_examples(verified)
        _print_pipeline_architecture()
        _print_pipeline_validation(verified)
        _print_improvements()

        # ── Cleanup flag ──────────────────────────────────────────────────────
        if cleanup:
            _print_section("CLEANUP")
            await cleanup_validation_data(db)
        else:
            print(f"\n  {WARN('TIP')}: Validation data remains in MongoDB. "
                  "Re-run with --cleanup to remove it.")

    finally:
        client.close()

    print(f"\n{SEPARATOR}\n  Validation complete.\n{SEPARATOR}\n")


if __name__ == "__main__":
    cleanup_flag = "--cleanup" in sys.argv
    asyncio.run(main(cleanup=cleanup_flag))
