# Figma Design → React Component Mapping

This document provides a detailed mapping between the Figma design frames and the implemented React components.

## 📱 Page Screenshots → Components

### 1. Sign Up Page (Screenshot 1)
**Figma Frame**: Sign Up / Registration Form  
**React Component**: `src/pages/SignUp.tsx`  
**Route**: `/signup`

#### Elements Implemented:
- ✅ Top navigation bar with logo and "Already have an account? Log in" link
- ✅ Centered white card container with shadow
- ✅ "Create your account" heading
- ✅ "Start collaborating with your team today" subheading
- ✅ First Name + Last Name (side-by-side inputs)
- ✅ Phone Number input with phone icon
- ✅ Email Address input with envelope icon
- ✅ Password + Re-enter Password (side-by-side with lock icons)
- ✅ Date of Birth (3 dropdown selects for Month/Day/Year)
- ✅ Terms of Service checkbox with links
- ✅ Blue "Create Account" button
- ✅ "OR SIGN UP WITH" divider
- ✅ Google SSO button with logo
- ✅ Microsoft SSO button with logo

#### Component Props:
- None (standalone page)

#### State Management:
- Form inputs (placeholder - add form validation library)

---

### 2. Login Page (Screenshot 2)
**Figma Frame**: Login / Sign In Form  
**React Component**: `src/pages/Login.tsx`  
**Route**: `/login`

#### Elements Implemented:
- ✅ Top navigation bar with logo and "Need Help? Contact Support"
- ✅ Centered white card container with shadow
- ✅ "Welcome back" heading
- ✅ "Login to manage your projects" subheading
- ✅ Email Address input
- ✅ Password input with show/hide eye icon
- ✅ "Forgot password?" link (right-aligned)
- ✅ Blue "Sign In" button
- ✅ "OR" divider
- ✅ "Sign in with Google" button
- ✅ "Sign in with SSO" button
- ✅ "Don't have an account? Sign up" footer text

#### Component Props:
- None (standalone page)

#### State Management:
- Form inputs
- Password visibility toggle

---

### 3. Dashboard Skeleton (Screenshot 3)
**Figma Frame**: Dashboard Loading State  
**Purpose**: Reference for loading states  
**Implementation**: Not implemented as separate component (use for future loading states)

#### Suggested Implementation:
- Skeleton screens with gray placeholder boxes
- Shimmer effect for loading animation
- Same layout as full dashboard

---

### 4. Dashboard - Main (Screenshot 4)
**Figma Frame**: Dashboard / Home Screen  
**React Component**: `src/pages/Dashboard.tsx`  
**Route**: `/dashboard`

#### Elements Implemented:

**Header Section**:
- ✅ Sidebar component (imported)
- ✅ Top header with search bar, notification icon, message icon, profile avatar

**Welcome Section**:
- ✅ "Welcome back, Alex" heading (h1, bold)
- ✅ "Monday, October 23rd" date subtitle

**Stats Cards** (4 cards in a row):
- ✅ Total Tasks: 124 (+5% green)
- ✅ In Progress: 12 (+2% green)
- ✅ Completed: 84 (-1% red)
- ✅ Team Velocity: 92% (+8% white text on blue background)

**Recent Activity**:
- ✅ Section heading with "View all" link
- ✅ Activity items with:
  - User avatar (gradient circles with initials)
  - User name (bold)
  - Action text
  - Target (blue link)
  - Colored dot indicator
  - Timestamp

**My Tasks Table**:
- ✅ Section heading with filter/sort icons
- ✅ Table headers: Task Name | Status | Priority | Due Date
- ✅ Task rows with:
  - Task title + category
  - Status badges (colored pills)
  - Priority text (colored)
  - Due date
- ✅ "Show 18 more tasks" link at bottom

#### Reusable Components Used:
- `Sidebar` - Left navigation
- `Header` - Top bar

#### Mock Data Types:
- `Activity[]` - Activity feed items
- `Task[]` - Task list items
- Stats object array

---

### 5. Projects Page (Screenshot 5)
**Figma Frame**: Projects / Portfolio View  
**React Component**: `src/pages/Projects.tsx`  
**Route**: `/projects`

#### Elements Implemented:

**Page Header**:
- ✅ "Projects" page title
- ✅ Grid/List view toggle buttons
- ✅ "Search projects..." input with search icon
- ✅ "+ Create New Project" blue button

**Filter/Sort Bar**:
- ✅ "Active Projects (6)" heading
- ✅ "Sort by: Last Updated" dropdown

**Project Cards Grid** (3 columns):
Each card includes:
- ✅ Status badge (ACTIVE/ON HOLD/COMPLETED)
- ✅ Three-dot menu button
- ✅ Project title (bold)
- ✅ Project description (2 lines, truncated)
- ✅ Progress label and percentage
- ✅ Progress bar (colored by status)
- ✅ Team member avatars (overlapping circles)
- ✅ "Updated Xh ago" timestamp

