// ── Platform orbit modules (hero visualization) ────────────────────────────
export const ORBIT_MODULES = [
  { id: 'workspace', name: 'Workspace',    color: '#3b82f6', speed: 0.22 },
  { id: 'projects',  name: 'Projects',     color: '#10b981', speed: 0.18 },
  { id: 'quality',   name: 'Quality AI',   color: '#f59e0b', speed: 0.26 },
  { id: 'analytics', name: 'Analytics',    color: '#06b6d4', speed: 0.15 },
  { id: 'team',      name: 'Team Collab',  color: '#ec4899', speed: 0.21 },
  { id: 'ai',        name: 'AI Assistant', color: '#8b5cf6', speed: 0.17 },
] as const;

// ── Legacy alias kept for sections that reference GALAXY_MODULES ────────────
export const GALAXY_MODULES = [
  { color: '#3b82f6', radius: 2.8, tilt:   5, speed: 0.7, size: 0.22, startAngle:   0 },
  { color: '#10b981', radius: 3.8, tilt:  28, speed: 0.5, size: 0.20, startAngle:  60 },
  { color: '#8b5cf6', radius: 4.9, tilt: -42, speed: 0.3, size: 0.25, startAngle: 120 },
  { color: '#f59e0b', radius: 3.3, tilt:  55, speed: 0.6, size: 0.18, startAngle: 200 },
  { color: '#06b6d4', radius: 5.6, tilt: -18, speed: 0.2, size: 0.22, startAngle: 240 },
  { color: '#ec4899', radius: 4.2, tilt:  68, speed: 0.4, size: 0.19, startAngle: 300 },
] as const;

// ── Platform modules (sections) ─────────────────────────────────────────────
export const PLATFORM_MODULES = [
  { id: 'workspace', name: 'Workspace',    icon: '🏢', color: '#3b82f6', desc: 'Unified workspace management' },
  { id: 'projects',  name: 'Projects',     icon: '📁', color: '#10b981', desc: 'Project tracking & delivery'  },
  { id: 'quality',   name: 'Quality AI',   icon: '✦',  color: '#f59e0b', desc: 'Accreditation & compliance'   },
  { id: 'analytics', name: 'Analytics',    icon: '📊', color: '#06b6d4', desc: 'Real-time performance'        },
  { id: 'team',      name: 'Team Collab',  icon: '👥', color: '#ec4899', desc: 'Team collaboration'           },
  { id: 'ai',        name: 'AI Assistant', icon: '🤖', color: '#8b5cf6', desc: 'AI-powered intelligence'      },
] as const;

// ── Hub angles for 6 nodes ──────────────────────────────────────────────────
export const HUB_ANGLES = [270, 330, 30, 90, 150, 210] as const;

// ── Mission features ────────────────────────────────────────────────────────
export const MISSION_FEATURES = [
  { icon: '🌐', color: 'rgba(26,111,255,.12)',   text: 'var(--blue)',   title: 'Unified Workspaces',       desc: 'One source of truth for all your teams, groups, and departments.' },
  { icon: '⚡', color: 'rgba(16,185,129,.12)',   text: 'var(--green)',  title: 'Real-time Collaboration',  desc: 'Every action syncs instantly — no lag, no friction, no duplication.' },
  { icon: '🧠', color: 'rgba(139,92,246,.12)',   text: 'var(--purple)', title: 'AI Intelligence Layer',    desc: 'Embedded AI reviews quality, surfaces risks, and recommends actions.' },
  { icon: '📊', color: 'rgba(245,158,11,.12)',   text: 'var(--amber)',  title: 'Analytics Across the Galaxy', desc: 'From task completions to accreditation scores — in one dashboard.' },
] as const;

// ── Team members ────────────────────────────────────────────────────────────
export const TEAM = [
  { name: 'Ahmed Mohamed',  role: 'Founder & CEO',           initials: 'AM', from: '#1a6fff', to: '#8b5cf6' },
  { name: 'Sara Ahmed',     role: 'Lead Backend Engineer',   initials: 'SA', from: '#8b5cf6', to: '#1a6fff' },
  { name: 'Omar Hassan',    role: 'AI / ML Engineer',        initials: 'OH', from: '#10b981', to: '#06b6d4' },
  { name: 'Nour Ali',       role: 'UX / UI Designer',        initials: 'NA', from: '#f59e0b', to: '#ef4444' },
  { name: 'Khaled Ibrahim', role: 'Platform Engineer',        initials: 'KI', from: '#06b6d4', to: '#8b5cf6' },
  { name: 'Aya Youssef',    role: 'QA & Accreditation Lead', initials: 'AY', from: '#ef4444', to: '#8b5cf6' },
] as const;

// ── Tech stack ──────────────────────────────────────────────────────────────
export const TECH = [
  { name: 'FastAPI',     icon: '⚡', glow: 'rgba(9,185,110,.2)'  },
  { name: 'MongoDB',     icon: '🍃', glow: 'rgba(16,185,129,.2)' },
  { name: 'React',       icon: '⚛️', glow: 'rgba(97,218,251,.2)' },
  { name: 'ChromaDB',    icon: '🔮', glow: 'rgba(139,92,246,.2)' },
  { name: 'TypeScript',  icon: '📘', glow: 'rgba(49,120,198,.2)' },
  { name: 'Gemini AI',   icon: '🧠', glow: 'rgba(139,92,246,.2)' },
  { name: 'Cloud',       icon: '☁️', glow: 'rgba(26,111,255,.2)' },
] as const;

// ── Roadmap ─────────────────────────────────────────────────────────────────
export const ROADMAP = [
  {
    q: 'Q1', status: 'complete', color: '#1a6fff',
    title: 'Core Platform',
    items: ['Workspace Management', 'Team Collaboration', 'Project Tracking', 'Role-based Access'],
  },
  {
    q: 'Q2', status: 'complete', color: '#8b5cf6',
    title: 'AI Integration',
    items: ['Gemini AI Engine', 'Document Analysis', 'RAG Pipeline', 'Workflow Automation'],
  },
  {
    q: 'Q3', status: 'active', color: '#06b6d4',
    title: 'Quality Control',
    items: ['20 Report Types', 'AI QC Scoring', 'Accreditation Workflows', 'Analytics Dashboard'],
  },
  {
    q: 'Q4', status: 'planned', color: '#10b981',
    title: 'Enterprise',
    items: ['Multi-tenant SaaS', 'AI Personalization', 'Custom AI Models', 'Global Deployment'],
  },
] as const;

// ── Nav links ───────────────────────────────────────────────────────────────
export const NAV_LINKS = [
  { label: 'Platform',   href: '#mission'   },
  { label: 'Quality AI', href: '#quality'   },
  { label: 'Analytics',  href: '#analytics' },
  { label: 'Team',       href: '#team'      },
  { label: 'Contact',    href: '#contact'   },
] as const;
