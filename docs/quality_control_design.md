# Quality Control (QC) Role Expansion

This document outlines the practical implementation plan for adding the Quality Control role to the existing FastAPI + MongoDB backend and React dashboard frontend. The sections below follow the requested order: backend design, database schema changes, AI evaluation system, frontend QC dashboard, and reports & analytics.

---

## 1. QC Role Backend

### 1.1 Overview
- Introduce a `QualityControl` role that plugs into existing auth and RBAC plumbing inside [backend/app/dependencies](../backend/app/dependencies).
- Provide QC-focused routers under [backend/app/routes](../backend/app/routes) with services housed in [backend/app/services](../backend/app/services).
- Use FastAPI background tasks (or a dedicated worker) to run potentially slow AI evaluations while keeping HTTP responses snappy.

### 1.2 Auth, RBAC, and Session Flow
- Extend user creation/login flows (likely in `auth.py`) so QC members can register or be promoted post-registration.
- Update RBAC helpers (e.g., `require_role` or `require_permissions`) to recognize:
  - `qc:standards` – create/update/delete standards
  - `qc:analysis` – run AI analyses, view results
  - `qc:reports` – access quality dashboards and exports
- Add `get_qc_user` dependency that ensures the caller has QC privileges and loads optional QC profile metadata (preferred project groups, notification settings).

### 1.3 Services and Modules
- **`QualityStandardService`**: CRUD, validation, file association logic for dataset-driven standards.
- **`QualityAnalysisService`**: orchestrates AI prompts, stores results, emits WebSocket events through existing `ws_manager`.
- **`QualityReportService`**: aggregates Mongo data for analytics, handles CSV/PDF exporting.
- Update [backend/app/services/ws_manager.py](../backend/app/services/ws_manager.py) (or equivalent) with QC-specific events (e.g., `qc_analysis_completed`).

### 1.4 API Surface
| Endpoint | Method | Description | Auth |
| --- | --- | --- | --- |
| `/api/qc/register` | POST | Enroll a QC user (wraps existing signup + sets role) | Public |
| `/api/qc/login` | POST | Login alias returning QC-specific session data | Public |
| `/api/qc/standards` | GET/POST | List/create standards (text or dataset types) | QC |
| `/api/qc/standards/{id}` | PUT/DELETE | Update/archive standards | QC |
| `/api/qc/standards/{id}/dataset` | POST | Upload dataset artifact attached to a standard | QC |
| `/api/tasks/{taskId}/quality/analyze` | POST | Trigger AI evaluation for a task | QC or elevated user |
| `/api/tasks/{taskId}/quality/latest` | GET | Fetch most recent analysis to show in modal | Auth |
| `/api/qc/reports/*` | GET | Overview metrics, trends, export endpoints | QC |

Implementation notes:
- Wrap long-running AI calls inside `BackgroundTasks` or push to an async worker queue (Celery, RQ, or simple asyncio task) to avoid request timeouts.
- Return an immediate `202 Accepted` with analysis record placeholder; push completion via WebSocket.

### 1.5 TODO Tracking Hook
- Wherever TODO check/uncheck logic currently lives (likely in `task_service`), extend the handler to write an entry to the new `todo_audit` collection (see Schema section). Include user ID, task ID, project ID, and timestamp; keep this in the same transaction/operation for consistency.

---

## 2. Database Schema Changes (MongoDB)

### 2.1 Collections
- **`quality_standards`**
  - Core document describing either text-based or dataset-based standards.
  - Suggested shape:
    ```json
    {
      "_id": ObjectId,
      "title": "UI Acceptance",
      "description": "Consistent UI artifacts",
      "type": "text" | "dataset",
      "rules": [
        { "ruleId": UUID, "label": "Task must contain clear description", "instructions": "Minimum 3 sentences", "weight": 0.2 }
      ],
      "datasetRefs": [
        { "fileId": ObjectId, "fileType": "image", "tags": ["approved", "navigation"] }
      ],
      "scope": { "level": "all" | "group" | "project", "ids": [projectGroupIds] },
      "createdBy": userId,
      "version": 1,
      "status": "active" | "archived",
      "createdAt": ISODate,
      "updatedAt": ISODate
    }
    ```
