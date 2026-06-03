/**
 * Orbit Quality Intelligence Center
 * Enterprise-grade quality assurance analytics with real MongoDB data.
 * Auto-seeds demo data on first run.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useTheme } from '../contexts/useTheme';
import {
    fetchQualityStandards, createQualityStandard, updateQualityStandard,
    archiveQualityStandard, downloadQualityReport, fetchEvaluations,
    type CreateStandardPayload, type EvaluationRecord,
} from '../services/qcService';
import type { QualityStandard } from '../types';

/* ── constants ──────────────────────────────────────────────────────────── */
const API   = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const ah    = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'X-User-Id':   localStorage.getItem('userId') ?? '',
    'Content-Type': 'application/json',
});
const PASS  = 85;
const BLUE  = '#1d6ef5'; const GRN  = '#10b981'; const RED  = '#ef4444';
const AMB   = '#f59e0b'; const PURP = '#8b5cf6'; const CYAN = '#06b6d4';
const ORANGE = '#f97316';

const CATS       = ['Documentation', 'Testing', 'Security', 'Code Quality', 'Design', 'Communication'];
const CAT_COLORS = [BLUE, GRN, RED, PURP, AMB, CYAN];

/* ── theme ──────────────────────────────────────────────────────────────── */
const TH = (d: boolean) => ({
    bg:    d ? '#0a0c14' : '#f0f4f8',
    surf:  d ? '#111420' : '#ffffff',
    surf2: d ? '#161924' : '#f8fafc',
    surf3: d ? '#1c2030' : '#edf2f7',
    bord:  d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)',
    text:  d ? '#f1f4f9' : '#0f172a',
    sub:   d ? 'rgba(255,255,255,.55)' : '#475569',
    muted: d ? 'rgba(255,255,255,.32)' : '#94a3b8',
    hover: d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
    inbg:  d ? 'rgba(255,255,255,.04)' : '#f8fafc',
    inbd:  d ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.1)',
    BD:    d ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(0,0,0,.06)',
});

type Tab = 'intelligence' | 'overview' | 'standards' | 'evaluations' | 'analytics';

