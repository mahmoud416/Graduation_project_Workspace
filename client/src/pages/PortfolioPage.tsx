import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

/* ─── Types ─── */

interface Profile {
    _id: string;
    email: string;
    name: string;
    role: string;
    avatar_url?: string;
    bio?: string;
    department?: string;
    phone?: string;
    created_at: string;
}

interface PortfolioProject {
    project_id: string;
    title: string;
    status: string;
    tasks_total: number;
    tasks_done: number;
}

interface Portfolio {
    user_id: string;
    name: string;
    projects_count: number;
    tasks_completed: number;
    tasks_total: number;
    avg_accuracy: number;
    recent_projects: PortfolioProject[];
}

interface ActiveTask {
    id: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    project_name: string;
}

interface DashboardAnalytics {
    user_id: string;
    onTimeRate: number;
    onTimeTasks: number;
    totalWithDeadline: number;
    totalCompleted: number;
    activeTasks: number;
    statusBreakdown: {
        todo: number;
        inProgress: number;
        review: number;
        done: number;
    };
    totalTasks: number;
    averageCompletionTime: number;
    activeTasksList: ActiveTask[];
    rejectionRate?: number;
    burnoutRisk?: string;
    teamAvgTurnaround?: number;
    speedByProject?: { projectName: string; avgHours: number }[];
    frequentIssues?: string[];
}

/* ─── Helper Components ─── */

const StatusBar = ({ label, count, total, color }: { label: string; count: number; total: number; color: string }) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-text-dark dark:text-gray-200">{label}</span>
                <span className="text-text-gray dark:text-gray-400 font-mono">{count} <span className="text-xs">({pct.toFixed(0)}%)</span></span>
            </div>
            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
        </div>
    );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
    const styles: Record<string, string> = {
        high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
        medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
        low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    };
    return (
        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase ${styles[priority] || styles.medium}`}>
            {priority}
        </span>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        TODO: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
        REVIEW: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
        DONE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    };
    const labels: Record<string, string> = {
        TODO: 'To Do',
        IN_PROGRESS: 'In Progress',
        REVIEW: 'Review',
        DONE: 'Done',
    };
    return (
        <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${styles[status] || styles.TODO}`}>
            {labels[status] || status}
        </span>
    );
};

const formatHours = (hours: number): string => {
    if (hours === 0) return '—';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return days < 2 ? `${days.toFixed(1)} day` : `${days.toFixed(1)} days`;
};

/* ─── Main Page ─── */

