import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const TaskMasterDashboard = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [messageInput, setMessageInput] = useState('');

    // Mock discussion data
    const [discussion, setDiscussion] = useState([
        {
            id: '1',
            user: { name: 'Marcus Lee', avatar: 'ML' },
            message: 'The initial designs are ready for review. Please check the uploaded files.',
            timestamp: '2h ago',
            highlighted: false,
        },
        {
            id: '2',
            user: { name: 'Alex Rivera', avatar: 'AR' },
            message: 'Thanks Marcus! I\'ll take a look this afternoon.',
            timestamp: '1h ago',
            highlighted: true,
        },
    ]);

    // Mock attachments data
    const [attachments, setAttachments] = useState([
        { id: '1', name: 'design_specs_v2.pdf' },
    ]);

    const activeTasks = [
        {
            id: '1',
            category: 'DESIGN',
            title: 'User Interface Refactor',
            description: 'Update all legacy components to support...',
            assignees: [{ name: 'Alex', avatar: 'A' }],
            dueDate: 'Due in 2d',
            status: 'active',
            highlighted: false,
        },
        {
            id: '2',
            category: 'DEV',
            title: 'API Integration',
            description: 'Connect the dashboard widgets to the real-time...',
            assignees: [{ name: 'Mike', avatar: 'M' }],
            dueDate: 'Due Tomorrow',
            status: 'active',
            highlighted: true,
        },
        {
            id: '3',
            category: 'QA',
            title: 'Final Review',
            description: 'Perform end-to-end testing on the task...',
            assignees: [{ name: 'Sarah', avatar: 'S' }, { name: 'John', avatar: 'J' }],
            dueDate: 'Completed',
            status: 'completed',
            highlighted: false,
        },
    ];

    const assignees = [
        { name: 'Jordan Smith', avatar: 'JS' },
        { name: 'Emma Wilson', avatar: 'EW' },
        { name: 'Marcus Lee', avatar: 'ML' },
    ];

    const handleSendMessage = () => {
        if (!messageInput.trim()) return;

        const newMessage = {
            id: Date.now().toString(),
            user: { name: 'Alex Rivera', avatar: 'AR' }, // Current user
            message: messageInput,
            timestamp: 'Just now',
            highlighted: true,
        };

        setDiscussion([...discussion, newMessage]);
        setMessageInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setAttachments([...attachments, {
                id: Date.now().toString(),
                name: file.name
            }]);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-gray-950">
            <Sidebar />

            <div className="flex-1 ml-[240px]">
                <Header title="TaskMaster" />

                <main className="pt-20 p-8 space-y-8">
                    {/* Welcome Section */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Welcome back, Alex</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Project Manager</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 dark:text-gray-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            </button>
                            <div className="w-10 h-10 rounded-full bg-[#d0c9ae] flex items-center justify-center text-white font-medium text-lg overflow-hidden relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400"></div>
                                <span className="relative z-10 text-sm">A</span>
                            </div>
                        </div>
                    </div>

                    {/* Active Tasks Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Tasks</h2>
                            </div>
                            <a href="#" className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">View All</a>
                        </div>

                        <div className="grid grid-cols-4 gap-6">
                            {activeTasks.map((task) => (
                                <div
                                    key={task.id}
                                    onClick={() => navigate('/taskflow')}
                                    className={`bg-white dark:bg-gray-800 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-blue-500 hover:border-transparent flex flex-col justify-between h-[240px] relative overflow-hidden group ${task.highlighted
                                        ? 'shadow-lg bg-blue-50/50 dark:bg-blue-900/10'
                                        : 'border border-gray-100 dark:border-gray-700'
                                        }`}
                                >


                                    <div>
                                        <div className="flex items-center justify-between mb-4 pl-2">
                                            <span className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase ${task.category === 'DESIGN' ? 'bg-indigo-50 text-indigo-600' :
                                                task.category === 'DEV' ? 'bg-purple-50 text-purple-600' :
                                                    'bg-green-50 text-green-600'
                                                }`}>
                                                {task.category}
                                            </span>
                                            <button className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
                                            </button>
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 leading-tight pl-2 pr-2">{task.title}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed pl-2 pr-2">{task.description}</p>
                                    </div>

                                    <div className="flex items-center justify-between mt-4 pl-2 pr-2">
                                        <div className="flex -space-x-2">
                                            {task.assignees.map((assignee, idx) => (
                                                <div key={idx} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                                    {assignee.avatar}
                                                </div>
                                            ))}
                                            {task.id === '1' && (
                                                <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-900 dark:bg-gray-600 flex items-center justify-center text-[10px] font-bold text-white relative z-10">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-semibold ${task.status === 'completed' ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                            {task.dueDate}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* Create Task Card */}
                            <button
                                onClick={() => navigate('/create-task')}
                                className="h-[240px] rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50/10 dark:hover:bg-blue-900/10 transition-all flex flex-col items-center justify-center gap-3 group bg-transparent"
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                </div>
                                <span className="text-sm font-medium text-gray-400 dark:text-gray-500 group-hover:text-blue-500">Create Task</span>
                            </button>
                        </div>
                    </div>

                    {/* Bottom Section: Progress & Details */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* Overall Progress - Left Column */}
                        <div className="col-span-4 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 h-fit">
                            <div className="flex items-center gap-2 mb-8">
                                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Overall Progress</h2>
                            </div>

                            <div className="flex flex-col items-center mb-10">
                                <div className="text-6xl font-bold text-gray-900 dark:text-white mb-2">75%</div>
                                <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Done</div>
                            </div>

                            <div className="space-y-8 px-2">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">In Progress Tasks</span>
                                        <span className="text-sm font-bold text-blue-600">60%</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 rounded-full" style={{ width: '60%' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Internal Audits</span>
                                        <span className="text-sm font-bold text-green-500">100%</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Task Detail & Chat - Middle Column */}
                        <div className="col-span-5 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-blue-200 shadow-xl">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Task Detail View</h2>
                                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Project: Marketing Campaign Q4</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    </button>
                                    <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-between min-h-0">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Team Discussion</h3>

                                    <div className="space-y-4 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
                                        {discussion.map((msg) => (
                                            <div key={msg.id} className="flex gap-3 items-start">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-indigo-600">
                                                    {msg.user.avatar}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{msg.user.name}</span>
                                                        <span className="text-xs text-gray-400">{msg.timestamp}</span>
                                                    </div>
                                                    <div className={`p-3 rounded-r-xl rounded-bl-xl text-sm leading-relaxed ${msg.highlighted
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                        }`}>
                                                        {msg.message}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Chat Input */}
                                <div className="relative mt-4">
                                    <input
                                        type="text"
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Any comments for the team?"
                                        className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl py-3 pl-4 pr-10 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 placeholder-gray-400 dark:placeholder-gray-500"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Info & Attachments - Right Column */}
                        <div className="col-span-3 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-full">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Assignees</h3>
                                <div className="space-y-4">
                                    {assignees.map((a, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                                {a.avatar}
                                            </div>
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{a.name}</span>
                                        </div>
                                    ))}
                                    <button className="flex items-center gap-2 text-sm font-medium text-blue-500 hover:text-blue-600 mt-2">
                                        <div className="w-8 h-8 rounded-full border border-dashed border-blue-300 flex items-center justify-center">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                        </div>
                                        Invite New
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6">
                                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Attachments</h3>
                                <div className="flex flex-wrap gap-3">
                                    {attachments.map(att => (
                                        <div key={att.id} className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#d4bd7e] to-[#c7b072] flex items-center justify-center text-white shadow-sm relative group">
                                            <svg className="w-8 h-8 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] p-1 text-center font-medium">
                                                {att.name.length > 8 ? att.name.substring(0, 8) + '...' : att.name}
                                            </div>
                                        </div>
                                    ))}
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                    <button
                                        onClick={handleUploadClick}
                                        className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50/10 dark:hover:bg-blue-900/10 transition-all group"
                                    >
                                        <svg className="w-6 h-6 text-gray-300 dark:text-gray-600 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 group-hover:text-blue-500">Upload</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TaskMasterDashboard;
