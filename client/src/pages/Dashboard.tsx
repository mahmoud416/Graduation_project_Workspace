import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Activity, Project, Task } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const STAFF_SAMPLE_PROJECTS: Project[] = [
    {
        id: 'social-assets',
        title: 'Social Media Assets',
        description: 'Standard templates and brand assets for multi-channel distribution.',
        status: 'ACTIVE',
        progress: 82,
        team: ['ED', 'JN', 'SK', 'TG', 'LM'],
        updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        updatedAtRaw: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        subAdminName: 'Emily Davis'
    },
    {
        id: 'q4-campaign',
        title: 'Q4 Marketing Campaign',
        description: 'Developing cross-channel strategies for year-end growth and customer retention.',
        status: 'ACTIVE',
        progress: 65,
        team: ['AN', 'SV', 'VL', 'HK', 'PR'],
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAtRaw: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        subAdminName: 'Alex Morgan'
    },
    {
        id: 'customer-portal',
        title: 'Customer Portal Update',
        description: 'Improving self-service tools for enterprise clients and billing portals.',
        status: 'ACTIVE',
        progress: 45,
        team: ['NB', 'OC', 'WR'],
        updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        updatedAtRaw: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        subAdminName: 'Nora Blake'
    },
    {
        id: 'annual-audit',
        title: 'Annual Audit 2023',
        description: 'Year-end financial and compliance review for the fiscal year 2023.',
        status: 'COMPLETED',
        progress: 100,
        team: ['FK', 'DZ'],
        updatedAt: new Date('2023-10-20T09:00:00Z').toISOString(),
        updatedAtRaw: new Date('2023-10-20T09:00:00Z').toISOString(),
        subAdminName: 'Finance Pod'
    }
];

const getStatusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
    if (status === 'ON HOLD') return 'bg-amber-50 text-amber-700';
    return 'bg-blue-50 text-blue-700';
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
        'from-amber-500 to-orange-500'
    ];
    return palette[index % palette.length];
};

