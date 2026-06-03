import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const authHeaders = () => ({
    'X-User-Id': localStorage.getItem('userId') ?? '',
    Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
});

/* ════════════════════════════════════════════════════════════════════════════
   MICRO HELPERS
════════════════════════════════════════════════════════════════════════════ */

const avBg = (n: string) => {
    const h = ((n.charCodeAt(0) ?? 65) * 47 + (n.charCodeAt(1) ?? 65) * 13) % 360;
    return `linear-gradient(135deg,hsl(${h},55%,44%),hsl(${h + 40},48%,32%))`;
};
const ini = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

const relTime = (iso?: string | null) => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

/* ════════════════════════════════════════════════════════════════════════════
   SVG CHART PRIMITIVES
════════════════════════════════════════════════════════════════════════════ */

function Sparkline({ data, color, h = 28, w = 80 }: { data: number[]; color: string; h?: number; w?: number }) {
    const d2 = data.filter(v => v !== null && v !== undefined) as number[];
    if (d2.length < 2) return <svg width={w} height={h} />;
    const min = Math.min(...d2), max = Math.max(...d2), range = (max - min) || 1;
    const pts = d2.map((v, i) => [((i / (d2.length - 1)) * w), h - ((v - min) / range) * (h - 4) - 2] as [number, number]);
    const line = pts.map(([x, y]) => `${x},${y}`).join(' L ');
    const area = `M ${pts[0][0]},${pts[0][1]} L ${line} L ${w},${h} L 0,${h} Z`;
    const gid  = `sg${color.replace(/[^a-z0-9]/gi, '')}${Math.random().toString(36).slice(2,6)}`;
    return (
        <svg width={w} height={h} style={{ overflow: 'visible', flexShrink: 0 }}>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
            <path d={`M ${line}`} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
        </svg>
    );
}

