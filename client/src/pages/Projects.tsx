import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';

const Projects = () => {
    const projects: Project[] = [
        {
            id: '1',
            title: 'Q4 Marketing Campaign',
            description: 'Developing cross-channel strategies for year-end growth and customer acquisition.',
            status: 'ACTIVE',
            progress: 85,
            team: ['SW', 'MC', 'ER'],
            updatedAt: 'Updated 1h ago',
        },
        {
            id: '2',
            title: 'iOS App Redesign',
            description: 'Complete overhaul of the user experience for iOS and Android platforms.',
            status: 'ON HOLD',
            progress: 20,
            team: ['JM', 'SW'],
            updatedAt: 'Updated 1d ago',
        },
        {
            id: '3',
            title: 'Annual Audit 2023',
            description: 'Year-end financial and compliance review for the fiscal year 2023.',
            status: 'COMPLETED',
            progress: 100,
            team: ['ER'],
            updatedAt: 'Completed Oct 20',
        },
        {
            id: '4',
            title: 'Customer Portal Update',
            description: 'Improving self-service tools for enterprise clients and billing transparency.',
            status: 'ACTIVE',
            progress: 45,
            team: ['MC', 'JM', 'SW'],
            updatedAt: 'Updated 3h ago',
        },
        {
            id: '5',
            title: 'Social Media Assets',
            description: 'Standard templates and brand assets for multi-channel distribution.',
            status: 'ACTIVE',
            progress: 62,
            team: ['ER', 'MC'],
            updatedAt: 'Updated 5h ago',
        },
    ];

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

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950">
            <Sidebar />

            <div className="flex-1 ml-[240px]">
                <Header title="Projects" />

                <main className="pt-16 p-8">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-text-dark dark:text-white">Projects</h1>

                        <div className="flex items-center gap-3">
                            {/* View Toggle */}
                            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                                <button className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-md">
                                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center text-text-gray dark:text-gray-400 hover:text-text-dark dark:hover:text-gray-200 rounded-md">
                                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search projects..."
                                    className="w-[240px] h-10 pl-9 pr-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 placeholder:text-text-gray dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                                <svg
                                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-gray"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>

                            {/* Create Button */}
                            <button className="h-10 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M12 4v16m8-8H4" />
                                </svg>
                                Create New Project
                            </button>
                        </div>
                    </div>

                    {/* Sort */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-semibold text-text-dark dark:text-white">
                            Active Projects ({projects.filter(p => p.status === 'ACTIVE').length})
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-text-gray dark:text-gray-400">Sort by:</span>
                            <select className="text-sm text-text-dark dark:text-gray-200 font-medium bg-transparent focus:outline-none cursor-pointer">
                                <option>Last Updated</option>
                                <option>Name</option>
                                <option>Progress</option>
                            </select>
                        </div>
                    </div>

                    {/* Projects Grid */}
                    <div className="grid grid-cols-3 gap-5">
                        {projects.map((project) => (
                            <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-4">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${getStatusColor(project.status)}`}>
                                        {project.status}
                                    </span>
                                    <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                        <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </button>
                                </div>

                                <h3 className="text-base font-bold text-text-dark dark:text-white mb-2">{project.title}</h3>
                                <p className="text-sm text-text-gray dark:text-gray-400 mb-5 line-clamp-2">{project.description}</p>

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
                                    <span className="text-xs text-text-gray dark:text-gray-400">{project.updatedAt}</span>
                                </div>
                            </div>
                        ))}

                        {/* Add New Project Card */}
                        <button className="bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 hover:border-primary hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center min-h-[280px] group">
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-primary/10 dark:group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                                <svg className="w-6 h-6 text-text-gray dark:text-gray-400 group-hover:text-primary transition-colors" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <div className="text-base font-semibold text-text-dark dark:text-white mb-1">New Project</div>
                            <div className="text-sm text-text-gray dark:text-gray-400">Start a new team initiative</div>
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Projects;