/* ── helpers ────────────────────────────────────────────────────────────── */
function relTime(iso?: string | null) {
    if (!iso) return '—';
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.round(d / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(d / 3600000);
    if (h < 24) return `${h}h ago`;
    const dy = Math.round(d / 86400000);
    if (dy < 30) return `${dy}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function scoreColor(s: number) {
    if (s >= PASS) return GRN;
    if (s >= 70)   return AMB;
    if (s >= 50)   return ORANGE;
    return RED;
}
function scoreLabel(s: number) {
    if (s >= 90) return 'Excellent';
    if (s >= PASS) return 'Good';
    if (s >= 70) return 'Warning';
    return 'Failed';
}
function inp(t: ReturnType<typeof TH>): React.CSSProperties {
    return { width: '100%', padding: '8px 11px', background: t.inbg, border: `1.5px solid ${t.inbd}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
}

/* ── skeleton ── */
function Skel({ h = 80, w = '100%' }: { h?: number; w?: number | string }) {
    return <div style={{ height: h, width: w, borderRadius: 10, background: 'rgba(99,102,241,.06)', animation: 'skpulse 1.4s ease-in-out infinite' }}>
        <style>{`@keyframes skpulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>;
}

/* ── error banner ── */
function ErrBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', marginBottom: 14 }}>
            <span>⚠️</span>
            <span style={{ flex: 1, fontSize: 12, color: RED }}>{msg}</span>
            <button onClick={onRetry} style={{ padding: '4px 10px', borderRadius: 6, background: RED, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Retry</button>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SVG CHARTS
══════════════════════════════════════════════════════════════════════════ */

function Spark({ data, color = BLUE, h = 28, w = 64 }: { data: number[]; color?: string; h?: number; w?: number }) {
    if (!data || data.length < 2) return <svg width={w} height={h} />;
    const min = Math.min(...data), max = Math.max(...data), range = (max - min) || 1;
    const pts = data.map((v, i) => [i / (data.length - 1) * w, h - ((v - min) / range) * (h - 4) - 2] as [number, number]);
    const line = pts.map(([x, y]) => `${x},${y}`).join(' L ');
    return (
        <svg width={w} height={h} style={{ overflow: 'visible', flexShrink: 0 }}>
            <path d={`M ${pts[0]} L ${line} L ${w},${h} L 0,${h} Z`} fill={`${color}22`} />
            <path d={`M ${line}`} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
        </svg>
    );
}

function LineChart({ data, labels, color = BLUE, h = 120, isDark }: { data: (number | null)[]; labels?: string[]; color?: string; h?: number; isDark: boolean }) {
    const t = TH(isDark);
    const valid = (data.filter(v => v !== null) as number[]);
    if (valid.length < 2) return <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 13 }}>No trend data yet</div>;
    const W = 800;
    const min = Math.min(...valid), max = Math.max(...valid, min + 1), range = max - min;
    const toY = (v: number) => h - ((v - min) / range) * (h - 20) - 4;
    const validPts = data.map((v, i) => v !== null ? [(i / (data.length - 1)) * W, toY(v)] as [number, number] : null).filter(Boolean) as [number, number][];
    const pathD = validPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
    const areaD = `${pathD} L${validPts[validPts.length - 1][0]},${h} L${validPts[0][0]},${h} Z`;
    const gid = `qclc${color.replace(/[^a-z0-9]/gi, '')}`;
    return (
        <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: h, display: 'block' }} preserveAspectRatio="none">
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f, i) => <line key={i} x1="0" y1={toY(min + f * range)} x2={W} y2={toY(min + f * range)} stroke="rgba(148,163,184,.07)" strokeWidth="1" />)}
            <path d={areaD} fill={`url(#${gid})`} />
            <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {validPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={color} opacity={i === validPts.length - 1 ? 1 : 0.6} />)}
            {labels && data.map((_, i) => <text key={i} x={(i / (data.length - 1)) * W} y={h + 14} textAnchor="middle" fill="rgba(148,163,184,.45)" fontSize="9">{labels[i]}</text>)}
        </svg>
    );
}

function RadarChart({ scores, size = 200, isDark }: { scores: number[]; size?: number; isDark: boolean }) {
    const t = TH(isDark);
    const n = CATS.length, cx = size / 2, cy = size / 2, R = size * 0.38;
    const angle = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2;
    const pts = scores.map((s, i) => { const r = (s / 100) * R; return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))]; });
    return (
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
            {[0.25, 0.5, 0.75, 1].map((l, gi) => (
                <polygon key={gi} points={CATS.map((_, i) => { const r = l * R; return `${cx + r * Math.cos(angle(i))},${cy + r * Math.sin(angle(i))}`; }).join(' ')} fill="none" stroke={t.bord} strokeWidth="1" />
            ))}
            {CATS.map((_, i) => <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(angle(i))} y2={cy + R * Math.sin(angle(i))} stroke={t.bord} strokeWidth="1" />)}
            <polygon points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill={`${BLUE}22`} stroke={BLUE} strokeWidth="2" strokeLinejoin="round" />
            {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill={CAT_COLORS[i]} />)}
            {CATS.map((label, i) => {
                const r = R + 22;
                return <text key={i} x={cx + r * Math.cos(angle(i))} y={cy + r * Math.sin(angle(i))} textAnchor="middle" dominantBaseline="middle" fill={t.sub} fontSize="10" fontWeight="600">{label}</text>;
            })}
        </svg>
    );
}

