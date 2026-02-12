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

    const menuItems = useMemo(() => {
        const base = [
            { icon: '📊', label: 'Dashboard', path: '/dashboard' },
            { icon: '📁', label: 'Projects', path: '/projects' },
            { icon: '✓', label: 'Tasks', path: '/tasks' },
            { icon: '📅', label: 'Calendar', path: '/calendar' },
            { icon: '👥', label: 'Team', path: '/team' },
            { icon: '📈', label: 'Reports', path: '/reports' },
            { icon: '⚙️', label: 'Settings', path: '/settings' }
        ];

        if (role === 'admin') {
            base.push({ icon: '🛠️', label: 'Configuration', path: '/configuration' });
        }

        if (role === 'sub_admin') {
            const withoutDashboard = base.filter((item) => item.path !== '/dashboard');
            const augmented = [
                { icon: '🛰️', label: 'Sub-Admin Portal', path: '/subadmin' },
                ...withoutDashboard
            ];
            augmented.splice(2, 0, { icon: '🧭', label: 'Task Master', path: '/taskmaster' });
            return augmented;
        }

        if (role === 'staff') {
            const hiddenPaths = new Set(['/projects', '/tasks', '/team', '/reports']);
            return base.filter((item) => !hiddenPaths.has(item.path));
        }

        return base;
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
            className="fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm transition-[width] duration-200"
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
                    <div className="w-10 h-10 bg-[#2563eb] rounded-2xl flex items-center justify-center text-white font-bold text-lg">
                        W
                    </div>
                    {isExpanded && (
                        <div>
                            <p className="text-sm font-semibold text-text-dark dark:text-gray-100">Workspace</p>
                            <p className="text-[11px] text-text-gray dark:text-gray-400 mt-1">Role · {roleLabel}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 flex flex-col space-y-1">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`
                                flex items-center rounded-lg transition-all duration-200
                                ${isExpanded ? 'gap-3 px-3 py-2.5 justify-start' : 'justify-center py-2.5'}
                                ${isActive
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400'
                                    : 'text-text-gray dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }
                            `}
                        >
                            <span className="text-lg" aria-hidden="true">{item.icon}</span>
                            {isExpanded ? (
                                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                    {item.label}
                                </span>
                            ) : (
                                <span className="sr-only">{item.label}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="px-3 pb-4">
                <button className={`w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm hover:bg-blue-600 transition-all flex items-center justify-center gap-2 ${isExpanded ? '' : 'px-0'}`}>
                    <span className="text-base" aria-hidden="true">+</span>
                    {isExpanded && <span>Invite Members</span>}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
