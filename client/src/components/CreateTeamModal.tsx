import React, { useState, useEffect } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface CreateTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [managerIds, setManagerIds] = useState<string[]>([]);
    const [subManagerIds, setSubManagerIds] = useState<string[]>([]);
    const [staffIds, setStaffIds] = useState<string[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const fetchUsers = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE}/users`, {
                    headers: { Authorization: `Bearer ${token ?? ''}` }
                });
                if (!res.ok) throw new Error('Failed to fetch users');
                const data = await res.json();
                
                const mappedUsers = data.map((u: any) => ({
                    id: u._id || u.id,
                    name: u.name || u.full_name || u.email,
                    email: u.email,
                    role: u.role
                }));
                setUsers(mappedUsers);
            } catch (err) {
                console.error(err);
                setError('Could not load users for selection');
            }
        };
        void fetchUsers();
        
        // Reset form
        setName('');
        setManagerIds([]);
        setSubManagerIds([]);
        setStaffIds([]);
        setError(null);
    }, [isOpen]);

    const managers = users.filter((u) => u.role === 'manager');
    const subManagers = users.filter((u) => u.role === 'subadmin' || u.role === 'sub_admin');
    const staff = users.filter((u) => u.role === 'member' || u.role === 'staff');

    const toggleManager = (id: string) => {
        setManagerIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSubManager = (id: string) => {
        setSubManagerIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleStaff = (id: string) => {
        setStaffIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Team name is required');
            return;
        }
        if (managerIds.length === 0) {
            setError('Please select at least one manager');
            return;
        }
        if (subManagerIds.length === 0) {
            setError('Please select at least one sub-manager');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token ?? ''}`
                },
                body: JSON.stringify({
                    name,
                    managerIds,
                    subManagerIds,
                    staffIds
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to create team');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error creating team');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-text-dark dark:text-white">Create New Team</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-text-gray transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50">
                            {error}
                        </div>
                    )}

                    <form id="create-team-form" onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Team Name *</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors dark:text-white"
                                placeholder="e.g. Engineering, Marketing, Design..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Managers (Multi-select) *</label>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                                {managers.length === 0 ? (
                                    <p className="text-sm text-gray-500 p-2">No managers available</p>
                                ) : managers.map(m => (
                                    <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={managerIds.includes(m.id)}
                                            onChange={() => toggleManager(m.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <div>
                                            <p className="text-sm font-medium dark:text-white">{m.name}</p>
                                            <p className="text-xs text-gray-500">{m.email}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Sub Managers (Multi-select) *</label>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                                {subManagers.length === 0 ? (
                                    <p className="text-sm text-gray-500 p-2">No sub-managers available</p>
                                ) : subManagers.map(m => (
                                    <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={subManagerIds.includes(m.id)}
                                            onChange={() => toggleSubManager(m.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <div>
                                            <p className="text-sm font-medium dark:text-white">{m.name}</p>
                                            <p className="text-xs text-gray-500">{m.email}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-dark dark:text-gray-300 mb-2">Staff (Multi-select) - Optional</label>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                                {staff.length === 0 ? (
                                    <p className="text-sm text-gray-500 p-2">No staff available</p>
                                ) : staff.map(m => (
                                    <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={staffIds.includes(m.id)}
                                            onChange={() => toggleStaff(m.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <div>
                                            <p className="text-sm font-medium dark:text-white">{m.name}</p>
                                            <p className="text-xs text-gray-500">{m.email}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-text-dark dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="create-team-form"
                        disabled={isLoading}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-primary/25 transition-all active:scale-95"
                    >
                        {isLoading ? 'Creating...' : 'Create Team'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTeamModal;
