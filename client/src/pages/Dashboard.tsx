import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

// ─── Helpers ────────────────────────────────────────────────────────────────

type UserEntry = { _id: string; name: string; email: string; role: string };

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

// ─── Staff view (unchanged) ──────────────────────────────────────────────────

// ─── Staff Dashboard ─────────────────────────────────────────────────────────

const STAFF_SAMPLE_PROJECTS: Project[] = [
    { id: 'social-assets', title: 'Social Media Assets', description: 'Standard templates and brand assets for multi-channel distribution.', status: 'ACTIVE', progress: 82, team: ['ED', 'JN', 'SK'], updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), updatedAtRaw: new Date(Date.now() - 35 * 60 * 1000).toISOString(), subAdminName: 'Emily Davis', subAdminNames: [], subAdminIds: [], staffIds: [] },
    { id: 'q4-campaign',    title: 'Q4 Marketing Campaign',  description: 'Developing cross-channel strategies for year-end growth.',              status: 'ACTIVE',  progress: 65,  team: ['AN', 'SV', 'VL'], updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), updatedAtRaw: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), subAdminName: 'Alex Morgan', subAdminNames: [], subAdminIds: [], staffIds: [] },
    { id: 'customer-portal', title: 'Customer Portal Update', description: 'Improving self-service tools for enterprise clients.',                  status: 'ACTIVE',  progress: 45,  team: ['NB', 'OC', 'WR'], updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), updatedAtRaw: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), subAdminName: 'Nora Blake', subAdminNames: [], subAdminIds: [], staffIds: [] },
    { id: 'annual-audit',   title: 'Annual Audit 2023',       description: 'Year-end financial and compliance review.',                             status: 'COMPLETED', progress: 100, team: ['FK', 'DZ'],        updatedAt: new Date('2023-10-20').toISOString(),                  updatedAtRaw: new Date('2023-10-20').toISOString(),                  subAdminName: 'Finance Pod',  subAdminNames: [], subAdminIds: [], staffIds: [] },
];

