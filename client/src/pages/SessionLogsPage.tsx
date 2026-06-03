import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

type SessionLog = {
    _id: string;
    user_id: string;
    name: string;
    email: string;
    role: string;
    login_time: string;
    last_active: string;
    duration_minutes: number;
};

const SessionLogsPage = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<SessionLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const role = localStorage.getItem('role');
        if (role !== 'admin' && role !== 'it_staff') {
            navigate('/dashboard');
        }
    }, [navigate]);

    const fetchSessions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/users/sessions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                    'X-User-Id': localStorage.getItem('userId') || '',
                }
            });
            if (!res.ok) throw new Error('Failed to load session logs');
            const data = await res.json();
            setSessions(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const formatTime = (isoString: string) => {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatDate = (isoString: string) => {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const formatDuration = (mins: number) => {
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Session Logs" />

                <main className="page-main pb-10 px-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <p className="text-xs font-semibold tracking-wide uppercase text-primary">Audit & Security</p>
                            <h1 className="text-3xl font-semibold text-text-dark dark:text-white mb-2">User Session Logs</h1>
                            <p className="text-sm text-text-gray dark:text-gray-400">
                                Monitor who entered the system, when, and how long they stayed active.
                            </p>
                        </div>
                        <button
                            onClick={fetchSessions}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Refresh Logs
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl overflow-hidden shadow-sm">
                        {isLoading ? (
                            <div className="p-8 text-center text-text-gray">Loading logs...</div>
                        ) : error ? (
                            <div className="p-8 text-center text-red-500">{error}</div>
                        ) : sessions.length === 0 ? (
                            <div className="p-8 text-center text-text-gray">No session logs found.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                            <th className="px-6 py-4 text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wider">User</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wider">Role</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wider">Login Time</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wider">Duration</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wider">Last Active</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {sessions.map((session) => (
                                            <tr key={session._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-medium text-text-dark dark:text-gray-200">{session.name}</div>
                                                    <div className="text-xs text-text-gray dark:text-gray-500">{session.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                                        {session.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-text-dark dark:text-gray-300">
                                                    <div>{formatTime(session.login_time)}</div>
                                                    <div className="text-xs text-text-gray dark:text-gray-500">{formatDate(session.login_time)}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-text-dark dark:text-gray-300">
                                                    {formatDuration(session.duration_minutes)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-text-dark dark:text-gray-300">
                                                    {formatTime(session.last_active)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SessionLogsPage;
