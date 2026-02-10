# 👨‍💻 Developer Guide - Component Usage

Quick reference for using and extending the components in this project.

---

## 🧩 Reusable Components

### Sidebar Component

**Location**: `src/components/Sidebar.tsx`

**Purpose**: Left navigation menu with active route highlighting

**Usage**:
```tsx
import Sidebar from '../components/Sidebar';

function YourPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-[240px]">
        {/* Your page content */}
      </div>
    </div>
  );
}
```

**Props**: None (uses React Router's `useLocation` internally)

**Features**:
- Auto-highlights active route
- Fixed width (240px)
- Sticky positioning
- Icon + label navigation items

**Customization**:
```tsx
// Edit menuItems array in Sidebar.tsx
const menuItems = [
  { icon: '📊', label: 'Dashboard', path: '/dashboard' },
  { icon: '📁', label: 'Projects', path: '/projects' },
  // Add more items...
];
```

---

### Header Component

**Location**: `src/components/Header.tsx`

**Purpose**: Top navigation bar with search and user actions

**Usage**:
```tsx
import Header from '../components/Header';

function YourPage() {
  return (
    <>
      <Header title="Page Title" />
      <main className="pt-16 p-8">
        {/* Content starts below header (pt-16) */}
      </main>
    </>
  );
}
```

**Props**:
- `title`: string - Page title displayed on the left

**Features**:
- Search input
- Notification bell icon
- Message/comment icon
- Profile avatar

**Customization**:
```tsx
// Make search functional
<input
  type="text"
  placeholder="Search projects..."
  onChange={(e) => handleSearch(e.target.value)}
  className="..."
/>
```

---

## 📄 Page Templates

### Authenticated Page Template

Use this template for any new authenticated pages:

```tsx
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const YourNewPage = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 ml-[240px]">
        <Header title="Your Page Title" />
        
        <main className="pt-16 p-8">
          {/* Your content here */}
          <h1 className="text-2xl font-bold text-text-dark mb-6">
            Page Heading
          </h1>
          
          {/* Content sections */}
        </main>
      </div>
    </div>
  );
};

export default YourNewPage;
```

### Standalone Page Template

For pages without sidebar (like login/signup):

```tsx
const StandalonePage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Optional top bar */}
      <div className="h-14 bg-white border-b border-gray-200 px-6">
        {/* Logo, navigation, etc. */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[600px] bg-white rounded-xl shadow-sm border border-gray-100 p-10">
          {/* Your form/content */}
        </div>
      </div>
    </div>
  );
};

export default StandalonePage;
```

---

## 🎨 Tailwind Utilities Reference

### Common Color Classes

```tsx
// Text Colors
text-text-dark    // #1A1A1A - Primary text
text-text-gray    // #6B7280 - Secondary text
text-primary      // #1D7BF4 - Links, buttons
text-success      // #10B981 - Success states
text-warning      // #F59E0B - Warning states
text-danger       // #EF4444 - Error states

// Background Colors
bg-background     // #F8F9FB - Page background
bg-white          // #FFFFFF - Cards, inputs
bg-primary        // #1D7BF4 - Primary buttons
bg-gray-50        // Hover states
bg-gray-100       // Disabled states
```

### Common Components

#### Button (Primary)
```tsx
<button className="h-11 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors">
  Button Text
</button>
```

#### Button (Secondary/Outlined)
```tsx
<button className="h-10 px-4 border border-gray-300 rounded-lg text-sm text-text-dark font-medium hover:bg-gray-50 transition-colors">
  Button Text
</button>
```

#### Input Field
```tsx
<div>
  <label className="block text-xs font-medium text-text-dark mb-1.5">
    Label
  </label>
  <input
    type="text"
    placeholder="Placeholder..."
    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
  />
</div>
```

#### Input with Icon
```tsx
<div className="relative">
  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-gray">
    {/* Icon SVG */}
  </svg>
  <input
    type="text"
    className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-lg..."
  />
</div>
```

#### Card
```tsx
<div className="bg-white rounded-xl border border-gray-200 p-6">
  {/* Card content */}
</div>
```

#### Badge/Status
```tsx
<span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-primary">
  Status Text
</span>
```

---

## 📊 Working with Mock Data

### Adding New Mock Data

**Dashboard Example**:
```tsx
// In Dashboard.tsx
const newActivities: Activity[] = [
  {
    id: 'unique-id',
    user: { name: 'User Name', avatar: 'UN' },
    action: 'action taken',
    target: 'Target Item',
    timestamp: 'Just now',
    type: 'update', // 'update' | 'comment' | 'change' | 'create'
  },
];
```

**Projects Example**:
```tsx
// In Projects.tsx
const newProject: Project = {
  id: 'unique-id',
  title: 'Project Title',
  description: 'Brief description of the project',
  status: 'ACTIVE', // 'ACTIVE' | 'ON HOLD' | 'COMPLETED'
  progress: 75, // 0-100
  team: ['AB', 'CD', 'EF'], // Initials for avatars
  updatedAt: 'Updated 1h ago',
};
```

---

## 🔄 React Router Integration

### Adding a New Route

**Step 1**: Create the page component in `src/pages/`
```tsx
// src/pages/NewPage.tsx
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const NewPage = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-[240px]">
        <Header title="New Page" />
        <main className="pt-16 p-8">
          <h1>New Page Content</h1>
        </main>
      </div>
    </div>
  );
};

export default NewPage;
```

**Step 2**: Add route in `src/App.tsx`
```tsx
import NewPage from './pages/NewPage';

// In Routes component
<Route path="/new-page" element={<NewPage />} />
```

**Step 3**: Add to sidebar navigation (optional)
```tsx
// In Sidebar.tsx, add to menuItems array
{ icon: '🆕', label: 'New Page', path: '/new-page' },
```

---

## 🎯 Common Patterns

### Grid Layout (3 columns)
```tsx
<div className="grid grid-cols-3 gap-5">
  {items.map(item => (
    <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Card content */}
    </div>
  ))}
</div>
```

### Avatar (Gradient with Initials)
```tsx
<div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-semibold">
  AB
</div>
```

### Overlapping Avatars
```tsx
<div className="flex -space-x-2">
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-white" />
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 border-2 border-white" />
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-red-400 border-2 border-white" />
</div>
```

### Progress Bar
```tsx
<div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
  <div 
    className="h-full bg-primary transition-all"
    style={{ width: `${progressPercentage}%` }}
  />
</div>
```

### Icon Button
```tsx
<button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
  <svg className="w-4 h-4 text-text-gray" fill="none" stroke="currentColor">
    {/* Icon path */}
  </svg>
</button>
```

---

## 🛠️ Extending Functionality

### Add Form Validation

**Install dependencies**:
```bash
npm install react-hook-form zod @hookform/resolvers
```

**Example usage**:
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  );
}
```

### Add API Integration

**Install dependencies**:
```bash
npm install @tanstack/react-query axios
```

**Setup React Query**:
```tsx
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```

**Use in components**:
```tsx
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => axios.get('/api/tasks').then(res => res.data),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Render tasks */}</div>;
}
```

### Add State Management

**Install Zustand**:
```bash
npm install zustand
```

**Create store**:
```tsx
// src/store/useAuthStore.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
```

**Use in components**:
```tsx
import { useAuthStore } from '../store/useAuthStore';