- **`quality_analyses`**
  - Stores each AI evaluation result.
    ```json
    {
      "_id": ObjectId,
      "taskId": ObjectId,
      "projectId": ObjectId,
      "triggeredBy": userId,
      "standardsApplied": [standardId],
      "inputs": { "descriptionFileId": ObjectId?, "imageFileIds": [], "docFileIds": [] },
      "aiModel": "gpt-4.1",
      "score": 82,
      "passedRules": [{ "standardId": ObjectId, "ruleId": UUID, "rationale": "Description present" }],
      "failedRules": [...],
      "suggestions": [{ "text": "Improve UI spacing", "priority": "medium" }],
      "status": "pending" | "completed" | "failed",
      "error": "optional error message",
      "createdAt": ISODate,
      "completedAt": ISODate
    }
    ```
- **`todo_audit`**
  - Captures checklist interactions for downstream analytics.
    ```json
    {
      "_id": ObjectId,
      "todoId": ObjectId,
      "taskId": ObjectId,
      "projectId": ObjectId,
      "checkedBy": userId,
      "action": "checked" | "unchecked",
      "timestamp": ISODate
    }
    ```
- Optional **`qc_reports_cache`** for precomputed daily aggregates to speed up dashboards (fields: `projectId`, `date`, `avgScore`, `taskCount`, `failCount`).

### 2.2 User Document Adjustments
- Ensure each user document in `users` has a `roles` array; allow combinations like `{ "roles": ["User", "QualityControl"] }`.
- Optional `qcProfile` sub-document for personalization: `{ "projectGroups": [], "defaultStandards": [], "notifyOn": ["analysisComplete"] }`.

### 2.3 Indexing Strategy
- `quality_standards`: index on `{ scope.level: 1, "scope.ids": 1, status: 1 }` to quickly fetch applicable standards.
- `quality_analyses`: compound index `{ projectId: 1, taskId: 1, createdAt: -1 }` plus TTL/capped logic if retention is limited.
- `todo_audit`: index on `{ projectId: 1, timestamp: -1 }` for trend aggregations.

---

## 3. AI Evaluation System

### 3.1 Goals
- Provide consistent, explainable AI-driven quality scoring across tasks.
- Support multimodal input (descriptions, screenshots, documents) via OpenAI Responses API.
- Align evaluation with user-defined standards stored in MongoDB.

### 3.2 Pipeline
1. **Fetch Context**: Load task metadata, associated project, and all applicable standards (matching scope + active status).
2. **Normalize Inputs**: Persist uploaded text/image/doc files using existing file service; produce signed URLs or base64 payloads for AI consumption.
3. **Prompt Assembly**: Build a structured JSON payload listing rules, datasets, task details, and TODO audit stats.
4. **Model Invocation**: Call the configured OpenAI model (recommended `gpt-4.1` for high-quality reasoning or `gpt-4o-mini` for cost-sensitive runs) using the Responses API with JSON schema enforcement.
5. **Parse & Persist**: Validate the model response, calculate final score (optionally recompute using rule weights), and store in `quality_analyses`.
6. **Notify**: Emit WebSocket event `qc.analysis.completed` via `ws_manager` so the frontend modal updates in real time.
7. **Aggregate**: Kick off async aggregation update (increment project averages, append to history cache) without blocking the original request.

### 3.3 Prompt Structure
- **System message**: "You are a senior software quality auditor evaluating project tasks for compliance with defined standards."
- **User content**: JSON structure, e.g.:
  ```json
  {
    "task": {
      "title": "Improve dashboard navigation",
      "description": "...",
      "status": "In Progress",
      "todoStats": { "checked": 5, "total": 7, "recentChecks": [...] }
    },
    "standards": [
      { "id": "std-1", "type": "text", "rules": ["Task must contain clear description", "Documentation must contain structured steps"] },
      { "id": "std-2", "type": "dataset", "datasetSummary": "5 approved navigation screenshots" }
    ],
    "uploads": {
      "images": ["https://.../screenshot.png"],
      "documents": ["https://.../spec.pdf"]
    }
  }
  ```
- **Response schema** (enforced via `response_format`): `{ score: number (0-100), passed: [{standardId, ruleId, reason}], failed: [...], suggestions: [{text, priority}] }`.

