import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { QualityOverview } from '../types';
import { downloadQualityReport, fetchQualityOverview } from '../services/qcService';

const formatPercent = (value: number) => `${(value * 100).toFixed(0)}%`;

const QualityInsights = () => {
    const [overview, setOverview] = useState<QualityOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchQualityOverview({ days: 60 });
                setOverview(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to load insights');
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const evaluationTotal = useMemo(() => {
        return (overview?.scoreTrend ?? []).reduce((sum, point) => sum + point.evaluations, 0);
    }, [overview]);

    const rollingAverage = useMemo(() => {
        const trend = overview?.scoreTrend ?? [];
        if (!trend.length) return 0;
        const totalScore = trend.reduce((sum, point) => sum + point.avgScore, 0);
        return totalScore / trend.length;
    }, [overview]);

    const checklistHealth = useMemo(() => {
        const checked = overview?.todoStats?.checked ?? 0;
        const unchecked = overview?.todoStats?.unchecked ?? 0;
        const total = checked + unchecked;
        return total ? checked / total : 0;
    }, [overview]);

    const checklistInteractions = (overview?.todoStats?.checked ?? 0) + (overview?.todoStats?.unchecked ?? 0);

    const riskProjects = useMemo(() => {
        const list = [...(overview?.projectScores ?? [])];
        return list.sort((a, b) => a.avgScore - b.avgScore).slice(0, 4);
    }, [overview]);

    const aiHistory = overview?.aiHistory ?? [];

    const handleExport = async (format: 'csv' | 'pdf') => {
        try {
            setExporting(format);
            const { blob, filename } = await downloadQualityReport(format, { days: 60 });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to export report');
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#020617] text-white font-display">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Quality Insights" subtitle="Reporting hub tailored for QC roles" />
                <main className="page-main px-6 lg:px-10 pb-16 space-y-8">
                    <section className="rounded-3xl border border-white/5 bg-gradient-to-br from-[#0f172a] via-[#0a1a32] to-[#091225] p-8 shadow-2xl">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="uppercase text-[11px] tracking-[0.4em] text-cyan-200/70">Quality command</p>
                                <h1 className="text-3xl font-semibold mt-3">Reports cockpit for quality leads</h1>
                                <p className="text-sm text-white/70 mt-3 max-w-2xl">
                                    Monitor AI score trends, audit backlog, and export evidence packs without leaving the role-specific lane.
                                    All data is sourced directly from the `/qc` analytics endpoints so you can brief stakeholders quickly.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    type="button"
                                    onClick={() => void handleExport('pdf')}
                                    className="px-5 py-3 rounded-2xl text-sm font-semibold border border-white/20 bg-white/5 hover:bg-white/10"
                                    disabled={exporting === 'pdf'}
                                >
                                    {exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF dossier'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleExport('csv')}
                                    className="px-5 py-3 rounded-2xl text-sm font-semibold border border-white/20 bg-white/5 hover:bg-white/10"
                                    disabled={exporting === 'csv'}
                                >
                                    {exporting === 'csv' ? 'Exporting CSV…' : 'Export CSV detail'}
                                </button>
                            </div>
                        </div>
                    </section>

                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    )}

                    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <article className="rounded-3xl bg-white/5 border border-white/10 p-5">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">AI evaluations</p>
                            <p className="text-3xl font-semibold mt-3">{evaluationTotal}</p>
                            <p className="text-xs text-white/60 mt-1">Rolling 60 days</p>
                        </article>
                        <article className="rounded-3xl bg-white/5 border border-white/10 p-5">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Rolling avg score</p>
                            <p className="text-3xl font-semibold mt-3">{rollingAverage.toFixed(1)}</p>
                            <p className="text-xs text-white/60 mt-1">Across all evaluations</p>
                        </article>
                        <article className="rounded-3xl bg-white/5 border border-white/10 p-5">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Checklist discipline</p>
                            <p className="text-3xl font-semibold mt-3">{formatPercent(checklistHealth)}</p>
                            <p className="text-xs text-white/60 mt-1">Checked vs unchecked items</p>
                        </article>
                        <article className="rounded-3xl bg-white/5 border border-white/10 p-5">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Todo interactions</p>
                            <p className="text-3xl font-semibold mt-3">{checklistInteractions}</p>
                            <p className="text-xs text-white/60 mt-1">Audit touches captured</p>
                        </article>
                    </section>

                    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2 bg-[#0b1a32] border border-white/5 rounded-3xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">Projects</p>
                                    <h2 className="text-2xl font-semibold">Health board</h2>
                                </div>
                                <span className="text-xs text-white/60">Lowest scoring cohorts</span>
                            </div>
                            {loading && <p className="text-sm text-white/60">Loading project insights…</p>}
                            {!loading && riskProjects.length === 0 && (
                                <p className="text-sm text-white/60">No project data yet. Run evaluations to populate this board.</p>
                            )}
                            <div className="space-y-3">
                                {riskProjects.map((project) => (
                                    <div key={project.projectId ?? 'project'} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                        <div>
                                            <p className="font-semibold">{project.projectId || 'Unlabeled project'}</p>
                                            <p className="text-xs text-white/60">{project.evaluations} evaluations</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-semibold text-rose-200">{project.avgScore.toFixed(1)}</p>
                                            <p className="text-[11px] text-white/50">Average score</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-[#0b1a32] border border-white/5 rounded-3xl p-6 space-y-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Exports</p>
                                <h2 className="text-2xl font-semibold">Evidence packets</h2>
                            </div>
                            <p className="text-sm text-white/70">
                                Generate shareable output for audits or leadership briefings. CSV delivers raw data; PDF highlights trend narratives.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => void handleExport('pdf')}
                                    className="w-full rounded-2xl border border-white/20 py-3 font-semibold hover:bg-white/10 disabled:opacity-60"
                                    disabled={exporting === 'pdf'}
                                >
                                    {exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF summary'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleExport('csv')}
                                    className="w-full rounded-2xl border border-white/20 py-3 font-semibold hover:bg-white/10 disabled:opacity-60"
                                    disabled={exporting === 'csv'}
                                >
                                    {exporting === 'csv' ? 'Exporting CSV…' : 'Export CSV detail'}
                                </button>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                                <p className="font-semibold text-white">Why download?</p>
                                <p className="mt-2">Attach the PDF to quality reviews, or ingest the CSV into BI tooling for deeper slicing.</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-[#0b1a32] border border-white/5 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Audits</p>
                                <h2 className="text-2xl font-semibold">Recent AI reviews</h2>
                            </div>
                            <span className="text-xs text-white/60">Latest 8 entries</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-[0.2em] text-white/40 border-b border-white/10">
                                        <th className="py-3 pr-4">Task</th>
                                        <th className="py-3 pr-4">Score</th>
                                        <th className="py-3 pr-4">Status</th>
                                        <th className="py-3 pr-4">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {aiHistory.slice(0, 8).map((entry) => (
                                        <tr key={entry.analysisId} className="hover:bg-white/5">
                                            <td className="py-3 pr-4">
                                                <p className="font-semibold text-white">{entry.taskTitle || 'Untitled task'}</p>
                                                <p className="text-xs text-white/60">{entry.analysisId}</p>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className="text-lg font-semibold">{entry.score?.toFixed(1) ?? '—'}</span>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 border border-white/20">
                                                    {(entry.status || 'pending').replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-xs text-white/60">{entry.createdAt ?? '—'}</td>
                                        </tr>
                                    ))}
                                    {!aiHistory.length && (
                                        <tr>
                                            <td colSpan={4} className="py-6 text-center text-white/60">
                                                No AI reviews yet. Launch one from the Quality Lab to populate this list.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default QualityInsights;
