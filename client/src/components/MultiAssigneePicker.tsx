/**
 * MultiAssigneePicker
 * -------------------
 * Reusable component for selecting multiple task assignees from a team.
 *
 * Props:
 *   members        — List of team members to display
 *   selectedIds    — Currently selected user IDs
 *   onChange       — Callback when selection changes
 *   visibility     — 'team' | 'private'
 *   onVisibilityChange — Callback when visibility toggle changes
 */

import { useState, useMemo } from 'react';

export interface TeamMember {
    id: string;
    name: string;
    email?: string;
    role?: string;
}

interface MultiAssigneePickerProps {
    members: TeamMember[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    visibility: 'team' | 'private';
    onVisibilityChange: (v: 'team' | 'private') => void;
}

export default function MultiAssigneePicker({
    members,
    selectedIds,
    onChange,
    visibility,
    onVisibilityChange,
}: MultiAssigneePickerProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(
        () =>
            members.filter(
                (m) =>
                    m.name.toLowerCase().includes(search.toLowerCase()) ||
                    (m.email ?? '').toLowerCase().includes(search.toLowerCase())
            ),
        [members, search]
    );

    const allSelected = filtered.length > 0 && filtered.every((m) => selectedIds.includes(m.id));
    const someSelected = filtered.some((m) => selectedIds.includes(m.id)) && !allSelected;

    const toggleAll = () => {
        if (allSelected) {
            // Deselect all filtered members
            onChange(selectedIds.filter((id) => !filtered.find((m) => m.id === id)));
        } else {
            // Add all filtered members
            const toAdd = filtered.map((m) => m.id).filter((id) => !selectedIds.includes(id));
            onChange([...selectedIds, ...toAdd]);
        }
    };

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((s) => s !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const avatarInitials = (name: string) =>
        name
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

    return (
        <div className="space-y-3">
            {/* ── Search ── */}
            <div className="relative">
                <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
                <input
                    type="text"
                    placeholder="Search members…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
            </div>

            {/* ── Member List ── */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {/* Select All row */}
                <label className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                    <input
                        id="select-all-assignees"
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                        }}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 select-none">
                        Select All Team Members
                    </span>
                    {selectedIds.length > 0 && (
                        <span className="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                            {selectedIds.length} selected
                        </span>
                    )}
                </label>

                {/* Member rows */}
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
                    {filtered.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-4">No members found</p>
                    ) : (
                        filtered.map((m) => {
                            const checked = selectedIds.includes(m.id);
                            return (
                                <label
                                    key={m.id}
                                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                                        checked
                                            ? 'bg-blue-50 dark:bg-blue-900/20'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggle(m.id)}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    {/* Avatar */}
                                    <div
                                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                            checked
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        {avatarInitials(m.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                            {m.name}
                                        </p>
                                        {m.email && (
                                            <p className="text-xs text-gray-400 truncate">{m.email}</p>
                                        )}
                                    </div>
                                    {m.role && (
                                        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 capitalize flex-shrink-0">
                                            {m.role}
                                        </span>
                                    )}
                                </label>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Visibility Toggle ── */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">
                    Task Visibility
                </p>
                <div className="grid grid-cols-2 gap-0 p-2 pt-1">
                    {(
                        [
                            {
                                value: 'team',
                                label: 'Visible to Team',
                                icon: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                                    </svg>
                                ),
                                desc: 'All team members can see this task',
                            },
                            {
                                value: 'private',
                                label: 'Only Assignees',
                                icon: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                ),
                                desc: 'Hidden from non-assigned members',
                            },
                        ] as const
                    ).map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onVisibilityChange(opt.value)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-lg text-center transition-all border-2 ${
                                visibility === opt.value
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'border-transparent bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                        >
                            {opt.icon}
                            <span className="text-xs font-semibold">{opt.label}</span>
                            <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
