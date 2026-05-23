import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import MultiAssigneePicker, { type TeamMember } from '../components/MultiAssigneePicker';

const PRIORITIES = ['Low', 'Medium', 'High'];
const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
});

interface CreateTaskProps {
    onClose?: () => void;
    onSuccess?: () => void;
}

const CreateTask = ({ onClose, onSuccess }: CreateTaskProps) => {
    const navigate = useNavigate();

    /* ── Form state ── */
    const [taskName, setTaskName]     = useState('');
    const [priority, setPriority]     = useState('');
    const [team, setTeam]             = useState('');
    const [details, setDetails]       = useState('');
    const [reportType, setReportType] = useState('');
    const [isLoading, setIsLoading]   = useState(false);
    const [error, setError]           = useState('');

    /* ── Multi-assignee + visibility ── */
    const [assignees, setAssignees]         = useState<string[]>([]);
    const [visibility, setVisibility]       = useState<'team' | 'private'>('team');

    /* ── Team / member data ── */
    const [teamsList, setTeamsList]   = useState<any[]>([]);
    const [members, setMembers]       = useState<TeamMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    /* ── New team inline creation ── */
    const [isCreatingTeam, setIsCreatingTeam] = useState(false);
    const [newTeamName, setNewTeamName]       = useState('');

    /* ── Fetch teams on mount ── */
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/teams`, { headers: authHeaders() });
                if (res.ok) setTeamsList(await res.json());
            } catch {
                console.error('Failed to fetch teams');
            }
        })();
    }, []);

    /* ── Fetch team members whenever selected team changes ── */
    useEffect(() => {
        if (!team) { setMembers([]); return; }
        setLoadingMembers(true);
        (async () => {
            try {
                // Try memberships endpoint first, fall back to users
                const res = await fetch(`${API_BASE}/teams/${team}/members`, { headers: authHeaders() });
                if (res.ok) {
                    const data: any[] = await res.json();
                    setMembers(
                        data.map((m) => ({
                            id:    m.user_id ?? m._id ?? m.id,
                            name:  m.full_name ?? m.name ?? m.email ?? m.user_id,
                            email: m.email,
                            role:  m.role,
                        }))
                    );
                }
            } catch {
                console.error('Failed to fetch members');
            } finally {
                setLoadingMembers(false);
            }
        })();
        // Clear previous assignees when team changes
        setAssignees([]);
    }, [team]);

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/teams`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ name: newTeamName }),
            });
            if (res.ok) {
                const newTeam = await res.json();
                setTeamsList((prev) => [...prev, newTeam]);
                setTeam(newTeam.id ?? newTeam._id);
                setIsCreatingTeam(false);
                setNewTeamName('');
            } else {
                setError('Failed to create team');
            }
        } catch {
            setError('Error creating team');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!team) { setError('Please select a team.'); setIsLoading(false); return; }
        if (assignees.length === 0) { setError('Please select at least one assignee.'); setIsLoading(false); return; }

        try {
            const payload = {
                title:       taskName,
                description: details,
                team_id:     team,
                assigned_to: assignees[0],      // primary assignee
                assignees,                       // full list
                visibility,
                priority:    priority.toLowerCase(),
                status:      'todo',
                report_type: reportType || null,
            };

            const res = await fetch(`${API_BASE}/tasks`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(err || 'Failed to create task');
            }

            onSuccess?.();
            onClose ? onClose() : navigate(-1);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to create task.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => (onClose ? onClose() : navigate(-1));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[92vh]">

                {/* Header */}
                <div className="p-6 pb-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Task</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add a new task to your workspace</p>
                </div>

                {/* Body */}
                <div className="p-6 pt-4 overflow-y-auto space-y-5">
                    <form id="create-task-form" onSubmit={handleSubmit} className="space-y-5">

                        {/* Error banner */}
                        {error && (
                            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2.5">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Task Name */}
                        <div className="space-y-1.5">
                            <label htmlFor="taskName" className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                Task Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="taskName"
                                type="text"
                                value={taskName}
                                onChange={(e) => setTaskName(e.target.value)}
                                placeholder="Enter task name"
                                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Priority */}
                        <div className="space-y-1.5">
                            <label htmlFor="priority" className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                Priority <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    id="priority"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer text-gray-700 dark:text-gray-300"
                                    required
                                >
                                    <option value="" disabled>Select priority</option>
                                    {PRIORITIES.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Responsible Team */}
                        <div className="space-y-1.5">
                            <label htmlFor="team" className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                Responsible Team <span className="text-red-500">*</span>
                            </label>
                            {!isCreatingTeam ? (
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            id="team"
                                            value={team}
                                            onChange={(e) => setTeam(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer text-gray-700 dark:text-gray-300"
                                            required
                                        >
                                            <option value="" disabled>Select team</option>
                                            {teamsList.map((t) => (
                                                <option key={t.id ?? t._id} value={t.id ?? t._id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                    <Button type="button" variant="outline" onClick={() => setIsCreatingTeam(true)} className="whitespace-nowrap px-3">
                                        + New
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTeamName}
                                        onChange={(e) => setNewTeamName(e.target.value)}
                                        placeholder="Enter team name"
                                        className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <Button type="button" onClick={handleCreateTeam} disabled={!newTeamName.trim()} className="bg-green-600 hover:bg-green-700 text-white">Save</Button>
                                    <Button type="button" variant="ghost" onClick={() => setIsCreatingTeam(false)}>Cancel</Button>
                                </div>
                            )}
                        </div>

                        {/* ── Multi-Assignee + Visibility ── */}
                        {team && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                    Assignees & Visibility <span className="text-red-500">*</span>
                                </label>
                                {loadingMembers ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        Loading team members…
                                    </div>
                                ) : (
                                    <MultiAssigneePicker
                                        members={members}
                                        selectedIds={assignees}
                                        onChange={setAssignees}
                                        visibility={visibility}
                                        onVisibilityChange={setVisibility}
                                    />
                                )}
                            </div>
                        )}

                        {/* Report Type (optional) */}
                        <div className="space-y-1.5">
                            <label htmlFor="reportType" className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                Report Type
                                <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
                            </label>
                            <input
                                id="reportType"
                                type="text"
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                placeholder="e.g. course_spec, program_spec…"
                                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* Task Details */}
                        <div className="space-y-1.5">
                            <label htmlFor="details" className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                Task Details
                            </label>
                            <textarea
                                id="details"
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder="Enter task details and description"
                                rows={3}
                                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
                    <Button type="button" variant="ghost" onClick={handleCancel} className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="create-task-form"
                        variant="default"
                        disabled={isLoading || assignees.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                    >
                        {isLoading ? 'Creating…' : 'Create Task'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateTask;