const PortfolioPage = () => {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const token = localStorage.getItem('token');
                const adminUserId = localStorage.getItem('userId');
                const headers = {
                    'Authorization': `Bearer ${token ?? ''}`,
                    'X-User-Id': adminUserId ?? ''
                };

                const [profRes, portRes, analyticsRes] = await Promise.all([
                    fetch(`${API_BASE}/profile/${userId}`, { headers }),
                    fetch(`${API_BASE}/profile/${userId}/portfolio`, { headers }),
                    fetch(`${API_BASE}/analytics/user/${userId}/dashboard`, { headers }),
                ]);

                if (!profRes.ok) throw new Error('Failed to load profile');
                if (!portRes.ok) throw new Error('Failed to load portfolio');

                setProfile(await profRes.json());
                setPortfolio(await portRes.json());

                if (analyticsRes.ok) {
                    setAnalytics(await analyticsRes.json());
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error loading data');
            } finally {
                setLoading(false);
            }
        };
        if (userId) void fetchAll();
    }, [userId]);

    const sb = analytics?.statusBreakdown;
    const totalTasks = analytics?.totalTasks ?? 0;

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Analysis" />
                <main className="p-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="mb-6 flex items-center gap-2 text-sm font-semibold text-text-gray hover:text-primary transition-colors"
                    >
                        <span>&larr;</span> Back
                    </button>

                    {loading ? (
                        <div className="max-w-6xl mx-auto space-y-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-8 animate-pulse border border-gray-200 dark:border-gray-700 h-32" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">{error}</div>
                    ) : profile && portfolio ? (
                        <div className="max-w-6xl mx-auto space-y-6">

                            {/* ═══ Profile Header ═══ */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg flex-shrink-0">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt={profile.name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        profile.name.substring(0, 1).toUpperCase()
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h1 className="text-2xl font-bold text-text-dark dark:text-white flex items-center gap-3">
                                        {profile.name}
                                        {analytics?.burnoutRisk === 'High' && <span className="px-2 py-1 text-[10px] uppercase font-bold bg-red-100 text-red-600 rounded-lg">🔥 High Burnout Risk</span>}
                                        {analytics?.burnoutRisk === 'Medium' && <span className="px-2 py-1 text-[10px] uppercase font-bold bg-orange-100 text-orange-600 rounded-lg">⚠️ Medium Burnout Risk</span>}
                                    </h1>
                                    <p className="text-primary font-bold mt-1 mb-1 text-xs tracking-widest">{profile.role.toUpperCase()}</p>
                                    <p className="text-text-gray dark:text-gray-400 max-w-2xl text-sm">{profile.bio || 'No bio provided.'}</p>
                                </div>
                                <div className="text-sm text-text-gray space-y-1 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl w-full md:w-auto text-left">
                                    <p className="flex items-center gap-2"><span className="font-semibold text-text-dark dark:text-gray-300">Email:</span> {profile.email}</p>
                                    {profile.phone && <p className="flex items-center gap-2"><span className="font-semibold text-text-dark dark:text-gray-300">Phone:</span> {profile.phone}</p>}
                                    {profile.department && <p className="flex items-center gap-2"><span className="font-semibold text-text-dark dark:text-gray-300">Dept:</span> {profile.department}</p>}
                                </div>
                            </div>

                            {/* ═══ SECTION 1: KPI Cards ═══ */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {/* On-Time Delivery */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                                    <p className="text-text-gray dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">On-Time Delivery</p>
                                    <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-teal-600">
                                        {analytics?.onTimeRate ?? 0}%
                                    </p>
                                    <p className="text-xs text-text-gray dark:text-gray-500 mt-2">
                                        {analytics?.onTimeTasks ?? 0} / {analytics?.totalWithDeadline ?? 0} tasks on time
                                    </p>
                                </div>

                                {/* Active Tasks */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                                    <p className="text-text-gray dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Active Tasks</p>
                                    <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-blue-500 to-indigo-600">
                                        {analytics?.activeTasks ?? 0}
                                    </p>
                                    <p className="text-xs text-text-gray dark:text-gray-500 mt-2">
                                        Currently in progress
                                    </p>
                                </div>

                                {/* Avg Completion Time */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                                    <p className="text-text-gray dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Avg Turnaround</p>
                                    <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-amber-400 to-orange-600">
                                        {formatHours(analytics?.averageCompletionTime ?? 0)}
                                    </p>
                                    <p className="text-xs text-text-gray dark:text-gray-500 mt-2 flex justify-between">
                                        <span>User average</span>
                                        {analytics?.teamAvgTurnaround !== undefined && analytics.teamAvgTurnaround > 0 && (
                                            <span className="font-semibold text-text-dark dark:text-gray-300">Team: {formatHours(analytics.teamAvgTurnaround)}</span>
                                        )}
                                    </p>
                                </div>

                                {/* Tasks Completed */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                                    <p className="text-text-gray dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Tasks Completed</p>
                                    <div className="flex items-baseline gap-1.5">
                                        <p className="text-3xl font-extrabold text-text-dark dark:text-white">{portfolio.tasks_completed}</p>
                                        <p className="text-lg font-bold text-text-gray">/ {portfolio.tasks_total}</p>
                                    </div>
                                    <p className="text-xs text-text-gray dark:text-gray-500 mt-2">
                                        Total done
                                    </p>
                                </div>

                                {/* Quality Score */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                                    <p className="text-text-gray dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Quality Score</p>
                                    <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-violet-600">
                                        {portfolio.avg_accuracy}%
                                    </p>
                                    <p className="text-xs text-text-gray dark:text-gray-500 mt-2">
                                        Average AI score
                                    </p>
                                </div>

                                {/* Rejection Rate */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                                    <p className="text-text-gray dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Rejection Rate</p>
                                    <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-rose-600">
                                        {analytics?.rejectionRate ?? 0}%
                                    </p>
                                    <p className="text-xs text-text-gray dark:text-gray-500 mt-2">
                                        Tasks sent back
                                    </p>
                                </div>
                            </div>

                            {/* ═══ SECTION 2: Status Breakdown + Projects ═══ */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Status Breakdown */}
                                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                                    <h2 className="text-lg font-bold text-text-dark dark:text-white mb-5">Task Status Breakdown</h2>
                                    {totalTasks > 0 ? (
                                        <div className="space-y-4">
                                            <StatusBar label="To Do" count={sb?.todo ?? 0} total={totalTasks} color="linear-gradient(90deg, #94a3b8, #64748b)" />
                                            <StatusBar label="In Progress" count={sb?.inProgress ?? 0} total={totalTasks} color="linear-gradient(90deg, #3b82f6, #2563eb)" />
                                            <StatusBar label="Review" count={sb?.review ?? 0} total={totalTasks} color="linear-gradient(90deg, #a855f7, #7c3aed)" />
                                            <StatusBar label="Done" count={sb?.done ?? 0} total={totalTasks} color="linear-gradient(90deg, #10b981, #059669)" />
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-text-gray font-medium">No tasks assigned yet.</p>
                                        </div>
                                    )}

                                    {/* Summary row */}
                                    {totalTasks > 0 && (
                                        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-text-gray">
                                            <span>Total Tasks: <strong className="text-text-dark dark:text-white">{totalTasks}</strong></span>
                                            <span>Completion: <strong className="text-emerald-500">{totalTasks > 0 ? ((sb?.done ?? 0) / totalTasks * 100).toFixed(0) : 0}%</strong></span>
                                        </div>
                                    )}
                                </div>

                                {/* Recent Projects */}
                                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                                    <h2 className="text-lg font-bold text-text-dark dark:text-white mb-5">Projects Involved ({portfolio.projects_count})</h2>
                                    {portfolio.recent_projects.length > 0 ? (
                                        <div className="space-y-3">
                                            {portfolio.recent_projects.map(proj => (
                                                <div key={proj.project_id} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="font-bold text-text-dark dark:text-white text-sm">{proj.title}</h3>
                                                        <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 rounded-md">
                                                            {proj.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-xs mb-1.5 font-semibold text-text-gray">
                                                        <span>Progress</span>
                                                        <span>{proj.tasks_done} / {proj.tasks_total}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                                                            style={{ width: `${proj.tasks_total > 0 ? (proj.tasks_done / proj.tasks_total) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <span className="text-gray-400 text-xl">📋</span>
                                            </div>
                                            <p className="text-text-gray font-medium text-sm">No projects to display.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ═══ SECTION 3: Admin Insights ═══ */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Speed by Project */}
                                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                                    <h2 className="text-lg font-bold text-text-dark dark:text-white mb-5 flex items-center gap-2">⏱️ Speed by Project</h2>
                                    {analytics?.speedByProject && analytics.speedByProject.length > 0 ? (
                                        <div className="space-y-4">
                                            {analytics.speedByProject.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                                                    <span className="text-sm font-semibold text-text-dark dark:text-gray-200">{item.projectName}</span>
                                                    <span className="text-sm font-mono text-text-gray dark:text-gray-400">{formatHours(item.avgHours)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <span className="text-gray-400">⏱️</span>
                                            </div>
                                            <p className="text-text-gray text-sm">No project completion data yet.</p>
                                        </div>
                                    )}
                                </div>

                                {/* AI Quality Feedback */}
                                <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl border border-indigo-500/30 p-6 shadow-sm text-white">
                                    <h2 className="text-lg font-bold mb-5 flex items-center gap-2">🤖 AI Quality Top Issues</h2>
                                    {analytics?.frequentIssues && analytics.frequentIssues.length > 0 ? (
                                        <ul className="space-y-3">
                                            {analytics.frequentIssues.map((issue, i) => (
                                                <li key={i} className="flex items-start gap-3 bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                                    <span className="text-red-400 mt-0.5">⚠️</span>
                                                    <span className="text-sm font-medium text-indigo-100">{issue}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <span className="text-indigo-300">✨</span>
                                            </div>
                                            <p className="text-indigo-200 text-sm">No recurring quality issues detected.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ═══ SECTION 4: Active Tasks Table ═══ */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-lg font-bold text-text-dark dark:text-white">
                                        Active Tasks
                                        {analytics && analytics.activeTasks > 0 && (
                                            <span className="ml-2 text-sm font-normal text-text-gray">({analytics.activeTasks})</span>
                                        )}
                                    </h2>
                                </div>
                                {analytics && analytics.activeTasksList.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-xs uppercase tracking-wider text-text-gray dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                                    <th className="py-3 pr-4 font-semibold">Task</th>
                                                    <th className="py-3 pr-4 font-semibold">Project</th>
                                                    <th className="py-3 pr-4 font-semibold">Status</th>
                                                    <th className="py-3 pr-4 font-semibold">Priority</th>
                                                    <th className="py-3 font-semibold">Deadline</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {analytics.activeTasksList.map((task) => (
                                                    <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <td className="py-3.5 pr-4">
                                                            <p className="font-semibold text-text-dark dark:text-white">{task.title}</p>
                                                        </td>
                                                        <td className="py-3.5 pr-4 text-text-gray dark:text-gray-400 text-xs">{task.project_name}</td>
                                                        <td className="py-3.5 pr-4"><StatusBadge status={task.status} /></td>
                                                        <td className="py-3.5 pr-4"><PriorityBadge priority={task.priority} /></td>
                                                        <td className="py-3.5 text-xs text-text-gray dark:text-gray-400">
                                                            {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-10">
                                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <span className="text-emerald-500 text-2xl">✓</span>
                                        </div>
                                        <p className="text-text-gray font-semibold">All caught up!</p>
                                        <p className="text-text-gray text-xs mt-1">No active tasks pending.</p>
                                    </div>
                                )}
                            </div>

                        </div>
                    ) : null}
                </main>
            </div>
        </div>
    );
};

export default PortfolioPage;
