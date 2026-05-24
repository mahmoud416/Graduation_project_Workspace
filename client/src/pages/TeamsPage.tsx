import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

interface Team {
    _id: string;
    name: string;
    description?: string;
    created_by: string;
    created_at: string;
    managerIds?: string[];
    subManagerIds?: string[];
    staffIds?: string[];
}

const TeamsPage = () => {
    const navigate = useNavigate();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE}/teams`, {
                    headers: { Authorization: `Bearer ${token ?? ''}` },
                });
                if (!res.ok) throw new Error('Failed to load teams');
                const data = await res.json();
                setTeams(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error loading teams');
            } finally {
                setLoading(false);
            }
        };
        void fetchTeams();
    }, []);

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Teams" />
                <main className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-2">Teams</h1>
                            <p className="text-sm text-text-gray dark:text-gray-400">View and manage workspace teams.</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 h-40 animate-pulse border border-gray-200 dark:border-gray-700" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">{error}</div>
                    ) : teams.length === 0 ? (
                        <div className="text-center p-10 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-text-gray dark:text-gray-400">
                            No teams found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {teams.map(team => {
                                const totalMembers = (team.managerIds?.length || 0) + (team.subManagerIds?.length || 0) + (team.staffIds?.length || 0) + 1; // +1 for creator/manager if not in lists
                                return (
                                    <div
                                        key={team._id}
                                        onClick={() => navigate(`/teams/${team._id}`)}
                                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center font-bold text-lg">
                                                {team.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-semibold rounded-full text-text-gray dark:text-gray-300">
                                                {totalMembers} Members
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-text-dark dark:text-white mb-2">{team.name}</h3>
                                        <p className="text-sm text-text-gray dark:text-gray-400 mb-4 line-clamp-2">
                                            {team.description || 'No description provided.'}
                                        </p>
                                        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 text-sm font-medium text-primary flex justify-between items-center">
                                            <span>View Team Details</span>
                                            <span>&rarr;</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default TeamsPage;
