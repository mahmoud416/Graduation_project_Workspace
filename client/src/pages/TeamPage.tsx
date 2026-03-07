import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

interface TeamMember {
    _id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    phone?: string | null;
    created_at?: string | null;
}

const ROLES_ORDER: Record<string, number> = { admin: 0, sub_admin: 1, staff: 2 };

const formatRole = (role: string) =>
    role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const getInitials = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .join('');

const AVATAR_GRADIENTS = [
    'from-purple-400 to-pink-400',
    'from-blue-400 to-cyan-400',
    'from-green-400 to-teal-400',
    'from-orange-400 to-red-400',
    'from-indigo-400 to-violet-400',
    'from-yellow-400 to-orange-400',
];

const getAvatarGradient = (id: string) => {
    const idx = id.charCodeAt(id.length - 1) % AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[idx];
};

const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    sub_admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    staff: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const PAGE_SIZE = 10;

const TeamPage = () => {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE}/users`, {
                    headers: { Authorization: `Bearer ${token ?? ''}` },
                });
                if (!res.ok) throw new Error(`Failed to load team members (${res.status})`);
                const data: TeamMember[] = await res.json();
                data.sort((a, b) => (ROLES_ORDER[a.role] ?? 9) - (ROLES_ORDER[b.role] ?? 9));
                setMembers(data);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to load team members');
            } finally {
                setIsLoading(false);
            }
        };
        void fetchUsers();
    }, []);

    const filtered = members.filter((m) => {
        const matchesSearch =
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || m.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginatedMembers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const stats = {
        total: members.length,
        admins: members.filter((m) => m.role === 'admin').length,
        subAdmins: members.filter((m) => m.role === 'sub_admin').length,
        staff: members.filter((m) => m.role === 'staff').length,
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
                            <p className="text-sm text-text-gray dark:text-gray-400">
                                Review your team's directory and manage member information.
                            </p>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-4 gap-5 mb-6">
                        {[
                            {
                                label: 'Total Members',
                                value: stats.total,
                                icon: (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                ),
                            },
                            {
                                label: 'Admins',
                                value: stats.admins,
                                icon: (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                ),
                            },
                            {
                                label: 'Sub-Admins',
                                value: stats.subAdmins,
                                icon: (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                ),
                            },
                            {
                                label: 'Staff Members',
                                value: stats.staff,
                                icon: (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                ),
                            },
                        ].map((card) => (
                            <div
                                key={card.label}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-text-gray dark:text-gray-400">{card.icon}</span>
                                    <span className="text-xs font-medium text-text-gray dark:text-gray-400 uppercase">
                                        {card.label}
                                    </span>
                                </div>
                                <div className="text-3xl font-bold text-text-dark dark:text-white">
                                    {isLoading ? '—' : card.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative flex-1 max-w-xs">
                            <svg
                                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-gray dark:text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by name or email…"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                                className="w-full h-9 pl-9 pr-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 placeholder:text-text-gray dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                        </div>

                        <select
                            value={roleFilter}
                            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                            className="h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-text-dark dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                            <option value="all">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="sub_admin">Sub Admin</option>
                            <option value="staff">Staff</option>
                        </select>

                        <span className="ml-auto text-sm text-text-gray dark:text-gray-400">
                            {filtered.length} member{filtered.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Members Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">
                            <div className="col-span-4">Member</div>
                            <div className="col-span-3">Email</div>
                            <div className="col-span-2">Role</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-1">Phone</div>
                        </div>

                        {/* Loading / Error / Empty States */}
                        {isLoading && (
                            <div className="px-6 py-12 text-center text-sm text-text-gray dark:text-gray-400">
                                Loading team members…
                            </div>
                        )}

                        {!isLoading && error && (
                            <div className="px-6 py-12 text-center text-sm text-danger">
                                {error}
                            </div>
                        )}

                        {!isLoading && !error && filtered.length === 0 && (
                            <div className="px-6 py-12 text-center text-sm text-text-gray dark:text-gray-400">
                                No members match your search.
                            </div>
                        )}

                        {/* Table Rows */}
                        {!isLoading && !error && paginatedMembers.map((member) => (
                            <div
                                key={member._id}
                                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-0"
                            >
                                {/* Member */}
                                <div className="col-span-4 flex items-center gap-3 min-w-0">
                                    <div
                                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(member._id)} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}
                                    >
                                        {getInitials(member.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-text-dark dark:text-gray-100 truncate">
                                            {member.name}
                                        </div>
                                        <div className="text-xs text-text-gray dark:text-gray-400 truncate">
                                            ID: {member._id.slice(-6)}
                                        </div>
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="col-span-3 flex items-center min-w-0">
                                    <span className="text-sm text-text-gray dark:text-gray-400 truncate">{member.email}</span>
                                </div>

                                {/* Role */}
                                <div className="col-span-2 flex items-center">
                                    <span
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE[member.role] ?? ROLE_BADGE.staff}`}
                                    >
                                        {formatRole(member.role)}
                                    </span>
                                </div>

                                {/* Status */}
                                <div className="col-span-2 flex items-center gap-2">
                                    <div
                                        className={`w-2 h-2 rounded-full flex-shrink-0 ${member.is_active ? 'bg-success' : 'bg-gray-400'}`}
                                    />
                                    <span
                                        className={`text-xs font-medium ${member.is_active ? 'text-success' : 'text-text-gray dark:text-gray-400'}`}
                                    >
                                        {member.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                {/* Phone */}
                                <div className="col-span-1 flex items-center">
                                    <span className="text-xs text-text-gray dark:text-gray-400 truncate">
                                        {member.phone ?? '—'}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Pagination Footer */}
                        {!isLoading && !error && filtered.length > 0 && (
                            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-text-gray dark:text-gray-300 transition-colors">
                                <span>
                                    Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} members
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-40"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, idx) =>
                                            p === 'ellipsis' ? (
                                                <span key={`ellipsis-${idx}`} className="px-1 text-text-gray dark:text-gray-400">…</span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => setPage(p as number)}
                                                    className={`w-8 h-8 flex items-center justify-center rounded font-medium text-sm transition-colors ${
                                                        currentPage === p
                                                            ? 'bg-primary text-white'
                                                            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        )}

                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-40"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TeamPage;
