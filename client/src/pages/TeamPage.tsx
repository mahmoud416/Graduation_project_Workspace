import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

/* ── types ─────────────────────────────────────────────────────────────────── */
interface Member { _id: string; name: string; email: string; role: string; is_active: boolean; last_seen?: string | null; created_at?: string | null; }
interface UserAnalytics { tasks_total: number; tasks_done: number; tasks_in_progress: number; tasks_in_review: number; avg_accuracy: number; }
interface RawProject { _id: string; title: string; progress: number; status: string; staff?: { user_id?: string; name: string }[]; sub_admins?: { id?: string; _id?: string; name: string }[]; }

/* ── helpers ───────────────────────────────────────────────────────────────── */
const ah = () => ({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`, 'X-User-Id': localStorage.getItem('userId') ?? '' });
const ini = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
const avbg = (n: string) => { const h = ((n.charCodeAt(0) ?? 65) * 47 + (n.charCodeAt(1) ?? 65) * 13) % 360; return `linear-gradient(135deg,hsl(${h},55%,44%),hsl(${h + 40},48%,32%))`; };
const rel = (iso?: string | null) => {
    if (!iso) return 'Never';
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 2) return 'Just now'; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); return `${d}d ago`;
};
const isOnline = (ls?: string | null) => !!ls && (Date.now() - new Date(ls).getTime()) < 5 * 60 * 1000;
const fmtRole = (r: string) => r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/* ── Productivity Score ─────────────────────────────────────────────────────── */
function calcScore(analytics: UserAnalytics | null, projectCount: number): number {
    if (!analytics) return Math.min(projectCount * 4, 30);
    const taskScore    = analytics.tasks_done * 5;
    const aiScore      = Math.round(analytics.avg_accuracy * 10);
    const progressBonus = analytics.tasks_in_progress * 2;
    const raw = taskScore + aiScore + progressBonus + projectCount * 2;
    return Math.min(Math.round(raw), 100);
}
function scoreLabel(s: number): { label: string; color: string } {
    if (s >= 76) return { label: 'Excellent', color: '#10b981' };
    if (s >= 51) return { label: 'Good',      color: '#6366f1' };
    if (s >= 26) return { label: 'Average',   color: '#f59e0b' };
    return             { label: 'Low',         color: '#ef4444' };
}

/* ── Avatar ─────────────────────────────────────────────────────────────────── */
const Av = ({ name, size = 32, online }: { name: string; size?: number; online?: boolean }) => (
    <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: size, height: size, borderRadius: '50%', background: avbg(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .35), fontWeight: 700, color: '#fff', userSelect: 'none' }}>{ini(name)}</div>
        {online !== undefined && <span style={{ position: 'absolute', bottom: 0, right: 0, width: Math.max(8, size * .24), height: Math.max(8, size * .24), borderRadius: '50%', background: online ? '#10b981' : '#475569', border: '2px solid white', outline: '1px solid rgba(0,0,0,.1)' }} />}
    </div>
);

/* ── SVG: SmallProgressRing ─────────────────────────────────────────────────── */
function ScoreRing({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
    const thick = size * 0.1, r = (size - thick) / 2, c = 2 * Math.PI * r, cx = size / 2;
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={`${color}22`} strokeWidth={thick} />
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={thick}
                strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cx})`} style={{ transition: 'stroke-dashoffset .6s ease' }} />
            <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size * .22} fontWeight="800">{pct}</text>
        </svg>
    );
}

/* ── SVG: RadarChart ────────────────────────────────────────────────────────── */
function RadarChart({ data, size = 220, isDark }: { data: { label: string; team: number; top: number }[]; size?: number; isDark: boolean }) {
    const N = data.length;
    const cx = size / 2, cy = size / 2;
    const r = size * 0.33;
    const angle = (i: number) => (i * 2 * Math.PI / N) - Math.PI / 2;
    const pt = (i: number, val: number): [number, number] => [
        cx + (val / 100) * r * Math.cos(angle(i)),
        cy + (val / 100) * r * Math.sin(angle(i)),
    ];
    const gridPts = (scale: number) => data.map((_, i) => pt(i, scale)).map(([x, y]) => `${x},${y}`).join(' ');
    const teamPts = data.map((d, i) => pt(i, d.team));
    const topPts  = data.map((d, i) => pt(i, d.top));

    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            {[25, 50, 75, 100].map(s => (
                <polygon key={s} points={gridPts(s)} fill="none"
                    stroke={isDark ? 'rgba(99,102,241,.12)' : 'rgba(99,102,241,.1)'}
                    strokeWidth={s === 100 ? 1.5 : 1} strokeDasharray={s < 100 ? '3 3' : undefined} />
            ))}
            {data.map((_, i) => {
                const [lx, ly] = pt(i, 100);
                return <line key={i} x1={cx} y1={cy} x2={lx} y2={ly} stroke={isDark ? 'rgba(99,102,241,.15)' : 'rgba(99,102,241,.12)'} strokeWidth={1} />;
            })}
            {/* Top performer polygon */}
            <polygon points={topPts.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="rgba(16,185,129,.1)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" strokeLinejoin="round" />
            {/* Team average polygon */}
            <polygon points={teamPts.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="rgba(99,102,241,.15)" stroke="#6366f1" strokeWidth={2.2} strokeLinejoin="round" />
            {/* Team dots */}
            {teamPts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3.5} fill="#6366f1" stroke={isDark ? '#111420' : '#fff'} strokeWidth={1.5} />
            ))}
            {/* Axis labels */}
            {data.map((d, i) => {
                const labelR = r * 1.22;
                const [lx, ly] = [cx + labelR * Math.cos(angle(i)), cy + labelR * Math.sin(angle(i))];
                return (
                    <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                        fill={isDark ? 'rgba(148,163,184,.7)' : '#64748b'} fontSize={9} fontWeight={600}>{d.label}</text>
                );
            })}
            {/* Center dot */}
            <circle cx={cx} cy={cy} r={3} fill={isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)'} />
        </svg>
    );
}