const getUpdatedLabel = (project: Project) => {
    const timestamp = project.updatedAtRaw ? new Date(project.updatedAtRaw) : new Date(project.updatedAt);
    if (Number.isNaN(timestamp.getTime())) {
        return 'Recently updated';
    }
    const diffMs = Date.now() - timestamp.getTime();
    const minutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
    if (hours < 24) return `${Math.max(hours, 1)}h ago`;
    if (days < 30) return `${Math.max(days, 1)}d ago`;
    return timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Dashboard = () => {
    const [role, setRole] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('role');
        }
        return null;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleStorage = () => setRole(localStorage.getItem('role'));
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const isStaff = role === 'staff';

    // Mock data
    const stats = [
        { title: 'TOTAL TASKS', value: '124', change: '+5%', isPositive: true },
        { title: 'IN PROGRESS', value: '12', change: '+2%', isPositive: true },
        { title: 'COMPLETED', value: '84', change: '-1%', isPositive: false },
    ];

    const activities: Activity[] = [
        {
            id: '1',
            user: { name: 'Sarah Williams', avatar: 'SW' },
            action: 'updated',
            target: 'API Documentation',
            timestamp: '2 hours ago',
            type: 'update',
        },
        {
            id: '2',
            user: { name: 'Mike Chen', avatar: 'MC' },
            action: 'commented on',
            target: 'Landing Page Redesign',
            timestamp: '4 hours ago',
            type: 'comment',
        },
        {
            id: '3',
            user: { name: 'James Miller', avatar: 'JM' },
            action: 'changed priority of',
            target: 'Database Migration',
            timestamp: 'Yesterday at 3:30 PM',
            type: 'change',
        },
        {
            id: '4',
            user: { name: 'Elena Rodriguez', avatar: 'ER' },
            action: 'created new task',
            target: 'Brand Style Guide',
            timestamp: 'Oct 21 at 10:15 AM',
            type: 'create',
        },
    ];

    const tasks: Task[] = [
        {
            id: '1',
            name: 'Design System Audit',
            category: 'Internal Marketing',
            status: 'In Progress',
            priority: 'High',
            dueDate: 'Oct 25, 2023',
        },
        {
            id: '2',
            name: 'User Interview Summary',
            category: 'UX Research',
            status: 'To Do',
            priority: 'Medium',
            dueDate: 'Oct 28, 2023',
        },
        {
            id: '3',
            name: 'Bug Fix: Login Modal',
            category: 'Core Features',
            status: 'Done',
            priority: 'High',
            dueDate: 'Oct 22, 2023',
        },
        {
            id: '4',
            name: 'Quarterly Team Sync',
            category: 'Management',
            status: 'To Do',
            priority: 'Low',
            dueDate: 'Nov 02, 2023',
        },
    ];

    const getStatusBadgeColor = (status: string) => {
        if (status === 'In Progress') return 'bg-blue-100 text-primary';
        if (status === 'Done') return 'bg-green-100 text-success';
        return 'bg-gray-100 text-text-gray';
    };

    const getPriorityColor = (priority: string) => {
        if (priority === 'High') return 'text-danger';
        if (priority === 'Medium') return 'text-warning';
        return 'text-text-gray';
    };

    const getActivityIcon = (type: string) => {
        if (type === 'update') return 'bg-blue-500';
        if (type === 'comment') return 'bg-orange-500';
        if (type === 'change') return 'bg-purple-500';
        return 'bg-green-500';
    };

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950">
            <Sidebar />

            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title={isStaff ? 'Workspace' : 'Dashboard'} />

                {isStaff ? (
                    <StaffProjectAssignments />
                ) : (
                    <main className="page-main p-8">
                    {/* Welcome Section */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-1">Welcome back, Alex</h1>
                        <p className="text-sm text-text-gray dark:text-gray-400">Monday, October 23rd</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-5 mb-8">
                        {stats.map((stat, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                                <div className="text-xs font-medium text-text-gray dark:text-gray-400 mb-2">{stat.title}</div>
                                <div className="text-3xl font-bold text-text-dark dark:text-white mb-1">{stat.value}</div>
                                <div className={`text-xs font-medium ${stat.isPositive ? 'text-success' : 'text-danger'}`}>
                                    {stat.change}
                                </div>
                            </div>
                        ))}

                        {/* Team Velocity Card */}
                        <div className="bg-primary rounded-xl p-6 text-white">
                            <div className="text-xs font-medium mb-2 opacity-90">TEAM VELOCITY</div>
                            <div className="text-3xl font-bold mb-1">92%</div>
                            <div className="text-xs font-medium">↑ +8%</div>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Recent Activity */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-bold text-text-dark dark:text-white">Recent Activity</h2>
                                <a href="#" className="text-sm text-primary font-medium hover:underline">
                                    View all
                                </a>
                            </div>

                            <div className="space-y-4">
                                {activities.map((activity) => (
                                    <div key={activity.id} className="flex gap-3">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-semibold">
                                            {activity.user.avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm">
                                                <span className="font-semibold text-text-dark dark:text-gray-200">{activity.user.name}</span>
                                                {' '}<span className="text-text-gray dark:text-gray-400">{activity.action}</span>
                                                {' '}<span className="text-primary font-medium">{activity.target}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className={`w-2 h-2 rounded-full ${getActivityIcon(activity.type)}`}></div>
                                                <span className="text-xs text-text-gray dark:text-gray-500">{activity.timestamp}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* My Tasks */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-bold text-text-dark dark:text-white">My Tasks</h2>
                                <div className="flex items-center gap-2">
                                    <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                        <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                        </svg>
                                    </button>
                                    <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                        <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-4 px-3 pb-3 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-text-gray dark:text-gray-400 uppercase">
                                <div className="col-span-5">Task Name</div>
                                <div className="col-span-3">Status</div>
                                <div className="col-span-2">Priority</div>
                                <div className="col-span-2">Due Date</div>
                            </div>

                            {/* Task Rows */}
                            <div className="space-y-0">
                                {tasks.map((task) => (
                                    <div key={task.id} className="grid grid-cols-12 gap-4 px-3 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                                        <div className="col-span-5">
                                            <div className="text-sm font-medium text-text-dark dark:text-gray-200">{task.name}</div>
                                            <div className="text-xs text-text-gray dark:text-gray-400 mt-0.5">{task.category}</div>
                                        </div>
                                        <div className="col-span-3 flex items-center">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadgeColor(task.status)}`}>
                                                {task.status}
                                            </span>
                                        </div>
                                        <div className="col-span-2 flex items-center">
                                            <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                        </div>
                                        <div className="col-span-2 flex items-center">
                                            <span className="text-sm text-text-dark dark:text-gray-300">{task.dueDate}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 text-center">
                                <a href="#" className="text-sm text-primary font-medium hover:underline">
                                    Show 18 more tasks
                                </a>
                            </div>
                        </div>
                    </div>
                    </main>
                )}
            </div>
        </div>
    );
};

export default Dashboard;

const StaffProjectAssignments = () => {
    const [projects, setProjects] = useState<Project[]>(STAFF_SAMPLE_PROJECTS);
    const [usingSampleData, setUsingSampleData] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<'updated' | 'name' | 'progress'>('updated');
    const navigate = useNavigate();

    const fetchProjects = useCallback(async () => {
        const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
        if (!userId) {
            setProjects(STAFF_SAMPLE_PROJECTS);
            setUsingSampleData(true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/projects`, {
                headers: { 'X-User-Id': userId }
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const payload = await response.json();
            if (!Array.isArray(payload) || payload.length === 0) {
                setProjects(STAFF_SAMPLE_PROJECTS);
                setUsingSampleData(true);
                return;
            }

            const mapped: Project[] = payload.map((proj: any) => {
                const staffInitials = Array.isArray(proj.staff_initials) ? proj.staff_initials : [];
                const subInitial = proj.sub_admin?.initials;
                const combinedInitials = subInitial ? [subInitial, ...staffInitials] : staffInitials;
                const updatedStamp = proj.updated_at || new Date().toISOString();

                return {
                    id: proj._id,
                    title: proj.title,
                    description: proj.description || 'No description provided',
                    status: proj.status ?? 'ACTIVE',
                    progress: typeof proj.progress === 'number' ? proj.progress : 0,
                    team: combinedInitials.length ? combinedInitials : ['TM'],
                    updatedAt: updatedStamp,
                    updatedAtRaw: updatedStamp,
                    subAdminName: proj.sub_admin?.name
                };
            });

            setProjects(mapped);
            setUsingSampleData(false);
        } catch (error) {
            console.error('Failed to load member projects', error);
            setProjects(STAFF_SAMPLE_PROJECTS);
            setUsingSampleData(true);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const query = searchQuery.toLowerCase();
        return projects.filter((project) =>
            project.title.toLowerCase().includes(query) || project.description.toLowerCase().includes(query)
        );
    }, [projects, searchQuery]);

    const sortedProjects = useMemo(() => {
        const next = [...filteredProjects];
        if (sortOption === 'name') {
            return next.sort((a, b) => a.title.localeCompare(b.title));
        }
        if (sortOption === 'progress') {
            return next.sort((a, b) => b.progress - a.progress);
        }
        return next.sort((a, b) => {
            const aDate = new Date(a.updatedAt).getTime();
            const bDate = new Date(b.updatedAt).getTime();
            return bDate - aDate;
        });
    }, [filteredProjects, sortOption]);

    const assignedCount = sortedProjects.length;

    return (
        <main className="page-main pb-10 px-10">
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm px-8 py-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div>
                        <p className="text-xs uppercase font-semibold tracking-wide text-text-gray">Assigned Groups</p>
                        <h1 className="text-3xl font-semibold text-text-dark dark:text-white">Your Project Hubs</h1>
                        <p className="text-sm text-text-gray dark:text-gray-400 mt-1">
                            These are the collaborative spaces you're allowed to join to work on shared tasks.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="relative w-full md:w-64">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search groups"
                                className="w-full h-11 pl-11 pr-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-text-dark dark:text-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                            <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-text-gray" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <select
                            value={sortOption}
                            onChange={(event) => setSortOption(event.target.value as 'updated' | 'name' | 'progress')}
                            className="h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm font-semibold text-text-dark dark:text-gray-200"
                        >
                            <option value="updated">Recently Updated</option>
                            <option value="name">Alphabetical</option>
                            <option value="progress">Progress</option>
                        </select>
                    </div>
                </div>

                {usingSampleData && (
                    <div className="mb-6 text-xs text-text-gray dark:text-gray-400">
                        Showing sample groups until your live assignments sync.
                    </div>
                )}

                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-semibold text-text-dark dark:text-white">Active Groups ({assignedCount})</h2>
                    <button
                        type="button"
                        onClick={() => navigate('/tasks')}
                        className="text-xs font-semibold text-primary hover:underline"
                    >
                        Go to shared tasks
                    </button>
                </div>

                {sortedProjects.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-text-gray dark:text-gray-400">
                        Your admin hasn't assigned you to any project hubs yet.
                    </div>
                ) : (
                    <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {sortedProjects.map((project) => (
                            <article key={project.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
                                <div className="flex items-start justify-between mb-4">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${getStatusColor(project.status)}`}>
                                        {project.status === 'ON HOLD' ? 'ON HOLD' : project.status}
                                    </span>
                                    <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" aria-label="Open group board" onClick={() => navigate('/taskflow')}>
                                        <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M12 5v14m7-7H5" />
                                        </svg>
                                    </button>
                                </div>

                                <h3 className="text-base font-bold text-text-dark dark:text-white mb-2">{project.title}</h3>
                                <div className="mb-5">
                                    <p className="text-sm text-text-gray dark:text-gray-400 mb-1.5 line-clamp-2">{project.description}</p>
                                    {project.subAdminName && (
                                        <p className="text-xs text-text-gray dark:text-gray-400">Lead · {project.subAdminName}</p>
                                    )}
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-center justify-between text-xs mb-2">
                                        <span className="text-text-gray dark:text-gray-400 font-medium">Progress</span>
                                        <span className="text-text-dark dark:text-gray-200 font-semibold">{project.progress}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${getProgressColor(project.status)} transition-all`} style={{ width: `${project.progress}%` }} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex -space-x-2">
                                        {project.team.slice(0, 3).map((member, idx) => (
                                            <div
                                                key={`${project.id}-${member}-${idx}`}
                                                className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(idx)} border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[10px] font-semibold`}
                                            >
                                                {member}
                                            </div>
                                        ))}
                                        {project.team.length > 3 && (
                                            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-text-gray dark:text-gray-300 text-[10px] font-semibold">
                                                +{project.team.length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-text-gray dark:text-gray-400">{getUpdatedLabel(project)}</span>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
};