function Header() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div>
      {user && <span>{user.name}</span>}
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## 🎨 Styling Best Practices

### Do's ✅
- Use Tailwind utility classes for consistency
- Follow the design system colors (e.g., `text-primary`, not `text-blue-500`)
- Use arbitrary values when needed: `w-[240px]`
- Keep spacing consistent with existing components
- Use transitions for all interactive elements

### Don'ts ❌
- Don't use inline styles (use Tailwind)
- Don't add custom CSS classes (stick to Tailwind)
- Don't use hardcoded hex values (use design system)
- Don't mix spacing units (stick to Tailwind scale)

---

## 🔍 TypeScript Tips

### Adding New Types

Add to `src/types/index.ts`:
```tsx
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}
```

### Component Props Types

```tsx
interface MyComponentProps {
  title: string;
  count?: number; // Optional
  onClose: () => void;
  items: Task[];
}

const MyComponent = ({ title, count = 0, onClose, items }: MyComponentProps) => {
  // Component code
};
```

---

## 📚 Useful Commands

```bash
# Development
npm run dev              # Start dev server

# Build
npm run build            # Production build
npm run preview          # Preview production build

# Dependencies
npm install <package>    # Add dependency
npm install -D <package> # Add dev dependency

# TypeScript
npx tsc --noEmit        # Type check without building
```

---

## 🎯 Quick Checklist for New Features

- [ ] Create component in appropriate folder
- [ ] Add TypeScript types if needed
- [ ] Use existing Tailwind classes
- [ ] Add to routes if it's a page
- [ ] Update sidebar if it's a main navigation item
- [ ] Test on localhost
- [ ] Ensure responsive (if applicable)
- [ ] Add hover states to interactive elements
- [ ] Follow existing code style

---

**Happy Coding!** 🚀
