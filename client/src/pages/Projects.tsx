import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';
import CreateTask from './CreateTask';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const Projects = () => {
    const navigate = useNavigate();
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);

    const fetchProjects = async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            console.error('UserId is missing from localStorage');
            return;
        }

        try {
            console.log('Fetching teams for user:', userId);
            // 1. Fetch user's teams
            const teamRes = await fetch(`${API_BASE}/teams`, {
                headers: { 'X-User-Id': userId }
            });

            if (!teamRes.ok) {
                console.error('Failed to fetch teams:', await teamRes.text());
                return;
            }

            const teams = await teamRes.json();
            console.log('Teams fetched:', teams);

            if (!teams || teams.length === 0) {
                setProjects([]);
                return;
            }

            // 2. Fetch tasks for each team
            const tasksPromises = teams.map(async (team: any) => {
                try {
                    const tasksRes = await fetch(`${API_BASE}/tasks?team_id=${team.id || team._id}`, {
                        headers: { 'X-User-Id': userId }
                    });
                    if (tasksRes.ok) {
                        const tasks = await tasksRes.json();
                        // Attach team info to tasks
                        return tasks.map((t: any) => ({ ...t, teamName: team.name }));
                    }
                    console.error('Failed to fetch tasks for team:', team.name, await tasksRes.text());
                    return [];
                } catch (err) {
                    console.error('Error fetching tasks for team:', team.name, err);
                    return [];
                }
            });

            const tasksResults = await Promise.all(tasksPromises);
            const allTasks = tasksResults.flat();
            console.log('All tasks fetched:', allTasks);

            // 3. Map to Project format
            const mappedProjects: Project[] = allTasks.map((t) => ({
                id: t.id || t._id,
                title: t.title,
                description: t.description || 'No description provided',
                status: t.status === 'done' ? 'COMPLETED' : (t.status === 'in_progress' ? 'ACTIVE' : 'ON HOLD'),
                progress: t.status === 'done' ? 100 : (t.status === 'in_progress' ? 50 : 0),
                team: [t.teamName ? t.teamName.substring(0, 2).toUpperCase() : 'TM'],
                updatedAt: new Date(t.created_at || Date.now()).toLocaleDateString()
            }));

            // Sort by createdAt desc if possible, or just reverse to show newest first
            setProjects(mappedProjects.reverse());

        } catch (error) {
            console.error('Failed to fetch projects:', error);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

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
                        <h1 className="text-2xl font-bold text-text-dark dark:text-white">no</h1>


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
                            <div
                                key={project.id}
                                onClick={() => navigate('/taskflow')}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-primary transition-all cursor-pointer"
                            >
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
                        <button
                            onClick={() => setIsCreateTaskOpen(true)}
                            className="bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 hover:border-primary hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center min-h-[280px] group"
                        >
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
            {isCreateTaskOpen && (
                <CreateTask
                    onClose={() => setIsCreateTaskOpen(false)}
                    onSuccess={() => {
                        setIsCreateTaskOpen(false);
                        fetchProjects();
                    }}
                />
            )}
        </div>
    );
};

export default Projects;