/* ── SVG: ProductivitySphere ────────────────────────────────────────────────── */
function ProductivitySphere({ members, avgTeamScore, size = 290, isDark }: {
    members: { name: string; score: number }[];
    avgTeamScore: number;
    size?: number;
    isDark: boolean;
}) {
    const cx = size / 2, cy = size / 2;
    const maxR = size * 0.38;
    const AVATAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

    const positioned = members.slice(0, 14).map((m, i) => {
        const dist = (1 - m.score / 100) * maxR * 0.88;
        const angle = (i / Math.min(members.length, 14)) * 2 * Math.PI;
        return { ...m, x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle), c: AVATAR_COLORS[i % AVATAR_COLORS.length] };
    });

    const ringLabels = [{ s: 0.92, l: '8+' }, { s: 0.67, l: '33+' }, { s: 0.42, l: '58+' }, { s: 0.17, l: '83+' }];

    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            {/* Ring backgrounds */}
            {[1, 0.75, 0.5, 0.25].map((s, i) => (
                <circle key={i} cx={cx} cy={cy} r={s * maxR}
                    fill={isDark ? `rgba(99,102,241,${0.02 + i * 0.015})` : `rgba(99,102,241,${0.015 + i * 0.01})`}
                    stroke={isDark ? 'rgba(99,102,241,.1)' : 'rgba(99,102,241,.08)'}
                    strokeWidth={1.5} strokeDasharray="5 8" />
            ))}
            {/* Ring labels */}
            {ringLabels.map(({ s, l }) => (
                <text key={l} x={cx + s * maxR + 4} y={cy} dominantBaseline="middle"
                    fill={isDark ? 'rgba(148,163,184,.25)' : 'rgba(100,116,139,.3)'} fontSize={8}>{l}</text>
            ))}
            {/* Center glow */}
            <circle cx={cx} cy={cy} r={38} fill={isDark ? 'rgba(99,102,241,.1)' : 'rgba(99,102,241,.06)'}
                stroke={isDark ? 'rgba(99,102,241,.35)' : 'rgba(99,102,241,.25)'} strokeWidth={2} />
            <text x={cx} y={cy - 7} textAnchor="middle" fill="#6366f1" fontSize={20} fontWeight={900}>{avgTeamScore}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(99,102,241,.55)" fontSize={7.5} fontWeight={700} letterSpacing="0.1em">TEAM SCORE</text>
            {/* Member dots */}
            {positioned.map((m, i) => {
                const abbr = ini(m.name);
                return (
                    <g key={i} style={{ cursor: 'pointer' }}>
                        <circle cx={m.x} cy={m.y} r={17} fill={m.c} opacity={0.88}
                            stroke={isDark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.7)'} strokeWidth={1.5} />
                        <text x={m.x} y={m.y + 1} textAnchor="middle" dominantBaseline="middle"
                            fill="white" fontSize={9} fontWeight={700}>{abbr}</text>
                    </g>
                );
            })}
        </svg>
    );
}

