import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';
import CreateProjectModal from '../components/CreateProjectModal';

const GROUPED_PROJECTS: Project[] = [
    {
        id: 'public-group',
        title: 'Public',
        description: 'Acts as the open task channel where every workspace user can follow shared updates.',
        status: 'ACTIVE',
        progress: 100,
        team: ['PUB', 'ALL'],
        updatedAt: new Date().toISOString(),
        updatedAtRaw: new Date().toISOString(),
        subAdminName: 'All Users',
        subAdminNames: ['All Users']
    },
    {
        id: 'all-sub-admin',
        title: 'All_SubAdmin',
        description: 'Dedicated group holding every sub-admin for oversight and control.',
        status: 'ACTIVE',
        progress: 100,
        team: ['SUB', 'ADM'],
        updatedAt: new Date().toISOString(),
        updatedAtRaw: new Date().toISOString(),
        subAdminName: 'Sub Admin Leads',
        subAdminNames: ['Sub Admin Leads']
    }
];

const Projects = () => {
    const navigate = useNavigate();
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
    const [projects, setProjects] = useState<Project[]>(GROUPED_PROJECTS);
    const [usingSampleData, setUsingSampleData] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<'updated' | 'name' | 'progress'>('updated');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [role, setRole] = useState<string | null>(null);
    const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
    const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setRole(localStorage.getItem('role'));

        return () => {
            if (messageTimer.current) {
                clearTimeout(messageTimer.current);
            }
        };
    }, []);

    const fetchProjects = useCallback(async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setProjects(GROUPED_PROJECTS);
            setUsingSampleData(true);
            setFetchError('Missing admin session. Please log in again.');
            return;
        }

        try {
            setFetchError(null);
            const response = await fetch(`${import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1'}/projects`, {
                headers: { 'X-User-Id': userId },
            });

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Failed to load projects');
            }

            const payload = await response.json();
            if (!Array.isArray(payload) || payload.length === 0) {
                setProjects(GROUPED_PROJECTS);
                setUsingSampleData(true);
                return;
            }

            const mapped: Project[] = payload.map((proj: any) => {
                const subAdminEntries = Array.isArray(proj.sub_admins) ? proj.sub_admins : [];
                const subAdminNames = subAdminEntries
                    .map((entry) => entry?.name)
                    .filter((name): name is string => Boolean(name));

                if (!subAdminNames.length && proj.sub_admin?.name) {
                    subAdminNames.push(proj.sub_admin.name);
                }

                const primaryLead = subAdminNames[0];

                return {
                    id: proj._id,
                    title: proj.title,
                    description: proj.description || 'No description provided',
                    status: proj.status || 'ACTIVE',
                    progress: typeof proj.progress === 'number' ? proj.progress : 0,
                    team: Array.isArray(proj.staff_initials) && proj.staff_initials.length ? proj.staff_initials.slice(0, 5) : ['TM'],
                    updatedAt: proj.updated_at || new Date().toISOString(),
                    updatedAtRaw: proj.updated_at || new Date().toISOString(),
                    subAdminName: primaryLead,
                    subAdminNames,
                };
            });

            if (mapped.length === 0) {
                setProjects(GROUPED_PROJECTS);
                setUsingSampleData(true);
            } else {
                setProjects(mapped);
                setUsingSampleData(false);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
            const message = error instanceof Error ? error.message : 'Unable to load projects';
            setFetchError(message);
            setProjects(GROUPED_PROJECTS);
            setUsingSampleData(true);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const filteredProjects = useMemo(() => {
        return projects.filter((project) => {
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase();
            return (
                project.title.toLowerCase().includes(query) ||
                project.description.toLowerCase().includes(query)
            );
        });
    }, [projects, searchQuery]);

    const sortedProjects = useMemo(() => {
        const next = [...filteredProjects];
        switch (sortOption) {
            case 'name':
                return next.sort((a, b) => a.title.localeCompare(b.title));
            case 'progress':
                return next.sort((a, b) => b.progress - a.progress);
            default:
                return next.sort((a, b) =>
                    new Date(b.updatedAtRaw ?? b.updatedAt).getTime() - new Date(a.updatedAtRaw ?? a.updatedAt).getTime()
                );
        }
    }, [filteredProjects, sortOption]);

    const getStatusColor = (status: string) => {
        if (status === 'ACTIVE') return 'bg-green-100 text-success';
        if (status === 'ON HOLD') return 'bg-orange-100 text-warning';
        if (status === 'COMPLETED') return 'bg-blue-100 text-primary';
        return 'bg-gray-100 text-text-gray';
    };

    const getProgressColor = (status: string) => {
        if (status === 'ACTIVE') return 'bg-primary';
        if (status === 'ON HOLD') return 'bg-warning';
        if (status === 'COMPLETED') return 'bg-success';
        return 'bg-gray-300';
    };

    const getAvatarColor = (index: number) => {
        const colors = [
            'from-purple-400 to-pink-400',
            'from-blue-400 to-cyan-400',
            'from-orange-400 to-red-400',
            'from-green-400 to-teal-400',
        ];
        return colors[index % colors.length];
    };

    const getUpdatedLabel = (project: Project) => {
        const timestamp = new Date(project.updatedAtRaw ?? project.updatedAt);
        if (Number.isNaN(timestamp.getTime())) {
            return project.updatedAt;
        }

        if (project.status === 'COMPLETED') {
            return `Completed ${timestamp.toLocaleString('default', { month: 'short' })} ${timestamp.getDate()}`;
        }

        const diffMs = Date.now() - timestamp.getTime();
        const minutes = Math.round(diffMs / (1000 * 60));
        const hours = Math.round(diffMs / (1000 * 60 * 60));
        const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (minutes < 60) return `Updated ${Math.max(minutes, 1)}m ago`;
        if (hours < 24) return `Updated ${Math.max(hours, 1)}h ago`;
        if (days < 30) return `Updated ${Math.max(days, 1)}d ago`;

        return `Updated ${timestamp.toLocaleString('default', { month: 'short' })} ${timestamp.getDate()}`;
    };

    const getLeadLabel = (names?: string[]) => {
        if (!names || names.length === 0) return null;
        if (names.length === 1) return `Lead · ${names[0]}`;
        const base = names.slice(0, 2).join(', ');
        const extra = names.length > 2 ? ` +${names.length - 2}` : '';
        return `Leads · ${base}${extra}`;
    };

    const canManageProjects = role === 'admin';

    const handleAddProjectClick = () => {
        if (!canManageProjects) {
            setPermissionMessage('Only admins can create new projects. Contact your workspace owner to enable this action.');
            if (messageTimer.current) {
                clearTimeout(messageTimer.current);
            }
            messageTimer.current = setTimeout(() => setPermissionMessage(null), 5000);
            return;
        }
        setPermissionMessage(null);
        setIsCreateProjectOpen(true);
    };

    const activeCount = sortedProjects.length;

    return (
        <div className="flex min-h-screen bg-[#f5f6fb] dark:bg-gray-950">
            <Sidebar />

            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Projects" />

                <main className="page-main pb-10 px-10">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm px-8 py-7">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs font-semibold tracking-wide text-text-gray uppercase">Projects</p>
                                <h1 className="text-3xl font-semibold text-text-dark dark:text-white">Active Initiatives</h1>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    className={`w-10 h-10 rounded-lg border flex items-center justify-center ${viewMode === 'grid' ? 'border-primary text-primary bg-blue-50' : 'border-gray-200 text-text-gray hover:bg-gray-50'}`}
                                    aria-label="Grid view"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <rect x="3" y="3" width="7" height="7" />
                                        <rect x="14" y="3" width="7" height="7" />
                                        <rect x="14" y="14" width="7" height="7" />
                                        <rect x="3" y="14" width="7" height="7" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    className={`w-10 h-10 rounded-lg border flex items-center justify-center ${viewMode === 'list' ? 'border-primary text-primary bg-blue-50' : 'border-gray-200 text-text-gray hover:bg-gray-50'}`}
                                    aria-label="List view"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M8 6h13M8 12h13M8 18h13" />
                                        <path d="M3 6h.01M3 12h.01M3 18h.01" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddProjectClick}
                                    className={`h-10 px-5 rounded-lg text-sm font-semibold text-white ${canManageProjects ? 'bg-primary hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'}`}
                                >
                                    + Create New Project
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <div className="relative flex-1 min-w-[240px] max-w-xl">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search projects..."
                                    className="w-full h-11 pl-12 pr-4 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-text-dark dark:text-gray-200 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                                <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-text-gray" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-text-gray dark:text-gray-400">Sort by:</span>
                                <select
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value as 'updated' | 'name' | 'progress')}
                                    className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 text-text-dark focus:outline-none"
                                >
                                    <option value="updated">Last Updated</option>
                                    <option value="name">Name</option>
                                    <option value="progress">Progress</option>
                                </select>
                            </div>
                        </div>

                        {role === 'admin' && (
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 rounded-2xl border border-dashed border-primary/30 bg-blue-50/60 dark:bg-blue-900/20 px-5 py-4">
                                <div>
                                    <p className="text-sm font-semibold text-primary">Admin access enabled</p>
                                    <p className="text-xs text-text-gray dark:text-gray-300">Create projects and assign sub-admin leads directly from this workspace.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/configuration')}
                                        className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600"
                                    >
                                        Make Account
                                    </button>
                                </div>
                            </div>
                        )}

                        {permissionMessage && (
                            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                {permissionMessage}
                            </div>
                        )}

                        {fetchError && (
                            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {fetchError}
                            </div>
                        )}

                        {usingSampleData && (
                            <div className="mb-4 text-xs text-text-gray dark:text-gray-400">
                                Showing demo data so the layout matches the approved design until live projects sync.
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-text-dark dark:text-white">Active Projects ({activeCount})</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    const targetProject = sortedProjects[0];
                                    if (targetProject) {
                                        navigate(`/taskflow?projectId=${targetProject.id}`);
                                    } else {
                                        navigate('/taskflow');
                                    }
                                }}
                                className="text-xs font-semibold text-primary hover:underline"
                            >
                                View timeline
                            </button>
                        </div>

                        {/* Projects Grid */}
                        <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                            {sortedProjects.map((project) => {
                                const leadLabel = getLeadLabel(project.subAdminNames);
                                const isDefaultGroup = project.id === 'public-group' || project.id === 'all-sub-admin';
                                const badgeClass = isDefaultGroup ? 'bg-purple-100 text-purple-700' : getStatusColor(project.status);
                                return (
                                    <div
                                        key={project.id}
                                        onClick={() => navigate(`/taskflow?projectId=${project.id}`)}
                                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${badgeClass}`}>
                                                {isDefaultGroup ? 'Groub' : project.status}
                                            </span>
                                            {isDefaultGroup ? (
                                                <span className="w-8 h-8" aria-hidden="true" />
                                            ) : (
                                                <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                                    <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>

                                        <h3 className="text-base font-bold text-text-dark dark:text-white mb-2">{project.title}</h3>
                                        <div className="mb-5">
                                            <p className="text-sm text-text-gray dark:text-gray-400 mb-1.5 line-clamp-2">{project.description}</p>
                                            {leadLabel && (
                                                <p className="text-xs text-text-gray dark:text-gray-400">{leadLabel}</p>
                                            )}
                                        </div>

                                        {isDefaultGroup ? (
                                            <div className="pt-3 border-t border-dashed border-gray-200 dark:border-gray-700 text-xs text-text-gray dark:text-gray-400">
                                                System hand-off card connecting the platform with every workspace user.
                                            </div>
                                        ) : (
                                            <>
                                                <div className="mb-4">
                                                    <div className="flex items-center justify-between text-xs mb-2">
                                                        <span className="text-text-gray dark:text-gray-400 font-medium">Progress</span>
                                                        <span className="text-text-dark dark:text-gray-200 font-semibold">{project.progress}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${getProgressColor(project.status)} transition-all`}
                                                            style={{ width: `${project.progress}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex -space-x-2">
                                                        {project.team.map((member, idx) => (
                                                            <div
                                                                key={member}
                                                                className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(idx)} border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[10px] font-semibold`}
                                                            >
                                                                {member}
                                                            </div>
                                                        ))}
                                                        {project.team.length > 3 && (
                                                            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-text-gray dark:text-gray-400 text-[10px] font-semibold">
                                                                +{project.team.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-text-gray dark:text-gray-400">{getUpdatedLabel(project)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>
            {isCreateProjectOpen && (
                <CreateProjectModal
                    onClose={() => setIsCreateProjectOpen(false)}
                    onSuccess={() => {
                        setIsCreateProjectOpen(false);
                        fetchProjects();
                    }}
                />
            )}
        </div>
    );
};

export default Projects;
