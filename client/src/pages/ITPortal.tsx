import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const ITPortal = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'health' | 'users' | 'sessions' | 'audit' | 'settings'>('health');
    const [loading, setLoading] = useState(false);
    
    // Data states
    const [health, setHealth] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    
    // Settings state
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maxUploadSize, setMaxUploadSize] = useState(5);

    useEffect(() => {
        const role = localStorage.getItem('role');
        if (role !== 'admin' && role !== 'it_staff') {
            navigate('/dashboard');
        }
    }, [navigate]);

    const fetchHealth = async () => {
        try {
            const res = await fetch(`${API_BASE}/system/health`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHealth(data);
                setMaintenanceMode(data.maintenance_mode);
                setMaxUploadSize(data.max_upload_size_mb);
            }
        } catch (e) {}
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE}/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) setUsers(await res.json());
        } catch (e) {}
    };

    const fetchSessions = async () => {
        try {
            const res = await fetch(`${API_BASE}/users/sessions`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) setSessions(await res.json());
        } catch (e) {}
    };

    const fetchAuditLogs = async () => {
        try {
            const res = await fetch(`${API_BASE}/system/audit-logs`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) setAuditLogs(await res.json());
        } catch (e) {}
    };

    useEffect(() => {
        if (activeTab === 'health') fetchHealth();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'sessions') fetchSessions();
        if (activeTab === 'audit') fetchAuditLogs();
        if (activeTab === 'settings') fetchHealth();
    }, [activeTab]);

    const handleForceLogout = async (userId: string) => {
        if (!confirm('Are you sure you want to force logout this user?')) return;
        try {
            await fetch(`${API_BASE}/system/force-logout/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            fetchUsers();
        } catch (e) {}
    };

    const handleSaveSettings = async () => {
        try {
            await fetch(`${API_BASE}/system/settings`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maintenance_mode: maintenanceMode,
                    max_upload_size: maxUploadSize
                })
            });
            alert('Settings saved successfully');
        } catch (e) {}
    };

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="IT Portal" />

                <main className="page-main pb-10 px-10">
                    <div className="mb-8">
                        <p className="text-xs font-semibold tracking-wide uppercase text-primary">Administration</p>
                        <h1 className="text-3xl font-semibold text-text-dark dark:text-white mb-2">IT Operations Portal</h1>
                        <p className="text-sm text-text-gray dark:text-gray-400">
                            Monitor system health, manage security, and control access.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl w-max mb-8">
                        {['health', 'users', 'sessions', 'audit', 'settings'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                                    activeTab === tab 
                                    ? 'bg-white dark:bg-gray-800 text-text-dark dark:text-white shadow-sm' 
                                    : 'text-text-gray dark:text-gray-400 hover:text-text-dark dark:hover:text-gray-200'
                                }`}
                            >
                                {tab.replace('-', ' ')}
                            </button>
                        ))}
                    </div>

                    {/* Tab Contents */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
                        
                        {activeTab === 'health' && health && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                                    <div className="text-blue-500 mb-2 text-sm font-semibold uppercase">Total Users</div>
                                    <div className="text-3xl font-bold text-text-dark dark:text-white">{health.total_users}</div>
                                </div>
                                <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800/30">
                                    <div className="text-green-500 mb-2 text-sm font-semibold uppercase">Active Sessions</div>
                                    <div className="text-3xl font-bold text-text-dark dark:text-white">{health.active_sessions}</div>
                                </div>
                                <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                                    <div className="text-purple-500 mb-2 text-sm font-semibold uppercase">DB Status</div>
                                    <div className="text-xl font-bold text-text-dark dark:text-white capitalize">{health.status}</div>
                                </div>
                                <div className="p-6 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-800/30">
                                    <div className="text-orange-500 mb-2 text-sm font-semibold uppercase">Error Rate</div>
                                    <div className="text-3xl font-bold text-text-dark dark:text-white">{health.error_rate}</div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b dark:border-gray-800 text-sm text-text-gray">
                                        <th className="pb-3">Name</th>
                                        <th className="pb-3">Role</th>
                                        <th className="pb-3">Status</th>
                                        <th className="pb-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u._id} className="border-b dark:border-gray-800/50">
                                            <td className="py-3 text-sm text-text-dark dark:text-gray-200">{u.name || u.full_name}</td>
                                            <td className="py-3 text-sm"><span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">{u.role}</span></td>
                                            <td className="py-3 text-sm">
                                                <span className={`px-2 py-1 rounded-md ${u.status === 'suspended' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    {u.status || 'active'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-sm text-right">
                                                <button onClick={() => handleForceLogout(u._id)} className="text-red-500 hover:underline">Force Logout (Ban)</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'sessions' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b dark:border-gray-800 text-sm text-text-gray">
                                        <th className="pb-3">User</th>
                                        <th className="pb-3">Login Time</th>
                                        <th className="pb-3">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map(s => (
                                        <tr key={s._id} className="border-b dark:border-gray-800/50">
                                            <td className="py-3 text-sm text-text-dark dark:text-gray-200">{s.name}</td>
                                            <td className="py-3 text-sm">{new Date(s.login_time).toLocaleString()}</td>
                                            <td className="py-3 text-sm">{s.duration_minutes} mins</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'audit' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b dark:border-gray-800 text-sm text-text-gray">
                                        <th className="pb-3">Time</th>
                                        <th className="pb-3">User</th>
                                        <th className="pb-3">Action</th>
                                        <th className="pb-3">Entity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map(l => (
                                        <tr key={l._id} className="border-b dark:border-gray-800/50">
                                            <td className="py-3 text-sm">{new Date(l.timestamp).toLocaleString()}</td>
                                            <td className="py-3 text-sm">
                                                <div className="font-medium text-text-dark dark:text-gray-200">{l.user_name}</div>
                                                <div className="text-xs text-text-gray">{l.user_id}</div>
                                            </td>
                                            <td className="py-3 text-sm font-semibold text-primary">{l.action_type}</td>
                                            <td className="py-3 text-sm">{l.entity_type} ({l.entity_id})</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'settings' && (
                            <div className="max-w-md space-y-6">
                                <div>
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={maintenanceMode}
                                            onChange={e => setMaintenanceMode(e.target.checked)}
                                            className="w-5 h-5 text-primary rounded focus:ring-primary"
                                        />
                                        <span className="text-text-dark dark:text-white font-medium">Enable Maintenance Mode</span>
                                    </label>
                                    <p className="mt-1 text-sm text-text-gray ml-8">Blocks all users except IT Admins.</p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-text-dark dark:text-white mb-2">Max Upload Size (MB)</label>
                                    <input 
                                        type="number"
                                        value={maxUploadSize}
                                        onChange={e => setMaxUploadSize(Number(e.target.value))}
                                        className="w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent"
                                    />
                                </div>

                                <button onClick={handleSaveSettings} className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-blue-600">
                                    Save Settings
                                </button>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
};

export default ITPortal;
