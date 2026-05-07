import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const authHeaders = () => ({
    'X-User-Id': localStorage.getItem('userId') ?? '',
    Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
});

const mapProject = (proj: any): Project & { is_system_card?: boolean } => {
    const subManagerEntries = Array.isArray(proj.sub_admins) ? proj.sub_admins : [];
    const staffEntries      = Array.isArray(proj.staff)      ? proj.staff      : [];
    const subManagerNames   = subManagerEntries.map((e: any) => e?.name).filter(Boolean);
    const subManagerIds     = subManagerEntries.map((e: any) => e?._id || e?.id).filter((v: any) => typeof v === 'string');
    const staffIds          = staffEntries.map((e: any)    => e?._id || e?.id).filter((v: any) => typeof v === 'string');
    const staffInitials: string[] = Array.isArray(proj.staff_initials) ? proj.staff_initials : [];
    const subInitials       = subManagerEntries.map((e: any) => e?.initials).filter(Boolean);
    const combinedInitials = [...subInitials, ...staffInitials].filter(Boolean);
    return {
        id: proj._id,
        title: proj.title,
        description: proj.description || '',
        status: ((proj.status || 'ACTIVE').toUpperCase()) as Project['status'],
        progress: typeof proj.progress === 'number' ? proj.progress : 0,
        team: (combinedInitials.length ? combinedInitials : ['TM']).slice(0, 4),
        updatedAt: proj.updated_at || new Date().toISOString(),
        updatedAtRaw: proj.updated_at || new Date().toISOString(),
        subManagerName: subManagerNames[0],
        subManagerNames: subManagerNames,
        subManagerIds: subManagerIds,
        staffIds,
        isDefaultGroup: proj._id === 'public-group' || proj._id === 'all-sub-admin',
        is_system_card: proj.is_system_card ?? (proj._id === 'public-group' || proj._id === 'all-sub-admin'),
    };
};

const getAvatarColor = (idx: number) =>
    ['from-blue-400 to-indigo-500', 'from-violet-400 to-purple-500', 'from-orange-400 to-amber-500',
     'from-emerald-400 to-teal-500', 'from-pink-400 to-rose-500'][idx % 5];

