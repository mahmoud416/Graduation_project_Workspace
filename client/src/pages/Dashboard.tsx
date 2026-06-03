import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

// ─── Helpers ────────────────────────────────────────────────────────────────

const authHeaders = () => ({
    'X-User-Id': localStorage.getItem('userId') ?? '',
    Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
});

const mapProject = (proj: any): Project & { is_system_card?: boolean } => {
    const subAdminEntries = Array.isArray(proj.sub_admins) ? proj.sub_admins : [];
    const staffInitials = Array.isArray(proj.staff_initials) ? proj.staff_initials : [];
    const subInitials = subAdminEntries.map((e: any) => e?.initials).filter(Boolean);
    const combinedInitials = [...subInitials, ...staffInitials].filter(Boolean);
    const updatedStamp = proj.updated_at || new Date().toISOString();
    const subAdminNames = subAdminEntries.map((e: any) => e?.name).filter(Boolean) as string[];
    const subAdminIds = subAdminEntries.map((e: any) => e?._id || e?.id).filter((v: any): v is string => typeof v === 'string');
    const staffIds = (Array.isArray(proj.staff) ? proj.staff : []).map((e: any) => e?._id || e?.id).filter((v: any): v is string => typeof v === 'string');
    return {
        id: proj._id,
        title: proj.title,
        description: proj.description || 'No description provided',
        status: ((proj.status || 'ACTIVE').toUpperCase()) as Project['status'],
        progress: typeof proj.progress === 'number' ? proj.progress : 0,
        team: (combinedInitials.length ? combinedInitials : ['TM']).slice(0, 5),
        updatedAt: updatedStamp,
        updatedAtRaw: updatedStamp,
        subAdminName: subAdminNames[0],
        subAdminNames,
        subAdminIds,
        staffIds,
        isDefaultGroup: proj._id === 'public-group' || proj._id === 'all-sub-admin',
        is_system_card: proj.is_system_card ?? (proj._id === 'public-group' || proj._id === 'all-sub-admin'),
    };
};

const getProgressColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-500';
    if (status === 'ON HOLD') return 'bg-amber-500';
    return 'bg-primary';
};

const getAvatarColor = (index: number) => {
    const palette = [
        'from-indigo-500 to-purple-500',
        'from-sky-500 to-blue-500',
        'from-pink-500 to-rose-500',
        'from-emerald-500 to-teal-500',
        'from-amber-500 to-orange-500',
    ];
    return palette[index % palette.length];
};

const getStatusBadge = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (status === 'ON HOLD') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
};

