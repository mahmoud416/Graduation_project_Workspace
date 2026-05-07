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
    const staffEntries = Array.isArray(proj.staff) ? proj.staff : [];
    const subManagerNames = subManagerEntries.map((e: any) => e?.name).filter(Boolean);
    const subManagerIds = subManagerEntries.map((e: any) => e?._id || e?.id).filter((v: any) => typeof v === 'string');
    const staffIds = staffEntries.map((e: any) => e?._id || e?.id).filter((v: any) => typeof v === 'string');
    const staffInitials: string[] = Array.isArray(proj.staff_initials) ? proj.staff_initials : [];
    const subInitials = subManagerEntries.map((e: any) => e?.initials).filter(Boolean);
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

const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
    if (status === 'ON HOLD') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    return 'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300';
};

const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

// ─── SubAdminPortal ─────────────────────────────────────────────────────────

const SubAdminPortal = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<(Project & { is_system_card?: boolean })[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const userName = localStorage.getItem('userName') || localStorage.getItem('name') || 'Sub Manager';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
            setError(err instanceof Error ? err.message : 'Could not load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchProjects(); }, [fetchProjects]);

    // ── Derived stats ────────────────────────────────────────────────────────
    const channelProjects = projects.filter(p => p.isDefaultGroup || p.is_system_card);
    const myProjects = projects.filter(p => !p.isDefaultGroup && !p.is_system_card);
    const activeProjects = myProjects.filter(p => p.status === 'ACTIVE');
    const avgProgress = myProjects.length
        ? Math.round(myProjects.reduce((s, p) => s + p.progress, 0) / myProjects.length)
        : 0;
    const totalMembers = myProjects.reduce((s, p) => s + (p.staffIds?.length ?? 0) + (p.subManagerIds?.length ?? 0), 0);

    const stats = [
        {
            label: 'My Projects',
            value: myProjects.length,
            sub: `${activeProjects.length} active`,
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
            ),
            accent: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
            bar: null,
        },
        {
            label: 'Team Members',
            value: totalMembers,
            sub: 'across all projects',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
            ),
            accent: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
            bar: null,
        },
        {
            label: 'Avg Completion',
            value: `${avgProgress}%`,
            sub: avgProgress === 100 ? '✓ All done!' : `${100 - avgProgress}% remaining`,
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
            ),
            accent: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
            bar: avgProgress,
        },
        {
            label: 'Channels Access',
            value: channelProjects.length,
            sub: 'workspace channels',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
            ),
            accent: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
            bar: null,
        },
    ];

    // ── Channel card gradient ────────────────────────────────────────────────
    const channelStyle = (id: string) =>
        id === 'public-group'
            ? { background: 'linear-gradient(135deg,#6d28d9 0%,#4f46e5 45%,#2563eb 100%)', boxShadow: '0 6px 24px rgba(109,40,217,0.28)' }
            : { background: 'linear-gradient(135deg,#c2410c 0%,#ea580c 45%,#f59e0b 100%)', boxShadow: '0 6px 24px rgba(194,65,12,0.28)' };

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Dashboard" />

                <main className="page-main p-8 space-y-8">

                    {/* ── Greeting banner ──────────────────────────────── */}
                    <div
                        className="relative overflow-hidden rounded-2xl p-7 text-white"
                        style={{ background: 'linear-gradient(135deg,#6d28d9 0%,#4f46e5 40%,#2563eb 100%)', boxShadow: '0 8px 32px rgba(109,40,217,0.25)' }}
                    >
                        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 10% 30%, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
                        <div className="pointer-events-none select-none absolute -right-6 -bottom-8 text-[160px] font-black leading-none opacity-[0.06]" style={{ fontFamily: 'monospace' }}>#</div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-white/65 text-xs font-semibold uppercase tracking-widest mb-1">{today}</p>
                                <h1 className="text-2xl font-black text-white mb-1">Welcome back, {userName}</h1>
                                <p className="text-white/70 text-sm">Sub-Manager · Manage your projects and coordinate your team</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/projects')}
                                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-4 py-2.5 text-white text-sm font-bold"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                                </svg>
                                All Projects
                            </button>
                        </div>
                    </div>

                    {/* ── Error / loading ───────────────────────────────── */}
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {/* ── Stats cards ───────────────────────────────────── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        {stats.map((stat) => (
                            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wide">{stat.label}</span>
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.accent}`}>
                                        {stat.icon}
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-text-dark dark:text-white mb-1 tabular-nums">
                                    {loading ? '—' : stat.value}
                                </div>
                                <p className="text-xs text-text-gray dark:text-gray-400">{stat.sub}</p>
                                {stat.bar !== null && !loading && (
                                    <div className="mt-3 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${stat.bar === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}
                                            style={{ width: `${stat.bar}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* ── Workspace Channels ───────────────────────────── */}
                    {!loading && channelProjects.length > 0 && (
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                                    </svg>
                                    <span className="text-xs font-bold uppercase tracking-widest text-text-gray dark:text-gray-400">Workspace Channels</span>
                                </div>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {channelProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => navigate(`/taskflow?projectId=${project.id}`)}
                                        className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                                        style={channelStyle(project.id)}
                                    >
                                        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 15% 30%, rgba(255,255,255,0.22) 0%, transparent 65%)' }} />
                                        <div className="pointer-events-none select-none absolute -right-3 -bottom-5 text-[130px] font-black leading-none" style={{ color: 'rgba(255,255,255,0.07)', fontFamily: 'monospace' }}>#</div>
                                        <div className="relative z-10 flex flex-col p-6 min-h-[170px]">
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="relative flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/90" />
                                                </span>
                                                <span className="text-white/70 text-[11px] font-bold uppercase tracking-widest">
                                                    {project.id === 'public-group' ? 'Public Channel' : 'Admin Channel'}
                                                </span>
                                            </div>
                                            <div className="flex items-end gap-1.5 mb-2">
                                                <span className="text-white/35 text-5xl font-black leading-none" style={{ fontFamily: 'monospace' }}>#</span>
                                                <h3 className="text-white text-xl font-black tracking-tight leading-none mb-1">
                                                    {project.id === 'public-group' ? 'public' : 'all-sub-manager'}
                                                </h3>
                                            </div>
                                            <p className="text-white/60 text-xs leading-relaxed line-clamp-2 mb-auto">{project.description}</p>
                                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15">
                                                <span className="text-white/65 text-xs">
                                                    {project.id === 'public-group' ? 'All workspace members' : 'Sub-managers only'}
                                                </span>
                                                <div className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1">
                                                    <span className="text-white text-xs font-bold">Open</span>
                                                    <svg className="w-3 h-3 text-white group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── My Projects ──────────────────────────────────── */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                                </svg>
                                <span className="text-xs font-bold uppercase tracking-widest text-text-gray dark:text-gray-400">My Projects</span>
                            </div>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            <button
                                type="button"
                                onClick={() => navigate('/taskmaster')}
                                className="text-xs font-semibold text-primary hover:underline"
                            >
                                Task Master →
                            </button>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-44 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : myProjects.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-sm text-text-gray dark:text-gray-400">
                                No projects assigned yet. Ask your admin to assign you as sub-manager to a project.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {myProjects.map((project, pIdx) => {
                                    const statusAccent = project.status === 'ACTIVE' ? 'bg-primary' : project.status === 'ON HOLD' ? 'bg-warning' : 'bg-success';
                                    const badgeClass = getStatusBadge(project.status);
                                    return (
                                        <div
                                            key={project.id}
                                            onClick={() => navigate(`/taskflow?projectId=${project.id}`)}
                                            className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                                        >
                                            <div className={`absolute top-0 left-0 right-0 h-0.5 ${statusAccent}`} />
                                            <div className="p-5">
                                                <div className="flex items-start justify-between mb-3">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>
                                                        {project.status}
                                                    </span>
                                                    <span className="text-xs text-text-gray dark:text-gray-400">{relativeTime(project.updatedAt)}</span>
                                                </div>
                                                <h3 className="text-sm font-bold text-text-dark dark:text-white mb-1.5 truncate">{project.title}</h3>
                                                <p className="text-xs text-text-gray dark:text-gray-400 line-clamp-2 mb-4">{project.description}</p>

                                                {project.progress > 0 && (
                                                    <div className="mb-4">
                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                            <span className="text-text-gray dark:text-gray-400 font-medium">Progress</span>
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
                                                )}

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
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                                                        </svg>
                                                        {(project.staffIds?.length ?? 0) + (project.subManagerIds?.length ?? 0)} members
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                </main>
            </div>
        </div>
    );
};

export default SubAdminPortal;