### 3.4 Error Handling & Observability
- Store transient status (`pending`, `failed`) and error payload for retries.
- Implement retry policy (e.g., 2 retries with exponential backoff) and fall back to cached standards if AI unavailable.
- Log latency and costs per analysis; expose metrics for dashboards.

### 3.5 Configuration
- Add environment variables: `QC_AI_MODEL`, `QC_AI_API_KEY`, `QC_AI_TIMEOUT`, `QC_AI_MAX_RETRIES`, `QC_AI_CALLBACK_URL` (if using webhooks later).
- Centralize OpenAI client setup inside [backend/app/services/ai_service.py](../backend/app/services/ai_service.py) to reuse across QC workflows.

---

## 4. Frontend QC Dashboard

### 4.1 Navigation & Routing
- Add a QC-only route (e.g., `/qc/dashboard`) guarded by role-aware router logic in [client/src/context](../client/src/context).
- Sidebar item “Quality Control” appears only when the authenticated user has `QualityControl` role.

### 4.2 Page Layout
- **Header**: Average quality score, number of analyses this week, open QC alerts.
- **Charts**: Line chart for score trends, heatmap or bar chart for quality per project, stacked bar for passed vs failed standards.
- **Recent Analyses Table**: Task, project, score, status, quick link to open modal.
- **Actions**: Buttons for “Analyze Task”, “Define Standards”, “Upload Dataset”.

### 4.3 Components
- `QcDashboardPage` – orchestrates data fetches from `/api/qc/reports/overview`.
- `QualityStandardsModal` – tabbed modal for text rules (dynamic form builder) and dataset uploads (drag/drop + preview).
- `AiAnalysisModal` – reused inside task pages, showing upload form -> loading state -> results (score progress bar, passed/failed, suggestions list).
- `QcReportCharts` – wrappers around charting library components to render trends and distributions.

### 4.4 State & Data Flow
- Use React Query or existing data hooks to cache QC datasets (`useQualityStandards`, `useQualityReports`).
- WebSocket subscription listens for `qc.analysis.completed`; invalidate modal/task queries when relevant task IDs update.
- Form submissions hit QC endpoints; display optimistic UI (spinner + toast) until completion event.

### 4.5 Accessibility & UX
- Ensure modals are focus-trapped and keyboard navigable.
- Provide informative empty states ("No quality standards defined yet").
- Use color-coded badges for score thresholds (green >=85, amber 70-84, red <70).

---

## 5. Reports & Analytics System

### 5.1 Backend Aggregations
- `QualityReportService` runs Mongo aggregation pipelines:
  - **Quality score trend**: `$match` analyses by date range + scope, `$group` by day/week to compute avg/min/max score.
  - **Task completion trend**: join tasks (or TODO stats) with `todo_audit` to show completions per day.
  - **AI evaluation history**: paginate `quality_analyses` sorted by `createdAt`.
  - **Project quality scores**: `$group` by `projectId`, compute average score and failure counts.
- Cache nightly results into `qc_reports_cache` for quick retrieval; refresh on-demand if user adjusts filters.

### 5.2 API Contracts
- `GET /api/qc/reports/overview?range=30d&projectId=` returns `{ "scoreTrend": [...], "completionTrend": [...], "projectScores": [...], "aiHistory": [...], "todoStats": {...} }`.
- `GET /api/qc/reports/tasks-completed` exposes detailed TODO timelines for charts.
- `GET /api/qc/reports/export?format=csv|pdf&range=...` streams downloadable files.
- Consider `POST /api/qc/reports/custom` to accept advanced filters (project groups, min score) for future expansion.

### 5.3 Frontend Visualizations
- **Line Chart**: tasks completed over time (x=date, y=count) sourced from `todo_audit` aggregation.
- **Bar Chart**: average quality score per project; clicking a bar drills into the related task list.
- **Donut/Pie**: distribution of AI evaluation outcomes (pass vs fail counts or severity buckets).
- **Table**: AI evaluation history with filters (project, score range, date) plus "Export" buttons per row.

