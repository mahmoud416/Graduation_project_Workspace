import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const TaskMasterDashboard = () => {
    const activeTasks = [
        {
            id: '1',
            category: 'DESIGN',
            title: 'User Interface Refactor',
            description: 'Update all legacy components to support...',
            assignees: [{ name: 'Alex', avatar: 'A' }],
            dueDate: 'Due in 2d',
            status: 'active',
        },
        {
            id: '2',
            category: 'DEV',
            title: 'API Integration',
            description: 'Connect the dashboard widgets to the real-time...',
            assignees: [{ name: 'Mike', avatar: 'M' }],
            dueDate: 'Due Tomorrow',
            status: 'active',
            highlighted: true,
        },
        {
            id: '3',
            category: 'QA',
            title: 'Final Review',
            description: 'Perform end-to-end testing on the task...',
            assignees: [{ name: 'Sarah', avatar: 'S' }, { name: 'John', avatar: 'J' }],
            dueDate: 'Completed',
            status: 'completed',
        },
    ];

    const teamDiscussion = [
        {
            id: '1',
            user: { name: 'Marcus Lee', avatar: 'ML' },
            message: 'The initial designs are ready for review. Please check the uploaded files.',
            timestamp: '2h ago',
        },
        {
            id: '2',
            user: { name: 'Alex Rivera', avatar: 'AR' },
            message: 'Thanks Marcus! I\'ll take a look this afternoon.',
            timestamp: '1h ago',
            highlighted: true,
        },
    ];

    const assignees = [
        { name: 'Jordan Smith', avatar: 'JS' },
        { name: 'Emma Wilson', avatar: 'EW' },
        { name: 'Marcus Lee', avatar: 'ML' },
    ];

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />

            <div className="flex-1 ml-[240px]">
                <Header title="TaskMaster" />

                <main className="pt-16 p-8">
                    {/* Welcome Section */}
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-dark mb-1">Welcome back, Alex</h1>
                            <p className="text-sm text-text-gray">Project Manager</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
                                <svg className="w-5 h-5 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </button>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium text-sm">
                                A
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Active Tasks Section */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    <h2 className="text-lg font-bold text-text-dark">Active Tasks</h2>
                                </div>
                                <a href="#" className="text-sm text-primary font-medium hover:underline">
                                    View All
                                </a>
                            </div>

                            <div className="space-y-4">
                                {activeTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className={`border rounded-xl p-4 transition-all ${task.highlighted
                                                ? 'border-primary border-2 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-medium ${task.category === 'DESIGN'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : task.category === 'DEV'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-green-100 text-green-700'
                                                    }`}
                                            >
                                                {task.category}
                                            </span>
                                            <button className="text-text-gray hover:text-text-dark">
                                                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                        <h3 className="text-base font-semibold text-text-dark mb-2">{task.title}</h3>
                                        <p className="text-sm text-text-gray mb-4">{task.description}</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {task.assignees.map((assignee, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white text-xs font-medium"
                                                    >
                                                        {assignee.avatar}
                                                    </div>
                                                ))}
                                            </div>
                                            <span
                                                className={`text-xs font-medium ${task.status === 'completed' ? 'text-success' : 'text-text-gray'
                                                    }`}
                                            >
                                                {task.dueDate}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-text-gray font-medium hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create Task
                                </button>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* Overall Progress */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <svg className="w-5 h-5 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <h2 className="text-lg font-bold text-text-dark">Overall Progress</h2>
                                </div>

                                <div className="text-center mb-8">
                                    <div className="text-5xl font-bold text-text-dark mb-2">75%</div>
                                    <div className="text-sm text-text-gray uppercase tracking-wide">Total Done</div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-text-dark">In Progress Tasks</span>
                                            <span className="text-sm font-semibold text-primary">60%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: '60%' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-text-dark">Internal Audits</span>
                                            <span className="text-sm font-semibold text-success">100%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-success rounded-full" style={{ width: '100%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Task Detail View */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="flex items-start gap-3 mb-6">
                                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white">
                                        <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-text-dark">Task Detail View</h3>
                                        <p className="text-xs text-text-gray">Project: Marketing Campaign Q4</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
                                            <svg className="w-4 h-4 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                            </svg>
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
                                            <svg className="w-4 h-4 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Team Discussion */}
                                <div className="mb-6">
                                    <h4 className="text-xs font-medium text-text-gray uppercase tracking-wide mb-4">Team Discussion</h4>
                                    <div className="space-y-4">
                                        {teamDiscussion.map((comment) => (
                                            <div key={comment.id} className="flex gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                                    {comment.user.avatar}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-semibold text-text-dark">{comment.user.name}</span>
                                                        <span className="text-xs text-text-gray">{comment.timestamp}</span>
                                                    </div>
                                                    <div
                                                        className={`text-sm p-3 rounded-lg ${comment.highlighted
                                                                ? 'bg-primary text-white'
                                                                : 'bg-gray-50 text-text-dark'
                                                            }`}
                                                    >
                                                        {comment.message}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Assignees */}
                                <div className="mb-6">
                                    <h4 className="text-xs font-medium text-text-gray uppercase tracking-wide mb-4">Assignees</h4>
                                    <div className="space-y-3">
                                        {assignees.map((assignee, idx) => (
                                            <div key={idx} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-400 flex items-center justify-center text-white text-xs font-medium">
                                                        {assignee.avatar}
                                                    </div>
                                                    <span className="text-sm text-text-dark">{assignee.name}</span>
                                                </div>
                                            </div>
                                        ))}
                                        <button className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M12 4v16m8-8H4" />
                                            </svg>
                                            Invite New
                                        </button>
                                    </div>
                                </div>

                                {/* Attachments */}
                                <div>
                                    <h4 className="text-xs font-medium text-text-gray uppercase tracking-wide mb-4">Attachments</h4>
                                    <div className="flex items-center gap-3">
                                        <div className="w-20 h-20 bg-gradient-to-br from-amber-200 to-amber-400 rounded-lg flex items-center justify-center">
                                            <svg className="w-8 h-8 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <button className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-blue-50 transition-colors">
                                            <svg className="w-6 h-6 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            <span className="text-xs text-text-gray">Upload</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <input
                                        type="text"
                                        placeholder="Any comments for the team?"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-text-dark placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TaskMasterDashboard;
