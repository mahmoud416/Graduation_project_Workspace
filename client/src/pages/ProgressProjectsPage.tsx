import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const ProgressProjectsPage = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const token = localStorage.getItem('token');
                const userId = localStorage.getItem('userId') || '';
                const res = await fetch(`${API_BASE}/projects`, {
                    headers: { 'Authorization': `Bearer ${token ?? ''}`, 'X-User-Id': userId },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        const mapped = data.map(proj => ({
                            id: proj._id,
                            title: proj.title,
                            description: proj.description || '',
                            status: proj.status || 'ACTIVE',
                            progress: typeof proj.progress === 'number' ? proj.progress : 0,
                            updatedAtRaw: proj.updated_at || new Date().toISOString(),
                        }));
                        setProjects(mapped.filter(p => p.id !== 'public-group' && p.id !== 'all-sub-admin'));
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        void fetchAll();
    }, []);

    const overallProgress = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Progress Report" />
                <main className="p-8">
                    <button onClick={() => navigate(-1)} className="mb-6 text-sm font-semibold text-text-gray hover:text-primary">&larr; Back</button>
                    
                    <div className="mb-8 flex flex-wrap gap-6 items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-2">Overall Progress Report</h1>
                            <p className="text-text-gray dark:text-gray-400">Tracking completion across {projects.length} custom projects.</p>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 text-center min-w-[200px]">
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Avg Progress</p>
                            <p className="text-4xl font-black text-primary">{overallProgress}%</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1,2,3].map(i => <div key={i} className="h-20 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />)}
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center p-10 bg-white dark:bg-gray-800 rounded-2xl">No projects to report on.</div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-text-gray dark:text-gray-400 font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Project Title</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 w-1/3">Completion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {projects.sort((a,b) => b.progress - a.progress).map(p => (
                                        <tr key={p.id} onClick={() => navigate(`/taskflow?projectId=${p.id}`)} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
                                            <td className="px-6 py-4 font-bold text-text-dark dark:text-gray-200">{p.title}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${p.status === 'COMPLETED' ? 'bg-success text-white' : p.status === 'ON HOLD' ? 'bg-warning text-white' : 'bg-primary text-white'}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div className={`h-full ${p.progress === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${p.progress}%` }} />
                                                    </div>
                                                    <span className="font-bold text-text-dark dark:text-gray-300 w-10 text-right">{p.progress}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ProgressProjectsPage;
