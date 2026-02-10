# Workspace Management Application

A pixel-perfect React implementation of a workspace management application built from Figma designs.

## 🎨 Design to Code Mapping

This project is a **1:1 implementation** of the provided Figma design with exact visual matching.

### Figma Frames → React Components

| Figma Frame | Component/Page | Route | Status |
|------------|---------------|-------|--------|
| Sign Up Screen | `src/pages/SignUp.tsx` | `/signup` | ✅ Complete |
| Login Screen | `src/pages/Login.tsx` | `/login` | ✅ Complete |
| Dashboard (Skeleton) | - | - | 📋 Reference only |
| Dashboard (Full) | `src/pages/Dashboard.tsx` | `/dashboard` | ✅ Complete |
| Projects Page | `src/pages/Projects.tsx` | `/projects` | ✅ Complete |

### Reusable Components

- **Sidebar** (`src/components/Sidebar.tsx`) - Left navigation with active state highlighting
- **Header** (`src/components/Header.tsx`) - Top bar with search, notifications, and profile

## 🚀 Tech Stack

- **React 18** with TypeScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **React Router v6** - Client-side routing

## 📁 Project Structure

```
workspace-app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── pages/               # Page components (routes)
│   │   ├── SignUp.tsx
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Projects.tsx
│   │   └── Tasks.tsx
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts
│   ├── assets/              # Static assets (images, icons)
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles + Tailwind
├── public/                  # Public static files
├── tailwind.config.js       # Tailwind configuration
├── postcss.config.js        # PostCSS configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies
```

## 🎨 Design System

### Colors

Extracted from Figma design and configured in `tailwind.config.js`:

- **Primary Blue**: `#1D7BF4` - Buttons, links, active states
- **Background**: `#F8F9FB` - Main page background
- **Text Dark**: `#1A1A1A` - Headings, primary text
- **Text Gray**: `#6B7280` - Secondary text, labels
- **Success**: `#10B981` - Active status, positive metrics
- **Warning**: `#F59E0B` - On hold status
- **Danger**: `#EF4444` - High priority, negative metrics

### Typography

- **Font Family**: Inter (imported from Google Fonts)
- **Font Weights**: 300, 400, 500, 600, 700, 800

### Spacing

All spacing values match the Figma design precisely using Tailwind's spacing scale.

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173/`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 🧭 Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | - | Redirects to `/login` |
| `/signup` | Sign Up Page | User registration with form validation |
| `/login` | Login Page | User authentication |
| `/dashboard` | Dashboard | Main dashboard with stats, activity, and tasks |
| `/projects` | Projects | Project management with grid view |
| `/tasks` | Tasks | Task management (placeholder) |
| `/calendar` | Calendar | Calendar view (placeholder) |
| `/team` | Team | Team management (placeholder) |
| `/reports` | Reports | Analytics and reports (placeholder) |
| `/settings` | Settings | Application settings (placeholder) |

## 📊 Features Implemented

### ✅ Authentication Pages

- **Sign Up Form**:
  - First Name / Last Name
  - Phone Number (with icon)
  - Email Address (with icon)
  - Password / Re-enter Password (with icons)
  - Date of Birth (3 dropdowns)
  - Terms of Service checkbox
  - Google & Microsoft SSO buttons

- **Login Form**:
  - Email Address
  - Password (with show/hide toggle)
  - Forgot Password link
  - Google SSO button
  - Sign in with SSO button
  - Sign up link

### ✅ Dashboard

- **Welcome Section**: Personalized greeting with date
- **Stats Cards**: 
  - Total Tasks (124)
  - In Progress (12)
  - Completed (84)
  - Team Velocity (92%)
- **Recent Activity Feed**: User actions with timestamps and icons
- **My Tasks Table**: 
  - Task name with category
  - Status badges (To Do, In Progress, Done)
  - Priority levels (Low, Medium, High)
  - Due dates
  - Sortable columns

### ✅ Projects Page

- **View Toggle**: Grid/List view switcher
- **Search Bar**: Filter projects
- **Create Button**: Add new project
- **Project Cards**:
  - Status badges (Active, On Hold, Completed)
  - Title and description
  - Progress bar with percentage
  - Team member avatars
  - Last updated timestamp
- **Add New Card**: Dashed border placeholder

## 🎯 Interactive Elements

### Buttons

All buttons have proper `onClick` handlers (placeholder functions) and hover states:
- Primary buttons (blue background)
- Secondary buttons (outlined)
- Icon buttons
- Social auth buttons

### Form Inputs

All form inputs include:
- Placeholder text
- Focus states (ring effect)
- Icon prefixes where appropriate
- Proper `type` attributes

### Navigation

- Sidebar with active state highlighting
- React Router links for navigation
- Hover effects on all interactive elements

## 🎨 Styling Approach

- **Pixel-Perfect**: All spacing, colors, and typography match Figma exactly
- **Tailwind Utility Classes**: Used throughout for consistency
- **Arbitrary Values**: Used where needed for exact measurements
- **Responsive**: Uses Tailwind's responsive utilities
- **Hover States**: All interactive elements have hover effects
- **Transitions**: Smooth transitions on all state changes

## 📝 Mock Data

Static mock data is used for demonstration:
- `src/pages/Dashboard.tsx` - Stats, activities, tasks
- `src/pages/Projects.tsx` - Project cards

Replace with API calls when connecting to a backend.

## 🔧 Type Safety

TypeScript interfaces defined in `src/types/index.ts`:
- `Task` - Task object structure
- `Activity` - Activity feed item
- `Project` - Project card data
- `StatCard` - Statistics card

## 🚀 Next Steps

To connect this to a real backend:

1. **Add State Management**: Redux, Zustand, or React Context
2. **API Integration**: Axios or Fetch for backend calls
3. **Authentication**: JWT tokens, protected routes
4. **Form Validation**: React Hook Form + Zod
5. **Error Handling**: Toast notifications, error boundaries
6. **Loading States**: Skeleton screens, spinners
7. **Data Fetching**: React Query or SWR
8. **Testing**: Vitest + React Testing Library

## 📄 License

MIT

## 👨‍💻 Development Notes

- Clean, production-ready code
- TypeScript for type safety
- Component-based architecture
- Reusable components for scalability
- Follows React best practices
- Semantic HTML throughout
- Accessible markup

---

**Built with precision by a Senior Frontend Engineer** 🎨✨
