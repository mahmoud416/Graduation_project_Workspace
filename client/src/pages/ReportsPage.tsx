/**
 * Orbit Reports Center — Enterprise Analytics Dashboard
 * Fetches real data from /analytics/platform-overview.
 * Auto-seeds demo data when the platform is empty.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const ah  = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'X-User-Id':   localStorage.getItem('userId') ?? '',
    'Content-Type': 'application/json',
});

/* ── colour palette ─────────────────────────────────────────────────────── */
const C = {
    indigo: '#6366f1', green: '#10b981', amber: '#f59e0b',
    red: '#ef4444',    purple: '#8b5cf6', cyan: '#06b6d4',
    blue: '#3b82f6',   orange: '#f97316',
};
const PALETTE = Object.values(C);

/* ── theme ──────────────────────────────────────────────────────────────── */
const TH = (d: boolean) => ({
    bg:    d ? '#0b0d14' : '#f0f4f8',
    surf:  d ? '#111420' : '#ffffff',
    surf2: d ? '#161924' : '#f8fafc',
    bord:  d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
    text:  d ? '#f0f4f9' : '#0f172a',
    sub:   d ? 'rgba(255,255,255,.62)' : '#334155',
    muted: d ? 'rgba(255,255,255,.28)' : '#94a3b8',
    BD:    d ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(0,0,0,.06)',
});

/* ══════════════════════════════════════════════════════════════════════════
   MICRO CHART COMPONENTS (pure SVG / CSS — zero external dependencies)
══════════════════════════════════════════════════════════════════════════ */

function Sparkline({ data, color, h = 30, w = 80 }: { data: number[]; color: string; h?: number; w?: number }) {
    if (!data || data.length < 2) return <svg width={w} height={h} />;
    const min = Math.min(...data), max = Math.max(...data), range = (max - min) || 1;
    const pts = data.map((v, i) => [i / (data.length - 1) * w, h - ((v - min) / range) * (h - 4) - 2] as [number, number]);
    const line = pts.map(([x, y]) => `${x},${y}`).join(' L ');
    const gid  = `sp${color.replace(/[^a-z0-9]/gi, '')}${w}`;
    return (
        <svg width={w} height={h} style={{ overflow: 'visible', flexShrink: 0 }}>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={`M ${pts[0]} L ${line} L ${w},${h} L 0,${h} Z`} fill={`url(#${gid})`} />
            <path d={`M ${line}`} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
        </svg>
    );
}

function ProgressRing({ pct, color, size = 52 }: { pct: number; color: string; size?: number }) {
    const thick = size * 0.1, r = (size - thick) / 2, c = 2 * Math.PI * r, cx = size / 2;
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={`${color}22`} strokeWidth={thick} />
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={thick}
                strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, pct)) / 100)}
                strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`} />
            <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" fill={color}
                fontSize={size * .22} fontWeight="800">{pct}%</text>
        </svg>
    );
}

function StatusDonut({ segs, size = 140 }: { segs: { v: number; c: string; l: string }[]; size?: number }) {
    const total = segs.reduce((s, x) => s + x.v, 0) || 1;
    const thick = size * 0.18, r = (size - thick) / 2, circ = 2 * Math.PI * r, cx = size / 2;
    let acc = 0;
    return (
        <svg width={size} height={size}>
            {segs.map((seg, i) => {
                const pct = seg.v / total;
                const rot = -90 + acc * 360; acc += pct;
                return (
                    <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={seg.c} strokeWidth={thick}
                        strokeDasharray={`${circ * pct - 1.5} ${circ * (1 - pct) + 1.5}`}
                        strokeDashoffset={circ * 0.25} transform={`rotate(${rot} ${cx} ${cx})`} strokeLinecap="butt" />
                );
            })}
            <text x={cx} y={cx - 4} textAnchor="middle" fill="white" fontSize={size * .2} fontWeight="900">{total}</text>
            <text x={cx} y={cx + size * .13} textAnchor="middle" fill="rgba(255,255,255,.35)" fontSize={size * .085}>tasks</text>
        </svg>
    );
}

function LineChart({ data, labels, color, h = 120 }: { data: (number | null)[]; labels?: string[]; color: string; h?: number }) {
    const valid = data.filter(v => v !== null) as number[];
    if (valid.length < 2) return (
        <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(148,163,184,.4)', fontSize: 12 }}>
            No trend data yet
        </div>
    );
    const W = 800;
    const min = Math.min(...valid), max = Math.max(...valid), range = (max - min) || 1;
    const pts: [number, number][] = data.map((v, i) => [
        (i / (data.length - 1)) * W,
        v === null ? -1 : h - ((v - min) / range) * (h - 24) - 4,
    ]);
    const validPts = pts.filter((_, i) => data[i] !== null);
    const linePath = `M ${validPts.map(([x, y]) => `${x},${y}`).join(' L ')}`;
    const areaPath = `M 0,${h} L ${validPts.map(([x, y]) => `${x},${y}`).join(' L ')} L ${W},${h} Z`;
    const gid = `lc${color.replace(/[^a-z0-9]/gi, '')}`;
    return (
        <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: h, overflow: 'visible' }}>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f, i) => (
                <line key={i} x1="0" y1={h - f * (h - 24) - 4} x2={W} y2={h - f * (h - 24) - 4} stroke="rgba(148,163,184,.07)" strokeWidth="1" />
            ))}
            <path d={areaPath} fill={`url(#${gid})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {validPts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i === validPts.length - 1 ? 4 : 2.5} fill={color} opacity={i === validPts.length - 1 ? 1 : 0.6} />
            ))}
            {labels && pts.map(([x], i) => (
                <text key={i} x={x} y={h + 14} textAnchor="middle" fill="rgba(148,163,184,.5)" fontSize="9">{labels[i]}</text>
            ))}
        </svg>
    );
}

