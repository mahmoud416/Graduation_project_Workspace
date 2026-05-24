import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { Project } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const ActiveProjectsPage = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActive = async () => {
            try {
                const token = localStorage.getItem('token');
                const userId = localStorage.getItem('userId') || '';
                const res = await fetch(`${API_BASE}/projects?status=ACTIVE`, {
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
                        setProjects(mapped.filter(p => p.status === 'ACTIVE' && p.id !== 'public-group' && p.id !== 'all-sub-admin'));
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        void fetchActive();
    }, []);

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Active Projects" />
                <main className="p-8">
                    <button onClick={() => navigate(-1)} className="mb-6 text-sm font-semibold text-text-gray hover:text-primary">&larr; Back</button>
                    <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-8">Active Initiatives</h1>
                    
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1,2,3,4].map(i => <div key={i} className="h-40 bg-white dark:bg-gray-800 rounded-2xl animate-pulse" />)}
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center p-10 bg-white dark:bg-gray-800 rounded-2xl">No active projects found.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {projects.map(p => (
                                <div key={p.id} onClick={() => navigate(`/taskflow?projectId=${p.id}`)} className="bg-white dark:bg-gray-800 rounded-2xl p-6 cursor-pointer hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-primary text-white">ACTIVE</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-text-dark dark:text-white mb-2">{p.title}</h3>
                                    <p className="text-sm text-text-gray dark:text-gray-400 mb-6 line-clamp-2">{p.description}</p>
                                    <div className="mt-auto">
                                        <div className="flex justify-between text-xs mb-1 font-medium">
                                            <span className="text-text-gray">Progress</span>
                                            <span className="text-text-dark dark:text-white">{p.progress}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: `${p.progress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ActiveProjectsPage;
