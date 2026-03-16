import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

type CreateModalState = {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    role: 'admin' | 'sub_admin' | 'staff' | 'quality_control' | 'quality_manager';
    subAdminId?: string;
};

type AccountEntry = {
    id: string;
    name: string;
    email: string;
    role: string;
    status?: string;
    phone?: string;
    password?: string;
};

type ApiUserResponse = {
    _id?: string;
    id?: string;
    name?: string;
    full_name?: string;
    email: string;
    role: string;
    status?: string;
    phone?: string;
    password?: string;
};

const initialCreateForm: CreateModalState = {
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'staff',
    subAdminId: ''
};

type ModalShellProps = {
    title: string;
    children: ReactNode;
    onClose: () => void;
};

const ModalShell = ({ title, children, onClose }: ModalShellProps) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                <h2 className="text-xl font-semibold text-text-dark dark:text-white">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-text-gray hover:bg-gray-200"
                >
                    ✕
                </button>
            </div>
            <div className="px-6 py-6">
                {children}
            </div>
        </div>
    </div>
);

const ConfigurationPage = () => {
    const navigate = useNavigate();
    const [role, setRole] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<AccountEntry[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState<CreateModalState>(initialCreateForm);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedAccount, setSelectedAccount] = useState<AccountEntry | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [originalPassword, setOriginalPassword] = useState('');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const storedRole = localStorage.getItem('role');
        setRole(storedRole);
        if (storedRole && storedRole !== 'admin') {
            navigate('/dashboard');
        }
    }, [navigate]);

    const adminId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

    const fetchAccounts = useCallback(async () => {
        if (!adminId) {
            setError('Missing admin session. Please log in again.');
            return;
        }
        setIsLoadingAccounts(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/users`, {
                headers: { 'X-User-Id': adminId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
            });
            if (!response.ok) {
                throw new Error(await response.text());
            }
            const data = await response.json();
            const mapped: AccountEntry[] = data.map((item: ApiUserResponse) => ({
                id: item._id || item.id || '',
                name: item.name || item.full_name || item.email || 'Account',
                email: item.email,
                role: item.role,
                status: item.status,
                phone: item.phone,
                password: item.password,
            }));
            setAccounts(mapped);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to load accounts';
            setError(message);
        } finally {
            setIsLoadingAccounts(false);
        }
    }, [adminId]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const subAdminOptions = useMemo(() => accounts.filter((account) => account.role === 'sub_admin'), [accounts]);

    const registerUser = async (payload: Record<string, string | undefined>) => {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        return response.json();
    };

    const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setFeedback(null);

        if (!adminId) {
            setError('Missing admin session. Please log in again.');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload: Record<string, string | undefined> = {
                email: createForm.email,
                password: createForm.password,
                full_name: createForm.fullName,
                role: createForm.role,
                admin_id: adminId,
                phone: createForm.phone,
                status: 'active'
            };

            if (createForm.role === 'staff' && createForm.subAdminId) {
                payload.sub_admin_id = createForm.subAdminId;
            }

            await registerUser(payload);
            setFeedback('Account created successfully.');
            setCreateForm(initialCreateForm);
            setShowCreateModal(false);
            fetchAccounts();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to create account.';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (accountId: string) => {
        if (!adminId) {
            setError('Missing admin session. Please log in again.');
            return;
        }
        setIsDeleting(true);
        setError(null);
        try {
            const resp = await fetch(`${API_BASE}/users/${accountId}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': adminId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
            });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            setFeedback('Account deleted successfully.');
            closeDetailModal();
            setSelectedAccount(null);
            fetchAccounts();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to delete account.';
            setError(message);
        } finally {
            setIsDeleting(false);
        }
    };

    const closeDetailModal = () => {
        setIsDetailOpen(false);
        setIsEditing(false);
        setOriginalPassword('');
    };

    const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!adminId || !selectedAccount) {
            setError('Missing admin session. Please log in again.');
            return;
        }
        setIsUpdating(true);
        setError(null);
        try {
            const resp = await fetch(`${API_BASE}/users/${selectedAccount.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': adminId,
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
                },
                body: JSON.stringify({
                    name: selectedAccount.name,
                    phone: selectedAccount.phone,
                    role: selectedAccount.role,
                    status: selectedAccount.status,
                }),
            });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }

            const passwordChanged =
                typeof selectedAccount.password === 'string' &&
                selectedAccount.password !== originalPassword;

            if (passwordChanged) {
                const passwordResp = await fetch(`${API_BASE}/auth/change-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': adminId,
                        'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
                    },
                    body: JSON.stringify({
                        user_id: selectedAccount.id,
                        new_password: selectedAccount.password,
                    }),
                });

                if (!passwordResp.ok) {
                    throw new Error(await passwordResp.text());
                }

                setOriginalPassword(selectedAccount.password || '');
            }

            setFeedback(passwordChanged ? 'Account and password updated successfully.' : 'Account updated successfully.');
            setIsEditing(false);
            fetchAccounts();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to update account.';
            setError(message);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Configuration" />

                <main className="page-main pb-10 px-10">
                    <div className="flex flex-wrap items-center justify-between mb-8">
                        <div>
                            <p className="text-xs font-semibold tracking-wide uppercase text-text-gray">Workspace Controls</p>
                            <h1 className="text-3xl font-semibold text-text-dark dark:text-white">Configuration Center</h1>
                        </div>
                        {role && (
                            <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-primary border border-primary/20">
                                Signed in as {role}
                            </span>
                        )}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Step 1</p>
                            <h2 className="text-2xl font-semibold text-text-dark dark:text-white mb-3">Create Account</h2>
                            <p className="text-sm text-text-gray dark:text-gray-400 mb-6">
                                Choose the required role (admin, sub admin, staff, quality control, or quality manager) and create the account instantly.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-blue-600"
                            >
                                + Make Account
                            </button>
                        </section>

                        <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Step 2</p>
                            <h2 className="text-2xl font-semibold text-text-dark dark:text-white mb-3">Assign Staff</h2>
                            <p className="text-sm text-text-gray dark:text-gray-400 mb-6">
                                Link staff to a sub admin right during creation or when editing later.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className="h-11 px-5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600"
                            >
                                + Add Staff
                            </button>
                        </section>

                        <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Step 3</p>
                            <h2 className="text-2xl font-semibold text-text-dark dark:text-white mb-3">Review Accounts</h2>
                            <p className="text-sm text-text-gray dark:text-gray-400 mb-6">
                                Browse every workspace account, edit permissions, or remove access.
                            </p>
                            <button
                                type="button"
                                onClick={() => document.getElementById('accounts-list')?.scrollIntoView({ behavior: 'smooth' })}
                                className="h-11 px-5 rounded-xl bg-gray-100 text-text-dark dark:bg-gray-800 dark:text-white text-sm font-semibold hover:bg-gray-200"
                            >
                                View Accounts
                            </button>
                        </section>
                    </div>

                    <div id="accounts-list" className="mt-8 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-text-dark dark:text-white">All Accounts</h3>
                                <p className="text-sm text-text-gray dark:text-gray-400">Manage every user in the workspace.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600"
                            >
                                + Make Account
                            </button>
                        </div>

                        {isLoadingAccounts ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-text-gray">Loading accounts...</div>
                        ) : accounts.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-text-gray">
                                No accounts found. Create one to get started.
                            </div>
                        ) : (
                            <ul className="rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                                {accounts.map((account) => (
                                    <li key={account.id} className="flex items-center justify-between px-4 py-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-dark dark:text-white">{account.name}</p>
                                            <p className="text-xs text-text-gray dark:text-gray-400">{account.email} · {account.role}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedAccount(account);
                                                setIsDetailOpen(true);
                                                setIsEditing(false);
                                                setOriginalPassword(account.password ?? '');
                                            }}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                            aria-label="Open account actions"
                                        >
                                            <svg className="w-4 h-4 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                            </svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {feedback && (
                        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
                            {feedback}
                        </div>
                    )}
                    {error && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </main>
            </div>

            {showCreateModal && (
                <ModalShell title="Create Account" onClose={() => setShowCreateModal(false)}>
                    <form className="space-y-4" onSubmit={handleCreateSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Full Name</label>
                                <input
                                    type="text"
                                    value={createForm.fullName}
                                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                                    required
                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Email</label>
                                <input
                                    type="email"
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                    required
                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Password</label>
                                <input
                                    type="password"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                    required
                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Phone</label>
                                <input
                                    type="tel"
                                    value={createForm.phone}
                                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Role</label>
                                <select
                                    value={createForm.role}
                                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as CreateModalState['role'] })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="sub_admin">Sub Admin</option>
                                    <option value="staff">Staff</option>
                                    <option value="quality_control">Quality Control</option>
                                    <option value="quality_manager">Quality Manager</option>
                                </select>
                            </div>
                            {createForm.role === 'staff' && (
                                <div>
                                    <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Assign to Sub Admin</label>
                                    <select
                                        value={createForm.subAdminId}
                                        onChange={(e) => setCreateForm({ ...createForm, subAdminId: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                    >
                                        <option value="">Unassigned</option>
                                        {subAdminOptions.map((sub) => (
                                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-text-gray"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60"
                            >
                                {isSubmitting ? 'Saving...' : 'Create Account'}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {isDetailOpen && selectedAccount && (
                <ModalShell title="Account Details" onClose={closeDetailModal}>
                    {!isEditing ? (
                        <div className="space-y-3 text-sm text-text-dark dark:text-gray-200">
                            <p><span className="font-semibold">Name:</span> {selectedAccount.name}</p>
                            <p><span className="font-semibold">Email:</span> {selectedAccount.email}</p>
                            <p><span className="font-semibold">Role:</span> {selectedAccount.role}</p>
                            <p><span className="font-semibold">Status:</span> {selectedAccount.status || 'active'}</p>
                            {selectedAccount.phone && <p><span className="font-semibold">Phone:</span> {selectedAccount.phone}</p>}
                            {selectedAccount.password && <p><span className="font-semibold">Password:</span> {selectedAccount.password}</p>}
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-text-gray"
                                >
                                    Edit Info
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(selectedAccount.id)}
                                    className="h-10 px-4 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form className="space-y-4" onSubmit={handleUpdate}>
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Full Name</label>
                                <input
                                    type="text"
                                    value={selectedAccount.name}
                                    onChange={(e) => setSelectedAccount({ ...selectedAccount, name: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Phone</label>
                                <input
                                    type="tel"
                                    value={selectedAccount.phone || ''}
                                    onChange={(e) => setSelectedAccount({ ...selectedAccount, phone: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Password</label>
                                <input
                                    type="text"
                                    value={selectedAccount.password ?? ''}
                                    onChange={(e) => setSelectedAccount({ ...selectedAccount, password: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Role</label>
                                    <select
                                        value={selectedAccount.role}
                                        onChange={(e) => setSelectedAccount({ ...selectedAccount, role: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="sub_admin">Sub Admin</option>
                                        <option value="staff">Staff</option>
                                        <option value="quality_control">Quality Control</option>
                                    <option value="quality_manager">Quality Manager</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Status</label>
                                    <select
                                        value={selectedAccount.status || 'active'}
                                        onChange={(e) => setSelectedAccount({ ...selectedAccount, status: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-text-gray"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdating}
                                    className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60"
                                >
                                    {isUpdating ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}
                </ModalShell>
            )}
        </div>
    );
};

export default ConfigurationPage;