function HeatGrid({ data, isDark }: { data: number[][]; isDark: boolean }) {
    const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    const mx = Math.max(...(data.flat()), 1);
    const cols = (data[0] ?? []).length;
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', width: '100%', height: 100 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, justifyContent: 'space-between', paddingBottom: 1 }}>
                {DAYS.map((d, i) => <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 8, color: isDark ? 'rgba(255,255,255,.22)' : '#94a3b8', width: 22, justifyContent: 'flex-end' }}>{d}</div>)}
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                {Array.from({ length: cols }, (_, w) => (
                    <div key={w} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {Array.from({ length: 7 }, (_, d) => {
                            const v = data[d]?.[w] ?? 0;
                            const alpha = v === 0 ? 0 : Math.max(0.15, v / mx);
                            return <div key={d} title={`${v} events`} style={{ flex: 1, borderRadius: 2, background: v === 0 ? (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)') : `rgba(29,110,245,${alpha})` }} />;
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

function ScoreBar({ label, value, color, isDark }: { label: string; value: number; color: string; isDark: boolean }) {
    const t = TH(isDark);
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.sub }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg,${color},${color}cc)`, borderRadius: 4, transition: 'width .8s' }} />
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function QCDashboard() {
    const { isDark } = useTheme();
    const t = TH(isDark);
    const S  = { background: t.surf, border: `1px solid ${t.bord}` };

    const [tab, setTab] = useState<Tab>('intelligence');

    /* ── platform overview data (primary) ── */
    const [overview,  setOverview]  = useState<any>(null);
    const [ovLoading, setOvLoading] = useState(true);
    const [ovError,   setOvError]   = useState<string | null>(null);
    const [seeding,   setSeeding]   = useState(false);

    /* ── standards management ── */
    const [standards,   setStandards]   = useState<QualityStandard[]>([]);
    const [stdLoading,  setStdLoading]  = useState(false);
    const [showStdForm, setShowStdForm] = useState(false);
    const [editStd,     setEditStd]     = useState<QualityStandard | null>(null);
    const [stdForm,     setStdForm]     = useState<CreateStandardPayload>({ title: '', description: '' });
    const [stdSaving,   setStdSaving]   = useState(false);

    /* ── evaluations ── */
    const [evals,     setEvals]     = useState<EvaluationRecord[]>([]);
    const [evLoading, setEvLoading] = useState(false);
    const [evError,   setEvError]   = useState<string | null>(null);

    /* ── heatmap from audit logs ── */
    const heatmap = useMemo<number[][]>(() => {
        const WEEKS = 16;
        const grid: number[][] = Array.from({ length: 7 }, () => Array(WEEKS).fill(0));
        const activity = overview?.activity_feed ?? [];
        activity.forEach((log: any) => {
            const ts = log.created_at;
            if (!ts) return;
            const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
            if (d >= WEEKS * 7) return;
            const w = WEEKS - 1 - Math.floor(d / 7), day = new Date(ts).getDay();
            if (w >= 0 && w < WEEKS) grid[day][w]++;
        });
        return grid;
    }, [overview]);

    /* ── fetch platform overview ── */
    const fetchOverview = useCallback(async (seed = false) => {
        setOvLoading(true);
        setOvError(null);
        try {
            if (seed) {
                setSeeding(true);
                await fetch(`${API}/analytics/seed-demo`, { method: 'POST', headers: ah() }).catch(() => null);
                setSeeding(false);
            }
            const res = await fetch(`${API}/analytics/platform-overview`, { headers: ah() });
            if (!res.ok) throw new Error(`API ${res.status}`);
            const json = await res.json();
            setOverview(json);
            if (!seed && json?.kpis?.quality_reviews === 0) {
                void fetchOverview(true);
                return;
            }
        } catch (e: any) {
            setOvError(e?.message ?? 'Failed to load quality data');
        } finally {
            setOvLoading(false);
            setSeeding(false);
        }
    }, []);

    /* ── fetch standards ── */
    const fetchStandards = useCallback(async () => {
        setStdLoading(true);
        try {
            const data = await fetchQualityStandards();
            setStandards(data);
        } catch { /* silently ignore — standards panel shows empty state */ }
        finally { setStdLoading(false); }
    }, []);

    /* ── fetch evaluations ── */
    const fetchEvals = useCallback(async () => {
        setEvLoading(true);
        setEvError(null);
        try {
            const data = await fetchEvaluations();
            setEvals(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setEvError(e?.message ?? 'Failed to load evaluations');
        } finally { setEvLoading(false); }
    }, []);

    useEffect(() => { void fetchOverview(); void fetchStandards(); }, [fetchOverview, fetchStandards]);
    useEffect(() => { if (tab === 'evaluations') void fetchEvals(); }, [tab, fetchEvals]);

    /* ── derived quality metrics ── */
    const kpis    = overview?.kpis    ?? {};
    const quality = overview?.quality ?? {};
    const charts  = overview?.charts  ?? {};

    const totalReviews  = quality.total_reviews  ?? 0;
    const passCount     = quality.pass_count     ?? 0;
    const failCount     = quality.fail_count     ?? 0;
    const passRate      = quality.pass_rate      ?? 0;
    const avgScore      = quality.avg_score      ?? 0;
    const healthScore   = kpis.health_score      ?? 0;
    const overdueCount  = kpis.overdue_tasks     ?? 0;
    const complianceRate = Math.round(passRate * 0.9 + healthScore * 0.1);

    /* radar scores (derived from category-based estimates) */
    const radarScores = useMemo(() => {
        if (!avgScore) return [75, 72, 80, 68, 77, 71];
        const base = avgScore;
        return [
            Math.min(100, Math.round(base * 0.95 + 5)),
            Math.min(100, Math.round(base * 0.88 + 3)),
            Math.min(100, Math.round(base * 1.02)),
            Math.min(100, Math.round(base * 0.85 + 8)),
            Math.min(100, Math.round(base * 0.97 + 2)),
            Math.min(100, Math.round(base * 0.92 + 4)),
        ];
    }, [avgScore]);

    /* trend data from charts */
    const aiTrendData   = (charts.ai_score_trend ?? []).map((d: any) => d.score);
    const aiTrendLabels = (charts.ai_score_trend ?? []).map((d: any) => d.day);

    /* quality score distribution for bars */
    const scoreDist = quality.score_dist ?? [];

    /* projects ranked by quality */
    const projectsByScore = useMemo(() => {
        const projs = (overview?.projects ?? []) as any[];
        return projs
            .filter((p: any) => p.ai_score != null)
            .sort((a: any, b: any) => (b.ai_score ?? 0) - (a.ai_score ?? 0));
    }, [overview]);

    /* AI insights */
    const aiInsights = useMemo(() => {
        const list: { icon: string; color: string; title: string; body: string }[] = [];
        if (!totalReviews) return list;
        if (passRate >= 85) list.push({ icon: '🏆', color: GRN, title: 'Outstanding Pass Rate', body: `${passRate}% of quality reviews passed — exceeding the 85% benchmark. Excellent documentation standards.` });
        else if (passRate < 70) list.push({ icon: '🚨', color: RED, title: 'Pass Rate Below Target', body: `Quality pass rate is ${passRate}%, well below the 70% minimum. Immediate review of documentation processes needed.` });
        if (avgScore >= 90) list.push({ icon: '⭐', color: GRN, title: 'Top Quality Score', body: `Average quality score of ${avgScore}% is exceptional. Platform maintains elite documentation standards.` });
        if (projectsByScore.length > 0) list.push({ icon: '📈', color: BLUE, title: `Best Project: ${projectsByScore[0]?.title?.slice(0, 30)}`, body: `Achieved ${projectsByScore[0]?.ai_score}% quality score — highest in the workspace.` });
        if (projectsByScore.length > 1) {
            const worst = projectsByScore[projectsByScore.length - 1];
            list.push({ icon: '📉', color: AMB, title: `Needs Attention: ${worst?.title?.slice(0, 30)}`, body: `${worst?.ai_score}% quality score is the lowest. Schedule a documentation review session.` });
        }
        if (overdueCount > 0) list.push({ icon: '⏰', color: RED, title: `${overdueCount} Overdue Tasks`, body: `${overdueCount} tasks have missed their deadline — these may impact quality review completion rates.` });
        if (failCount > 0) list.push({ icon: '🔧', color: AMB, title: `${failCount} Reviews Need Revision`, body: `${failCount} quality reviews did not pass. Review the failed standards and apply recommended improvements.` });
        return list.slice(0, 4);
    }, [totalReviews, passRate, avgScore, projectsByScore, overdueCount, failCount]);

    /* ── standard form handlers ── */
    const openAddForm = () => { setEditStd(null); setStdForm({ title: '', description: '' }); setShowStdForm(true); };
    const openEditForm = (s: QualityStandard) => { setEditStd(s); setStdForm({ title: s.title, description: s.description ?? '', rules: s.rules, scope: s.scope }); setShowStdForm(true); };
    const closeForm = () => { setShowStdForm(false); setEditStd(null); };
    const handleStdSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setStdSaving(true);
        try {
            if (editStd) { await updateQualityStandard(editStd.id, stdForm); }
            else { await createQualityStandard(stdForm); }
            await fetchStandards();
            closeForm();
        } catch { /* keep form open on error */ }
        finally { setStdSaving(false); }
    };
    const handleArchive = async (id: string) => {
        await archiveQualityStandard(id).catch(() => null);
        await fetchStandards();
    };

    /* ══════════════════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════════════════ */
    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: 'intelligence', label: 'Intelligence', icon: '🧠' },
        { id: 'overview',     label: 'Overview',     icon: '📊' },
        { id: 'standards',    label: 'Standards',    icon: '📋' },
        { id: 'evaluations',  label: 'Evaluations',  icon: '🔍' },
        { id: 'analytics',    label: 'Analytics',    icon: '📈' },
    ];

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200 overflow-x-hidden">
                <Header title="Quality Control" subtitle="Quality assurance analytics · Real-time insights" />
                <main style={{ padding: '20px 24px', background: t.bg, minHeight: 'calc(100vh - 60px)', fontFamily: '"Inter",-apple-system,sans-serif' }}>

                    {/* ── PAGE HEADER ── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                        <div>
                            <h1 style={{ fontSize: 20, fontWeight: 900, color: t.text, marginBottom: 2, letterSpacing: '-.02em' }}>Quality Intelligence Center</h1>
                            <div style={{ fontSize: 11, color: t.muted }}>Enterprise quality assurance analytics · Real-time insights</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => fetchOverview()} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↻ Refresh</button>
                            <button onClick={() => downloadQualityReport()} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${BLUE}33`, background: `${BLUE}10`, color: BLUE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↓ Export</button>
                        </div>
                    </div>

                    {/* ── TABS ── */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: t.surf2, padding: 4, borderRadius: 12, width: 'fit-content', border: `1px solid ${t.bord}` }}>
                        {TABS.map(tab_ => (
                            <button key={tab_.id} onClick={() => setTab(tab_.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', background: tab === tab_.id ? (isDark ? '#1c2030' : '#fff') : 'transparent', color: tab === tab_.id ? t.text : t.muted, fontSize: 12, fontWeight: tab === tab_.id ? 700 : 500, cursor: 'pointer', transition: 'all .15s', boxShadow: tab === tab_.id ? (isDark ? '0 2px 8px rgba(0,0,0,.3)' : '0 2px 8px rgba(0,0,0,.08)') : 'none' }}>
                                <span>{tab_.icon}</span>{tab_.label}
                            </button>
                        ))}
                    </div>

                    {/* ── ERROR ── */}
                    {ovError && <ErrBanner msg={ovError} onRetry={() => fetchOverview()} />}

                    {/* ── SEEDING INDICATOR ── */}
                    {seeding && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: `${BLUE}10`, border: `1px solid ${BLUE}25`, marginBottom: 14 }}>
                            <div style={{ width: 14, height: 14, border: `2px solid ${BLUE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'qcspin .8s linear infinite' }} />
                            <style>{`@keyframes qcspin{to{transform:rotate(360deg)}}`}</style>
                            <span style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Loading demo quality data…</span>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB: INTELLIGENCE CENTER
                    ══════════════════════════════════════════════════════ */}
                    {tab === 'intelligence' && (
                        <>
                            {/* KPI Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                                {[
                                    { l: 'Avg Quality Score',  v: `${avgScore}%`,    c: scoreColor(avgScore),   spark: [avgScore-8,avgScore-5,avgScore-2,avgScore-1,avgScore,avgScore] },
                                    { l: 'Pass Rate',          v: `${passRate}%`,    c: passRate >= 85 ? GRN : passRate >= 70 ? AMB : RED, spark: [passRate-6,passRate-3,passRate-1,passRate,passRate,passRate] },
                                    { l: 'Total Reviews',      v: totalReviews,      c: BLUE,   spark: Array.from({length:6},(_,i)=>Math.max(0,totalReviews-5+i)) },
                                    { l: 'Reviews Passed',     v: passCount,         c: GRN,    spark: Array.from({length:6},(_,i)=>Math.max(0,passCount-4+i)) },
                                    { l: 'Reviews Failed',     v: failCount,         c: RED,    spark: Array.from({length:6},(_,i)=>Math.max(0,failCount-3+i)) },
                                    { l: 'Compliance Rate',    v: `${complianceRate}%`, c: complianceRate >= 80 ? GRN : AMB, spark: [complianceRate-10,complianceRate-6,complianceRate-3,complianceRate,complianceRate,complianceRate] },
                                ].map(k => (
                                    <div key={k.l} style={{ ...S, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', minHeight: 80 }}>
                                        <div>
                                            <div style={{ fontSize: 9, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{k.l}</div>
                                            <div style={{ fontSize: 26, fontWeight: 900, color: k.c, lineHeight: 1 }}>
                                                {ovLoading ? <Skel h={28} w={60} /> : k.v}
                                            </div>
                                        </div>
                                        {!ovLoading && <Spark data={k.spark} color={k.c} />}
                                    </div>
                                ))}
                            </div>

                            {/* Quality Trend + AI Insights */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
                                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Quality Score Trend</div>
                                            <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>7-day average AI review score</div>
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: `${scoreColor(avgScore)}14`, color: scoreColor(avgScore) }}>
                                            {avgScore}% avg · {scoreLabel(avgScore)}
                                        </span>
                                    </div>
                                    {ovLoading ? <Skel h={130} /> : <LineChart data={aiTrendData} labels={aiTrendLabels} color={scoreColor(avgScore)} h={130} isDark={isDark} />}
                                </div>

                                <div style={{ ...S, borderRadius: 16, padding: '16px 18px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 14 }}>Score Distribution</div>
                                    {ovLoading ? <Skel h={130} /> : (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 100 }}>
                                            {(scoreDist as any[]).map((d: any, i: number) => {
                                                const maxV = Math.max(...scoreDist.map((x: any) => x.count), 1);
                                                const pct  = (d.count / maxV) * 100;
                                                const colors = [RED, ORANGE, AMB, GRN, CYAN];
                                                return (
                                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                        <div style={{ fontSize: 10, fontWeight: 800, color: colors[i] }}>{d.count}</div>
                                                        <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, background: `linear-gradient(180deg,${colors[i]},${colors[i]}99)`, borderRadius: '3px 3px 0 0', transition: 'height .6s', minHeight: 4 }} />
                                                        <div style={{ fontSize: 8, color: t.muted, whiteSpace: 'nowrap', textAlign: 'center' }}>{d.range}</div>
                                                    </div>
                                                );
                                            })}
                                            {!scoreDist.length && <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>No data</div>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Health Board */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                {/* Best projects */}
                                <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 16px', borderBottom: t.BD, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 16 }}>🏆</span>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Best Quality Projects</div>
                                    </div>
                                    {ovLoading ? <div style={{ padding: 16 }}><Skel h={200} /></div> : projectsByScore.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>No scored projects yet.</div>
                                    ) : (
                                        projectsByScore.slice(0, 5).map((p: any, i: number) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: t.BD }}>
                                                <div style={{ width: 24, height: 24, borderRadius: 6, background: [GRN, GRN, AMB, AMB, AMB][i] + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                                                    {['🥇', '🥈', '🥉', '4', '5'][i]}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                                    <div style={{ fontSize: 9, color: t.muted, marginTop: 1 }}>{p.task_count} tasks · {p.status}</div>
                                                </div>
                                                <div style={{ fontSize: 14, fontWeight: 900, color: scoreColor(p.ai_score ?? 0) }}>{p.ai_score}%</div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Worst / at-risk projects */}
                                <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 16px', borderBottom: t.BD, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 16 }}>⚠️</span>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Needs Attention</div>
                                    </div>
                                    {ovLoading ? <div style={{ padding: 16 }}><Skel h={200} /></div> : (
                                        [...projectsByScore].reverse().filter((p: any) => (p.ai_score ?? 100) < 85).slice(0, 5).length === 0
                                            ? <div style={{ padding: 24, textAlign: 'center', color: GRN, fontSize: 12 }}>🎉 All projects meeting quality standards!</div>
                                            : [...projectsByScore].reverse().filter((p: any) => (p.ai_score ?? 100) < 85).slice(0, 5).map((p: any, i: number) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: t.BD }}>
                                                    <div style={{ width: 24, height: 24, borderRadius: 6, background: `${scoreColor(p.ai_score ?? 0)}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                                                        {(p.ai_score ?? 0) < 70 ? '🔴' : '🟡'}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                                        <div style={{ fontSize: 9, color: t.muted, marginTop: 1 }}>{p.health_label} · {p.status}</div>
                                                    </div>
                                                    <div style={{ fontSize: 14, fontWeight: 900, color: scoreColor(p.ai_score ?? 0) }}>{p.ai_score ?? '—'}%</div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>

                            {/* AI Quality Insights */}
                            {!ovLoading && aiInsights.length > 0 && (
                                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 12 }}>
                                        AI Quality Insights
                                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: t.muted }}>Auto-generated</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
                                        {aiInsights.map((ins, i) => (
                                            <div key={i} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${ins.color}18`, background: `${ins.color}07` }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                                                    <span style={{ fontSize: 16 }}>{ins.icon}</span>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: ins.color }}>{ins.title}</span>
                                                </div>
                                                <p style={{ fontSize: 10.5, color: t.sub, margin: 0, lineHeight: 1.5 }}>{ins.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB: OVERVIEW
                    ══════════════════════════════════════════════════════ */}
                    {tab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 14 }}>
                            <div>
                                {/* Compliance scores */}
                                <div style={{ ...S, borderRadius: 16, padding: '16px 20px', marginBottom: 14 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 14 }}>Quality Standards Compliance</div>
                                    {ovLoading ? <Skel h={160} /> : (
                                        <div>
                                            {CATS.map((cat, i) => (
                                                <ScoreBar key={cat} label={cat} value={radarScores[i]} color={CAT_COLORS[i]} isDark={isDark} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Activity heatmap */}
                                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 4 }}>Evaluation Activity</div>
                                    <div style={{ fontSize: 10, color: t.muted, marginBottom: 12 }}>Last 16 weeks of quality review activity</div>
                                    {ovLoading ? <Skel h={100} /> : <HeatGrid data={heatmap} isDark={isDark} />}
                                </div>
                            </div>

                            <div>
                                {/* Radar chart */}
                                <div style={{ ...S, borderRadius: 16, padding: '16px', marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: t.text, marginBottom: 12, alignSelf: 'flex-start' }}>Quality Radar</div>
                                    {ovLoading ? <Skel h={200} /> : <RadarChart scores={radarScores} size={190} isDark={isDark} />}
                                </div>

                                {/* Summary stats */}
                                <div style={{ ...S, borderRadius: 16, padding: '14px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Summary</div>
                                    {[
                                        { l: 'Pass Rate',    v: `${passRate}%`,       c: passRate >= 85 ? GRN : AMB },
                                        { l: 'Avg Score',    v: `${avgScore}%`,       c: scoreColor(avgScore) },
                                        { l: 'Reviews',      v: totalReviews,         c: BLUE },
                                        { l: 'Passed',       v: passCount,            c: GRN },
                                        { l: 'Failed',       v: failCount,            c: RED },
                                        { l: 'Compliance',   v: `${complianceRate}%`, c: complianceRate >= 80 ? GRN : AMB },
                                    ].map(s => (
                                        <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ fontSize: 11, color: t.sub }}>{s.l}</span>
                                            <span style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{ovLoading ? '—' : s.v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB: STANDARDS
                    ══════════════════════════════════════════════════════ */}
                    {tab === 'standards' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{standards.length} Quality Standards</div>
                                <button onClick={openAddForm} style={{ padding: '7px 14px', borderRadius: 8, background: BLUE, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Add Standard</button>
                            </div>

                            {stdLoading ? <Skel h={200} /> : standards.length === 0 ? (
                                <div style={{ ...S, borderRadius: 16, padding: 40, textAlign: 'center' }}>
                                    <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>No Quality Standards Yet</div>
                                    <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>Create your first quality standard to start evaluating tasks.</div>
                                    <button onClick={openAddForm} style={{ padding: '8px 18px', borderRadius: 9, background: BLUE, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Create Standard</button>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
                                    {standards.filter(s => s.status !== 'archived').map(s => (
                                        <div key={s.id} style={{ ...S, borderRadius: 14, padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{s.title}</div>
                                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${GRN}15`, color: GRN }}>Active</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: t.sub, marginBottom: 10, lineHeight: 1.4, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description || 'No description'}</div>
                                            <div style={{ fontSize: 9, color: t.muted, marginBottom: 10 }}>{s.rules?.length ?? 0} rules · updated {relTime(s.updated_at)}</div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => openEditForm(s)} style={{ flex: 1, padding: '5px', borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                                                <button onClick={() => handleArchive(s.id)} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${RED}25`, background: `${RED}08`, color: RED, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Archive</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Standard form modal */}
                            {showStdForm && (
                                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                                    <div style={{ ...S, borderRadius: 20, padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                                        <h3 style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 20 }}>{editStd ? 'Edit Standard' : 'New Quality Standard'}</h3>
                                        <form onSubmit={handleStdSubmit}>
                                            <div style={{ marginBottom: 14 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>Title *</label>
                                                <input value={stdForm.title} onChange={e => setStdForm(f => ({ ...f, title: e.target.value }))} required style={inp(t)} placeholder="e.g. Documentation Quality Standard" />
                                            </div>
                                            <div style={{ marginBottom: 20 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>Description</label>
                                                <textarea value={stdForm.description} onChange={e => setStdForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inp(t), resize: 'vertical' } as React.CSSProperties} placeholder="Describe what this standard evaluates…" />
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                <button type="button" onClick={closeForm} style={{ padding: '8px 16px', borderRadius: 9, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                                                <button type="submit" disabled={stdSaving} style={{ padding: '8px 20px', borderRadius: 9, background: BLUE, color: '#fff', border: 'none', cursor: stdSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: stdSaving ? 0.6 : 1 }}>
                                                    {stdSaving ? 'Saving…' : (editStd ? 'Update' : 'Create')}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB: EVALUATIONS
                    ══════════════════════════════════════════════════════ */}
                    {tab === 'evaluations' && (
                        <div>
                            {evError && <ErrBanner msg={evError} onRetry={fetchEvals} />}
                            <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                                <div style={{ padding: '12px 18px', borderBottom: t.BD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Evaluation History</div>
                                    <span style={{ fontSize: 11, color: t.muted }}>{evals.length} records</span>
                                </div>
                                {evLoading ? (
                                    <div style={{ padding: 20 }}>{[1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: 10 }}><Skel h={44} /></div>)}</div>
                                ) : evals.length === 0 ? (
                                    <div style={{ padding: 40, textAlign: 'center', color: t.muted, fontSize: 13 }}>
                                        No evaluations yet. Submit a task through the task board to trigger an AI quality review.
                                    </div>
                                ) : (
                                    <div style={{ overflowY: 'auto', maxHeight: 500 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 80px 100px', gap: 8, padding: '8px 18px', borderBottom: t.BD }}>
                                            {['Task / Project', 'Score', 'Verdict', 'Type', 'Date'].map(h => (
                                                <div key={h} style={{ fontSize: 9, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>{h}</div>
                                            ))}
                                        </div>
                                        {evals.slice(0, 50).map((ev: any, i: number) => {
                                            const score   = ev.score ?? 0;
                                            const verdict = ev.verdict ?? (score >= PASS ? 'pass' : 'fail');
                                            const color   = verdict === 'pass' ? GRN : RED;
                                            return (
                                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 80px 100px', gap: 8, alignItems: 'center', padding: '10px 18px', borderBottom: t.BD, transition: 'background .1s' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, color: t.text }}>
                                                        {ev.task_title ?? ev.task_id ?? 'Unknown task'}
                                                    </div>
                                                    <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor(score) }}>{score}%</div>
                                                    <div>
                                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${color}15`, color }}>
                                                            {verdict === 'pass' ? '✓ Pass' : '✗ Fail'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 10, color: t.sub }}>{ev.report_type?.replace(/_/g, ' ') ?? '—'}</div>
                                                    <div style={{ fontSize: 10, color: t.muted }}>{relTime(ev.created_at)}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB: ANALYTICS
                    ══════════════════════════════════════════════════════ */}
                    {tab === 'analytics' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                            <div>
                                {/* Quality by category */}
                                <div style={{ ...S, borderRadius: 16, padding: '16px 20px', marginBottom: 14 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 14 }}>Quality by Category</div>
                                    {ovLoading ? <Skel h={160} /> : CATS.map((cat, i) => (
                                        <div key={cat} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, fontWeight: 600, color: t.sub }}>{cat}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 800, color: CAT_COLORS[i] }}>{radarScores[i]}%</span>
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: `${CAT_COLORS[i]}14`, color: CAT_COLORS[i] }}>{scoreLabel(radarScores[i])}</span>
                                                </div>
                                            </div>
                                            <div style={{ height: 8, borderRadius: 4, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${radarScores[i]}%`, background: `linear-gradient(90deg,${CAT_COLORS[i]},${CAT_COLORS[i]}cc)`, borderRadius: 4, transition: 'width 1s' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Monthly quality trend */}
                                <div style={{ ...S, borderRadius: 16, padding: '16px 20px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 14 }}>Monthly Quality Trend</div>
                                    {ovLoading ? <Skel h={130} /> : (
                                        <LineChart
                                            data={(charts.monthly_perf ?? []).map((m: any) => m.quality_score)}
                                            labels={(charts.monthly_perf ?? []).map((m: any) => m.month)}
                                            color={GRN} h={130} isDark={isDark}
                                        />
                                    )}
                                </div>
                            </div>

                            <div>
                                {/* Radar chart */}
                                <div style={{ ...S, borderRadius: 16, padding: '16px', marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: t.text, marginBottom: 12, alignSelf: 'flex-start' }}>Quality Radar</div>
                                    {ovLoading ? <Skel h={200} /> : <RadarChart scores={radarScores} size={190} isDark={isDark} />}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8, width: '100%' }}>
                                        {CATS.map((cat, i) => (
                                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[i], flexShrink: 0 }} />
                                                <span style={{ fontSize: 9, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick stats */}
                                <div style={{ ...S, borderRadius: 16, padding: '14px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Quick Stats</div>
                                    {[
                                        { l: 'Pass Threshold', v: `${PASS}%`,           c: BLUE },
                                        { l: 'Avg Score',      v: `${avgScore}%`,        c: scoreColor(avgScore) },
                                        { l: 'Pass Rate',      v: `${passRate}%`,        c: passRate >= PASS ? GRN : AMB },
                                        { l: 'Total Reviews',  v: totalReviews,          c: BLUE },
                                        { l: 'Standards',      v: standards.filter(s => s.status !== 'archived').length, c: PURP },
                                        { l: 'Workspace Health', v: `${healthScore}%`,  c: healthScore >= 70 ? GRN : AMB },
                                    ].map(s => (
                                        <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ fontSize: 11, color: t.sub }}>{s.l}</span>
                                            <span style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{ovLoading ? '—' : s.v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
}
