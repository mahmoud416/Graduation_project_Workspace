import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../contexts/useTheme';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1`;
const tok = () => localStorage.getItem('token') ?? '';

/* ─── Color palette ──────────────────────────────────────────────────────── */
const BLUE = '#1d6ef5';
const PURP = '#8b5cf6';
const TEAL = '#06b6d4';
const GRN  = '#10b981';
const AMB  = '#f59e0b';
const RED  = '#ef4444';

/* ─── Theme tokens ───────────────────────────────────────────────────────── */
const tok_ = (d: boolean) => ({
    bg:      d ? '#0a0c14'                  : '#f5f6fa',
    surf:    d ? '#111420'                  : '#ffffff',
    surf2:   d ? '#171b2e'                  : '#f8f9fc',
    bord:    d ? 'rgba(255,255,255,.07)'    : 'rgba(0,0,0,.08)',
    bord2:   d ? 'rgba(255,255,255,.04)'    : 'rgba(0,0,0,.05)',
    text:    d ? '#f1f4f9'                  : '#0f172a',
    sub:     d ? 'rgba(255,255,255,.55)'    : '#475569',
    muted:   d ? 'rgba(255,255,255,.32)'    : '#94a3b8',
    hd:      d ? 'rgba(10,12,20,.9)'        : 'rgba(255,255,255,.92)',
    hdbord:  d ? 'rgba(255,255,255,.06)'    : 'rgba(0,0,0,.07)',
    pop:     d ? '#141720'                  : '#ffffff',
    popbd:   d ? 'rgba(255,255,255,.09)'    : 'rgba(0,0,0,.09)',
    hover:   d ? 'rgba(255,255,255,.04)'    : 'rgba(0,0,0,.03)',
    inbg:    d ? 'rgba(255,255,255,.04)'    : '#f8fafc',
    inbd:    d ? 'rgba(255,255,255,.08)'    : 'rgba(0,0,0,.1)',
    num:     d ? '#ffffff'                  : '#0f172a',
});

const card_ = (d: boolean, extra: React.CSSProperties = {}): React.CSSProperties => ({
    background:   d ? '#111420' : '#ffffff',
    border:       `1px solid ${d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'}`,
    borderRadius: 12,
    ...extra,
});

/* ─── Animated counter ───────────────────────────────────────────────────── */
function Counter({ val, prefix = '', suffix = '' }: { val: number; prefix?: string; suffix?: string }) {
    const [n, setN] = useState(0);
    const fired = useRef(false);
    useEffect(() => {
        if (!val || fired.current) return;
        fired.current = true;
        const start = performance.now();
        const run = (now: number) => {
            const p = Math.min((now - start) / 900, 1);
            setN(Math.round((1 - Math.pow(1 - p, 3)) * val));
            if (p < 1) requestAnimationFrame(run);
        };
        requestAnimationFrame(run);
    }, [val]);
    return <>{prefix}{n.toLocaleString()}{suffix}</>;
}

/* ─── Thin progress bar ──────────────────────────────────────────────────── */
function ProgressBar({ pct, color, h = 4 }: { pct: number; color: string; h?: number }) {
    const { isDark } = useTheme();
    return (
        <div style={{ height: h, borderRadius: h, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: h, transition: 'width 1s cubic-bezier(.25,.46,.45,.94)' }} />
        </div>
    );
}

/* ─── Status dot ─────────────────────────────────────────────────────────── */
function StatusDot({ color = GRN }: { color?: string }) {
    return (
        <span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7, flexShrink: 0 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, opacity: .35, animation: 'fdPing 2s ease-in-out infinite' }} />
            <span style={{ position: 'relative', borderRadius: '50%', background: color, width: 7, height: 7, display: 'block' }} />
        </span>
    );
}

/* ─── Section label ──────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
    const { isDark } = useTheme();
    const t = tok_(isDark);
    return (
        <div style={{ fontSize: 11, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>
            {children}
        </div>
    );
}

/* ─── Divider ────────────────────────────────────────────────────────────── */
function Div() {
    const { isDark } = useTheme();
    return <div style={{ height: 1, background: tok_(isDark).bord2, margin: '0 32px' }} />;
}

/* ─── Tier badge ─────────────────────────────────────────────────────────── */
function TierBadge({ tier }: { tier: string }) {
    const colors: Record<string, [string, string]> = {
        Enterprise: [AMB,  `${AMB}16`],
        Pro:        [BLUE, `${BLUE}16`],
        Basic:      ['#64748b', 'rgba(100,116,139,.12)'],
    };
    const [c, bg] = colors[tier] ?? colors.Basic;
    return (
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: bg, color: c }}>
            {tier}
        </span>
    );
}