/* ── Horizontal bars for role comparison ────────────────────────────────────── */
function CompareBar({ label, val, max, color, isDark }: { label: string; val: number; max: number; color: string; isDark: boolean }) {
    const pct = max > 0 ? (val / max) * 100 : 0;
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: isDark ? 'rgba(148,163,184,.7)' : '#64748b' }}>{label}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color }}>{val}</span>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}bb)`, borderRadius: 6, transition: 'width 0.9s cubic-bezier(.25,.46,.45,.94)' }} />
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Analytics Center
══════════════════════════════════════════════════════════════════════════════ */
const AnalyticsCenter = () => {
    const isDark = document.documentElement.classList.contains('dark');
    const t = {
        bg:    isDark ? '#0b0d14' : '#f0f4f8',
        surf:  isDark ? '#111420' : '#ffffff',
        surf2: isDark ? '#161924' : '#f8fafc',
        bord:  isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
        text:  isDark ? '#f0f4f9' : '#0f172a',
        sub:   isDark ? 'rgba(255,255,255,.62)' : '#334155',
        muted: isDark ? 'rgba(255,255,255,.28)' : '#94a3b8',
        hover: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
    };
    const surf = { background: t.surf, border: `1px solid ${t.bord}` };
    const BD   = `1px solid ${isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'}`;

    const navigate = useNavigate();
    const [members,   setMembers]   = useState<Member[]>([]);
    const [analytics, setAnalytics] = useState<Record<string, UserAnalytics>>({});
    const [projects,  setProjects]  = useState<RawProject[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [selUser,   setSelUser]   = useState<string | null>(null);
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'sub_admin' | 'staff'>('all');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [uRes, pRes] = await Promise.allSettled([
                fetch(`${API_BASE}/users`,    { headers: ah() }),
                fetch(`${API_BASE}/projects`, { headers: ah() }),
            ]);
            let mems: Member[] = [];
            let projs: RawProject[] = [];
            if (uRes.status === 'fulfilled' && uRes.value.ok) {
                const d = await uRes.value.json();
                mems = Array.isArray(d) ? d : (d.users ?? []);
                setMembers(mems);
            }
            if (pRes.status === 'fulfilled' && pRes.value.ok) {
                const d = await pRes.value.json();
                projs = Array.isArray(d) ? d : (d.projects ?? []);
                setProjects(projs.filter((p: RawProject) => p._id !== 'public-group' && p._id !== 'all-sub-admin'));
            }
            const targets = mems.slice(0, 15);
            const results = await Promise.allSettled(
                targets.map(m => fetch(`${API_BASE}/analytics/user/${m._id}`, { headers: ah() }).then(r => r.ok ? r.json() : null))
            );
            const map: Record<string, UserAnalytics> = {};
            targets.forEach((m, i) => {
                const r = results[i];
                if (r.status === 'fulfilled' && r.value) map[m._id] = r.value;
            });
            setAnalytics(map);
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { void fetchAll(); }, [fetchAll]);

    /* ── derived ── */
    const projectsForUser = useMemo(() => {
        const map: Record<string, number> = {};
        projects.forEach(p => {
            [...(p.sub_admins ?? []).map(s => s.id ?? s._id), ...(p.staff ?? []).map(s => s.user_id)].forEach(uid => {
                if (uid) map[uid] = (map[uid] ?? 0) + 1;
            });
        });
        return map;
    }, [projects]);

    /* Only admin / sub_admin / staff appear in analytics — no IT, founder, QC */
    const MAIN_ROLES = ['admin', 'sub_admin', 'staff'];

    /* allLeaderboard: all main-role members, unfiltered by UI */
    const allLeaderboard = useMemo(() => {
        const rows = members
            .filter(m => MAIN_ROLES.includes(m.role))
            .map(m => {
                const a   = analytics[m._id] ?? null;
                const pc  = projectsForUser[m._id] ?? 0;
                const score = calcScore(a, pc);
                return { ...m, analytics: a, projectCount: pc, score };
            });
        return [...rows].sort((a, b) => b.score - a.score);
    }, [members, analytics, projectsForUser]);

    /* leaderboard: further narrowed by the role filter pill */
    const leaderboard = useMemo(() => {
        if (roleFilter === 'all') return allLeaderboard;
        return allLeaderboard.filter(m => m.role === roleFilter);
    }, [allLeaderboard, roleFilter]);

    const onlineCount   = members.filter(m => isOnline(m.last_seen)).length;
    const avgScore      = allLeaderboard.length ? Math.round(allLeaderboard.reduce((s, m) => s + m.score, 0) / allLeaderboard.length) : 0;
    const topPerformer  = allLeaderboard[0];
    const highPerf      = allLeaderboard.filter(m => m.score >= 70);
    const mostActive    = [...allLeaderboard].sort((a, b) => (b.last_seen ? new Date(b.last_seen).getTime() : 0) - (a.last_seen ? new Date(a.last_seen).getTime() : 0))[0];
    const mostHelpful   = [...allLeaderboard].sort((a, b) => (b.analytics?.tasks_done ?? 0) - (a.analytics?.tasks_done ?? 0))[0];
    const fastestReview = [...allLeaderboard].sort((a, b) => (b.analytics?.avg_accuracy ?? 0) - (a.analytics?.avg_accuracy ?? 0))[0];
    const mostDelayed   = [...allLeaderboard].sort((a, b) => a.score - b.score)[0];

    /* radar data: 6 axes, team avg vs top performer */
    const radarData = useMemo(() => {
        const avgA = (fn: (a: UserAnalytics) => number) =>
            allLeaderboard.length ? Math.round(allLeaderboard.reduce((s, m) => s + (m.analytics ? fn(m.analytics) : 0), 0) / allLeaderboard.length) : 0;

        const topA = (fn: (a: UserAnalytics) => number) =>
            topPerformer?.analytics ? Math.min(100, Math.round(fn(topPerformer.analytics))) : 0;

        return [
            { label: 'Productivity', team: avgScore,                                                    top: topPerformer?.score ?? 0 },
            { label: 'Quality',      team: avgA(a => a.avg_accuracy * 100),                             top: topA(a => a.avg_accuracy * 100) },
            { label: 'Speed',        team: avgA(a => (a.tasks_done / Math.max(a.tasks_total, 1)) * 100), top: topA(a => (a.tasks_done / Math.max(a.tasks_total, 1)) * 100) },
            { label: 'Collab.',      team: Math.min(100, Math.round(allLeaderboard.reduce((s, m) => s + m.projectCount * 18, 0) / Math.max(allLeaderboard.length, 1))), top: Math.min(100, (topPerformer?.projectCount ?? 0) * 22) },
            { label: 'AI Score',     team: avgA(a => a.avg_accuracy * 100),                             top: topA(a => a.avg_accuracy * 100) },
            { label: 'Activity',     team: onlineCount > 0 ? Math.round((onlineCount / Math.max(members.length, 1)) * 100) : 20, top: isOnline(topPerformer?.last_seen) ? 92 : 38 },
        ];
    }, [allLeaderboard, avgScore, onlineCount, members.length, topPerformer]);

    /* role groups for comparison */
    const roleGroups = useMemo(() => {
        const groups: Record<string, typeof allLeaderboard> = { admin: [], sub_admin: [], staff: [] };
        allLeaderboard.forEach(m => {
            const key = m.role === 'admin' ? 'admin' : m.role.includes('sub') ? 'sub_admin' : 'staff';
            groups[key].push(m);
        });
        const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
        return {
            labels:   ['Admins', 'Sub-Admins', 'Staff'],
            colors:   ['#8b5cf6', '#3b82f6', '#10b981'],
            counts:   [groups.admin.length, groups.sub_admin.length, groups.staff.length],
            scores:   [avg(groups.admin.map(m => m.score)), avg(groups.sub_admin.map(m => m.score)), avg(groups.staff.map(m => m.score))],
            tasks:    [avg(groups.admin.map(m => m.analytics?.tasks_done ?? 0)), avg(groups.sub_admin.map(m => m.analytics?.tasks_done ?? 0)), avg(groups.staff.map(m => m.analytics?.tasks_done ?? 0))],
            aiScores: [avg(groups.admin.map(m => Math.round((m.analytics?.avg_accuracy ?? 0) * 100))), avg(groups.sub_admin.map(m => Math.round((m.analytics?.avg_accuracy ?? 0) * 100))), avg(groups.staff.map(m => Math.round((m.analytics?.avg_accuracy ?? 0) * 100)))],
        };
    }, [allLeaderboard]);

    /* insights */
    const insights = useMemo(() => {
        const list: { icon: string; text: string; color: string }[] = [];
        if (topPerformer) list.push({ icon: '🏆', color: '#f59e0b', text: `${topPerformer.name} leads with a productivity score of ${topPerformer.score}/100.` });
        const inactive = members.filter(m => !isOnline(m.last_seen) && m.last_seen && (Date.now() - new Date(m.last_seen).getTime()) > 4 * 24 * 3600 * 1000);
        if (inactive.length > 0) list.push({ icon: '⚠️', color: '#f59e0b', text: `${inactive[0].name} has not been active for ${Math.floor((Date.now() - new Date(inactive[0].last_seen!).getTime()) / 86400000)} days.` });
        if (fastestReview?.analytics?.avg_accuracy) list.push({ icon: '🤖', color: '#6366f1', text: `${fastestReview.name} has the highest AI quality score (${Math.round(fastestReview.analytics.avg_accuracy * 100)}%).` });
        const overloaded = allLeaderboard.filter(m => m.projectCount > 3);
        if (overloaded.length > 0) list.push({ icon: '🔥', color: '#ef4444', text: `${overloaded[0].name} is involved in ${overloaded[0].projectCount} projects — may be overloaded.` });
        if (mostHelpful?.analytics?.tasks_done) list.push({ icon: '✅', color: '#10b981', text: `${mostHelpful.name} completed ${mostHelpful.analytics.tasks_done} tasks — highest in the team.` });
        if (onlineCount === 0) list.push({ icon: '💤', color: '#64748b', text: 'No team members are currently online.' });
        else list.push({ icon: '🟢', color: '#10b981', text: `${onlineCount} member${onlineCount > 1 ? 's are' : ' is'} currently active in the workspace.` });
        return list.slice(0, 5);
    }, [allLeaderboard, members, onlineCount, topPerformer, fastestReview, mostHelpful]);

    const selectedMember = selUser ? leaderboard.find(m => m._id === selUser) : null;

    return (
        <main className="page-main" style={{ padding: '20px 26px', background: t.bg, minHeight: '100vh', fontFamily: '"Inter",-apple-system,sans-serif', position: 'relative' }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: t.muted, marginBottom: 4 }}>Team Intelligence Center</div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: t.text, lineHeight: 1.15, letterSpacing: '-.02em' }}>Analytics Center</h1>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'block' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>{onlineCount} online</span>
                    </div>
                    {/* Role filter pills */}
                    <div style={{ display: 'flex', gap: 4, padding: '3px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)', border: `1px solid ${t.bord}` }}>
                        {([['all', 'All'], ['admin', 'Admins'], ['sub_admin', 'Sub-Admins'], ['staff', 'Staff']] as [string, string][]).map(([val, label]) => (
                            <button key={val} type="button" onClick={() => setRoleFilter(val as typeof roleFilter)}
                                style={{ padding: '5px 11px', borderRadius: 7, border: 'none', background: roleFilter === val ? '#6366f1' : 'transparent', color: roleFilter === val ? '#fff' : t.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => navigate('/dashboard')}
                        style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ← Dashboard
                    </button>
                </div>
            </div>

            {/* ── SECTION 1: KPI ROW ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
                {[
                    { label: 'Total Members',   value: members.length,     color: '#6366f1', icon: '👥', sub: 'workspace' },
                    { label: 'Online Now',      value: onlineCount,        color: '#10b981', icon: '🟢', sub: 'active' },
                    { label: 'Avg Score',       value: `${avgScore}`,      color: '#f59e0b', icon: '⚡', sub: 'out of 100' },
                    { label: 'Total Projects',  value: projects.length,    color: '#3b82f6', icon: '🗂',  sub: 'active' },
                    { label: 'High Performers', value: highPerf.length,    color: '#8b5cf6', icon: '🏆', sub: 'score 70+' },
                ].map(k => (
                    <div key={k.label} style={{ ...surf, borderRadius: 14, padding: '14px 16px', transition: 'transform .15s, box-shadow .15s', cursor: 'default' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${k.color}1a`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{k.icon}</div>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${k.color}12`, color: k.color }}>{k.sub}</span>
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: k.color, lineHeight: 1 }}>{loading ? '—' : k.value}</div>
                        <div style={{ fontSize: 10, color: t.muted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.label}</div>
                    </div>
                ))}
            </div>

            {/* ── SECTION 2: RADAR + TEAM COMPARISON ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, marginBottom: 16 }}>

                {/* Radar Chart */}
                <div style={{ ...surf, borderRadius: 16, padding: '16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Team Performance Radar</div>
                    <div style={{ fontSize: 10, color: t.muted, marginBottom: 14 }}>Team average vs top performer</div>
                    {loading ? (
                        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>Loading…</div>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <RadarChart data={radarData} size={220} isDark={isDark} />
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 14, marginTop: 12, justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 10, height: 2.5, borderRadius: 2, background: '#6366f1' }} />
                            <span style={{ fontSize: 9, color: t.muted }}>Team Avg</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 10, height: 2.5, borderRadius: 2, background: '#10b981', opacity: 0.7 }} />
                            <span style={{ fontSize: 9, color: t.muted }}>Top Performer</span>
                        </div>
                    </div>
                </div>

                {/* Team Comparison */}
                <div style={{ ...surf, borderRadius: 16, padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Team Comparison</div>
                    <div style={{ fontSize: 10, color: t.muted, marginBottom: 16 }}>Performance by role group</div>
                    {loading ? (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>Loading…</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                            {roleGroups.labels.map((label, i) => (
                                <div key={label}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: roleGroups.colors[i] }} />
                                        <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{label}</span>
                                        <span style={{ fontSize: 9, color: t.muted, marginLeft: 'auto' }}>{roleGroups.counts[i]} members</span>
                                    </div>
                                    <CompareBar label="Avg Score" val={roleGroups.scores[i]} max={100} color={roleGroups.colors[i]} isDark={isDark} />
                                    <CompareBar label="Tasks Done" val={roleGroups.tasks[i]} max={Math.max(...roleGroups.tasks, 1)} color={roleGroups.colors[i]} isDark={isDark} />
                                    <CompareBar label="AI Quality" val={roleGroups.aiScores[i]} max={100} color={roleGroups.colors[i]} isDark={isDark} />
                                    <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: `${roleGroups.colors[i]}0c`, border: `1px solid ${roleGroups.colors[i]}18` }}>
                                        <div style={{ fontSize: 18, fontWeight: 900, color: roleGroups.colors[i] }}>{roleGroups.scores[i]}</div>
                                        <div style={{ fontSize: 9, color: t.muted, fontWeight: 600 }}>avg productivity</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── SECTION 3: MEMBER ANALYTICS CARDS ── */}
            <div style={{ ...surf, borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: BD }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Member Analytics</div>
                        <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>
                            {roleFilter === 'all' ? 'Admin / Sub-Admin / Staff · click a card to drill down' : `Showing: ${roleFilter.replace('_', ' ')} · click to drill down`}
                        </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.muted }}>{leaderboard.length} member{leaderboard.length !== 1 ? 's' : ''}</span>
                </div>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: t.muted, fontSize: 12 }}>Loading member analytics…</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, padding: 16 }}>
                        {leaderboard.map((m, i) => {
                            const sl   = scoreLabel(m.score);
                            const online = isOnline(m.last_seen);
                            const completionPct = m.analytics ? Math.round((m.analytics.tasks_done / Math.max(m.analytics.tasks_total, 1)) * 100) : 0;
                            const isSelected = selUser === m._id;
                            const rankColors = ['#f59e0b', '#94a3b8', '#cd7f32'];
                            return (
                                <div key={m._id}
                                    onClick={() => setSelUser(isSelected ? null : m._id)}
                                    style={{
                                        borderRadius: 14, padding: '14px', cursor: 'pointer',
                                        background: isSelected ? `${sl.color}0c` : (isDark ? 'rgba(255,255,255,.025)' : '#f8fafc'),
                                        border: `1.5px solid ${isSelected ? sl.color + '40' : t.bord}`,
                                        transition: 'all .2s', position: 'relative', overflow: 'hidden',
                                    }}
                                    onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLDivElement).style.borderColor = `${sl.color}30`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${sl.color}12`; } }}
                                    onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLDivElement).style.borderColor = t.bord; (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; } }}>
                                    {/* Rank ribbon for top 3 */}
                                    {i < 3 && (
                                        <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderLeft: '28px solid transparent', borderTop: `28px solid ${rankColors[i]}`, opacity: 0.8 }} />
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <Av name={m.name} size={40} online={online} />
                                        <ScoreRing pct={m.score} color={sl.color} size={46} />
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: m.role === 'admin' ? 'rgba(139,92,246,.14)' : m.role.includes('sub') ? 'rgba(59,130,246,.12)' : 'rgba(100,116,139,.1)', color: m.role === 'admin' ? '#8b5cf6' : m.role.includes('sub') ? '#3b82f6' : '#64748b' }}>
                                            {fmtRole(m.role)}
                                        </span>
                                    </div>
                                    {/* Completion bar */}
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                            <span style={{ fontSize: 9, color: t.muted, fontWeight: 600 }}>Completion</span>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: sl.color }}>{completionPct}%</span>
                                        </div>
                                        <div style={{ height: 4, borderRadius: 4, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${completionPct}%`, background: `linear-gradient(90deg,${sl.color},${sl.color}bb)`, borderRadius: 4, transition: 'width .7s' }} />
                                        </div>
                                    </div>
                                    {/* Stats row */}
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {[
                                            { l: 'Projects',    v: m.projectCount,                    c: '#6366f1' },
                                            { l: 'Tasks',       v: m.analytics?.tasks_done ?? '—',    c: '#10b981' },
                                            { l: 'AI%',         v: m.analytics ? `${Math.round(m.analytics.avg_accuracy * 100)}%` : '—', c: '#8b5cf6' },
                                        ].map(stat => (
                                            <div key={stat.l} style={{ flex: 1, textAlign: 'center', padding: '5px 2px', borderRadius: 7, background: `${stat.c}0a`, border: `1px solid ${stat.c}14` }}>
                                                <div style={{ fontSize: 12, fontWeight: 800, color: stat.c }}>{stat.v}</div>
                                                <div style={{ fontSize: 8, color: t.muted, fontWeight: 600 }}>{stat.l}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 9, color: t.muted, marginTop: 8, textAlign: 'right' }}>{rel(m.last_seen)}</div>
                                </div>
                            );
                        })}
                        {leaderboard.length === 0 && (
                            <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: t.muted, fontSize: 12 }}>No members found.</div>
                        )}
                    </div>
                )}
            </div>

            {/* ── SECTION 4: PRODUCTIVITY SPHERE ── */}
            <div style={{ ...surf, borderRadius: 16, marginBottom: 16, padding: '16px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 20, alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Productivity Sphere</div>
                        <div style={{ fontSize: 10, color: t.muted, marginBottom: 16 }}>Members positioned by performance score · closer to center = higher productivity</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                { label: 'Core Zone (75+)', desc: 'Elite performers, consistently delivering quality', color: '#10b981' },
                                { label: 'Active Zone (50–74)', desc: 'Solid contributors with growth potential', color: '#6366f1' },
                                { label: 'Growth Zone (25–49)', desc: 'Developing performers needing support', color: '#f59e0b' },
                                { label: 'Outer Ring (0–24)', desc: 'Members requiring immediate attention', color: '#ef4444' },
                            ].map(z => (
                                <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{z.label}</div>
                                        <div style={{ fontSize: 9, color: t.muted }}>{z.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 10, background: isDark ? 'rgba(99,102,241,.08)' : 'rgba(99,102,241,.06)', border: `1px solid rgba(99,102,241,.15)` }}>
                            <div style={{ display: 'flex', gap: 20 }}>
                                {[
                                    { l: 'Team Avg Score', v: avgScore, c: '#6366f1' },
                                    { l: 'High Perf.', v: highPerf.length, c: '#10b981' },
                                    { l: 'Online', v: onlineCount, c: '#f59e0b' },
                                ].map(s => (
                                    <div key={s.l}>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{loading ? '—' : s.v}</div>
                                        <div style={{ fontSize: 9, color: t.muted, fontWeight: 600 }}>{s.l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {loading ? (
                            <div style={{ width: 290, height: 290, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>Loading sphere…</div>
                        ) : (
                            <ProductivitySphere members={allLeaderboard} avgTeamScore={avgScore} size={290} isDark={isDark} />
                        )}
                    </div>
                </div>
            </div>

            {/* ── SECTION 5: AI WORKFORCE ANALYSIS ── */}
            <div style={{ ...surf, borderRadius: 16, marginBottom: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🤖</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>AI Workforce Analysis</div>
                        <div style={{ fontSize: 10, color: t.muted }}>Role-based member classification with AI explanations</div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: 30, textAlign: 'center', color: t.muted, fontSize: 12 }}>Analyzing workforce…</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                        {[
                            {
                                title: 'Top Performer',
                                icon: '🏆',
                                color: '#f59e0b',
                                member: topPerformer,
                                reason: topPerformer ? `Score ${topPerformer.score}/100 · ${topPerformer.analytics?.tasks_done ?? 0} tasks done` : 'No data',
                            },
                            {
                                title: 'Most Active',
                                icon: '⚡',
                                color: '#10b981',
                                member: mostActive,
                                reason: mostActive ? `Last seen: ${rel(mostActive.last_seen)}` : 'No data',
                            },
                            {
                                title: 'Most Helpful',
                                icon: '🤝',
                                color: '#6366f1',
                                member: mostHelpful,
                                reason: mostHelpful ? `${mostHelpful.analytics?.tasks_done ?? 0} completed tasks · ${mostHelpful.projectCount} projects` : 'No data',
                            },
                            {
                                title: 'Quality Leader',
                                icon: '🎯',
                                color: '#8b5cf6',
                                member: fastestReview,
                                reason: fastestReview ? `AI pass rate: ${Math.round((fastestReview.analytics?.avg_accuracy ?? 0) * 100)}%` : 'No data',
                            },
                            {
                                title: 'Needs Attention',
                                icon: '🔔',
                                color: '#ef4444',
                                member: mostDelayed,
                                reason: mostDelayed ? `Score ${mostDelayed.score}/100 · low productivity` : 'No data',
                            },
                        ].map(card => (
                            <div key={card.title} style={{
                                borderRadius: 12, padding: '14px',
                                background: `${card.color}08`, border: `1px solid ${card.color}20`,
                                transition: 'transform .15s, box-shadow .15s',
                            }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${card.color}18`; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 7, background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{card.icon}</div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>{card.title}</span>
                                </div>
                                {card.member ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <Av name={card.member.name} size={30} online={isOnline(card.member.last_seen)} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.member.name}</div>
                                                <div style={{ fontSize: 9, color: t.muted }}>{fmtRole(card.member.role)}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 10, color: t.sub, lineHeight: 1.5, padding: '6px 8px', borderRadius: 7, background: `${card.color}08` }}>{card.reason}</div>
                                    </>
                                ) : (
                                    <div style={{ fontSize: 11, color: t.muted, textAlign: 'center', padding: 10 }}>No data available</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── SECTION 6: MANAGER INSIGHTS ── */}
            <div style={{ ...surf, borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#10b981,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📊</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Manager Insights</div>
                        <div style={{ fontSize: 10, color: t.muted }}>Auto-generated from real workspace data</div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: t.muted, fontSize: 12 }}>Computing insights…</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
                        {insights.map((ins, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: `${ins.color}09`, border: `1px solid ${ins.color}1a` }}>
                                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${ins.color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{ins.icon}</div>
                                <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.6 }}>{ins.text}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── MEMBER DRILLDOWN DRAWER ── */}
            {selectedMember && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setSelUser(null)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 40, backdropFilter: 'blur(2px)' }}
                    />
                    {/* Drawer */}
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: 340,
                        background: isDark ? '#111420' : '#ffffff',
                        borderLeft: `1px solid ${t.bord}`,
                        zIndex: 50, overflowY: 'auto',
                        boxShadow: '-8px 0 40px rgba(0,0,0,.2)',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Drawer header */}
                        <div style={{ padding: '20px 20px 14px', borderBottom: BD, flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Member Profile</span>
                                <button type="button" onClick={() => setSelUser(null)}
                                    style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: 'inherit' }}>✕</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Av name={selectedMember.name} size={52} online={isOnline(selectedMember.last_seen)} />
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{selectedMember.name}</div>
                                    <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>{selectedMember.email}</div>
                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: selectedMember.role === 'admin' ? 'rgba(139,92,246,.14)' : selectedMember.role.includes('sub') ? 'rgba(59,130,246,.12)' : 'rgba(100,116,139,.1)', color: selectedMember.role === 'admin' ? '#8b5cf6' : selectedMember.role.includes('sub') ? '#3b82f6' : '#64748b', marginTop: 4, display: 'inline-block' }}>
                                        {fmtRole(selectedMember.role)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Score ring + level */}
                        <div style={{ padding: '16px 20px', borderBottom: BD, display: 'flex', alignItems: 'center', gap: 16 }}>
                            <ScoreRing pct={selectedMember.score} color={scoreLabel(selectedMember.score).color} size={70} />
                            <div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: scoreLabel(selectedMember.score).color }}>{scoreLabel(selectedMember.score).label}</div>
                                <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Productivity Level</div>
                                <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>Last active: {rel(selectedMember.last_seen)}</div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div style={{ padding: '14px 20px', borderBottom: BD }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Task Analytics</div>
                            {[
                                { label: 'Tasks Completed', val: selectedMember.analytics?.tasks_done ?? '—', color: '#10b981' },
                                { label: 'In Progress',     val: selectedMember.analytics?.tasks_in_progress ?? '—', color: '#6366f1' },
                                { label: 'In Review',       val: selectedMember.analytics?.tasks_in_review ?? '—', color: '#f59e0b' },
                                { label: 'Total Tasks',     val: selectedMember.analytics?.tasks_total ?? '—', color: t.sub },
                            ].map(row => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'}` }}>
                                    <span style={{ fontSize: 11, color: t.muted }}>{row.label}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color as string }}>{row.val}</span>
                                </div>
                            ))}
                        </div>

                        {/* Quality + Projects */}
                        <div style={{ padding: '14px 20px', borderBottom: BD }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Quality & Projects</div>
                            {[
                                { label: 'AI Quality Score', val: selectedMember.analytics ? `${Math.round(selectedMember.analytics.avg_accuracy * 100)}%` : '—', color: '#8b5cf6' },
                                { label: 'Active Projects',  val: selectedMember.projectCount, color: '#3b82f6' },
                            ].map(row => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'}` }}>
                                    <span style={{ fontSize: 11, color: t.muted }}>{row.label}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color as string }}>{row.val}</span>
                                </div>
                            ))}
                        </div>

                        {/* Performance bars */}
                        <div style={{ padding: '14px 20px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Performance Breakdown</div>
                            {[
                                { label: 'Productivity Score', val: selectedMember.score, color: scoreLabel(selectedMember.score).color },
                                { label: 'Completion Rate', val: selectedMember.analytics ? Math.round((selectedMember.analytics.tasks_done / Math.max(selectedMember.analytics.tasks_total, 1)) * 100) : 0, color: '#10b981' },
                                { label: 'AI Quality', val: Math.round((selectedMember.analytics?.avg_accuracy ?? 0) * 100), color: '#8b5cf6' },
                                { label: 'Project Load', val: Math.min(selectedMember.projectCount * 20, 100), color: '#f59e0b' },
                            ].map(bar => (
                                <div key={bar.label} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, color: t.muted }}>{bar.label}</span>
                                        <span style={{ fontSize: 10, fontWeight: 800, color: bar.color }}>{bar.val}%</span>
                                    </div>
                                    <div style={{ height: 5, borderRadius: 5, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${bar.val}%`, background: `linear-gradient(90deg,${bar.color},${bar.color}cc)`, borderRadius: 5, transition: 'width .7s' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </main>
    );
};

/* ══════════════════════════════════════════════════════════════════════════════
   Page wrapper
══════════════════════════════════════════════════════════════════════════════ */
export default function TeamPage() {
    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Analytics Center" />
                <AnalyticsCenter />
            </div>
        </div>
    );
}
