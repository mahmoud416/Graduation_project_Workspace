import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

// Mock data for dropdowns
const PRIORITIES = ['Low', 'Medium', 'High'];

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

interface CreateTaskProps {
    onClose?: () => void;
    onSuccess?: () => void;
}

const CreateTask = ({ onClose, onSuccess }: CreateTaskProps) => {
    const navigate = useNavigate();
    const [taskName, setTaskName] = useState('');
    const [priority, setPriority] = useState('');
    const [team, setTeam] = useState('');
    const [details, setDetails] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [teamsList, setTeamsList] = useState<any[]>([]);

    useEffect(() => {
        const fetchTeams = async () => {
            const userId = localStorage.getItem('userId');
            if (!userId) return;
            try {
                const res = await fetch(`${API_BASE}/teams`, {
                    headers: { 'X-User-Id': userId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
                });
                if (res.ok) {
                    const data = await res.json();
                    setTeamsList(data);
                }
            } catch (error) {
                console.error('Failed to fetch teams', error);
            }
        };
        fetchTeams();
    }, []);

    const [isCreatingTeam, setIsCreatingTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');

    const handleCreateTeam = async () => {
        const userId = localStorage.getItem('userId');
        if (!userId || !newTeamName.trim()) return;

        try {
            const res = await fetch(`${API_BASE}/teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
                },
                body: JSON.stringify({ name: newTeamName })
            });

            if (res.ok) {
                const newTeam = await res.json();
                setTeamsList([...teamsList, newTeam]);
                setTeam(newTeam.id || newTeam._id); // Select the new team automatically
                setIsCreatingTeam(false);
                setNewTeamName('');
            } else {
                alert('Failed to create team');
            }
        } catch (error) {
            console.error('Failed to create team', error);
            alert('Error creating team');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const userId = localStorage.getItem('userId');
        if (!userId) {
            alert('You must be logged in to create a task');
            setIsLoading(false);
            return;
        }

        try {
            const payload = {
                title: taskName,
                description: details,
                team_id: team,
                assigned_to: userId, // Assign to self by default
                priority: priority.toLowerCase(),
                status: 'todo'
            };

            const res = await fetch(`${API_BASE}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(err || 'Failed to create task');
            }

            // Success
            if (onSuccess) {
                onSuccess();
            }
            if (onClose) {
                onClose();
            } else {
                navigate(-1);
            }
        } catch (error) {
            console.error('Failed to create task:', error);
            alert('Failed to create task.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        if (onClose) {
            onClose();
        } else {
            navigate(-1); // Go back to previous page
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            {/* Modal Container */}
            <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 pb-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Task</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add a new task to your workspace</p>
                </div>

                {/* Body / Form */}
                <div className="p-6 pt-4 overflow-y-auto">
                    <form id="create-task-form" onSubmit={handleSubmit} className="space-y-5">

                        {/* Task Name */}
                        <div className="space-y-1.5">
                            <label htmlFor="taskName" className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                Task Name
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
                                Priority
                            </label>
                            <div className="relative">
                                <select
                                    id="priority"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer text-gray-700 dark:text-gray-300"
                                    required
                                >
                                    <option value="" disabled>Select priority</option>
                                    {PRIORITIES.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        {/* Responsible Team */}
                        <div className="space-y-1.5">
                            <label htmlFor="team" className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                                Responsible Team
                            </label>

                            {!isCreatingTeam ? (
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            id="team"
                                            value={team}
                                            onChange={(e) => setTeam(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer text-gray-700 dark:text-gray-300"
                                            required
                                        >
                                            <option value="" disabled>Select team</option>
                                            {teamsList.map((t) => (
                                                <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsCreatingTeam(true)}
                                        className="whitespace-nowrap px-3"
                                    >
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
                                        className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleCreateTeam}
                                        disabled={!newTeamName.trim()}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setIsCreatingTeam(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            )}
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
                                rows={4}
                                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 pt-2 flex items-center justify-end gap-3 rounded-b-xl border-t border-transparent">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancel}
                        className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="create-task-form"
                        variant="default"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                    >
                        {isLoading ? 'Creating...' : 'Create Task'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateTask;