const statusConfig = {
    ACTIVE:    { dot: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', accent: 'bg-primary' },
    'ON HOLD': { dot: 'bg-amber-400',   badge: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',         accent: 'bg-warning' },
    COMPLETED: { dot: 'bg-success',     badge: 'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300',            accent: 'bg-success' },
} as const;

// ─── StaffProjectsPage ────────────────────────────────────────────────────────

const StaffProjectsPage = () => {
    const navigate = useNavigate();
    const [projects, setProjects]   = useState<(Project & { is_system_card?: boolean })[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [filter, setFilter]       = useState<'ALL' | 'ACTIVE' | 'ON HOLD' | 'COMPLETED'>('ALL');
    const [userName]                = useState(() => localStorage.getItem('userName') || localStorage.getItem('fullName') || localStorage.getItem('name') || 'Team Member');

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/projects`, { headers: authHeaders() });
            if (!res.ok) throw new Error('Failed to load projects');
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.projects ?? []);
            setProjects(list.map(mapProject));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load projects');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchProjects(); }, [fetchProjects]);

    const publicChannel = projects.find(p => p.id === 'public-group');
    const myProjects    = projects.filter(p => !p.isDefaultGroup && !p.is_system_card);
    const displayed     = filter === 'ALL' ? myProjects : myProjects.filter(p => p.status === filter);

    const activeCount   = myProjects.filter(p => p.status === 'ACTIVE').length;
    const doneCount     = myProjects.filter(p => p.status === 'COMPLETED').length;
    const avgProgress   = myProjects.length
        ? Math.round(myProjects.reduce((s, p) => s + p.progress, 0) / myProjects.length)
        : 0;

    const FILTERS = ['ALL', 'ACTIVE', 'ON HOLD', 'COMPLETED'] as const;

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="My Projects" />

                <main className="page-main p-8 space-y-8">

                    {/* ── Greeting banner ───────────────────────────────── */}
                    <div
                        className="relative overflow-hidden rounded-2xl px-8 py-7 text-white"
                        style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 45%, #0284c7 100%)', boxShadow: '0 8px 32px rgba(5,150,105,0.30)' }}
                    >
                        <div className="pointer-events-none absolute inset-0 opacity-20"
                            style={{ background: 'radial-gradient(ellipse at 15% 40%, rgba(255,255,255,0.35) 0%, transparent 65%)' }} />
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-white/60 text-sm font-medium mb-1">Welcome back</p>
                                <h2 className="text-2xl font-black tracking-tight">{userName}</h2>
                                <p className="text-white/70 text-sm mt-1">
                                    You have <span className="font-bold text-white">{myProjects.length}</span> project{myProjects.length !== 1 ? 's' : ''} assigned to you.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void fetchProjects()}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors"
                            >
                                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* ── Summary stat strip ────────────────────────────── */}
                    {!loading && (
                        <div className="grid grid-cols-4 gap-4">
                            {[
                                { label: 'Total',        value: myProjects.length,   color: 'text-text-dark dark:text-white'              },
                                { label: 'Active',       value: activeCount,          color: 'text-emerald-600 dark:text-emerald-400'      },
                                { label: 'Done',         value: doneCount,            color: 'text-primary'                                },
                                { label: 'Avg Progress', value: `${avgProgress}%`,   color: 'text-violet-600 dark:text-violet-400'         },
                            ].map(s => (
                                <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wide">{s.label}</span>
                                    <span className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Public channel shortcut ───────────────────────── */}
                    {!loading && publicChannel && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-xs font-bold uppercase tracking-widest text-text-gray dark:text-gray-400">Workspace Channel</span>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            </div>
                            <div
                                onClick={() => navigate('/taskflow?projectId=public-group')}
                                className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl"
                                style={{
                                    background: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 45%, #2563eb 100%)',
                                    boxShadow: '0 8px 32px rgba(109,40,217,0.30)',
                                }}
                            >
                                <div className="pointer-events-none absolute inset-0 opacity-25"
                                    style={{ background: 'radial-gradient(ellipse at 15% 30%, rgba(255,255,255,0.25) 0%, transparent 65%)' }} />
                                <div className="pointer-events-none select-none absolute -right-3 -bottom-5 text-[120px] font-black leading-none"
                                    style={{ color: 'rgba(255,255,255,0.07)', fontFamily: 'monospace' }}>#</div>
                                <div className="relative z-10 flex items-center justify-between px-7 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/90" />
                                            </span>
                                            <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Public Channel</span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-white/40 text-3xl font-black leading-none" style={{ fontFamily: 'monospace' }}>#</span>
                                            <span className="text-white text-xl font-black tracking-tight">public</span>
                                        </div>
                                        <p className="text-white/60 text-xs hidden md:block">Open task channel for all workspace members</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-white/15 group-hover:bg-white/25 transition-colors rounded-full px-4 py-2">
                                        <span className="text-white text-xs font-bold">Open</span>
                                        <svg className="w-3 h-3 text-white group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Filter tabs ───────────────────────────────────── */}
                    <div className="flex items-center gap-2">
                        {FILTERS.map(f => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                    filter === f
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-text-gray dark:text-gray-400 hover:border-primary hover:text-primary'
                                }`}
                            >
                                {f === 'ALL' ? `All (${myProjects.length})` : f}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {/* ── Project cards grid ────────────────────────────── */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-56 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : displayed.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center text-sm text-text-gray dark:text-gray-400">
                            {filter === 'ALL'
                                ? 'No projects assigned to you yet. Ask your admin or sub-manager to add you to a project.'
                                : `No ${filter.toLowerCase()} projects.`}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {displayed.map((project, pIdx) => {
                                const cfg = statusConfig[project.status] ?? statusConfig.ACTIVE;
                                const memberCount = (project.staffIds?.length ?? 0) + (project.subManagerIds?.length ?? 0);
                                return (
                                    <div
                                        key={project.id}
                                        onClick={() => navigate(`/taskflow?projectId=${project.id}`)}
                                        className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                                    >
                                        {/* Status accent strip */}
                                        <div className={`absolute top-0 left-0 right-0 h-0.5 ${cfg.accent}`} />

                                        <div className="p-6">
                                            {/* Top row */}
                                            <div className="flex items-start justify-between mb-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {project.status}
                                                </span>
                                                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                            </div>

                                            {/* Title + description */}
                                            <h3 className="text-base font-bold text-text-dark dark:text-white mb-1.5 truncate">{project.title}</h3>
                                            <p className="text-xs text-text-gray dark:text-gray-400 line-clamp-2 mb-5">{project.description}</p>

                                            {/* Progress bar */}
                                            {project.progress > 0 ? (
                                                <div className="mb-4">
                                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                                        <span className="text-text-gray dark:text-gray-400">Progress</span>
                                                        <span className={`font-bold ${project.progress === 100 ? 'text-success' : 'text-text-dark dark:text-gray-200'}`}>
                                                            {project.progress === 100 ? '✓ Done' : `${project.progress}%`}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${project.progress === 100 ? 'bg-success' : 'bg-primary'}`}
                                                            style={{ width: `${project.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mb-4 h-[28px] flex items-center">
                                                    <span className="text-xs text-text-gray dark:text-gray-500 italic">No tasks completed yet</span>
                                                </div>
                                            )}

                                            {/* Footer: avatars + member count */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex -space-x-1.5">
                                                    {project.team.slice(0, 4).map((m, idx) => (
                                                        <div
                                                            key={m}
                                                            className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(pIdx + idx)} border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[8px] font-bold`}
                                                        >
                                                            {m}
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-xs text-text-gray dark:text-gray-400 flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                                                    </svg>
                                                    {memberCount} member{memberCount !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Hover CTA */}
                                        <div className="absolute inset-0 flex items-end justify-center pb-5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                            <span className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                                                Open Task Board →
                                            </span>
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
