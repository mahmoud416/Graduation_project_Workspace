import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'X-User-Id': localStorage.getItem('userId') ?? '',
    Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
});

// Admin can assign sub_manager role — IT role is excluded from admin's scope
const ASSIGNABLE_ROLES = ['staff', 'sub_manager', 'admin'] as const;

type Tab = 'users' | 'tasks' | 'add-user';

interface UserRow {
    _id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    last_login?: string;
    created_at?: string;
}

interface TaskRow {
    _id: string;
    title?: string;
    status?: string;
    assigned_to?: string;
    created_at?: string;
}

const roleBadge = (role: string) => {
    const map: Record<string, string> = {
        admin:       'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        sub_manager: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
        staff:       'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300',
        it:          'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    };
    return map[role] ?? map.staff;
};

const statusBadge = (s: string) =>
    s === 'active'
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300';

const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ─── AdminPortal ──────────────────────────────────────────────────────────────

export default function AdminPortal() {
    const navigate = useNavigate();
    const [tab, setTab]         = useState<Tab>('users');
    const [users, setUsers]     = useState<UserRow[]>([]);
    const [tasks, setTasks]     = useState<TaskRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    // Inline role editor
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingRole, setEditingRole]     = useState('');
    const [saving, setSaving]               = useState(false);

    // Add-user form
    const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'staff', phone: '' });
    const [formError, setFormError]     = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [submitting, setSubmitting]   = useState(false);

    // Protect route — only admin allowed
    useEffect(() => {
        const role = localStorage.getItem('role');
        if (role !== 'admin') navigate('/dashboard', { replace: true });
    }, [navigate]);

    const fetchUsers = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${API_BASE}/it/users?limit=200`, { headers: authHeaders() });
            if (!res.ok) throw new Error(await res.text());
            setUsers(await res.json());
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    const fetchTasks = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${API_BASE}/it/tasks?limit=200`, { headers: authHeaders() });
            if (!res.ok) throw new Error(await res.text());
            setTasks(await res.json());
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (tab === 'users') fetchUsers();
        if (tab === 'tasks') fetchTasks();
    }, [tab, fetchUsers, fetchTasks]);

    const saveRole = async (userId: string) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/it/users/${userId}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ role: editingRole }),
            });
            if (!res.ok) throw new Error(await res.text());
            setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: editingRole } : u));
            setEditingUserId(null);
        } catch (e: any) { alert('Failed to update role: ' + e.message); }
        finally { setSaving(false); }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null); setFormSuccess(null); setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/it/users`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(err.detail ?? JSON.stringify(err));
            }
            setFormSuccess(`User "${form.full_name}" created successfully.`);
            setForm({ email: '', password: '', full_name: '', role: 'staff', phone: '' });
            if (tab === 'users') fetchUsers();
        } catch (e: any) { setFormError(e.message); }
        finally { setSubmitting(false); }
    };

    const TABS: { id: Tab; label: string }[] = [
        { id: 'users',    label: 'Users' },
        { id: 'tasks',    label: 'Tasks' },
        { id: 'add-user', label: 'Add User' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <Header title="Admin Portal" />

            <main
                className="overflow-y-auto p-6"
                style={{ marginLeft: 'var(--sidebar-width)', paddingTop: 'calc(4rem + 1.5rem)' }}
            >
                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                                tab === t.id
                                    ? 'bg-white dark:bg-gray-800 border border-b-white dark:border-gray-700 dark:border-b-gray-800 text-blue-600 dark:text-blue-400 -mb-px'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 text-red-700 dark:text-red-400 text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* ── Users tab ── */}
                {tab === 'users' && !loading && (
                    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                <tr>
                                    {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {users.map(u => (
                                    <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{u.name}</td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                                        <td className="px-4 py-3">
                                            {editingUserId === u._id ? (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={editingRole}
                                                        onChange={e => setEditingRole(e.target.value)}
                                                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                                    >
                                                        {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={() => saveRole(u._id)}
                                                        disabled={saving}
                                                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingUserId(null)}
                                                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>
                                                    {u.role}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(u.status)}`}>
                                                {u.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmt(u.last_login)}</td>
                                        <td className="px-4 py-3">
                                            {/* Admin cannot reassign IT role — only change to sub_manager / staff / admin */}
                                            {u.role !== 'it' && editingUserId !== u._id && (
                                                <button
                                                    onClick={() => { setEditingUserId(u._id); setEditingRole(u.role); }}
                                                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                                >
                                                    Change Role
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Tasks tab ── */}
                {tab === 'tasks' && !loading && (
                    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                <tr>
                                    {['Title', 'Status', 'Assigned To', 'Created At'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {tasks.map(t => (
                                    <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{t.title || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{t.status || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{t.assigned_to || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmt(t.created_at)}</td>
                                    </tr>
                                ))}
                                {tasks.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No tasks found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Add User tab ── */}
                {tab === 'add-user' && (
                    <div className="max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-sm px-8 py-6">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-5">Create New User</h2>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            {[
                                { id: 'full_name', label: 'Full Name', type: 'text',     required: true },
                                { id: 'email',     label: 'Email',     type: 'email',    required: true },
                                { id: 'password',  label: 'Password',  type: 'password', required: true },
                                { id: 'phone',     label: 'Phone',     type: 'text',     required: false },
                            ].map(f => (
                                <div key={f.id}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {f.label} {f.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        type={f.type}
                                        required={f.required}
                                        value={(form as any)[f.id]}
                                        onChange={e => setForm(prev => ({ ...prev, [f.id]: e.target.value }))}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            ))}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>

                            {formError   && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
                            {formSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400">{formSuccess}</p>}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                            >
                                {submitting ? 'Creating...' : 'Create User'}
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}
