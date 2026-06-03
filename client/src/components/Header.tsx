import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';

interface HeaderProps {
    title: string;
    subtitle?: string;
}

const USER_UPDATE_EVENT = 'workspace:user-update';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

type NotifType = 'info' | 'success' | 'warning' | 'error' | 'mention';

interface Notif {
    id: string;          // MongoDB _id
    type: NotifType;
    read: boolean;
    title: string;
    body: string;
    time: string;
    raw_type?: string;   // original backend type string
}

const notifColors: Record<NotifType, string> = {
    info:    '#1d6ef5',
    success: '#10b981',
    warning: '#f59e0b',
    error:   '#ef4444',
    mention: '#8b5cf6',
};
const notifIcons: Record<NotifType, string> = {
    info:    '🔵',
    success: '✅',
    warning: '⚠️',
    error:   '🔴',
    mention: '@',
};

/* ─── Header ─────────────────────────────────────────────────────────────── */
const Header = ({ title, subtitle }: HeaderProps) => {
    const { setTheme, isDark } = useTheme();
    const navigate = useNavigate();

    const [profileOpen, setProfileOpen] = useState(false);
    const [notifOpen,   setNotifOpen]   = useState(false);
    const [notifs,      setNotifs]      = useState<Notif[]>([]);

    const [fullName, setFullName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('fullName') ?? '' : ''));
    const [email,    setEmail]    = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('email') ?? '' : ''));
    const [role,     setRole]     = useState<string | null>(() => (typeof window !== 'undefined' ? localStorage.getItem('role') : null));

    const profileRef = useRef<HTMLDivElement>(null);
    const notifRef   = useRef<HTMLDivElement>(null);

    /* ── Sync user from localStorage ── */
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const sync = () => {
            setFullName(localStorage.getItem('fullName') ?? '');
            setEmail(localStorage.getItem('email') ?? '');
            setRole(localStorage.getItem('role') ?? null);
        };
        window.addEventListener('storage', sync);
        window.addEventListener(USER_UPDATE_EVENT, sync);
        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener(USER_UPDATE_EVENT, sync);
        };
    }, []);

    /* ── Close dropdowns on outside click ── */
    useEffect(() => {
        if (!profileOpen && !notifOpen) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!profileRef.current?.contains(t)) setProfileOpen(false);
            if (!notifRef.current?.contains(t))   setNotifOpen(false);
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setProfileOpen(false); setNotifOpen(false); } };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
    }, [profileOpen, notifOpen]);

    const initials = useMemo(() => {
        if (!fullName.trim()) return 'U';
        return fullName.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
    }, [fullName]);

    const firstName = useMemo(() => fullName.trim().split(/\s+/)[0] || 'Commander', [fullName]);

    /* ── Fetch notifications from real API ── */
    const fetchNotifs = async () => {
        try {
            const token  = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            if (!token || !userId) return;
            const res = await fetch(`${API}/notifications`, {
                headers: { Authorization: `Bearer ${token}`, 'X-User-Id': userId },
            });
            if (!res.ok) return;
            const data: Array<{ _id: string; type: string; payload: Record<string, string>; is_read: boolean; created_at?: string }> = await res.json();
            const mapped: Notif[] = data.map(n => {
                const notifType: NotifType = (['info','success','warning','error','mention'] as string[]).includes(n.type) ? n.type as NotifType : 'info';
                const createdAt = n.created_at ? new Date(n.created_at) : null;
                const now = Date.now();
                let time = 'Just now';
                if (createdAt) {
                    const diff = now - createdAt.getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 2) time = 'Just now';
                    else if (mins < 60) time = `${mins}m ago`;
                    else if (mins < 1440) time = `${Math.floor(mins / 60)}h ago`;
                    else time = createdAt.toLocaleDateString();
                }
                return { id: n._id, type: notifType, read: n.is_read, title: n.payload?.title ?? 'Notification', body: n.payload?.body ?? '', time, raw_type: n.type };
            });
            setNotifs(mapped);
        } catch { /* silent */ }
    };

    useEffect(() => {
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 30000); // poll every 30s
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const unreadCount = notifs.filter(n => !n.read).length;

    const markAllRead = async () => {
        setNotifs(p => p.map(n => ({ ...n, read: true })));
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            if (!token || !userId) return;
            await fetch(`${API}/notifications/read-all`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'X-User-Id': userId },
            });
        } catch { /* silent */ }
    };

    const dismissNotif = async (id: string) => {
        setNotifs(p => p.filter(n => n.id !== id));
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            if (!token || !userId) return;
            await fetch(`${API}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'X-User-Id': userId },
            });
        } catch { /* silent */ }
    };

    const handleLogout = () => {
        ['token','userId','role','fullName','email','jobTitle','phone','bio'].forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
        window.dispatchEvent(new Event(USER_UPDATE_EVENT));
        window.location.replace(`${window.location.origin}/login`);
    };

    /* ── Theme tokens ── */
    const bg      = isDark ? 'var(--header-dark-bg)'  : 'var(--header-lite-bg)';
    const border  = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)';
    const popupBg = isDark ? '#070a1a'            : '#ffffff';
    const popupBd = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)';
    const textH   = isDark ? 'white'              : '#0f172a';
    const textM   = isDark ? 'rgba(255,255,255,.5)'  : 'rgba(15,23,42,.5)';
    const hoverBg = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)';
    const btnBg   = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
    const btnBd   = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';

    const sharedBtn: React.CSSProperties = {
        width: 36, height: 36, borderRadius: 9,
        background: btnBg, border: `1px solid ${btnBd}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: textM,
        transition: 'all .15s',
        flexShrink: 0,
    };

    const formatRole = (r: string | null) => r ? r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Member';

    return (
        <>

            <header style={{
                '--hd-hover': hoverBg,
                position: 'fixed', top: 0, right: 0, zIndex: 50,
                left: 'var(--sidebar-width)',
                height: 58,
                background: bg,
                borderBottom: `1px solid ${border}`,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center',
                padding: '0 22px',
                transition: 'left .2s cubic-bezier(.25,.46,.45,.94)',
            } as React.CSSProperties}>

                {/* ── Left: title ── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Accent dot */}
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1d6ef5', boxShadow: '0 0 8px rgba(29,110,245,.8)', flexShrink: 0 }} />
                        <h1 style={{ fontSize: 14, fontWeight: 700, color: textH, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {title}
                        </h1>
                        {subtitle && (
                            <>
                                <span style={{ color: isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.15)', fontSize: 14 }}>/</span>
                                <span style={{ fontSize: 12, color: textM, whiteSpace: 'nowrap' }}>{subtitle}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Right: controls ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

                    {/* ── Notifications ── */}
                    <div ref={notifRef} style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={() => { setNotifOpen(p => !p); setProfileOpen(false); }}
                            className="hd-btn"
                            style={{ ...sharedBtn, position: 'relative' }}
                            title="Notifications"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                            </svg>
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: -3, right: -3,
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: '#1d6ef5', color: 'white',
                                    fontSize: 9, fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: `2px solid ${isDark ? '#05060f' : '#fff'}`,
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Notifications panel */}
                        {notifOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                                width: 340, maxHeight: 440,
                                background: popupBg,
                                border: `1px solid ${popupBd}`,
                                borderRadius: 14,
                                boxShadow: isDark ? '0 24px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(29,110,245,.08)' : '0 24px 64px rgba(0,0,0,.15)',
                                overflow: 'hidden',
                                animation: 'slideDown .2s ease-out both',
                                zIndex: 60,
                            }}>
                                {/* Header */}
                                <div style={{
                                    padding: '14px 16px 12px',
                                    borderBottom: `1px solid ${popupBd}`,
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: textH }}>Notifications</div>
                                        <div style={{ fontSize: 11, color: textM, marginTop: 1 }}>{unreadCount} unread</div>
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={markAllRead}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                fontSize: 11, color: '#1d6ef5', fontWeight: 600, padding: 0,
                                            }}
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>

                                {/* List */}
                                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                                    {notifs.length === 0 ? (
                                        <div style={{ padding: 32, textAlign: 'center', color: textM, fontSize: 12 }}>
                                            All caught up! 🎉
                                        </div>
                                    ) : (
                                        notifs.map(n => (
                                            <div key={n.id} className="hd-notif-row" style={{
                                                display: 'flex', gap: 12, padding: '12px 16px',
                                                borderBottom: `1px solid ${popupBd}`,
                                                background: !n.read && isDark ? 'rgba(29,110,245,.04)' : 'transparent',
                                                transition: 'background .15s', cursor: 'default',
                                            }}>
                                                {/* Icon */}
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                                                    background: `${notifColors[n.type]}14`,
                                                    border: `1px solid ${notifColors[n.type]}25`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 14,
                                                }}>{notifIcons[n.type]}</div>

                                                {/* Content */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                                        <span style={{ fontSize: 12, fontWeight: n.read ? 500 : 700, color: textH, lineHeight: 1.3 }}>{n.title}</span>
                                                        {!n.read && (
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1d6ef5', flexShrink: 0, marginTop: 3 }} />
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: textM, marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
                                                    <div style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.3)', marginTop: 4 }}>{n.time}</div>
                                                </div>

                                                {/* Dismiss */}
                                                <button
                                                    type="button"
                                                    onClick={() => dismissNotif(n.id)}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        color: textM, padding: '2px 4px', borderRadius: 4,
                                                        fontSize: 14, lineHeight: 1, flexShrink: 0, alignSelf: 'flex-start',
                                                        transition: 'color .15s',
                                                    }}
                                                    title="Dismiss"
                                                >×</button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Profile ── */}
                    <div ref={profileRef} style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={() => { setProfileOpen(p => !p); setNotifOpen(false); }}
                            style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #1d6ef5, #8b5cf6)',
                                border: profileOpen ? '2px solid rgba(29,110,245,.7)' : '2px solid transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 800, color: 'white', cursor: 'pointer',
                                boxShadow: profileOpen ? '0 0 16px rgba(29,110,245,.45)' : '0 2px 8px rgba(29,110,245,.25)',
                                transition: 'all .18s',
                                fontFamily: '"Inter",sans-serif',
                            }}
                        >
                            {initials}
                        </button>

                        {/* Profile dropdown */}
                        {profileOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                                width: 270,
                                background: popupBg,
                                border: `1px solid ${popupBd}`,
                                borderRadius: 14,
                                boxShadow: isDark ? '0 24px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(29,110,245,.06)' : '0 24px 64px rgba(0,0,0,.15)',
                                overflow: 'hidden',
                                animation: 'slideDown .2s ease-out both',
                                zIndex: 60,
                            }}>
                                {/* User card */}
                                <div style={{
                                    padding: '16px',
                                    background: isDark ? 'rgba(29,110,245,.05)' : 'rgba(29,110,245,.03)',
                                    borderBottom: `1px solid ${popupBd}`,
                                    display: 'flex', gap: 12, alignItems: 'center',
                                }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                        background: 'linear-gradient(135deg, #1d6ef5, #8b5cf6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 14, fontWeight: 800, color: 'white',
                                        boxShadow: '0 0 16px rgba(29,110,245,.3)',
                                    }}>{initials}</div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: textH, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {fullName || 'Orbit Member'}
                                        </div>
                                        <div style={{ fontSize: 11, color: textM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                            {email || 'No email'}
                                        </div>
                                        <div style={{
                                            marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '2px 8px', borderRadius: 20,
                                            background: 'rgba(29,110,245,.12)', border: '1px solid rgba(29,110,245,.2)',
                                        }}>
                                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                                            <span style={{ fontSize: 9, fontWeight: 700, color: '#1d6ef5', letterSpacing: '.1em', fontFamily: 'monospace' }}>
                                                {formatRole(role).toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu items */}
                                <div style={{ padding: '6px 8px' }}>
                                        {/* Profile Settings */}
                                    <button
                                        type="button"
                                        onClick={() => { setProfileOpen(false); navigate('/settings', { state: { tab: 'profile' } }); }}
                                        className="hd-row"
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, background: 'transparent', border: 'none', cursor: 'pointer', color: textH, fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'background .15s' }}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                        </svg>
                                        Profile Settings
                                    </button>

                                    {/* Divider */}
                                    <div style={{ height: 1, background: popupBd, margin: '6px 4px' }} />

                                    {/* Logout */}
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '9px 10px', borderRadius: 9,
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            color: '#ef4444', fontSize: 13, fontWeight: 600,
                                            transition: 'background .15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                                        </svg>
                                        Log out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
