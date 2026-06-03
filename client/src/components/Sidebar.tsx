import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, ReactElement } from 'react';
import { useTheme } from '../contexts/useTheme';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH  = 230;

const formatRoleLabel = (value: string | null) => {
    if (!value) return 'Member';
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/* ─── Nav icons ─────────────────────────────────────────────────────────── */
const Ico: Record<string, ReactElement> = {
    dashboard: <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    projects:  <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>,
    boards:    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
    tasks:     <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    calendar:  <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    team:      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    reports:   <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    settings:  <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    configuration: <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
    portal:    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
    taskmaster:<svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    quality:   <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m4 2a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    insights:  <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M4 13l4-4 4 4 6-6" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 9V5m8 6V5" /></svg>,
    logout:    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    accounts:     <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    credentials:  <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
    session:      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

interface MenuItem { iconKey: string; label: string; path: string; }

/* ─── Orbit wordmark ─────────────────────────────────────────────────────── */
function OrbitMark({ expanded, isDark }: { expanded: boolean; isDark: boolean }) {
    const textColor = isDark ? 'white' : '#0f172a';

    if (!expanded) {
        return (
            <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(29,110,245,.15)',
                border: '1px solid rgba(29,110,245,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Space Grotesk","Inter",sans-serif',
                fontWeight: 900, fontSize: 18, color: textColor,
                position: 'relative',
                boxShadow: '0 0 16px rgba(29,110,245,.18)',
                flexShrink: 0,
            }}>
                O
                <span style={{
                    position: 'absolute', top: 5, right: 6,
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#1d6ef5',
                    boxShadow: '0 0 6px rgba(29,110,245,.9)',
                    display: 'block',
                }} />
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            fontFamily: '"Space Grotesk","Inter",sans-serif',
            fontWeight: 800, fontSize: 20, color: textColor,
            letterSpacing: '-0.01em', lineHeight: 1,
        }}>
            Orb
            <span style={{ position: 'relative', display: 'inline-block' }}>
                i
                <span style={{
                    position: 'absolute', top: 1, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#1d6ef5',
                    boxShadow: '0 0 8px rgba(29,110,245,.9), 0 0 14px rgba(29,110,245,.4)',
                    display: 'block',
                    animation: 'sbDotGlow 2.4s ease-in-out infinite',
                }} />
            </span>
            t
        </div>
    );
}

