import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Activity, Task } from '../types';

const Dashboard = () => {
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

            <div className="flex-1 ml-[240px]">
                <Header title="Dashboard" />

                <main className="pt-16 p-8">
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
            </div>
        </div>
    );
};

export default Dashboard;