function MultiLineChart({ series, labels, h = 140 }: {
    series: { data: number[]; color: string; label: string }[];
    labels?: string[];
    h?: number;
}) {
    const allValues = series.flatMap(s => s.data);
    if (allValues.length === 0) return <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(148,163,184,.4)', fontSize: 12 }}>No data</div>;
    const W = 800;
    const min = Math.min(...allValues, 0), max = Math.max(...allValues, 1), range = (max - min) || 1;
    const toY = (v: number) => h - ((v - min) / range) * (h - 24) - 4;
    const n = series[0]?.data.length || 1;
    return (
        <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: h, overflow: 'visible' }}>
            {[0.25, 0.5, 0.75].map((f, i) => (
                <line key={i} x1="0" y1={toY(min + f * range)} x2={W} y2={toY(min + f * range)} stroke="rgba(148,163,184,.07)" strokeWidth="1" />
            ))}
            {series.map((s, si) => {
                const pts = s.data.map((v, i) => `${(i / (n - 1)) * W},${toY(v)}`).join(' L ');
                return (
                    <g key={si}>
                        <path d={`M ${pts}`} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        {s.data.map((v, i) => (
                            <circle key={i} cx={(i / (n - 1)) * W} cy={toY(v)} r="2.5" fill={s.color} opacity="0.8" />
                        ))}
                    </g>
                );
            })}
            {labels && labels.map((l, i) => (
                <text key={i} x={(i / (n - 1)) * W} y={h + 14} textAnchor="middle" fill="rgba(148,163,184,.5)" fontSize="9">{l}</text>
            ))}
        </svg>
    );
}