/* ─── Sidebar component ──────────────────────────────────────────────────── */
const Sidebar = () => {
    const location  = useLocation();
    const navigate  = useNavigate();
    const { isDark, setTheme } = useTheme();
    const [role,       setRole]       = useState<string | null>(null);
    const [userName,   setUserName]   = useState<string>('');
    const [userAvatar, setUserAvatar] = useState<string>('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [menuOpen,   setMenuOpen]   = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const menuRef  = useRef<HTMLDivElement>(null);

    const syncUser = () => {
        setRole(localStorage.getItem('role'));
        setUserName(
            localStorage.getItem('fullName') ??
            localStorage.getItem('userName') ??
            localStorage.getItem('name') ?? ''
        );
        setUserAvatar(localStorage.getItem('userAvatar') ?? '');
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        syncUser();
        window.addEventListener('storage', syncUser);
        window.addEventListener('workspace:user-update', syncUser);
        return () => {
            window.removeEventListener('storage', syncUser);
            window.removeEventListener('workspace:user-update', syncUser);
        };
    }, []);

    /* Close account menu when clicking outside */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
                panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const sidebarWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    }, [sidebarWidth]);

    const menuItems = useMemo((): MenuItem[] => {
        if (role === 'admin') return [
            { iconKey: 'dashboard',     label: 'Dashboard',       path: '/dashboard' },
            { iconKey: 'projects',      label: 'Workspace',       path: '/projects' },
            { iconKey: 'calendar',      label: 'Calendar',        path: '/calendar' },
            { iconKey: 'team',          label: 'Team',            path: '/team' },
            { iconKey: 'reports',       label: 'Reports',         path: '/reports' },
            { iconKey: 'quality',       label: 'Quality Control', path: '/quality-control' },
            { iconKey: 'settings',      label: 'Settings',        path: '/settings' },
            { iconKey: 'accounts',      label: 'User Management', path: '/configuration' },
        ];
        if (role === 'quality_manager' || role === 'quality_control') return [
            { iconKey: 'insights', label: 'Quality Insights', path: '/quality-insights' },
            { iconKey: 'quality',  label: 'Reports',          path: '/quality-control' },
            { iconKey: 'settings', label: 'Settings',         path: '/settings' },
        ];
        if (role === 'sub_admin') return [
            { iconKey: 'portal',   label: 'Dashboard',  path: '/subadmin' },
            { iconKey: 'projects', label: 'Workspace',  path: '/projects' },
            { iconKey: 'calendar', label: 'Calendar',   path: '/calendar' },
            { iconKey: 'team',     label: 'Team',       path: '/team' },
            { iconKey: 'reports',  label: 'Reports',    path: '/reports' },
            { iconKey: 'settings', label: 'Settings',   path: '/settings' },
        ];
        if (role === 'staff') return [
            { iconKey: 'dashboard', label: 'Dashboard',      path: '/dashboard' },
            { iconKey: 'projects',  label: 'My Projects',    path: '/my-projects' },
            { iconKey: 'portal',    label: 'Public Channel', path: '/taskflow?projectId=public-group' },
            { iconKey: 'calendar',  label: 'Calendar',       path: '/calendar' },
            { iconKey: 'settings',  label: 'Settings',       path: '/settings' },
        ];
        if (role === 'founder') return [
            { iconKey: 'dashboard', label: 'Command Center', path: '/founder' },
            { iconKey: 'accounts',  label: 'IT Accounts',    path: '/founder/accounts' },
            { iconKey: 'settings',  label: 'Settings',       path: '/settings' },
        ];
        if (role === 'it_staff') return [
            { iconKey: 'portal',      label: 'IT Console',     path: '/it-portal' },
            { iconKey: 'credentials', label: 'Credentials',    path: '/founder/credentials' },
            { iconKey: 'accounts',    label: 'User Management', path: '/configuration' },
            { iconKey: 'settings',    label: 'Settings',       path: '/settings' },
        ];
        if (role === 'manager') return [
            { iconKey: 'dashboard', label: 'Dashboard',  path: '/dashboard' },
            { iconKey: 'projects',  label: 'Projects',   path: '/projects' },
            { iconKey: 'team',      label: 'My Team',    path: '/team' },
            { iconKey: 'reports',   label: 'Reports',    path: '/reports' },
            { iconKey: 'settings',  label: 'Settings',   path: '/settings' },
        ];
        return [
            { iconKey: 'dashboard', label: 'Dashboard', path: '/dashboard' },
            { iconKey: 'projects',  label: 'Projects',  path: '/projects' },
            { iconKey: 'tasks',     label: 'Tasks',     path: '/tasks' },
            { iconKey: 'calendar',  label: 'Calendar',  path: '/calendar' },
            { iconKey: 'team',      label: 'Team',      path: '/team' },
            { iconKey: 'settings',  label: 'Settings',  path: '/settings' },
        ];
    }, [role]);

    const handleLogout = () => {
        localStorage.clear();
        window.dispatchEvent(new Event('workspace:user-update'));
        navigate('/login');
    };

    const roleLabel = formatRoleLabel(role);

    const dark = isDark;

    /* ── Theme tokens ── */
    const bg       = dark ? 'var(--sidebar-dark)'         : '#ffffff';
    const border   = dark ? 'rgba(255,255,255,.06)'      : 'rgba(0,0,0,.08)';
    const textMuted= dark ? 'rgba(255,255,255,.38)'      : 'rgba(15,23,42,.45)';
    const activeBg = dark ? 'rgba(29,110,245,.14)'       : 'rgba(29,110,245,.08)';
    const hoverBg  = dark ? 'rgba(255,255,255,.05)'      : 'rgba(0,0,0,.04)';
    const activeC  = '#1d6ef5';
    const textC    = dark ? 'rgba(255,255,255,.65)'      : 'rgba(15,23,42,.7)';

    return (
        <>

            <div
                style={{
                    '--sb-hover': hoverBg,
                    '--sb-text':  dark ? 'rgba(255,255,255,.85)' : 'rgba(15,23,42,.9)',
                    position: 'fixed', left: 0, top: 0, height: '100vh',
                    width: sidebarWidth,
                    background: bg,
                    borderRight: `1px solid ${border}`,
                    display: 'flex', flexDirection: 'column',
                    transition: 'width .22s cubic-bezier(.34,1.56,.64,1)',
                    zIndex: 40,
                    overflow: 'hidden',
                    willChange: 'width',
                } as React.CSSProperties}
                onMouseEnter={() => setIsExpanded(true)}
                onMouseLeave={() => setIsExpanded(false)}
                onFocus={() => setIsExpanded(true)}
                onBlur={(e: FocusEvent<HTMLDivElement>) => {
                    const next = e.relatedTarget as Node | null;
                    if (!next || !e.currentTarget.contains(next)) setIsExpanded(false);
                }}
                aria-label="Primary navigation"
            >
                {/* ── Brand ── */}
                <div style={{
                    padding: isExpanded ? '18px 16px 16px' : '18px 0 16px',
                    borderBottom: `1px solid ${border}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: isExpanded ? 'flex-start' : 'center',
                    gap: 6,
                    minHeight: 74,
                }}>
                    <OrbitMark expanded={isExpanded} isDark={dark} />
                    {isExpanded && (
                        <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: '.18em',
                            color: textMuted, textTransform: 'uppercase',
                            fontFamily: '"SF Mono","Fira Code",monospace',
                            paddingLeft: 2,
                        }}>
                            {roleLabel}
                        </span>
                    )}
                </div>

                {/* ── Nav ── */}
                <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                    {menuItems.map(item => {
                        const isActive = location.pathname === item.path
                            || (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                title={isExpanded ? undefined : item.label}
                                className="sb-item"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: isExpanded ? 10 : 0,
                                    justifyContent: isExpanded ? 'flex-start' : 'center',
                                    padding: isExpanded ? '9px 12px' : '10px 0',
                                    borderRadius: 9,
                                    textDecoration: 'none',
                                    position: 'relative',
                                    color: isActive ? activeC : textC,
                                    background: isActive ? activeBg : 'transparent',
                                    border: isActive ? `1px solid rgba(29,110,245,.22)` : '1px solid transparent',
                                    boxShadow: isActive ? '0 2px 12px rgba(29,110,245,.08)' : 'none',
                                    minHeight: 40,
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Active left bar */}
                                {isActive && (
                                    <span style={{
                                        position: 'absolute', left: 0, top: '20%', bottom: '20%',
                                        width: 2, borderRadius: '0 2px 2px 0',
                                        background: '#1d6ef5',
                                        boxShadow: '0 0 8px rgba(29,110,245,.8)',
                                    }} />
                                )}
                                {Ico[item.iconKey] ?? null}
                                {isExpanded && (
                                    <span className="sb-label" style={{
                                        fontSize: 13, fontWeight: isActive ? 600 : 500,
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {item.label}
                                    </span>
                                )}
                                {!isExpanded && <span className="sr-only">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* ── Bottom: User Account Panel ── */}
                <div style={{ borderTop: `1px solid ${border}`, flexShrink: 0 }}>

                    {/* User card / panel trigger */}
                    <div
                        ref={panelRef}
                        onClick={() => setMenuOpen(o => !o)}
                        title={isExpanded ? undefined : userName || 'Account'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: isExpanded ? 9 : 0,
                            justifyContent: isExpanded ? 'flex-start' : 'center',
                            padding: isExpanded ? '10px 12px' : '10px 0',
                            margin: '6px 8px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            background: menuOpen
                                ? (dark ? 'rgba(29,110,245,.14)' : 'rgba(29,110,245,.08)')
                                : 'transparent',
                            border: `1px solid ${menuOpen ? 'rgba(29,110,245,.22)' : 'transparent'}`,
                            transition: 'background .15s,border .15s',
                            position: 'relative',
                        }}
                        onMouseEnter={e => { if (!menuOpen) (e.currentTarget as HTMLDivElement).style.background = dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'; }}
                        onMouseLeave={e => { if (!menuOpen) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                        {/* Avatar */}
                        <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#1d6ef5,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', border: `1.5px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'}`, position: 'relative' }}>
                            {userAvatar
                                ? <img src={userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : (userName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
                            }
                            {/* Online dot */}
                            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: '#10b981', border: `1.5px solid ${dark ? 'var(--sidebar-dark)' : '#fff'}`, boxShadow: '0 0 4px rgba(16,185,129,.7)' }} />
                        </div>

                        {/* Name + role */}
                        {isExpanded && (
                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: dark ? 'rgba(255,255,255,.9)' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                                    {userName || 'Orbit Member'}
                                </div>
                                <div style={{ fontSize: 10, color: dark ? 'rgba(255,255,255,.38)' : '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {roleLabel}
                                </div>
                            </div>
                        )}

                        {/* Chevron */}
                        {isExpanded && (
                            <svg width="12" height="12" fill="none" stroke={dark ? 'rgba(255,255,255,.35)' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : '', transition: 'transform .2s' }}>
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        )}
                    </div>

                    {/* Account Dropdown — fixed positioned, appears above the panel */}
                    {menuOpen && (
                        <div
                            ref={menuRef}
                            style={{
                                position: 'fixed',
                                left: sidebarWidth + 8,
                                bottom: 12,
                                width: 220,
                                background: dark ? '#131724' : '#fff',
                                border: `1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}`,
                                borderRadius: 14,
                                boxShadow: dark ? '0 16px 48px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04)' : '0 16px 48px rgba(0,0,0,.15)',
                                overflow: 'hidden',
                                zIndex: 9999,
                                animation: 'sbMenuIn .15s ease',
                            }}
                        >
                            <style>{`@keyframes sbMenuIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }`}</style>

                            {/* User header inside dropdown */}
                            <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#1d6ef5,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                        {userAvatar ? <img src={userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (userName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || 'Orbit Member'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px rgba(16,185,129,.7)', flexShrink: 0 }} />
                                            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>Online · {roleLabel}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Menu items */}
                            <div style={{ padding: '6px' }}>
                                {[
                                    { l: 'My Profile',    tab: 'profile',       path: '/settings' },
                                    { l: 'Notifications', tab: 'notifications',  path: '/settings' },
                                    { l: 'Security',      tab: 'security',       path: '/settings' },
                                    { l: 'Appearance',    tab: 'appearance',     path: '/settings' },
                                ].map(item => (
                                    <button key={item.l} type="button"
                                        onClick={() => { setMenuOpen(false); navigate(item.path, { state: { tab: item.tab } }); }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: dark ? 'rgba(255,255,255,.75)' : '#374151', fontFamily: 'inherit', transition: 'background .1s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {item.l}
                                    </button>
                                ))}

                                <div style={{ height: 1, background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)', margin: '4px 0' }} />

                                <button type="button"
                                    onClick={() => { setMenuOpen(false); navigate('/help', { replace: false }); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: dark ? 'rgba(255,255,255,.75)' : '#374151', fontFamily: 'inherit', transition: 'background .1s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    Help Center
                                </button>

                                <div style={{ height: 1, background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)', margin: '4px 0' }} />

                                <button type="button" onClick={() => { setMenuOpen(false); handleLogout(); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600, color: dark ? 'rgba(239,68,68,.75)' : 'rgba(220,38,38,.8)', fontFamily: 'inherit', transition: 'background .1s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    {Ico.logout}
                                    Log out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