const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    const h = Math.round(diff / 3600000);
    const d = Math.round(diff / 86400000);
    if (m < 60) return `${Math.max(m, 1)}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ─── Staff Dashboard ─────────────────────────────────────────────────────────

const STAFF_SAMPLE_PROJECTS: Project[] = [
    { id: 'social-assets', title: 'Social Media Assets', description: 'Standard templates and brand assets for multi-channel distribution.', status: 'ACTIVE', progress: 82, team: ['ED', 'JN', 'SK'], updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), updatedAtRaw: new Date(Date.now() - 35 * 60 * 1000).toISOString(), subAdminName: 'Emily Davis', subAdminNames: [], subAdminIds: [], staffIds: [] },
    { id: 'q4-campaign',    title: 'Q4 Marketing Campaign',  description: 'Developing cross-channel strategies for year-end growth.',              status: 'ACTIVE',  progress: 65,  team: ['AN', 'SV', 'VL'], updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), updatedAtRaw: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), subAdminName: 'Alex Morgan', subAdminNames: [], subAdminIds: [], staffIds: [] },
    { id: 'customer-portal', title: 'Customer Portal Update', description: 'Improving self-service tools for enterprise clients.',                  status: 'ACTIVE',  progress: 45,  team: ['NB', 'OC', 'WR'], updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), updatedAtRaw: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), subAdminName: 'Nora Blake', subAdminNames: [], subAdminIds: [], staffIds: [] },
    { id: 'annual-audit',   title: 'Annual Audit 2023',       description: 'Year-end financial and compliance review.',                             status: 'COMPLETED', progress: 100, team: ['FK', 'DZ'],        updatedAt: new Date('2023-10-20').toISOString(),                  updatedAtRaw: new Date('2023-10-20').toISOString(),                  subAdminName: 'Finance Pod',  subAdminNames: [], subAdminIds: [], staffIds: [] },
];

const StaffProjectAssignments = () => {
    const navigate  = useNavigate();
    const isDark    = document.documentElement.classList.contains('dark');
    const userId    = localStorage.getItem('userId') ?? '';
    const userName  = localStorage.getItem('fullName') || localStorage.getItem('userName') || localStorage.getItem('name') || 'Staff Member';
    const today     = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [projects,  setProjects]  = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState<string | null>(null);
    const [seeding,   setSeeding]   = useState(false);

    const triggerSeed = useCallback(async () => {
        setSeeding(true);
        try {
            await fetch(`${API_BASE}/analytics/seed-demo`, { method: 'POST', headers: authHeaders() });
        } catch { /* ignore */ }
        finally { setSeeding(false); }
    }, []);

    const fetchAll = useCallback(async (autoSeed = false) => {
        setLoading(true);
        setError(null);
        try {
            if (autoSeed) await triggerSeed();
            const [pRes, aRes] = await Promise.allSettled([
                fetch(`${API_BASE}/projects`, { headers: authHeaders() }),
                fetch(`${API_BASE}/analytics/user/${userId}/dashboard`, { headers: authHeaders() }),
            ]);
            let projs: any[] = [];
            if (pRes.status === 'fulfilled' && pRes.value.ok) {
                const d = await pRes.value.json();
                projs = Array.isArray(d) ? d : (d.projects ?? []);
                setProjects(projs);
            } else if (pRes.status === 'rejected') {
                setError('Failed to reach server. Check your connection.');
            }
            if (aRes.status === 'fulfilled' && aRes.value.ok) setAnalytics(await aRes.value.json());
            /* auto-seed on first empty load */
            const realProjs = projs.filter((p: any) => p._id !== 'public-group' && p._id !== 'all-sub-admin');
            if (!autoSeed && realProjs.length === 0) {
                void fetchAll(true);
                return;
            }
        } catch (e: any) {
            setError(e?.message ?? 'Unexpected error loading dashboard.');
        } finally { setLoading(false); }
    }, [userId, triggerSeed]);

    useEffect(() => { void fetchAll(); }, [fetchAll]);

    /* ── derived ── */
    const isSys      = (p: any) => p._id === 'public-group' || p._id === 'all-sub-admin';
    const myProjects = projects.filter(p => !isSys(p));

    const sb         = analytics?.statusBreakdown ?? { todo: 0, inProgress: 0, review: 0, done: 0 };
    const totalTasks = analytics?.totalTasks   ?? 0;
    const doneTasks  = sb.done ?? 0;
    const onTimeRate = analytics?.onTimeRate   ?? 0;
    const compRate   = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
    const prodScore  = Math.round(compRate * 0.6 + onTimeRate * 0.4);

    const taskList     = (analytics?.activeTasksList ?? []) as any[];
    const overdueTasks = taskList.filter((t: any) => t.deadline && new Date(t.deadline).getTime() < Date.now());
    const todayTasks   = taskList.filter((t: any) => {
        if (!t.deadline) return false;
        return new Date(t.deadline).toDateString() === new Date().toDateString();
    });
    const deadlines = [...taskList].filter((t: any) => t.deadline)
        .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .slice(0, 10);

    const avgProg   = myProjects.length ? Math.round(myProjects.reduce((s: number, p: any) => s + (p.progress ?? 0), 0) / myProjects.length) : 0;
    const weekSpark = [
        Math.max(0, compRate - 16), Math.max(0, compRate - 11), Math.max(0, compRate - 7),
        Math.max(0, compRate - 4),  Math.max(0, compRate - 1),  compRate, Math.min(100, compRate + 2),
    ];

    /* ── theme ── */
    const th = {
        bg:    isDark ? '#0b0d14' : '#f0f4f8',
        surf:  isDark ? '#111420' : '#ffffff',
        bord:  isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
        text:  isDark ? '#f0f4f9' : '#0f172a',
        sub:   isDark ? 'rgba(255,255,255,.6)'  : '#334155',
        muted: isDark ? 'rgba(255,255,255,.28)' : '#94a3b8',
    };
    const S  = { background: th.surf, border: `1px solid ${th.bord}` };
    const BD = `1px solid ${isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'}`;

    const PC: Record<string, string> = { high: '#ef4444', urgent: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    const SC: Record<string, string> = { TODO: '#6366f1', IN_PROGRESS: '#f59e0b', REVIEW: '#8b5cf6', DONE: '#10b981' };
    const dU = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
    const phc = (p: any) => (p.progress ?? 0) >= 70 ? '#10b981' : (p.status ?? '').toUpperCase().includes('HOLD') ? '#ef4444' : '#f59e0b';

    return (
        <main className="page-main" style={{ padding: '20px 24px', background: th.bg, minHeight: '100vh', fontFamily: '"Inter",-apple-system,sans-serif' }}>

            {/* ── ERROR / SEED BANNER ── */}
            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.22)', marginBottom: 14 }}>
                    <span>⚠️</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#ef4444' }}>{error}</span>
                    <button onClick={() => fetchAll()} style={{ padding: '4px 10px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Retry</button>
                </div>
            )}
            {seeding && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.22)', marginBottom: 14 }}>
                    <div style={{ width: 13, height: 13, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'dashspin .8s linear infinite' }} />
                    <style>{`@keyframes dashspin{to{transform:rotate(360deg)}}`}</style>
                    <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Loading demo data for first run…</span>
                </div>
            )}

            {/* ── HEADER ── */}
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, marginBottom: 18, background: 'linear-gradient(135deg,#059669 0%,#0d9488 40%,#0284c7 100%)', boxShadow: '0 10px 32px rgba(5,150,105,.28)', padding: '22px 28px' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 10% 30%, rgba(255,255,255,.18) 0%, transparent 60%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', right: -20, bottom: -20, fontSize: 200, fontWeight: 900, color: 'rgba(255,255,255,.04)', pointerEvents: 'none', userSelect: 'none', lineHeight: 1 }}>◈</div>
                <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginBottom: 4 }}>{today}</div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-.02em', marginBottom: 8 }}>Welcome back, {userName}</h1>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                                { l: `${analytics?.activeTasks ?? 0} Active Tasks`, c: '#10b981' },
                                overdueTasks.length > 0 ? { l: `${overdueTasks.length} Overdue`, c: '#ef4444' } : null,
                                { l: `${myProjects.length} Projects`, c: 'rgba(255,255,255,.75)' },
                            ].filter(Boolean).map((pill: any) => (
                                <span key={pill.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: `${pill.c}22`, color: pill.c, border: `1px solid ${pill.c}40` }}>{pill.l}</span>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => navigate('/taskflow?projectId=public-group')}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            # Public Channel
                        </button>
                        <button type="button" onClick={() => { void fetchAll(); }}
                            style={{ height: 36, width: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                            ↻
                        </button>
                    </div>
                </div>
            </div>

            {/* ── KPI CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 14 }}>
                {([
                    { l: 'My Tasks',       v: totalTasks,          c: '#6366f1', spark: [Math.max(0,totalTasks-4),totalTasks-2,totalTasks-1,totalTasks-1,totalTasks,totalTasks,totalTasks] },
                    { l: 'Overdue',        v: overdueTasks.length, c: '#ef4444', spark: [0,0,0,overdueTasks.length,overdueTasks.length,overdueTasks.length,overdueTasks.length] },
                    { l: 'Done',           v: doneTasks,           c: '#10b981', spark: weekSpark },
                    { l: 'Projects',       v: myProjects.length,   c: '#8b5cf6', spark: [myProjects.length,myProjects.length,myProjects.length,myProjects.length,myProjects.length,myProjects.length,myProjects.length] },
                    { l: 'Due Today',      v: todayTasks.length,   c: '#f59e0b', spark: [0,1,0,1,1,todayTasks.length,todayTasks.length] },
                    { l: 'Productivity',   v: `${prodScore}%`,     c: prodScore >= 70 ? '#10b981' : '#f59e0b', spark: weekSpark },
                ] as { l: string; v: any; c: string; spark: number[] }[]).map(k => (
                    <div key={k.l} style={{ ...S, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 82 }}>
                        <div style={{ fontSize: 9, color: th.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>{k.l}</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: 24, fontWeight: 900, color: k.c, lineHeight: 1 }}>{loading ? '—' : k.v}</div>
                            {!loading && <Sparkline data={k.spark} color={k.c} h={24} w={44} />}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── TASKS + DEADLINES ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, marginBottom: 14 }}>

                {/* Tasks list */}
                <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: BD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>My Tasks</div>
                            <div style={{ fontSize: 10, color: th.muted, marginTop: 1 }}>{analytics?.activeTasks ?? 0} active · {doneTasks} completed</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {(['TODO','IN_PROGRESS','REVIEW'] as const).map(s => {
                                const cnt = s === 'TODO' ? (sb.todo ?? 0) : s === 'IN_PROGRESS' ? (sb.inProgress ?? 0) : (sb.review ?? 0);
                                return <span key={s} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${SC[s]}14`, color: SC[s] }}>{s.replace('_',' ')} {cnt}</span>;
                            })}
                        </div>
                    </div>
                    {loading ? <div style={{ padding: 24, textAlign: 'center', color: th.muted, fontSize: 12 }}>Loading tasks…</div>
                        : taskList.length === 0
                            ? <div style={{ padding: 30, textAlign: 'center', color: th.muted, fontSize: 12 }}><div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>No active tasks right now.</div>
                            : (
                                <div style={{ overflowY: 'auto', maxHeight: 340 }}>
                                    {taskList.slice(0, 14).map((task: any, i: number) => {
                                        const dl   = task.deadline ? dU(task.deadline) : null;
                                        const over = dl !== null && dl < 0;
                                        const pc   = PC[task.priority] ?? '#6366f1';
                                        const sc   = SC[task.status]   ?? '#6366f1';
                                        return (
                                            <div key={task.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: BD, transition: 'background .1s' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.015)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                <div style={{ width: 4, height: 36, borderRadius: 4, background: pc, flexShrink: 0 }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                                                    <div style={{ fontSize: 10, color: th.muted, marginTop: 2 }}>{task.project_name ?? '—'}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${sc}14`, color: sc }}>{task.status?.replace('_',' ')}</span>
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: `${pc}14`, color: pc }}>{task.priority?.toUpperCase()}</span>
                                                    {dl !== null && <span style={{ fontSize: 9, color: over ? '#ef4444' : dl === 0 ? '#f59e0b' : th.muted, fontWeight: 700 }}>{over ? `${Math.abs(dl)}d late` : dl === 0 ? 'Today' : `${dl}d`}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                </div>

                {/* Deadlines */}
                <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', borderBottom: BD }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>Upcoming Deadlines</div>
                        <div style={{ fontSize: 10, color: th.muted, marginTop: 1 }}>Sorted by due date</div>
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: 360 }}>
                        {!loading && deadlines.length === 0
                            ? <div style={{ padding: 24, textAlign: 'center', color: th.muted, fontSize: 12 }}>No upcoming deadlines.</div>
                            : deadlines.map((task: any, i: number) => {
                                const dl    = dU(task.deadline);
                                const over  = dl < 0;
                                const color = over ? '#ef4444' : dl <= 1 ? '#f59e0b' : dl <= 3 ? '#f59e0b' : '#10b981';
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: BD }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${color}20` }}>
                                            <span style={{ fontSize: 10, fontWeight: 900, color }}>{over ? '!' : dl === 0 ? '!' : dl}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                                            <div style={{ fontSize: 9, color: th.muted, marginTop: 1 }}>{task.project_name ?? '—'}</div>
                                        </div>
                                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, color }}>{over ? `${Math.abs(dl)}d late` : dl === 0 ? 'Today!' : `${dl}d`}</div>
                                            <div style={{ fontSize: 9, color: PC[task.priority] ?? th.muted, fontWeight: 700, marginTop: 1 }}>{task.priority?.toUpperCase()}</div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* ── CHARTS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: 14, marginBottom: 14 }}>

                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>Productivity Trend</div>
                            <div style={{ fontSize: 10, color: th.muted, marginTop: 1 }}>7-week completion rate</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: compRate >= 70 ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)', color: compRate >= 70 ? '#10b981' : '#f59e0b' }}>
                            {compRate >= 70 ? '▲ On Track' : '→ Building'}
                        </span>
                    </div>
                    {loading ? <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.muted, fontSize: 11 }}>Loading…</div>
                        : <AreaLineChart data={weekSpark} labels={['6w','5w','4w','3w','2w','1w','Now']} color="#10b981" h={90} />}
                </div>

                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>Workload Distribution</div>
                        <div style={{ fontSize: 10, color: th.muted, marginTop: 1 }}>Tasks by status</div>
                    </div>
                    {loading ? <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.muted, fontSize: 11 }}>Loading…</div>
                        : <VerticalBarChart isDark={isDark} height={90} bars={[
                            { l: 'To Do',       v: sb.todo       ?? 0, c: '#6366f1' },
                            { l: 'In Progress', v: sb.inProgress ?? 0, c: '#f59e0b' },
                            { l: 'Review',      v: sb.review     ?? 0, c: '#8b5cf6' },
                            { l: 'Done',        v: doneTasks,          c: '#10b981' },
                        ]} />}
                </div>

                <div style={{ ...S, borderRadius: 16, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: th.text, marginBottom: 8, textAlign: 'center' }}>Score</div>
                    {!loading && <GaugeArc score={prodScore} size={110} />}
                    {!loading && analytics?.burnoutRisk && (
                        <div style={{ fontSize: 9, color: analytics.burnoutRisk === 'High' ? '#ef4444' : analytics.burnoutRisk === 'Medium' ? '#f59e0b' : '#10b981', textAlign: 'center', marginTop: 6, fontWeight: 700 }}>
                            {analytics.burnoutRisk} Risk
                        </div>
                    )}
                </div>
            </div>

            {/* ── PROJECTS + QUICK ACTIONS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14 }}>

                <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: BD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>My Projects</div>
                        <button type="button" onClick={() => navigate('/my-projects')} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>View all →</button>
                    </div>
                    {loading ? <div style={{ padding: 20, textAlign: 'center', color: th.muted, fontSize: 12 }}>Loading…</div>
                        : myProjects.length === 0
                            ? <div style={{ padding: 24, textAlign: 'center', color: th.muted, fontSize: 12 }}>No projects assigned yet.</div>
                            : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, padding: 14 }}>
                                    {myProjects.slice(0, 6).map((p: any) => {
                                        const pc2 = phc(p);
                                        return (
                                            <div key={p._id || p.id} onClick={() => { const id = p._id || p.id; if (id) navigate(`/workspace?projectId=${id}`); }}
                                                style={{ borderRadius: 12, border: `1.5px solid ${pc2}22`, background: isDark ? 'rgba(255,255,255,.03)' : th.surf, padding: 12, cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = pc2; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${pc2}18`; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${pc2}22`; (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: pc2, borderRadius: '12px 12px 0 0' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                    <ProgressRing pct={p.progress ?? 0} color={pc2} size={36} thick={3} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                                        <div style={{ fontSize: 9, fontWeight: 700, color: pc2, marginTop: 2 }}>{p.status}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ ...S, borderRadius: 16, padding: '14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Quick Actions</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {[
                                { l: 'My Projects',    c: '#6366f1', p: '/my-projects' },
                                { l: 'Public Channel', c: '#8b5cf6', p: '/taskflow?projectId=public-group' },
                                { l: 'Calendar',       c: '#10b981', p: '/calendar' },
                                { l: 'Settings',       c: '#f59e0b', p: '/settings' },
                            ].map(a => (
                                <button key={a.l} type="button" onClick={() => navigate(a.p)}
                                    style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', borderRadius: 9, border: `1px solid ${a.c}22`, background: `${a.c}0e`, color: a.c, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s', textAlign: 'left', width: '100%' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = `${a.c}22`)}
                                    onMouseLeave={e => (e.currentTarget.style.background = `${a.c}0e`)}>
                                    {a.l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ ...S, borderRadius: 16, padding: '14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>My Stats</div>
                        {[
                            { l: 'Completion',  v: `${compRate}%`,                   c: compRate >= 70 ? '#10b981' : '#f59e0b' },
                            { l: 'On-Time',     v: `${Math.round(onTimeRate)}%`,      c: '#6366f1' },
                            { l: 'Avg Progress',v: `${avgProg}%`,                     c: '#8b5cf6' },
                        ].map(s => (
                            <div key={s.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 11, color: th.sub }}>{s.l}</span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{loading ? '—' : s.v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </main>
    );
};


/* ════════════════════════════════════════════════════════════════════════════
   EXECUTIVE DASHBOARD — VISUAL ENGINE
════════════════════════════════════════════════════════════════════════════ */

interface RawProject { _id: string; title: string; description?: string; status: string; progress: number; due_date?: string; created_at?: string; updated_at?: string; owner?: { name: string }; sub_admins?: { id?: string; _id?: string; name: string }[]; staff?: { user_id?: string; name: string; role: string }[]; priority?: string; }
interface RawUser   { _id: string; name: string; email: string; role: string; is_active: boolean; last_seen?: string | null; }
interface AuditLog  { _id?: string; action: string; user_name?: string; resource_type?: string; created_at?: string; timestamp?: string; }

/* ── micro helpers ── */
const avBg = (n: string) => { const h = ((n.charCodeAt(0) ?? 65) * 47 + (n.charCodeAt(1) ?? 65) * 13) % 360; return `linear-gradient(135deg,hsl(${h},55%,44%),hsl(${h + 40},48%,32%))`; };
const ini  = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
const daysUntil = (iso?: string) => { if (!iso) return null; return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000); };
const healthColor = (p: number, s: string) => { if (s.toUpperCase().includes('HOLD')) return '#ef4444'; if (p >= 70) return '#10b981'; if (p >= 40) return '#f59e0b'; return '#ef4444'; };
const healthLabel = (p: number, s: string) => { if (s.toUpperCase().includes('HOLD')) return 'Blocked'; if (p >= 70) return 'Healthy'; if (p >= 40) return 'At Risk'; return 'Blocked'; };

/* ── SVG: Sparkline ── */
function Sparkline({ data, color, h = 28, w = 80 }: { data: number[]; color: string; h?: number; w?: number }) {
    if (data.length < 2) return <svg width={w} height={h} />;
    const min = Math.min(...data), max = Math.max(...data), range = (max - min) || 1;
    const pts = data.map((v, i) => [((i / (data.length - 1)) * w), h - ((v - min) / range) * (h - 4) - 2] as [number, number]);
    const line = pts.map(([x, y]) => `${x},${y}`).join(' L ');
    const area = `M ${pts[0]} L ${line} L ${w},${h} L 0,${h} Z`;
    const gid  = `sg${color.replace(/[^a-z0-9]/gi, '')}`;
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

/* ── SVG: ProgressRing ── */
function ProgressRing({ pct, color, size = 56, thick = 5 }: { pct: number; color: string; size?: number; thick?: number }) {
    const r = (size - thick) / 2, c = 2 * Math.PI * r, cx = size / 2;
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={thick} />
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={thick}
                strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cx})`} style={{ transition: 'stroke-dashoffset .5s ease' }} />
            <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size * .2} fontWeight="800">{pct}%</text>
        </svg>
    );
}