const StaffProjectAssignments = () => {
    const [projects, setProjects] = useState<(Project & { is_system_card?: boolean })[]>(STAFF_SAMPLE_PROJECTS);
    const [usingSampleData, setUsingSampleData] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<'updated' | 'name' | 'progress'>('updated');
    const navigate = useNavigate();

    const userName = localStorage.getItem('userName') || localStorage.getItem('name') || 'Staff Member';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const fetchProjects = useCallback(async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) { setUsingSampleData(true); return; }
        try {
            const res = await fetch(`${API_BASE}/projects`, { headers: authHeaders() });
            if (!res.ok) throw new Error();
            const payload = await res.json();
            const list = Array.isArray(payload) ? payload : (payload.projects ?? []);
            if (list.length === 0) { setUsingSampleData(true); return; }
            setProjects(list.map(mapProject));
            setUsingSampleData(false);
        } catch { setUsingSampleData(true); }
    }, []);

    useEffect(() => { void fetchProjects(); }, [fetchProjects]);

    const sorted = useMemo(() => {
        const filtered = searchQuery.trim()
            ? projects.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
            : [...projects];
        if (sortOption === 'name')     return filtered.sort((a, b) => a.title.localeCompare(b.title));
        if (sortOption === 'progress') return filtered.sort((a, b) => b.progress - a.progress);
        return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }, [projects, searchQuery, sortOption]);

    const channelProjects = sorted.filter(p => p.isDefaultGroup || p.is_system_card);
    // Staff only sees public channel (not all-sub-admin)
    const publicChannel = channelProjects.find(p => p.id === 'public-group');
    const myProjects    = sorted.filter(p => !p.isDefaultGroup && !p.is_system_card);

    const activeCount    = myProjects.filter(p => p.status === 'ACTIVE').length;
    const completedCount = myProjects.filter(p => p.status === 'COMPLETED').length;
    const avgProgress    = myProjects.length
        ? Math.round(myProjects.reduce((s, p) => s + p.progress, 0) / myProjects.length)
        : 0;

    const statusAccent = (s: string) => s === 'ACTIVE' ? 'bg-primary' : s === 'ON HOLD' ? 'bg-warning' : 'bg-success';

    return (
        <main className="page-main p-8 space-y-8">

            {/* ── Greeting banner ──────────────────────────────────────── */}
            <div
                className="relative overflow-hidden rounded-2xl p-7 text-white"
                style={{
                    background: 'linear-gradient(135deg, #059669 0%, #0d9488 45%, #0284c7 100%)',
                    boxShadow: '0 8px 32px rgba(5,150,105,0.22)',
                }}
            >
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 10% 30%, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
                <div className="pointer-events-none select-none absolute -right-6 -bottom-8 text-[160px] font-black leading-none" style={{ color: 'rgba(255,255,255,0.06)', fontFamily: 'monospace' }}>✓</div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <p className="text-white/65 text-xs font-semibold uppercase tracking-widest mb-1">{today}</p>
                        <h1 className="text-2xl font-black text-white mb-1">Welcome back, {userName}</h1>
                        <p className="text-white/70 text-sm">Staff · View your projects and check off your tasks</p>
                    </div>
                    {usingSampleData && (
                        <span className="bg-white/15 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full">Demo data</span>
                    )}
                </div>
            </div>

            {/* ── Stats strip ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'My Groups',    value: myProjects.length,  icon: '🗂', accent: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',     sub: 'total assigned' },
                    { label: 'Active',       value: activeCount,        icon: '▶', accent: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',                sub: 'in progress' },
                    { label: 'Completed',    value: completedCount,     icon: '✓', accent: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400', sub: 'finished' },
                    { label: 'Avg Progress', value: `${avgProgress}%`, icon: '📊', accent: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',       sub: avgProgress === 100 ? 'All done!' : 'overall' },
                ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wide">{s.label}</span>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${s.accent}`}>{s.icon}</div>
                        </div>
                        <div className="text-3xl font-black text-text-dark dark:text-white tabular-nums">{s.value}</div>
                        <p className="text-xs text-text-gray dark:text-gray-400 mt-1">{s.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Public channel shortcut ──────────────────────────────── */}
            {publicChannel && (
                <div
                    className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
                    style={{
                        background: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 45%, #2563eb 100%)',
                        boxShadow: '0 6px 20px rgba(109,40,217,0.22)',
                    }}
                    onClick={() => navigate(`/taskflow?projectId=public-group`)}
                >
                    <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 10% 40%, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
                    <div className="pointer-events-none select-none absolute -right-3 -bottom-4 text-[110px] font-black leading-none" style={{ color: 'rgba(255,255,255,0.07)', fontFamily: 'monospace' }}>#</div>
                    <div className="relative z-10 flex items-center justify-between px-7 py-5">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/90" />
                                </span>
                                <span className="text-white/70 text-[11px] font-bold uppercase tracking-widest">Public Channel · Live</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div>
                                <span className="text-white/50 text-3xl font-black leading-none" style={{ fontFamily: 'monospace' }}>#</span>
                                <span className="text-white text-lg font-black ml-1">public</span>
                            </div>
                            <p className="text-white/60 text-xs max-w-[260px] line-clamp-1 hidden md:block">{publicChannel.description}</p>
                            <div className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-4 py-2 ml-2">
                                <span className="text-white text-xs font-bold">Open</span>
                                <svg className="w-3 h-3 text-white group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── My Groups ────────────────────────────────────────────── */}
            <section>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-widest text-text-gray dark:text-gray-400">My Groups</span>
                        </div>
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                        <span className="text-xs text-text-gray dark:text-gray-400">{myProjects.length} group{myProjects.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search groups…"
                                className="h-9 w-44 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-text-dark dark:text-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                            />
                            <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-gray" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <select
                            value={sortOption}
                            onChange={e => setSortOption(e.target.value as typeof sortOption)}
                            className="h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-xs font-semibold text-text-dark dark:text-gray-200"
                        >
                            <option value="updated">Recent</option>
                            <option value="name">A–Z</option>
                            <option value="progress">Progress</option>
                        </select>
                    </div>
                </div>

                {myProjects.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-sm text-text-gray dark:text-gray-400">
                        You haven't been assigned to any project groups yet. Your admin will add you soon.
                    </div>
                ) : (
                    <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {myProjects.map((project, pIdx) => (
                            <article
                                key={project.id}
                                onClick={() => navigate(`/taskflow?projectId=${project.id}`)}
                                className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                            >
                                <div className={`absolute top-0 left-0 right-0 h-0.5 ${statusAccent(project.status)}`} />
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${getStatusBadge(project.status)}`}>
                                            {project.status}
                                        </span>
                                        <span className="text-xs text-text-gray dark:text-gray-400">{relativeTime(project.updatedAtRaw ?? project.updatedAt)}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-text-dark dark:text-white mb-2 truncate">{project.title}</h3>
                                    <p className="text-sm text-text-gray dark:text-gray-400 mb-4 line-clamp-2">{project.description}</p>

                                    {project.progress > 0 ? (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                <span className="text-text-gray dark:text-gray-400 font-medium">Progress</span>
                                                <span className={`font-bold ${project.progress === 100 ? 'text-success' : 'text-text-dark dark:text-gray-200'}`}>
                                                    {project.progress === 100 ? '✓ Done' : `${project.progress}%`}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${project.progress === 100 ? 'bg-success' : getProgressColor(project.status)}`}
                                                    style={{ width: `${project.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mb-4 h-7 flex items-center">
                                            <span className="text-xs text-text-gray dark:text-gray-500 italic">No tasks completed yet</span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <div className="flex -space-x-1.5">
                                            {project.team.slice(0, 4).map((m, i) => (
                                                <div key={i} className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(pIdx + i)} border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[8px] font-bold`}>{m}</div>
                                            ))}
                                            {project.team.length > 4 && (
                                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-semibold text-text-gray">
                                                    +{project.team.length - 4}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            Open board
                                            <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                        </span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

        </main>
    );
};



const AdminDashboard = () => {
    const navigate = useNavigate();
    const adminName = localStorage.getItem('fullName') || localStorage.getItem('email') || 'Admin';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [projects, setProjects] = useState<(Project & { is_system_card?: boolean })[]>([]);
    const [users, setUsers] = useState<UserEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [projRes, userRes] = await Promise.all([
                fetch(`${API_BASE}/projects`, { headers: authHeaders() }),
                fetch(`${API_BASE}/users`, { headers: authHeaders() }),
            ]);
            if (projRes.ok) {
                const data = await projRes.json();
                if (Array.isArray(data)) setProjects(data.map(mapProject));
            }
            if (userRes.ok) {
                const data = await userRes.json();
                if (Array.isArray(data)) setUsers(data);
            }
        } catch (err) {
            setError('Unable to load dashboard data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Computed analytics ────────────────────────────────────────────────────

    const systemCards = useMemo(() => projects.filter(p => p.isDefaultGroup || p.is_system_card), [projects]);
    const customProjects = useMemo(() => projects.filter(p => !p.isDefaultGroup && !p.is_system_card), [projects]);

    const activeCount    = useMemo(() => customProjects.filter(p => p.status === 'ACTIVE').length, [customProjects]);
    const onHoldCount    = useMemo(() => customProjects.filter(p => p.status === 'ON HOLD').length, [customProjects]);
    const completedCount = useMemo(() => customProjects.filter(p => p.status === 'COMPLETED').length, [customProjects]);
    const totalCustom    = customProjects.length;

    const avgProgress = useMemo(() =>
        totalCustom ? Math.round(customProjects.reduce((s, p) => s + p.progress, 0) / totalCustom) : 0,
    [customProjects, totalCustom]);

    const subAdmins = useMemo(() => users.filter(u => u.role === 'sub_admin'), [users]);
    const staffMembers = useMemo(() => users.filter(u => u.role === 'staff'), [users]);
    const totalMembers = useMemo(() => users.filter(u => u.role !== 'admin').length, [users]);

    const recentProjects = useMemo(() =>
        [...customProjects].sort((a, b) => new Date(b.updatedAtRaw ?? b.updatedAt).getTime() - new Date(a.updatedAtRaw ?? a.updatedAt).getTime()).slice(0, 6),
    [customProjects]);

    const statBar = (count: number, total: number) => total === 0 ? 0 : Math.round((count / total) * 100);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <main className="page-main p-6 lg:p-8">
            {/* ── Welcome Banner ────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-text-gray dark:text-gray-400 mb-1">Hericle Workspace</p>
                    <h1 className="text-3xl font-bold text-text-dark dark:text-white">
                        Welcome back, <span className="text-primary">{adminName}</span>
                    </h1>
                    <p className="text-sm text-text-gray dark:text-gray-400 mt-1">{today}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => navigate('/projects')} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 5v14m7-7H5" /></svg>
                        New Project
                    </button>
                    <button type="button" onClick={() => navigate('/configuration')} className="h-10 px-5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-text-dark dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                        Configure
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            {/* ── Stats Row ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Total Projects */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-gray dark:text-gray-400">Total Projects</p>
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 7h18M3 12h18M3 17h18" /></svg>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-text-dark dark:text-white">{loading ? '—' : totalCustom}</div>
                    <p className="text-xs text-text-gray dark:text-gray-400 mt-1">{completedCount} completed</p>
                </div>

                {/* Total Members */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-gray dark:text-gray-400">Team Members</p>
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-text-dark dark:text-white">{loading ? '—' : totalMembers}</div>
                    <p className="text-xs text-text-gray dark:text-gray-400 mt-1">{subAdmins.length} sub-admins · {staffMembers.length} staff</p>
                </div>

                {/* Active Projects */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-gray dark:text-gray-400">Active Projects</p>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-text-dark dark:text-white">{loading ? '—' : activeCount}</div>
                    <p className="text-xs text-text-gray dark:text-gray-400 mt-1">{onHoldCount} on hold</p>
                </div>

                {/* Avg Progress */}
                <div className="bg-primary rounded-2xl p-5 text-white">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Avg Progress</p>
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        </div>
                    </div>
                    <div className="text-3xl font-bold">{loading ? '—' : `${avgProgress}%`}</div>
                    <div className="mt-2 w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all" style={{ width: `${avgProgress}%` }} />
                    </div>
                </div>
            </div>

            {/* ── System Cards ──────────────────────────────────────────────── */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-text-dark dark:text-white">System Channels</h2>
                    <span className="text-xs text-text-gray dark:text-gray-400">Auto-managed cards · cannot be deleted</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Public Card */}
                    <div
                        className="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all"
                        onClick={() => navigate('/taskflow?projectId=public-group')}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-primary">Public Card</p>
                                    <h3 className="text-base font-bold text-text-dark dark:text-white">Public</h3>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-bold text-blue-700 dark:text-blue-300">System</span>
                        </div>
                        <p className="text-sm text-text-gray dark:text-gray-300 mb-3 line-clamp-2">
                            {systemCards.find(c => c.id === 'public-group')?.description ?? 'Open channel — every workspace member can access shared tasks and updates.'}
                        </p>
                        <div className="flex items-center justify-between text-xs text-text-gray dark:text-gray-400">
                            <span className="font-medium text-primary group-hover:underline">Open board →</span>
                            <span>{totalMembers} members access</span>
                        </div>
                    </div>

                    {/* All_SubAdmin Card */}
                    <div
                        className="group bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all"
                        onClick={() => navigate('/taskflow?projectId=all-sub-admin')}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-purple-600">SubAdmin Card</p>
                                    <h3 className="text-base font-bold text-text-dark dark:text-white">All_SubAdmin</h3>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-xs font-bold text-purple-700 dark:text-purple-300">System</span>
                        </div>
                        <p className="text-sm text-text-gray dark:text-gray-300 mb-3 line-clamp-2">
                            {systemCards.find(c => c.id === 'all-sub-admin')?.description ?? 'Restricted channel — sub-admins only. Coordination hub for project leads.'}
                        </p>
                        <div className="flex items-center justify-between text-xs text-text-gray dark:text-gray-400">
                            <span className="font-medium text-purple-600 group-hover:underline">Open board →</span>
                            <span>{subAdmins.length} sub-admins access</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main Grid: Projects + Analytics ───────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

                {/* Projects Grid (2/3 width) */}
                <div className="xl:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-text-dark dark:text-white">
                            Custom Projects
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-text-gray dark:text-gray-300">{totalCustom}</span>
                        </h2>
                        <button type="button" onClick={() => navigate('/projects')} className="text-sm font-semibold text-primary hover:underline">View all →</button>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
                                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-600 rounded mb-4" />
                                    <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-600 rounded mb-2" />
                                    <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded mb-1" />
                                    <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-700 rounded mb-4" />
                                    <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : recentProjects.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-sm text-text-gray dark:text-gray-400">
                            No custom projects yet.{' '}
                            <button type="button" onClick={() => navigate('/projects')} className="text-primary font-semibold hover:underline">Create one →</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recentProjects.map(project => {
                                const leadLabel = project.subAdminNames?.length
                                    ? (project.subAdminNames.length === 1 ? `Lead · ${project.subAdminNames[0]}` : `Leads · ${project.subAdminNames.slice(0, 2).join(', ')}${project.subAdminNames.length > 2 ? ` +${project.subAdminNames.length - 2}` : ''}`)
                                    : null;
                                return (
                                    <div
                                        key={project.id}
                                        onClick={() => navigate(`/taskflow?projectId=${project.id}`)}
                                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${getStatusBadge(project.status)}`}>
                                                {project.status}
                                            </span>
                                            <span className="text-xs text-text-gray dark:text-gray-400">{relativeTime(project.updatedAtRaw ?? project.updatedAt)}</span>
                                        </div>
                                        <h3 className="text-sm font-bold text-text-dark dark:text-white mb-1">{project.title}</h3>
                                        <p className="text-xs text-text-gray dark:text-gray-400 mb-1 line-clamp-1">{project.description}</p>
                                        {leadLabel && <p className="text-xs text-text-gray dark:text-gray-400 mb-3">{leadLabel}</p>}
                                        <div className="mt-3">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-text-gray dark:text-gray-400">Progress</span>
                                                <span className="font-semibold text-text-dark dark:text-gray-200">{project.progress}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div className={`h-full ${getProgressColor(project.status)} transition-all`} style={{ width: `${project.progress}%` }} />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <div className="flex -space-x-2">
                                                {project.team.slice(0, 3).map((m, i) => (
                                                    <div key={i} className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(i)} border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[9px] font-semibold`}>{m}</div>
                                                ))}
                                                {project.team.length > 3 && <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[9px] font-semibold text-text-gray">+{project.team.length - 3}</div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Analytics Sidebar (1/3 width) */}
                <div className="space-y-5">
                    {/* Status Distribution */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                        <h3 className="text-sm font-bold text-text-dark dark:text-white mb-4">Project Status</h3>
                        <div className="space-y-4">
                            {[
                                { label: 'Active', count: activeCount, bar: statBar(activeCount, totalCustom), color: 'bg-primary', text: 'text-primary' },
                                { label: 'On Hold', count: onHoldCount, bar: statBar(onHoldCount, totalCustom), color: 'bg-amber-400', text: 'text-amber-600' },
                                { label: 'Completed', count: completedCount, bar: statBar(completedCount, totalCustom), color: 'bg-emerald-500', text: 'text-emerald-600' },
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <span className="font-medium text-text-dark dark:text-gray-200">{item.label}</span>
                                        <span className={`font-bold ${item.text}`}>{loading ? '—' : `${item.count} (${item.bar}%)`}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: loading ? '0%' : `${item.bar}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Donut-style visual summary */}
                        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around text-center">
                            <div>
                                <div className="text-xl font-bold text-primary">{loading ? '—' : totalCustom}</div>
                                <div className="text-[10px] text-text-gray dark:text-gray-400">Total</div>
                            </div>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />
                            <div>
                                <div className="text-xl font-bold text-emerald-600">{loading ? '—' : completedCount}</div>
                                <div className="text-[10px] text-text-gray dark:text-gray-400">Done</div>
                            </div>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />
                            <div>
                                <div className="text-xl font-bold text-primary">{loading ? '—' : `${avgProgress}%`}</div>
                                <div className="text-[10px] text-text-gray dark:text-gray-400">Avg</div>
                            </div>
                        </div>
                    </div>

                    {/* Team Breakdown */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-text-dark dark:text-white">Sub-Admin Leads</h3>
                            <button type="button" onClick={() => navigate('/configuration')} className="text-xs font-semibold text-primary hover:underline">Manage</button>
                        </div>
                        {loading ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />)}
                            </div>
                        ) : subAdmins.length === 0 ? (
                            <p className="text-xs text-text-gray dark:text-gray-400">No sub-admins created yet.</p>
                        ) : (
                            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                                {subAdmins.map((u, i) => (
                                    <div key={u._id} className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(i)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                                            {(u.name || u.email || 'SA').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-text-dark dark:text-gray-200 truncate">{u.name || u.email}</div>
                                            <div className="text-[10px] text-text-gray dark:text-gray-400 truncate">{u.email}</div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-[10px] font-bold text-purple-700 dark:text-purple-300">Lead</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
                            <span className="text-text-gray dark:text-gray-400">Staff members</span>
                            <span className="font-bold text-text-dark dark:text-gray-200">{loading ? '—' : staffMembers.length}</span>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                        <h3 className="text-sm font-bold text-text-dark dark:text-white mb-4">Quick Actions</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Create new project', icon: 'M12 5v14m7-7H5', color: 'text-primary bg-blue-50 dark:bg-blue-900/20', path: '/projects' },
                                { label: 'Add team member', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', path: '/configuration' },
                                { label: 'View all projects', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', path: '/projects' },
                                { label: 'Open public channel', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', path: '/taskflow?projectId=public-group' },
                            ].map(action => (
                                <button
                                    key={action.label}
                                    type="button"
                                    onClick={() => navigate(action.path)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${action.color}`}>
                                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d={action.icon} /></svg>
                                    </div>
                                    <span className="text-sm font-medium text-text-dark dark:text-gray-200">{action.label}</span>
                                    <svg className="w-4 h-4 text-text-gray dark:text-gray-400 ml-auto" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5l7 7-7 7" /></svg>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── All Members Table ─────────────────────────────────────────── */}
            {!loading && users.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-base font-bold text-text-dark dark:text-white">Workspace Members</h2>
                        <button type="button" onClick={() => navigate('/configuration')} className="text-sm font-semibold text-primary hover:underline">Manage accounts →</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left text-xs font-semibold uppercase text-text-gray dark:text-gray-400 pb-3 pr-4">Member</th>
                                    <th className="text-left text-xs font-semibold uppercase text-text-gray dark:text-gray-400 pb-3 pr-4">Email</th>
                                    <th className="text-left text-xs font-semibold uppercase text-text-gray dark:text-gray-400 pb-3">Role</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {users.filter(u => u.role !== 'admin').slice(0, 8).map((u, i) => (
                                    <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="py-3 pr-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(i)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                                                    {(u.name || u.email).slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-semibold text-text-dark dark:text-gray-200 truncate max-w-[160px]">{u.name || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 pr-4 text-text-gray dark:text-gray-400 truncate max-w-[200px]">{u.email}</td>
                                        <td className="py-3">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${u.role === 'sub_admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                {u.role === 'sub_admin' ? 'Sub-Admin' : 'Staff'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {users.filter(u => u.role !== 'admin').length > 8 && (
                            <div className="mt-4 text-center">
                                <button type="button" onClick={() => navigate('/configuration')} className="text-sm text-primary font-semibold hover:underline">
                                    View all {users.filter(u => u.role !== 'admin').length} members →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
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
