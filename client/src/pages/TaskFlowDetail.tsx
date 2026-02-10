import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const TaskFlowDetail = () => {
    const teamMembers = [
        { name: 'Sarah Jenkins', time: '2 hours ago', message: 'I\'ve uploaded the initial wireframes for the dashboard. Let me know what you think about the sidebar layout.', avatar: 'SJ' },
        { name: 'Michael Ross', time: '1 hour ago', message: 'The sidebar looks great. I\'ll start working on the responsive menu behavior now.', avatar: 'MR' },
    ];

    const groupMembers = [
        { name: 'Alex Morgan', role: 'Lead Designer', avatar: 'AM', online: true },
        { name: 'Sarah Jenkins', role: 'Frontend Dev', avatar: 'SJ', online: true },
        { name: 'Michael Ross', role: 'Backend Dev', avatar: 'MR', online: false },
        { name: 'David Kim', role: 'Project Manager', avatar: 'DK', online: true },
    ];

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />

            <div className="flex-1 ml-[240px]">
                <Header title="TaskFlow" />

                <main className="pt-16 p-8">
                    <div className="grid grid-cols-3 gap-6">
                        {/* Main Content - Left Column (2/3) */}
                        <div className="col-span-2 space-y-6">
                            {/* Project Header */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <div className="text-xs font-medium text-primary uppercase tracking-wide mb-2">
                                            PROJECT A • SPRINT 4
                                        </div>
                                        <h1 className="text-2xl font-bold text-text-dark mb-2">
                                            Develop Responsive Dashboard Layout
                                        </h1>
                                        <p className="text-sm text-text-gray leading-relaxed">
                                            Implementation of the main dashboard grid system using Tailwind CSS. Needs to be mobile-friendly
                                            and support both light and dark modes according to the provided sketch designs.
                                        </p>
                                    </div>
                                    <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium whitespace-nowrap">
                                        In Progress
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-text-dark">Overall Progress</span>
                                        <span className="text-sm font-bold text-primary">68%</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full" style={{ width: '68%' }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Team Discussion */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <svg className="w-5 h-5 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <h2 className="text-base font-bold text-text-dark">Team Discussion</h2>
                                    <span className="ml-auto text-xs text-text-gray">4 Comments</span>
                                </div>

                                <div className="space-y-5">
                                    {teamMembers.map((member, index) => (
                                        <div key={index} className="flex gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                                                {member.avatar}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-semibold text-text-dark">{member.name}</span>
                                                    <span className="text-xs text-text-gray">{member.time}</span>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 text-sm text-text-dark">
                                                    {member.message}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 relative">
                                    <input
                                        type="text"
                                        placeholder="Type a comment for the group..."
                                        className="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-lg text-sm text-text-dark placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-blue-600">
                                        <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar */}
                        <div className="space-y-6">
                            {/* Task Resources */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <svg className="w-5 h-5 text-text-gray" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h3 className="text-base font-bold text-text-dark">Task Resources</h3>
                                </div>

                                {/* Image Preview */}
                                <div className="mb-4">
                                    <div className="w-full h-32 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center mb-3">
                                        <svg className="w-12 h-12 text-green-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <button className="w-full py-2.5 border border-gray-300 rounded-lg text-sm text-text-gray font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Upload Photo
                                    </button>
                                </div>

                                <button className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Upload Documents
                                </button>
                            </div>

                            {/* Group Members */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-base font-bold text-text-dark">Group Members</h3>
                                    <button className="text-sm text-primary font-medium hover:underline">
                                        Add New
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {groupMembers.map((member, index) => (
                                        <div key={index} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-sm font-medium">
                                                        {member.avatar}
                                                    </div>
                                                    {member.online && (
                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-white rounded-full"></div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-text-dark">{member.name}</div>
                                                    <div className="text-xs text-text-gray">{member.role}</div>
                                                </div>
                                            </div>
                                            <button className="text-text-gray hover:text-text-dark">
                                                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Task Details */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                                        <span className="text-sm font-medium text-text-gray">DUE DATE</span>
                                        <span className="text-sm font-semibold text-text-dark">Oct 24, 2023</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-text-gray">PRIORITY</span>
                                        <span className="px-2.5 py-1 bg-red-100 text-danger rounded text-xs font-semibold">! High</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TaskFlowDetail;
