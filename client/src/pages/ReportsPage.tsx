import { useEffect, useRef, useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

/* ─────────── Types ─────────── */
interface Project {
    _id: string;
    id?: string;
    name: string;
    description?: string;
    status?: string;
    progress?: number;
    members?: string[];
    created_at?: string;
    is_system_card?: boolean;
    isDefaultGroup?: boolean;
    color?: string;
}

interface Member {
    _id: string;
    name: string;
    role: string;
    email: string;
}

/* ─────────── Helpers ─────────── */
const getProgress = (p: Project) => Math.max(0, Math.min(100, p.progress ?? 0));

const getStatusLabel = (s?: string) => {
    switch ((s ?? '').toLowerCase()) {
        case 'active':    return 'Active';
        case 'completed': return 'Completed';
        case 'on_hold':
        case 'on hold':   return 'On Hold';
        default:          return s ?? 'Active';
    }
};

const STATUS_COLOR: Record<string, string> = {
    active:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    on_hold:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    'on hold': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const STATUS_BAR: Record<string, string> = {
    active:    'bg-blue-500',
    completed: 'bg-emerald-500',
    on_hold:   'bg-yellow-500',
    'on hold': 'bg-yellow-500',
};

const PRINT_STYLES = `
@media print {
    body * { visibility: hidden !important; }
    #report-print-area, #report-print-area * { visibility: visible !important; }
    #report-print-area { position: absolute; inset: 0; padding: 32px; }
    .no-print { display: none !important; }
    .print-break { page-break-after: always; }
}
@page { size: A4; margin: 20mm; }
`;

/* ─────────── Component ─────────── */
const ReportsPage = () => {
    const [projects, setProjects]   = useState<Project[]>([]);
    const [members, setMembers]     = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string>('all');
    const styleRef = useRef<HTMLStyleElement | null>(null);

    /* Inject print CSS once */
    useEffect(() => {
        const el = document.createElement('style');
        el.textContent = PRINT_STYLES;
        document.head.appendChild(el);
        styleRef.current = el;
        return () => { el.remove(); };
    }, []);

    /* Fetch data */
    useEffect(() => {
        const fetchAll = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const token = localStorage.getItem('token') ?? '';
                const headers = { Authorization: `Bearer ${token}` };
                const [pRes, mRes] = await Promise.all([
                    fetch(`${API_BASE}/projects`, { headers }),
                    fetch(`${API_BASE}/users`,    { headers }),
                ]);
                if (!pRes.ok) throw new Error(`Projects: ${pRes.status}`);
                const pData: Project[] = await pRes.json();
                setProjects(pData);

                if (mRes.ok) {
                    const mData: Member[] = await mRes.json();
                    setMembers(mData);
                }
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };
        void fetchAll();
    }, []);

    /* Filter out system cards for analytics — by flag OR well-known IDs */
    const customProjects = useMemo(
        () => projects.filter(p => {
            const id = (p._id || p.id || '').toLowerCase();
            if (id === 'public-group' || id === 'all-sub-admin') return false;
            if (p.is_system_card || p.isDefaultGroup) return false;
            return true;
        }),
        [projects]
    );

    const displayProjects = selectedId === 'all'
        ? customProjects
        : customProjects.filter(p => (p._id || p.id) === selectedId);

    /* Analytics */
    const analytics = useMemo(() => {
        const list = customProjects;
        const total = list.length;
        const active    = list.filter(p => (p.status ?? 'active').toLowerCase() === 'active').length;
        const completed = list.filter(p => (p.status ?? '').toLowerCase() === 'completed').length;
        const onHold    = list.filter(p => ['on_hold','on hold'].includes((p.status ?? '').toLowerCase())).length;
        const avgProg   = total === 0 ? 0 : Math.round(list.reduce((s, p) => s + getProgress(p), 0) / total);
        return { total, active, completed, onHold, avgProg };
    }, [customProjects]);

    const subAdmins   = members.filter(m => m.role === 'sub_admin').length;
    const staffCount  = members.filter(m => m.role === 'staff').length;
    const totalMembers = members.length;

    const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    /* PDF export */
    const handleExportPDF = () => {
        window.print();
    };

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />

            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Reports" />

                <main className="page-main p-8">

                    {/* ── Page header ── */}
                    <div className="flex items-center justify-between mb-6 no-print">
                        <div>
                            <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-1">Analytics & Reports</h1>
                            <p className="text-sm text-text-gray dark:text-gray-400">
                                Workspace performance overview · {reportDate}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Project selector */}
                            <select
                                value={selectedId}
                                onChange={e => setSelectedId(e.target.value)}
                                className="h-10 px-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            >
                                <option value="all">All Projects</option>
                                {customProjects.map(p => (
                                    <option key={p._id || p.id} value={p._id || p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>

                            {/* Export PDF */}
                            <button
                                onClick={handleExportPDF}
                                className="h-10 px-5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export PDF
                            </button>
                        </div>
                    </div>

                    {/* ════════════════════════════════════ PRINT AREA ════════════════════════════════════ */}
                    <div id="report-print-area">

                        {/* Print-only header */}
                        <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {selectedId === 'all' ? 'Workspace Analytics Report' : `Project Report: ${displayProjects[0]?.name ?? ''}`}
                                    </h1>
                                    <p className="text-sm text-gray-500 mt-1">Generated on {reportDate}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">W</div>
                            </div>
                        </div>

                        {/* ── Loading / Error ── */}
                        {isLoading && (
                            <div className="text-sm text-text-gray dark:text-gray-400 text-center py-20">Loading data…</div>
                        )}
                        {!isLoading && error && (
                            <div className="text-sm text-danger text-center py-20">{error}</div>
                        )}

                        {!isLoading && !error && (
                            <>
                                {/* ── Stat Cards ── */}
                                <div className="grid grid-cols-5 gap-4 mb-6">
                                    {[
                                        { label: 'Total Projects',   value: analytics.total,     icon: '📁', color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
                                        { label: 'Active',           value: analytics.active,    icon: '▶',  color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                                        { label: 'Completed',        value: analytics.completed, icon: '✓',  color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-900/20' },
                                        { label: 'On Hold',          value: analytics.onHold,    icon: '⏸', color: 'text-yellow-600',  bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                                        { label: 'Avg Progress',     value: `${analytics.avgProg}%`, icon: '📊', color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20' },
                                    ].map(card => (
                                        <div
                                            key={card.label}
                                            className={`${card.bg} rounded-2xl border border-white/60 dark:border-gray-700 p-5 transition-colors`}
                                        >
                                            <div className="text-2xl mb-2">{card.icon}</div>
                                            <div className={`text-3xl font-bold ${card.color} mb-1`}>{card.value}</div>
                                            <div className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase">{card.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Two column layout ── */}
                                <div className="grid grid-cols-3 gap-5 mb-5">

                                    {/* Projects list (2/3) */}
                                    <div className="col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-colors">
                                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                            <h2 className="text-sm font-bold text-text-dark dark:text-gray-100 uppercase">
                                                {selectedId === 'all' ? 'All Projects' : 'Project Detail'}
                                            </h2>
                                            <span className="text-xs text-text-gray dark:text-gray-400">
                                                {displayProjects.length} project{displayProjects.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {displayProjects.length === 0 ? (
                                            <div className="px-6 py-12 text-sm text-text-gray dark:text-gray-400 text-center">
                                                No projects yet
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {displayProjects.map(p => {
                                                    const prog  = getProgress(p);
                                                    const st    = (p.status ?? 'active').toLowerCase().replace(' ', '_');
                                                    const stBar = STATUS_BAR[st] ?? 'bg-blue-500';
                                                    return (
                                                        <div key={p._id || p.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="min-w-0 flex-1 mr-4">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-sm font-semibold text-text-dark dark:text-gray-100 truncate">
                                                                            {p.name}
                                                                        </span>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLOR[st] ?? STATUS_COLOR.active}`}>
                                                                            {getStatusLabel(p.status)}
                                                                        </span>
                                                                    </div>
                                                                    {p.description && (
                                                                        <p className="text-xs text-text-gray dark:text-gray-400 mt-0.5 line-clamp-1">
                                                                            {p.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm font-bold text-text-dark dark:text-gray-200 flex-shrink-0">
                                                                    {prog}%
                                                                </span>
                                                            </div>

                                                            {/* Progress bar */}
                                                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${stBar}`}
                                                                    style={{ width: `${prog}%` }}
                                                                />
                                                            </div>

                                                            {/* Members count */}
                                                            {(p.members?.length ?? 0) > 0 && (
                                                                <div className="mt-1.5 flex items-center gap-1 text-xs text-text-gray dark:text-gray-400">
                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    </svg>
                                                                    {p.members!.length} member{p.members!.length !== 1 ? 's' : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Analytics sidebar (1/3) */}
                                    <div className="space-y-4">

                                        {/* Status distribution */}
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm transition-colors">
                                            <h2 className="text-xs font-bold text-text-gray dark:text-gray-400 uppercase mb-4">Status Distribution</h2>
                                            <div className="space-y-3">
                                                {[
                                                    { label: 'Active',    count: analytics.active,    bar: 'bg-blue-500',    total: analytics.total },
                                                    { label: 'Completed', count: analytics.completed, bar: 'bg-emerald-500', total: analytics.total },
                                                    { label: 'On Hold',   count: analytics.onHold,    bar: 'bg-yellow-500',  total: analytics.total },
                                                ].map(item => (
                                                    <div key={item.label}>
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="font-medium text-text-dark dark:text-gray-200">{item.label}</span>
                                                            <span className="text-text-gray dark:text-gray-400">{item.count}</span>
                                                        </div>
                                                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${item.bar}`}
                                                                style={{ width: item.total > 0 ? `${(item.count / item.total) * 100}%` : '0%' }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Team breakdown */}
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm transition-colors">
                                            <h2 className="text-xs font-bold text-text-gray dark:text-gray-400 uppercase mb-4">Team Breakdown</h2>
                                            <div className="space-y-3">
                                                {[
                                                    { label: 'Total Members', value: totalMembers, color: 'text-text-dark dark:text-white' },
                                                    { label: 'Sub-Admins',    value: subAdmins,    color: 'text-blue-600 dark:text-blue-400' },
                                                    { label: 'Staff',         value: staffCount,   color: 'text-gray-600 dark:text-gray-400' },
                                                ].map(row => (
                                                    <div key={row.label} className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-gray-700 last:border-0">
                                                        <span className="text-xs text-text-gray dark:text-gray-400">{row.label}</span>
                                                        <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Avg progress gauge */}
                                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-sm">
                                            <div className="text-xs font-semibold uppercase opacity-80 mb-1">Overall Progress</div>
                                            <div className="text-4xl font-bold mb-3">{analytics.avgProg}%</div>
                                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-white rounded-full transition-all"
                                                    style={{ width: `${analytics.avgProg}%` }}
                                                />
                                            </div>
                                            <div className="text-xs opacity-70 mt-2">Average across {analytics.total} project{analytics.total !== 1 ? 's' : ''}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Progress bars by project (print-friendly table) ── */}
                                {selectedId !== 'all' && displayProjects.length === 1 && (
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm transition-colors">
                                        <h2 className="text-sm font-bold text-text-dark dark:text-gray-100 uppercase mb-4">Project Summary</h2>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            {[
                                                { label: 'Name',        value: displayProjects[0].name },
                                                { label: 'Status',      value: getStatusLabel(displayProjects[0].status) },
                                                { label: 'Progress',    value: `${getProgress(displayProjects[0])}%` },
                                                { label: 'Members',     value: String(displayProjects[0].members?.length ?? 0) },
                                                { label: 'Description', value: displayProjects[0].description || '—' },
                                            ].map(row => (
                                                <div key={row.label} className="flex flex-col">
                                                    <span className="text-xs font-semibold text-text-gray dark:text-gray-400 uppercase mb-0.5">{row.label}</span>
                                                    <span className="text-base font-semibold text-text-dark dark:text-gray-100">{row.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {/* ════════════════════════════════════ END PRINT AREA ════════════════════════════════════ */}

                </main>
            </div>
        </div>
    );
};

export default ReportsPage;
