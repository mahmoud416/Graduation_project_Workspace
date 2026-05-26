# CLAUDE.md - Project Changes Log

## Project Overview
**Hericle Workspace** - A university QA (Quality Assurance) platform with task management, compliance testing, AI-powered document evaluation, and accreditation report workflows. Built with FastAPI (Python) + React (TypeScript/Vite) + MongoDB.

---

## Changes Made by Claude (Branch: `New/ModelQuality`)

### 1. PDF Submission Pipeline Fix (Critical Bug)

**Problem:** Submitting PDF reports through the QC system always returned 0% score with "PDF content could not be accessed."

**Root Cause:** The backend was truncating extracted text to 3000 chars and sending it as plain text to Gemini AI. Gemini couldn't understand the PDF content properly.

**Fix Applied:**
- **`backend/app/routes/quality.py`** (evaluate endpoint, lines 273-301): Added full PDF decode pipeline — base64 decode, text extraction via `pdfplumber`/`python-docx`, and passes `raw_b64` alongside extracted text so the AI service can use Gemini's native PDF understanding.
- **`backend/app/services/qc_service.py`** (lines 1030-1046): Rewrote `_online_analyze_task()` file context builder to send PDFs as Gemini `inline_data` (native PDF understanding) while keeping extracted text as supplementary context. Added size cap (20MB) — oversized PDFs fall back to extracted text only.
- **`backend/app/routes/qc.py`** (lines 367-376): Removed 8000 char truncation in `_read_documents()`, added `raw_b64` field for PDFs, added `report_type` parameter to the analyze endpoint.
- **`backend/app/schemas/quality_control.py`** (line 87): Added `report_type: Optional[str] = None` to `QualityAnalysisRequest`.
- **`backend/app/services/quality_analysis_service.py`** (line 88): Passes `report_type` through to `qc_service.analyze_task_against_standards()`.

### 2. All 20 Report Types Enabled for Staff

**Problem:** Staff users only saw 4 hardcoded report types because `/quality/report-types` required QC admin role.

**Fix Applied:**
- **`backend/app/routes/quality.py`** (line 221): Removed `_require_qc_admin_or_subadmin()` from `get_report_types()` — now accessible to all authenticated users.
- Frontend (`client/src/pages/TaskFlowDetail.tsx`) already had logic to fetch from API and fall back to 4 defaults. Now the API returns all 20 types.

### 3. Gemini AI Prompt Rewrite

**File:** `backend/app/services/qc_service.py` (lines 1064-1200+)

Completely rewrote the AI evaluation prompt for better accuracy:
- 6-step evaluation process: Extract Standards → Validation → Scoring → Decision → Error Report → Output
- Weighted scoring: Structure 30%, Content Quality 30%, Completeness 20%, Formatting 10%, Accuracy 10%
- Pass threshold: >= 85%
- Bilingual support (Arabic/English)
- PDF formatting compliance analysis with detailed section-by-section checks
- Report type-specific evaluation when `report_type` is provided

### 4. Gemini Model Change

**File:** `backend/.env`
- Changed from `gemini-2.5-flash` to `gemini-2.5-flash-lite` (15 RPM free tier vs 5 RPM)

### 5. Security Fixes

#### 5a. Payload Size Limits
**File:** `backend/app/routes/quality.py` (lines 69-80)
- `MAX_FILES = 5`, `MAX_IMAGES = 10`
- Per-file limit: ~20 MB decoded (`MAX_FILE_SIZE_B64 = 27_962_027`)
- Per-image limit: ~10 MB decoded (`MAX_IMAGE_SIZE_B64 = 13_981_014`)
- `EvaluateTaskRequest` fields now use `Field()` with `max_length` constraints
- `task_title`: max 500 chars, `task_description`: max 10,000 chars, `submission_notes`: max 5,000 chars

#### 5b. Report Type Validation (Prompt Injection Prevention)
- **`backend/app/routes/quality.py`** (lines 249-253): Validates `report_type` against `REPORT_TYPES` keys before processing. Rejects unknown values with 400.
- **`backend/app/routes/qc.py`** (lines 181-185): Same validation on the `/qc/tasks/{task_id}/analyze` endpoint.

#### 5c. PDF Size Cap Before Gemini
**File:** `backend/app/services/qc_service.py` (line 1033)
- PDFs larger than 20MB are not sent as `inline_data` to Gemini. Falls back to extracted text only.

#### 5d. Frontend Large File Crash Fix
**File:** `client/src/components/TaskSubmitDrawer.tsx` (lines 4-12)
- Replaced single-pass `btoa()` (crashes on large files due to stack overflow) with chunked `arrayBufferToBase64()` that processes 32KB chunks.

### 6. Frontend Type Fix
**File:** `client/src/services/qcService.ts` (lines 189, 221)
- Added `submission_notes?: string` to `EvaluateTaskPayload` interface
- Passes `submission_notes` in the `evaluateTask()` request body

