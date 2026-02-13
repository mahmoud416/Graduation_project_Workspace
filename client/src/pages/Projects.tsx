import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';
import CreateProjectModal from '../components/CreateProjectModal';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const STATUS_OPTIONS: Array<{ value: Project['status']; label: string }> = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ON HOLD', label: 'On Hold' },
    { value: 'COMPLETED', label: 'Completed' },
];

const mapProjectResponse = (proj: any): Project => {
    const subAdminEntries = Array.isArray(proj.sub_admins) ? proj.sub_admins : [];
    const staffEntries = Array.isArray(proj.staff) ? proj.staff : [];
    const subAdminNames = subAdminEntries
        .map((entry) => entry?.name)
        .filter((name): name is string => Boolean(name));
    if (!subAdminNames.length && proj.sub_admin?.name) {
        subAdminNames.push(proj.sub_admin.name);
    }

    const subAdminIds = subAdminEntries
        .map((entry) => entry?._id || entry?.id)
        .filter((identifier): identifier is string => typeof identifier === 'string');
    const staffIds = staffEntries
        .map((entry) => entry?._id || entry?.id)
        .filter((identifier): identifier is string => typeof identifier === 'string');

    const staffInitials = Array.isArray(proj.staff_initials) ? proj.staff_initials : [];
    const subInitials = subAdminEntries
        .map((entry) => entry?.initials)
        .filter((initial): initial is string => Boolean(initial));
    const combinedInitials = [...subInitials, ...staffInitials].filter(Boolean);
    const updatedStamp = proj.updated_at || new Date().toISOString();
    const normalizedStatus = (proj.status || 'ACTIVE').toUpperCase() as Project['status'];

    return {
        id: proj._id,
        title: proj.title,
        description: proj.description || 'No description provided',
        status: normalizedStatus === 'ON HOLD' ? 'ON HOLD' : normalizedStatus,
        progress: typeof proj.progress === 'number' ? proj.progress : 0,
        team: (combinedInitials.length ? combinedInitials : ['TM']).slice(0, 5),
        updatedAt: updatedStamp,
        updatedAtRaw: updatedStamp,
        subAdminName: subAdminNames[0],
        subAdminNames,
        subAdminIds,
        staffIds,
        isDefaultGroup: proj._id === 'public-group' || proj._id === 'all-sub-admin',
    };
};

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
        subAdminNames: ['All Users'],
        subAdminIds: [],
        staffIds: [],
        isDefaultGroup: true,
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
        subAdminNames: ['Sub Admin Leads'],
        subAdminIds: [],
        staffIds: [],
        isDefaultGroup: true,
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
    const [userId, setUserId] = useState<string | null>(null);
    const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [configDraft, setConfigDraft] = useState({ title: '', description: '', status: 'ACTIVE' as Project['status'], progress: 0 });
    const [configError, setConfigError] = useState<string | null>(null);
    const [configSaving, setConfigSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
    const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setRole(localStorage.getItem('role'));
        setUserId(localStorage.getItem('userId'));

        return () => {
            if (messageTimer.current) {
                clearTimeout(messageTimer.current);
            }
        };
    }, []);

    const fetchProjects = useCallback(async () => {
        const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
        if (!storedUserId) {
            setProjects(GROUPED_PROJECTS);
            setUsingSampleData(true);
            setFetchError('Missing admin session. Please log in again.');
            return;
        }

        setUserId(storedUserId);

        try {
            setFetchError(null);
            const response = await fetch(`${API_BASE}/projects`, {
                headers: { 'X-User-Id': storedUserId },
            });

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Failed to load projects');
            }

            const payload = await response.json();
            if (!Array.isArray(payload)) {
                setProjects([]);
                setUsingSampleData(false);
                return;
            }

            const mapped: Project[] = payload.map(mapProjectResponse);
            setProjects(mapped);
            setUsingSampleData(false);
        } catch (error) {
            console.error('Failed to fetch projects:', error);
            const message = error instanceof Error ? error.message : 'Unable to load projects';
            setFetchError(message);
            setProjects([]);
            setUsingSampleData(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const closeMenus = () => setOpenMenuId(null);
        window.addEventListener('click', closeMenus);
        return () => window.removeEventListener('click', closeMenus);
    }, []);

    const visibleProjects = useMemo(() => {
        let scoped = projects;
        if (role && role !== 'admin') {
            if (role === 'sub_admin') {
                scoped = scoped.filter((project) => {
                    if (project.id === 'public-group' || project.id === 'all-sub-admin' || project.isDefaultGroup) {
                        return true;
                    }
                    if (!userId) {
                        return false;
                    }
                    return project.subAdminIds?.includes(userId) ?? false;
                });
            } else {
                scoped = scoped.filter((project) => {
                    if (project.id === 'public-group') {
                        return true;
                    }
                    if (!userId) {
                        return false;
                    }
                    return project.staffIds?.includes(userId) ?? false;
                });
            }
        }

        if (!searchQuery.trim()) {
            return scoped;
        }

        const query = searchQuery.toLowerCase();
        return scoped.filter(
            (project) =>
                project.title.toLowerCase().includes(query) ||
                project.description.toLowerCase().includes(query)
        );
    }, [projects, role, userId, searchQuery]);

    const sortedProjects = useMemo(() => {
        const next = [...visibleProjects];
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
    }, [visibleProjects, sortOption]);

    const requireUserHeader = () => {
        const header = userId ?? (typeof window !== 'undefined' ? localStorage.getItem('userId') : null);
        if (!header) {
            setFetchError('Missing admin session. Please log in again.');
        }
        return header;
    };

    const handleMenuToggle = (event: MouseEvent<HTMLButtonElement>, projectId: string) => {
        event.stopPropagation();
        event.preventDefault();
        setOpenMenuId((prev) => (prev === projectId ? null : projectId));
    };

    const openConfigModal = (project: Project) => {
        setEditingProject(project);
        setConfigDraft({
            title: project.title,
            description: project.description,
            status: project.status,
            progress: project.progress,
        });
        setConfigError(null);
    };

    const handleConfigureClick = (event: MouseEvent<HTMLButtonElement>, project: Project) => {
        event.stopPropagation();
        openConfigModal(project);
        setOpenMenuId(null);
    };

    const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>, project: Project) => {
        event.stopPropagation();
        setDeleteTarget(project);
        setOpenMenuId(null);
    };

    const closeConfigModal = () => {
        setEditingProject(null);
        setConfigError(null);
    };

    const closeDeleteDialog = () => {
        setDeleteTarget(null);
    };

    const handleConfigFieldChange = (
        field: 'title' | 'description' | 'status' | 'progress',
        value: string | number
    ) => {
        setConfigDraft((prev) => ({ ...prev, [field]: value }));
    };

    const handleConfigSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingProject) {
            return;
        }
        const headerId = requireUserHeader();
        if (!headerId) {
            return;
        }

        const trimmedTitle = configDraft.title.trim();
        const trimmedDescription = configDraft.description.trim();
        const payload: Record<string, unknown> = {};
        if (trimmedTitle && trimmedTitle !== editingProject.title) {
            payload.title = trimmedTitle;
        }
        if (trimmedDescription !== editingProject.description) {
            payload.description = trimmedDescription;
        }
        if (configDraft.status !== editingProject.status) {
            payload.status = configDraft.status;
        }
        if (configDraft.progress !== editingProject.progress) {
            payload.progress = configDraft.progress;
        }

        if (!Object.keys(payload).length) {
            setConfigError('No pending changes to save.');
            return;
        }

        try {
            setConfigSaving(true);
            const response = await fetch(`${API_BASE}/projects/${editingProject.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': headerId,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to update project');
            }

            const updated = mapProjectResponse(await response.json());
            setProjects((prev) => prev.map((project) => (project.id === updated.id ? updated : project)));
            setEditingProject(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update project';
            setConfigError(message);
        } finally {
            setConfigSaving(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) {
            return;
        }
        const headerId = requireUserHeader();
        if (!headerId) {
            return;
        }

        try {
            setIsDeletingProject(true);
            const response = await fetch(`${API_BASE}/projects/${deleteTarget.id}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': headerId },
            });

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to delete project');
            }

            setProjects((prev) => prev.filter((project) => project.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete project';
            setFetchError(message);
        } finally {
            setIsDeletingProject(false);
        }
    };

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
    const emptyStateMessage = canManageProjects
        ? 'No project cards yet. Click Create New Project to get started.'
        : 'No cards are assigned to your account yet. Contact the admin to be added.';

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
                        {sortedProjects.length === 0 && !usingSampleData ? (
                            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-sm text-text-gray dark:text-gray-400">
                                {emptyStateMessage}
                            </div>
                        ) : (
                            <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                                {sortedProjects.map((project) => {
                                const leadLabel = getLeadLabel(project.subAdminNames);
                                const isDefaultGroup = project.id === 'public-group' || project.id === 'all-sub-admin';
                                const badgeClass = isDefaultGroup ? 'bg-purple-100 text-purple-700' : getStatusColor(project.status);
                                const showMenu = canManageProjects && !isDefaultGroup;
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
                                            {showMenu ? (
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => handleMenuToggle(event, project.id)}
                                                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 text-text-gray dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                                                        aria-haspopup="menu"
                                                        aria-expanded={openMenuId === project.id}
                                                        aria-label="Project actions"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M12 5v.01M12 12v.01M12 19v.01" />
                                                        </svg>
                                                    </button>
                                                    {openMenuId === project.id && (
                                                        <div
                                                            className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl z-10"
                                                            onClick={(event) => event.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={(event) => handleConfigureClick(event, project)}
                                                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-text-dark dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                                                                    <circle cx="12" cy="12" r="3" />
                                                                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83l-1.15 1.15a2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V22a2 2 0 01-2 2h-1.62a2 2 0 01-2-2v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0L.21 19.71a2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H0a2 2 0 01-2-2v-1.62a2 2 0 012-2h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83L2.37.21a2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H7.1a1.65 1.65 0 001-1.51V0a2 2 0 012-2h1.62a2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0l1.15 1.15a2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.1a1.65 1.65 0 001.51 1H22a2 2 0 012 2v1.62a2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                                                                </svg>
                                                                Configure card
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(event) => handleDeleteClick(event, project)}
                                                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                                    <path d="M10 11v6M14 11v6" />
                                                                    <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
                                                                </svg>
                                                                Delete card
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="w-8 h-8" aria-hidden="true" />
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
                                                        {project.team.slice(0, 3).map((member, idx) => (
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
                        )}
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

            {editingProject && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={closeConfigModal}>
                    <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-text-gray">Configure Card</p>
                                <h3 className="text-xl font-semibold text-text-dark dark:text-white">{editingProject.title}</h3>
                            </div>
                            <button type="button" onClick={closeConfigModal} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-text-gray flex items-center justify-center" aria-label="Close">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleConfigSubmit} className="px-6 py-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase text-text-gray">Card title</label>
                                    <input
                                        type="text"
                                        value={configDraft.title}
                                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleConfigFieldChange('title', event.target.value)}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:ring-2 focus:ring-primary/10"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase text-text-gray">Execution status</label>
                                    <select
                                        value={configDraft.status}
                                        onChange={(event: ChangeEvent<HTMLSelectElement>) => handleConfigFieldChange('status', event.target.value as Project['status'])}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:ring-2 focus:ring-primary/10"
                                    >
                                        {STATUS_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase text-text-gray">Description</label>
                                <textarea
                                    value={configDraft.description}
                                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => handleConfigFieldChange('description', event.target.value)}
                                    rows={3}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:ring-2 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-text-gray">
                                    <span>Progress</span>
                                    <span className="text-text-dark dark:text-gray-100">{configDraft.progress}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={configDraft.progress}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => handleConfigFieldChange('progress', Number(event.target.value))}
                                    className="w-full accent-primary"
                                />
                            </div>
                            {configError && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {configError}
                                </div>
                            )}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={closeConfigModal} className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-text-gray">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={configSaving}
                                    className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60"
                                >
                                    {configSaving ? 'Saving...' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={closeDeleteDialog}>
                    <div className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="px-6 py-5 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 text-danger flex items-center justify-center">
                                    !
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-dark dark:text-white">Delete {deleteTarget.title}?</h3>
                                    <p className="text-sm text-text-gray dark:text-gray-400">
                                        This card and all of its data will be removed from the projects board. This cannot be undone.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3">
                                <button type="button" onClick={closeDeleteDialog} className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-text-gray">
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isDeletingProject}
                                    className="h-10 px-5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                                >
                                    {isDeletingProject ? 'Deleting...' : 'Delete permanently'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Projects;
