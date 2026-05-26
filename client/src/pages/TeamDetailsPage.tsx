import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

interface TeamDetails {
    _id: string;
    name: string;
    description?: string;
    created_by: string;
    created_at: string;
}

interface TeamMember {
    _id: string;
    user_id: string;
    team_id: string;
    role: string;
    joined_at: string;
    user_email?: string;
    user_full_name?: string;
}

const TeamDetailsPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [team, setTeam] = useState<TeamDetails | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTeamData = async () => {
            try {
                const token = localStorage.getItem('token');
                const userId = localStorage.getItem('userId');
                const [teamRes, membersRes] = await Promise.all([
                    fetch(`${API_BASE}/teams/${id}`, {
                        headers: { 
                            'Authorization': `Bearer ${token ?? ''}`,
                            'X-User-Id': userId ?? ''
                        },
                    }),
                    fetch(`${API_BASE}/teams/${id}/members`, {
                        headers: { 
                            'Authorization': `Bearer ${token ?? ''}`,
                            'X-User-Id': userId ?? ''
                        },
                    })
                ]);

                if (!teamRes.ok) throw new Error('Failed to load team details');
                if (!membersRes.ok) throw new Error('Failed to load team members');

                const teamData = await teamRes.json();
                const membersData = await membersRes.json();

                setTeam(teamData);
                setMembers(membersData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error loading team details');
            } finally {
                setLoading(false);
            }
        };
        if (id) void fetchTeamData();
    }, [id]);

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Team Details" />
                <main className="p-8">
                    <button 
                        onClick={() => navigate('/teams')}
                        className="mb-6 flex items-center gap-2 text-sm font-semibold text-text-gray hover:text-primary transition-colors"
                    >
                        <span>&larr;</span> Back to Teams
                    </button>

                    {loading ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 animate-pulse border border-gray-200 dark:border-gray-700 h-64" />
                    ) : error ? (
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">{error}</div>
                    ) : team ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
                            <div className="flex items-start gap-6 mb-8">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                                    {team.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-2">{team.name}</h1>
                                    <p className="text-text-gray dark:text-gray-400 max-w-2xl">{team.description || 'No description provided for this team.'}</p>
                                </div>
                            </div>
                            
                            {/* Team Members List */}
                            <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-8">
                                <h2 className="text-xl font-bold text-text-dark dark:text-white mb-6">Team Members</h2>
                                
                                {members.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                                        {members.map(member => (
                                            <div 
                                                key={member._id} 
                                                onClick={() => navigate(`/portfolio/${member.user_id}`)}
                                                className="cursor-pointer flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-600 transition-colors"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-lg">
                                                    {(member.user_full_name || member.user_email || 'U').substring(0, 1).toUpperCase()}
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <h3 className="font-semibold text-text-dark dark:text-white truncate">
                                                        {member.user_full_name || 'Unknown User'}
                                                    </h3>
                                                    <p className="text-sm text-text-gray dark:text-gray-400 truncate">
                                                        {member.user_email || 'No email provided'}
                                                    </p>
                                                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md">
                                                        {member.role}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-text-gray dark:text-gray-400 mb-8">No members found for this team.</p>
                                )}


                            </div>
                        </div>
                    ) : null}
                </main>
            </div>
        </div>
    );
};

export default TeamDetailsPage;