### 7. New Frontend Component: TaskSubmitDrawer
**File:** `client/src/components/TaskSubmitDrawer.tsx` (NEW)
- Slide-out drawer for task submission with AI quality check
- Drag-and-drop file upload (PDF/Word)
- Shows quality score, pass/fail status, failed standards, and improvement suggestions
- Auto-submits to QC Review if score >= 85%

### 8. Removed: TaskAnalysisModal
**File:** `client/src/components/TaskAnalysisModal.tsx` (DELETED)
- Replaced by the new `TaskSubmitDrawer` component

---

## Other Changes (Pre-existing on Branch)

These changes were already on the branch before the Claude session and are part of the broader `New/ModelQuality` feature work:

### Backend
- **`backend/app/dependencies/auth.py`**: Added token blacklist checking, system maintenance mode
- **`backend/app/dependencies/rbac.py`**: Added `require_founder` role guard, renamed sub_admin references
- **`backend/app/routes/analytics.py`**: Added `/user/{user_id}/dashboard` comprehensive analytics endpoint
- **`backend/app/routes/auth.py`**: Added audit logging on register/login, session tracking, logout with token blacklist
- **`backend/app/routes/projects.py`**: Added project statistics endpoint, public projects listing
- **`backend/app/routes/users.py`**: Added user status reporting, bulk user queries, extended user profile
- **`backend/app/routes/system.py`** (NEW): System settings, maintenance mode toggle, audit logs
- **`backend/app/routes/founder.py`** (NEW): Founder dashboard data endpoints
- **`backend/app/routes/frameworks.py`** (NEW): Quality framework CRUD
- **`backend/app/routes/entities.py`**: Entity management updates
- **`backend/app/db/collections.py`**: Added new collection constants (audit_logs, sessions, blacklisted_tokens, system_settings, entities, quality_frameworks)
- **`backend/app/models/entity.py`** (NEW): Entity model
- **`backend/app/schemas/entity.py`** (NEW): Entity schemas
- **`backend/app/models/quality_framework.py`** (NEW): Quality framework model
- **`backend/app/schemas/quality_framework.py`** (NEW): Quality framework schemas
- **`backend/main.py`**: Registered new routers (system, founder, frameworks, entities)

### Frontend
- **`client/src/App.tsx`**: Added routes for IT Portal, Public Projects, Portfolio, Founder Dashboard, Session Logs. Updated role guards.
- **`client/src/components/Sidebar.tsx`**: Added sidebar items for new pages
- **`client/src/components/CreateProjectModal.tsx`**: Enhanced project creation with more fields
- **`client/src/pages/ITPortal.tsx`** (NEW): IT staff management portal
- **`client/src/pages/PublicProjectsPage.tsx`** (NEW): Public projects listing
- **`client/src/pages/PortfolioPage.tsx`** (NEW): Project portfolio view
- **`client/src/pages/FounderDashboard.tsx`** (NEW): Founder analytics dashboard
- **`client/src/pages/SessionLogsPage.tsx`** (NEW): User session logs viewer
- **`client/src/pages/TaskFlowDetail.tsx`**: Major rewrite — report type selector, TaskSubmitDrawer integration, improved task board UI
- **`client/src/pages/ReportsPage.tsx`**: Redesigned reports page with better charts/data
- **`client/src/pages/QCDashboard.tsx`**: Updated QC dashboard with new metrics
- **`client/src/pages/TeamPage.tsx`**: Enhanced team management UI
- **`client/src/pages/TeamDetailsPage.tsx`**: Team detail improvements
- **`client/src/pages/TeamsPage.tsx`**: Teams listing updates
- **`client/src/pages/Projects.tsx`**: Project listing enhancements
- **`client/src/types/index.ts`**: Added new type definitions

---

## Architecture Notes

### AI Evaluation Pipeline
```
Frontend (base64 encode) → POST /quality/evaluate (JSON)
  → quality.py: decode base64 → extract text (pdfplumber/python-docx)
  → qc_service.py: build prompt + PDF inline_data for Gemini
  → Gemini API (gemini-2.5-flash-lite)
  → Score >= 85% → auto-submit to QC Review
  → Score < 85% → blocked, show feedback
```

### Report Types
20 accreditation report types defined in `qc_service.REPORT_TYPES`:
`course_report`, `program_report`, `course_specification`, `program_specification`, `self_study`, `execution_plan_followup`, `survey_analysis`, `exam_results_analysis`, `reviewer_reports`, `financial_reports`, `field_training_reports`, `student_activities`, `hr_performance`, `training_plans_execution`, `qa_unit_annual`, `student_data_reports`, `research_activity`, `research_ethics`, `physical_resources`, `community_engagement`

### Key Config
- Backend: `http://localhost:8000` (FastAPI + uvicorn)
- Frontend: `http://localhost:5173` (Vite + React)
- Database: MongoDB `hericle_workspace`
- AI Model: `gemini-2.5-flash-lite` (env var `GEMINI_MODEL`)
- Pass threshold: 85% compliance score
