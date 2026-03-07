# Workspace — Project Management Platform
### Quality & Architecture Documentation

> **Hericle v2.0** · A full-stack, role-based SaaS project management system built as a graduation project. Modelled after tools like ClickUp / Asana, it supports multi-role workspaces with real-time collaboration, task tracking, file uploads, calendar events, and a built-in AI assistant widget.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Roles & Hierarchy](#roles--hierarchy)
4. [Feature Map by Role](#feature-map-by-role)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Architecture](#backend-architecture)
7. [Database Collections](#database-collections)
8. [Authentication & Security](#authentication--security)
9. [Multi-Session Support](#multi-session-support)
10. [Light / Dark Mode](#light--dark-mode)
11. [Chatbot Widget](#chatbot-widget)
12. [Real-Time Layer](#real-time-layer)
13. [Project Structure](#project-structure)
14. [Running the Project](#running-the-project)
15. [API Endpoints Reference](#api-endpoints-reference)

---

## Overview

Workspace is a team collaboration and project management platform where:

- **Admins** create and manage the entire workspace — projects, users, roles.
- **Sub-Admins** lead assigned project teams, manage tasks, and monitor staff.
- **Staff** execute tasks inside projects they are assigned to.

Each project contains a **TaskFlow board** with to-do items that drive a live progress bar. Two built-in channels (**#public** and **#all-sub-admin**) act as workspace-wide communication spaces visible to all users.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend Language | Python | 3.11 / 3.13 |
| Backend Framework | FastAPI | 0.109 |
| ASGI Server | Uvicorn (standard) | 0.27 |
| Database | MongoDB | (via Motor async driver) |
| Async Driver | Motor | ≥ 3.0 |
| Auth | JWT (python-jose) + bcrypt | — |
| Real-time | WebSockets (websockets lib + custom manager) | 12.0 |
| File Uploads | python-multipart | 0.0.6 |
| Validation | Pydantic v2 + pydantic-settings | ≥ 2.0 |
| Frontend Language | TypeScript | ~5.9 |
| Frontend Framework | React | 19 |
| Routing | React Router DOM | v7 |
| Build Tool | Vite | 7 |
| Styling | Tailwind CSS | v4 |
| Theme Engine | CSS `@variant dark` (class strategy) | — |

---

## Roles & Hierarchy

```
┌────────────────────────────────────────────────────┐
│                      ADMIN                         │
│  • Creates the workspace                           │
│  • Creates projects and assigns sub-admins/staff   │
│  • Creates and manages user accounts               │
│  • Full access to all pages and data               │
│  • Configures global upload rules                  │
└──────────────┬─────────────────────────────────────┘
               │ assigns to projects
               ▼
┌────────────────────────────────────────────────────┐
│                   SUB-ADMIN                        │
│  • Leads one or more assigned projects             │
│  • Sees and manages all staff in their projects    │
│  • Accesses Task Master dashboard                  │
│  • Views all workspace channels                    │
│  • Manages tasks, discussions, file uploads        │
└──────────────┬─────────────────────────────────────┘
               │ works inside projects
               ▼
┌────────────────────────────────────────────────────┐
│                     STAFF                          │
│  • Sees only projects they are assigned to         │
│  • Sees #public channel                            │
│  • Executes tasks (mark done/undone)               │
│  • Adds comments and uploads files                 │
│  • Has dedicated "My Projects" page                │
└────────────────────────────────────────────────────┘
```

### System Channels (always available)

| Channel | Who Sees It | Purpose |
|---|---|---|
| `#public` | Every workspace user | Shared updates, open task board |
| `#all-sub-admin` | Admins + Sub-Admins | Sub-admin coordination channel |

---

## Feature Map by Role

### Admin
| Feature | Page / Route |
|---|---|
| Create, edit, delete projects | `/projects` |
| Create user accounts (admin/sub-admin/staff) | `/configuration` |
| Assign sub-admins and staff to projects | `/projects` → configure card |
| View all projects and channels | `/projects` |
| Full task board management | `/taskflow?projectId=...` |
| Team overview | `/team` |
| Reports & analytics | `/reports` |
| Calendar & events | `/calendar` |
| Settings & profile | `/settings` |
| Chatbot assistant | All pages (bottom-right) |

### Sub-Admin
| Feature | Page / Route |
|---|---|
| Dashboard with workspace stats | `/subadmin` |
| Task Master — all assigned projects | `/taskmaster` |
| Project cards with progress tracking | `/projects` |
| Task board with to-do management | `/taskflow?projectId=...` |
| Invite and manage staff | Inside TaskFlow |
| File uploads and attachments | Inside TaskFlow |
| Channel discussions | TaskFlow → Channel Feed |
| Calendar & reports | `/calendar`, `/reports` |
| Settings & profile | `/settings` |

### Staff
| Feature | Page / Route |
|---|---|
| Staff dashboard with assigned project summary | `/dashboard` |
| My Projects page (assigned only) | `/my-projects` |
| #public channel shortcut | `/my-projects` |
| Task board access (read + check tasks) | `/taskflow?projectId=...` |
| Mark tasks done/undone | Inside TaskFlow |
| Add comments | Inside TaskFlow |
| Calendar | `/calendar` |
| Settings & profile | `/settings` |

---

## Frontend Architecture

### Page Map

```
/ (redirect to /login)
│
├── /login              Login page (all roles)
├── /signup             Account creation
│
├── /dashboard          Staff dashboard + Admin dashboard
│                       (sub-admin redirects to /subadmin)
├── /subadmin           Sub-Admin portal dashboard
│
├── /projects           Full project board (Admin + Sub-Admin)
├── /my-projects        Staff-only "My Projects" page
├── /taskmaster         Task Master dashboard (Sub-Admin only)
│
├── /taskflow           TaskFlow board (universal, query: ?projectId=)
├── /create-task        Create task form
│
├── /calendar           Calendar page
├── /team               Team management page
├── /reports            Reports & analytics
├── /settings           User settings & profile
├── /configuration      Admin: create accounts, configure workspace
```

### Component Tree

```
App.tsx
├── <ThemeProvider>           CSS class-based dark mode context
├── <BrowserRouter>
│   ├── <Routes>              All page routes
│   └── <ChatbotWidget />     Fixed bottom-right AI assistant (shown when logged in)
│
└── Shared Components
    ├── <Sidebar />           Role-aware navigation links
    └── <Header />            Title bar + theme toggle + user menu + logout
```

### State Architecture

- **Auth state**: stored in `sessionStorage` (per-tab, enables multi-session)
- **Theme state**: stored in `localStorage` (shared across tabs)
- **API calls**: native `fetch` with auth headers (`X-User-Id` + `Authorization: Bearer <token>`)
- **Role-gating**: route-level guards in `App.tsx` (`restrictForStaff`, `restrictForSubAdminOnly`, `redirectSubAdminDashboard`)

### Key Frontend Patterns

| Pattern | Usage |
|---|---|
| Role detection | `localStorage.getItem('role')` → routes, UI show/hide |
| Auth headers helper | `authHeaders()` function in each page file |
| `useCallback` + `useEffect` | Data fetching on mount with cleanup |
| `useMemo` | Filtering and sorting derived from fetched data |
| Dark mode | `dark:` Tailwind utility classes, toggled by `.dark` class on `<html>` |
| Progress sync | Task done/undone → backend recalculates → updates both `task_boards` + `projects` collections |

---

## Backend Architecture

### Layer Diagram

```
HTTP Request
     │
     ▼
┌─────────────┐
│   Routes    │  FastAPI routers (prefix per domain)
│ /auth       │  → validates request schema
│ /projects   │  → calls dependency for current_user
│ /tasks      │  → delegates to service layer
│ /task-boards│
│ /users      │
│ /teams      │
│ /ws         │  WebSocket endpoint
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Services   │  Business logic
│ auth_service│  → generates/validates JWT
│ project_svc │  → RBAC visibility filter
│ task_board  │  → progress sync after task mutation
│ ws_manager  │  → connection pool, broadcast
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  MongoDB    │  motor (async) via get_database()
│  (Motor)    │  Collection names defined in collections.py
└─────────────┘
```

### RBAC Visibility Filter (Projects)

```python
# admin      → sees everything
# sub_admin  → sees public-group + all-sub-admin + projects they are assigned to
# staff      → sees public-group + projects where staff_ids contains their user id
```

### Progress Sync Flow

```
User marks task done
      │
      ▼
task_board_service.update_task()
      │
      ▼
_tasks_progress(tasks) → count(done) / total * 100
      │
      ▼
UPDATE task_boards.overview.progress = X
UPDATE projects.progress = X
      │
      ▼
Frontend card shows live progress bar
```

---

## Database Collections

| Collection | Contents |
|---|---|
| `users` | Accounts with roles (admin/sub_admin/staff), hashed passwords, profile data |
| `projects` | Project metadata, status, progress %, sub_admin_ids, staff_ids |
| `task_boards` | One board per project — overview stats + tasks array with done flags |
| `tasks` | Individual task documents (title, description, assignee, due date) |
| `teams` | Named teams, members list |
| `memberships` | User ↔ team relationships |
| `comments` | Comments attached to tasks or task boards |
| `files` | File metadata (name, size, mime, uploader, project reference) |
| `file_upload_rules` | Per-project rules: allowed file types, max size, max count |
| `notifications` | User notification records (read/unread, type, payload) |
| `events` | Calendar events linked to projects or users |

---

## Authentication & Security

- **Password hashing**: `bcrypt` (work factor ≥ 12)
- **Token type**: JWT signed with `HS256`
- **Token lifetime**: 480 minutes (8 hours) per session
- **Token transport**: `Authorization: Bearer <token>` header
- **User identity**: `X-User-Id` header (secondary, for DB lookups)
- **Role enforcement**: FastAPI `Depends(get_current_user)` + `_visibility_filter()` per route
- **CORS**: allowed origins configured in `settings.ALLOWED_ORIGINS` (ports 3000, 5173, 4173, 8000)

---

## Multi-Session Support

Multiple browser tabs can be logged in as **different users simultaneously**.

**How it works (`client/src/main.tsx`):**

```
Before React renders, a proxy is installed on window.localStorage
that intercepts reads/writes for auth-specific keys:

  token, userId, role, fullName, email,
  userName, name, jobTitle, phone, bio

→ These keys are transparently redirected to sessionStorage
  (isolated per browser tab / window)

→ Non-auth keys (theme, sidebar state)
  stay in real localStorage and are shared across tabs
```

**Result:**
- Tab 1: logged in as Admin
- Tab 2: logged in as Sub-Admin
- Tab 3: logged in as Staff
- All tabs are fully independent, no interference

---

## Light / Dark Mode

- Strategy: **class-based** — `.dark` class toggled on `<html>` and `<body>`
- CSS declaration: `@variant dark (&:where(.dark, .dark *))` in `index.css`
- Tailwind v4 `@theme` tokens define the design system colors
- Theme stored in `localStorage` (shared across all tabs as a user preference)
- Toggle button: in `<Header />` top bar

**Design tokens (light mode):**

| Token | Value | Usage |
|---|---|---|
| `--color-background` | `#e9ecf4` | Page fill |
| `--color-surface` | `#ffffff` | Cards / panels |
| `--color-text-dark` | `#1a1a1a` | Primary text |
| `--color-text-gray` | `#6b7280` | Secondary / label text |
| `--color-primary` | `#1d7bf4` | Buttons, links, active states |
| `--color-success` | `#10b981` | Completed status |
| `--color-warning` | `#f59e0b` | On-hold / attention |
| `--color-danger` | `#ef4444` | Errors / destructive actions |
| `--color-border` | `#d1d5db` | Card borders |

---

## Chatbot Widget

A floating AI assistant accessible from every page when logged in.

**Location**: fixed `bottom-right`, z-index 50

**Features:**
- Greeting message sent automatically on first open
- Unread badge with pulse animation when closed
- Keyword-based response engine covering: projects, tasks, calendar, team, reports, settings, channels, roles, login/logout
- Typing indicator (3-dot bounce animation)
- Enter to send, scrollable message history
- Markdown-style **bold** text rendering in responses
- Graceful fallback for unrecognized messages

---

## Real-Time Layer

- **Protocol**: WebSocket (`/ws` route, `ws_manager.py`)
- **Manager**: keeps a registry of connected clients per user/room
- **Events**: notification delivery, live task updates, channel messages
- **Frontend**: connects via native `WebSocket` API

---

## Project Structure

```
Graduation_project_Workspace/
│
├── workspace-quality.md          ← This file
│
├── backend/
│   ├── main.py                   FastAPI entry point (lifespan: DB connect + indexes)
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── core/
│       │   ├── config.py         Pydantic settings (MONGO_URL, JWT, CORS, app name)
│       │   └── security.py       JWT create/decode, bcrypt hash/verify
│       ├── db/
│       │   ├── mongodb.py        Motor async client, connect/disconnect
│       │   └── collections.py    Collection name constants + index creation
│       ├── dependencies/
│       │   ├── auth.py           get_current_user dependency
│       │   └── rbac.py           Role-check helpers
│       ├── models/               Pydantic document models (stored shape)
│       ├── schemas/              Pydantic request/response schemas (API shape)
│       ├── routes/               FastAPI APIRouter instances (one per domain)
│       ├── services/             Business logic (pure async functions)
│       └── utils/
│           ├── file_validation.py
│           ├── id_helpers.py
│           └── pagination.py
│
└── client/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── main.tsx              Entry point + sessionStorage auth proxy
        ├── App.tsx               Router root + role guards + ChatbotWidget
        ├── index.css             Tailwind v4 @theme tokens + dark mode @variant
        ├── components/
        │   ├── Sidebar.tsx       Role-aware nav (admin / sub_admin / staff menus)
        │   ├── Header.tsx        Top bar + theme toggle + logout
        │   ├── CreateProjectModal.tsx
        │   └── ChatbotWidget.tsx Floating AI assistant
        ├── contexts/
        │   ├── ThemeContext.tsx
        │   ├── ThemeContextDefinition.ts
        │   └── useTheme.ts
        ├── pages/
        │   ├── Login.tsx / SignUp.tsx
        │   ├── Dashboard.tsx         Admin + Staff dashboard
        │   ├── SubAdminPortal.tsx    Sub-Admin dashboard
        │   ├── Projects.tsx          Admin/Sub-Admin project board
        │   ├── StaffProjectsPage.tsx Staff "My Projects"
        │   ├── TaskMasterDashboard.tsx  Sub-Admin task overview
        │   ├── TaskFlowDetail.tsx    TaskFlow board (all roles)
        │   ├── CreateTask.tsx
        │   ├── TeamPage.tsx
        │   ├── CalendarPage.tsx
        │   ├── ReportsPage.tsx
        │   ├── SettingsPage.tsx
        │   └── ConfigurationPage.tsx
        └── types/
            └── index.ts          Shared TS interfaces (Project, Task, User, etc.)
```

---

## Running the Project

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB running locally on port `27017`

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and edit environment variables
cp .env.example .env
# Edit .env: set MONGODB_URL, JWT_SECRET_KEY, etc.

# Start the server
uvicorn main:app --reload --port 8000
```

API available at: `http://localhost:8000`
Swagger docs: `http://localhost:8000/docs`

### Frontend

```bash
cd client

# Install dependencies
npm install

# Copy environment file (if needed)
# Create .env with:
# VITE_API_BASE=http://localhost:8000/api/v1

# Start dev server
npm run dev
```

App available at: `http://localhost:5173`

---

## API Endpoints Reference

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Login, returns JWT + user data |
| `POST` | `/api/v1/auth/register` | Admin | Create new user account |
| `GET` | `/api/v1/projects` | All | List projects (filtered by role) |
| `POST` | `/api/v1/projects` | Admin | Create project |
| `PATCH` | `/api/v1/projects/{id}` | Admin | Update project metadata / status |
| `DELETE` | `/api/v1/projects/{id}` | Admin | Delete project |
| `GET` | `/api/v1/task-boards/{project_id}` | All | Get task board for a project |
| `POST` | `/api/v1/task-boards/{project_id}/tasks` | Sub-Admin | Add task to board |
| `PATCH` | `/api/v1/task-boards/{project_id}/tasks/{task_id}` | All | Update task (done, title, assignee) |
| `DELETE` | `/api/v1/task-boards/{project_id}/tasks/{task_id}` | Sub-Admin | Delete task |
| `GET` | `/api/v1/users` | Admin | List all users |
| `GET` | `/api/v1/teams` | Admin/Sub-Admin | List teams |
| `WS` | `/ws/{user_id}` | All | WebSocket connection for real-time events |

> After any task mutation the backend automatically recalculates `progress %` and updates both the `task_boards` and `projects` collections, so all dashboards reflect live completion state.

---

## Quality Highlights

| Quality Aspect | Implementation |
|---|---|
| Role isolation | Backend RBAC filter + frontend route guards |
| Session isolation | sessionStorage proxy — each tab has its own session |
| Type safety | Pydantic v2 (backend) + TypeScript strict (frontend) |
| Async I/O | Motor async MongoDB driver, FastAPI async routes |
| Dark mode | CSS class strategy, all components have `dark:` variants |
| Accessibility | `aria-label`, `aria-expanded`, `aria-haspopup` on interactive elements |
| Progress accuracy | Server-side calculation prevents client-side manipulation |
| Security | Passwords never stored in plain text; JWT expiry enforced |
| Scalability | Service layer decoupled from routes; indexed MongoDB queries |

---

*Hericle v2.0 — Graduation Project*