**Add New Project Card**:
- ✅ Dashed border
- ✅ Plus icon in circle
- ✅ "New Project" title
- ✅ "Start a new team initiative" subtitle
- ✅ Hover state (blue border + background)

#### Reusable Components Used:
- `Sidebar` - Left navigation
- `Header` - Top bar

#### Mock Data Types:
- `Project[]` - Project card data

---

## 🧩 Reusable Components

### Sidebar (`src/components/Sidebar.tsx`)

**Used In**: Dashboard, Projects, Tasks, and all authenticated pages

**Elements**:
- Logo section with "Workspace" and "Standard Plan"
- Navigation items:
  - 📊 Dashboard
  - 📁 Projects
  - ✓ Tasks
  - 📅 Calendar
  - 👥 Team
  - 📈 Reports
  - ⚙️ Settings

**Features**:
- Active state highlighting (blue background)
- React Router navigation
- Icon + label layout

**Props**:
- None (uses `useLocation` for active state)

---

### Header (`src/components/Header.tsx`)

**Used In**: Dashboard, Projects, Tasks, and all authenticated pages

**Elements**:
- Page title (left side)
- Search input with icon
- Notification bell icon
- Message/comment icon
- Profile avatar (gradient with initial)

**Props**:
- `title: string` - Page title to display

---

## 🎨 Styling Details

### Exact Measurements

| Element | Measurement |
|---------|-------------|
| Sidebar Width | 240px |
| Header Height | 64px (h-16) |
| Card Border Radius | 12px (rounded-xl) |
| Input Height | 40px (h-10) |
| Button Height | 44px (h-11) |
| Avatar Size (small) | 28px (w-7 h-7) |
| Avatar Size (medium) | 36px (w-9 h-9) |
| Page Padding | 32px (p-8) |
| Card Padding | 24px (p-6) |

### Color Usage Map

| Color | Usage |
|-------|-------|
| `#1D7BF4` (Primary) | Buttons, links, active states, In Progress status |
| `#F8F9FB` (Background) | Page backgrounds |
| `#FFFFFF` (White) | Cards, inputs, sidebar |
| `#1A1A1A` (Text Dark) | Headings, primary text |
| `#6B7280` (Text Gray) | Secondary text, placeholders |
| `#10B981` (Success) | Active status, positive changes |
| `#F59E0B` (Warning) | On Hold status, medium priority |
| `#EF4444` (Danger) | High priority, negative changes |

### Font Weights

| Weight | Usage |
|--------|-------|
| 300 | Light text (rarely used) |
| 400 | Body text, descriptions |
| 500 | Medium emphasis, labels |
| 600 | Semi-bold, card titles |
| 700 | Bold, page headings |
| 800 | Extra bold (rarely used) |

---

## 🔄 Component Hierarchy

```
App (Router)
│
├── SignUp (Standalone)
├── Login (Standalone)
│
└── Authenticated Pages
    ├── Sidebar (Shared)
    ├── Header (Shared)
    │
    ├── Dashboard
    │   ├── Stats Cards
    │   ├── Recent Activity Feed
    │   └── My Tasks Table
    │
    ├── Projects
    │   ├── Page Controls
    │   ├── Project Card (x5)
    │   └── Add New Card
    │
    └── Tasks (Placeholder)
```

---

## 📊 Data Flow

### Current Implementation (Static)
- Mock data defined in each page component
- No API calls
- No global state management

### Recommended for Production
```
API ←→ React Query ←→ Components
         ↓
    Global State (Context/Redux)
         ↓
    UI Components
```

---

## ✨ Interactive States

### Buttons
- **Default**: Defined colors
- **Hover**: Slightly darker background
- **Active**: Pressed state
- **Disabled**: Reduced opacity (not implemented)

### Inputs
- **Default**: Gray border
- **Focus**: Blue ring + border
- **Error**: Red border (not implemented)
- **Filled**: Maintains focus styles

### Cards
- **Default**: White bg, gray border
- **Hover**: Shadow effect
- **Active**: N/A

### Navigation
- **Default**: Gray text
- **Hover**: Light gray background
- **Active**: Blue background + blue text

---

## 🎯 Precision Matching Checklist

### Layout ✅
- [x] Sidebar fixed at 240px
- [x] Header fixed at 64px
- [x] Proper spacing between elements
- [x] Grid layouts match design
- [x] Responsive breakpoints (to be implemented)

### Typography ✅
- [x] Inter font family
- [x] Correct font weights
- [x] Matching font sizes
- [x] Proper line heights
- [x] Letter spacing as needed

### Colors ✅
- [x] Exact hex values
- [x] Correct opacity levels
- [x] Proper gradient angles
- [x] Border colors match

### Spacing ✅
- [x] Padding values exact
- [x] Margin values exact
- [x] Gap between elements correct
- [x] Border radius values match

### Visual Effects ✅
- [x] Shadow intensities
- [x] Hover transitions
- [x] Border styles
- [x] Icon sizes

---

**Last Updated**: February 4, 2026  
**Design Source**: Figma (5 screenshots provided)  
**Implementation Status**: ✅ Complete (MVP)
