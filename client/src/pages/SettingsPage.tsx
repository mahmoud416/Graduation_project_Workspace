import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';
import type { Theme } from '../contexts/ThemeContextDefinition';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const USER_UPDATE_EVENT = 'workspace:user-update';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'appearance';

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'X-User-Id': localStorage.getItem('userId') ?? '',
    Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
});

const fmtRole = (v: string | null) =>
    v ? v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Member';

const relTime = (iso?: string | null) => {
    if (!iso) return 'Never';
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const parseFriendlyUA = (ua: string): string => {
    if (!ua) return 'Unknown Browser';
    // Already a friendly string from new backend (e.g. "Chrome on Windows 10/11")
    if (/\s+on\s+/i.test(ua) && !ua.startsWith('Mozilla')) return ua;
    // Parse raw user-agent
    const u = ua.toLowerCase();
    let browser = 'Browser';
    if (/edg\/|edge\//.test(u))               browser = 'Microsoft Edge';
    else if (/brave\//.test(u))               browser = 'Brave';
    else if (/opr\/|opera\//.test(u))         browser = 'Opera';
    else if (/chrome\//.test(u))              browser = 'Chrome';
    else if (/firefox\//.test(u))             browser = 'Firefox';
    else if (/safari\//.test(u))              browser = 'Safari';
    let os = 'Unknown OS';
    if (/iphone/.test(u))                     os = 'iPhone';
    else if (/ipad/.test(u))                  os = 'iPad';
    else if (/android/.test(u))               os = 'Android';
    else if (/windows nt 10|windows nt 11/.test(u)) os = 'Windows 10/11';
    else if (/windows nt 6\.3/.test(u))       os = 'Windows 8.1';
    else if (/windows nt 6\.1/.test(u))       os = 'Windows 7';
    else if (/windows/.test(u))               os = 'Windows';
    else if (/mac os x/.test(u))              os = 'macOS';
    else if (/linux/.test(u))                 os = 'Linux';
    return `${browser} on ${os}`;
};

/* ── Reusable primitives ────────────────────────────────────────────────────── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button type="button" onClick={() => onChange(!checked)} style={{
            width: 42, height: 23, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: checked ? 'linear-gradient(135deg,#1d6ef5,#0ea5e9)' : 'rgba(255,255,255,.1)',
            position: 'relative', flexShrink: 0, transition: 'background .25s',
            boxShadow: checked ? '0 0 14px rgba(29,110,245,.35)' : 'none',
        }}>
            <span style={{
                position: 'absolute', top: 3.5, left: checked ? 22 : 3.5,
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                transition: 'left .22s cubic-bezier(.34,1.56,.64,1)',
                boxShadow: '0 1px 4px rgba(0,0,0,.25)',
            }} />
        </button>
    );
}

function Field({ label, children, isDark }: { label: string; children: React.ReactNode; isDark: boolean }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: isDark ? 'rgba(148,163,184,.6)' : 'rgba(71,85,105,.7)', marginBottom: 6, fontFamily: '"SF Mono","Fira Code",monospace' }}>
                {label}
            </label>
            {children}
        </div>
    );
}

function SectionCard({ title, sub, children, isDark, action }: { title: string; sub?: string; children: React.ReactNode; isDark: boolean; action?: React.ReactNode }) {
    return (
        <div style={{ background: isDark ? 'rgba(255,255,255,.028)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</div>
                    {sub && <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,.38)' : '#64748b', marginTop: 3 }}>{sub}</div>}
                </div>
                {action}
            </div>
            <div style={{ padding: '20px 22px' }}>{children}</div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════════════════
   SETTINGS PAGE
════════════════════════════════════════════════════════════════════════════ */
const SettingsPage = () => {
    const location = useLocation();
    const requestedTab = (location.state as { tab?: SettingsTab } | null)?.tab;
    const [activeTab, setActiveTab] = useState<SettingsTab>(requestedTab ?? 'profile');
    const { theme, setTheme, isDark } = useTheme();
    const fileRef = useRef<HTMLInputElement>(null);

    /* ── Profile state ── */
    const [profile, setProfile] = useState({
        name: '', email: '', phone: '', bio: '', department: '',
        job_title: '', country: '', timezone: '', username: '',
        avatar: '', role: '', created_at: '', last_seen: '',
    });
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSaving,  setProfileSaving]  = useState(false);
    const [profileMsg,     setProfileMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);

    /* ── Activity stats ── */
    const [activity, setActivity] = useState<Record<string, number> | null>(null);

    /* ── Security state ── */
    const [curPwd,   setCurPwd]   = useState('');
    const [newPwd,   setNewPwd]   = useState('');
    const [confPwd,  setConfPwd]  = useState('');
    const [pwdMsg,   setPwdMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [pwdSaving, setPwdSaving] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);

    /* ── Notifications ── */
    const [notifs, setNotifs] = useState([
        { key: 'task_assigned',   title: 'Task Assigned',       desc: 'When a task is assigned to you',             email: true,  desktop: true,  mobile: true  },
        { key: 'mentions',        title: 'Mentions',            desc: 'When someone @mentions you in a comment',    email: true,  desktop: true,  mobile: true  },
        { key: 'project_updates', title: 'Project Updates',     desc: 'Status and milestone changes',               email: false, desktop: true,  mobile: false },
        { key: 'calendar',        title: 'Calendar Reminders',  desc: 'Upcoming deadlines and meetings',            email: true,  desktop: false, mobile: true  },
        { key: 'ai_review',       title: 'AI Review Results',   desc: 'When your submission is scored by AI',       email: true,  desktop: true,  mobile: false },
        { key: 'email_digest',    title: 'Email Digest',        desc: 'Weekly summary of workspace activity',       email: true,  desktop: false, mobile: false },
    ]);
    const [quietHours, setQuietHours] = useState(true);
    const [notifSaved, setNotifSaved] = useState(false);

    /* ── Accent color ── */
    const ACCENTS = ['#1d6ef5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6366f1'];
    const [accent, setAccent] = useState('#1d6ef5');

    /* ── Design tokens ── */
    const bg    = isDark ? '#05060f'            : '#f1f5f9';
    const text  = isDark ? '#f1f5f9'            : '#0f172a';
    const muted = isDark ? 'rgba(255,255,255,.38)' : '#64748b';
    const bd    = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
    const inp   = (disabled?: boolean): React.CSSProperties => ({
        width: '100%', padding: '10px 13px', borderRadius: 10, boxSizing: 'border-box',
        background: disabled ? (isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.025)') : (isDark ? 'rgba(255,255,255,.05)' : '#f8fafc'),
        border: `1px solid ${isDark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.1)'}`,
        color: disabled ? muted : text, fontSize: 13, fontFamily: 'inherit',
        outline: 'none', transition: 'border-color .2s,box-shadow .2s',
        cursor: disabled ? 'not-allowed' : 'text', opacity: disabled ? 0.6 : 1,
    });
    const btnPrimary: React.CSSProperties = {
        padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg,${accent},${accent}cc)`,
        color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
        boxShadow: `0 4px 18px ${accent}40`, transition: 'transform .15s,opacity .15s',
    };
    const btnGhost: React.CSSProperties = {
        padding: '9px 22px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
        background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)',
        border: `1px solid ${bd}`,
        color: isDark ? 'rgba(255,255,255,.6)' : '#374151',
        fontSize: 13, fontWeight: 500,
    };

    /* ── Load profile + activity on mount ── */
    useEffect(() => {
        const load = async () => {
            setProfileLoading(true);
            try {
                const [pRes, aRes, sRes] = await Promise.allSettled([
                    fetch(`${API_BASE}/users/me`, { headers: authHeaders() }),
                    fetch(`${API_BASE}/users/me/activity`, { headers: authHeaders() }),
                    fetch(`${API_BASE}/users/me/sessions`, { headers: authHeaders() }),
                ]);
                if (pRes.status === 'fulfilled' && pRes.value.ok) {
                    const u = await pRes.value.json();
                    setProfile({
                        name:       u.name       ?? '',
                        email:      u.email      ?? '',
                        phone:      u.phone      ?? '',
                        bio:        u.bio        ?? '',
                        department: u.department ?? '',
                        job_title:  u.job_title  ?? '',
                        country:    u.country    ?? '',
                        timezone:   u.timezone   ?? '',
                        username:   u.username   ?? '',
                        avatar:     u.avatar     ?? '',
                        role:       u.role       ?? '',
                        created_at: u.created_at ?? '',
                        last_seen:  u.last_seen  ?? '',
                    });
                } else {
                    setProfile(p => ({
                        ...p,
                        name:  localStorage.getItem('fullName') ?? localStorage.getItem('name') ?? '',
                        email: localStorage.getItem('email') ?? '',
                        role:  localStorage.getItem('role')  ?? '',
                    }));
                }
                if (aRes.status === 'fulfilled' && aRes.value.ok) setActivity(await aRes.value.json());
                if (sRes.status === 'fulfilled' && sRes.value.ok) setSessions(await sRes.value.json());
            } finally {
                setProfileLoading(false);
            }
        };
        void load();
    }, []);

    useEffect(() => {
        if (requestedTab && requestedTab !== activeTab) setActiveTab(requestedTab);
    }, [requestedTab]);

    /* ── Avatar helpers ── */
    const initials = useMemo(() => {
        const n = profile.name || '?';
        return n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
    }, [profile.name]);

    const handleAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setProfileMsg({ type: 'error', text: 'Image must be under 5 MB.' }); return; }
        setAvatarUploading(true);
        const reader = new FileReader();
        reader.onload = async () => {
            const b64 = reader.result as string;
            try {
                const res = await fetch(`${API_BASE}/users/me/profile`, {
                    method: 'PATCH', headers: authHeaders(),
                    body: JSON.stringify({ avatar: b64 }),
                });
                if (!res.ok) throw new Error('Upload failed');
                setProfile(p => ({ ...p, avatar: b64 }));
                localStorage.setItem('userAvatar', b64);
                window.dispatchEvent(new Event(USER_UPDATE_EVENT));
                setProfileMsg({ type: 'success', text: 'Profile photo updated.' });
            } catch {
                setProfileMsg({ type: 'error', text: 'Failed to upload photo.' });
            } finally { setAvatarUploading(false); }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleRemoveAvatar = async () => {
        setAvatarUploading(true);
        try {
            await fetch(`${API_BASE}/users/me/avatar`, { method: 'DELETE', headers: authHeaders() });
            setProfile(p => ({ ...p, avatar: '' }));
            localStorage.removeItem('userAvatar');
            window.dispatchEvent(new Event(USER_UPDATE_EVENT));
            setProfileMsg({ type: 'success', text: 'Profile photo removed.' });
        } catch {
            setProfileMsg({ type: 'error', text: 'Failed to remove photo.' });
        } finally { setAvatarUploading(false); }
    };

    /* ── Save profile ── */
    const handleSaveProfile = async (e: FormEvent) => {
        e.preventDefault();
        setProfileSaving(true);
        setProfileMsg(null);
        try {
            const res = await fetch(`${API_BASE}/users/me/profile`, {
                method: 'PATCH', headers: authHeaders(),
                body: JSON.stringify({
                    name:       profile.name       || undefined,
                    phone:      profile.phone      || undefined,
                    bio:        profile.bio        || undefined,
                    department: profile.department || undefined,
                    job_title:  profile.job_title  || undefined,
                    country:    profile.country    || undefined,
                    timezone:   profile.timezone   || undefined,
                    username:   profile.username   || undefined,
                }),
            });
            if (!res.ok) throw new Error('Failed to save');
            localStorage.setItem('fullName', profile.name);
            localStorage.setItem('userName', profile.name);
            window.dispatchEvent(new Event(USER_UPDATE_EVENT));
            setProfileMsg({ type: 'success', text: 'Profile saved successfully.' });
            setTimeout(() => setProfileMsg(null), 4000);
        } catch {
            setProfileMsg({ type: 'error', text: 'Failed to save profile. Please try again.' });
        } finally { setProfileSaving(false); }
    };

    /* ── Change password ── */
    const handleChangePassword = async () => {
        setPwdMsg(null);
        if (newPwd.length < 6) { setPwdMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return; }
        if (newPwd !== confPwd) { setPwdMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
        const userId = localStorage.getItem('userId');
        if (!userId) { setPwdMsg({ type: 'error', text: 'Session expired. Please sign in again.' }); return; }
        setPwdSaving(true);
        try {
            const res = await fetch(`${API_BASE}/auth/change-password`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ user_id: userId, new_password: newPwd }),
            });
            if (!res.ok) throw new Error((await res.text()) || 'Failed');
            setPwdMsg({ type: 'success', text: 'Password updated successfully.' });
            setCurPwd(''); setNewPwd(''); setConfPwd('');
        } catch (err: any) {
            setPwdMsg({ type: 'error', text: err.message || 'Failed to update password.' });
        } finally { setPwdSaving(false); }
    };

    /* ── Tabs ── */
    const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'profile', label: 'Profile', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        { id: 'security', label: 'Security', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
        { id: 'notifications', label: 'Notifications', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg> },
        { id: 'appearance', label: 'Appearance', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
    ];

    const TIMEZONES = ['UTC', 'UTC+1', 'UTC+2', 'UTC+3', 'UTC+4', 'UTC+5', 'UTC+5:30', 'UTC+7', 'UTC+8', 'UTC+9', 'UTC-5', 'UTC-6', 'UTC-7', 'UTC-8'];
    const COUNTRIES = ['Saudi Arabia', 'Egypt', 'UAE', 'Qatar', 'Jordan', 'Kuwait', 'Bahrain', 'Oman', 'United States', 'United Kingdom', 'France', 'Germany', 'Canada', 'Australia', 'India', 'Turkey'];

    const isOnline = profile.last_seen ? (Date.now() - new Date(profile.last_seen).getTime()) < 5 * 60 * 1000 : false;

    const msgBanner = (msg: { type: 'success' | 'error'; text: string }) => (
        <div style={{
            padding: '10px 14px', borderRadius: 9, fontSize: 12, marginBottom: 16,
            background: msg.type === 'success' ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
            border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}`,
            color: msg.type === 'success' ? '#10b981' : '#f87171',
        }}>{msg.text}</div>
    );

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: bg, fontFamily: '"Inter",-apple-system,sans-serif' }}>
            <style>{`
                .sf:focus { border-color: ${accent}99 !important; box-shadow: 0 0 0 3px ${accent}18 !important; outline: none !important; }
                .sf::placeholder { color: ${isDark ? 'rgba(148,163,184,.35)' : 'rgba(100,116,139,.45)'}; }
                .sb-tab:hover { background: ${isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'} !important; }
                .btn-p:hover  { opacity: .88; transform: translateY(-1px); }
                .btn-g:hover  { background: ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.07)'} !important; }
                .notif-row:hover { background: ${isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)'} !important; }
                .session-row:hover { background: ${isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)'} !important; }
            `}</style>

            <Sidebar />

            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', transition: 'margin .2s', minWidth: 0 }}>
                <Header title="Settings" subtitle="Profile & Preferences" />

                <main style={{ paddingTop: 58, minHeight: '100vh' }}>
                    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '32px 24px' }}>

                        <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>

                            {/* ── Left nav ────────────────────────────────── */}
                            <div style={{ width: 210, flexShrink: 0 }}>
                                <div style={{ background: isDark ? 'rgba(255,255,255,.03)' : '#fff', border: `1px solid ${bd}`, borderRadius: 14, padding: 8 }}>
                                    <div style={{ padding: '8px 12px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: muted }}>Account</div>
                                    {TABS.map(tab => {
                                        const active = activeTab === tab.id;
                                        return (
                                            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className="sb-tab"
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all .15s', fontSize: 13, fontWeight: active ? 600 : 500, color: active ? accent : (isDark ? 'rgba(255,255,255,.6)' : '#475569'), background: active ? (isDark ? `${accent}1a` : `${accent}10`) : 'transparent', borderLeft: `2px solid ${active ? accent : 'transparent'}` }}>
                                                {tab.icon} {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Content ─────────────────────────────────── */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

                                {/* ════════════════ PROFILE ════════════════ */}
                                {activeTab === 'profile' && (
                                    <>
                                        {/* Profile Header Card */}
                                        <div style={{ background: isDark ? 'linear-gradient(135deg,rgba(29,110,245,.1),rgba(139,92,246,.06))' : 'linear-gradient(135deg,#eff6ff,#f5f3ff)', border: `1px solid ${isDark ? 'rgba(29,110,245,.2)' : 'rgba(99,102,241,.15)'}`, borderRadius: 16, padding: '24px 24px 20px', position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: isDark ? 'rgba(139,92,246,.07)' : 'rgba(99,102,246,.04)', pointerEvents: 'none' }} />

                                            <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                {/* Avatar */}
                                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                                    <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(99,102,241,.2)'}`, boxShadow: `0 0 0 4px ${isDark ? 'rgba(255,255,255,.04)' : 'rgba(99,102,241,.06)'}`, background: 'linear-gradient(135deg,#1d6ef5,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, color: '#fff' }}>
                                                        {profile.avatar ? <img src={profile.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                                                    </div>
                                                    {/* Online status dot */}
                                                    <div style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: isOnline ? '#10b981' : (isDark ? '#374151' : '#d1d5db'), border: `2px solid ${isDark ? '#05060f' : '#eff6ff'}`, boxShadow: isOnline ? '0 0 8px rgba(16,185,129,.6)' : 'none' }} />
                                                </div>

                                                {/* Info */}
                                                <div style={{ flex: 1, minWidth: 200 }}>
                                                    {profileLoading ? (
                                                        <div style={{ height: 20, width: 180, borderRadius: 6, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', marginBottom: 8 }} />
                                                    ) : (
                                                        <>
                                                            <div style={{ fontSize: 22, fontWeight: 800, color: text, letterSpacing: '-.02em', marginBottom: 4 }}>{profile.name || 'Orbit Member'}</div>
                                                            <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>{profile.email}</div>
                                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: isDark ? 'rgba(29,110,245,.15)' : 'rgba(29,110,245,.1)', border: `1px solid ${isDark ? 'rgba(29,110,245,.3)' : 'rgba(29,110,245,.2)'}`, fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '.05em' }}>
                                                                    {fmtRole(profile.role).toUpperCase()}
                                                                </span>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: isOnline ? 'rgba(16,185,129,.1)' : (isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'), fontSize: 10, fontWeight: 700, color: isOnline ? '#10b981' : muted }}>
                                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#10b981' : (isDark ? '#4b5563' : '#9ca3af'), boxShadow: isOnline ? '0 0 6px #10b981' : 'none' }} />
                                                                    {isOnline ? 'Online' : 'Offline'}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 16 }}>
                                                                <div style={{ fontSize: 11, color: muted }}>Member since <strong style={{ color: text }}>{fmtDate(profile.created_at)}</strong></div>
                                                                <div style={{ fontSize: 11, color: muted }}>Last active <strong style={{ color: text }}>{relTime(profile.last_seen)}</strong></div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Avatar actions */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                                                    <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarFile} style={{ display: 'none' }} />
                                                    <button type="button" onClick={() => fileRef.current?.click()} className="btn-p" style={{ ...btnPrimary, padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} disabled={avatarUploading}>
                                                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                                                        {avatarUploading ? 'Uploading…' : profile.avatar ? 'Change Photo' : 'Upload Photo'}
                                                    </button>
                                                    {profile.avatar && (
                                                        <button type="button" onClick={handleRemoveAvatar} className="btn-g" style={{ ...btnGhost, padding: '7px 16px', fontSize: 12 }} disabled={avatarUploading}>
                                                            Remove Photo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Activity Stats */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                                            {[
                                                { l: 'Projects',       v: activity?.projects_count  ?? 0, c: '#6366f1', icon: '📁' },
                                                { l: 'Tasks Done',     v: activity?.tasks_completed ?? 0, c: '#10b981', icon: '✅' },
                                                { l: 'AI Reviews',     v: activity?.ai_reviews      ?? 0, c: '#8b5cf6', icon: '✨' },
                                                { l: 'Comments',       v: activity?.comments_posted ?? 0, c: '#f59e0b', icon: '💬' },
                                                { l: 'Files Uploaded', v: activity?.files_uploaded  ?? 0, c: '#06b6d4', icon: '📎' },
                                            ].map(s => (
                                                <div key={s.l} style={{ background: isDark ? 'rgba(255,255,255,.028)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'}`, borderRadius: 12, padding: '14px 14px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                                                    <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1, marginBottom: 4 }}>{profileLoading ? '—' : s.v}</div>
                                                    <div style={{ fontSize: 10, color: muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.l}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Personal Information Form */}
                                        <SectionCard title="Personal Information" sub="Update your name, contact info, and professional details." isDark={isDark}>
                                            {profileMsg && msgBanner(profileMsg)}
                                            <form onSubmit={handleSaveProfile}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                                    {([
                                                        { l: 'Full Name',   k: 'name',       t: 'text',  ph: 'Your full name' },
                                                        { l: 'Username',    k: 'username',   t: 'text',  ph: 'your_username'  },
                                                        { l: 'Email',       k: 'email',      t: 'email', ph: 'you@orbit.io',  ro: true },
                                                        { l: 'Phone',       k: 'phone',      t: 'tel',   ph: '+966 50 000 0000' },
                                                        { l: 'Job Title',   k: 'job_title',  t: 'text',  ph: 'e.g. Project Lead' },
                                                        { l: 'Department',  k: 'department', t: 'text',  ph: 'e.g. Engineering' },
                                                    ] as any[]).map(f => (
                                                        <Field key={f.k} label={f.l} isDark={isDark}>
                                                            <input className="sf" type={f.t} value={(profile as any)[f.k]} onChange={e => !f.ro && setProfile(p => ({ ...p, [f.k]: e.target.value }))} disabled={!!f.ro} placeholder={f.ph} style={inp(!!f.ro)} />
                                                        </Field>
                                                    ))}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                                    <Field label="Country" isDark={isDark}>
                                                        <select className="sf" value={profile.country} onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
                                                            style={{ ...inp(), appearance: 'none' }}>
                                                            <option value="">Select country…</option>
                                                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </Field>
                                                    <Field label="Timezone" isDark={isDark}>
                                                        <select className="sf" value={profile.timezone} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}
                                                            style={{ ...inp(), appearance: 'none' }}>
                                                            <option value="">Select timezone…</option>
                                                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                                        </select>
                                                    </Field>
                                                </div>

                                                <Field label="Bio" isDark={isDark}>
                                                    <textarea className="sf" rows={3} value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} placeholder="Tell your team a bit about yourself…"
                                                        style={{ ...inp(), resize: 'vertical', lineHeight: 1.6, marginBottom: 0 }} maxLength={500} />
                                                    <div style={{ fontSize: 10, color: muted, textAlign: 'right', marginTop: 4 }}>{profile.bio.length}/500</div>
                                                </Field>

                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                                                    <button type="button" className="btn-g" style={btnGhost} onClick={() => setProfileMsg(null)}>Cancel</button>
                                                    <button type="submit" className="btn-p" style={btnPrimary} disabled={profileSaving}>
                                                        {profileSaving ? 'Saving…' : 'Save Changes'}
                                                    </button>
                                                </div>
                                            </form>
                                        </SectionCard>
                                    </>
                                )}

                                {/* ════════════════ SECURITY ════════════════ */}
                                {activeTab === 'security' && (
                                    <>
                                        {/* Change Password */}
                                        <SectionCard title="Change Password" sub="Use a strong password of at least 6 characters." isDark={isDark}>
                                            {pwdMsg && msgBanner(pwdMsg)}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                                                {[
                                                    { l: 'Current Password', v: curPwd, s: setCurPwd },
                                                    { l: 'New Password',     v: newPwd, s: setNewPwd },
                                                    { l: 'Confirm Password', v: confPwd,s: setConfPwd },
                                                ].map(f => (
                                                    <Field key={f.l} label={f.l} isDark={isDark}>
                                                        <input className="sf" type="password" value={f.v} onChange={e => f.s(e.target.value)} placeholder="••••••••" style={inp()} />
                                                    </Field>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button type="button" className="btn-p" style={btnPrimary} onClick={handleChangePassword} disabled={pwdSaving}>
                                                    {pwdSaving ? 'Updating…' : 'Update Password'}
                                                </button>
                                            </div>
                                        </SectionCard>

                                        {/* 2FA Placeholder */}
                                        <SectionCard title="Two-Factor Authentication" sub="Add an extra layer of security to your account." isDark={isDark}
                                            action={<span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.2)' }}>Coming Soon</span>}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, background: isDark ? 'rgba(245,158,11,.04)' : 'rgba(245,158,11,.03)', border: `1px solid ${isDark ? 'rgba(245,158,11,.12)' : 'rgba(245,158,11,.1)'}` }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔐</div>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: text }}>Authenticator App</div>
                                                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>Use an authenticator app to generate one-time codes.</div>
                                                </div>
                                                <button type="button" style={{ ...btnGhost, marginLeft: 'auto', opacity: 0.5, cursor: 'not-allowed', fontSize: 12 }} disabled>Enable</button>
                                            </div>
                                        </SectionCard>

                                        {/* Active Sessions */}
                                        <SectionCard title="Active Sessions" sub="Devices and browsers where your account is currently signed in." isDark={isDark}>
                                            {sessions.length === 0 ? (
                                                <div style={{ padding: '20px 0', textAlign: 'center', color: muted, fontSize: 13 }}>No session records found.</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {sessions.slice(0, 8).map((s, i) => {
                                                        const ua = s.user_agent ?? '';
                                                        const friendly = parseFriendlyUA(ua);
                                                        const isMobile = /iphone|ipad|android/i.test(ua);
                                                        return (
                                                            <div key={s._id ?? i} className="session-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, transition: 'background .15s' }}>
                                                                <div style={{ width: 36, height: 36, borderRadius: 10, background: isDark ? 'rgba(29,110,245,.1)' : 'rgba(29,110,245,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                                                                    {isMobile ? '📱' : '💻'}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {friendly}
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                                                                        {s.ip_address ? <span style={{ fontFamily: 'monospace' }}>{s.ip_address}</span> : '—'} · {fmtDate(s.login_time ?? s.created_at)}
                                                                    </div>
                                                                </div>
                                                                <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: i === 0 ? 'rgba(16,185,129,.1)' : (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'), color: i === 0 ? '#10b981' : muted }}>
                                                                    {i === 0 ? 'Current' : relTime(s.login_time ?? s.created_at)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </SectionCard>

                                        {/* Login History */}
                                        <SectionCard title="Login History" sub="Recent sign-in activity on your account." isDark={isDark}>
                                            {sessions.length === 0 ? (
                                                <div style={{ padding: '20px 0', textAlign: 'center', color: muted, fontSize: 13 }}>No login history available.</div>
                                            ) : (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr>
                                                                {['Date', 'IP Address', 'Browser / Device', 'Duration'].map(h => (
                                                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: `1px solid ${bd}` }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {sessions.slice(0, 10).map((s, i) => (
                                                                <tr key={s._id ?? i} className="session-row" style={{ transition: 'background .1s' }}>
                                                                    <td style={{ padding: '10px 12px', fontSize: 12, color: text, borderBottom: `1px solid ${bd}`, whiteSpace: 'nowrap' }}>{fmtDate(s.login_time ?? s.created_at)}</td>
                                                                    <td style={{ padding: '10px 12px', fontSize: 12, color: muted, borderBottom: `1px solid ${bd}`, fontFamily: 'monospace' }}>{s.ip_address ?? '—'}</td>
                                                                    <td style={{ padding: '10px 12px', fontSize: 12, color: muted, borderBottom: `1px solid ${bd}` }}>{parseFriendlyUA(s.user_agent ?? '')}</td>
                                                                    <td style={{ padding: '10px 12px', fontSize: 12, color: muted, borderBottom: `1px solid ${bd}` }}>{s.duration_minutes != null ? `${s.duration_minutes}m` : '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </SectionCard>
                                    </>
                                )}

                                {/* ════════════════ NOTIFICATIONS ════════════════ */}
                                {activeTab === 'notifications' && (
                                    <>
                                        <SectionCard title="Notification Preferences" sub="Control what you get notified about and how." isDark={isDark}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px 72px', gap: 8, padding: '6px 12px 10px', marginBottom: 2 }}>
                                                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: muted, textTransform: 'uppercase' }}>Event</span>
                                                {['Email', 'Desktop', 'Mobile'].map(h => (
                                                    <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: muted, textTransform: 'uppercase', textAlign: 'center' }}>{h}</span>
                                                ))}
                                            </div>
                                            <div>
                                                {notifs.map((n, i) => (
                                                    <div key={n.key} className="notif-row" style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px 72px', gap: 8, padding: '13px 12px', borderRadius: 10, borderBottom: i < notifs.length - 1 ? `1px solid ${bd}` : 'none', transition: 'background .15s' }}>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{n.title}</div>
                                                            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{n.desc}</div>
                                                        </div>
                                                        {(['email', 'desktop', 'mobile'] as const).map(ch => (
                                                            <div key={ch} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Toggle checked={n[ch]} onChange={v => setNotifs(ns => ns.map((x, j) => j === i ? { ...x, [ch]: v } : x))} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </SectionCard>

                                        <SectionCard title="Quiet Hours" sub="Pause all notifications during a specific time window." isDark={isDark}
                                            action={<Toggle checked={quietHours} onChange={setQuietHours} />}>
                                            {quietHours && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                                    {[{ l: 'From', d: '22:00' }, { l: 'Until', d: '08:00' }].map(f => (
                                                        <Field key={f.l} label={f.l} isDark={isDark}>
                                                            <input className="sf" type="time" defaultValue={f.d} style={inp()} />
                                                        </Field>
                                                    ))}
                                                </div>
                                            )}
                                        </SectionCard>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                            <button type="button" className="btn-g" style={btnGhost}>Reset to Defaults</button>
                                            <button type="button" className="btn-p" style={btnPrimary} onClick={() => { setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2500); }}>
                                                {notifSaved ? '✓ Saved' : 'Save Preferences'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* ════════════════ APPEARANCE ════════════════ */}
                                {activeTab === 'appearance' && (
                                    <>
                                        <SectionCard title="Theme" sub="Choose how Orbit looks on your device." isDark={isDark}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                                                {([
                                                    { id: 'light',  label: 'Light',  sub: 'Clean & minimal',   preview: 'linear-gradient(135deg,#f8fafc 50%,#e2e8f0)' },
                                                    { id: 'dark',   label: 'Dark',   sub: 'Easy on the eyes',  preview: 'linear-gradient(135deg,#05060f 50%,#0d1526)' },
                                                    { id: 'system', label: 'System', sub: 'Follows your OS',   preview: 'linear-gradient(135deg,#f8fafc 0%,#05060f 100%)' },
                                                ] as { id: Theme; label: string; sub: string; preview: string }[]).map(opt => {
                                                    const sel = theme === opt.id;
                                                    return (
                                                        <button key={opt.id} type="button" onClick={() => setTheme(opt.id)} style={{ padding: '16px 14px', borderRadius: 14, cursor: 'pointer', background: sel ? (isDark ? `${accent}18` : `${accent}0c`) : (isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)'), border: sel ? `2px solid ${accent}` : `1px solid ${bd}`, textAlign: 'left', transition: 'all .2s', fontFamily: 'inherit', boxShadow: sel ? `0 0 22px ${accent}20` : 'none', position: 'relative' }}>
                                                            <div style={{ height: 38, borderRadius: 8, background: opt.preview, marginBottom: 12, border: `1px solid ${bd}` }} />
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 2 }}>{opt.label}</div>
                                                            <div style={{ fontSize: 11, color: muted }}>{opt.sub}</div>
                                                            {sel && <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px ${accent}70` }}><svg width="10" height="10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </SectionCard>

                                        <SectionCard title="Accent Color" sub="Personalize the highlight color used throughout the interface." isDark={isDark}>
                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                                                {ACCENTS.map(c => (
                                                    <button key={c} type="button" onClick={() => setAccent(c)} style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: accent === c ? `3px solid ${isDark ? '#fff' : '#0f172a'}` : '3px solid transparent', cursor: 'pointer', transition: 'transform .15s,box-shadow .15s', boxShadow: accent === c ? `0 0 14px ${c}80` : 'none', outline: 'none' }}
                                                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                                                        onMouseLeave={e => (e.currentTarget.style.transform = '')} />
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ width: 48, height: 48, borderRadius: 14, background: accent, boxShadow: `0 4px 16px ${accent}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: text }}>Selected: <span style={{ color: accent }}>{accent}</span></div>
                                                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>This color will be applied to buttons, links, and highlights.</div>
                                                </div>
                                            </div>
                                        </SectionCard>

                                        <SectionCard title="Platform Info" isDark={isDark}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                {[
                                                    { l: 'Platform',  v: 'Orbit Workspace' },
                                                    { l: 'Version',   v: '2.0.0' },
                                                    { l: 'AI Engine', v: 'Gemini 2.5 Flash Lite' },
                                                    { l: 'Build',     v: 'Production' },
                                                ].map(r => (
                                                    <div key={r.l} style={{ padding: '10px 14px', background: isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)', border: `1px solid ${bd}`, borderRadius: 9, display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: 12, color: muted }}>{r.l}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: text }}>{r.v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </SectionCard>
                                    </>
                                )}

                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SettingsPage;