function BarChart({ bars, h = 140, isDark }: { bars: { l: string; v: number; c: string }[]; h?: number; isDark: boolean }) {
    if (!bars.length) return <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? 'rgba(255,255,255,.2)' : '#94a3b8', fontSize: 11 }}>No data</div>;
    const max = Math.max(...bars.map(b => b.v), 1);
    const bw = 54, gap = 16, vbW = bars.length * (bw + gap) - gap;
    return (
        <svg viewBox={`0 0 ${vbW} ${h}`} preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: h, overflow: 'visible' }}>
            {bars.map((bar, i) => {
                const bh = Math.max((bar.v / max) * (h - 28), 2);
                const x = i * (bw + gap), y = h - 20 - bh;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={bw} height={bh} rx={7} fill={bar.c} opacity={0.85} />
                        <rect x={x} y={y} width={bw} height={Math.min(7, bh)} rx={4} fill={bar.c} />
                        <text x={x + bw / 2} y={y - 5} textAnchor="middle" fill={bar.c} fontSize={12} fontWeight="900">{bar.v}</text>
                        <text x={x + bw / 2} y={h - 2} textAnchor="middle" fill={isDark ? 'rgba(255,255,255,.3)' : '#94a3b8'} fontSize={9} fontWeight="600">
                            {bar.l.length > 9 ? bar.l.slice(0, 8) + '…' : bar.l}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function HorizBar({ label, value, max, color, isDark }: { label: string; value: number; max: number; color: string; isDark: boolean }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const t = TH(isDark);
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.sub }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}cc)`, borderRadius: 4, transition: 'width .8s' }} />
            </div>
        </div>
    );
}

/* ── Loading skeleton ── */
function CardSkeleton({ h = 120 }: { h?: number }) {
    return (
        <div style={{ borderRadius: 14, background: 'rgba(99,102,241,.04)', border: '1px solid rgba(99,102,241,.08)', height: h, animation: 'pulse 1.5s ease-in-out infinite' }}>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
    );
}

/* ── Error banner ── */
function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ flex: 1, fontSize: 13, color: '#ef4444' }}>{msg}</span>
            <button onClick={onRetry} style={{ padding: '5px 12px', borderRadius: 7, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Retry</button>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   PDF PRINT STYLES
══════════════════════════════════════════════════════════════════════════ */
const PDF_CSS = `
@media print {
    html,body{background:white!important;margin:0!important;padding:0!important;}
    #root{display:none!important;}
    #orbit-print-report{display:block!important;width:100%!important;}
    @page{size:A4 portrait;margin:12mm;}
    .pdf-page{page-break-after:always;break-after:page;}
    .pdf-page:last-child{page-break-after:avoid;break-after:avoid;}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
}
#orbit-print-report{display:none;}
`;

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
const ReportsPage = () => {
    const isDark   = document.documentElement.classList.contains('dark');
    const th       = TH(isDark);
    const S        = { background: th.surf, border: `1px solid ${th.bord}` };
    const styleRef = useRef<HTMLStyleElement | null>(null);

    /* ── state ── */
    const [data,      setData]      = useState<any>(null);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState<string | null>(null);
    const [seeding,   setSeeding]   = useState(false);
    const [selStatus, setSelStatus] = useState<string>('all');
    const [selPrio,   setSelPrio]   = useState<string>('all');

    /* inject print CSS */
    useEffect(() => {
        const el = document.createElement('style');
        el.textContent = PDF_CSS;
        document.head.appendChild(el);
        styleRef.current = el;
        return () => { el.remove(); };
    }, []);

    /* ── fetch overview data ── */
    const fetchData = useCallback(async (triggerSeed = false) => {
        setLoading(true);
        setError(null);
        try {
            if (triggerSeed) {
                setSeeding(true);
                await fetch(`${API}/analytics/seed-demo`, { method: 'POST', headers: ah() }).catch(() => null);
                setSeeding(false);
            }
            const res = await fetch(`${API}/analytics/platform-overview`, { headers: ah() });
            if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
            const json = await res.json();
            setData(json);

            /* auto-seed if completely empty */
            if (!triggerSeed && json?.kpis?.total_projects === 0 && json?.kpis?.total_tasks === 0) {
                void fetchData(true);
                return;
            }
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load report data. Check your connection.');
        } finally {
            setLoading(false);
            setSeeding(false);
        }
    }, []);

    useEffect(() => { void fetchData(); }, [fetchData]);

    /* ── derived ── */
    const kpis         = data?.kpis     ?? {};
    const charts       = data?.charts   ?? {};
    const projects     = data?.projects ?? [];
    const activity     = data?.activity_feed ?? [];
    const quality      = data?.quality  ?? {};

    const filteredProjects = useMemo(() => {
        let list = [...projects];
        if (selStatus !== 'all') list = list.filter((p: any) => (p.status ?? '').toLowerCase() === selStatus);
        if (selPrio   !== 'all') list = list.filter((p: any) => (p.priority ?? '') === selPrio);
        return list;
    }, [projects, selStatus, selPrio]);

    /* sparklines from kpi trends */
    const trend = (base: number, n = 6): number[] =>
        Array.from({ length: n }, (_, i) => Math.max(0, base - (n - 1 - i) * Math.ceil(base * 0.04)));

    /* ── CSV export ── */
    const exportCSV = () => {
        const headers = ['Project', 'Status', 'Progress%', 'Health', 'Tasks', 'Done Tasks', 'AI Score', 'Due Date', 'Priority'];
        const rows = filteredProjects.map((p: any) => [
            `"${p.title}"`,
            p.status,
            p.progress,
            p.health_label,
            p.task_count,
            p.done_tasks,
            p.ai_score ?? 'N/A',
            p.due_date ? new Date(p.due_date).toLocaleDateString() : 'N/A',
            p.priority,
        ]);
        const totalRow = ['TOTALS', '', kpis.avg_progress ?? '', '', kpis.total_tasks ?? '', kpis.done_tasks ?? '', kpis.avg_quality_score ?? '', '', ''];
        const csv = [headers, ...rows, [], totalRow].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `orbit-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    /* ── print PDF ── */
    const exportPDF = () => window.print();

    /* ── task status donut segments ── */
    const taskSegs = [
        { l: 'To Do',       v: charts.task_status_dist?.todo        ?? 0, c: C.indigo },
        { l: 'In Progress', v: charts.task_status_dist?.in_progress ?? 0, c: C.amber },
        { l: 'Review',      v: charts.task_status_dist?.review      ?? 0, c: C.purple },
        { l: 'Done',        v: charts.task_status_dist?.done        ?? 0, c: C.green },
        { l: 'Overdue',     v: charts.task_status_dist?.overdue     ?? 0, c: C.red },
    ].filter(s => s.v > 0);

    /* ── monthly multi-line series ── */
    const monthlyLabels  = (charts.monthly_perf ?? []).map((m: any) => m.month);
    const multiLineSeries = [
        { data: (charts.monthly_perf ?? []).map((m: any) => m.tasks_completed), color: C.indigo, label: 'Tasks Done' },
        { data: (charts.monthly_perf ?? []).map((m: any) => m.quality_score),   color: C.green,  label: 'Quality Score' },
        { data: (charts.monthly_perf ?? []).map((m: any) => m.reviews),         color: C.purple, label: 'Reviews' },
    ];

    /* ── progress trend ── */
    const progressTrendData   = (charts.progress_trend ?? []).map((p: any) => p.progress);
    const progressTrendLabels = (charts.progress_trend ?? []).map((p: any) => p.month);

    /* ── AI score trend ── */
    const aiTrendData   = (charts.ai_score_trend ?? []).map((d: any) => d.score);
    const aiTrendLabels = (charts.ai_score_trend ?? []).map((d: any) => d.day);

    /* ── team productivity bars ── */
    const teamBars = (charts.monthly_perf ?? []).map((m: any, i: number) => ({
        l: m.month, v: m.tasks_completed, c: PALETTE[i % PALETTE.length],
    }));

    /* ── health distribution bars ── */
    const healthDist = charts.health_dist ?? {};
    const healthMax  = Math.max(...Object.values(healthDist as Record<string, number>), 1);

    /* ── AI insights ── */
    const insights = useMemo((): { icon: string; color: string; title: string; body: string }[] => {
        if (!kpis.total_projects) return [];
        const list: { icon: string; color: string; title: string; body: string }[] = [];
        const cr = kpis.completion_rate ?? 0;
        const qr = kpis.quality_pass_rate ?? 0;
        const od = kpis.overdue_tasks ?? 0;
        const hp = kpis.health_score ?? 0;

        if (od > 0) list.push({ icon: '🚨', color: C.red, title: 'Overdue Task Alert', body: `${od} task${od > 1 ? 's are' : ' is'} past deadline. Immediate team intervention required.` });
        if (cr >= 30) list.push({ icon: '🏆', color: C.green, title: 'Completion Milestone', body: `${cr}% of projects completed. Workspace is on track with delivery goals.` });
        if (hp >= 70) list.push({ icon: '💪', color: C.green, title: 'Strong Workspace Health', body: `Platform health score ${hp}/100 — excellent execution across all teams.` });
        else if (hp < 50) list.push({ icon: '⚠️', color: C.amber, title: 'Health Score Below 50', body: `Workspace health is ${hp}/100. Review blocked and at-risk projects urgently.` });
        if (qr >= 80) list.push({ icon: '🤖', color: C.purple, title: 'High Quality Pass Rate', body: `${qr}% of AI quality reviews passed. Documentation standards are being maintained.` });
        else if (qr < 70 && qr > 0) list.push({ icon: '📋', color: C.amber, title: 'Quality Improvement Needed', body: `Quality pass rate ${qr}% is below the 70% target. Focus on documentation completeness.` });
        if ((kpis.active_projects ?? 0) > (kpis.completed_projects ?? 0)) list.push({ icon: '📈', color: C.cyan, title: 'Active Sprint Underway', body: `${kpis.active_projects} active projects running simultaneously. Ensure resource balance across teams.` });
        return list.slice(0, 4);
    }, [kpis]);

    /* ── now/date ── */
    const reportDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const reportTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    /* ══ KPI CARD DATA ═══════════════════════════════════════════════════════ */
    const kpiCards = [
        { l: 'Total Projects',    v: kpis.total_projects    ?? 0, c: C.indigo,  spark: trend(kpis.total_projects ?? 0) },
        { l: 'Active Projects',   v: kpis.active_projects   ?? 0, c: C.green,   spark: trend(kpis.active_projects ?? 0) },
        { l: 'Completed',         v: kpis.completed_projects ?? 0, c: C.blue,   spark: trend(kpis.completed_projects ?? 0) },
        { l: 'On Hold',           v: kpis.on_hold_projects  ?? 0, c: C.amber,   spark: trend(kpis.on_hold_projects ?? 0) },
        { l: 'Total Tasks',       v: kpis.total_tasks       ?? 0, c: C.purple,  spark: trend(kpis.total_tasks ?? 0) },
        { l: 'Tasks Completed',   v: kpis.done_tasks        ?? 0, c: C.green,   spark: trend(kpis.done_tasks ?? 0) },
        { l: 'Quality Pass Rate', v: `${kpis.quality_pass_rate ?? 0}%`, c: kpis.quality_pass_rate >= 80 ? C.green : C.amber, spark: trend(kpis.quality_pass_rate ?? 0) },
        { l: 'Workspace Health',  v: `${kpis.health_score ?? 0}%`, c: kpis.health_score >= 70 ? C.green : kpis.health_score >= 40 ? C.amber : C.red, spark: trend(kpis.health_score ?? 0) },
    ];

    /* ════════════════════════════════════════════════════════════════════════
       PDF PRINT LAYOUT
    ════════════════════════════════════════════════════════════════════════ */
    const PrintReport = () => createPortal(
        <div id="orbit-print-report">
            {/* Cover page */}
            <div className="pdf-page" style={{ fontFamily: 'Arial,sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(135deg,#1e1b4b,#312e81,#1e40af)', color: '#fff', padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
                <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>Orbit Platform</div>
                <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-0.02em' }}>Executive Analytics Report</h1>
                <div style={{ width: 60, height: 3, background: '#6366f1', borderRadius: 2, margin: '0 auto 24px' }} />
                <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 400, lineHeight: 1.6 }}>
                    Comprehensive platform performance overview including project health, task analytics, team productivity, and quality assurance metrics.
                </p>
                <div style={{ marginTop: 40, padding: '12px 24px', borderRadius: 8, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)' }}>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{reportDate}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{reportTime}</div>
                </div>
            </div>

            {/* Metrics page */}
            <div className="pdf-page" style={{ fontFamily: 'Arial,sans-serif', padding: 40, background: '#fff' }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1e1b4b', borderBottom: '2px solid #6366f1', paddingBottom: 8, marginBottom: 24 }}>Executive Summary</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
                    {kpiCards.map(k => (
                        <div key={k.l} style={{ padding: 16, borderRadius: 8, border: `2px solid ${k.c}`, background: `${k.c}0a` }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{k.l}</div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: k.c }}>{k.v}</div>
                        </div>
                    ))}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e1b4b', marginBottom: 16 }}>Project Portfolio</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                            {['Project', 'Status', 'Progress', 'Health', 'Tasks', 'Quality', 'Due Date'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {projects.slice(0, 15).map((p: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '7px 12px', fontWeight: 600, color: '#1f2937' }}>{p.title}</td>
                                <td style={{ padding: '7px 12px', color: p.status === 'COMPLETED' ? '#10b981' : p.status === 'ON_HOLD' ? '#ef4444' : '#6366f1' }}>{p.status}</td>
                                <td style={{ padding: '7px 12px', fontWeight: 700, color: p.progress >= 70 ? '#10b981' : '#f59e0b' }}>{p.progress}%</td>
                                <td style={{ padding: '7px 12px', color: p.health_color }}>{p.health_label}</td>
                                <td style={{ padding: '7px 12px' }}>{p.task_count}</td>
                                <td style={{ padding: '7px 12px', color: (p.ai_score ?? 0) >= 85 ? '#10b981' : '#f59e0b' }}>{p.ai_score != null ? `${p.ai_score}%` : '—'}</td>
                                <td style={{ padding: '7px 12px', color: '#6b7280' }}>{p.due_date ? new Date(p.due_date).toLocaleDateString() : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Quality page */}
            <div className="pdf-page" style={{ fontFamily: 'Arial,sans-serif', padding: 40, background: '#fff' }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1e1b4b', borderBottom: '2px solid #10b981', paddingBottom: 8, marginBottom: 24 }}>Quality Assurance Metrics</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 32 }}>
                    {[
                        { l: 'Total Reviews',    v: quality.total_reviews ?? 0, c: '#6366f1' },
                        { l: 'Reviews Passed',   v: quality.pass_count ?? 0, c: '#10b981' },
                        { l: 'Reviews Failed',   v: quality.fail_count ?? 0, c: '#ef4444' },
                        { l: 'Pass Rate',        v: `${quality.pass_rate ?? 0}%`, c: '#10b981' },
                        { l: 'Avg Quality Score',v: `${quality.avg_score ?? 0}%`, c: '#8b5cf6' },
                        { l: 'Workspace Health', v: `${kpis.health_score ?? 0}%`, c: '#06b6d4' },
                    ].map(m => (
                        <div key={m.l} style={{ padding: 20, borderRadius: 8, border: `1px solid ${m.c}33`, background: `${m.c}0a`, textAlign: 'center' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{m.l}</div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: m.c }}>{m.v}</div>
                        </div>
                    ))}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e1b4b', marginBottom: 12 }}>AI Insights</h3>
                {insights.map((ins, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${ins.color}22`, background: `${ins.color}08`, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ins.color }}>{ins.icon} {ins.title}</span>
                        <p style={{ fontSize: 11, color: '#374151', margin: '4px 0 0' }}>{ins.body}</p>
                    </div>
                ))}
                <div style={{ marginTop: 32, padding: 16, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>Generated by Orbit Analytics Engine</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{reportDate} · {reportTime}</div>
                </div>
            </div>
        </div>,
        document.body
    );

    /* ════════════════════════════════════════════════════════════════════════
       RENDER
    ════════════════════════════════════════════════════════════════════════ */
    return (
        <>
            <PrintReport />
            <div style={{ display: 'flex', minHeight: '100vh', background: th.bg }}>
                <Sidebar />
                <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', transition: 'margin .22s', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Header title="Reports Center" />
                    <main className="page-main" style={{ padding: '20px 24px', background: th.bg, minHeight: '100vh', fontFamily: '"Inter",-apple-system,sans-serif' }}>

                        {/* ── HEADER ── */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <h1 style={{ fontSize: 22, fontWeight: 900, color: th.text, marginBottom: 3, letterSpacing: '-.02em' }}>Reports Center</h1>
                                <div style={{ fontSize: 12, color: th.muted }}>{reportDate} · Last refreshed at {reportTime}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {/* Filters */}
                                {(['all','ACTIVE','COMPLETED','ON_HOLD'] as const).map(s => (
                                    <button key={s} onClick={() => setSelStatus(s)}
                                        style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${selStatus === s ? C.indigo : th.bord}`, background: selStatus === s ? C.indigo : 'transparent', color: selStatus === s ? '#fff' : th.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                        {s === 'all' ? 'All' : s.replace('_', ' ')}
                                    </button>
                                ))}
                                <div style={{ width: 1, background: th.bord, margin: '0 4px' }} />
                                <button onClick={exportCSV}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.green}40`, background: `${C.green}12`, color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                    ↓ CSV
                                </button>
                                <button onClick={exportPDF}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.purple}40`, background: `${C.purple}12`, color: C.purple, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                    ↓ PDF
                                </button>
                                <button onClick={() => fetchData(false)}
                                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${th.bord}`, background: 'transparent', color: th.muted, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    ↻
                                </button>
                            </div>
                        </div>

                        {/* Error state */}
                        {error && <ErrorBanner msg={error} onRetry={() => fetchData()} />}

                        {/* Seeding indicator */}
                        {seeding && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: `${C.indigo}12`, border: `1px solid ${C.indigo}25`, marginBottom: 16 }}>
                                <div style={{ width: 14, height: 14, border: `2px solid ${C.indigo}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                                <span style={{ fontSize: 13, color: C.indigo, fontWeight: 600 }}>Seeding demo data for first run…</span>
                            </div>
                        )}

                        {/* ── KPI GRID ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                            {kpiCards.map(k => (
                                <div key={k.l} style={{ ...S, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 86 }}>
                                    <div style={{ fontSize: 9, color: th.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{k.l}</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                        {loading
                                            ? <div style={{ height: 30, width: 60, borderRadius: 6, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }} />
                                            : <div style={{ fontSize: 26, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
                                        }
                                        {!loading && <Sparkline data={k.spark} color={k.c} h={28} w={56} />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── ROW 2: Progress Trend + Task Distribution ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>

                            {/* Progress Trend */}
                            <div style={{ ...S, borderRadius: 16, padding: '18px 20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>Project Progress Trend</div>
                                        <div style={{ fontSize: 10, color: th.muted, marginTop: 2 }}>12-month average completion across all projects</div>
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${C.indigo}14`, color: C.indigo }}>12 months</span>
                                </div>
                                {loading
                                    ? <CardSkeleton h={130} />
                                    : <LineChart data={progressTrendData} labels={progressTrendLabels} color={C.indigo} h={130} />
                                }
                            </div>

                            {/* Task Status Donut */}
                            <div style={{ ...S, borderRadius: 16, padding: '18px 20px' }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: th.text, marginBottom: 4 }}>Task Distribution</div>
                                <div style={{ fontSize: 10, color: th.muted, marginBottom: 14 }}>Current status breakdown</div>
                                {loading ? <CardSkeleton h={160} /> : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <StatusDonut segs={taskSegs} size={130} />
                                        <div style={{ flex: 1 }}>
                                            {taskSegs.map(seg => (
                                                <div key={seg.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: seg.c }} />
                                                        <span style={{ fontSize: 11, color: th.sub }}>{seg.l}</span>
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: 800, color: seg.c }}>{seg.v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── ROW 3: Team Productivity + Project Health ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

                            {/* Team Productivity Bar Chart */}
                            <div style={{ ...S, borderRadius: 16, padding: '18px 20px' }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: th.text, marginBottom: 4 }}>Team Productivity</div>
                                <div style={{ fontSize: 10, color: th.muted, marginBottom: 14 }}>Tasks completed per month</div>
                                {loading ? <CardSkeleton h={150} /> : <BarChart bars={teamBars} h={150} isDark={isDark} />}
                            </div>

                            {/* Project Health Distribution */}
                            <div style={{ ...S, borderRadius: 16, padding: '18px 20px' }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: th.text, marginBottom: 4 }}>Project Health Distribution</div>
                                <div style={{ fontSize: 10, color: th.muted, marginBottom: 16 }}>Current health status of all projects</div>
                                {loading ? <CardSkeleton h={150} /> : (
                                    <div>
                                        {[
                                            { l: 'Healthy',   v: healthDist.Healthy   ?? 0, c: C.green  },
                                            { l: 'At Risk',   v: healthDist['At Risk'] ?? 0, c: C.amber  },
                                            { l: 'Blocked',   v: healthDist.Blocked   ?? 0, c: C.red    },
                                            { l: 'Completed', v: healthDist.Completed ?? 0, c: C.blue   },
                                        ].map(item => (
                                            <HorizBar key={item.l} label={item.l} value={item.v} max={healthMax} color={item.c} isDark={isDark} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── ROW 4: Monthly Performance + Quality Trend ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

                            {/* Monthly Performance Multi-line */}
                            <div style={{ ...S, borderRadius: 16, padding: '18px 20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>Monthly Performance</div>
                                        <div style={{ fontSize: 10, color: th.muted, marginTop: 2 }}>Tasks, quality, and reviews per month</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {multiLineSeries.map(s => (
                                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                                                <span style={{ fontSize: 9, color: th.muted, fontWeight: 600 }}>{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {loading ? <CardSkeleton h={140} /> : <MultiLineChart series={multiLineSeries} labels={monthlyLabels} h={140} />}
                            </div>

                            {/* AI Quality Score Trend */}
                            <div style={{ ...S, borderRadius: 16, padding: '18px 20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>Quality Score Trend</div>
                                        <div style={{ fontSize: 10, color: th.muted, marginTop: 2 }}>7-day AI review score average</div>
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: `${C.green}14`, color: C.green }}>
                                        {kpis.avg_quality_score ?? 0}% avg
                                    </span>
                                </div>
                                {loading ? <CardSkeleton h={140} /> : <LineChart data={aiTrendData} labels={aiTrendLabels} color={C.green} h={140} />}
                            </div>
                        </div>

                        {/* ── ROW 5: Projects Table + Activity ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>

                            {/* Projects Table */}
                            <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: th.BD }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>Project Overview</div>
                                        <div style={{ fontSize: 10, color: th.muted, marginTop: 2 }}>{filteredProjects.length} projects shown</div>
                                    </div>
                                    {/* Priority filter */}
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {(['all','high','medium','low'] as const).map(p => (
                                            <button key={p} onClick={() => setSelPrio(p)}
                                                style={{ padding: '4px 9px', borderRadius: 7, border: `1px solid ${selPrio === p ? C.indigo : th.bord}`, background: selPrio === p ? `${C.indigo}15` : 'transparent', color: selPrio === p ? C.indigo : th.muted, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {loading ? (
                                    <div style={{ padding: 20 }}>{[1,2,3,4,5].map(i => <CardSkeleton key={i} h={44} />).map((el, i) => <div key={i} style={{ marginBottom: 8 }}>{el}</div>)}</div>
                                ) : filteredProjects.length === 0 ? (
                                    <div style={{ padding: 40, textAlign: 'center', color: th.muted, fontSize: 13 }}>No projects match the selected filters.</div>
                                ) : (
                                    <div style={{ overflowY: 'auto', maxHeight: 340 }}>
                                        {/* Header row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px 64px 70px', gap: 8, padding: '8px 18px', borderBottom: th.BD }}>
                                            {['Project', 'Status', 'Progress', 'Health', 'Tasks', 'Quality'].map(h => (
                                                <div key={h} style={{ fontSize: 9, fontWeight: 700, color: th.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</div>
                                            ))}
                                        </div>
                                        {filteredProjects.slice(0, 15).map((p: any, i: number) => (
                                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px 64px 70px', gap: 8, alignItems: 'center', padding: '10px 18px', borderBottom: th.BD, transition: 'background .1s' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.015)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                                <div>
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                                                        background: p.status === 'COMPLETED' ? `${C.green}15` : p.status === 'ON_HOLD' ? `${C.red}15` : `${C.indigo}15`,
                                                        color:      p.status === 'COMPLETED' ? C.green : p.status === 'ON_HOLD' ? C.red : C.indigo,
                                                    }}>{p.status?.replace('_', ' ')}</span>
                                                </div>
                                                <div style={{ fontSize: 12, fontWeight: 800, color: p.progress >= 70 ? C.green : p.progress >= 40 ? C.amber : C.red }}>{p.progress}%</div>
                                                <div>
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${p.health_color}15`, color: p.health_color }}>{p.health_label}</span>
                                                </div>
                                                <div style={{ fontSize: 12, color: th.sub }}>{p.task_count}</div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: (p.ai_score ?? 0) >= 85 ? C.green : C.amber }}>
                                                    {p.ai_score != null ? `${p.ai_score}%` : '—'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Activity Feed */}
                            <div style={{ ...S, borderRadius: 16, overflow: 'hidden' }}>
                                <div style={{ padding: '14px 16px', borderBottom: th.BD }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: th.text }}>Activity Center</div>
                                    <div style={{ fontSize: 10, color: th.muted, marginTop: 2 }}>Latest workspace events</div>
                                </div>
                                <div style={{ overflowY: 'auto', maxHeight: 340 }}>
                                    {loading ? (
                                        <div style={{ padding: 16 }}>{[1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: 10 }}><CardSkeleton h={36} /></div>)}</div>
                                    ) : activity.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', color: th.muted, fontSize: 12 }}>No recent activity.</div>
                                    ) : (
                                        activity.slice(0, 14).map((a: any, i: number) => {
                                            const actionColor: Record<string, string> = {
                                                project_created: C.indigo, task_completed: C.green, report_submitted: C.blue,
                                                quality_review_passed: C.green, quality_review_failed: C.red,
                                                user_registered: C.cyan, project_completed: C.green, user_login: C.purple,
                                            };
                                            const color = actionColor[a.action] ?? th.muted;
                                            return (
                                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 16px', borderBottom: th.BD }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>
                                                        {a.action?.includes('pass') ? '✅' : a.action?.includes('fail') ? '❌' : a.action?.includes('creat') ? '➕' : a.action?.includes('login') ? '👤' : '📋'}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 11, fontWeight: 600, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {a.user_name ?? 'System'}
                                                        </div>
                                                        <div style={{ fontSize: 10, color, marginTop: 1 }}>{a.action?.replace(/_/g, ' ')}</div>
                                                    </div>
                                                    <div style={{ fontSize: 9, color: th.muted, flexShrink: 0, marginTop: 1 }}>
                                                        {a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── ROW 6: AI INSIGHTS ── */}
                        {!loading && insights.length > 0 && (
                            <div style={{ ...S, borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: th.text, marginBottom: 14 }}>
                                    AI Insights
                                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: th.muted }}>Auto-generated from platform data</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
                                    {insights.map((ins, i) => (
                                        <div key={i} style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${ins.color}20`, background: `${ins.color}08` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <span style={{ fontSize: 18 }}>{ins.icon}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: ins.color }}>{ins.title}</span>
                                            </div>
                                            <p style={{ fontSize: 11, color: th.sub, margin: 0, lineHeight: 1.5 }}>{ins.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── ROW 7: Quality Score Distribution ── */}
                        {!loading && quality.score_dist && (
                            <div style={{ ...S, borderRadius: 16, padding: '18px 20px' }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: th.text, marginBottom: 4 }}>Quality Score Distribution</div>
                                <div style={{ fontSize: 10, color: th.muted, marginBottom: 16 }}>Number of reviews in each score band</div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 90 }}>
                                    {(quality.score_dist as any[]).map((d: any, i: number) => {
                                        const maxVal = Math.max(...quality.score_dist.map((x: any) => x.count), 1);
                                        const pct    = (d.count / maxVal) * 100;
                                        const colors = [C.red, C.orange, C.amber, C.green, C.cyan];
                                        return (
                                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                                <div style={{ fontSize: 11, fontWeight: 800, color: colors[i] }}>{d.count}</div>
                                                <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, background: `linear-gradient(180deg,${colors[i]},${colors[i]}aa)`, borderRadius: '4px 4px 0 0', transition: 'height .6s', minHeight: 4 }} />
                                                <div style={{ fontSize: 9, color: th.muted, whiteSpace: 'nowrap', fontWeight: 600 }}>{d.range}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </main>
                </div>
            </div>
        </>
    );
};

export default ReportsPage;
