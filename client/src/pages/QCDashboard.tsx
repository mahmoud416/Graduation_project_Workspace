import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type {
    QualityOverview,
    QualityStandard,
    QualityTrendPoint,
    CompletionTrendPoint,
} from '../types';
import {
    fetchQualityOverview,
    fetchQualityStandards,
    createQualityStandard,
    downloadQualityReport,
    fetchReportTypes,
    evaluateTask,
    fetchAIHistory,
    type CreateStandardPayload,
    type ReportType,
    type EvaluationResult,
    type AIHistoryItem,
} from '../services/qcService';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const gradientBackground = 'linear-gradient(135deg, #0f172a 0%, #111e3e 35%, #113a5c 100%)';

type RangePreset = 7 | 30 | 90;

type ToastPayload = { intent: 'success' | 'error'; message: string } | null;

interface ProjectOption {
    id: string;
    name: string;
    status?: string;
    isSystem?: boolean;
}

const DEFAULT_PROJECT_OPTIONS: ProjectOption[] = [
    { id: 'public-group', name: 'Public Group (workspace default)', isSystem: true },
    { id: 'all-sub-admin', name: 'All Sub Manager (system group)', isSystem: true },
];

const buildAuthHeaders = () => ({
    'X-User-Id': typeof window !== 'undefined' ? localStorage.getItem('userId') ?? '' : '',
    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : ''}`,
});

const formatNumber = (value: number): string =>
    Intl.NumberFormat('en', { compactDisplay: 'short', notation: 'compact' }).format(value);

const ScoreSparkline = ({ points }: { points: QualityTrendPoint[] }) => {
    if (!points.length) {
        return <div className="h-[160px] flex items-center justify-center text-sm text-text-gray">No evaluations yet</div>;
    }
    const width = 420;
    const height = 160;
    const maxScore = Math.max(100, ...points.map((p) => p.avgScore));
    const maxEval = Math.max(1, ...points.map((p) => p.evaluations));
    const path = points
        .map((point, index) => {
            const x = (index / Math.max(points.length - 1, 1)) * width;
            const y = height - (point.avgScore / maxScore) * height;
            return `${index === 0 ? 'M' : 'L'}${x},${y}`;
        })
        .join(' ');
    const area = `${path} L${width},${height} L0,${height} Z`;
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[160px]">
            <defs>
                <linearGradient id="qcScore" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="qcLine" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
            </defs>
            <path d={area} fill="url(#qcScore)" opacity={0.28} />
            <path d={path} fill="none" stroke="url(#qcLine)" strokeWidth={3} strokeLinecap="round" />
            {points.map((point, index) => {
                const x = (index / Math.max(points.length - 1, 1)) * width;
                const y = height - (point.avgScore / maxScore) * height;
                const bubbleHeight = Math.max(10, (point.evaluations / maxEval) * 28);
                return (
                    <g key={point.date}>
                        <circle cx={x} cy={y} r={4.5} fill="#0f172a" stroke="#34d399" strokeWidth={2} />
                        <rect x={x - 2} y={height - bubbleHeight} width={4} height={bubbleHeight} rx={2} fill="#38bdf8" opacity={0.65} />
                    </g>
                );
            })}
        </svg>
    );
};

const CompletionBars = ({ points }: { points: CompletionTrendPoint[] }) => {
    if (!points.length) {
        return <div className="h-[160px] flex items-center justify-center text-sm text-text-gray">No checklist activity yet</div>;
    }
    const maxValue = Math.max(1, ...points.map((p) => p.checked + p.unchecked));
    return (
        <div className="h-[160px] flex items-end gap-2">
            {points.map((point) => {
                const total = point.checked + point.unchecked;
                const barHeight = (total / maxValue) * 150;
                const checkedHeight = total ? (point.checked / total) * barHeight : 0;
                const uncheckedHeight = barHeight - checkedHeight;
                return (
                    <div key={point.date} className="flex flex-col items-center flex-1 min-w-[10px]">
                        <div className="w-3 bg-[#0f172a]/20 rounded-full" style={{ height: `${barHeight}px` }}>
                            <div className="w-full rounded-full" style={{ height: `${checkedHeight}px`, background: 'linear-gradient(180deg, #22d3ee 0%, #0f8ec7 100%)' }} />
                            <div className="w-full rounded-full mt-1" style={{ height: `${Math.max(uncheckedHeight - 4, 0)}px`, background: 'linear-gradient(180deg, #f97316 0%, #b45309 100%)' }} />
                        </div>
                        <p className="text-[11px] text-text-gray mt-2">{point.date.slice(5)}</p>
                    </div>
                );
            })}
        </div>
    );
};

const StatusPill = ({ status }: { status?: string }) => {
    const palette: Record<string, string> = {
        completed: 'bg-emerald-900/60 text-emerald-200 border-emerald-500/40',
        pending: 'bg-amber-900/40 text-amber-50 border-amber-400/30',
        failed: 'bg-rose-900/40 text-rose-100 border-rose-500/40',
    };
    const key = status?.toLowerCase() ?? 'pending';
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    return <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${palette[key] ?? palette.pending}`}>{label}</span>;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(0)}%`;

const Toast = ({ payload, onDismiss }: { payload: ToastPayload; onDismiss: () => void }) => {
    useEffect(() => {
        if (!payload) return;
        const timer = setTimeout(onDismiss, 3200);
        return () => clearTimeout(timer);
    }, [payload, onDismiss]);

    if (!payload) return null;
    return (
        <div className="fixed bottom-6 right-6 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold text-white"
            style={{ background: payload.intent === 'success' ? 'linear-gradient(120deg, #22c55e, #16a34a)' : 'linear-gradient(120deg, #ef4444, #b91c1c)' }}>
            {payload.message}
        </div>
    );
};

const QCDashboard = () => {
    const [overview, setOverview] = useState<QualityOverview | null>(null);
    const [standards, setStandards] = useState<QualityStandard[]>([]);
    const [range, setRange] = useState<RangePreset>(30);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
    const [toast, setToast] = useState<ToastPayload>(null);
    const [aiHistory, setAiHistory] = useState<AIHistoryItem[]>([]);
    const [projectOptions, setProjectOptions] = useState<ProjectOption[]>(DEFAULT_PROJECT_OPTIONS);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectFetchError, setProjectFetchError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [overviewData, standardData, historyData] = await Promise.all([
                fetchQualityOverview({ days: range }),
                fetchQualityStandards({ status: 'active' }),
                fetchAIHistory()
            ]);
            if (!mountedRef.current) return;
            setOverview(overviewData);
            setStandards(standardData);
            setAiHistory(historyData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load QC data');
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [range]);

    useEffect(() => { void refetch(); }, [refetch]);

    const loadProjects = useCallback(async () => {
        if (typeof window === 'undefined') return;
        const storedUserId = localStorage.getItem('userId');
        if (!storedUserId) {
            setProjectOptions(DEFAULT_PROJECT_OPTIONS);
            setProjectFetchError('Please log in again to load projects');
            return;
        }

        setProjectsLoading(true);
        setProjectFetchError(null);
        try {
            const response = await fetch(`${API_BASE}/projects`, { headers: buildAuthHeaders() });
            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Failed to load projects');
            }
            const payload = await response.json();
            const normalized: ProjectOption[] = Array.isArray(payload)
                ? payload
                      .map((project: any) => ({
                          id: project?._id ?? project?.id ?? '',
                          name: project?.title ?? project?.name ?? 'Untitled project',
                          status: project?.status,
                          isSystem: project?._id === 'public-group' || project?._id === 'all-sub-admin',
                      }))
                      .filter((option: ProjectOption) => Boolean(option.id))
                : [];
            setProjectOptions(normalized.length ? normalized : DEFAULT_PROJECT_OPTIONS);
        } catch (err) {
            console.error('Failed to fetch project options', err);
            setProjectFetchError(err instanceof Error ? err.message : 'Unable to load projects');
            setProjectOptions(DEFAULT_PROJECT_OPTIONS);
        } finally {
            setProjectsLoading(false);
        }
    }, []);

    useEffect(() => { void loadProjects(); }, [loadProjects]);

    const latestScore = useMemo(() => {
        if (!overview?.scoreTrend?.length) return { value: 0, evaluations: 0 };
        const last = overview.scoreTrend[overview.scoreTrend.length - 1];
        const totalEvals = overview.scoreTrend.reduce((sum, point) => sum + point.evaluations, 0);
        return { value: last.avgScore, evaluations: totalEvals };
    }, [overview]);

    const checklistHealth = useMemo(() => {
        const checked = overview?.todoStats?.checked ?? 0;
        const unchecked = overview?.todoStats?.unchecked ?? 0;
        const total = checked + unchecked;
        return total ? checked / total : 0;
    }, [overview]);

    const activeStandards = standards.filter((std) => std.status === 'active');

    const handleCreateStandard = async (payload: CreateStandardPayload) => {
        try {
            await createQualityStandard(payload);
            setToast({ intent: 'success', message: 'Standard saved successfully' });
            setCreateOpen(false);
            await refetch();
        } catch (err) {
            setToast({ intent: 'error', message: err instanceof Error ? err.message : 'Failed to save standard' });
        }
    };


    const handleExport = async (format: 'csv' | 'pdf') => {
        try {
            setExporting(format);
            const { blob, filename } = await downloadQualityReport(format, { days: range });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            setToast({ intent: 'success', message: `Report exported as ${format.toUpperCase()}` });
        } catch (err) {
            setToast({ intent: 'error', message: err instanceof Error ? err.message : 'Export failed' });
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#020617] text-white font-display">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Reports" subtitle="AI oversight · Standards · Reports" />
                <main className="page-main px-6 lg:px-10 pb-16 space-y-8">
                    <section
                        className="rounded-3xl p-8 relative overflow-hidden border border-white/5 shadow-2xl"
                        style={{ background: gradientBackground }}
                    >
                        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 20% 20%, #06b6d4 0%, transparent 55%)' }} />
                        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                            <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Live Quality Signal</p>
                                <h1 className="text-3xl md:text-4xl font-semibold mt-2 leading-tight">Intelligence cockpit for QC leads</h1>
                                <p className="text-sm text-white/70 max-w-2xl mt-3">
                                    Track evaluation health, enforce bespoke standards, and launch AI audits with curated datasets. This surface pulls straight from the new `/qc` API stack.
                                </p>
                                <div className="mt-6 flex flex-wrap gap-6 text-sm">
                                    <div>
                                        <p className="text-white/60">Active standards</p>
                                        <p className="text-2xl font-semibold">{activeStandards.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/60">Latest AI score</p>
                                        <p className="text-2xl font-semibold">{latestScore.value.toFixed(1)}<span className="text-base text-white/60 ml-2">({formatNumber(latestScore.evaluations)} evals)</span></p>
                                    </div>
                                    <div>
                                        <p className="text-white/60">Checklist health</p>
                                        <p className="text-2xl font-semibold">{formatPercent(checklistHealth)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button type="button" onClick={() => setAiOpen(true)} className="btn-primary px-6 py-3 rounded-2xl text-base font-semibold shadow-lg" style={{ background: 'linear-gradient(120deg, #38bdf8, #14b8a6)' }}>
                                    Launch AI Review
                                </button>
                                <button type="button" onClick={() => setCreateOpen(true)} className="px-6 py-3 rounded-2xl text-base font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors">
                                    New Quality Standard
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ═══ GLOBAL ADMIN INSIGHTS ═══ */}
                    {overview?.adminInsights && (
                        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Global Rejection Rate */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Global Rejection</p>
                                <p className="text-3xl font-semibold text-rose-400">{overview.adminInsights.globalRejectionRate}%</p>
                                <p className="text-xs text-white/40 mt-2">Workspace-wide average</p>
                            </div>

                            {/* Burnout Risk Users */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Burnout Risk</p>
                                <p className="text-3xl font-semibold text-orange-400">{overview.adminInsights.burnoutRiskUsers}</p>
                                <p className="text-xs text-white/40 mt-2">Users with high workload</p>
                            </div>

                            {/* Global Bottlenecks */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2 flex items-center gap-2"><span>⚠️</span> Top Bottleneck</p>
                                <p className="text-lg font-semibold text-amber-300 truncate">{overview.adminInsights.bottlenecks[0]?.name || 'None'}</p>
                                <p className="text-xs text-white/40 mt-1">{overview.adminInsights.bottlenecks[0]?.avgHours || 0}h avg turnaround</p>
                            </div>

                            {/* Global Issues */}
                            <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-3xl p-6 relative overflow-hidden group">
                                <p className="text-xs uppercase tracking-[0.2em] text-indigo-200/50 mb-2 flex items-center gap-2"><span>🤖</span> Top AI Issue</p>
                                <p className="text-sm font-semibold text-indigo-200 line-clamp-2 leading-relaxed">{overview.adminInsights.globalIssues[0] || 'No frequent issues'}</p>
                                <p className="text-xs text-indigo-300/40 mt-2">Workspace-wide</p>
                            </div>
                        </section>
                    )}

                    <section className="bg-[#0f172a] border border-white/5 rounded-3xl p-6 shadow-xl">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Signals</p>
                                <h2 className="text-2xl font-semibold">Live performance</h2>
                            </div>
                            <div className="flex gap-2 bg-white/5 rounded-2xl p-1">
                                {[7, 30, 90].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setRange(preset as RangePreset)}
                                        className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${range === preset ? 'bg-white text-[#0f172a]' : 'text-white/70 hover:text-white'}`}
                                    >
                                        {preset}d
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white/5 rounded-3xl p-5 border border-white/10">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-xs text-white/60">AI score trend</p>
                                        <p className="text-lg font-semibold">{overview?.scoreTrend?.length ? `${overview.scoreTrend[overview.scoreTrend.length - 1].avgScore.toFixed(1)} / 100` : '—'}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-200 bg-emerald-500/10 px-3 py-1 rounded-full">Weighted avg</span>
                                </div>
                                <ScoreSparkline points={overview?.scoreTrend ?? []} />
                            </div>
                            <div className="bg-white/5 rounded-3xl p-5 border border-white/10">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-xs text-white/60">Checklist discipline</p>
                                        <p className="text-lg font-semibold">{formatPercent(checklistHealth)}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-cyan-200 bg-cyan-500/10 px-3 py-1 rounded-full">Todo audits</span>
                                </div>
                                <CompletionBars points={overview?.completionTrend ?? []} />
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2 bg-[#0f172a] border border-white/5 rounded-3xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">Standards</p>
                                    <h3 className="text-xl font-semibold">Active rulebooks</h3>
                                </div>
                                <button type="button" onClick={() => setCreateOpen(true)} className="text-sm font-semibold text-cyan-300 hover:text-white">+ Add</button>
                            </div>
                            {loading && (
                                <p className="text-white/60 text-sm">Loading standards…</p>
                            )}
                            {!loading && activeStandards.length === 0 && (
                                <p className="text-white/60 text-sm">No active standards yet. Create one to gate task approvals.</p>
                            )}
                            <div className="grid gap-4 md:grid-cols-2">
                                {activeStandards.slice(0, 4).map((standard) => (
                                    <article key={standard.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-lg">{standard.title}</h4>
                                            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">{standard.type}</span>
                                        </div>
                                        <p className="text-sm text-white/70 line-clamp-2">{standard.description || 'No description provided yet.'}</p>
                                        <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/20">{standard.rules.length} rules</span>
                                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20">Scope · {standard.scope.level}</span>
                                            {standard.scope.ids.length > 0 && (
                                                <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">{standard.scope.ids.length} IDs pinned</span>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                        <div className="bg-[#0f172a] border border-white/5 rounded-3xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">Projects</p>
                                    <h3 className="text-xl font-semibold">Scoreboard</h3>
                                </div>
                                <button type="button" onClick={() => void handleExport('csv')} className="text-xs font-semibold text-white/70 hover:text-white">CSV</button>
                            </div>
                            <div className="space-y-3">
                                {(overview?.projectScores ?? []).slice(0, 5).map((project) => (
                                    <div key={project.projectId} className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
                                        <div>
                                            <p className="text-sm font-semibold">{project.projectId || 'Project'}</p>
                                            <p className="text-xs text-white/60">{project.evaluations} evals</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold">{project.avgScore.toFixed(1)}</p>
                                            <p className="text-[11px] text-emerald-300">score</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 text-sm">
                                <button type="button" onClick={() => void handleExport('pdf')} className="flex-1 border border-white/20 rounded-2xl py-2 font-semibold text-white/80 hover:bg-white/10">Export PDF</button>
                                <button type="button" disabled={exporting === 'csv'} onClick={() => void handleExport('csv')} className="flex-1 border border-white/20 rounded-2xl py-2 font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50">
                                    {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="bg-[#0f172a] border border-white/5 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-white/50">AI history</p>
                                <h3 className="text-xl font-semibold">Recent evaluations</h3>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-[0.2em] text-white/40 border-b border-white/10">
                                        <th className="py-3">Task</th>
                                        <th className="py-3">Score</th>
                                        <th className="py-3">Status</th>
                                        <th className="py-3">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {aiHistory.slice(0, 10).map((entry) => (
                                        <tr key={entry.taskId} className="hover:bg-white/5">
                                            <td className="py-3 pr-4">
                                                <p className="font-semibold">{entry.taskTitle || 'Untitled task'}</p>
                                                <p className="text-xs text-white/50">{entry.taskId}</p>
                                            </td>
                                            <td className="py-3 pr-4">
                                                {typeof entry.score === 'number' ? (
                                                    <span className={`font-semibold ${entry.score >= 80 ? 'text-emerald-400' : entry.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                        {entry.score.toFixed(1)}
                                                    </span>
                                                ) : (
                                                    <span className="text-white/50">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 pr-4"><StatusPill status={entry.status} /></td>
                                            <td className="py-3 text-xs text-white/70">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {aiHistory.length === 0 && (
                                <p className="text-sm text-white/60">No AI evaluations captured for this range.</p>
                            )}
                        </div>
                    </section>

                    {error && <p className="text-rose-400">{error}</p>}
                </main>
            </div>
            <CreateStandardModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreateStandard} />
            <AIReviewModal
                isOpen={aiOpen}
                onClose={() => setAiOpen(false)}
                standards={standards}
                projectOptions={projectOptions}
                projectsLoading={projectsLoading}
                projectError={projectFetchError}
            />
            <Toast payload={toast} onDismiss={() => setToast(null)} />
        </div>
    );
};

interface CreateStandardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: CreateStandardPayload) => Promise<void>;
}

const CreateStandardModal = ({ isOpen, onClose, onSubmit }: CreateStandardModalProps) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [ruleText, setRuleText] = useState('');
    const [scopeLevel, setScopeLevel] = useState<'all' | 'group' | 'project'>('all');
    const [scopeIds, setScopeIds] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setTitle('');
        setDescription('');
        setRuleText('');
        setScopeLevel('all');
        setScopeIds('');
        setError(null);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const rules = ruleText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, index) => ({
                    rule_id: `rule-${Date.now()}-${index}`,
                    label: line,
                    instructions: line,
                    weight: 1,
                }));
            await onSubmit({
                title,
                description,
                type: 'text',
                rules,
                scope: {
                    level: scopeLevel,
                    ids: scopeLevel === 'all' ? [] : scopeIds.split(',').map((id) => id.trim()).filter(Boolean),
                },
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to create standard');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <form onSubmit={handleSubmit} className="bg-[#020617] border border-white/10 rounded-3xl w-full max-w-3xl p-8 space-y-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-white/50">New standard</p>
                        <h4 className="text-2xl font-semibold">Codify a rulebook</h4>
                    </div>
                    <button type="button" onClick={onClose} className="text-white/50 hover:text-white">Close</button>
                </div>
                <label className="space-y-2 text-sm">
                    <span>Title</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} required className="input-field bg-white/5 border-white/10 text-white" placeholder="Motion graphics QA" />
                </label>
                <label className="space-y-2 text-sm">
                    <span>Description</span>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-field bg-white/5 border-white/10 text-white" placeholder="What should the AI enforce?" />
                </label>
                <label className="space-y-2 text-sm">
                    <span>Rules (one per line)</span>
                    <textarea value={ruleText} onChange={(e) => setRuleText(e.target.value)} rows={4} className="input-field bg-white/5 border-white/10 text-white" placeholder={"Hero line must mention CTA\nAll thumbnails require alt text"} />
                </label>
                <div className="grid md:grid-cols-2 gap-4">
                    <label className="space-y-2 text-sm">
                        <span>Scope</span>
                        <select value={scopeLevel} onChange={(e) => setScopeLevel(e.target.value as typeof scopeLevel)} className="input-field bg-white/5 border-white/10 text-white">
                            <option value="all">Workspace</option>
                            <option value="group">Group IDs</option>
                            <option value="project">Project IDs</option>
                        </select>
                    </label>
                    {scopeLevel !== 'all' && (
                        <label className="space-y-2 text-sm">
                            <span>IDs (comma separated)</span>
                            <input value={scopeIds} onChange={(e) => setScopeIds(e.target.value)} className="input-field bg-white/5 border-white/10 text-white" placeholder="projectIdA, projectIdB" />
                        </label>
                    )}
                </div>
                {error && <p className="text-sm text-rose-400">{error}</p>}
                <button type="submit" disabled={submitting} className="w-full rounded-2xl py-3 font-semibold text-base text-white bg-gradient-to-r from-cyan-500 to-emerald-400 disabled:opacity-60">
                    {submitting ? 'Saving…' : 'Save standard'}
                </button>
            </form>
        </div>
    );
};

interface AIReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    standards: QualityStandard[];
    projectOptions: ProjectOption[];
    projectsLoading: boolean;
    projectError?: string | null;
}

const AIReviewModal = ({ isOpen, onClose, standards, projectOptions, projectsLoading, projectError }: AIReviewModalProps) => {
    const [taskTitle, setTaskTitle] = useState('');
    const [taskId, setTaskId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedStandards, setSelectedStandards] = useState<string[]>([]);
    const [docs, setDocs] = useState<File[]>([]);
    const [images, setImages] = useState<File[]>([]);
    const [reportTypeKey, setReportTypeKey] = useState('');
    const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<EvaluationResult | null>(null);

    useEffect(() => {
        fetchReportTypes().then(setReportTypes).catch(() => {});
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        setTaskTitle('');
        setTaskId('');
        setProjectId('');
        setTaskDescription('');
        setNotes('');
        setReportTypeKey('');
        setSelectedStandards(standards.slice(0, 2).map((std) => std.id));
        setDocs([]);
        setImages([]);
        setError(null);
        setResult(null);
    }, [isOpen, standards]);

    useEffect(() => {
        if (!isOpen) return;
        setProjectId((current) => current || (projectOptions[0]?.id ?? ''));
    }, [isOpen, projectOptions]);

    if (!isOpen) return null;

    const toBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        setResult(null);
        try {
            const imageBase64 = await Promise.all(images.map(toBase64));
            const fileTexts = await Promise.all(
                docs.map(async (f) => ({
                    file_name: f.name,
                    content: await f.text(),
                    file_type: 'document',
                }))
            );
            const data = await evaluateTask({
                task_title: taskTitle,
                task_description: taskDescription + (notes ? `\n\nReviewer notes: ${notes}` : ''),
                task_id: taskId || undefined,
                report_type: reportTypeKey || undefined,
                files: fileTexts,
                image_base64: imageBase64,
            });
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to run AI evaluation');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleStandard = (id: string) => {
        setSelectedStandards((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-6">
            <form onSubmit={handleSubmit} className="bg-[#020617] border border-white/10 rounded-3xl w-full max-w-4xl p-8 space-y-6 text-white overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-white/50">AI audit</p>
                        <h4 className="text-2xl font-semibold">Launch quality evaluation</h4>
                    </div>
                    <button type="button" onClick={onClose} className="text-white/50 hover:text-white">Close</button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <label className="space-y-2 text-sm">
                        <span>Task title</span>
                        <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required className="input-field bg-white/5 border-white/10 text-white" placeholder="Homepage hero refresh" />
                    </label>
                    <label className="space-y-2 text-sm">
                        <span>Task ID (optional)</span>
                        <input value={taskId} onChange={(e) => setTaskId(e.target.value)} className="input-field bg-white/5 border-white/10 text-white" placeholder="task-123" />
                    </label>
                    <label className="space-y-2 text-sm">
                        <span>Project</span>
                        <select
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            required
                            className="input-field bg-white/5 border-white/10 text-white"
                        >
                            <option value="">{projectsLoading ? 'Loading projects…' : 'Select a project'}</option>
                            {projectOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.name}
                                    {option.status ? ` · ${option.status}` : ''}
                                </option>
                            ))}
                        </select>
                        {projectError && <p className="text-xs text-rose-300">{projectError}</p>}
                    </label>
                    <label className="space-y-2 text-sm">
                        <span>Task description</span>
                        <input value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} className="input-field bg-white/5 border-white/10 text-white" placeholder="Optional context" />
                    </label>
                </div>
                {/* Report Type */}
                <label className="space-y-2 text-sm">
                    <span className="flex items-center gap-2">
                        نوع التقرير
                        <span className="text-white/40 text-xs">(اختياري — يحدد معايير التحقق)</span>
                    </span>
                    <select
                        value={reportTypeKey}
                        onChange={(e) => setReportTypeKey(e.target.value)}
                        className="input-field bg-white/5 border-white/10 text-white w-full"
                    >
                        <option value="">— بدون تصنيف —</option>
                        {reportTypes.map((rt) => (
                            <option key={rt.key} value={rt.key}>
                                {rt.name_ar} — {rt.name_en}
                            </option>
                        ))}
                    </select>
                    {reportTypeKey && (
                        <p className="text-xs text-white/50 mt-1">
                            {reportTypes.find((r) => r.key === reportTypeKey)?.description}
                        </p>
                    )}
                </label>

                <label className="space-y-2 text-sm">
                    <span>Reviewer notes sent to AI</span>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input-field bg-white/5 border-white/10 text-white" placeholder="Highlight risk areas, brand rules, or acceptance criteria." />
                </label>
                <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50 mb-2">Standards to enforce</p>
                    <div className="grid md:grid-cols-2 gap-3">
                        {standards.map((standard) => (
                            <label key={standard.id} className={`rounded-2xl border px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${selectedStandards.includes(standard.id) ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/15 bg-white/5'}`}>
                                <input type="checkbox" checked={selectedStandards.includes(standard.id)} onChange={() => toggleStandard(standard.id)} className="accent-cyan-400" />
                                <div>
                                    <p className="text-sm font-semibold">{standard.title}</p>
                                    <p className="text-xs text-white/60">{standard.rules.length} rules</p>
                                </div>
                            </label>
                        ))}
                        {standards.length === 0 && <p className="text-sm text-white/60">Create a standard first.</p>}
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <label className="space-y-2 text-sm">
                        <span>Documents (PDF, TXT)</span>
                        <input type="file" multiple onChange={(e) => setDocs(Array.from(e.target.files ?? []))} className="input-field bg-white/5 border-white/10 text-white" />
                    </label>
                    <label className="space-y-2 text-sm">
                        <span>Images</span>
                        <input type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files ?? []))} className="input-field bg-white/5 border-white/10 text-white" />
                    </label>
                </div>
                {error && <p className="text-sm text-rose-400">{error}</p>}

                {/* AI Evaluation Result */}
                {result && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-[0.4em] text-white/50">نتيجة التقييم</p>
                            <span className={`text-2xl font-bold ${result.compliance_score >= 70 ? 'text-emerald-400' : result.compliance_score >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {result.compliance_score.toFixed(0)}%
                            </span>
                        </div>

                        {/* Report Type Compliance Banner */}
                        {result.report_type_compliance && (
                            <div className={`rounded-xl p-4 border ${result.report_type_compliance.is_compliant ? 'bg-emerald-900/30 border-emerald-500/40' : 'bg-rose-900/30 border-rose-500/40'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-lg ${result.report_type_compliance.is_compliant ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {result.report_type_compliance.is_compliant ? '✓' : '✗'}
                                    </span>
                                    <p className={`text-sm font-bold ${result.report_type_compliance.is_compliant ? 'text-emerald-300' : 'text-rose-300'}`}>
                                        {result.report_type_compliance.is_compliant
                                            ? `مطابق لمواصفات "${result.report_type_name_ar}"`
                                            : `غير مطابق لمواصفات "${result.report_type_name_ar}"`}
                                    </p>
                                </div>
                                {result.report_type_compliance.compliance_note && (
                                    <p className="text-xs text-white/70 leading-relaxed">{result.report_type_compliance.compliance_note}</p>
                                )}
                                {!result.report_type_compliance.is_compliant && result.report_type_compliance.missing_elements.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs font-semibold text-rose-300 mb-1">العناصر الناقصة:</p>
                                        <ul className="space-y-1">
                                            {result.report_type_compliance.missing_elements.map((el, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                                                    <span className="text-rose-400 mt-0.5">•</span>
                                                    {el}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Failed standards */}
                        {result.failed_standards.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-rose-300 uppercase tracking-wide">معايير فاشلة ({result.failed_standards.length})</p>
                                {result.failed_standards.map((f, i) => (
                                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-rose-900/20 border border-rose-500/20">
                                        <span className="text-rose-400 text-xs mt-0.5 flex-shrink-0">✗</span>
                                        <div>
                                            <p className="text-xs font-semibold text-rose-200">{f.rule}</p>
                                            <p className="text-xs text-white/60 mt-0.5">{f.reason}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Suggestions */}
                        {result.suggestions.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wide">اقتراحات التحسين</p>
                                {result.suggestions.map((s, i) => (
                                    <p key={i} className="text-xs text-white/70 flex items-start gap-2">
                                        <span className="text-cyan-400 mt-0.5">→</span> {s}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <button type="submit" disabled={submitting} className="w-full rounded-2xl py-3 font-semibold text-base text-white bg-gradient-to-r from-blue-500 to-teal-400 disabled:opacity-60">
                    {submitting ? 'جاري التحليل…' : result ? 'إعادة التقييم' : 'إرسال للـ AI'}
                </button>
            </form>
        </div>
    );
};

export default QCDashboard;
