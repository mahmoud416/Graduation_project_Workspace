import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const ReportsPage = () => {
    const stats = {
        totalTasksCompleted: 1284,
        change: '+17%',
        activeSprints: 4,
        sprintChange: 'Ongoing',
        avgCycleTime: 3.2,
        cycleChange: '-5%',
        teamEfficiency: 94,
        efficiencyChange: 'Stable',
    };

    const tasksOverTime = [
        { month: 'OCT 01', count: 85 },
        { month: 'OCT 08', count: 120 },
        { month: 'OCT 15', count: 95 },
        { month: 'OCT 18', count: 160 },
        { month: 'OCT 20', count: 140 },
        { month: 'OCT 23', count: 185 },
        { month: 'OCT 25', count: 210 },
        { month: 'OCT 28', count: 155 },
        { month: 'OCT 30', count: 90 },
        { month: 'OCT 31', count: 180 },
    ];

    const taskDistribution = {
        done: 184,
        inProgress: 120,
        toDo: 88,
        blocked: 20,
        total: 412,
    };

    const memberProductivity = [
        { name: 'Sarah Connor', tasks: 48, percentage: 100 },
    ];

    const maxTasks = Math.max(...tasksOverTime.map(d => d.count));

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950">
            <Sidebar />

            <div className="flex-1 ml-[240px]">
                <Header title="Reports" />

                <main className="pt-16 p-8">
                    {/* Page Header */}
                    <div className="mb-6">
                        <div className="flex items-center text-sm text-text-gray dark:text-gray-400 mb-2">
                            <span>Workspace</span>
                            <svg className="w-4 h-4 mx-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M9 5l7 7-7 7" />
                            </svg>
                            <span>Reports</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-1">Analytics & Reports</h1>
                                <p className="text-sm text-text-gray dark:text-gray-400">Track team productivity and task completion velocity</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="h-10 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    CSV
                                </button>
                                <button className="h-10 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Export PDF
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3 mb-6">
                        <button className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Oct 1, 2023 - Oct 30, 2023
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <button className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            All Members
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <button className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Filters
                        </button>

                        <div className="ml-auto text-xs text-text-gray dark:text-gray-400">
                            AUTO-REFRESH: 5M
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-4 gap-5 mb-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase mb-2">Total Tasks Completed</div>
                            <div className="flex items-end gap-2">
                                <div className="text-3xl font-bold text-text-dark dark:text-white">{stats.totalTasksCompleted.toLocaleString()}</div>
                                <div className="text-sm font-medium text-success mb-1">{stats.change}</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase mb-2">Active Sprints</div>
                            <div className="flex items-end gap-2">
                                <div className="text-3xl font-bold text-text-dark dark:text-white">{stats.activeSprints}</div>
                                <div className="text-sm font-medium text-text-gray dark:text-gray-400 mb-1">{stats.sprintChange}</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase mb-2">Avg. Cycle Time</div>
                            <div className="flex items-end gap-2">
                                <div className="text-3xl font-bold text-text-dark dark:text-white">{stats.avgCycleTime} days</div>
                                <div className="text-sm font-medium text-success mb-1">{stats.cycleChange}</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase mb-2">Team Efficiency</div>
                            <div className="flex items-end gap-2">
                                <div className="text-3xl font-bold text-text-dark dark:text-white">{stats.teamEfficiency}%</div>
                                <div className="text-sm font-medium text-text-gray dark:text-gray-400 mb-1">{stats.efficiencyChange}</div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-3 gap-6">
                        {/* Tasks Completed Over Time */}
                        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-base font-bold text-text-dark dark:text-white">Tasks Completed over Time</h2>
                                <div className="flex items-center gap-2 text-xs">
                                    <div className="w-3 h-3 bg-primary rounded"></div>
                                    <span className="text-text-gray dark:text-gray-400">Completed Tasks</span>
                                </div>
                            </div>

                            {/* Bar Chart */}
                            <div className="h-64 flex items-end gap-2">
                                {tasksOverTime.map((data, index) => (
                                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                        <div className="w-full flex items-end justify-center" style={{ height: '200px' }}>
                                            <div
                                                className={`w-full ${index === 6 ? 'bg-primary' : 'bg-blue-200 dark:bg-blue-900'} rounded-t transition-all hover:opacity-80 cursor-pointer`}
                                                style={{ height: `${(data.count / maxTasks) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] text-text-gray dark:text-gray-400 font-medium">{data.month}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Task Distribution */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <h2 className="text-base font-bold text-text-dark dark:text-white mb-6">Task Distribution by Status</h2>

                            {/* Donut Chart */}
                            <div className="flex items-center justify-center mb-6">
                                <div className="relative w-48 h-48">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                                        {/* Background circle */}
                                        <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="12" />

                                        {/* Colored segments */}
                                        <circle cx="60" cy="60" r="54" fill="none" stroke="#EAB308" strokeWidth="12" strokeDasharray={`${(taskDistribution.done / taskDistribution.total) * 339} 339`} strokeDashoffset="0" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <div className="text-3xl font-bold text-text-dark dark:text-white">{taskDistribution.total}</div>
                                        <div className="text-xs text-text-gray dark:text-gray-400">Total Tasks</div>
                                    </div>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                        <span className="text-sm text-text-dark dark:text-gray-200">Done</span>
                                    </div>
                                    <span className="text-sm font-semibold text-text-dark dark:text-gray-200">{taskDistribution.done}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                                        <span className="text-sm text-text-dark dark:text-gray-200">In Progress</span>
                                    </div>
                                    <span className="text-sm font-semibold text-text-dark dark:text-gray-200">{taskDistribution.inProgress}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                                        <span className="text-sm text-text-dark dark:text-gray-200">To Do</span>
                                    </div>
                                    <span className="text-sm font-semibold text-text-dark dark:text-gray-200">{taskDistribution.toDo}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-red-400 rounded"></div>
                                        <span className="text-sm text-text-dark dark:text-gray-200">Blocked</span>
                                    </div>
                                    <span className="text-sm font-semibold text-text-dark dark:text-gray-200">{taskDistribution.blocked}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Individual Member Productivity */}
                    <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-base font-bold text-text-dark dark:text-white">Individual Member Productivity</h2>
                            <a href="#" className="text-sm text-primary dark:text-blue-400 font-medium hover:underline">
                                View all members →
                            </a>
                        </div>

                        <div className="space-y-4">
                            {memberProductivity.map((member, index) => (
                                <div key={index} className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                        SC
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-text-dark dark:text-gray-200">{member.name}</span>
                                            <span className="text-sm font-bold text-text-dark dark:text-gray-200">{member.tasks} Tasks</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all"
                                                style={{ width: `${member.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ReportsPage;
