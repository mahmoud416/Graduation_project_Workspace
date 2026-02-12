import { useEffect, useState } from 'react';
import { Button } from './ui/button';

type DirectoryUser = {
    id: string;
    name: string;
    email: string;
    initials: string;
};

type DirectoryUserResponse = {
    id?: string;
    _id?: string;
    name?: string;
    full_name?: string;
    email?: string;
};

type CreateProjectModalProps = {
    onClose: () => void;
    onSuccess: () => void;
};

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const statusOptions = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ON_HOLD', label: 'On Hold' },
    { value: 'COMPLETED', label: 'Completed' },
];

const normalizeDirectoryEntry = (entry: DirectoryUserResponse): DirectoryUser => {
    const identifier = entry._id || entry.id;
    if (!identifier) {
        throw new Error('Directory entry missing identifier');
    }

    const name = entry.name || entry.full_name || entry.email || 'Team Member';
    const initials = name
        ? name
            .split(' ')
            .map((part) => part.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : (entry.email || 'TM').substring(0, 2).toUpperCase();

    return {
        id: identifier,
        name,
        email: entry.email ?? 'unknown@hericle.com',
        initials,
    };
};

const CreateProjectModal = ({ onClose, onSuccess }: CreateProjectModalProps) => {
    const [projectName, setProjectName] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('ACTIVE');
    const [progress, setProgress] = useState(0);
    const [subAdmins, setSubAdmins] = useState<DirectoryUser[]>([]);
    const [staffDirectory, setStaffDirectory] = useState<DirectoryUser[]>([]);
    const [selectedSubAdmins, setSelectedSubAdmins] = useState<string[]>([]);
    const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
    const [directoryLoading, setDirectoryLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDirectory = async () => {
            setDirectoryLoading(true);
            setError(null);
            const userId = localStorage.getItem('userId');
            if (!userId) {
                setError('Missing admin session. Please log in again.');
                setDirectoryLoading(false);
                return;
            }

            const headers = { 'X-User-Id': userId };
            try {
                const [subResponse, staffResponse] = await Promise.all([
                    fetch(`${API_BASE}/users?role=sub_admin`, { headers }),
                    fetch(`${API_BASE}/users?role=staff`, { headers }),
                ]);

                if (!subResponse.ok || !staffResponse.ok) {
                    throw new Error('Failed to load directory data');
                }

                const [subData, staffData] = await Promise.all([subResponse.json(), staffResponse.json()]);
                setSubAdmins(subData.map(normalizeDirectoryEntry));
                setStaffDirectory(staffData.map(normalizeDirectoryEntry));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Unable to load directory data';
                setError(message);
            } finally {
                setDirectoryLoading(false);
            }
        };

        fetchDirectory();
    }, []);

    const toggleStaffSelection = (id: string) => {
        setSelectedStaff((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const toggleSubAdminSelection = (id: string) => {
        setSelectedSubAdmins((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setError('Missing admin session. Please log in again.');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                title: projectName,
                description,
                status,
                progress,
                sub_admin_ids: selectedSubAdmins.map((id) => id.trim()),
                staff_ids: selectedStaff.map((id) => id.trim()),
            };

            const response = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let message = 'Failed to create project';
                try {
                    const body = await response.json();
                    message = body.detail || message;
                } catch (parseErr) {
                    message = await response.text();
                }
                throw new Error(message || 'Failed to create project');
            }

            setProjectName('');
            setDescription('');
            setSelectedSubAdmins([]);
            setSelectedStaff([]);
            setStatus('ACTIVE');
            setProgress(0);
            onSuccess();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to create project';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl">
                <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-text-gray">New Initiative</p>
                        <h2 className="text-2xl font-semibold text-text-dark dark:text-white">Create Project</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-text-gray hover:bg-gray-200 flex items-center justify-center"
                        aria-label="Close create project modal"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-gray uppercase">Project Name</label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                required
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
                                placeholder="e.g. Q4 Marketing Campaign"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-gray uppercase">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
                            >
                                {statusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-gray uppercase">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
                            placeholder="What is this project about?"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-gray uppercase">Progress</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={progress}
                                    onChange={(e) => setProgress(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-sm font-semibold text-text-dark dark:text-white w-12 text-right">{progress}%</span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-gray uppercase">Timeline</label>
                            <div className="h-12 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs text-text-gray">
                                Auto-tracked via activity
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-text-gray">Assigned Sub Admins</p>
                                    <p className="text-xs text-text-gray">Select sub admins who will co-manage</p>
                                </div>
                                <span className="text-xs font-semibold text-text-gray">{selectedSubAdmins.length} selected</span>
                            </div>
                            <div className="max-h-40 overflow-y-auto rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-4 space-y-2">
                                {directoryLoading ? (
                                    <p className="text-sm text-text-gray">Loading directory...</p>
                                ) : subAdmins.length === 0 ? (
                                    <p className="text-sm text-text-gray">No sub admins available.</p>
                                ) : (
                                    subAdmins.map((member) => (
                                        <label
                                            key={member.id}
                                            className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedSubAdmins.includes(member.id)}
                                                onChange={() => toggleSubAdminSelection(member.id)}
                                            />
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white text-xs font-semibold flex items-center justify-center">
                                                {member.initials}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-text-dark dark:text-white">{member.name}</p>
                                                <p className="text-xs text-text-gray">{member.email}</p>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-text-gray">Project Staff</p>
                                    <p className="text-xs text-text-gray">Select the team members who will execute this project</p>
                                </div>
                                <span className="text-xs font-semibold text-text-gray">{selectedStaff.length} selected</span>
                            </div>
                            <div className="max-h-40 overflow-y-auto rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-4 space-y-2">
                                {directoryLoading ? (
                                    <p className="text-sm text-text-gray">Loading directory...</p>
                                ) : staffDirectory.length === 0 ? (
                                    <p className="text-sm text-text-gray">No staff accounts available yet.</p>
                                ) : (
                                    staffDirectory.map((member) => (
                                        <label
                                            key={member.id}
                                            className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedStaff.includes(member.id)}
                                                onChange={() => toggleStaffSelection(member.id)}
                                            />
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-xs font-semibold flex items-center justify-center">
                                                {member.initials}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-text-dark dark:text-white">{member.name}</p>
                                                <p className="text-xs text-text-gray">{member.email}</p>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="text-text-gray"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || directoryLoading}
                            className="bg-primary text-white px-6"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Project'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProjectModal;
