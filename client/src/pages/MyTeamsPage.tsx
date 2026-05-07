import { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'X-User-Id': localStorage.getItem('userId') ?? '',
    Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
});

// ── types ──────────────────────────────────────────────────────────────────

interface TeamMember {
    user_id: string;
    name: string;
    email: string;
    role: string;          // membership role
    system_role: string;   // global system role
    status: string;
    last_seen?: string;
    is_me: boolean;
}

interface TeamGroup {
    team_id: string;
    team_name: string;
    description: string;
    members: TeamMember[];
}

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Derive a simple online/offline indicator from the last_seen timestamp.
 * A user is considered "online" if their last_seen is within the past 5 minutes.
 */
const isOnline = (lastSeen?: string): boolean => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
};

const roleBadge = (role: string) => {
    const map: Record<string, string> = {
        admin:       'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        sub_manager: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
        staff:       'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300',
        member:      'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300',
    };
    return map[role] ?? map.member;
};

const roleLabel = (role: string) =>
    role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ── component ──────────────────────────────────────────────────────────────

export default function MyTeamsPage() {
    const [groups, setGroups]   = useState<TeamGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);
    const [search, setSearch]   = useState('');
    const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());

    const fetchMembers = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${API_BASE}/my-teams/members`, { headers: authHeaders() });
            if (!res.ok) throw new Error(await res.text());
            const data: TeamGroup[] = await res.json();
            setGroups(data);
            // Expand all teams by default
            setOpenTeams(new Set(data.map(g => g.team_id)));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    const toggleTeam = (teamId: string) =>
        setOpenTeams(prev => {
            const next = new Set(prev);
            next.has(teamId) ? next.delete(teamId) : next.add(teamId);
            return next;
        });

    // Apply search filter across all groups
    const filtered = groups
        .map(g => ({
            ...g,
            members: g.members.filter(
                m =>
                    m.name.toLowerCase().includes(search.toLowerCase()) ||
                    m.email.toLowerCase().includes(search.toLowerCase()),
            ),
        }))
        .filter(g => g.members.length > 0 || search === '');

    const totalMembers = groups.reduce((acc, g) => acc + g.members.length, 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <Header title="My Teams" />

            <main
                className="overflow-y-auto p-6"
                style={{ marginLeft: 'var(--sidebar-width)', paddingTop: 'calc(4rem + 1.5rem)' }}
            >
                {/* Summary bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-5 py-3 text-center">
                            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{groups.length}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Teams</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-5 py-3 text-center">
                            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalMembers}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Members</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search members…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* States */}
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

                {!loading && !error && groups.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-500">
                        <svg className="w-14 h-14 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm font-medium">You haven't been added to any team yet.</p>
                        <p className="text-xs mt-1">Ask an admin to add you to a team.</p>
                    </div>
                )}

                {/* Team groups */}
                {!loading && filtered.map(group => (
                    <div
                        key={group.team_id}
                        className="mb-5 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
                    >
                        {/* Team header — click to collapse/expand */}
                        <button
                            onClick={() => toggleTeam(group.team_id)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Team icon */}
                                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div className="min-w-0 text-left">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                                        {group.team_name}
                                    </p>
                                    {group.description && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                            {group.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                                </span>
                                {/* Chevron */}
                                <svg
                                    className={`w-4 h-4 text-gray-400 transition-transform ${openTeams.has(group.team_id) ? 'rotate-180' : ''}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>

                        {/* Members list */}
                        {openTeams.has(group.team_id) && (
                            <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50">
                                {group.members.map(member => (
                                    <div
                                        key={member.user_id}
                                        className={`flex items-center gap-4 px-5 py-3 ${
                                            member.is_me ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/20'
                                        } transition-colors`}
                                    >
                                        {/* Avatar with online dot */}
                                        <div className="relative flex-shrink-0">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold select-none">
                                                {member.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span
                                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                                                    isOnline(member.last_seen)
                                                        ? 'bg-emerald-500'
                                                        : 'bg-gray-300 dark:bg-gray-600'
                                                }`}
                                                title={isOnline(member.last_seen) ? 'Online' : 'Offline'}
                                            />
                                        </div>

                                        {/* Name + email */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                                                    {member.name}
                                                </p>
                                                {member.is_me && (
                                                    <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">(you)</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{member.email}</p>
                                        </div>

                                        {/* Team role badge */}
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${roleBadge(member.role)}`}>
                                            {roleLabel(member.role)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* No search results */}
                {!loading && !error && groups.length > 0 && filtered.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-12">
                        No members match "<span className="font-medium">{search}</span>"
                    </p>
                )}
            </main>
        </div>
    );
}