/* ─── Notification data ──────────────────────────────────────────────────── */
const FD_NOTIFS = [
    { id: 1, type: 'info'    as const, read: false, title: 'New Tenant Onboarded',  body: 'A new organization joined on the Pro plan.',        time: '5m ago'    },
    { id: 2, type: 'success' as const, read: false, title: 'AI Engine Healthy',     body: 'All active evaluations processed successfully.',     time: '22m ago'   },
    { id: 3, type: 'warning' as const, read: false, title: 'Token Quota Warning',   body: 'One tenant is at 89% of their AI token quota.',     time: '1h ago'    },
    { id: 4, type: 'info'    as const, read: true,  title: 'Framework Updated',     body: 'Course Report framework v2 is now active.',         time: '3h ago'    },
    { id: 5, type: 'success' as const, read: true,  title: 'Revenue Milestone',     body: 'Monthly recurring revenue hit a new high.',         time: 'Yesterday' },
];
type NotifType = 'info' | 'success' | 'warning' | 'error';
const NCOL: Record<NotifType, string> = { info: BLUE, success: GRN, warning: AMB, error: RED };

/* ══════════════════════════════════════════════════════════════════════════
   HEADER BAR
══════════════════════════════════════════════════════════════════════════ */
function TopBar({ metrics }: { metrics: any }) {
    const navigate            = useNavigate();
    const { isDark, setTheme } = useTheme();
    const t                   = tok_(isDark);
    const fullName  = localStorage.getItem('fullName') || 'Founder';
    const email     = localStorage.getItem('email') || '';
    const initials  = fullName.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
    const [notifOpen,   setNotifOpen]   = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifs,      setNotifs]      = useState(FD_NOTIFS);
    const notifRef   = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const unread     = notifs.filter(n => !n.read).length;

    useEffect(() => {
        if (!notifOpen && !profileOpen) return;
        const close = (e: MouseEvent) => {
            if (!notifRef.current?.contains(e.target as Node))   setNotifOpen(false);
            if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setNotifOpen(false); setProfileOpen(false); } };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    }, [notifOpen, profileOpen]);

    const handleLogout = () => {
        ['token','userId','role','fullName','email','jobTitle','phone','bio'].forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
        window.dispatchEvent(new Event('workspace:user-update'));
        window.location.replace(`${window.location.origin}/login`);
    };

    const iconBtn: React.CSSProperties = {
        width: 32, height: 32, borderRadius: 8,
        background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
        border: `1px solid ${t.bord}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: t.sub, transition: 'all .15s', flexShrink: 0, position: 'relative',
    };

    const popup: React.CSSProperties = {
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        background: t.pop, border: `1px solid ${t.popbd}`, borderRadius: 12,
        boxShadow: isDark ? '0 20px 60px rgba(0,0,0,.7)' : '0 20px 60px rgba(0,0,0,.14)',
        overflow: 'hidden', animation: 'fdSlide .16s ease-out both', zIndex: 60,
    };

    const menuBtn = (label: string, icon: React.ReactNode, onClick: () => void, danger = false): React.ReactNode => (
        <button type="button" onClick={onClick}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: danger ? RED : t.text, fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'background .12s', fontFamily: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,68,68,.07)' : t.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {icon}{label}
        </button>
    );

    return (
        <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 56, background: t.hd, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${t.hdbord}`, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 16, transition: 'background .2s' }}>
            <style>{`.fd-row:hover { background: ${t.hover}; }`}</style>

            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: t.text, fontFamily: '"Space Grotesk","Inter",sans-serif', letterSpacing: '-.01em' }}>Orbit</span>
                <svg width="4" height="16" viewBox="0 0 4 16" fill="none"><path d="M2 0v16" stroke={t.bord} strokeWidth="1.5"/></svg>
                <span style={{ fontSize: 12, color: t.muted }}>Founder Console</span>
            </div>

            {/* System health pills */}
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                {[
                    { label: 'Platform', ok: true  },
                    { label: 'AI Engine', ok: true  },
                    { label: `${metrics?.total_entities ?? 0} Orgs`, ok: true  },
                ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, background: s.ok ? `${GRN}10` : `${RED}10`, border: `1px solid ${s.ok ? GRN : RED}20` }}>
                        <StatusDot color={s.ok ? GRN : RED} />
                        <span style={{ fontSize: 11, color: s.ok ? GRN : RED, fontWeight: 500 }}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => { setNotifOpen(p => !p); setProfileOpen(false); }} style={iconBtn}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
                        {unread > 0 && <span style={{ position: 'absolute', top: -3, right: -3, width: 15, height: 15, borderRadius: '50%', background: BLUE, color: 'white', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${isDark ? '#0a0c14' : '#fff'}` }}>{unread}</span>}
                    </button>
                    {notifOpen && (
                        <div style={{ ...popup, width: 360, maxHeight: 420 }}>
                            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.popbd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Notifications</span>
                                {unread > 0 && <button type="button" onClick={() => setNotifs(p => p.map(n => ({ ...n, read: true })))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: BLUE, fontWeight: 600 }}>Mark all read</button>}
                            </div>
                            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                                {notifs.map(n => (
                                    <div key={n.id} className="fd-row" style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: `1px solid ${t.popbd}`, background: !n.read ? (isDark ? 'rgba(29,110,245,.04)' : 'rgba(29,110,245,.02)') : 'transparent', transition: 'background .12s' }}>
                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: NCOL[n.type], flexShrink: 0, marginTop: 4 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: t.text, lineHeight: 1.3 }}>{n.title}</div>
                                            <div style={{ fontSize: 12, color: t.muted, marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
                                            <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{n.time}</div>
                                        </div>
                                        <button type="button" onClick={() => setNotifs(p => p.filter(x => x.id !== n.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 16, alignSelf: 'flex-start', padding: 0, lineHeight: 1 }}>×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div ref={profileRef} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => { setProfileOpen(p => !p); setNotifOpen(false); }}
                        style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${BLUE},${PURP})`, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', cursor: 'pointer', transition: 'opacity .15s', fontFamily: 'inherit' }}>
                        {initials}
                    </button>
                    {profileOpen && (
                        <div style={{ ...popup, width: 236 }}>
                            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.popbd}` }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</div>
                                <div style={{ fontSize: 12, color: t.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                            </div>
                            <div style={{ padding: '5px 6px' }}>
                                {menuBtn('Profile Settings',
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                                    () => { setProfileOpen(false); navigate('/settings', { state: { tab: 'profile' } }); }
                                )}
                                {menuBtn('Manage IT Accounts',
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
                                    () => { setProfileOpen(false); navigate('/founder/accounts'); }
                                )}
                                <div style={{ height: 1, background: t.popbd, margin: '4px 4px' }} />
                                {menuBtn('Sign out',
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>,
                                    handleLogout, true
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: GLOBAL OVERVIEW
══════════════════════════════════════════════════════════════════════════ */
function SectionOverview({ metrics }: { metrics: any }) {
    const { isDark } = useTheme();
    const t = tok_(isDark);
    const name = (localStorage.getItem('fullName') || 'Founder').split(' ')[0];
    const hr   = new Date().getHours();
    const hi   = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

    const stats = [
        { label: 'Organizations',  value: metrics?.total_entities ?? 0,   sub: 'Active tenants',       color: PURP,  prefix: '',  suffix: '' },
        { label: 'Total Users',    value: metrics?.total_users ?? 0,       sub: 'Across all orgs',      color: BLUE,  prefix: '',  suffix: '' },
        { label: 'Monthly Revenue',value: metrics?.financials?.mrr ?? 0,   sub: 'Recurring',            color: GRN,   prefix: '$', suffix: '' },
        { label: 'Avg QA Score',   value: metrics?.avg_quality_score ?? 0, sub: 'Global pass rate',     color: TEAL,  prefix: '',  suffix: '%' },
        { label: 'Pending Reviews',value: metrics?.pending_ai_evals ?? 0,  sub: 'Awaiting evaluation',  color: AMB,   prefix: '',  suffix: '' },
        { label: 'System Uptime',  value: 100,                             sub: 'Past 30 days',         color: GRN,   prefix: '',  suffix: '%' },
    ];

    return (
        <section style={{ padding: '28px 32px 0' }}>
            {/* Page title */}
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-.02em', marginBottom: 3 }}>
                        {hi}, {name}
                    </h1>
                    <p style={{ fontSize: 13, color: t.muted }}>
                        Here's what's happening across the platform today.
                    </p>
                </div>
                <div style={{ fontSize: 12, color: t.muted }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Stat grid — 6 cards, 2 rows of 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                {stats.slice(0, 3).map(s => (
                    <div key={s.label} style={{ ...card_(isDark, { padding: '18px 20px' }) }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{s.label}</span>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'block' }} />
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, color: t.num, lineHeight: 1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                            <Counter val={s.value} prefix={s.prefix} suffix={s.suffix} />
                        </div>
                        <div style={{ fontSize: 12, color: t.muted }}>{s.sub}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                {stats.slice(3).map(s => (
                    <div key={s.label} style={{ ...card_(isDark, { padding: '18px 20px' }) }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{s.label}</span>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'block' }} />
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, color: t.num, lineHeight: 1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                            <Counter val={s.value} prefix={s.prefix} suffix={s.suffix} />
                        </div>
                        <div style={{ fontSize: 12, color: t.muted }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* System Health strip */}
            <div style={{ ...card_(isDark, { padding: '14px 20px', marginBottom: 32 }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.sub }}>System Health</span>
                    <span style={{ fontSize: 11, color: GRN, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <StatusDot /> All systems operational
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 14 }}>
                    {[
                        { label: 'API Gateway',    uptime: 99.97, color: GRN  },
                        { label: 'AI Engine',      uptime: 99.80, color: GRN  },
                        { label: 'Database',       uptime: 100,   color: GRN  },
                        { label: 'Storage',        uptime: 99.95, color: GRN  },
                    ].map(s => (
                        <div key={s.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: t.sub }}>{s.label}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.uptime}%</span>
                            </div>
                            <ProgressBar pct={s.uptime} color={s.color} h={3} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: REVENUE & SUBSCRIPTIONS
══════════════════════════════════════════════════════════════════════════ */
function SectionRevenue({ metrics }: { metrics: any }) {
    const { isDark } = useTheme();
    const t    = tok_(isDark);
    const dist = metrics?.financials?.tier_distribution ?? {};
    const mrr  = metrics?.financials?.mrr ?? 0;
    const arr  = mrr * 12;

    const tiers = [
        { name: 'Enterprise', price: 999, tenants: dist.Enterprise ?? 0, color: AMB  },
        { name: 'Pro',        price: 299, tenants: dist.Pro ?? 0,        color: BLUE },
        { name: 'Basic',      price: 49,  tenants: dist.Basic ?? 0,      color: t.muted as string },
    ];
    const totalTenants = Math.max(tiers.reduce((s, r) => s + r.tenants, 0), 1);

    return (
        <section style={{ padding: '0 32px 32px' }}>
            <SectionLabel>Revenue &amp; Subscriptions</SectionLabel>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
                {/* Tier table */}
                <div style={{ ...card_(isDark) }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Subscription Tiers</span>
                        <span style={{ fontSize: 12, color: t.muted }}>{totalTenants} total tenants</span>
                    </div>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 90px 120px 1fr', gap: 0, padding: '8px 20px', borderBottom: `1px solid ${t.bord2}` }}>
                        {['Tier', 'Tenants', 'Price', 'Revenue', 'Distribution'].map(h => (
                            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
                        ))}
                    </div>
                    {tiers.map((row, i) => {
                        const rev = row.tenants * row.price;
                        const pct = (row.tenants / totalTenants) * 100;
                        return (
                            <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 90px 120px 1fr', gap: 0, padding: '14px 20px', borderBottom: i < tiers.length - 1 ? `1px solid ${t.bord2}` : 'none', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{row.name}</span>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{row.tenants}</div>
                                <div style={{ fontSize: 13, color: t.sub }}>${row.price}<span style={{ fontSize: 11, color: t.muted }}>/mo</span></div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>${rev.toLocaleString()}</div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <span style={{ fontSize: 11, color: t.muted }}>{pct.toFixed(0)}%</span>
                                    </div>
                                    <ProgressBar pct={pct} color={row.color} h={3} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Revenue summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ ...card_(isDark, { padding: '20px', flex: 1 }) }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 8 }}>Monthly Recurring Revenue</div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: t.num, lineHeight: 1, marginBottom: 6 }}>
                            $<Counter val={mrr} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: GRN }}>
                            <StatusDot color={GRN} />
                            Live
                        </div>
                    </div>
                    <div style={{ ...card_(isDark, { padding: '20px', flex: 1 }) }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 8 }}>Annual Run Rate</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: t.num, lineHeight: 1 }}>
                            $<Counter val={arr} />
                        </div>
                        <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>MRR × 12</div>
                    </div>
                    <div style={{ ...card_(isDark, { padding: '20px', flex: 1 }) }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 8 }}>Avg Rev / Tenant</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: t.num, lineHeight: 1 }}>
                            ${totalTenants > 1 ? Math.round(mrr / (totalTenants - 1)).toLocaleString() : '—'}
                        </div>
                        <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>Per active org</div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: ORGANIZATIONS
══════════════════════════════════════════════════════════════════════════ */
function SectionOrgs({ entities, newForm, setNewForm, onCreate }: any) {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const t = tok_(isDark);
    const [showForm, setShowForm] = useState(false);

    return (
        <section style={{ padding: '0 32px 32px' }}>
            <SectionLabel>Organizations</SectionLabel>

            <div style={{ ...card_(isDark) }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{entities.length} Organizations</span>
                    <button type="button" onClick={() => setShowForm(p => !p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, background: BLUE, border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity .15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add Organization
                    </button>
                </div>

                {/* Inline add form */}
                {showForm && (
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.bord}`, background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.015)', display: 'grid', gridTemplateColumns: '1fr 1fr 160px 120px', gap: 10, alignItems: 'flex-end' }}>
                        {[{ label: 'Organization name', key: 'name', ph: 'e.g. King Saud University' }, { label: 'Description', key: 'description', ph: 'Brief overview' }].map(f => (
                            <div key={f.key}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 5 }}>{f.label}</label>
                                <input type="text" value={newForm[f.key]} onChange={e => setNewForm({ ...newForm, [f.key]: e.target.value })} placeholder={f.ph}
                                    style={{ width: '100%', padding: '8px 10px', background: t.inbg, border: `1px solid ${t.inbd}`, borderRadius: 7, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }} />
                            </div>
                        ))}
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 5 }}>Tier</label>
                            <select value={newForm.subscription_tier} onChange={e => setNewForm({ ...newForm, subscription_tier: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', background: isDark ? '#0f1220' : '#fff', border: `1px solid ${t.inbd}`, borderRadius: 7, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                                <option value="Basic">Basic</option>
                                <option value="Pro">Pro</option>
                                <option value="Enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={() => { onCreate(); setShowForm(false); }} disabled={!newForm.name}
                                style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', background: newForm.name ? BLUE : (isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'), color: newForm.name ? 'white' : t.muted, fontSize: 12, fontWeight: 600, cursor: newForm.name ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                                Create
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                style={{ padding: '8px 10px', borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {entities.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: t.muted, fontSize: 13 }}>
                        No organizations onboarded yet. Click "Add Organization" to get started.
                    </div>
                ) : (
                    <>
                        {/* Table header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 100px 70px 140px 180px 80px', gap: 0, padding: '8px 20px', borderBottom: `1px solid ${t.bord2}` }}>
                            {['Organization', 'Tier', 'Users', 'Teams', 'AI Tokens', 'Status'].map(h => (
                                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
                            ))}
                        </div>
                        {entities.map((e: any, i: number) => {
                            const used     = e.ai_tokens_used ?? 0;
                            const quota    = e.ai_quota ?? 0;
                            const tokenPct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;
                            const teamCnt  = e.team_ids?.length ?? 0;
                            const maxT     = e.max_teams ?? 5;
                            const teamPct  = maxT > 0 ? (teamCnt / maxT) * 100 : 0;
                            const userCnt  = e.user_count ?? 0;
                            return (
                                <div key={e._id} className="fd-row" style={{ display: 'grid', gridTemplateColumns: '2.5fr 100px 70px 140px 180px 80px', gap: 0, padding: '12px 20px', borderBottom: i < entities.length - 1 ? `1px solid ${t.bord2}` : 'none', alignItems: 'center', transition: 'background .12s' }}>
                                    {/* Name */}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                                        {e.description && <div style={{ fontSize: 11, color: t.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>}
                                    </div>
                                    {/* Tier */}
                                    <div><TierBadge tier={e.subscription_tier ?? 'Basic'} /></div>
                                    {/* Users */}
                                    <div style={{ fontSize: 13, fontWeight: 500, color: userCnt > 0 ? t.text : t.muted }}>
                                        {userCnt > 0 ? userCnt.toLocaleString() : '—'}
                                    </div>
                                    {/* Teams */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.muted, marginBottom: 5 }}>
                                            <span>{teamCnt} / {maxT} teams</span>
                                        </div>
                                        <ProgressBar pct={teamPct} color={PURP} h={3} />
                                    </div>
                                    {/* AI Tokens */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.muted, marginBottom: 5 }}>
                                            <span>{used.toLocaleString()} used</span>
                                            <span style={{ color: tokenPct > 80 ? RED : TEAL, fontWeight: 600 }}>{tokenPct.toFixed(0)}%</span>
                                        </div>
                                        <ProgressBar pct={tokenPct} color={tokenPct > 80 ? RED : TEAL} h={3} />
                                    </div>
                                    {/* Status */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <StatusDot color={GRN} />
                                        <span style={{ fontSize: 12, color: GRN }}>Active</span>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: AI ENGINE
══════════════════════════════════════════════════════════════════════════ */
function SectionAI({ metrics }: { metrics: any }) {
    const { isDark } = useTheme();
    const t = tok_(isDark);
    const trends: any[] = metrics?.ai_trends ?? [];
    const maxVal = Math.max(...trends.map((d: any) => (d.accepted ?? 0) + (d.rejected ?? 0)), 1);

    const stats = [
        { label: 'Eval Queue',      value: `${metrics?.pending_ai_evals ?? 0}`,       color: AMB  },
        { label: 'Avg QA Score',    value: `${metrics?.avg_quality_score ?? 0}%`,      color: BLUE },
        { label: 'Accepted Today',  value: `${metrics?.ai_trends?.[6]?.accepted ?? 0}`, color: GRN  },
        { label: 'Rejected Today',  value: `${metrics?.ai_trends?.[6]?.rejected ?? 0}`, color: RED  },
    ];

    return (
        <section style={{ padding: '0 32px 32px' }}>
            <SectionLabel>AI Engine</SectionLabel>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
                {/* Chart */}
                <div style={{ ...card_(isDark, { padding: '20px' }) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Evaluation Trends</div>
                            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Accepted vs rejected — last 7 days</div>
                        </div>
                        <div style={{ display: 'flex', gap: 14 }}>
                            {[[GRN, 'Accepted'], [RED, 'Rejected']].map(([c, l]) => (
                                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: t.muted }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />{l}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Chart bars */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160 }}>
                        {(trends.length ? trends : Array(7).fill({ accepted: 0, rejected: 0, day: '—' })).map((d: any, i: number) => {
                            const tot  = (d.accepted ?? 0) + (d.rejected ?? 0);
                            const accH = Math.max(((d.accepted ?? 0) / maxVal) * 130, 0);
                            const rejH = Math.max(((d.rejected ?? 0) / maxVal) * 130, 0);
                            const isToday = i === 6;
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 130, width: '100%', gap: 2, position: 'relative' }}>
                                        {rejH > 0 && <div style={{ width: '60%', background: RED, opacity: .75, borderRadius: '3px 3px 0 0', height: rejH, transition: 'height 1s ease-out' }} />}
                                        {accH > 0 && <div style={{ width: '60%', background: GRN, borderRadius: '3px 3px 0 0', height: accH, transition: 'height 1s ease-out' }} />}
                                        {tot === 0 && <div style={{ width: '60%', height: 3, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 3, alignSelf: 'flex-end' }} />}
                                    </div>
                                    <span style={{ fontSize: 10, color: isToday ? BLUE : t.muted, fontWeight: isToday ? 600 : 400 }}>{d.day ?? '—'}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Stats column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Engine status */}
                    <div style={{ ...card_(isDark, { padding: '14px 16px' }) }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: t.sub }}>AI Engine</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: GRN, fontWeight: 500 }}>
                                <StatusDot color={GRN} />Online
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: t.muted }}>Gemini 2.5 Flash Lite · &lt; 3s SLA</div>
                    </div>
                    {/* Stat rows */}
                    {stats.map(s => (
                        <div key={s.label} style={{ ...card_(isDark, { padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }) }}>
                            <span style={{ fontSize: 12, color: t.sub }}>{s.label}</span>
                            <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: QUALITY CONTROL
══════════════════════════════════════════════════════════════════════════ */
function SectionQuality({ metrics }: { metrics: any }) {
    const { isDark } = useTheme();
    const t = tok_(isDark);
    const score    = metrics?.avg_quality_score ?? 0;
    const passRate = metrics?.pass_rate ?? Math.round(score);

    const reportTypes = [
        { name: 'Course Report',       count: metrics?.report_types?.course_report ?? 0,         color: BLUE  },
        { name: 'Program Report',      count: metrics?.report_types?.program_report ?? 0,        color: PURP  },
        { name: 'Self Study',          count: metrics?.report_types?.self_study ?? 0,             color: TEAL  },
        { name: 'Exam Analysis',       count: metrics?.report_types?.exam_results_analysis ?? 0, color: AMB   },
        { name: 'Other',               count: metrics?.report_types?.other ?? 0,                 color: '#64748b' },
    ];
    const maxCount = Math.max(...reportTypes.map(r => r.count), 1);

    return (
        <section style={{ padding: '0 32px 32px' }}>
            <SectionLabel>Quality Control</SectionLabel>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 2fr', gap: 12 }}>
                {/* Metrics */}
                {[
                    { label: 'Reports Submitted', value: metrics?.total_reports ?? 0,   suffix: '',  color: BLUE },
                    { label: 'Avg Score',          value: score,                          suffix: '%', color: score >= 85 ? GRN : AMB },
                    { label: 'Pass Rate',          value: passRate,                       suffix: '%', color: passRate >= 85 ? GRN : AMB },
                    { label: 'Pending Review',     value: metrics?.pending_ai_evals ?? 0, suffix: '',  color: AMB  },
                ].map(m => (
                    <div key={m.label} style={{ ...card_(isDark, { padding: '16px 20px' }) }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 8 }}>{m.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: m.color, lineHeight: 1 }}>
                            <Counter val={m.value} suffix={m.suffix} />
                        </div>
                    </div>
                ))}

                {/* Report type distribution */}
                <div style={{ ...card_(isDark, { padding: '16px 20px' }) }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 14 }}>Report Types</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {reportTypes.map(r => (
                            <div key={r.name}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span style={{ fontSize: 11, color: t.sub }}>{r.name}</span>
                                    <span style={{ fontSize: 11, color: t.muted }}>{r.count}</span>
                                </div>
                                <ProgressBar pct={(r.count / maxCount) * 100} color={r.color} h={4} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: SECURITY CENTER
══════════════════════════════════════════════════════════════════════════ */
function SectionSecurity({ logs }: { logs: any[] }) {
    const { isDark } = useTheme();
    const t = tok_(isDark);

    const getColor = (action: string = '') => {
        const a = action.toLowerCase();
        if (a.includes('login'))  return BLUE;
        if (a.includes('create')) return GRN;
        if (a.includes('update') || a.includes('edit')) return AMB;
        if (a.includes('delete')) return RED;
        return t.muted as string;
    };

    return (
        <section style={{ padding: '0 32px 32px' }}>
            <SectionLabel>Security &amp; Audit Logs</SectionLabel>

            <div style={{ ...card_(isDark) }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Recent Events</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: GRN }}>
                        <StatusDot color={GRN} />
                        No active alerts
                    </div>
                </div>

                {logs.length === 0 ? (
                    <div style={{ padding: '36px 20px', textAlign: 'center', color: t.muted, fontSize: 13 }}>No audit events recorded.</div>
                ) : (
                    <>
                        {/* Table header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 90px 80px', padding: '8px 20px', borderBottom: `1px solid ${t.bord2}` }}>
                            {['Action', 'User', 'Organization', 'Time', 'Status'].map(h => (
                                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
                            ))}
                        </div>
                        {logs.slice(0, 12).map((log, i) => (
                            <div key={log.id ?? i} className="fd-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 90px 80px', padding: '11px 20px', borderBottom: i < Math.min(logs.length, 12) - 1 ? `1px solid ${t.bord2}` : 'none', alignItems: 'center', transition: 'background .12s' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: getColor(log.action), flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.action || '—'}</span>
                                </div>
                                <div style={{ fontSize: 12, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.user || '—'}</div>
                                <div style={{ fontSize: 12, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.entity_name || '—'}</div>
                                <div style={{ fontSize: 11, color: t.muted }}>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                                <div>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: log.status === 'success' ? `${GRN}12` : `${RED}12`, color: log.status === 'success' ? GRN : RED }}>
                                        {log.status === 'success' ? 'Success' : 'Failed'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: QUALITY FRAMEWORKS
══════════════════════════════════════════════════════════════════════════ */
function SectionFrameworks({ frameworks, editingId, editForm, setEditForm, onEdit, onSave, onCreate }: any) {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const t = tok_(isDark);

    return (
        <section style={{ padding: '0 32px 48px' }}>
            <SectionLabel>Quality Frameworks &amp; Quick Access</SectionLabel>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Frameworks table */}
                <div style={{ ...card_(isDark) }}>
                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Quality Frameworks</span>
                        <button type="button" onClick={onCreate}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = BLUE)}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = t.bord)}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            New Framework
                        </button>
                    </div>
                    {frameworks.length === 0 ? (
                        <div style={{ padding: '36px 20px', textAlign: 'center', color: t.muted, fontSize: 13 }}>No frameworks defined yet.</div>
                    ) : (
                        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            {frameworks.map((fw: any, i: number) => (
                                <div key={fw._id} style={{ padding: '12px 20px', borderBottom: i < frameworks.length - 1 ? `1px solid ${t.bord2}` : 'none' }}>
                                    {editingId === fw._id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                style={{ padding: '7px 10px', background: t.inbg, border: `1px solid ${t.inbd}`, borderRadius: 7, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} placeholder="Framework name" />
                                            <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={2}
                                                style={{ padding: '7px 10px', background: t.inbg, border: `1px solid ${t.inbd}`, borderRadius: 7, color: t.text, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} placeholder="Description" />
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.sub }}>
                                                    Pass threshold:
                                                    <input type="number" value={editForm.acceptance_threshold} onChange={e => setEditForm({ ...editForm, acceptance_threshold: +e.target.value })}
                                                        style={{ width: 52, padding: '5px 7px', background: t.inbg, border: `1px solid ${t.inbd}`, borderRadius: 6, color: t.text, fontSize: 12, outline: 'none', textAlign: 'center', fontFamily: 'inherit' }} />%
                                                </div>
                                                <button type="button" onClick={onSave} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: GRN, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fw.name}</div>
                                                <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Pass threshold: <span style={{ color: BLUE, fontWeight: 600 }}>{fw.acceptance_threshold}%</span></div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                                <span style={{ fontSize: 11, color: fw.is_active ? GRN : t.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: fw.is_active ? GRN : t.muted, display: 'inline-block' }} />
                                                    {fw.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                <button type="button" onClick={() => onEdit(fw)}
                                                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                                                    onMouseEnter={e => (e.currentTarget.style.borderColor = BLUE)}
                                                    onMouseLeave={e => (e.currentTarget.style.borderColor = t.bord)}>
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick access */}
                <div style={{ ...card_(isDark, { padding: '20px' }) }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 16 }}>Quick Access</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            { label: 'Manage IT Accounts',  desc: 'Create and manage IT staff accounts',   path: '/founder/accounts', color: BLUE  },
                            { label: 'Session Logs',         desc: 'View user activity across the platform', path: '/session-logs',      color: PURP  },
                            { label: 'System Configuration', desc: 'Platform-wide settings and controls',   path: '/configuration',    color: TEAL  },
                        ].map(a => (
                            <button key={a.label} type="button" onClick={() => navigate(a.path)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 9, border: `1px solid ${t.bord}`, background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: 'inherit' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${a.color}55`; e.currentTarget.style.background = `${a.color}06`; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.background = 'transparent'; }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{a.label}</div>
                                    <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{a.desc}</div>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════════════════ */
export default function FounderDashboard() {
    const { isDark } = useTheme();
    const bg = tok_(isDark).bg;

    const [frameworks,    setFrameworks]    = useState<any[]>([]);
    const [entities,      setEntities]      = useState<any[]>([]);
    const [metrics,       setMetrics]       = useState<any>(null);
    const [auditLogs,     setAuditLogs]     = useState<any[]>([]);
    const [loading,       setLoading]       = useState(true);
    const [editingId,     setEditingId]     = useState<string | null>(null);
    const [editForm,      setEditForm]      = useState<any>({});
    const [newEntityForm, setNewEntityForm] = useState({ name: '', description: '', frameworks: [] as string[], subscription_tier: 'Basic' });

    useEffect(() => {
        Promise.all([
            fetch(`${API}/frameworks`,         { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.ok ? r.json() : []),
            fetch(`${API}/entities`,           { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.ok ? r.json() : []),
            fetch(`${API}/founder/metrics`,    { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.ok ? r.json() : null),
            fetch(`${API}/founder/audit-logs`, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.ok ? r.json() : []),
        ]).then(([fw, ent, met, logs]) => {
            setFrameworks(fw ?? []);
            setEntities(ent ?? []);
            setMetrics(met);
            setAuditLogs(logs ?? []);
        }).finally(() => setLoading(false));
    }, []);

    const handleCreateFramework = async () => {
        const res = await fetch(`${API}/frameworks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
            body: JSON.stringify({ name: 'New Framework', description: '', ai_prompt_template: '', acceptance_threshold: 70 }),
        });
        if (!res.ok) return;
        const d = await res.json();
        setFrameworks(p => [...p, d]);
        setEditingId(d._id);
        setEditForm(d);
    };

    const handleUpdateFramework = async () => {
        const res = await fetch(`${API}/frameworks/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
            body: JSON.stringify(editForm),
        });
        if (!res.ok) return;
        const d = await res.json();
        setFrameworks(p => p.map(f => f._id === editingId ? d : f));
        setEditingId(null);
    };

    const handleCreateEntity = async () => {
        if (!newEntityForm.name) return;
        const res = await fetch(`${API}/entities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
            body: JSON.stringify({ name: newEntityForm.name, description: newEntityForm.description, quality_framework_ids: newEntityForm.frameworks, subscription_tier: newEntityForm.subscription_tier }),
        });
        if (!res.ok) return;
        const d = await res.json();
        setEntities(p => [...p, d]);
        setNewEntityForm({ name: '', description: '', frameworks: [], subscription_tier: 'Basic' });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', minHeight: '100vh', background: bg, transition: 'background .2s' }}>
                <Sidebar />
                <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2.5px solid ${isDark ? 'rgba(29,110,245,.2)' : 'rgba(29,110,245,.15)'}`, borderTopColor: BLUE, animation: 'fdSpin 1s linear infinite' }} />
                    <span style={{ fontSize: 13, color: tok_(isDark).muted }}>Loading…</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: bg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s' }}>
            <Sidebar />

            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', transition: 'margin .2s', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <TopBar metrics={metrics} />

                <main style={{ flex: 1, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
                    <SectionOverview   metrics={metrics} />
                    <Div />
                    <div style={{ height: 32 }} />
                    <SectionRevenue    metrics={metrics} />
                    <Div />
                    <div style={{ height: 32 }} />
                    <SectionOrgs
                        entities={entities}
                        newForm={newEntityForm}
                        setNewForm={setNewEntityForm}
                        onCreate={handleCreateEntity}
                    />
                    <Div />
                    <div style={{ height: 32 }} />
                    <SectionQuality    metrics={metrics} />
                    <Div />
                    <div style={{ height: 32 }} />
                    <SectionAI         metrics={metrics} />
                    <Div />
                    <div style={{ height: 32 }} />
                    <SectionSecurity   logs={auditLogs} />
                    <Div />
                    <div style={{ height: 32 }} />
                    <SectionFrameworks
                        frameworks={frameworks}
                        editingId={editingId}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        onEdit={(fw: any) => { setEditingId(fw._id); setEditForm(fw); }}
                        onSave={handleUpdateFramework}
                        onCreate={handleCreateFramework}
                    />
                </main>
            </div>
        </div>
    );
}