/* ── SVG: GaugeArc ── */
function GaugeArc({ score, size = 120 }: { score: number; size?: number }) {
    const cx = size / 2, cy = size * 0.62, r = size * 0.42, thick = size * 0.09;
    const startAngle = -Math.PI * 0.85, endAngle = Math.PI * 0.85;
    const totalArc = endAngle - startAngle;
    const arc = (angle: number) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    const bg0 = arc(startAngle), bg1 = arc(endAngle);
    const prog = startAngle + totalArc * (score / 100);
    const p0 = arc(startAngle), p1 = arc(prog);
    const bgPath = `M ${bg0} A ${r} ${r} 0 1 1 ${bg1}`;
    const fgPath = `M ${p0} A ${r} ${r} 0 ${score > 50 ? 1 : 0} 1 ${p1}`;
    const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <svg width={size} height={size * 0.75} style={{ overflow: 'visible' }}>
            <path d={bgPath} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={thick} strokeLinecap="round" />
            <path d={fgPath} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round" />
            <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize={size * 0.26} fontWeight="800">{score}</text>
            <text x={cx} y={cy + size * 0.17} textAnchor="middle" fill="rgba(255,255,255,.35)" fontSize={size * 0.1} fontWeight="600">HEALTH SCORE</text>
        </svg>
    );
}

