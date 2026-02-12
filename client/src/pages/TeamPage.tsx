import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

interface TeamMember {
    id: string;
    name: string;
    status: 'ONLINE' | 'OFFLINE' | 'AWAY';
    role: string;
    email: string;
    workload: number;
    workloadStatus: 'NEAR CAPACITY' | 'HEALTHY' | 'OVERLOADED' | 'AVAILABLE';
    avatar: string;
}

const TeamPage = () => {
    const stats = {
        totalMembers: 32,
        avgWorkload: 64,
        activeTasks: 148,
        fullCapacity: 5,
    };

    const members: TeamMember[] = [
        {
            id: '1',
            name: 'Alex Rivera',
            status: 'ONLINE',
            role: 'Senior Designer',
            email: 'alex@company.com',
            workload: 88,
            workloadStatus: 'NEAR CAPACITY',
            avatar: 'AR',
        },
        {
            id: '2',
            name: 'Jordan Smith',
            status: 'ONLINE',
            role: 'Full Stack Dev',
            email: 'jordan@company.com',
            workload: 40,
            workloadStatus: 'HEALTHY',
            avatar: 'JS',
        },
        {
            id: '3',
            name: 'Sarah Chen',
            status: 'ONLINE',
            role: 'Product Manager',
            email: 'sarah@company.com',
            workload: 96,
            workloadStatus: 'OVERLOADED',
            avatar: 'SC',
        },
        {
            id: '4',
            name: 'Taylor Swift',
            status: 'OFFLINE',
            role: 'QA Engineer',
            email: 'taylor@company.com',
            workload: 20,
            workloadStatus: 'AVAILABLE',
            avatar: 'TS',
        },
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ONLINE':
                return 'bg-success';
            case 'AWAY':
                return 'bg-warning';
            case 'OFFLINE':
                return 'bg-gray-400';
            default:
                return 'bg-gray-400';
        }
    };

    const getWorkloadColor = (status: string) => {
        switch (status) {
            case 'OVERLOADED':
                return 'bg-danger';
            case 'NEAR CAPACITY':
                return 'bg-warning';
            case 'HEALTHY':
                return 'bg-blue-500';
            case 'AVAILABLE':
                return 'bg-success';
            default:
                return 'bg-gray-300';
        }
    };

    const getWorkloadTextColor = (status: string) => {
        switch (status) {
            case 'OVERLOADED':
                return 'text-danger';
            case 'NEAR CAPACITY':
                return 'text-warning';
            case 'HEALTHY':
                return 'text-blue-600';
            case 'AVAILABLE':
                return 'text-success';
            default:
                return 'text-text-gray';
        }
    };

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />

            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Team" />

                <main className="page-main p-8">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-text-dark dark:text-white mb-1">Team Management</h1>
                            <p className="text-sm text-text-gray dark:text-gray-400">Review your team's current availability and manage permissions.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="h-10 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Manage Roles
                            </button>
                            <button className="h-10 px-4 bg-primary text-white font-medium text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Invite Member
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-4 gap-5 mb-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase">Total Members</span>
                            </div>
                            <div className="text-3xl font-bold text-text-dark dark:text-white">{stats.totalMembers}</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase">Avg. Workload</span>
                            </div>
                            <div className="text-3xl font-bold text-text-dark dark:text-white">{stats.avgWorkload}%</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                <span className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase">Active Tasks</span>
                            </div>
                            <div className="text-3xl font-bold text-text-dark dark:text-white">{stats.activeTasks}</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase">Full Capacity</span>
                            </div>
                            <div className="text-3xl font-bold text-text-dark dark:text-white">{stats.fullCapacity}</div>
                        </div>
                    </div>

                    {/* Members Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-text-gray dark:text-gray-300 uppercase transition-colors">
                            <div className="col-span-3">Member</div>
                            <div className="col-span-2">Role</div>
                            <div className="col-span-3">Email</div>
                            <div className="col-span-3">Workload Status</div>
                            <div className="col-span-1">Actions</div>
                        </div>

                        {/* Table Rows */}
                        <div>
                            {members.map((member) => (
                                <div
                                    key={member.id}
                                    className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                                >
                                    <div className="col-span-3 flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm">
                                                {member.avatar}
                                            </div>
                                            <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(member.status)} rounded-full border-2 border-white dark:border-gray-800`}></div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-text-dark dark:text-gray-100">{member.name}</div>
                                            <div className={`text-xs ${member.status === 'ONLINE' ? 'text-success' : 'text-text-gray dark:text-gray-400'}`}>
                                                ● {member.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        <span className="text-sm text-text-dark dark:text-gray-200">{member.role}</span>
                                    </div>

                                    <div className="col-span-3 flex items-center">
                                        <span className="text-sm text-text-gray dark:text-gray-400">{member.email}</span>
                                    </div>

                                    <div className="col-span-3 flex items-center">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-xs font-bold uppercase ${getWorkloadTextColor(member.workloadStatus)}`}>
                                                    {member.workloadStatus}
                                                </span>
                                                <span className="text-xs font-semibold text-text-dark dark:text-gray-100">{member.workload}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${getWorkloadColor(member.workloadStatus)} transition-all`}
                                                    style={{ width: `${member.workload}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-1 flex items-center gap-2">
                                        <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                            <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                            <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer Pagination */}
                        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-text-gray dark:text-gray-300 transition-colors">
                            <span>Showing 1-4 of 32 members</span>
                            <div className="flex items-center gap-1">
                                <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                                    <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded font-medium text-sm">
                                    1
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                                    2
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                                    3
                                </button>
                                <span className="px-2">...</span>
                                <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                                    8
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                                    <svg className="w-4 h-4 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TeamPage;
