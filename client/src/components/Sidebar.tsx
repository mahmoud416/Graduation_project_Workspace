import { Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import type { FocusEvent } from 'react';

const COLLAPSED_WIDTH = 88;
const EXPANDED_WIDTH = 240;

const formatRoleLabel = (value: string | null) => {
    if (!value) return 'Member';
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const Icons: Record<string, JSX.Element> = {
    dashboard: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
    ),
    projects: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
    ),
    boards: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
    ),
    tasks: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
    ),
    calendar: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    ),
    team: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
    ),
    reports: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
    ),
    settings: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    configuration: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
    ),
    portal: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
    ),
    taskmaster: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
    ),
};

interface MenuItem {
    iconKey: string;
    label: string;
    path: string;
}

const Sidebar = () => {
    const location = useLocation();
    const [role, setRole] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setRole(localStorage.getItem('role'));

        const handleStorage = () => setRole(localStorage.getItem('role'));
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const sidebarWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    }, [sidebarWidth]);

    const menuItems = useMemo((): MenuItem[] => {
        if (role === 'admin') {
            return [
                { iconKey: 'dashboard', label: 'Dashboard', path: '/dashboard' },
                { iconKey: 'projects', label: 'Projects', path: '/projects' },
                { iconKey: 'calendar', label: 'Calendar', path: '/calendar' },
                { iconKey: 'team', label: 'Team', path: '/team' },
                { iconKey: 'reports', label: 'Reports', path: '/reports' },
                { iconKey: 'settings', label: 'Settings', path: '/settings' },
                { iconKey: 'configuration', label: 'Configuration', path: '/configuration' },
            ];
        }

        if (role === 'sub_admin') {
            return [
                { iconKey: 'portal', label: 'Dashboard', path: '/subadmin' },
                { iconKey: 'projects', label: 'Projects', path: '/projects' },
                { iconKey: 'taskmaster', label: 'Task Master', path: '/taskmaster' },
                { iconKey: 'calendar', label: 'Calendar', path: '/calendar' },
                { iconKey: 'team', label: 'Team', path: '/team' },
                { iconKey: 'reports', label: 'Reports', path: '/reports' },
                { iconKey: 'settings', label: 'Settings', path: '/settings' },
            ];
        }

        if (role === 'staff') {
            return [
                { iconKey: 'dashboard', label: 'Dashboard',  path: '/dashboard' },
                { iconKey: 'projects',  label: 'My Projects', path: '/my-projects' },
                { iconKey: 'calendar',  label: 'Calendar',   path: '/calendar'  },
                { iconKey: 'settings',  label: 'Settings',   path: '/settings'  },
            ];
        }

        return [
            { iconKey: 'dashboard', label: 'Dashboard', path: '/dashboard' },
            { iconKey: 'projects', label: 'Projects', path: '/projects' },
            { iconKey: 'tasks', label: 'Tasks', path: '/tasks' },
            { iconKey: 'calendar', label: 'Calendar', path: '/calendar' },
            { iconKey: 'team', label: 'Team', path: '/team' },
            { iconKey: 'reports', label: 'Reports', path: '/reports' },
            { iconKey: 'settings', label: 'Settings', path: '/settings' },
        ];
    }, [role]);

    const roleLabel = formatRoleLabel(role);

    const handleFocus = () => setIsExpanded(true);
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
            setIsExpanded(false);
        }
    };

    return (
        <div
            className="fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm transition-[width] duration-200 z-40"
            style={{ width: `${sidebarWidth}px` }}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-label="Primary navigation"
            aria-expanded={isExpanded}
        >
            {/* Workspace Brand */}
            <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-800">
                <div className={`flex ${isExpanded ? 'items-center gap-3' : 'justify-center'}`}>
                    <div className="w-10 h-10 bg-[#2563eb] rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        W
                    </div>
                    {isExpanded && (
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-dark dark:text-gray-100 truncate">Workspace</p>
                            <p className="text-[11px] text-text-gray dark:text-gray-400 mt-0.5 truncate">Role · {roleLabel}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 flex flex-col space-y-0.5 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            title={isExpanded ? undefined : item.label}
                            className={`
                                flex items-center rounded-lg transition-all duration-150
                                ${isExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5 px-2'}
                                ${isActive
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-primary dark:text-blue-400'
                                    : 'text-text-gray dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-text-dark dark:hover:text-gray-200'
                                }
                            `}
                        >
                            {Icons[item.iconKey] ?? null}
                            {isExpanded ? (
                                <span className={`text-sm truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                    {item.label}
                                </span>
                            ) : (
                                <span className="sr-only">{item.label}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
};

export default Sidebar;
