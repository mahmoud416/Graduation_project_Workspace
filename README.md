# Orbit Workspace — Enterprise QA Platform

A full-stack university Quality Assurance platform built for accreditation workflows, task management, AI-powered document evaluation, and multi-tenant team collaboration.

**Stack:** FastAPI (Python 3.11) · React 18 + TypeScript · Vite · MongoDB Atlas · Google Gemini AI · ChromaDB (RAG)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Role System](#3-role-system)
4. [Feature Modules](#4-feature-modules)
5. [AI Evaluation Pipeline](#5-ai-evaluation-pipeline)
6. [API Reference](#6-api-reference)
7. [Database Schema](#7-database-schema)
8. [Setup & Running](#8-setup--running)
9. [Environment Variables](#9-environment-variables)
10. [Recent Updates & Bug Fixes](#10-recent-updates--bug-fixes)
11. [Security Hardening](#11-security-hardening)

---

## 1. Project Overview

Orbit Workspace is an accreditation-ready quality management system designed for universities. It allows academic departments to:

- Organize work into **Teams → Projects → Tasks** with a role hierarchy
- Submit reports and documents for **AI-powered compliance evaluation** against accreditation standards
- Track QC scores, generate analytics, and produce accreditation reports
- Manage the full lifecycle of 20 report types (course reports, self-study, program specifications, etc.)

The system supports **bilingual content** (Arabic / English) and uses **Google Gemini** for native PDF understanding.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vite + React)               │
│  localhost:5173                                              │
│  React 18 · TypeScript · Tailwind CSS · React Router v6     │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST (JSON) + WebSocket
┌───────────────────────▼─────────────────────────────────────┐
│                     Backend (FastAPI)                        │
│  localhost:8000                                              │
│  Python 3.11 · Uvicorn · Pydantic v2 · Motor (async Mongo)  │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌─────────┐  │
│  │  Auth /  │  │  Teams / │  │  Quality /  │  │  RAG /  │  │
│  │  Users   │  │ Projects │  │  QC / AI    │  │ Chroma  │  │
│  └──────────┘  └──────────┘  └─────────────┘  └─────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
           ┌────────────┴───────────┐
           ▼                        ▼
   MongoDB Atlas               Google Gemini API
   (orbitdb)                   gemini-2.5-flash-lite
```

### Directory Structure

```
Graduation_project_Workspace/
├── backend/
│   ├── app/
│   │   ├── core/           # Config, JWT security
│   │   ├── db/             # MongoDB connection, collections, indexes
│   │   ├── dependencies/   # Auth guards, RBAC
│   │   ├── models/         # MongoDB document builders
│   │   ├── routes/         # FastAPI route handlers (23 modules)
│   │   ├── schemas/        # Pydantic request/response models
│   │   └── services/       # Business logic layer
│   ├── main.py             # App entry point, CORS, router registration
│   └── .env                # Environment variables (not committed)
│
└── client/
    ├── src/
    │   ├── components/     # Reusable UI components
    │   ├── contexts/       # Theme, Auth contexts
    │   ├── pages/          # Route-level page components (33 pages)
    │   ├── services/       # API service functions
    │   └── types/          # TypeScript interfaces
    └── vite.config.ts
```

---

## 3. Role System

The platform enforces a two-layer role model: **global user role** (stored on the user document) and **team membership role** (stored per membership).

### Global Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `founder` | Platform owner | Full access, system settings, audit logs, entity management |
| `admin` | Workspace administrator | Manage all users, teams, projects; view all analytics |
| `manager` | Department head | Create/manage one or more teams; create projects |
| `sub_admin` | Sub-manager / coordinator | Manage assigned staff within a project |
| `quality_control` | QC reviewer | Review submitted reports, manage QC standards |
| `staff` | Regular contributor | Submit tasks, view assigned projects |
| `it_staff` | IT support | System monitoring, user account management |

### Team Membership Roles

Each user can have a different role per team (stored in the `memberships` collection):

| Membership Role | Mapped From | Permissions in Team |
|----------------|-------------|---------------------|
| `admin` | Team creator | Add/remove members, manage all projects |
| `manager` | Assigned manager | Full team control, analytics access |
| `subadmin` | Sub-admin users | Manage assigned staff members |
| `member` | Staff users | Task execution only |

---

## 4. Feature Modules

### 4.1 Authentication & Sessions

- JWT Bearer token authentication (8-hour expiry)
- Token blacklist on logout (stored in `blacklisted_tokens` collection)
- Session tracking — every login creates a session record
- Audit logging for login, register, and sensitive actions
- Maintenance mode — system admin can lock access for non-admins

**Routes:** `POST /auth/login`, `POST /auth/register`, `POST /auth/logout`

---

### 4.2 Teams

Teams are the top-level organizational unit. Each team contains members (with roles) and owns projects.

**Features:**
- Create teams with a 2-step wizard (details → member assignment)
- Assign Managers, Sub-Admins, and Staff at creation time
- **3-dot menu** on each team card:
  - **Edit Members** — add/remove members with role assignment
  - **Edit Details** — rename team and update description
  - **Delete Team** — removes team and all memberships
- Member count, project count, active project count, and last activity shown on cards
- Manage button to view current members list by role

**Routes:** `POST /teams`, `GET /teams`, `GET /teams/{id}`, `PUT /teams/{id}`, `DELETE /teams/{id}`
**Membership Routes:** `GET/POST /teams/{id}/members`, `PUT /teams/{id}/members/{user_id}`, `DELETE /teams/{id}/members/{user_id}`

---

### 4.3 Projects

Projects live inside teams (or standalone). Each project has sub-admins and staff assigned.

**Features:**
- 3-step creation wizard: Details → Assign Team → Schedule
- **Auto-fill members from team** — selecting a team pre-populates sub-admins and staff from team memberships
- Status tracking: `ACTIVE`, `ON_HOLD`, `COMPLETED`
- Priority levels: High / Medium / Low
- Due date scheduling
- Inline status change from the projects grid
- Edit and delete with confirmation

**Routes:** `POST /projects`, `GET /projects`, `GET /projects/{id}`, `PATCH /projects/{id}`, `DELETE /projects/{id}`

---

### 4.4 Tasks & Task Boards

Tasks are the work items inside projects. They support multi-assignee, visibility control, and AI quality scoring.

**Features:**
- Task board (Kanban-style) with columns per status
- Multi-assignee support with `assignees[]` array
- `assign_to_all` flag — auto-assigns task to all team members
- Task visibility: `team` (all members) or `private` (assignees only)
- Creator attribution (name + avatar shown on cards)
- File/document attachment with base64 encoding
- Comments and activity feed per task
- Due dates and priority

**Routes:** `POST/GET /projects/{project_id}/tasks`, `GET/PATCH/DELETE /tasks/{id}`

---

### 4.5 AI Quality Evaluation

The core feature. Staff submit reports (PDF/Word), the AI evaluates compliance against accreditation standards, and returns a structured score.

**How it works:**

```
Staff uploads PDF/Word via TaskSubmitDrawer
    → Frontend: chunked base64 encode (32KB chunks, avoids stack overflow)
    → POST /quality/evaluate with {files[], images[], task_title, report_type, ...}
    → Backend: decode base64 → extract text (pdfplumber / python-docx)
    → Build Gemini prompt + attach PDF as inline_data (native PDF understanding)
    → Gemini returns structured JSON with score, verdict, failed_standards, suggestions
    → Score >= 85% → auto-submit to QC Review queue
    → Score < 85%  → blocked, show detailed feedback to staff
```

**Scoring Weights:**

| Criterion | Weight |
|-----------|--------|
| Document Structure | 30% |
| Content Quality | 30% |
| Completeness | 20% |
| Formatting Compliance | 10% |
| Accuracy | 10% |

**Pass threshold:** 85%

**Evaluation steps (6-step Gemini prompt):**
1. Extract standards from the uploaded document
2. Validate against accreditation requirements
3. Score each criterion
4. Make pass/fail decision
5. Generate error report with specific failures
6. Output structured JSON response

---

### 4.6 QC Dashboard & Review

Quality Control staff and admins review submitted reports.

**Features:**
- Incoming submissions queue with document preview
- Score history and trend charts
- Approve / reject with comments
- Standards management — define custom evaluation criteria per report type
- RAG-powered standards retrieval (ChromaDB vector store)

**Routes:** `GET/POST /qc/tasks`, `POST /qc/tasks/{id}/analyze`, `GET /quality/report-types`, `POST /quality/evaluate`

---

### 4.7 Report Types (20 Types)

All 20 accreditation report types are available to all authenticated users:

| Key | Arabic Equivalent |
|-----|-------------------|
| `course_report` | تقرير المقرر |
| `program_report` | تقرير البرنامج |
| `course_specification` | توصيف المقرر |
| `program_specification` | توصيف البرنامج |
| `self_study` | دراسة ذاتية |
| `execution_plan_followup` | متابعة خطة التنفيذ |
| `survey_analysis` | تحليل الاستبانات |
| `exam_results_analysis` | تحليل نتائج الاختبارات |
| `reviewer_reports` | تقارير المراجعين |
| `financial_reports` | التقارير المالية |
| `field_training_reports` | تقارير التدريب الميداني |
| `student_activities` | أنشطة الطلاب |
| `hr_performance` | أداء الموارد البشرية |
| `training_plans_execution` | تنفيذ خطط التدريب |
| `qa_unit_annual` | التقرير السنوي لوحدة الجودة |
| `student_data_reports` | بيانات الطلاب |
| `research_activity` | النشاط البحثي |
| `research_ethics` | أخلاقيات البحث |
| `physical_resources` | الموارد المادية |
| `community_engagement` | خدمة المجتمع |

---

### 4.8 Analytics

**User Analytics:**
- Task completion rate, active project count
- AI score history over time
- Personal portfolio (computed on-demand)

**Team Analytics:**
- Total tasks / projects / active users
- Average QC compliance score
- Time-based filtering: day / week / month / year

**Routes:** `GET /analytics/team/{id}`, `GET /analytics/user/{id}`, `GET /analytics/user/{id}/dashboard`

---

### 4.9 Founder Dashboard

Exclusive to the `founder` role:
- Platform-wide statistics (total users, teams, projects, tasks)
- User management and role assignment
- Entity (institution) management
- Quality framework CRUD
- IT staff portal access

**Routes:** `GET /founder/*`, `GET/POST/PUT/DELETE /frameworks/*`, `GET/POST/PUT/DELETE /entities/*`

---

### 4.10 System Administration

- Maintenance mode toggle (locks non-admin users out)
- Audit log viewer (all system events)
- System settings management

**Routes:** `GET/PATCH /system/settings`, `GET /system/audit-logs`, `POST /system/maintenance`

---

### 4.11 RAG (Retrieval-Augmented Generation)

ChromaDB vector store for quality standards retrieval:
- Upload standards documents → embed with Google `text-embedding-004`
- Retrieved automatically when evaluating reports
- Admin can manage the index via `/rag-admin/*` endpoints

---

### 4.12 Real-time Notifications

WebSocket-based notification system:
- Task assignments
- QC review results
- Project status changes

**Routes:** `WS /ws/{user_id}`, `GET /notifications`, `PATCH /notifications/{id}/read`

---

### 4.13 Events & Calendar

- Create workspace events with start/end dates
- Visibility: `public` (all members) or `private`
- Attendee management

**Routes:** `POST/GET /events`, `GET/PATCH/DELETE /events/{id}`

---

## 5. AI Evaluation Pipeline

### Request Flow

```
POST /quality/evaluate
Body: {
  task_title: string,
  task_description: string,
  report_type: string,          # validated against 20 known types
  submission_notes: string,
  files: [{ name, content_b64, mime_type }],   # max 5 files, 20MB each
  images: [{ name, content_b64, mime_type }]   # max 10 images, 10MB each
}
```

### Backend Processing (quality.py → qc_service.py)

```python
# 1. Validate payload sizes and report_type
# 2. For each file: base64 decode → extract text (pdfplumber/python-docx)
# 3. Pass raw_b64 + extracted text to qc_service
# 4. Build Gemini request:
#    - PDF < 20MB → send as inline_data (native PDF understanding)
#    - PDF >= 20MB → send extracted text only (fallback)
# 5. Add RAG-retrieved standards from ChromaDB
# 6. Call Gemini API
# 7. Parse response → extract score, verdict, failures, suggestions
# 8. Return structured result
```

### Response Format

```json
{
  "score": 87,
  "verdict": "pass",
  "passed": true,
  "failed_standards": [],
  "suggestions": ["Consider adding more references in section 3"],
  "section_scores": {
    "structure": 90,
    "content_quality": 85,
    "completeness": 88,
    "formatting": 82,
    "accuracy": 91
  }
}
```

---

## 6. API Reference

### Base URL
```
http://localhost:8000/api/v1
```

### Authentication
All endpoints (except `/auth/login`, `/auth/register`, `/setup`) require:
```
Authorization: Bearer <jwt_token>
```

### Core Endpoints Summary

| Method | Path | Description | Min Role |
|--------|------|-------------|----------|
| POST | `/auth/login` | Login | Public |
| POST | `/auth/register` | Register | Public |
| POST | `/auth/logout` | Logout + blacklist token | Any |
| GET | `/users` | List all users | admin |
| GET | `/teams` | List my teams | Any |
| POST | `/teams` | Create team | admin/manager |
| GET | `/teams/{id}/members` | Team members | Team member |
| POST | `/teams/{id}/members` | Add member | Team admin |
| DELETE | `/teams/{id}/members/{uid}` | Remove member | Team admin |
| GET | `/projects` | List my projects | Any |
| POST | `/projects` | Create project | admin/manager |
| PATCH | `/projects/{id}` | Update project | admin/manager |
| POST | `/projects/{id}/tasks` | Create task | sub_admin+ |
| GET | `/quality/report-types` | All 20 report types | Any |
| POST | `/quality/evaluate` | AI evaluate document | Any |
| GET | `/qc/tasks` | QC review queue | quality_control+ |
| GET | `/analytics/team/{id}` | Team analytics | manager+ |
| GET | `/analytics/user/{id}/dashboard` | User dashboard | Any |
| GET | `/system/audit-logs` | System audit log | admin/founder |
| POST | `/system/maintenance` | Toggle maintenance | admin/founder |

---

## 7. Database Schema

### Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts, roles, profiles |
| `teams` | Team definitions |
| `memberships` | User-team relationships with roles |
| `projects` | Project definitions |
| `task_boards` | Kanban board config per project |
| `tasks` | Task items |
| `comments` | Task comments |
| `files` | Uploaded file metadata |
| `notifications` | User notifications (TTL: 30 days) |
| `events` | Calendar events |
| `quality_standards` | QC evaluation standards |
| `quality_analyses` | AI evaluation results |
| `quality_scores` | Per-task AI compliance scores |
| `quality_frameworks` | Framework definitions |
| `user_sessions` | Login session records |
| `audit_logs` | System event log |
| `blacklisted_tokens` | Revoked JWT tokens |
| `system_settings` | Global system config |
| `entities` | Institution/entity records |
| `rag_index_state` | ChromaDB index metadata |

### Key Indexes

```javascript
// memberships — unique per project (partial: only when project_id exists)
{ user_id: 1, project_id: 1 }, unique: true, partialFilterExpression: { project_id: { $exists: true } }

// memberships — team lookup
{ user_id: 1, team_id: 1 }

// tasks — project + status
{ project_id: 1, status: 1 }

// notifications — TTL auto-delete after 30 days
{ created_at: 1 }, expireAfterSeconds: 2592000
```

---

## 8. Setup & Running

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB 6+)
- Google Gemini API key

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment (copy and edit)
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd client

# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### First-Time Setup

1. Navigate to `http://localhost:5173/setup`
2. Create the Founder account
3. Log in as Founder to create Admin and IT Staff accounts
4. Admin can then create Teams, invite users, and start Projects

---

## 9. Environment Variables

Create `backend/.env` from the template:

```env
# MongoDB — use Atlas connection string or local
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/orbitdb
MONGODB_DB_NAME=orbitdb

# JWT
JWT_SECRET_KEY=your-super-secret-key-minimum-32-chars
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=480

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-lite

# App
APP_NAME=Orbit Workspace
DEBUG=False

# CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# RAG / ChromaDB
RAG_ENABLED=True
CHROMA_PERSIST_DIR=./chroma_data
EMBEDDING_MODEL=models/text-embedding-004
```

---

## 10. Recent Updates & Bug Fixes

### Team Creation — DuplicateKeyError Fix

**Problem:** Creating a second team as the same admin user returned HTTP 500.

**Root cause:** The `memberships` collection had a unique index on `(user_id, project_id)`. Team memberships don't have a `project_id` field, so MongoDB treated missing `project_id` as `null`. A user creating their second team would generate a duplicate `(user_id, null)` key.

**Fix:** Recreated the index with a `partialFilterExpression` so uniqueness is only enforced when `project_id` is present:
```python
# backend/app/db/collections.py
await db["memberships"].create_index(
    [("user_id", 1), ("project_id", 1)],
    unique=True,
    partialFilterExpression={"project_id": {"$exists": True}}
)
```

---

### PDF Evaluation — Always 0% Score Fix

**Problem:** Submitting PDF files via the QC system always returned 0% with "PDF content could not be accessed."

**Root cause:** The backend extracted text from PDFs (limited to 3000 chars) and sent it as plain text to Gemini. Complex academic PDFs with tables and Arabic text could not be properly represented as plain text.

**Fix:**
- PDFs are now sent to Gemini as `inline_data` (native PDF understanding, not text extraction)
- PDFs larger than 20MB fall back to extracted text
- Text extraction limit removed (was 8000 chars)
- `pdfplumber` used for text extraction; `python-docx` for Word files

---

### PDF — Large File Crash Fix

**Problem:** Uploading large PDF files caused a JavaScript stack overflow crash in the browser.

**Root cause:** `btoa()` was used to convert file bytes to base64 in a single call, which exceeds the JavaScript call stack for files over ~5MB.

**Fix (`client/src/components/TaskSubmitDrawer.tsx`):**
```typescript
// Process in 32KB chunks instead of single btoa() call
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let result = '';
    for (let i = 0; i < bytes.length; i += 32768) {
        result += String.fromCharCode(...bytes.subarray(i, i + 32768));
    }
    return btoa(result);
}
```

---

### Report Types — Staff Access Fix

**Problem:** Staff users only saw 4 hardcoded report types in the task submission UI.

**Root cause:** The `/quality/report-types` endpoint required `quality_control` or `admin` role, so staff requests were rejected and the frontend fell back to 4 defaults.

**Fix:** Removed the role check from `get_report_types()` — now accessible to all authenticated users. All 20 types are returned.

---

### Team Management — New UI Features

**Added:**
- **3-dot menu** on every team card with Edit Members, Edit Details, and Delete Team actions
- **EditTeamMembersModal** — diff-based member sync: compares current members with desired selection, adds new ones and removes deselected ones (team admin protected from removal)
- **EditTeamModal** — inline rename and description update via `PUT /teams/{id}`
- **CreateProjectModal auto-fill** — selecting a team in the project creation wizard automatically populates sub-admins and staff from team memberships, with a visual confirmation badge

---

### Gemini Model Update

Switched from `gemini-2.5-flash` to `gemini-2.5-flash-lite`:
- Free tier: 15 RPM (up from 5 RPM)
- Lower latency for evaluation requests
- Same quality for structured JSON output tasks

---

## 11. Security Hardening

### Input Validation

| Field | Limit |
|-------|-------|
| Files per request | Max 5 |
| Images per request | Max 10 |
| File size | Max 20 MB |
| Image size | Max 10 MB |
| `task_title` | Max 500 chars |
| `task_description` | Max 10,000 chars |
| `submission_notes` | Max 5,000 chars |

### Prompt Injection Prevention

`report_type` is validated against the 20 known keys before being interpolated into the Gemini prompt. Unknown values return HTTP 400.

```python
VALID_TYPES = set(REPORT_TYPES.keys())
if report_type and report_type not in VALID_TYPES:
    raise HTTPException(400, "Invalid report_type")
```

### Token Security

- JWT tokens are blacklisted on logout
- Every authenticated request checks the blacklist before processing
- Token expiry: 8 hours

### RBAC Enforcement

All sensitive endpoints use FastAPI dependency injection for role checks. There are no client-side-only role gates — every API call is independently validated server-side.

---

## Development Notes

### Adding a New Route

1. Create `backend/app/routes/myroute.py`
2. Add `from app.routes import myroute` in `main.py`
3. Register: `app.include_router(myroute.router, prefix="/api/v1")`

### Adding a New Collection

1. Add constant in `backend/app/db/collections.py`
2. Add indexes in the `create_indexes()` function
3. Indexes are created automatically on startup

### Frontend Theming

The app uses `ThemeContext` + Tailwind `dark:` classes. Dark mode is toggled via the context. Inline-styled components (like `Projects.tsx`) use the `T(isDark)` token helper.

---

*Branch: `New/ModelQuality` — Last updated: June 2026*