function ProgressRing({ pct, color, size = 56, thick = 5 }: { pct: number; color: string; size?: number; thick?: number }) {
    const r = (size - thick) / 2, c = 2 * Math.PI * r, cx = size / 2;
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={thick} />
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={thick}
                strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cx})`} style={{ transition: 'stroke-dashoffset .6s ease' }} />
            <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size * .2} fontWeight="800">{pct}%</text>
        </svg>
    );
}

function GaugeArc({ score, size = 120 }: { score: number; size?: number }) {
    const cx = size / 2, cy = size * 0.62, r = size * 0.42, thick = size * 0.09;
    const sA = -Math.PI * 0.85, eA = Math.PI * 0.85, totalArc = eA - sA;
    const arc = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const bg0 = arc(sA), bg1 = arc(eA);
    const prog = sA + totalArc * (score / 100);
    const p0 = arc(sA), p1 = arc(prog);
    const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <svg width={size} height={size * 0.75} style={{ overflow: 'visible' }}>
            <path d={`M ${bg0} A ${r} ${r} 0 1 1 ${bg1}`} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={thick} strokeLinecap="round" />
            <path d={`M ${p0} A ${r} ${r} 0 ${score > 50 ? 1 : 0} 1 ${p1}`} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round" />
            <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize={size * 0.26} fontWeight="800">{score}</text>
            <text x={cx} y={cy + size * 0.17} textAnchor="middle" fill="rgba(255,255,255,.35)" fontSize={size * 0.1} fontWeight="600">HEALTH</text>
        </svg>
    );
}

function VerticalBarChart({ bars, height = 140, isDark }: { bars: { l: string; v: number; c: string }[]; height?: number; isDark: boolean }) {
    if (!bars.length) return (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? 'rgba(255,255,255,.2)' : '#94a3b8', fontSize: 11 }}>No data yet</div>
    );
    const max = Math.max(...bars.map(b => b.v), 1);
    const bw = 52, gap = 16;
    const vbW = bars.length * (bw + gap) - gap;
    return (
        <svg viewBox={`0 0 ${vbW} ${height}`} preserveAspectRatio="xMidYMax meet"
            style={{ width: '100%', height, overflow: 'visible', display: 'block' }}>
            {bars.map((bar, i) => {
                const bh = Math.max((bar.v / max) * (height - 28), 2);
                const x = i * (bw + gap), y = height - 20 - bh;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={bw} height={bh} rx={6} fill={bar.c} opacity={0.85} />
                        <rect x={x} y={y} width={bw} height={Math.min(6, bh)} rx={3} fill={bar.c} />
                        <text x={x + bw / 2} y={y - 6} textAnchor="middle" fill={bar.c} fontSize={11} fontWeight="800">{bar.v}</text>
                        <text x={x + bw / 2} y={height - 2} textAnchor="middle" fill={isDark ? 'rgba(255,255,255,.3)' : '#94a3b8'} fontSize={9} fontWeight="600">
                            {bar.l.length > 8 ? bar.l.slice(0, 7) + '…' : bar.l}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function AreaLineChart({ data, labels, color, h = 90 }: { data: (number | null)[]; labels?: string[]; color: string; h?: number }) {
    const clean = data.map((v, i) => v !== null ? { v, i } : null).filter(Boolean) as { v: number; i: number }[];
    if (clean.length < 2) return <svg height={h} style={{ width: '100%' }} />;
    const vals = clean.map(p => p.v);
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
    const W = 320, n = data.length;
    const pts = clean.map(({ v, i }) => [
        (i / (n - 1)) * W,
        h - ((v - min) / range) * (h - 22) - 4,
    ] as [number, number]);
    const linePath = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')}`;
    const areaPath = `M 0,${h} L ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} L ${W},${h} Z`;
    const gid = `alc${color.replace(/[^a-z0-9]/gi, '')}${Math.random().toString(36).slice(2,6)}`;
    return (
        <svg viewBox={`0 0 ${W} ${h}`} style={{ overflow: 'visible', width: '100%', height: h }}>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f, i) => (
                <line key={i} x1={0} y1={h - f * (h - 22) - 4} x2={W} y2={h - f * (h - 22) - 4}
                    stroke="rgba(148,163,184,.07)" strokeWidth={1} />
            ))}
            <path d={areaPath} fill={`url(#${gid})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2.5} fill={color}
                    opacity={i === pts.length - 1 ? 1 : 0.55} />
            ))}
            {labels && data.map((_, i) => (
                <text key={i} x={(i / (n - 1)) * W} y={h + 2} textAnchor="middle" fill="rgba(148,163,184,.55)" fontSize={8.5}>{labels[i]}</text>
            ))}
        </svg>
    );
}

function MiniDonut({ segs, size = 100 }: { segs: { v: number; c: string; l: string }[]; size?: number }) {
    const total = segs.reduce((s, x) => s + x.v, 0) || 1;
    const thick = size * 0.2, r = (size - thick) / 2, circ = 2 * Math.PI * r, cx = size / 2;
    let acc = 0;
    return (
        <svg width={size} height={size}>
            {segs.map((seg, i) => {
                const pct = seg.v / total;
                const rot = -90 + acc * 360; acc += pct;
                return <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={seg.c} strokeWidth={thick}
                    strokeDasharray={`${circ * pct - 1} ${circ * (1 - pct) + 1}`}
                    strokeDashoffset={circ * 0.25} transform={`rotate(${rot} ${cx} ${cx})`} strokeLinecap="butt" />;
            })}
            <text x={cx} y={cx - 3} textAnchor="middle" fill="white" fontSize={size * .18} fontWeight="800">{total}</text>
            <text x={cx} y={cx + size * .14} textAnchor="middle" fill="rgba(255,255,255,.35)" fontSize={size * .09}>total</text>
        </svg>
    );
}

const DAv = ({ name, size = 28 }: { name: string; size?: number }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avBg(name || '??'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .35), fontWeight: 700, color: '#fff', flexShrink: 0, userSelect: 'none' }}>
        {ini(name || '??')}
    </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   INTERFACES
════════════════════════════════════════════════════════════════════════════ */

interface DashKPIs {
    total_projects: number; active_projects: number; completed_projects: number; overdue_projects: number;
    total_tasks: number; tasks_due_today: number; completed_tasks_week: number; team_members: number;
    online_members: number; ai_pass_rate: number; health_score: number; avg_completion: number;
}

interface ProjItem {
    id: string; title: string; description: string; status: string; progress: number;
    health_label: string; health_color: string; risk_level: string; due_date?: string;
    days_until?: number | null; task_count: number; open_tasks: number; review_tasks: number;
    ai_score?: number | null; team_size: number; team_names: string[]; updated_at?: string;
}

interface TeamMember {
    user_id: string; name: string; role: string; tasks_assigned: number; tasks_completed: number;
    completion_rate: number; reviews_passed: number; activity_score: number; last_active?: string;
}

interface WorkloadItem {
    user_id: string; name: string; role: string; current_tasks: number; review_tasks: number;
    due_today: number; overdue: number; status: 'overloaded' | 'balanced' | 'underutilized';
}

interface DashData {
    kpis: DashKPIs;
    projects: ProjItem[];
    team_performance: TeamMember[];
    workload: WorkloadItem[];
    ai_insights: {
        total_reviews: number; pass_count: number; fail_count: number; pass_rate: number;
        common_issues: string[];
        best_project?: { name: string; score: number } | null;
        worst_project?: { name: string; score: number } | null;
        score_distribution: { range: string; count: number }[];
        ai_score_trend: (number | null)[];
    };
    activity_feed: { action: string; user_name: string; resource_type: string; created_at?: string }[];
    smart_alerts: { type: string; severity: string; message: string; count: number; icon: string }[];
    upcoming_deadlines: { today: DlItem[]; tomorrow: DlItem[]; this_week: DlItem[]; next_week: DlItem[] };
    productivity_charts: { tasks_per_day: { date: string; count: number }[]; weekly_progress: number[]; ai_score_trend: (number | null)[] };
}

interface DlItem { id: string; title: string; progress: number; status: string; days_until: number }

/* ════════════════════════════════════════════════════════════════════════════
   EXECUTIVE DASHBOARD
════════════════════════════════════════════════════════════════════════════ */

const SubAdminPortal = () => {
    const navigate = useNavigate();
    const isDark = document.documentElement.classList.contains('dark');
    const userName = localStorage.getItem('name') || localStorage.getItem('userName') || 'Sub-Manager';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeGreet = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })();

    const [data, setData]       = useState<DashData | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [searchOpen, setSearchOpen] = useState(false);

    // ── Theme tokens ──────────────────────────────────────────────────────────
    const t = {
        bg:    isDark ? '#0b0d14' : '#f0f4f8',
        surf:  isDark ? '#111420' : '#ffffff',
        surf2: isDark ? '#141822' : '#f8fafc',
        bord:  isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
        text:  isDark ? '#f0f4f9' : '#0f172a',
        sub:   isDark ? 'rgba(255,255,255,.6)' : '#334155',
        muted: isDark ? 'rgba(255,255,255,.28)' : '#94a3b8',
    };
    const S  = { background: t.surf, border: `1px solid ${t.bord}` };
    const BD = `1px solid ${isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'}`;

    // ── Data fetch ────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/analytics/subadmin/dashboard`, { headers: authHeaders() });
            if (res.ok) setData(await res.json());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchAll(); }, [fetchAll]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const kpis       = data?.kpis;
    const projects   = data?.projects ?? [];
    const teamPerf   = data?.team_performance ?? [];
    const workload   = data?.workload ?? [];
    const aiIns      = data?.ai_insights;
    const activity   = data?.activity_feed ?? [];
    const alerts     = data?.smart_alerts ?? [];
    const deadlines  = data?.upcoming_deadlines;
    const charts     = data?.productivity_charts;

    const WEEK_LABELS = ['6w ago', '5w', '4w', '3w', '2w', 'Last wk', 'Now'];
    const DAY_LABELS  = charts?.tasks_per_day.map(d => d.date) ?? [];

    const healthGroups = useMemo(() => {
        const g: Record<string, ProjItem[]> = { Healthy: [], 'Attention Needed': [], Blocked: [], Overdue: [], Completed: [] };
        projects.forEach(p => {
            const cat = p.health_label in g ? p.health_label : 'Attention Needed';
            g[cat].push(p);
        });
        return g;
    }, [projects]);

    const workloadBars = useMemo(() =>
        workload.slice(0, 8).map(w => ({
            l: w.name.split(' ')[0],
            v: w.current_tasks,
            c: w.status === 'overloaded' ? '#ef4444' : w.status === 'underutilized' ? '#6366f1' : '#10b981',
        })),
    [workload]);

    const mkSpark = (v: number): number[] => {
        const b = Math.max(0, v - 5);
        return [b, b + 1, b + 1, b + 2, b + 2, b + 3, v];
    };

    const MEDAL = ['🥇', '🥈', '🥉'];
    const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32'];

    const SEVERITY_COLORS: Record<string, string> = {
        critical: '#ef4444', high: '#f59e0b', medium: '#8b5cf6', low: '#10b981',
    };

    const filteredProjects = useMemo(() => {
        if (!search.trim()) return projects;
        const q = search.toLowerCase();
        return projects.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }, [projects, search]);

    // ── Action icons ──────────────────────────────────────────────────────────
    const Icon = {
        project:  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
        task:     <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
        search:   <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>,
        refresh:  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>,
        arrow:    <svg style={{ width: 11, height: 11 }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>,
        users:    <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>,
        report:   <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
        ai:       <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7 14a5 5 0 0010 0z" /></svg>,
    };

    const sectionHead = (label: string, sub?: string, action?: React.ReactNode) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.text, letterSpacing: '-.01em' }}>{label}</div>
                {sub && <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>{sub}</div>}
            </div>
            {action}
        </div>
    );

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Executive Dashboard" />

                <main className="page-main" style={{ padding: '20px 24px 40px', background: t.bg, minHeight: '100vh', fontFamily: '"Inter",-apple-system,sans-serif' }}>

                    {/* ══════════════════════════════════════════════════════════
                        SECTION 1 — EXECUTIVE HEADER
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{
                        position: 'relative', overflow: 'hidden', borderRadius: 20, marginBottom: 18,
                        background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 30%,#4338ca 60%,#1d4ed8 100%)',
                        boxShadow: '0 12px 40px rgba(67,56,202,0.3)',
                    }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 10% 30%, rgba(255,255,255,.18) 0%, transparent 60%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', right: -20, bottom: -16, fontSize: 200, fontWeight: 900, color: 'rgba(255,255,255,.04)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none', fontFamily: 'monospace' }}>◈</div>

                        <div style={{ position: 'relative', zIndex: 10, padding: '24px 28px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                                {/* Left: greeting */}
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginBottom: 4 }}>
                                        {today}
                                    </div>
                                    <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1.15, letterSpacing: '-.02em', marginBottom: 4 }}>
                                        {timeGreet}, {userName}
                                    </h1>
                                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 12 }}>
                                        Sub-Manager · Executive Workspace Dashboard
                                    </p>

                                    {/* Status pills */}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(16,185,129,.22)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,.3)' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
                                            Workspace Online
                                        </span>
                                        {!loading && kpis && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.8)' }}>
                                                {Icon.users} {kpis.online_members} online
                                            </span>
                                        )}
                                        {!loading && kpis && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: kpis.health_score >= 70 ? 'rgba(16,185,129,.2)' : 'rgba(245,158,11,.2)', color: kpis.health_score >= 70 ? '#6ee7b7' : '#fcd34d' }}>
                                                Health {kpis.health_score}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Right: search + action buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                                    {/* Command search */}
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            value={search}
                                            onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
                                            onFocus={() => setSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                                            placeholder="Search projects, tasks, reports…"
                                            style={{
                                                height: 38, width: 280, paddingLeft: 36, paddingRight: 12, borderRadius: 10,
                                                background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
                                                color: '#fff', fontSize: 12, fontFamily: 'inherit', outline: 'none',
                                            }}
                                        />
                                        <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.5)' }}>{Icon.search}</div>
                                        {searchOpen && search && filteredProjects.length > 0 && (
                                            <div style={{
                                                position: 'absolute', top: 44, left: 0, right: 0, borderRadius: 10,
                                                background: isDark ? '#1a1f2e' : '#fff', border: `1px solid ${t.bord}`,
                                                boxShadow: '0 12px 40px rgba(0,0,0,0.4)', zIndex: 100, overflow: 'hidden',
                                            }}>
                                                {filteredProjects.slice(0, 5).map(p => (
                                                    <div key={p.id}
                                                        onMouseDown={() => navigate(`/taskflow?projectId=${p.id}`)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: BD, transition: 'background .1s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                    >
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.health_color, flexShrink: 0 }} />
                                                        <span style={{ fontSize: 12, color: t.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                                                        <span style={{ fontSize: 10, color: t.muted }}>{p.progress}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Refresh button */}
                                    <button type="button" onClick={() => { void fetchAll(); }}
                                        style={{ height: 36, width: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {Icon.refresh}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        SECTION 2 — KPI CARDS (12 cards, 4 per row)
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                        {([
                            { l: 'Total Projects',       v: kpis?.total_projects,         c: '#6366f1', spark: mkSpark(kpis?.total_projects ?? 0),       trend: 0,  path: '/projects' },
                            { l: 'Active Projects',      v: kpis?.active_projects,         c: '#10b981', spark: mkSpark(kpis?.active_projects ?? 0),       trend: +1, path: '/projects' },
                            { l: 'Completed',            v: kpis?.completed_projects,      c: '#10b981', spark: mkSpark(kpis?.completed_projects ?? 0),    trend: +1, path: '/projects' },
                            { l: 'Overdue Projects',     v: kpis?.overdue_projects,        c: '#ef4444', spark: mkSpark(kpis?.overdue_projects ?? 0),      trend: -1, path: '/projects' },
                            { l: 'Total Tasks',          v: kpis?.total_tasks,             c: '#6366f1', spark: mkSpark(kpis?.total_tasks ?? 0),           trend: 0,  path: '/taskmaster' },
                            { l: 'Due Today',            v: kpis?.tasks_due_today,         c: '#f59e0b', spark: mkSpark(kpis?.tasks_due_today ?? 0),       trend: 0,  path: '/taskmaster' },
                            { l: 'Done This Week',       v: kpis?.completed_tasks_week,    c: '#10b981', spark: mkSpark(kpis?.completed_tasks_week ?? 0),  trend: +1, path: '/taskmaster' },
                            { l: 'Team Members',         v: kpis?.team_members,            c: '#8b5cf6', spark: mkSpark(kpis?.team_members ?? 0),          trend: 0,  path: '/team' },
                            { l: 'Online Members',       v: kpis?.online_members,          c: '#06b6d4', spark: mkSpark(kpis?.online_members ?? 0),        trend: 0,  path: '/team' },
                            { l: 'AI Review Pass Rate',  v: kpis ? `${kpis.ai_pass_rate}%` : '—',  c: '#8b5cf6', spark: mkSpark(kpis?.ai_pass_rate ?? 0),  trend: (kpis?.ai_pass_rate ?? 0) >= 85 ? +1 : -1, path: '/reports' },
                            { l: 'Workspace Health',     v: kpis ? `${kpis.health_score}%` : '—',  c: (kpis?.health_score ?? 0) >= 70 ? '#10b981' : '#f59e0b', spark: mkSpark(kpis?.health_score ?? 0), trend: (kpis?.health_score ?? 0) >= 70 ? +1 : 0, path: '/reports' },
                            { l: 'Avg Completion',       v: kpis ? `${kpis.avg_completion}%` : '—', c: (kpis?.avg_completion ?? 0) >= 70 ? '#10b981' : '#f59e0b', spark: mkSpark(kpis?.avg_completion ?? 0), trend: (kpis?.avg_completion ?? 0) >= 60 ? +1 : -1, path: '/projects' },
                        ] as { l: string; v: any; c: string; spark: number[]; trend: number; path: string }[]).map(k => (
                            <div key={k.l} onClick={() => navigate(k.path)}
                                style={{ ...S, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'transform .15s,box-shadow .15s', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 88 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${k.c}22`; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 9, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>{k.l}</span>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: k.trend > 0 ? '#10b981' : k.trend < 0 ? '#ef4444' : t.muted }}>
                                        {k.trend > 0 ? '▲' : k.trend < 0 ? '▼' : '—'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: k.c, lineHeight: 1 }}>{loading ? '—' : k.v ?? '0'}</div>
                                    {!loading && <Sparkline data={k.spark} color={k.c} h={26} w={48} />}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        ROW: SECTION 3 (Health Center) + SECTION 10 (Alerts)
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, marginBottom: 14 }}>

                        {/* ── Section 3: Workspace Health Center ── */}
                        <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', borderBottom: BD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Workspace Health Center</div>
                                    <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Projects automatically classified by risk</div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {(['Healthy', 'Attention Needed', 'Blocked', 'Overdue'] as const).map(label => {
                                        const colors: Record<string, string> = { Healthy: '#10b981', 'Attention Needed': '#f59e0b', Blocked: '#ef4444', Overdue: '#ef4444' };
                                        const cnt = healthGroups[label]?.length ?? 0;
                                        return cnt > 0 ? (
                                            <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${colors[label]}14`, color: colors[label] }}>
                                                {cnt} {label.split(' ')[0]}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </div>

                            {loading ? (
                                <div style={{ padding: 30, textAlign: 'center', color: t.muted, fontSize: 12 }}>Analyzing workspace health…</div>
                            ) : projects.length === 0 ? (
                                <div style={{ padding: 30, textAlign: 'center', color: t.muted, fontSize: 12 }}>No projects assigned yet.</div>
                            ) : (
                                <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                                    {(['Overdue', 'Blocked', 'Attention Needed', 'Healthy', 'Completed'] as const).map(cat => {
                                        const items = healthGroups[cat] ?? [];
                                        if (!items.length) return null;
                                        const catColors: Record<string, string> = { Healthy: '#10b981', 'Attention Needed': '#f59e0b', Blocked: '#ef4444', Overdue: '#ef4444', Completed: '#10b981' };
                                        const cc = catColors[cat] ?? '#6366f1';
                                        return (
                                            <div key={cat}>
                                                <div style={{ padding: '6px 18px', fontSize: 9, fontWeight: 700, color: cc, textTransform: 'uppercase', letterSpacing: '.1em', background: `${cc}08`, borderBottom: BD }}>
                                                    {cat} ({items.length})
                                                </div>
                                                {items.map(p => (
                                                    <div key={p.id}
                                                        onClick={() => navigate(`/taskflow?projectId=${p.id}`)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: BD, cursor: 'pointer', transition: 'background .1s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                    >
                                                        <div style={{ width: 4, height: 36, borderRadius: 4, background: p.health_color, flexShrink: 0 }} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                                                                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: `${p.health_color}14`, color: p.health_color, flexShrink: 0, fontWeight: 700 }}>
                                                                    {p.health_label}
                                                                </span>
                                                            </div>
                                                            <div style={{ width: '100%', height: 3, borderRadius: 3, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }}>
                                                                <div style={{ height: '100%', width: `${p.progress}%`, background: p.health_color, borderRadius: 3, transition: 'width .5s' }} />
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                            <div style={{ fontSize: 12, fontWeight: 800, color: p.health_color }}>{p.progress}%</div>
                                                            {p.days_until !== null && p.days_until !== undefined && (
                                                                <div style={{ fontSize: 9, color: p.days_until < 0 ? '#ef4444' : p.days_until <= 3 ? '#f59e0b' : t.muted, marginTop: 2 }}>
                                                                    {p.days_until < 0 ? `${Math.abs(p.days_until)}d overdue` : p.days_until === 0 ? 'Due today' : `${p.days_until}d left`}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ flexShrink: 0, color: t.muted }}>{Icon.arrow}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Section 10: Smart Alerts ── */}
                        <div style={{ ...S, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 16px', borderBottom: BD, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#ef4444,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🚨</div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Smart Alerts</div>
                                    <div style={{ fontSize: 10, color: t.muted }}>{alerts.length} active</div>
                                </div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                                {loading ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: t.muted, fontSize: 12 }}>Analyzing…</div>
                                ) : alerts.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center' }}>
                                        <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
                                        <div style={{ fontSize: 12, color: t.muted }}>No alerts — workspace looks great!</div>
                                    </div>
                                ) : alerts.map((a, i) => {
                                    const sc = SEVERITY_COLORS[a.severity] ?? '#6366f1';
                                    return (
                                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: BD }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${sc}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{a.icon}</div>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{a.message}</div>
                                                <div style={{ fontSize: 9, fontWeight: 700, color: sc, textTransform: 'uppercase', marginTop: 2, letterSpacing: '.06em' }}>{a.severity}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        SECTION 4 — PRODUCTIVITY ANALYTICS (charts row)
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 14, marginBottom: 14 }}>

                        {/* Chart 1: Tasks Completed Per Day */}
                        <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                            {sectionHead('Tasks Completed Per Day', 'Last 7 days activity')}
                            {loading ? <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 11 }}>Loading…</div>
                                : <VerticalBarChart isDark={isDark} height={140}
                                    bars={(charts?.tasks_per_day ?? []).map(d => ({ l: d.date, v: d.count, c: '#6366f1' }))} />}
                        </div>

                        {/* Chart 2: Weekly Progress Trend */}
                        <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                            {sectionHead('Weekly Progress Trend', '7-week workspace average',
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: (kpis?.avg_completion ?? 0) >= 70 ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)', color: (kpis?.avg_completion ?? 0) >= 70 ? '#10b981' : '#f59e0b' }}>
                                    {(kpis?.avg_completion ?? 0) >= 70 ? '▲ On Track' : '→ Moderate'}
                                </span>
                            )}
                            {loading ? <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 11 }}>Loading…</div>
                                : <AreaLineChart data={charts?.weekly_progress ?? []} labels={WEEK_LABELS} color="#10b981" h={90} />}
                        </div>

                        {/* Chart 3: AI Score Trend + donut */}
                        <div style={{ ...S, borderRadius: 16, padding: '16px' }}>
                            {sectionHead('AI Review Trend', 'Score avg per day')}
                            {loading ? <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 11 }}>Loading…</div>
                                : <AreaLineChart data={charts?.ai_score_trend ?? []} color="#8b5cf6" h={70} />}
                            {!loading && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                                    <MiniDonut size={90} segs={[
                                        { v: aiIns?.pass_count ?? 0, c: '#10b981', l: 'Pass' },
                                        { v: aiIns?.fail_count ?? 0, c: '#ef4444', l: 'Fail' },
                                    ]} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        SECTION 5 — TEAM PERFORMANCE CENTER (full-width table)
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{ ...S, borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
                        <div style={{ padding: '14px 18px', borderBottom: BD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Team Performance Center</div>
                                <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Ranked by activity score · Real task & review data</div>
                            </div>
                            <button type="button" onClick={() => navigate('/team')}
                                style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Full Analytics →</button>
                        </div>

                        {loading ? (
                            <div style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>Loading team data…</div>
                        ) : teamPerf.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>No team members assigned to your projects yet.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)' }}>
                                            {['#', 'Member', 'Role', 'Assigned', 'Completed', 'Rate', 'Reviews Passed', 'Activity', 'Last Active'].map(h => (
                                                <th key={h} style={{ padding: '8px 16px', textAlign: h === '#' || h === 'Assigned' || h === 'Completed' || h === 'Rate' || h === 'Reviews Passed' || h === 'Activity' ? 'center' : 'left', fontSize: 9, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap', borderBottom: BD }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teamPerf.map((u, i) => {
                                            const isTop3 = i < 3;
                                            const mc = MEDAL_COLORS[i] ?? '#6366f1';
                                            return (
                                                <tr key={u.user_id}
                                                    style={{ borderBottom: BD, transition: 'background .1s', cursor: 'default' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.015)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: isTop3 ? 18 : 11, fontWeight: 800, color: mc }}>
                                                        {isTop3 ? MEDAL[i] : `#${i + 1}`}
                                                    </td>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                            <DAv name={u.name} size={30} />
                                                            <div>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{u.name}</div>
                                                                {isTop3 && (
                                                                    <div style={{ fontSize: 9, color: mc, fontWeight: 700 }}>
                                                                        {i === 0 ? '🥇 Top Performer' : i === 1 ? '🥈 Most Consistent' : '🥉 Fastest Contributor'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: isDark ? 'rgba(99,102,241,.15)' : 'rgba(99,102,241,.08)', color: '#6366f1', fontWeight: 700 }}>
                                                            {u.role.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: t.text }}>{u.tasks_assigned}</td>
                                                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#10b981' }}>{u.tasks_completed}</td>
                                                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                                            <span style={{ fontSize: 12, fontWeight: 800, color: u.completion_rate >= 75 ? '#10b981' : u.completion_rate >= 50 ? '#f59e0b' : '#ef4444' }}>{u.completion_rate}%</span>
                                                            <div style={{ width: 48, height: 3, borderRadius: 3, background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)' }}>
                                                                <div style={{ height: '100%', width: `${u.completion_rate}%`, background: u.completion_rate >= 75 ? '#10b981' : '#f59e0b', borderRadius: 3 }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#8b5cf6' }}>{u.reviews_passed}</td>
                                                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                            <div style={{ width: 40, height: 5, borderRadius: 3, background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)' }}>
                                                                <div style={{ height: '100%', width: `${u.activity_score}%`, background: `linear-gradient(90deg,${mc},${mc}cc)`, borderRadius: 3 }} />
                                                            </div>
                                                            <span style={{ fontSize: 13, fontWeight: 900, color: mc, minWidth: 26 }}>{u.activity_score}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: t.muted, whiteSpace: 'nowrap' }}>{relTime(u.last_active)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        ROW: SECTION 6 (Workload) + SECTION 11 (Deadlines)
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, marginBottom: 14 }}>

                        {/* ── Section 6: Workload Distribution ── */}
                        <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                            {sectionHead('Workload Distribution', 'Current active task load per team member')}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                {[
                                    { l: 'Overloaded (>8)',   c: '#ef4444', cnt: workload.filter(w => w.status === 'overloaded').length },
                                    { l: 'Balanced (3–8)',    c: '#10b981', cnt: workload.filter(w => w.status === 'balanced').length },
                                    { l: 'Under-utilized', c: '#6366f1', cnt: workload.filter(w => w.status === 'underutilized').length },
                                ].map(s => (
                                    <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c, flexShrink: 0 }} />
                                        <span style={{ fontSize: 10, color: t.sub }}>{s.l}</span>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: s.c }}>{loading ? '—' : s.cnt}</span>
                                    </div>
                                ))}
                            </div>
                            {loading ? (
                                <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 11 }}>Loading…</div>
                            ) : (
                                <VerticalBarChart bars={workloadBars} height={150} isDark={isDark} />
                            )}
                            {!loading && workload.length > 0 && (
                                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {workload.slice(0, 5).map(w => (
                                        <div key={w.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <DAv name={w.name} size={24} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                                                    <span style={{ fontSize: 10, color: w.status === 'overloaded' ? '#ef4444' : w.status === 'underutilized' ? '#6366f1' : '#10b981', fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                                                        {w.current_tasks} tasks
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {[
                                                        { l: `${w.review_tasks} review`, c: '#f59e0b' },
                                                        { l: `${w.due_today} due today`, c: '#6366f1' },
                                                        { l: `${w.overdue} overdue`, c: '#ef4444' },
                                                    ].filter(x => x.l.startsWith('0') === false || parseInt(x.l) > 0).map(x => (
                                                        <span key={x.l} style={{ fontSize: 9, color: x.c, fontWeight: 700 }}>{x.l}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Section 11: Upcoming Deadlines ── */}
                        <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 16px', borderBottom: BD }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Upcoming Deadlines</div>
                                <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Project timeline — next 14 days</div>
                            </div>
                            <div style={{ overflowY: 'auto', maxHeight: 360 }}>
                                {loading ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: t.muted, fontSize: 12 }}>Loading…</div>
                                ) : (
                                    (['today', 'tomorrow', 'this_week', 'next_week'] as const).map(key => {
                                        const items = deadlines?.[key] ?? [];
                                        if (!items.length) return null;
                                        const labels: Record<string, string> = { today: 'Today', tomorrow: 'Tomorrow', this_week: 'This Week', next_week: 'Next Week' };
                                        const lc: Record<string, string> = { today: '#ef4444', tomorrow: '#f59e0b', this_week: '#6366f1', next_week: '#10b981' };
                                        return (
                                            <div key={key}>
                                                <div style={{ padding: '5px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: lc[key], background: `${lc[key]}0a`, borderBottom: BD }}>
                                                    {labels[key]}
                                                </div>
                                                {items.map(p => (
                                                    <div key={p.id}
                                                        onClick={() => navigate(`/taskflow?projectId=${p.id}`)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: BD, cursor: 'pointer', transition: 'background .1s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                    >
                                                        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${lc[key]}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <span style={{ fontSize: 10, fontWeight: 900, color: lc[key] }}>
                                                                {p.days_until === 0 ? '!' : p.days_until}
                                                            </span>
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                                            <div style={{ width: '100%', height: 2.5, borderRadius: 2, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', marginTop: 3 }}>
                                                                <div style={{ height: '100%', width: `${p.progress}%`, background: lc[key], borderRadius: 2 }} />
                                                            </div>
                                                        </div>
                                                        <span style={{ fontSize: 10, color: lc[key], fontWeight: 700, flexShrink: 0 }}>{p.progress}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })
                                )}
                                {!loading && !(['today', 'tomorrow', 'this_week', 'next_week'] as const).some(k => (deadlines?.[k]?.length ?? 0) > 0) && (
                                    <div style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>No upcoming deadlines in the next 2 weeks.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        SECTION 7 — PROJECT PORTFOLIO (premium card grid)
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{ ...S, borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
                        <div style={{ padding: '14px 18px', borderBottom: BD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Project Portfolio</div>
                                <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>{projects.length} projects · Click to open workspace</div>
                            </div>
                            <button type="button" onClick={() => navigate('/projects')}
                                style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                                View all →
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: 14 }}>
                                {[1, 2, 3].map(i => <div key={i} style={{ height: 160, borderRadius: 12, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', animation: 'pulse 1.5s infinite' }} />)}
                            </div>
                        ) : projects.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: t.muted, fontSize: 13 }}>No projects yet. Create your first project to get started.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12, padding: 14, maxHeight: 440, overflowY: 'auto' }}>
                                {projects.map(p => (
                                    <div key={p.id}
                                        style={{ borderRadius: 14, border: `1.5px solid ${p.health_color}22`, background: isDark ? 'rgba(255,255,255,.025)' : t.surf, cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}
                                        onClick={() => navigate(`/taskflow?projectId=${p.id}`)}
                                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = p.health_color; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 28px ${p.health_color}18`; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${p.health_color}22`; (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
                                    >
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: p.health_color, borderRadius: '14px 14px 0 0' }} />
                                        <div style={{ padding: '14px 14px 10px' }}>
                                            {/* Header */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: `${p.health_color}14`, color: p.health_color, fontWeight: 700 }}>{p.health_label}</span>
                                                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)', color: t.muted, fontWeight: 700 }}>
                                                        {p.status}
                                                    </span>
                                                </div>
                                                {p.ai_score !== null && p.ai_score !== undefined && (
                                                    <span style={{ fontSize: 9, fontWeight: 800, color: p.ai_score >= 85 ? '#10b981' : '#f59e0b', padding: '2px 7px', borderRadius: 10, background: p.ai_score >= 85 ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)', flexShrink: 0 }}>
                                                        AI {p.ai_score}%
                                                    </span>
                                                )}
                                            </div>

                                            {/* Title */}
                                            <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                            <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 10, height: 30 }}>{p.description || 'No description.'}</div>

                                            {/* Progress */}
                                            <div style={{ marginBottom: 10 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <span style={{ fontSize: 9, color: t.muted, fontWeight: 600 }}>Completion</span>
                                                    <span style={{ fontSize: 11, fontWeight: 800, color: p.health_color }}>{p.progress}%</span>
                                                </div>
                                                <div style={{ width: '100%', height: 4, borderRadius: 4, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }}>
                                                    <div style={{ height: '100%', width: `${p.progress}%`, background: `linear-gradient(90deg,${p.health_color},${p.health_color}cc)`, borderRadius: 4, transition: 'width .5s' }} />
                                                </div>
                                            </div>

                                            {/* Task stats */}
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                                {[
                                                    { l: 'Tasks', v: p.task_count, c: t.muted },
                                                    { l: 'Open', v: p.open_tasks, c: '#6366f1' },
                                                    { l: 'Review', v: p.review_tasks, c: '#f59e0b' },
                                                ].map(s => (
                                                    <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '4px', borderRadius: 6, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)' }}>
                                                        <div style={{ fontSize: 13, fontWeight: 900, color: s.c }}>{s.v}</div>
                                                        <div style={{ fontSize: 8, color: t.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.l}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Footer */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex' }}>
                                                    {p.team_names.slice(0, 3).map((name, j) => (
                                                        <div key={j} style={{ marginLeft: j > 0 ? -5 : 0 }}>
                                                            <DAv name={name} size={20} />
                                                        </div>
                                                    ))}
                                                    {p.team_size > 3 && (
                                                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: t.muted, marginLeft: -5, fontWeight: 700 }}>
                                                            +{p.team_size - 3}
                                                        </div>
                                                    )}
                                                </div>
                                                {p.days_until !== null && p.days_until !== undefined && (
                                                    <span style={{ fontSize: 10, color: p.days_until < 0 ? '#ef4444' : p.days_until <= 3 ? '#f59e0b' : t.muted, fontWeight: 600 }}>
                                                        {p.days_until < 0 ? `${Math.abs(p.days_until)}d overdue` : p.days_until === 0 ? 'Due today' : `${p.days_until}d`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions footer */}
                                        <div style={{ display: 'flex', borderTop: BD }}>
                                            {[
                                                { l: 'Open', act: () => navigate(`/taskflow?projectId=${p.id}`) },
                                                { l: 'Reports', act: () => navigate('/reports') },
                                                { l: 'Analytics', act: () => navigate('/team') },
                                            ].map(a => (
                                                <button key={a.l} type="button" onClick={e => { e.stopPropagation(); a.act(); }}
                                                    style={{ flex: 1, padding: '8px 4px', background: 'none', border: 'none', borderRight: BD, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: t.muted, fontFamily: 'inherit', transition: 'color .15s,background .15s', borderRadius: 0 }}
                                                    onMouseEnter={e => { (e.currentTarget.style.color) = '#6366f1'; (e.currentTarget.style.background) = isDark ? 'rgba(99,102,241,.06)' : 'rgba(99,102,241,.04)'; }}
                                                    onMouseLeave={e => { (e.currentTarget.style.color) = t.muted; (e.currentTarget.style.background) = 'transparent'; }}>
                                                    {a.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        ROW: SECTION 8 (AI Quality) + SECTION 9 (Activity)
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, marginBottom: 14 }}>

                        {/* ── Section 8: AI Quality Insights ── */}
                        <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', borderBottom: BD, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>✨</div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>AI Quality Insights</div>
                                    <div style={{ fontSize: 10, color: t.muted }}>{loading ? '…' : `${aiIns?.total_reviews ?? 0} total reviews · ${aiIns?.pass_rate ?? 0}% pass rate`}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                                {/* Left: stats */}
                                <div style={{ padding: '14px 18px', borderRight: BD }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                        {[
                                            { l: 'Total Reviews', v: aiIns?.total_reviews ?? 0, c: '#6366f1' },
                                            { l: 'Pass Rate',     v: `${aiIns?.pass_rate ?? 0}%`, c: aiIns && aiIns.pass_rate >= 85 ? '#10b981' : '#f59e0b' },
                                            { l: 'Passed',        v: aiIns?.pass_count ?? 0, c: '#10b981' },
                                            { l: 'Failed',        v: aiIns?.fail_count ?? 0, c: '#ef4444' },
                                        ].map(s => (
                                            <div key={s.l} style={{ padding: '10px 12px', borderRadius: 10, background: `${s.c}0a`, border: `1px solid ${s.c}18` }}>
                                                <div style={{ fontSize: 9, color: t.muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '.06em' }}>{s.l}</div>
                                                <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{loading ? '—' : s.v}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Best / worst projects */}
                                    {!loading && (aiIns?.best_project || aiIns?.worst_project) && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {aiIns?.best_project && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.12)' }}>
                                                    <span style={{ fontSize: 16 }}>🏆</span>
                                                    <div>
                                                        <div style={{ fontSize: 9, color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Best Performing</div>
                                                        <div style={{ fontSize: 11, color: t.text, fontWeight: 700 }}>{aiIns.best_project.name}</div>
                                                    </div>
                                                    <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: '#10b981' }}>{aiIns.best_project.score}%</span>
                                                </div>
                                            )}
                                            {aiIns?.worst_project && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.12)' }}>
                                                    <span style={{ fontSize: 16 }}>⚠️</span>
                                                    <div>
                                                        <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Needs Improvement</div>
                                                        <div style={{ fontSize: 11, color: t.text, fontWeight: 700 }}>{aiIns.worst_project.name}</div>
                                                    </div>
                                                    <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: '#ef4444' }}>{aiIns.worst_project.score}%</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right: score distribution + common issues */}
                                <div style={{ padding: '14px 18px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 10 }}>Score Distribution</div>
                                    {loading ? <div style={{ color: t.muted, fontSize: 11 }}>Loading…</div>
                                        : (aiIns?.score_distribution ?? []).map(b => {
                                            const maxCnt = Math.max(...(aiIns?.score_distribution.map(s => s.count) ?? [1]), 1);
                                            const color = b.range.startsWith('0') || b.range.startsWith('6') ? '#ef4444' : b.range.startsWith('75') ? '#f59e0b' : '#10b981';
                                            return (
                                                <div key={b.range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                    <span style={{ fontSize: 10, color: t.muted, width: 48, flexShrink: 0 }}>{b.range}</span>
                                                    <div style={{ flex: 1, height: 6, borderRadius: 4, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }}>
                                                        <div style={{ height: '100%', width: `${(b.count / maxCnt) * 100}%`, background: color, borderRadius: 4, transition: 'width .5s' }} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 800, color, width: 20, textAlign: 'right', flexShrink: 0 }}>{b.count}</span>
                                                </div>
                                            );
                                        })}

                                    {!loading && (aiIns?.common_issues ?? []).length > 0 && (
                                        <div style={{ marginTop: 14 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 8 }}>Most Common Issues</div>
                                            {aiIns!.common_issues.slice(0, 4).map((issue, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                    <div style={{ width: 18, height: 18, borderRadius: 5, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#ef4444', flexShrink: 0 }}>{i + 1}</div>
                                                    <span style={{ fontSize: 11, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Section 9: Activity Center ── */}
                        <div style={{ ...S, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 16px', borderBottom: BD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Activity Center</div>
                                    <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Live workspace feed</div>
                                </div>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }} />
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', maxHeight: 420 }}>
                                {loading ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: t.muted, fontSize: 12 }}>Loading…</div>
                                ) : activity.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>No recent activity yet.</div>
                                ) : activity.map((log, i) => {
                                    const action = (log.action ?? '').replace(/_/g, ' ').toLowerCase();
                                    const icons: Record<string, string> = {
                                        task: '✅', project: '📁', comment: '💬', file: '📎', review: '✨', user: '👤',
                                    };
                                    const icon = icons[log.resource_type ?? ''] ?? '⚡';
                                    return (
                                        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 14px', borderBottom: BD }}>
                                            <DAv name={log.user_name || 'System'} size={26} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.4 }}>
                                                    <strong style={{ color: t.text }}>{log.user_name || 'System'}</strong>
                                                    {' '}{icon} {action}
                                                </div>
                                                <div style={{ fontSize: 9, color: t.muted, marginTop: 2 }}>{relTime(log.created_at)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════
                        SECTION 12 — QUICK ACTIONS BAR
                    ══════════════════════════════════════════════════════════ */}
                    <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Quick Actions</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {[
                                { l: '+ Create Project',  c: '#6366f1', fill: true,  p: '/projects',                  icon: Icon.project },
                                { l: '+ Create Task',     c: '#10b981', fill: true,  p: '/taskmaster',                icon: Icon.task    },
                                { l: 'Upload Report',     c: '#f59e0b', fill: false, p: '/reports',                   icon: Icon.report  },
                                { l: 'Run AI Review',     c: '#8b5cf6', fill: false, p: '/qc',                        icon: Icon.ai      },
                                { l: 'Team Analytics',    c: '#06b6d4', fill: false, p: '/team',                      icon: Icon.users   },
                                { l: 'All Projects',      c: '#6366f1', fill: false, p: '/projects',                  icon: Icon.project },
                            ].map(a => (
                                <button key={a.l} type="button" onClick={() => navigate(a.p)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        padding: '9px 16px', borderRadius: 10,
                                        border: `1px solid ${a.fill ? a.c : `${a.c}30`}`,
                                        background: a.fill ? a.c : `${a.c}0e`,
                                        color: a.fill ? '#fff' : a.c,
                                        fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                        transition: 'all .15s',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget.style.transform) = 'translateY(-1px)'; (e.currentTarget.style.boxShadow) = `0 6px 20px ${a.c}30`; }}
                                    onMouseLeave={e => { (e.currentTarget.style.transform) = ''; (e.currentTarget.style.boxShadow) = ''; }}
                                >
                                    {a.icon}
                                    {a.l}
                                </button>
                            ))}
                        </div>
                    </div>

                </main>
            </div>
        </div>
    );
};

export default SubAdminPortal;
