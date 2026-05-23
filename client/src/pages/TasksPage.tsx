import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';
import AiAnalysisModal from '../components/AiAnalysisModal';
import { qualityApi } from '../services/qualityApi';
import type { QualityAnalysisResult } from '../types';

interface TaskItem {
    id: string;
    name: string;
    category: string;
    assignees: string[];
    status: 'To Do' | 'In Progress' | 'Done' | 'Review' | 'UR' | 'Completed' | 'Not Completed Yet';
    priority: 'LOW' | 'MED' | 'HIGH';
    dueDate: string;
    overdue?: boolean;
    projectId?: string;
}

const TasksPage = () => {
    const navigate = useNavigate();
    const [analysisTask, setAnalysisTask] = useState<TaskItem | null>(null);
    const [analysisResult, setAnalysisResult] = useState<QualityAnalysisResult | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const completionStats = {
        completed: 24,
        inProgress: 9,
        remaining: 4,
        total: 37,
        percentage: 65,
    };

    const [tasks, setTasks] = useState<TaskItem[]>([
        {
            id: '1',
            name: 'Design System Audit & Update',
            category: 'Finance • #TSK-10-24',
            assignees: ['AB', 'CD'],
            status: 'Not Completed Yet',
            priority: 'HIGH',
            dueDate: 'Oct 24, 2023',
            projectId: 'public-group',
        },
        {
            id: '2',
            name: 'API Integration for Payment Gateway',
            category: 'Marketing • #TSK-10-39',
            assignees: ['EF'],
            status: 'Not Completed Yet',
            priority: 'MED',
            dueDate: 'Oct 28, 2023',
            projectId: 'all-sub-admin',
        },
        {
            id: '3',
            name: 'Drafting Q4 Budget Proposal',
            category: 'Finance • #TSK-11-01',
            assignees: ['GH'],
            status: 'Completed',
            priority: 'LOW',
            dueDate: 'Oct 15, 2023',
            projectId: 'public-group',
        },
        {
            id: '4',
            name: 'Security Vulnerability Patch v2.3',
            category: 'Security • #TSK-10-25',
            assignees: [],
            status: 'Not Completed Yet',
            priority: 'HIGH',
            dueDate: 'Overdue',
            overdue: true,
            projectId: 'public-group',
        },
        {
            id: '5',
            name: 'Marketing Copy for Landing Page',
            category: 'Content • #TSK-SD-231',
            assignees: ['IJ', 'KL'],
            status: 'Not Completed Yet',
            priority: 'MED',
            dueDate: 'Nov 02, 2023',
            projectId: 'public-group',
        },
    ]);

    const toggleTaskCompletion = (taskId: string) => {
        setTasks((prevTasks) =>
            prevTasks.map((task) =>
                task.id === taskId
                    ? { ...task, status: task.status === 'Completed' ? 'Not Completed Yet' : 'Completed' }
                    : task
            )
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'In Progress':
            case 'Not Completed Yet':
            case 'To Do':
            case 'UR':
                return 'bg-blue-100 text-primary';
            case 'Done':
            case 'Completed':
                return 'bg-green-100 text-success';
            case 'Review':
                return 'bg-purple-100 text-purple-600';
            default:
                return 'bg-gray-100 text-text-gray';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'HIGH':
                return 'text-danger';
            case 'MED':
                return 'text-warning';
            case 'LOW':
                return 'text-text-gray';
            default:
                return 'text-text-gray';
        }
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

    const handleAnalyzeTask = async (task: TaskItem) => {
        setAnalysisTask(task);
        setAnalysisResult(null);
        setAnalysisError(null);
        setAnalysisLoading(true);
        try {
            const payload = {
                task_title: task.name,
                task_description: `${task.category} | Priority ${task.priority} | Status ${task.status}`,
                task_id: task.id,
                project_id: task.projectId,
            };
            const response = await qualityApi.analyzeTask(payload);
            setAnalysisResult(response);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to run AI analysis';
            setAnalysisError(message);
        } finally {
            setAnalysisLoading(false);
        }
    };

    const closeAnalysisModal = () => {
        setAnalysisTask(null);
        setAnalysisResult(null);
        setAnalysisError(null);
        setAnalysisLoading(false);
    };

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />

            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Tasks" />

                <main className="page-main p-8">
                    {/* Project Completion Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-text-dark dark:text-white mb-1">Project Completion</h2>
                                <p className="text-sm text-text-gray dark:text-gray-400">Overall status across 17 active tasks</p>
                            </div>
                            <div className="text-4xl font-bold text-primary">{completionStats.percentage}%</div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-primary transition-all" style={{ width: `${completionStats.percentage}%` }} />
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <span className="text-text-dark font-medium">{completionStats.completed} Completed</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                                <span className="text-text-dark font-medium">{completionStats.inProgress} In Progress</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                                <span className="text-text-dark font-medium">{completionStats.remaining} Remaining</span>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3 mb-6">
                        <button className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                            Status
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <button className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Assignee
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <button className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                            </svg>
                            Priority
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <button className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Due date
                            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <div className="ml-auto flex items-center gap-2">
                            <button className="h-9 px-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                List
                            </button>
                            <button className="h-9 px-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-gray dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                Board
                            </button>
                            <button className="h-9 px-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-gray dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                Timeline
                            </button>
                        </div>
                    </div>

                    {/* Tasks Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-text-gray dark:text-gray-300 uppercase transition-colors">
                            <div className="col-span-1 flex items-center">

                            </div>
                            <div className="col-span-4">Task Name</div>
                            <div className="col-span-2">Assignee</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Due Date</div>
                            <div className="col-span-1">Priority</div>
                        </div>

                        {/* Table Rows */}
                        <div>
                            {tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-0"
                                >
                                    <div className="col-span-1 flex items-center">
                                        <input 
                                            type="checkbox" 
                                            checked={task.status === 'Completed'}
                                            onChange={() => toggleTaskCompletion(task.id)}
                                            className="w-4 h-4 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" 
                                        />
                                    </div>

                                    <div className="col-span-4" onClick={() => navigate('/taskflow')}>
                                        <div className="text-sm font-semibold text-text-dark dark:text-gray-100 cursor-pointer hover:text-primary transition-colors">{task.name}</div>
                                        <div className="text-xs text-text-gray dark:text-gray-400 mt-0.5">{task.category}</div>
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        {task.assignees.length > 0 ? (
                                            <div className="flex -space-x-2">
                                                {task.assignees.map((assignee, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(idx)} border-2 border-white flex items-center justify-center text-white text-[10px] font-semibold`}
                                                    >
                                                        {assignee}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-text-gray">Unassigned</span>
                                        )}
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(task.status)}`}>
                                            {task.status}
                                        </span>
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        <span className={`text-sm ${task.overdue ? 'text-danger font-medium' : 'text-text-dark dark:text-gray-200'}`}>
                                            {task.dueDate}
                                        </span>
                                    </div>

                                    <div className="col-span-1 flex items-center justify-between gap-2">
                                        <span className={`text-sm font-semibold ${getPriorityColor(task.priority)} flex items-center gap-1`}>
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M10 3L8 7H3l4 4-1 5 4-2 4 2-1-5 4-4h-5l-2-4z" />
                                            </svg>
                                            {task.priority}
                                        </span>
                                        <button
                                            className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-2 py-1 hover:bg-primary/10"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleAnalyzeTask(task);
                                            }}
                                        >
                                            Analyze with AI
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-text-gray dark:text-gray-300 transition-colors">
                            <span>Showing 5 of 37 tasks</span>
                            <div className="flex items-center gap-2">
                                <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                                    <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded font-medium">
                                    1
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                                    <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            <AiAnalysisModal
                isOpen={Boolean(analysisTask)}
                taskTitle={analysisTask?.name}
                onClose={closeAnalysisModal}
                loading={analysisLoading}
                result={analysisResult}
                error={analysisError}
            />
        </div>
    );
};

export default TasksPage;