### 5.4 Export Workflows
- CSV export: convert aggregation cursor to streaming response; include headers (Project, Task, Score, PassedRules, FailedRules, Suggestions).
- PDF export: render HTML template (FastAPI + WeasyPrint/ReportLab) summarizing charts; embed organization logo + timestamp.
- Frontend triggers downloads via button; show toast on completion, with fallback to email link if file is large (future enhancement).

### 5.5 Security & Auditing
- Require QC role for all report endpoints; log every export event with user ID and filter criteria.
- Sanitize dataset download URLs to prevent unauthorized access.
- Monitor API usage to detect anomalous AI calls or report scraping.

---

This plan keeps the existing architecture intact while layering on QC-specific capabilities across backend, database, AI services, frontend UI, and analytics. Each subsection can now be implemented iteratively without blocking other teams.

---

## 6. Implementation Roadmap

### 6.1 Milestones
1. **RBAC & Auth Foundations**
  - Update user schemas, migrations/seeding scripts, and RBAC dependencies.
  - Deliverable: QC users can log in and access a placeholder dashboard route.
2. **Standards Management**
  - Implement `quality_standards` CRUD endpoints, dataset upload flows, and UI modal forms.
  - Deliverable: QC users define text rules and upload reference datasets per project scope.
3. **AI Evaluation MVP**
  - Wire `QualityAnalysisService`, background job, OpenAI client, and task modal.
  - Deliverable: “Analyze with AI” button produces stored results visible in modal.
4. **Reports & Analytics**
  - Build aggregation pipelines, caching, and charts/export endpoints + UI.
  - Deliverable: QC dashboard shows trends; CSV/PDF exports function.
5. **Hardening & Observability**
  - Add logging, metrics, retries, and RBAC tests; document ops runbooks for AI quotas.

### 6.2 Sample API Contracts

#### Create Standard
```
POST /api/qc/standards
Body {
  "title": "UI Consistency",
  "type": "text",
  "rules": [
   { "label": "Task must contain clear description", "instructions": ">= 3 sentences", "weight": 0.3 }
  ],
  "scope": { "level": "project", "ids": ["proj-123"] }
}

201 Response { "standardId": "std-abc" }
```

#### Trigger Analysis
```
POST /api/tasks/{taskId}/quality/analyze
multipart/form-data:
  descriptionOverride (text)
  images[] (files)
  documents[] (files)
  standards[] (json list of IDs)

202 Response { "analysisId": "ana-xyz", "status": "pending" }
```

#### Fetch Reports Overview
```
GET /api/qc/reports/overview?range=30d&projectId=proj-123

200 Response {
  "scoreTrend": [{ "date": "2026-03-01", "avg": 82 }],
  "completionTrend": [{ "date": "2026-03-01", "todosCompleted": 14 }],
  "projectScores": [{ "projectId": "proj-123", "avgScore": 84, "evaluations": 11 }],
  "aiHistory": [{ "taskId": "task-111", "score": 78, "createdAt": "..." }],
  "todoStats": { "checked": 120, "unchecked": 35 }
}
```

### 6.3 Testing Strategy
- **Unit Tests**: cover services (standards CRUD validation, AI response parsing, report aggregations).
- **Integration Tests**: exercise FastAPI routers with mocked OpenAI responses and in-memory Mongo (e.g., `mongomock`).
- **Contract Tests**: verify frontend consumes API schemas using mocked MSW handlers.
- **Load Tests**: simulate bursts of AI analysis requests to ensure queueing/backoff works.

### 6.4 Observability & Operations
- Emit structured logs for each AI request (`analysisId`, `taskId`, latency, cost estimate).
- Collect metrics (Prometheus/OpenTelemetry) for counts of analyses, failures, average score per hour.
- Configure alerting when failure rate > 5% or OpenAI quota near limit.
- Document runbooks for rotating API keys, retrying failed analyses, and purging old datasets.

### 6.5 Security Considerations
- Validate uploaded datasets (file type/size) and scan for malware before storing.
- Ensure signed URLs for dataset artifacts expire quickly and are scoped per user.
- Enforce least-privilege RBAC: only QC and admins can access standards, analyses, and exports.
- Log report exports with user ID, filters, and timestamp for auditing.

---

With this roadmap and contract-level detail, engineering teams can parallelize their efforts while maintaining a shared understanding of the QC feature set from backend through analytics.