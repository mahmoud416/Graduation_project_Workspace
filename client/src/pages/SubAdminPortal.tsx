import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const SubAdminPortal = () => {
    const stats = [
        { title: 'Total Tasks', value: '124', change: '↗12% from last week', color: 'bg-purple-100', icon: '📋' },
        { title: 'Completed', value: '84', color: 'bg-green-100', icon: '✓', progressBar: true, progress: 68 },
        { title: 'In Progress', value: '31', color: 'bg-orange-100', icon: '⏱', progressBar: true, progress: 25 },
        { title: 'Overall Efficiency', value: '82%', change: '⚡Consistently High', color: 'bg-blue-100', icon: '📊' },
    ];

    const staffProgress = [
        { name: 'John Doe', role: 'Senior Developer', progress: 92, avatar: 'JD' },
        { name: 'Sarah Smith', role: 'UI Designer', progress: 75, avatar: 'SS' },
        { name: 'Michael Chen', role: 'QA Engineer', progress: 45, avatar: 'MC' },
        { name: 'Emily Davis', role: 'Content Lead', progress: 88, avatar: 'ED' },
    ];

    const detailedTasks = [
        {
            id: '1',
            title: 'Initial Research & Planning',
            team: 'Strategy Team',
            progress: 100,
            status: '100% Done',
            icon: '✓',
            color: 'text-success',
            bgColor: 'bg-green-100',
        },
        {
            id: '2',
            title: 'System Architecture Design',
            team: 'Architecture Team',
            progress: 68,
            status: '68% Progress',
            icon: '🏗',
            color: 'text-primary',
            bgColor: 'bg-blue-100',
        },
        {
            id: '3',
            title: 'Frontend Component Development',
            team: 'UI Development Team',
            progress: 42,
            status: '42% Progress',
            icon: '💻',
            color: 'text-primary',
            bgColor: 'bg-blue-100',
        },
        {
            id: '4',
            title: 'API Documentation',
            team: 'Backend Team',
            progress: 0,
            status: 'Scheduled',
            icon: '☁️',
            color: 'text-text-gray',
            bgColor: 'bg-gray-100',
        },
    ];

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />

            <div className="flex-1 ml-[240px]">
                <Header title="Sub-Admin Portal" />

                <main className="pt-16 p-8">
                    {/* Header Section */}
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-2">Progress Overview</h1>
                            <p className="text-sm text-text-gray dark:text-gray-400">Monitor team performance and task completion status.</p>
                        </div>
                        <button className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-sm">
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Upload Task
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-5 mb-8">
                        {stats.map((stat, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-medium text-text-gray dark:text-gray-400">{stat.title}</span>
                                    <div className={`w-10 h-10 ${stat.color} dark:bg-gray-700/40 rounded-lg flex items-center justify-center text-xl`}>
                                        {stat.icon}
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-text-dark dark:text-white mb-2">{stat.value}</div>
                                {stat.progressBar && (
                                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700/60 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${stat.progress > 60 ? 'bg-success' : 'bg-warning'
                                                }`}
                                            style={{ width: `${stat.progress}%` }}
                                        ></div>
                                    </div>
                                )}
                                {stat.change && (
                                    <div className="text-xs text-primary font-medium mt-2">{stat.change}</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Staff Progress */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <h2 className="text-lg font-bold text-text-dark dark:text-white">Staff Progress</h2>
                                </div>
                                <button className="text-text-gray dark:text-gray-400 hover:text-text-dark dark:hover:text-gray-200">
                                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-5">
                                {staffProgress.map((staff, index) => (
                                    <div key={index}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-sm font-medium">
                                                {staff.avatar}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-text-dark dark:text-gray-100">{staff.name}</div>
                                                <div className="text-xs text-text-gray dark:text-gray-400">{staff.role}</div>
                                            </div>
                                            <div className="text-lg font-bold text-text-dark dark:text-gray-100">{staff.progress}%</div>
                                        </div>
                                        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700/60 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${staff.progress >= 80
                                                        ? 'bg-primary'
                                                        : staff.progress >= 60
                                                            ? 'bg-primary'
                                                            : 'bg-primary'
                                                    }`}
                                                style={{ width: `${staff.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 text-center">
                                <a href="#" className="text-sm text-primary font-medium hover:underline">
                                    View All Staff
                                </a>
                            </div>
                        </div>

                        {/* Detailed Task Progress */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    <h2 className="text-lg font-bold text-text-dark dark:text-white">Detailed Task Progress</h2>
                                </div>
                                <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-text-gray dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    Filter: All
                                </button>
                            </div>

                            <div className="space-y-4">
                                {detailedTasks.map((task) => (
                                    <div key={task.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-900/40">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`w-10 h-10 ${task.bgColor} dark:bg-gray-700/40 rounded-lg flex items-center justify-center text-xl flex-shrink-0`}>
                                                {task.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-semibold text-text-dark dark:text-gray-100 mb-1">{task.title}</h3>
                                                <p className="text-xs text-text-gray dark:text-gray-400">Assigned to: {task.team}</p>
                                            </div>
                                            <span className={`text-sm font-medium ${task.color}`}>{task.status}</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700/60 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${task.progress === 100
                                                        ? 'bg-success'
                                                        : task.progress > 0
                                                            ? 'bg-primary'
                                                            : 'bg-gray-300'
                                                    }`}
                                                style={{ width: `${task.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}

                                <button className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-text-gray dark:text-gray-400 font-medium hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M12 4v16m8-8H4" />
                                    </svg>
                                    Upload New Task Details
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 text-center text-xs text-text-gray dark:text-gray-500">
                        © 2023 TaskManagement System. Sub-Admin Dashboard Overview.
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SubAdminPortal;
