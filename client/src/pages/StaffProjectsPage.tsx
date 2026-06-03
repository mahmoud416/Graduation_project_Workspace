import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const authHeaders = () => ({
    'X-User-Id': localStorage.getItem('userId') ?? '',
    Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
});

/* ── helpers ── */
const relTime = (iso?: string | null) => {
    if (!iso) return '—';
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const daysUntil = (iso?: string | null): number | null => {
    if (!iso) return null;
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

const avBg = (n: string) => {
    const h = ((n.charCodeAt(0) ?? 65) * 47 + (n.charCodeAt(1) ?? 65) * 13) % 360;
    return `linear-gradient(135deg,hsl(${h},55%,44%),hsl(${h + 40},48%,32%))`;
};
const ini = (n: string) =>
    n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

type Filter = 'ALL' | 'ACTIVE' | 'ON HOLD' | 'COMPLETED';

/* ── Project health ── */
const projectHealth = (p: any): { label: string; color: string; risk: string } => {
    const s  = (p.status ?? 'ACTIVE').toUpperCase();
    const pg = p.progress ?? 0;
    const d  = daysUntil(p.due_date);
    if (s === 'COMPLETED')     return { label: 'Completed',       color: '#10b981', risk: 'low'      };
    if (s.includes('HOLD'))   return { label: 'Blocked',         color: '#ef4444', risk: 'critical'  };
    if (d !== null && d < 0)  return { label: 'Overdue',         color: '#ef4444', risk: 'critical'  };
    if (d !== null && d <= 3 && pg < 60) return { label: 'Attention Needed', color: '#f59e0b', risk: 'high' };
    if (pg >= 70)             return { label: 'Healthy',         color: '#10b981', risk: 'low'      };
    if (pg >= 40)             return { label: 'Attention Needed',color: '#f59e0b', risk: 'medium'   };
    return                           { label: 'At Risk',         color: '#ef4444', risk: 'high'     };
};

/* ════════════════════════════════════════════════════════════════════════════
   STAFF PROJECTS PAGE
════════════════════════════════════════════════════════════════════════════ */
const StaffProjectsPage = () => {
    const navigate = useNavigate();
    const isDark   = document.documentElement.classList.contains('dark');

    const userName = localStorage.getItem('fullName') || localStorage.getItem('userName') || localStorage.getItem('name') || 'Team Member';

    const [projects, setProjects] = useState<any[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [filter,   setFilter]   = useState<Filter>('ALL');
    const [search,   setSearch]   = useState('');

    /* ── fetch ── */
    const fetchProjects = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/projects`, { headers: authHeaders() });
            if (!res.ok) throw new Error();
            const d = await res.json();
            setProjects(Array.isArray(d) ? d : (d.projects ?? []));
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void fetchProjects(); }, [fetchProjects]);

    /* ── derived ── */
    const isSys   = (p: any) => p._id === 'public-group' || p._id === 'all-sub-admin';
    const publicCh = projects.find(p => p._id === 'public-group');
    const real     = projects.filter(p => !isSys(p));

    const filtered = useMemo(() => {
        let list = real;
        if (filter !== 'ALL') list = list.filter(p => (p.status ?? 'ACTIVE').toUpperCase() === filter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p => (p.title ?? '').toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
        }
        return list;
    }, [real, filter, search]);

    const activeCount = real.filter(p => (p.status ?? '').toUpperCase() === 'ACTIVE').length;
    const doneCount   = real.filter(p => (p.status ?? '').toUpperCase() === 'COMPLETED').length;
    const overdueCount= real.filter(p => { const d = daysUntil(p.due_date); return d !== null && d < 0 && (p.status ?? '').toUpperCase() !== 'COMPLETED'; }).length;
    const avgProgress = real.length ? Math.round(real.reduce((s, p) => s + (p.progress ?? 0), 0) / real.length) : 0;

    /* ── theme ── */
    const t = {
        bg:    isDark ? '#0b0d14' : '#f0f4f8',
        surf:  isDark ? '#111420' : '#ffffff',
        bord:  isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
        text:  isDark ? '#f0f4f9' : '#0f172a',
        sub:   isDark ? 'rgba(255,255,255,.6)'  : '#334155',
        muted: isDark ? 'rgba(255,255,255,.28)' : '#94a3b8',
    };
    const S  = { background: t.surf, border: `1px solid ${t.bord}` };
    const BD = `1px solid ${isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'}`;

    const FILTERS: Filter[] = ['ALL', 'ACTIVE', 'ON HOLD', 'COMPLETED'];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, fontFamily: '"Inter",-apple-system,sans-serif' }}>
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="My Projects" />

                <main className="page-main" style={{ padding: '20px 24px', minHeight: '100vh' }}>

                    {/* ── HEADER BANNER ── */}
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, marginBottom: 18, background: 'linear-gradient(135deg,#059669 0%,#0d9488 40%,#0284c7 100%)', boxShadow: '0 10px 32px rgba(5,150,105,.28)', padding: '22px 28px' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 10% 30%, rgba(255,255,255,.18) 0%, transparent 60%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', right: -20, bottom: -20, fontSize: 180, fontWeight: 900, color: 'rgba(255,255,255,.04)', pointerEvents: 'none', userSelect: 'none', lineHeight: 1 }}>◈</div>
                        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-.02em', marginBottom: 6 }}>
                                    Welcome back, {userName}
                                </h1>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 12 }}>
                                    You have <strong style={{ color: '#fff' }}>{real.length}</strong> project{real.length !== 1 ? 's' : ''} assigned to you.
                                </p>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {[
                                        { l: `${activeCount} Active`, c: '#10b981' },
                                        overdueCount > 0 ? { l: `${overdueCount} Overdue`, c: '#ef4444' } : null,
                                        { l: `${doneCount} Completed`, c: 'rgba(255,255,255,.75)' },
                                    ].filter(Boolean).map((pill: any) => (
                                        <span key={pill.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: `${pill.c}22`, color: pill.c, border: `1px solid ${pill.c}40` }}>{pill.l}</span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {publicCh && (
                                    <button type="button" onClick={() => navigate('/taskflow?projectId=public-group')}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        # Public Channel
                                    </button>
                                )}
                                <button type="button" onClick={() => { void fetchProjects(); }}
                                    style={{ height: 36, width: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                                    ↻
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── KPI STRIP ── */}
                    {!loading && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                            {[
                                { label: 'Total',        value: real.length,   color: '#6366f1' },
                                { label: 'Active',       value: activeCount,   color: '#10b981' },
                                { label: 'Completed',    value: doneCount,     color: '#8b5cf6' },
                                { label: 'Avg Progress', value: `${avgProgress}%`, color: avgProgress >= 70 ? '#10b981' : '#f59e0b' },
                            ].map(s => (
                                <div key={s.label} style={{ ...S, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 11, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em' }}>{s.label}</span>
                                    <span style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── SEARCH + FILTERS ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                        {/* Search */}
                        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search projects…"
                                style={{ width: '100%', height: 36, paddingLeft: 36, paddingRight: 12, borderRadius: 10, border: `1px solid ${t.bord}`, background: t.surf, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: t.muted }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                            </svg>
                        </div>

                        {/* Filter pills */}
                        <div style={{ display: 'flex', gap: 6 }}>
                            {FILTERS.map(f => (
                                <button key={f} type="button" onClick={() => setFilter(f)}
                                    style={{ height: 36, padding: '0 14px', borderRadius: 10, border: `1px solid ${filter === f ? '#6366f1' : t.bord}`, background: filter === f ? '#6366f1' : t.surf, color: filter === f ? '#fff' : t.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                                    {f === 'ALL' ? `All (${real.length})` : f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── PROJECT CARDS GRID ── */}
                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ height: 220, borderRadius: 16, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)', animation: 'pulse 1.5s infinite' }} />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ ...S, borderRadius: 16, padding: 48, textAlign: 'center' }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                                {filter === 'ALL' ? 'No projects assigned yet' : `No ${filter.toLowerCase()} projects`}
                            </div>
                            <div style={{ fontSize: 12, color: t.muted }}>
                                {filter === 'ALL' ? 'Your admin will assign you to projects soon.' : 'Try a different filter.'}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                            {filtered.map(p => {
                                const health   = projectHealth(p);
                                const dl       = daysUntil(p.due_date);
                                const subAdmins= Array.isArray(p.sub_admins) ? p.sub_admins : [];
                                const staff    = Array.isArray(p.staff)      ? p.staff      : [];
                                const allMembers = [...subAdmins, ...staff];
                                const updatedAt = p.updated_at ?? p.updatedAt;

                                const pid = p._id || p.id;
                                return (
                                    <div key={pid ?? p.title}
                                        style={{ borderRadius: 16, border: `1.5px solid ${health.color}20`, background: t.surf, overflow: 'hidden', transition: 'all .2s', cursor: pid ? 'pointer' : 'default', position: 'relative' }}
                                        onClick={() => pid && navigate(`/workspace?projectId=${pid}`)}
                                        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = health.color; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = `0 10px 30px ${health.color}18`; }}
                                        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = `${health.color}20`; el.style.transform = ''; el.style.boxShadow = ''; }}
                                    >
                                        {/* Color top bar */}
                                        <div style={{ height: 4, background: `linear-gradient(90deg,${health.color},${health.color}99)` }} />

                                        <div style={{ padding: '16px 18px' }}>
                                            {/* Header row */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 15, fontWeight: 800, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                                                        {p.title ?? 'Untitled'}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${health.color}14`, color: health.color, border: `1px solid ${health.color}20` }}>
                                                            {health.label}
                                                        </span>
                                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)', color: t.muted }}>
                                                            {(p.status ?? 'ACTIVE').toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <svg style={{ width: 14, height: 14, color: t.muted, flexShrink: 0, marginLeft: 8, marginTop: 2 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                                </svg>
                                            </div>

                                            {/* Description */}
                                            {p.description && (
                                                <p style={{ fontSize: 12, color: t.muted, lineHeight: 1.5, marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                    {p.description}
                                                </p>
                                            )}

                                            {/* Progress bar */}
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                    <span style={{ fontSize: 10, color: t.muted, fontWeight: 600 }}>Completion</span>
                                                    <span style={{ fontSize: 12, fontWeight: 800, color: health.color }}>{p.progress ?? 0}%</span>
                                                </div>
                                                <div style={{ width: '100%', height: 5, borderRadius: 5, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)' }}>
                                                    <div style={{ height: '100%', width: `${p.progress ?? 0}%`, background: `linear-gradient(90deg,${health.color},${health.color}cc)`, borderRadius: 5, transition: 'width .6s ease' }} />
                                                </div>
                                            </div>

                                            {/* Meta row */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                                                {/* Deadline */}
                                                <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 9, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}` }}>
                                                    <div style={{ fontSize: 13, fontWeight: 900, color: dl === null ? t.muted : dl < 0 ? '#ef4444' : dl <= 3 ? '#f59e0b' : '#10b981', lineHeight: 1 }}>
                                                        {dl === null ? '—' : dl < 0 ? `${Math.abs(dl)}d` : dl === 0 ? '!' : `${dl}d`}
                                                    </div>
                                                    <div style={{ fontSize: 9, color: t.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                                                        {dl === null ? 'No deadline' : dl < 0 ? 'Overdue' : dl === 0 ? 'Due today' : 'Remaining'}
                                                    </div>
                                                </div>

                                                {/* Members */}
                                                <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 9, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}` }}>
                                                    <div style={{ fontSize: 13, fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>{allMembers.length}</div>
                                                    <div style={{ fontSize: 9, color: t.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Members</div>
                                                </div>

                                                {/* Last update */}
                                                <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 9, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}` }}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, lineHeight: 1 }}>{relTime(updatedAt)}</div>
                                                    <div style={{ fontSize: 9, color: t.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Updated</div>
                                                </div>
                                            </div>

                                            {/* Owner + avatars */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                {/* Team avatars */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <div style={{ display: 'flex' }}>
                                                        {allMembers.slice(0, 4).map((m: any, j: number) => {
                                                            const name = m.name ?? m.full_name ?? '?';
                                                            return (
                                                                <div key={j} title={name}
                                                                    style={{ width: 24, height: 24, borderRadius: '50%', background: avBg(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', border: `2px solid ${t.surf}`, marginLeft: j > 0 ? -6 : 0, flexShrink: 0 }}>
                                                                    {ini(name)}
                                                                </div>
                                                            );
                                                        })}
                                                        {allMembers.length > 4 && (
                                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: t.muted, border: `2px solid ${t.surf}`, marginLeft: -6, fontWeight: 700 }}>
                                                                +{allMembers.length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {allMembers.length === 0 && (
                                                        <span style={{ fontSize: 11, color: t.muted }}>No members</span>
                                                    )}
                                                </div>

                                                {/* Owner badge */}
                                                {subAdmins[0]?.name && (
                                                    <span style={{ fontSize: 10, color: t.muted, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                                        ↳ {subAdmins[0].name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action footer */}
                                        <div style={{ display: 'flex', borderTop: BD }}>
                                            {[
                                                { l: 'Open Board', act: () => pid && navigate(`/workspace?projectId=${pid}`) },
                                                { l: 'My Tasks',   act: () => pid && navigate(`/workspace?projectId=${pid}`) },
                                                { l: 'Calendar',    act: () => navigate('/calendar') },
                                            ].map(a => (
                                                <button key={a.l} type="button"
                                                    onClick={e => { e.stopPropagation(); a.act(); }}
                                                    style={{ flex: 1, padding: '9px 4px', background: 'none', border: 'none', borderRight: BD, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: t.muted, fontFamily: 'inherit', transition: 'all .15s' }}
                                                    onMouseEnter={e => { (e.currentTarget.style.color) = '#6366f1'; (e.currentTarget.style.background) = isDark ? 'rgba(99,102,241,.06)' : 'rgba(99,102,241,.04)'; }}
                                                    onMouseLeave={e => { (e.currentTarget.style.color) = t.muted; (e.currentTarget.style.background) = 'transparent'; }}>
                                                    {a.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
};

export default StaffProjectsPage;