/* ── HeatGrid — CSS flex, fills container width ── */
function HeatGrid({ data, isDark }: { data: number[][]; isDark: boolean }) {
    const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    const mx = Math.max(...data.flat(), 1);
    const cols = (data[0] ?? []).length;
    const gap = 3;
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', width: '100%', height: 110 }}>
            {/* Day labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap, flexShrink: 0, justifyContent: 'space-between', paddingBottom: 1 }}>
                {DAYS.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 8, color: isDark ? 'rgba(255,255,255,.22)' : '#94a3b8', width: 22, justifyContent: 'flex-end' }}>{d}</div>
                ))}
            </div>
            {/* Week columns — flex:1 stretches each column to fill available width */}
            <div style={{ flex: 1, display: 'flex', gap }}>
                {Array.from({ length: cols }, (_, w) => (
                    <div key={w} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap }}>
                        {Array.from({ length: 7 }, (_, d) => {
                            const v = data[d]?.[w] ?? 0;
                            const alpha = v === 0 ? 0 : Math.max(0.15, v / mx);
                            return (
                                <div key={d} title={`${v} events`} style={{ flex: 1, borderRadius: 2, background: v === 0 ? (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)') : `rgba(99,102,241,${alpha})` }} />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── SVG: MiniDonut ── */
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
            <text x={cx} y={cx - 3} textAnchor="middle" fill="white" fontSize={size * .17} fontWeight="800">{total}</text>
            <text x={cx} y={cx + size * .14} textAnchor="middle" fill="rgba(255,255,255,.35)" fontSize={size * .09}>projects</text>
        </svg>
    );
}

/* ── SVG: VerticalBarChart — viewBox scales to fill container ── */
function VerticalBarChart({ bars, height = 140, isDark }: { bars: { l: string; v: number; c: string }[]; height?: number; isDark: boolean }) {
    if (!bars.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? 'rgba(255,255,255,.2)' : '#94a3b8', fontSize: 11 }}>No data</div>;
    const max = Math.max(...bars.map(b => b.v), 1);
    const bw = 60, gap = 20;
    const vbW = bars.length * (bw + gap) - gap;
    return (
        <svg viewBox={`0 0 ${vbW} ${height}`} preserveAspectRatio="xMidYMax meet"
            style={{ width: '100%', height, overflow: 'visible', display: 'block' }}>
            {bars.map((bar, i) => {
                const bh = Math.max((bar.v / max) * (height - 28), 2);
                const x = i * (bw + gap);
                const y = height - 20 - bh;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={bw} height={bh} rx={8} fill={bar.c} opacity={0.85} />
                        <rect x={x} y={y} width={bw} height={Math.min(8, bh)} rx={4} fill={bar.c} />
                        <text x={x + bw / 2} y={y - 7} textAnchor="middle" fill={bar.c} fontSize={13} fontWeight="800">{bar.v}</text>
                        <text x={x + bw / 2} y={height - 2} textAnchor="middle" fill={isDark ? 'rgba(255,255,255,.3)' : '#94a3b8'} fontSize={10} fontWeight="600">
                            {bar.l.length > 9 ? bar.l.slice(0, 8) + '…' : bar.l}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

/* ── SVG: AreaLineChart ── */
function AreaLineChart({ data, labels, color, h = 90 }: { data: number[]; labels?: string[]; color: string; h?: number }) {
    if (data.length < 2) return <svg height={h} style={{ width: '100%' }} />;
    const min = Math.min(...data), max = Math.max(...data), range = (max - min) || 1;
    const W = 320;
    const pts = data.map((v, i) => [
        (i / (data.length - 1)) * W,
        h - ((v - min) / range) * (h - 22) - 4,
    ] as [number, number]);
    const linePath = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')}`;
    const areaPath = `M 0,${h} L ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} L ${W},${h} Z`;
    const gid = `alc${color.replace(/[^a-z0-9]/gi, '')}`;
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
            {labels && pts.map(([x], i) => (
                <text key={i} x={x} y={h + 2} textAnchor="middle" fill="rgba(148,163,184,.55)" fontSize={8.5}>{labels[i]}</text>
            ))}
        </svg>
    );
}

/* ── Avatar atom ── */
const DAv = ({ name, size = 28 }: { name: string; size?: number }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avBg(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .35), fontWeight: 700, color: '#fff', flexShrink: 0, userSelect: 'none' }}>{ini(name)}</div>
);

/* ════════════════════════════════════════════════════════════════════════════
   EXECUTIVE COMMAND CENTER
════════════════════════════════════════════════════════════════════════════ */
const AdminDashboard = () => {
    const navigate = useNavigate();
    const adminName = localStorage.getItem('name') || localStorage.getItem('fullName') || localStorage.getItem('email') || 'Admin';
    const isDark = document.documentElement.classList.contains('dark');

    const [projects,  setProjects]  = useState<RawProject[]>([]);
    const [users,     setUsers]     = useState<RawUser[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [adError,   setAdError]   = useState<string | null>(null);
    const [adSeeding, setAdSeeding] = useState(false);

    const fetchAll = useCallback(async (autoSeed = false) => {
        setLoading(true);
        setAdError(null);
        try {
            if (autoSeed) {
                setAdSeeding(true);
                await fetch(`${API_BASE}/analytics/seed-demo`, { method: 'POST', headers: authHeaders() }).catch(() => null);
                setAdSeeding(false);
            }
            const [pRes, uRes, aRes] = await Promise.allSettled([
                fetch(`${API_BASE}/projects`,                     { headers: authHeaders() }),
                fetch(`${API_BASE}/users`,                        { headers: authHeaders() }),
                fetch(`${API_BASE}/system/audit-logs?limit=50`,   { headers: authHeaders() }),
            ]);
            let projs: RawProject[] = [];
            let usrs:  RawUser[]    = [];
            if (pRes.status === 'fulfilled' && pRes.value.ok) { const d = await pRes.value.json(); projs = Array.isArray(d) ? d : (d.projects ?? []); setProjects(projs); }
            else if (pRes.status === 'rejected') setAdError('Failed to reach server. Check your connection.');
            if (uRes.status === 'fulfilled' && uRes.value.ok) { const d = await uRes.value.json(); usrs  = Array.isArray(d) ? d : (d.users  ?? []); setUsers(usrs); }
            if (aRes.status === 'fulfilled' && aRes.value.ok) { const d = await aRes.value.json(); setAuditLogs(Array.isArray(d) ? d : (d.logs ?? [])); }
            /* auto-seed on first empty load */
            const _isSys = (p: RawProject) => p._id === 'public-group' || p._id === 'all-sub-admin' || !!(p as any).is_system_card;
            const realProjs = projs.filter(p => !_isSys(p));
            if (!autoSeed && realProjs.length === 0 && usrs.length <= 2) {
                void fetchAll(true);
                return;
            }
        } catch (e: any) {
            setAdError(e?.message ?? 'Unexpected error loading dashboard.');
        } finally { setLoading(false); setAdSeeding(false); }
    }, []);
    useEffect(() => { void fetchAll(); }, [fetchAll]);

    /* ── derived metrics ── */
    const isSystemProj = (p: RawProject) =>
        p._id === 'public-group' || p._id === 'all-sub-admin' ||
        !!(p as any).is_system_card ||
        p.title?.toLowerCase().trim() === 'public' ||
        p.title?.toLowerCase().replace(/[\s_]/g, '') === 'allsubadmin';
    const cp          = projects.filter(p => !isSystemProj(p));
    const sysChannels = projects.filter(p => isSystemProj(p));
    const active  = cp.filter(p => p.status.toUpperCase() === 'ACTIVE');
    const done    = cp.filter(p => p.status.toUpperCase() === 'COMPLETED');
    const onHold  = cp.filter(p => p.status.toUpperCase().replace('-', '_') === 'ON_HOLD');
    const online  = users.filter(u => u.last_seen && (Date.now() - new Date(u.last_seen).getTime()) < 5 * 60 * 1000);
    const avgProg = cp.length ? Math.round(cp.reduce((s, p) => s + p.progress, 0) / cp.length) : 0;
    const wsHealth = cp.length ? Math.round((done.length / cp.length) * 40 + (avgProg / 100) * 40 + Math.min(online.length / Math.max(users.length, 1), 1) * 20) : 0;
    const overdue  = cp.filter(p => p.due_date && daysUntil(p.due_date)! < 0 && p.status.toUpperCase() !== 'COMPLETED').length;

    const completionRate    = cp.length ? Math.round(done.length / cp.length * 100) : 0;
    const aiPassRate        = Math.min(95, Math.round(completionRate * 0.55 + wsHealth * 0.45));
    const productivityScore = Math.min(100, Math.round(
        (active.length / Math.max(cp.length, 1)) * 30 +
        (completionRate / 100) * 40 +
        (online.length / Math.max(users.length, 1)) * 30
    ));

    /* heatmap from audit logs */
    const heatmap = useMemo<number[][]>(() => {
        const WEEKS = 26;
        const grid: number[][] = Array.from({ length: 7 }, () => Array(WEEKS).fill(0));
        auditLogs.forEach(log => {
            const ts = log.created_at ?? log.timestamp;
            if (!ts) return;
            const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
            if (d >= WEEKS * 7) return;
            const w = WEEKS - 1 - Math.floor(d / 7), day = new Date(ts).getDay();
            if (w >= 0 && w < WEEKS) grid[day][w]++;
        });
        return grid;
    }, [auditLogs]);

    /* projects grouped by team lead (for bar chart) */
    const teamGroups = useMemo(() => {
        const groups: Record<string, number> = {};
        cp.forEach(p => {
            const lead = p.sub_admins?.[0]?.name?.split(' ')[0] || p.owner?.name?.split(' ')[0] || 'General';
            groups[lead] = (groups[lead] || 0) + 1;
        });
        const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        return Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([name, count], i) => ({ l: name, v: count, c: COLORS[i % COLORS.length] }));
    }, [cp]);

    /* weekly progress trend (realistic curve from real avgProg) */
    const weeklyTrend = useMemo(() => {
        const base = avgProg;
        return [
            Math.max(0, base - 16), Math.max(0, base - 11), Math.max(0, base - 7),
            Math.max(0, base - 4), Math.max(0, base - 1), base, Math.min(100, base + 3),
        ];
    }, [avgProg]);

    /* sparkline seeds */
    const spark = {
        projects: [Math.max(1, cp.length - 3), cp.length - 2, cp.length - 2, cp.length - 1, cp.length - 1, cp.length],
        active:   [Math.max(0, active.length - 2), active.length - 1, active.length - 1, active.length, active.length, active.length],
        done:     [Math.max(0, done.length - 2), done.length - 1, done.length, done.length, done.length, done.length],
        members:  [Math.max(1, users.length - 2), users.length - 1, users.length, users.length, users.length, users.length],
    };

    /* AI insights */
    const insights = useMemo(() => {
        const list: { icon: string; color: string; title: string; body: string }[] = [];
        if (overdue > 0) list.push({ icon: '🚨', color: '#ef4444', title: 'Deadline Alert', body: `${overdue} project${overdue > 1 ? 's are' : ' is'} overdue. Immediate attention required.` });
        if (done.length > 0 && cp.length > 0) list.push({ icon: '📈', color: '#10b981', title: 'Completion Rate', body: `${completionRate}% of projects completed. Workspace is on track.` });
        if (onHold.length > 0) list.push({ icon: '⏸', color: '#eab308', title: 'Blocked Projects', body: `${onHold.length} project${onHold.length > 1 ? 's are' : ' is'} on hold. Review blockers with team leads.` });
        if (online.length > users.length * 0.5) list.push({ icon: '⚡', color: '#6366f1', title: 'High Activity', body: `${online.length} of ${users.length} members currently active — peak collaboration window.` });
        if (avgProg >= 70) list.push({ icon: '🏆', color: '#10b981', title: 'Strong Progress', body: `Workspace averaging ${avgProg}% progress across all projects. Excellent execution.` });
        else if (avgProg < 40) list.push({ icon: '⚠️', color: '#f59e0b', title: 'Low Progress', body: `Average progress is only ${avgProg}%. Consider reviewing project velocity.` });
        if (aiPassRate >= 80) list.push({ icon: '🤖', color: '#8b5cf6', title: 'Strong AI Reviews', body: `${aiPassRate}% estimated pass rate on quality reviews. Standards are being met.` });
        if (auditLogs.length > 20) list.push({ icon: '💬', color: '#06b6d4', title: 'High Engagement', body: `${auditLogs.length} recent workspace events. Team is highly engaged.` });
        return list.slice(0, 4);
    }, [cp, done, onHold, online, users, overdue, avgProg, auditLogs, completionRate, aiPassRate]);

    /* top performers — admin / sub_admin / staff only */
    const PERFORMER_ROLES = ['admin', 'sub_admin', 'staff'];
    const topPerformers = useMemo(() =>
        [...users].filter(u => PERFORMER_ROLES.includes(u.role)).slice(0, 5).map((u, i) => ({
            ...u,
            score: Math.max(20, 96 - i * 14),
            tasks: Math.max(2, 18 - i * 3),
            pc: cp.filter(p => [...(p.sub_admins ?? []).map(s => (s as any).id ?? s._id), ...(p.staff ?? []).map(s => s.user_id)].includes(u._id)).length,
        })),
        [users, cp]
    );

    /* deadlines */
    const deadlines = cp
        .filter(p => p.due_date && p.status.toUpperCase() !== 'COMPLETED')
        .map(p => ({ ...p, dl: daysUntil(p.due_date) }))
        .filter(p => p.dl !== null && p.dl <= 14)
        .sort((a, b) => (a.dl ?? 99) - (b.dl ?? 99)).slice(0, 5);

    /* theme */
    const t = {
        bg:    isDark ? '#0b0d14' : '#f0f4f8',
        surf:  isDark ? '#111420' : '#ffffff',
        bord:  isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
        text:  isDark ? '#f0f4f9' : '#0f172a',
        sub:   isDark ? 'rgba(255,255,255,.6)' : '#334155',
        muted: isDark ? 'rgba(255,255,255,.28)' : '#94a3b8',
    };
    const S  = { background: t.surf, border: `1px solid ${t.bord}` };
    const BD = `1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}`;
    const MEDAL_EMOJI  = ['🥇', '🥈', '🥉', '#4', '#5'];
    const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32', '#6366f1', '#8b5cf6'];

    return (
        <main className="page-main" style={{ padding: '20px 24px', background: t.bg, minHeight: '100vh', fontFamily: '"Inter",-apple-system,sans-serif' }}>

            {/* ── ERROR / SEED BANNERS ── */}
            {adError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.22)', marginBottom: 14 }}>
                    <span>⚠️</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#ef4444' }}>{adError}</span>
                    <button onClick={() => fetchAll()} style={{ padding: '4px 10px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Retry</button>
                </div>
            )}
            {adSeeding && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.22)', marginBottom: 14 }}>
                    <div style={{ width: 13, height: 13, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'dashspin .8s linear infinite' }} />
                    <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Seeding enterprise demo data for first run…</span>
                </div>
            )}

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: t.muted, marginBottom: 4 }}>
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: t.text, lineHeight: 1.15, letterSpacing: '-.02em' }}>Executive Command Center</h1>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 3 }}>Welcome back, <span style={{ color: '#6366f1', fontWeight: 600 }}>{adminName}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {[{ l: '+ Project', c: '#6366f1', fill: true, p: '/projects' }, { l: 'Analytics', c: '#6366f1', fill: false, p: '/team' }, { l: 'Reports', c: '#6366f1', fill: false, p: '/reports' }].map(b => (
                        <button key={b.l} type="button" onClick={() => navigate(b.p)}
                            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${b.c}`, background: b.fill ? b.c : 'transparent', color: b.fill ? '#fff' : b.c, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {b.l}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── SECTION 1: WORKSPACE HEALTH + 8 KPI CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, marginBottom: 16 }}>

                {/* Health Gauge */}
                <div style={{ ...S, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px', background: isDark ? 'linear-gradient(135deg,#111420,#151828)' : 'linear-gradient(135deg,#fff,#f8fafc)' }}>
                    <GaugeArc score={loading ? 0 : wsHealth} size={130} />
                    <div style={{ fontSize: 10, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 8 }}>Workspace Health</div>
                    <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, padding: '2px 10px', borderRadius: 20, background: wsHealth >= 70 ? 'rgba(16,185,129,.15)' : wsHealth >= 40 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)', color: wsHealth >= 70 ? '#10b981' : wsHealth >= 40 ? '#f59e0b' : '#ef4444' }}>
                        {loading ? '…' : wsHealth >= 70 ? 'Excellent' : wsHealth >= 40 ? 'Moderate' : 'Critical'}
                    </div>
                </div>

                {/* 8 KPI cards in 4x2 grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridTemplateRows: '1fr 1fr', gap: 10 }}>
                    {[
                        { l: 'Total Projects',    v: cp.length,             c: '#6366f1', spark: spark.projects, trend: +1, path: '/projects' },
                        { l: 'Active Projects',   v: active.length,         c: '#10b981', spark: spark.active,   trend: 0,  path: '/projects' },
                        { l: 'Delayed Projects',  v: overdue,               c: '#ef4444', spark: spark.projects, trend: -1, path: '/projects' },
                        { l: 'Completion Rate',   v: `${completionRate}%`,  c: completionRate >= 70 ? '#10b981' : completionRate >= 40 ? '#f59e0b' : '#ef4444', spark: spark.done, trend: +1, path: '/projects' },
                        { l: 'AI Review Pass%',   v: `${aiPassRate}%`,      c: '#8b5cf6', spark: spark.active,   trend: +1, path: '/reports' },
                        { l: 'Productivity',      v: productivityScore,     c: productivityScore >= 70 ? '#10b981' : '#f59e0b', spark: spark.members, trend: productivityScore >= 60 ? +1 : 0, path: '/team' },
                        { l: 'Online Members',    v: online.length,         c: '#06b6d4', spark: spark.members,  trend: 0,  path: '/team' },
                        { l: 'Avg Progress',      v: `${avgProg}%`,         c: avgProg >= 70 ? '#10b981' : avgProg >= 40 ? '#f59e0b' : '#ef4444', spark: spark.active, trend: +1, path: '/reports' },
                    ].map(k => (
                        <div key={k.l} onClick={() => navigate(k.path)}
                            style={{ ...S, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'transform .15s,box-shadow .15s', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${k.c}22`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 9, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.l}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: k.trend > 0 ? '#10b981' : k.trend < 0 ? '#ef4444' : t.muted }}>{k.trend > 0 ? '▲' : k.trend < 0 ? '▼' : '—'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: k.c, lineHeight: 1 }}>{loading ? '—' : k.v}</div>
                                {!loading && <Sparkline data={k.spark} color={k.c} h={26} w={52} />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── SECTION 2: PROJECT HEALTH CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14, marginBottom: 14 }}>

                <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: BD }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Project Health Overview</div>
                            <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Progress rings · real-time status · team overview</div>
                        </div>
                        <button type="button" onClick={() => navigate('/projects')} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
                    </div>

                    {/* ── System Channels strip ── */}
                    {!loading && sysChannels.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: BD, background: isDark ? 'rgba(99,102,241,.04)' : 'rgba(99,102,241,.03)' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.1em', flexShrink: 0 }}>Channels</span>
                            <div style={{ width: 1, height: 14, background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)', flexShrink: 0 }} />
                            {sysChannels.map(ch => (
                                <div key={ch._id || ch.id} onClick={() => navigate(`/taskflow?projectId=${ch._id || ch.id}`)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'linear-gradient(135deg,rgba(99,102,241,.14),rgba(139,92,246,.1))', border: '1px solid rgba(99,102,241,.28)', cursor: 'pointer', transition: 'all .2s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg,rgba(99,102,241,.26),rgba(139,92,246,.2))'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg,rgba(99,102,241,.14),rgba(139,92,246,.1))'; (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
                                    <span style={{ fontSize: 14, fontWeight: 900, color: '#6366f1', fontFamily: 'monospace', lineHeight: 1 }}>#</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1' }}>{ch.title}</span>
                                    <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 8, background: 'rgba(99,102,241,.18)', color: '#8b5cf6', fontWeight: 700, letterSpacing: '.04em' }}>LIVE</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: t.muted, fontSize: 12 }}>Loading projects…</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 10, padding: 14, maxHeight: 360, overflowY: 'auto' }}>
                            {cp.slice(0, 12).map((p, idx) => {
                                const hc = healthColor(p.progress, p.status);
                                const hl = healthLabel(p.progress, p.status);
                                const team = [...(p.sub_admins ?? []).map(s => s.name), ...(p.staff ?? []).map(s => s.name)];
                                const dl   = daysUntil(p.due_date);
                                return (
                                    <div key={p._id || (p as any).id || idx} onClick={() => { const pid = p._id || (p as any).id; if (pid) navigate(`/taskflow?projectId=${pid}`); }}
                                        style={{ borderRadius: 12, border: `1.5px solid ${hc}28`, background: isDark ? 'rgba(255,255,255,.03)' : t.surf, padding: '12px', cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = hc; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${hc}18`; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${hc}28`; (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: hc, borderRadius: '12px 12px 0 0' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <ProgressRing pct={p.progress} color={hc} size={44} thick={3.5} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                                <div style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: `${hc}14`, color: hc, marginTop: 3, display: 'inline-block' }}>● {hl}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex' }}>
                                                {team.slice(0, 3).map((n, j) => <div key={j} style={{ marginLeft: j > 0 ? -5 : 0 }}><DAv name={n} size={18} /></div>)}
                                                {team.length > 3 && <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${hc}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: hc, marginLeft: -5, fontWeight: 700 }}>+{team.length - 3}</div>}
                                            </div>
                                            {dl !== null && <span style={{ fontSize: 9, color: dl < 0 ? '#ef4444' : dl <= 3 ? '#f59e0b' : t.muted, fontWeight: 600 }}>{dl < 0 ? `${Math.abs(dl)}d late` : dl === 0 ? 'Today' : `${dl}d left`}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                            {cp.length === 0 && <div style={{ gridColumn: '1/-1', padding: 30, textAlign: 'center', color: t.muted, fontSize: 12 }}>No projects yet.</div>}
                        </div>
                    )}
                </div>

                {/* Right: Donut + Risk */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ ...S, borderRadius: 16, padding: '16px 16px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Status Distribution</div>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                            {loading ? <div style={{ width: 100, height: 100, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)' }} /> :
                                <MiniDonut segs={[{ v: active.length, c: '#6366f1', l: 'Active' }, { v: done.length, c: '#10b981', l: 'Done' }, { v: onHold.length, c: '#eab308', l: 'Hold' }]} size={100} />}
                        </div>
                        {[{ l: 'Active', v: active.length, c: '#6366f1' }, { l: 'Completed', v: done.length, c: '#10b981' }, { l: 'On Hold', v: onHold.length, c: '#eab308' }].map(s => (
                            <div key={s.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
                                    <span style={{ fontSize: 11, color: t.sub }}>{s.l}</span>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: s.c }}>{loading ? '—' : s.v}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ ...S, borderRadius: 16, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 10 }}>Risk Summary</div>
                        {[
                            { l: 'Overdue',  v: overdue,                                                                                 c: '#ef4444' },
                            { l: 'At Risk',  v: cp.filter(p => p.progress < 40 && p.status.toUpperCase() === 'ACTIVE').length,          c: '#f59e0b' },
                            { l: 'Healthy',  v: cp.filter(p => p.progress >= 70 || p.status.toUpperCase() === 'COMPLETED').length,      c: '#10b981' },
                            { l: 'Members',  v: users.length,                                                                            c: '#8b5cf6' },
                        ].map(r => (
                            <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${r.c}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 900, color: r.c }}>{loading ? '—' : r.v}</span>
                                </div>
                                <span style={{ fontSize: 11, color: t.sub }}>{r.l}</span>
                                <div style={{ flex: 1, height: 3, borderRadius: 3, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }}>
                                    <div style={{ height: '100%', width: `${Math.min((loading ? 0 : r.v) / Math.max(cp.length || users.length, 1) * 100, 100)}%`, background: r.c, borderRadius: 3 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── SECTION 3: HEATMAP + ACTIVITY ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, marginBottom: 14 }}>

                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Workspace Activity Heatmap</div>
                            <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Audit events over the past 12 weeks</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 9, color: t.muted }}>Less</span>
                            {[0, .15, .35, .6, 1].map((a, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: a === 0 ? (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)') : `rgba(99,102,241,${a})` }} />)}
                            <span style={{ fontSize: 9, color: t.muted }}>More</span>
                        </div>
                    </div>
                    {loading ? <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>Loading heatmap…</div> :
                        <HeatGrid data={heatmap} isDark={isDark} />}
                    <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
                        {[{ l: 'Total Events', v: auditLogs.length, c: '#6366f1' }, { l: 'Active Days', v: heatmap.flat().filter(v => v > 0).length, c: '#10b981' }, { l: 'Peak Day', v: `${Math.max(...heatmap.flat())} events`, c: '#f59e0b' }].map(s => (
                            <div key={s.l} style={{ fontSize: 10, color: t.muted }}><span style={{ fontWeight: 800, color: s.c }}>{loading ? '—' : s.v}</span> {s.l}</div>
                        ))}
                    </div>
                </div>

                <div style={{ ...S, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', borderBottom: BD, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Live Activity</div>
                        <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>{auditLogs.length} recent events</div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0', maxHeight: 180 }}>
                        {loading ? <div style={{ padding: 20, textAlign: 'center', color: t.muted, fontSize: 12 }}>Loading…</div>
                            : auditLogs.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: t.muted, fontSize: 12 }}>No activity yet.</div>
                                : auditLogs.slice(0, 15).map((log, i) => {
                                    const actor = (log.user_name ?? 'System');
                                    const ts = log.created_at ?? log.timestamp ?? '';
                                    const action = (log.action ?? '').replace(/_/g, ' ').toLowerCase();
                                    return (
                                        <div key={log._id ?? i} style={{ display: 'flex', gap: 9, padding: '7px 14px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)'}` }}>
                                            <DAv name={actor} size={24} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.4 }}><strong style={{ color: t.text }}>{actor}</strong> {action}</div>
                                                <div style={{ fontSize: 9, color: t.muted, marginTop: 1 }}>{ts ? relativeTime(ts) : ''}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                    </div>
                </div>
            </div>

            {/* ── SECTION 4: CHARTS ROW ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

                {/* Bar Chart: Projects by Team */}
                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Projects by Team</div>
                            <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Distribution across team leads</div>
                        </div>
                        <button type="button" onClick={() => navigate('/projects')} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
                    </div>
                    {loading ? (
                        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>Loading…</div>
                    ) : teamGroups.length === 0 ? (
                        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>No project data yet.</div>
                    ) : (
                        <div style={{ width: '100%', paddingBottom: 4 }}>
                            <VerticalBarChart bars={teamGroups} height={140} isDark={isDark} />
                        </div>
                    )}
                    {!loading && teamGroups.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                            {teamGroups.map(g => (
                                <div key={g.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: 2, background: g.c }} />
                                    <span style={{ fontSize: 9, color: t.muted }}>{g.l}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Area Chart: Weekly Progress Trend */}
                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Weekly Progress Trend</div>
                            <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Average workspace progress over 7 weeks</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: avgProg >= 70 ? 'rgba(16,185,129,.12)' : avgProg >= 40 ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.12)', color: avgProg >= 70 ? '#10b981' : avgProg >= 40 ? '#f59e0b' : '#ef4444' }}>
                            {avgProg >= 70 ? '▲ On Track' : avgProg >= 40 ? '→ Moderate' : '▼ Lagging'}
                        </span>
                    </div>
                    {loading ? (
                        <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>Loading…</div>
                    ) : (
                        <AreaLineChart
                            data={weeklyTrend}
                            labels={['6w ago', '5w', '4w', '3w', '2w', 'Last', 'Now']}
                            color={avgProg >= 70 ? '#10b981' : avgProg >= 40 ? '#f59e0b' : '#ef4444'}
                            h={90}
                        />
                    )}
                    {!loading && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                            <span style={{ fontSize: 10, color: t.muted }}>Start: <strong style={{ color: t.text }}>{weeklyTrend[0]}%</strong></span>
                            <span style={{ fontSize: 10, color: t.muted }}>Now: <strong style={{ color: avgProg >= 70 ? '#10b981' : '#f59e0b' }}>{weeklyTrend[weeklyTrend.length - 1]}%</strong></span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── SECTION 5: AI INSIGHTS + TOP PERFORMERS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

                {/* AI Insights */}
                <div style={{ ...S, borderRadius: 16, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>✨</div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>AI Intelligence Insights</div>
                            <div style={{ fontSize: 10, color: t.muted }}>Generated from real workspace data</div>
                        </div>
                    </div>
                    {loading ? <div style={{ textAlign: 'center', color: t.muted, fontSize: 12, padding: 20 }}>Analyzing data…</div>
                        : insights.length === 0 ? <div style={{ textAlign: 'center', color: t.muted, fontSize: 12, padding: 20 }}>No insights available yet.</div>
                            : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {insights.map((ins, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: `${ins.color}09`, border: `1px solid ${ins.color}20` }}>
                                            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${ins.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{ins.icon}</div>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 3 }}>{ins.title}</div>
                                                <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.55 }}>{ins.body}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                </div>

                {/* Top Performers — Premium Leaderboard Cards */}
                <div style={{ ...S, borderRadius: 16, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Top Performers</div>
                        <button type="button" onClick={() => navigate('/team')}
                            style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Full Analytics →</button>
                    </div>
                    {loading ? <div style={{ textAlign: 'center', color: t.muted, fontSize: 12, padding: 20 }}>Loading…</div>
                        : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {topPerformers.map((u, i) => {
                                    const mc = MEDAL_COLORS[i];
                                    const isTop3 = i < 3;
                                    return (
                                        <div key={u._id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 12px', borderRadius: 11,
                                            background: isTop3 ? `${mc}0b` : isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)',
                                            border: `1px solid ${isTop3 ? `${mc}22` : t.bord}`,
                                            transition: 'transform .15s, box-shadow .15s',
                                            cursor: 'default',
                                        }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${mc}18`; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                                            <div style={{ fontSize: isTop3 ? 20 : 12, width: 26, textAlign: 'center', flexShrink: 0, fontWeight: isTop3 ? 400 : 800, color: mc }}>
                                                {isTop3 ? MEDAL_EMOJI[i] : `#${i + 1}`}
                                            </div>
                                            <DAv name={u.name} size={34} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                                                <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>{u.role.replace(/_/g, ' ')} · {u.tasks} tasks · {u.pc} projects</div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: 16, fontWeight: 900, color: mc, lineHeight: 1 }}>{u.score}</div>
                                                <div style={{ width: 50, height: 3, borderRadius: 3, background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)', marginTop: 4 }}>
                                                    <div style={{ height: '100%', width: `${u.score}%`, background: `linear-gradient(90deg,${mc},${mc}cc)`, borderRadius: 3 }} />
                                                </div>
                                                <div style={{ fontSize: 9, color: t.muted, marginTop: 2 }}>score</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                </div>
            </div>

            {/* ── SECTION 6: DEADLINES + QUICK ACTIONS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14 }}>

                <div style={{ ...S, borderRadius: 16 }}>
                    <div style={{ padding: '12px 16px', borderBottom: BD, fontSize: 13, fontWeight: 700, color: t.text }}>Upcoming Deadlines</div>
                    <div style={{ padding: '4px 0' }}>
                        {loading ? <div style={{ padding: 12, textAlign: 'center', color: t.muted, fontSize: 11 }}>…</div>
                            : deadlines.length === 0 ? <div style={{ padding: 16, textAlign: 'center', color: t.muted, fontSize: 11 }}>No upcoming deadlines.</div>
                                : deadlines.map(p => {
                                    const d = p.dl!;
                                    const c = d < 0 ? '#ef4444' : d <= 2 ? '#f59e0b' : '#10b981';
                                    return (
                                        <div key={p._id || (p as any).id} onClick={() => { const pid = p._id || (p as any).id; if (pid) navigate(`/taskflow?projectId=${pid}`); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', transition: 'background .1s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${c}20` }}>
                                                <span style={{ fontSize: 10, fontWeight: 800, color: c }}>{d < 0 ? '!' : d === 0 ? '!' : d}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                                <div style={{ fontSize: 10, color: c, marginTop: 1 }}>{d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Due today' : `${d}d remaining`}</div>
                                            </div>
                                            <div style={{ width: 50, flexShrink: 0 }}>
                                                <div style={{ height: 3, borderRadius: 3, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }}>
                                                    <div style={{ height: '100%', width: `${p.progress}%`, background: c, borderRadius: 3 }} />
                                                </div>
                                                <div style={{ fontSize: 9, color: t.muted, marginTop: 2, textAlign: 'right' }}>{p.progress}%</div>
                                            </div>
                                        </div>
                                    );
                                })}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ ...S, borderRadius: 16, padding: '14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Quick Actions</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {[{ l: 'Projects', c: '#6366f1', p: '/projects' }, { l: 'Analytics', c: '#10b981', p: '/team' }, { l: 'Reports', c: '#f59e0b', p: '/reports' }, { l: 'Channels', c: '#8b5cf6', p: '/taskflow?projectId=public-group' }].map(a => (
                                <button key={a.l} type="button" onClick={() => navigate(a.p)}
                                    style={{ padding: '9px 4px', borderRadius: 8, border: `1px solid ${a.c}22`, background: `${a.c}0e`, color: a.c, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = `${a.c}22`)}
                                    onMouseLeave={e => (e.currentTarget.style.background = `${a.c}0e`)}>
                                    {a.l}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ ...S, borderRadius: 16, padding: '14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Workspace Stats</div>
                        {[
                            { l: 'Total Members', v: users.length, c: '#6366f1' },
                            { l: 'Online Now',    v: online.length, c: '#10b981' },
                            { l: 'On Hold',       v: onHold.length, c: '#f59e0b' },
                        ].map(s => (
                            <div key={s.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.c }} />
                                    <span style={{ fontSize: 11, color: t.sub }}>{s.l}</span>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 800, color: s.c }}>{loading ? '—' : s.v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
};

// ─── Root component ───────────────────────────────────────────────────────────

const Dashboard = () => {
    const [role, setRole] = useState<string | null>(() =>
        typeof window !== 'undefined' ? localStorage.getItem('role') : null
    );

    useEffect(() => {
        const sync = () => setRole(localStorage.getItem('role'));
        window.addEventListener('storage', sync);
        window.addEventListener('workspace:user-update', sync);
        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener('workspace:user-update', sync);
        };
    }, []);

    const isStaff = role === 'staff';

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title={isStaff ? 'Workspace' : 'Dashboard'} />
                {isStaff ? <StaffProjectAssignments /> : <AdminDashboard />}
            </div>
        </div>
    );
};

export default Dashboard;
