import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const BLUE  = '#1d6ef5';
const GRN   = '#10b981';
const RED   = '#ef4444';
const AMB   = '#f59e0b';
const PURP  = '#8b5cf6';
const TEAL  = '#06b6d4';

/* ── Theme tokens ──────────────────────────────────────────────────────────── */
const T = (d: boolean) => ({
    bg:    d ? '#0a0c14' : '#f5f6fa',
    surf:  d ? '#111420' : '#ffffff',
    surf2: d ? '#171b2e' : '#f8f9fc',
    bord:  d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)',
    bord2: d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)',
    text:  d ? '#f1f4f9' : '#0f172a',
    sub:   d ? 'rgba(255,255,255,.55)' : '#475569',
    muted: d ? 'rgba(255,255,255,.32)' : '#94a3b8',
    hover: d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
    inbg:  d ? 'rgba(255,255,255,.04)' : '#f8fafc',
    inbd:  d ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)',
    nav:   d ? '#0d1020' : '#ffffff',
    navbd: d ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)',
    mbg:   d ? '#0f1220' : '#ffffff',
    mbord: d ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.09)',
    shadow:d ? '0 20px 60px rgba(0,0,0,.65)' : '0 12px 40px rgba(0,0,0,.12)',
});

type NavSection =
    | 'dashboard' | 'users' | 'roles'
    | 'security' | 'sessions' | 'audit' | 'credentials' | 'health' | 'settings' | 'profile';

/* ── Auth header ───────────────────────────────────────────────────────────── */
const ah = (extra: Record<string, string> = {}) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'X-User-Id': localStorage.getItem('userId') ?? '',
    ...extra,
});

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function relTime(iso?: string | null) {
    if (!iso) return '—';
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.round(d / 60000);
    if (m < 1)   return 'Just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.round(d / 3600000);
    if (h < 24)  return `${h}h ago`;
    const dy = Math.round(d / 86400000);
    if (dy < 7)  return `${dy}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDate(iso?: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(iso?: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
}
function avatarBg(name: string) {
    const hue = ((name.charCodeAt(0) ?? 0) * 47 + (name.charCodeAt(1) ?? 0) * 13) % 360;
    return `linear-gradient(135deg, hsl(${hue},58%,44%), hsl(${hue + 35},50%,34%))`;
}

/* ── Role config ───────────────────────────────────────────────────────────── */
const ROLE_CFG: Record<string, { label: string; color: string; desc: string; perms: string[] }> = {
    founder:         { label: 'Founder',         color: AMB,  desc: 'Full platform ownership and control',         perms: ['All permissions', 'IT account management', 'System configuration'] },
    it_staff:        { label: 'IT Staff',         color: TEAL, desc: 'Platform operations and user management',     perms: ['User management', 'Session control', 'Audit logs', 'System health'] },
    admin:           { label: 'Admin',            color: BLUE, desc: 'Workspace administration and oversight',      perms: ['Project management', 'Team management', 'Reports', 'Configuration'] },
    sub_admin:       { label: 'Sub Admin',        color: PURP, desc: 'Sub-workspace management and task oversight', perms: ['Team oversight', 'Task boards', 'Project reports'] },
    manager:         { label: 'Manager',          color: '#0ea5e9', desc: 'Team and project management',            perms: ['Team management', 'Project access', 'QC reports'] },
    quality_control: { label: 'Quality Control',  color: GRN,  desc: 'AI quality evaluation and standards',        perms: ['Quality standards', 'AI evaluations', 'Reports'] },
    staff:           { label: 'Staff',            color: '#64748b', desc: 'Standard workspace member',             perms: ['Task access', 'Project view', 'Calendar'] },
};

/* ── Avatar ────────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 32 }: { name: string; size?: number }) {
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: avatarBg(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .34), fontWeight: 700, color: 'white', userSelect: 'none', letterSpacing: '-.01em' }}>
            {initials(name)}
        </div>
    );
}

/* ── Status badge ──────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
    const { isDark } = useTheme();
    const map: Record<string, [string, string]> = {
        active:    [GRN,  `${GRN}14`],
        inactive:  ['#64748b', 'rgba(100,116,139,.12)'],
        suspended: [RED,  `${RED}12`],
    };
    const [c, bg] = map[status?.toLowerCase()] ?? map.inactive;
    return (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: bg, color: c }}>
            {status?.charAt(0).toUpperCase() + (status?.slice(1) ?? '')}
        </span>
    );
}

/* ── Role badge ────────────────────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
    const cfg = ROLE_CFG[role] ?? { label: role, color: '#64748b' };
    return (
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: `${cfg.color}14`, color: cfg.color, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
            {cfg.label}
        </span>
    );
}

/* ── Stat card ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color = BLUE, isDark }: { label: string; value: string | number; sub?: string; color?: string; isDark: boolean }) {
    const t = T(isDark);
    return (
        <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: t.muted }}>{label}</span>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: t.text, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

/* ── Progress bar ──────────────────────────────────────────────────────────── */
function PBar({ pct, color, isDark }: { pct: number; color: string; isDark: boolean }) {
    return (
        <div style={{ height: 4, borderRadius: 4, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width .8s ease' }} />
        </div>
    );
}

/* ── Section header ────────────────────────────────────────────────────────── */
function SecTitle({ title, sub, action, isDark }: { title: string; sub?: string; action?: React.ReactNode; isDark: boolean }) {
    const t = T(isDark);
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: '-.02em', marginBottom: sub ? 3 : 0 }}>{title}</h2>
                {sub && <p style={{ fontSize: 13, color: t.muted }}>{sub}</p>}
            </div>
            {action}
        </div>
    );
}

/* ── Table shell ───────────────────────────────────────────────────────────── */
function TableHead({ cols, isDark }: { cols: string[]; isDark: boolean }) {
    const t = T(isDark);
    return (
        <div style={{ display: 'grid', gridTemplateColumns: cols.map(() => '1fr').join(' '), padding: '8px 16px', borderBottom: `1px solid ${t.bord}`, background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', borderRadius: '10px 10px 0 0' }}>
            {cols.map(c => (
                <div key={c} style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{c}</div>
            ))}
        </div>
    );
}

/* ── Modal shell ───────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children, isDark, wide }: { title: string; onClose: () => void; children: React.ReactNode; isDark: boolean; wide?: boolean }) {
    const t = T(isDark);
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)' }} />
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: wide ? 680 : 480, maxHeight: '90vh', overflowY: 'auto', background: t.mbg, border: `1px solid ${t.mbord}`, borderRadius: 14, boxShadow: t.shadow, animation: 'itSlide .18s ease-out both', fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif' }}>
                <div style={{ padding: '16px 22px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{title}</span>
                    <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: t.hover, border: `1px solid ${t.bord}`, cursor: 'pointer', color: t.muted, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: '18px 22px' }}>{children}</div>
            </div>
        </div>
    );
}

/* ── Form field ────────────────────────────────────────────────────────────── */
function Field({ label, isDark, children }: { label: string; isDark: boolean; children: React.ReactNode }) {
    const t = T(isDark);
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.sub, marginBottom: 5 }}>{label}</label>
            {children}
        </div>
    );
}
function fld(t: ReturnType<typeof T>): React.CSSProperties {
    return { width: '100%', padding: '8px 11px', background: t.inbg, border: `1.5px solid ${t.inbd}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', transition: 'border-color .15s' };
}

/* ── Error / Success banner ────────────────────────────────────────────────── */
function Err({ msg }: { msg: string }) {
    return <div style={{ padding: '9px 12px', background: `${RED}08`, border: `1px solid ${RED}20`, borderRadius: 8, fontSize: 12, color: RED }}>{msg}</div>;
}

/* ── Confirm dialog ────────────────────────────────────────────────────────── */
function ConfirmModal({ title, body, confirm, danger = true, onConfirm, onClose, loading, isDark }: {
    title: string; body: string; confirm: string; danger?: boolean;
    onConfirm: () => void; onClose: () => void; loading: boolean; isDark: boolean;
}) {
    const t = T(isDark);
    return (
        <Modal title={title} onClose={onClose} isDark={isDark}>
            <p style={{ fontSize: 14, color: t.sub, lineHeight: 1.6, marginBottom: 20 }}>{body}</p>
            <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={onClose}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                </button>
                <button type="button" onClick={onConfirm} disabled={loading}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: loading ? `${danger ? RED : BLUE}55` : (danger ? RED : BLUE), color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {loading ? 'Working…' : confirm}
                </button>
            </div>
        </Modal>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   CREATE USER MODAL
══════════════════════════════════════════════════════════════════════════ */
function CreateUserModal({ onClose, onCreated, isDark }: { onClose: () => void; onCreated: () => void; isDark: boolean }) {
    const t = T(isDark);
    const f = fld(t);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', status: 'active' });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/auth/register`, { method: 'POST', headers: ah(), body: JSON.stringify({ full_name: form.name, email: form.email, password: form.password, role: form.role, status: form.status }) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed to create user'); }
            onCreated(); onClose();
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    };

    const ROLES = ['staff', 'manager', 'sub_admin', 'admin', 'quality_control', 'it_staff'];

    return (
        <Modal title="Create User Account" onClose={onClose} isDark={isDark}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Full name *" isDark={isDark}>
                        <input value={form.name} onChange={set('name')} required placeholder="e.g. Sara Ahmad" style={f}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </Field>
                    <Field label="Email address *" isDark={isDark}>
                        <input type="email" value={form.email} onChange={set('email')} required placeholder="sara@example.com" style={f}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </Field>
                </div>
                <Field label="Password *" isDark={isDark}>
                    <input type="password" value={form.password} onChange={set('password')} required placeholder="Minimum 8 characters" style={f}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Role" isDark={isDark}>
                        <select value={form.role} onChange={set('role')} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_CFG[r]?.label ?? r}</option>)}
                        </select>
                    </Field>
                    <Field label="Initial status" isDark={isDark}>
                        <select value={form.status} onChange={set('status')} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </Field>
                </div>
                {err && <Err msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={onClose}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="submit" disabled={loading || !form.name || !form.email || form.password.length < 8}
                        style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: (!form.name || !form.email || form.password.length < 8 || loading) ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: (loading || !form.name || !form.email || form.password.length < 8) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {loading ? 'Creating…' : 'Create Account'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* ── Edit user modal ───────────────────────────────────────────────────────── */
function EditUserModal({ user, onClose, onSaved, isDark }: { user: any; onClose: () => void; onSaved: () => void; isDark: boolean }) {
    const t = T(isDark);
    const f = fld(t);
    const currentPwd = user.plain_password || '';
    const [form, setForm] = useState({ name: user.name || '', role: user.role || 'staff', status: user.status || 'active', newPassword: currentPwd });
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

    const pwdChanged = form.newPassword !== currentPwd && form.newPassword.trim().length > 0;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/users/${user._id}`, {
                method: 'PATCH', headers: ah(),
                body: JSON.stringify({ name: form.name, role: form.role, status: form.status }),
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }

            if (pwdChanged) {
                if (form.newPassword.length < 8) throw new Error('Password must be at least 8 characters');
                const pr = await fetch(`${API}/auth/change-password`, {
                    method: 'POST', headers: ah(),
                    body: JSON.stringify({ user_id: user._id, new_password: form.newPassword }),
                });
                if (!pr.ok) { const d = await pr.json(); throw new Error(d.detail || 'Password update failed'); }
            }

            onSaved(); onClose();
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    };

    const ROLES = ['staff', 'manager', 'sub_admin', 'admin', 'quality_control', 'it_staff'];

    return (
        <Modal title="Edit Account" onClose={onClose} isDark={isDark}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Name */}
                <Field label="Full name" isDark={isDark}>
                    <input value={form.name} onChange={set('name')} style={f}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </Field>

                {/* Role + Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Role" isDark={isDark}>
                        <select value={form.role} onChange={set('role')} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_CFG[r]?.label ?? r}</option>)}
                        </select>
                    </Field>
                    <Field label="Status" isDark={isDark}>
                        <select value={form.status} onChange={set('status')} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </Field>
                </div>

                {/* Password */}
                <div style={{ borderTop: `1px solid ${t.bord}`, paddingTop: 14 }}>
                    <Field label="Password" isDark={isDark}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPwd ? 'text' : 'password'}
                                value={form.newPassword}
                                onChange={set('newPassword')}
                                placeholder="Type new password…"
                                style={{ ...f, paddingRight: 40, borderColor: pwdChanged ? AMB : t.inbd }}
                                onFocus={e => (e.currentTarget.style.borderColor = pwdChanged ? AMB : BLUE)}
                                onBlur={e => (e.currentTarget.style.borderColor = pwdChanged ? AMB : t.inbd)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPwd(p => !p)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.muted, padding: 0, display: 'flex', alignItems: 'center' }}
                                title={showPwd ? 'Hide' : 'Show'}>
                                {showPwd
                                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                }
                            </button>
                        </div>
                        {pwdChanged && (
                            <div style={{ fontSize: 11, color: AMB, marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                Password will be updated on save
                            </div>
                        )}
                        {pwdChanged && form.newPassword.length < 8 && (
                            <div style={{ fontSize: 11, color: RED, marginTop: 3 }}>Minimum 8 characters</div>
                        )}
                    </Field>
                </div>

                {err && <Err msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={onClose}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="submit" disabled={loading}
                        style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: loading ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* ── Reset password modal ──────────────────────────────────────────────────── */
function ResetPwdModal({ user, onClose, isDark }: { user: any; onClose: () => void; isDark: boolean }) {
    const t = T(isDark);
    const f = fld(t);
    const [pwd, setPwd] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [done, setDone] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/auth/change-password`, { method: 'POST', headers: ah(), body: JSON.stringify({ user_id: user._id, new_password: pwd }) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
            setDone(true); setTimeout(onClose, 1600);
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    };

    if (done) return (
        <Modal title="Reset Password" onClose={onClose} isDark={isDark}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${GRN}14`, border: `1px solid ${GRN}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T(isDark).text }}>Password reset for {user.name}</div>
            </div>
        </Modal>
    );

    return (
        <Modal title={`Reset Password — ${user.name}`} onClose={onClose} isDark={isDark}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="New password" isDark={isDark}>
                    <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required placeholder="Minimum 8 characters" style={f}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </Field>
                {err && <Err msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={onClose}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="submit" disabled={loading || pwd.length < 8}
                        style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: (loading || pwd.length < 8) ? `${AMB}50` : AMB, color: 'white', fontSize: 13, fontWeight: 600, cursor: (loading || pwd.length < 8) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {loading ? 'Resetting…' : 'Reset Password'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* ── User action dropdown ──────────────────────────────────────────────────── */
function UserActions({ user, onEdit, onReset, onToggle, onDelete, isDark }: {
    user: any; onEdit: () => void; onReset: () => void;
    onToggle: () => void; onDelete: () => void; isDark: boolean;
}) {
    const t = T(isDark);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);

    const item = (label: string, ico: React.ReactNode, fn: () => void, danger = false) => (
        <button key={label} type="button" onClick={() => { fn(); setOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: danger ? RED : t.text, fontSize: 13, fontWeight: 400, textAlign: 'left', borderRadius: 7, fontFamily: 'inherit', transition: 'background .1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = danger ? `${RED}08` : t.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {ico}{label}
        </button>
    );

    const isSuspended = user.status === 'suspended';

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setOpen(p => !p)}
                style={{ width: 28, height: 28, borderRadius: 6, background: open ? t.hover : 'transparent', border: `1px solid ${open ? t.bord : 'transparent'}`, cursor: 'pointer', color: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {open && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', width: 196, background: t.mbg, border: `1px solid ${t.mbord}`, borderRadius: 10, boxShadow: t.shadow, zIndex: 500, padding: '4px', animation: 'itSlide .14s ease-out both' }}>
                    {item('Edit account',  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, onEdit)}
                    {item('Reset password', <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>, onReset)}
                    {item(isSuspended ? 'Enable account' : 'Disable account',
                        isSuspended
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
                        onToggle, !isSuspended
                    )}
                    <div style={{ height: 1, background: t.bord2, margin: '3px 6px' }} />
                    {item('Delete account', <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>, onDelete, true)}
                </div>
            )}
        </div>
    );
}

/* ── Toast ─────────────────────────────────────────────────────────────────── */
function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
    useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [msg]);
    return (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 900, padding: '11px 18px', borderRadius: 10, background: ok ? GRN : RED, color: 'white', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)', animation: 'itSlide .2s ease-out both' }}>
            {msg}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: DASHBOARD
══════════════════════════════════════════════════════════════════════════ */
function SecDashboard({ health, users, sessions, audit, isDark }: { health: any; users: any[]; sessions: any[]; audit: any[]; isDark: boolean }) {
    const t = T(isDark);
    const activeCount    = users.filter(u => u.status !== 'suspended').length;
    const suspendedCount = users.filter(u => u.status === 'suspended').length;
    const roleDist       = Object.entries(
        users.reduce<Record<string, number>>((acc, u) => { acc[u.role] = (acc[u.role] ?? 0) + 1; return acc; }, {})
    ).sort((a, b) => b[1] - a[1]);
    const maxRole        = roleDist[0]?.[1] ?? 1;

    const getAuditColor = (type: string) => {
        const t = type?.toUpperCase();
        if (t === 'CREATE' || t === 'LOGIN') return GRN;
        if (t === 'DELETE') return RED;
        if (t === 'UPDATE') return AMB;
        if (t === 'LOGOUT') return TEAL;
        return BLUE;
    };

    const isConnected = health?.status === 'connected';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Stats row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <StatCard label="Total Users"     value={users.length}                              sub="All accounts"        color={BLUE} isDark={isDark} />
                <StatCard label="Active"          value={activeCount}                               sub="Non-suspended"       color={GRN}  isDark={isDark} />
                <StatCard label="Active Sessions" value={health?.active_sessions ?? sessions.length} sub="Currently online"    color={TEAL} isDark={isDark} />
                <StatCard label="Suspended"       value={suspendedCount}                            sub="Restricted accounts" color={RED}  isDark={isDark} />
            </div>

            {/* ── Main body: Recent Activity (left) + Right panel (stacked) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 14, alignItems: 'start' }}>

                {/* Recent Activity — prominent left column */}
                <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '13px 18px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Recent Activity</span>
                        {audit.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: `${BLUE}12`, color: BLUE }}>{audit.length} events</span>
                        )}
                    </div>
                    {audit.length === 0 ? (
                        <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: 13, color: t.muted }}>No audit events recorded.</div>
                    ) : audit.slice(0, 12).map((log: any, i: number) => {
                        const c = getAuditColor(log.action_type);
                        return (
                            <div key={log._id ?? i}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: i < Math.min(audit.length, 12) - 1 ? `1px solid ${t.bord2}` : 'none', transition: 'background .1s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${c}14`, color: c, flexShrink: 0, minWidth: 52, textAlign: 'center' }}>
                                    {log.action_type}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 13, color: t.text }}>{log.entity_type}</span>
                                    {log.user_name && (
                                        <span style={{ fontSize: 12, color: t.muted }}> · {log.user_name}</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{relTime(log.timestamp)}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Right column: System Health + Role Distribution stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* System Health */}
                    <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '13px 18px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>System Health</span>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isConnected ? GRN : AMB, boxShadow: `0 0 6px ${isConnected ? GRN : AMB}` }} />
                        </div>
                        {[
                            { label: 'API Gateway',  status: isConnected ? 'Operational' : 'Unknown',   color: isConnected ? GRN : AMB },
                            { label: 'Database',     status: isConnected ? 'Connected'   : 'Unknown',   color: isConnected ? GRN : AMB },
                            { label: 'Maintenance',  status: health?.maintenance_mode ? 'Active' : 'Off', color: health?.maintenance_mode ? AMB : GRN },
                            { label: 'Storage',      status: health?.storage_usage_mb ? `${health.storage_usage_mb} MB` : '—', color: t.muted as string },
                        ].map((s, idx, arr) => (
                            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 18px', borderBottom: idx < arr.length - 1 ? `1px solid ${t.bord2}` : 'none' }}>
                                <span style={{ fontSize: 12, color: t.sub }}>{s.label}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: s.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    {s.color !== t.muted && <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />}
                                    {s.status}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Role Distribution */}
                    <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '13px 18px', borderBottom: `1px solid ${t.bord}` }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Role Distribution</span>
                        </div>
                        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                            {roleDist.slice(0, 6).map(([role, count]) => {
                                const cfg = ROLE_CFG[role];
                                return (
                                    <div key={role}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                            <span style={{ fontSize: 12, color: t.sub, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg?.color ?? '#64748b', flexShrink: 0 }} />
                                                {cfg?.label ?? role}
                                            </span>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{count}</span>
                                        </div>
                                        <PBar pct={(count / maxRole) * 100} color={cfg?.color ?? '#64748b'} isDark={isDark} />
                                    </div>
                                );
                            })}
                            {roleDist.length === 0 && (
                                <div style={{ textAlign: 'center', fontSize: 12, color: t.muted, padding: '12px 0' }}>No users yet.</div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: USERS
══════════════════════════════════════════════════════════════════════════ */
function SecUsers({ users, loading, onRefresh, isDark, initialRoleFilter = '' }: { users: any[]; loading: boolean; onRefresh: () => void; isDark: boolean; initialRoleFilter?: string }) {
    const t = T(isDark);
    const [search, setSearch]       = useState('');
    const [roleF, setRoleF]         = useState(initialRoleFilter);
    const [statusF, setStatusF]     = useState('');

    useEffect(() => { if (initialRoleFilter) { setRoleF(initialRoleFilter); setPage(1); } }, [initialRoleFilter]);
    const [page, setPage]           = useState(1);
    const [editUser, setEditUser]   = useState<any>(null);
    const [resetUser, setResetUser] = useState<any>(null);
    const [deleteUser, setDeleteUser] = useState<any>(null);
    const [toggling, setToggling]   = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [delLoading, setDelLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
    const PAGE_SIZE = 20;

    const filtered = useMemo(() => {
        return users.filter(u => {
            if (roleF && u.role !== roleF) return false;
            if (statusF && (u.status ?? 'active') !== statusF) return false;
            if (search) {
                const q = search.toLowerCase();
                if (!(u.name ?? '').toLowerCase().includes(q) && !(u.email ?? '').toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [users, search, roleF, statusF]);

    const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
    const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleToggle = async (user: any) => {
        const isSuspended = user.status === 'suspended';
        setToggling(user._id);
        try {
            if (!isSuspended) {
                await fetch(`${API}/system/force-logout/${user._id}`, { method: 'POST', headers: ah() });
            } else {
                await fetch(`${API}/users/${user._id}`, { method: 'PATCH', headers: ah(), body: JSON.stringify({ status: 'active' }) });
            }
            onRefresh();
            setToast({ msg: isSuspended ? 'Account enabled' : 'Account disabled', ok: true });
        } catch { setToast({ msg: 'Action failed', ok: false }); } finally { setToggling(null); }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        setDelLoading(true);
        try {
            const r = await fetch(`${API}/users/${deleteUser._id}`, { method: 'DELETE', headers: ah() });
            if (!r.ok && r.status !== 204) { const d = await r.json(); throw new Error(d.detail); }
            onRefresh();
            setDeleteUser(null);
            setToast({ msg: 'Account deleted', ok: true });
        } catch (e: any) { setToast({ msg: e.message, ok: false }); } finally { setDelLoading(false); }
    };

    const f = fld(t);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SecTitle title="User Management" sub={`${users.length} total accounts`} isDark={isDark}
                action={
                    <button type="button" onClick={() => setShowCreate(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(29,110,245,.25)', whiteSpace: 'nowrap' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Create Account
                    </button>
                }
            />

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: t.muted }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or email…"
                        style={{ ...f, paddingLeft: 30 }}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </div>
                <select value={roleF} onChange={e => { setRoleF(e.target.value); setPage(1); }} style={{ ...f, width: 140, background: isDark ? '#0f1220' : '#fff' }}>
                    <option value="">All roles</option>
                    {Object.entries(ROLE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }} style={{ ...f, width: 130, background: isDark ? '#0f1220' : '#fff' }}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                </select>
                <span style={{ fontSize: 12, color: t.muted, whiteSpace: 'nowrap' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Table */}
            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 80px 100px 100px 40px', padding: '9px 16px', borderBottom: `1px solid ${t.bord}`, background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', borderRadius: '10px 10px 0 0' }}>
                    {['User', 'Role', 'Status', 'Last Login', 'Created', ''].map(h => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
                    ))}
                </div>

                {loading ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: t.muted, fontSize: 13 }}>Loading users…</div>
                ) : slice.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <svg width="44" height="44" viewBox="0 0 52 52" fill="none" style={{ display: 'block', margin: '0 auto 14px', opacity: .3 }}>
                            <circle cx="26" cy="20" r="10" stroke={t.muted} strokeWidth="1.5"/>
                            <path d="M8 46c0-9.94 8.059-18 18-18s18 8.06 18 18" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.sub, marginBottom: 4 }}>No users found</div>
                        <div style={{ fontSize: 13, color: t.muted }}>Try adjusting your filters.</div>
                    </div>
                ) : slice.map((u, i) => (
                    <div key={u._id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 80px 100px 100px 40px', padding: '11px 16px', borderBottom: i < slice.length - 1 ? `1px solid ${t.bord2}` : 'none', alignItems: 'center', transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.hover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <Avatar name={u.name || u.email || 'U'} size={30} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unnamed'}</div>
                                <div style={{ fontSize: 11, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                            </div>
                        </div>
                        <RoleBadge role={u.role} />
                        <div>
                            {toggling === u._id
                                ? <span style={{ fontSize: 11, color: t.muted }}>…</span>
                                : <StatusBadge status={u.status ?? 'active'} />}
                        </div>
                        <div style={{ fontSize: 12, color: t.muted }}>{relTime(u.last_seen)}</div>
                        <div style={{ fontSize: 12, color: t.muted }}>{fmtDate(u.created_at)}</div>
                        <UserActions user={u} isDark={isDark}
                            onEdit={() => setEditUser(u)}
                            onReset={() => setResetUser(u)}
                            onToggle={() => handleToggle(u)}
                            onDelete={() => setDeleteUser(u)}
                        />
                    </div>
                ))}

                {/* Pagination */}
                {filtered.length > PAGE_SIZE && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${t.bord}` }}>
                        <span style={{ fontSize: 12, color: t.muted }}>
                            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button type="button" onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
                                style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: page === 1 ? t.muted : t.sub, cursor: page === 1 ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: page === 1 ? .5 : 1 }}>← Prev</button>
                            <button type="button" onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages}
                                style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: page === totalPages ? t.muted : t.sub, cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: page === totalPages ? .5 : 1 }}>Next →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { onRefresh(); setToast({ msg: 'Account created', ok: true }); }} isDark={isDark} />}
            {editUser  && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { onRefresh(); setToast({ msg: 'Account updated', ok: true }); }} isDark={isDark} />}
            {resetUser && <ResetPwdModal user={resetUser} onClose={() => setResetUser(null)} isDark={isDark} />}
            {deleteUser && <ConfirmModal title="Delete Account" body={`Permanently delete ${deleteUser.name} (${deleteUser.email})? This cannot be undone.`} confirm="Delete" danger onConfirm={handleDelete} onClose={() => setDeleteUser(null)} loading={delLoading} isDark={isDark} />}
            {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: ROLES
══════════════════════════════════════════════════════════════════════════ */
function SecRoles({ users, isDark, onSelectRole }: { users: any[]; isDark: boolean; onSelectRole: (role: string) => void }) {
    const t = T(isDark);
    const counts = users.reduce<Record<string, number>>((acc, u) => { acc[u.role] = (acc[u.role] ?? 0) + 1; return acc; }, {});

    return (
        <div>
            <SecTitle title="Roles & Permissions" sub="Click a role to view its accounts" isDark={isDark} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {Object.entries(ROLE_CFG).map(([key, cfg]) => {
                    const count = counts[key] ?? 0;
                    return (
                        <div key={key}
                            onClick={() => onSelectRole(key)}
                            style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '18px 20px', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s', position: 'relative' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.color + '55'; e.currentTarget.style.boxShadow = `0 0 0 1px ${cfg.color}22`; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.boxShadow = 'none'; }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 9, background: `${cfg.color}14`, border: `1px solid ${cfg.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'block' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{cfg.label}</div>
                                        <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{count} user{count !== 1 ? 's' : ''}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: `${cfg.color}12`, color: cfg.color }}>
                                        {key}
                                    </span>
                                    {count > 0 && (
                                        <span style={{ fontSize: 10, color: t.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p style={{ fontSize: 12, color: t.sub, marginBottom: 12, lineHeight: 1.55 }}>{cfg.desc}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {cfg.perms.map(p => (
                                    <span key={p} style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 5, background: t.surf2, border: `1px solid ${t.bord}`, color: t.sub }}>{p}</span>
                                ))}
                            </div>
                            {count === 0 && (
                                <div style={{ marginTop: 10, fontSize: 11, color: t.muted, fontStyle: 'italic' }}>No accounts assigned</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: SESSIONS
══════════════════════════════════════════════════════════════════════════ */
function SecSessions({ sessions, loading, onRefresh, isDark }: { sessions: any[]; loading: boolean; onRefresh: () => void; isDark: boolean }) {
    const t = T(isDark);
    const [terminating, setTerminating] = useState<string | null>(null);
    const [terminatingAll, setTerminatingAll] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const terminate = async (userId: string) => {
        setTerminating(userId);
        try {
            await fetch(`${API}/system/force-logout/${userId}`, { method: 'POST', headers: ah() });
            onRefresh();
            setToast({ msg: 'Session terminated', ok: true });
        } catch { setToast({ msg: 'Failed', ok: false }); } finally { setTerminating(null); }
    };

    const terminateAll = async () => {
        if (!confirm('Terminate all active sessions and enable maintenance mode?')) return;
        setTerminatingAll(true);
        try {
            await fetch(`${API}/system/logout-all`, { method: 'POST', headers: ah() });
            onRefresh();
            setToast({ msg: 'All sessions terminated', ok: true });
        } catch { setToast({ msg: 'Failed', ok: false }); } finally { setTerminatingAll(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SecTitle title="Active Sessions" sub={`${sessions.length} sessions recorded`} isDark={isDark}
                action={
                    <button type="button" onClick={terminateAll} disabled={terminatingAll}
                        style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: RED, fontSize: 13, fontWeight: 500, cursor: terminatingAll ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${RED}08`; e.currentTarget.style.borderColor = `${RED}55`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.bord; }}>
                        {terminatingAll ? 'Terminating…' : 'Terminate All'}
                    </button>
                }
            />

            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px 80px', padding: '9px 16px', borderBottom: `1px solid ${t.bord}`, background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', borderRadius: '10px 10px 0 0' }}>
                    {['User', 'Login Time', 'Duration', 'Last Active', ''].map(h => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
                    ))}
                </div>
                {loading ? (
                    <div style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: t.muted }}>Loading sessions…</div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: t.muted }}>No sessions recorded.</div>
                ) : sessions.map((s: any, i: number) => (
                    <div key={s._id ?? i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px 80px', padding: '11px 16px', borderBottom: i < sessions.length - 1 ? `1px solid ${t.bord2}` : 'none', alignItems: 'center', transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.hover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || 'Unknown'}</div>
                            <div style={{ fontSize: 11, color: t.muted }}>{s.email}</div>
                        </div>
                        <div style={{ fontSize: 12, color: t.sub }}>{fmtDateTime(s.login_time)}</div>
                        <div style={{ fontSize: 12, color: t.sub }}>{s.duration_minutes != null ? `${s.duration_minutes}m` : '—'}</div>
                        <div style={{ fontSize: 12, color: t.muted }}>{relTime(s.last_active)}</div>
                        <button type="button" onClick={() => terminate(s.user_id)} disabled={terminating === s.user_id}
                            style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: RED, fontSize: 11, cursor: terminating === s.user_id ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all .12s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${RED}08`; e.currentTarget.style.borderColor = `${RED}55`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.bord; }}>
                            {terminating === s.user_id ? '…' : 'End'}
                        </button>
                    </div>
                ))}
            </div>
            {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: AUDIT LOGS
══════════════════════════════════════════════════════════════════════════ */
function SecAudit({ audit, loading, isDark }: { audit: any[]; loading: boolean; isDark: boolean }) {
    const t = T(isDark);
    const [filter, setFilter] = useState('');
    const ACTION_COLORS: Record<string, string> = { CREATE: GRN, LOGIN: TEAL, UPDATE: AMB, DELETE: RED, LOGOUT: '#64748b' };
    const filtered = filter ? audit.filter(l => l.action_type === filter) : audit;
    const types = [...new Set(audit.map(l => l.action_type).filter(Boolean))];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SecTitle title="Audit Logs" sub={`${audit.length} events recorded`} isDark={isDark} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setFilter('')}
                    style={{ padding: '5px 14px', borderRadius: 7, border: `1px solid ${filter === '' ? BLUE : t.bord}`, background: filter === '' ? `${BLUE}12` : 'transparent', color: filter === '' ? BLUE : t.sub, fontSize: 12, fontWeight: filter === '' ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                    All
                </button>
                {types.map(type => (
                    <button key={type} type="button" onClick={() => setFilter(type)}
                        style={{ padding: '5px 14px', borderRadius: 7, border: `1px solid ${filter === type ? (ACTION_COLORS[type] ?? BLUE) : t.bord}`, background: filter === type ? `${ACTION_COLORS[type] ?? BLUE}12` : 'transparent', color: filter === type ? (ACTION_COLORS[type] ?? BLUE) : t.sub, fontSize: 12, fontWeight: filter === type ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                        {type}
                    </button>
                ))}
            </div>

            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '20px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', color: t.muted, fontSize: 13, padding: '24px 0' }}>Loading…</div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', color: t.muted, fontSize: 13, padding: '24px 0' }}>No events.</div>
                ) : (
                    <div style={{ position: 'relative', paddingLeft: 32 }}>
                        <div style={{ position: 'absolute', left: 10, top: 8, bottom: 8, width: 1.5, background: `linear-gradient(to bottom, ${BLUE}40, transparent)` }} />
                        {filtered.slice(0, 50).map((log: any, i: number) => {
                            const c = ACTION_COLORS[log.action_type] ?? BLUE;
                            return (
                                <div key={log._id ?? i} style={{ position: 'relative', marginBottom: 18 }}>
                                    <div style={{ position: 'absolute', left: -26, top: 4, width: 12, height: 12, borderRadius: '50%', background: `${c}18`, border: `2px solid ${c}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
                                    </div>
                                    <div style={{ background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', border: `1px solid ${t.bord2}`, borderRadius: 8, padding: '10px 14px' }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = t.bord)} onMouseLeave={e => (e.currentTarget.style.borderColor = t.bord2)}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${c}14`, color: c }}>{log.action_type}</span>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{log.entity_type}</span>
                                            </div>
                                            <span style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{fmtDateTime(log.timestamp)}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: t.sub }}>
                                            {log.user_name && <span>by {log.user_name}</span>}
                                            {log.entity_id && <span style={{ color: t.muted }}> · {log.entity_id.slice(0, 12)}…</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: SYSTEM HEALTH
══════════════════════════════════════════════════════════════════════════ */
function SecHealth({ health, onRefresh, isDark }: { health: any; onRefresh: () => void; isDark: boolean }) {
    const t = T(isDark);
    const isConnected = health?.status === 'connected';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle title="System Health" sub="Real-time platform status" isDark={isDark}
                action={
                    <button type="button" onClick={onRefresh}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                        Refresh
                    </button>
                }
            />

            {!health ? (
                <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '40px', textAlign: 'center', color: t.muted, fontSize: 13 }}>Loading health data…</div>
            ) : (
                <>
                    {/* Service status */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {[
                            { label: 'Database',     ok: isConnected,          sub: 'MongoDB Atlas' },
                            { label: 'API Server',   ok: true,                 sub: 'FastAPI / Uvicorn' },
                            { label: 'Maintenance',  ok: !health.maintenance_mode, sub: health.maintenance_mode ? 'Maintenance mode ON' : 'All users can login' },
                        ].map(s => (
                            <div key={s.label} style={{ background: t.surf, border: `1px solid ${s.ok ? `${GRN}20` : `${AMB}25`}`, borderRadius: 10, padding: '16px 18px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.label}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: s.ok ? GRN : AMB, fontWeight: 500 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.ok ? GRN : AMB, animation: 'fdPing 2s ease-in-out infinite' }} />
                                        {s.ok ? 'Operational' : 'Warning'}
                                    </div>
                                </div>
                                <div style={{ fontSize: 12, color: t.muted }}>{s.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '18px 20px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Platform Metrics</div>
                            {[
                                { label: 'Total users',     val: health.total_users ?? '—' },
                                { label: 'Active sessions', val: health.active_sessions ?? '—' },
                                { label: 'Storage used',    val: health.storage_usage_mb ? `${health.storage_usage_mb} MB` : '—' },
                                { label: 'Error rate',      val: health.error_rate ?? '—' },
                                { label: 'Max upload',      val: health.max_upload_size_mb ? `${health.max_upload_size_mb} MB` : '—' },
                            ].map(m => (
                                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${t.bord2}` }}>
                                    <span style={{ fontSize: 13, color: t.sub }}>{m.label}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{String(m.val)}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '18px 20px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Uptime Indicators</div>
                            {[
                                { label: 'API Gateway',  pct: isConnected ? 99.9 : 0,  color: GRN  },
                                { label: 'Database',     pct: isConnected ? 100 : 0,    color: GRN  },
                                { label: 'File Storage', pct: 98.5,                     color: GRN  },
                            ].map(m => (
                                <div key={m.label} style={{ marginBottom: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <span style={{ fontSize: 12, color: t.sub }}>{m.label}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: m.color }}>{m.pct}%</span>
                                    </div>
                                    <PBar pct={m.pct} color={m.color} isDark={isDark} />
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: SETTINGS
══════════════════════════════════════════════════════════════════════════ */
function SecSettings({ health, onRefresh, isDark }: { health: any; onRefresh: () => void; isDark: boolean }) {
    const t = T(isDark);
    const f = fld(t);
    const [maintenance, setMaintenance] = useState(health?.maintenance_mode ?? false);
    const [maxUpload, setMaxUpload]     = useState(health?.max_upload_size_mb ?? 5);
    const [saving, setSaving]           = useState(false);
    const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

    useEffect(() => {
        if (health) { setMaintenance(health.maintenance_mode ?? false); setMaxUpload(health.max_upload_size_mb ?? 5); }
    }, [health]);

    const save = async () => {
        setSaving(true);
        try {
            const r = await fetch(`${API}/system/settings`, { method: 'PATCH', headers: ah(), body: JSON.stringify({ maintenance_mode: maintenance, max_upload_size: maxUpload }) });
            if (!r.ok) throw new Error('Failed');
            setToast({ msg: 'Settings saved', ok: true });
            onRefresh();
        } catch { setToast({ msg: 'Save failed', ok: false }); } finally { setSaving(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle title="System Settings" sub="Platform configuration and operational controls" isDark={isDark} />

            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>

                    {/* Maintenance mode */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>Maintenance Mode</div>
                                <div style={{ fontSize: 12, color: t.muted, marginTop: 3 }}>Blocks all users except IT Staff from logging in.</div>
                            </div>
                            <button type="button" onClick={() => setMaintenance((p: boolean) => !p)}
                                style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: maintenance ? RED : (isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.15)'), position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
                                <span style={{ position: 'absolute', top: 3, left: maintenance ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .2s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
                            </button>
                        </div>
                        {maintenance && (
                            <div style={{ padding: '9px 12px', background: `${RED}08`, border: `1px solid ${RED}20`, borderRadius: 8, fontSize: 12, color: RED }}>
                                Maintenance mode is enabled. Regular users cannot sign in.
                            </div>
                        )}
                    </div>

                    <div style={{ height: 1, background: t.bord }} />

                    {/* Max upload size */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 5 }}>Max Upload Size</label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input type="number" value={maxUpload} onChange={e => setMaxUpload(Number(e.target.value))} min={1} max={100}
                                style={{ ...f, width: 100 }}
                                onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                            <span style={{ fontSize: 13, color: t.muted }}>MB per file</span>
                        </div>
                    </div>

                    <button type="button" onClick={save} disabled={saving}
                        style={{ alignSelf: 'flex-start', padding: '9px 22px', borderRadius: 8, border: 'none', background: saving ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: saving ? 'none' : '0 2px 10px rgba(29,110,245,.25)', transition: 'all .15s' }}>
                        {saving ? 'Saving…' : 'Save Settings'}
                    </button>
                </div>
            </div>
            {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECURITY CENTER
══════════════════════════════════════════════════════════════════════════ */
function SecSecurity({ users, audit, isDark }: { users: any[]; audit: any[]; isDark: boolean }) {
    const t = T(isDark);
    const suspended  = users.filter(u => u.status === 'suspended');
    const pwdResets  = audit.filter(l => l.action_type === 'UPDATE' && l.metadata?.updated_fields?.includes('password')).slice(0, 10);
    const deletions  = audit.filter(l => l.action_type === 'DELETE').slice(0, 10);
    const logins     = audit.filter(l => l.action_type === 'LOGIN').slice(0, 10);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle title="Security Center" sub="Access control, suspicious activity, and security events" isDark={isDark} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <StatCard label="Suspended Accounts" value={suspended.length}   sub="Disabled access" color={RED}  isDark={isDark} />
                <StatCard label="Password Resets"    value={pwdResets.length}   sub="Via IT portal"   color={AMB}  isDark={isDark} />
                <StatCard label="Account Deletions"  value={deletions.length}   sub="All time"        color={PURP} isDark={isDark} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Suspended accounts */}
                <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10 }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Suspended Accounts</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: `${RED}12`, color: RED }}>{suspended.length}</span>
                    </div>
                    {suspended.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: t.muted }}>No suspended accounts.</div>
                    ) : suspended.slice(0, 8).map((u, i) => (
                        <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: i < Math.min(suspended.length, 8) - 1 ? `1px solid ${t.bord2}` : 'none' }}>
                            <Avatar name={u.name || 'U'} size={28} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unknown'}</div>
                                <div style={{ fontSize: 11, color: t.muted }}>{u.email}</div>
                            </div>
                            <RoleBadge role={u.role} />
                        </div>
                    ))}
                </div>

                {/* Recent logins */}
                <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10 }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.bord}`, fontSize: 13, fontWeight: 600, color: t.text }}>Recent Sign-ins</div>
                    {logins.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: t.muted }}>No login events.</div>
                    ) : logins.map((l, i) => (
                        <div key={l._id ?? i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', borderBottom: i < logins.length - 1 ? `1px solid ${t.bord2}` : 'none' }}>
                            <div>
                                <div style={{ fontSize: 13, color: t.text }}>{l.user_name || 'Unknown'}</div>
                            </div>
                            <span style={{ fontSize: 11, color: t.muted }}>{relTime(l.timestamp)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION: MY PROFILE
══════════════════════════════════════════════════════════════════════════ */
function SecProfile({ isDark }: { isDark: boolean }) {
    const t = T(isDark);
    const f = fld(t);
    const fileRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading]   = useState(true);
    const [saving,  setSaving]    = useState(false);
    const [err,     setErr]       = useState('');
    const [success, setSuccess]   = useState('');

    const [name,   setName]   = useState('');
    const [phone,  setPhone]  = useState('');
    const [avatar, setAvatar] = useState('');
    const [preview, setPreview] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch(`${API}/users/me`, { headers: ah() });
                if (r.ok) {
                    const data = await r.json();
                    setProfile(data);
                    setName(data.name || '');
                    setPhone(data.phone || '');
                    setAvatar(data.avatar || '');
                    setPreview(data.avatar || '');
                }
            } catch { /* ignore */ } finally { setLoading(false); }
        })();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setErr('Image must be smaller than 2 MB'); return; }
        const reader = new FileReader();
        reader.onload = ev => {
            const b64 = ev.target?.result as string;
            setPreview(b64);
            setAvatar(b64);
        };
        reader.readAsDataURL(file);
    };

    const save = async () => {
        setErr(''); setSuccess(''); setSaving(true);
        try {
            const r = await fetch(`${API}/users/me/profile`, {
                method: 'PATCH', headers: ah(),
                body: JSON.stringify({ name: name.trim() || undefined, phone: phone.trim() || undefined, avatar: avatar || undefined }),
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Save failed'); }
            const updated = await r.json();
            setProfile(updated);
            localStorage.setItem('fullName', updated.name || name);
            setSuccess('Profile updated successfully');
            setTimeout(() => setSuccess(''), 3000);
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: t.muted }}>Loading profile…</div>;

    const displayName = profile?.name || name || 'User';
    const roleLabel   = ROLE_CFG[profile?.role]?.label ?? profile?.role ?? 'Staff';
    const roleCfg     = ROLE_CFG[profile?.role] ?? { color: '#64748b' };

    return (
        <div style={{ maxWidth: 640 }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.muted, letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 5 }}>Account</div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-.02em', margin: 0, marginBottom: 4 }}>My Profile</h1>
                <p style={{ fontSize: 13, color: t.sub, margin: 0 }}>View and update your personal information and profile photo.</p>
            </div>

            {/* Avatar + basic info */}
            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 12, padding: '28px 28px 24px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 24 }}>
                    {/* Avatar */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${t.bord}`, background: preview ? 'transparent' : `linear-gradient(135deg, ${BLUE}, #5b8ef5)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'white' }}>
                            {preview
                                ? <img src={preview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : displayName.charAt(0).toUpperCase()}
                        </div>
                        <button type="button" onClick={() => fileRef.current?.click()}
                            style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: BLUE, border: `2px solid ${t.surf}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            title="Change photo">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                    </div>

                    {/* Name + role */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: '-.01em', marginBottom: 4 }}>{displayName}</div>
                        <div style={{ fontSize: 12, color: t.muted, marginBottom: 10 }}>{profile?.email}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: `${roleCfg.color}14`, color: roleCfg.color }}>
                            {roleLabel}
                        </span>
                    </div>
                </div>

                {/* Form fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.sub, marginBottom: 5 }}>Full name</label>
                            <input value={name} onChange={e => setName(e.target.value)} style={f}
                                onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.sub, marginBottom: 5 }}>Phone</label>
                            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" style={f}
                                onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.sub, marginBottom: 5 }}>Email</label>
                        <input value={profile?.email || ''} readOnly style={{ ...f, opacity: .6, cursor: 'default' }} />
                    </div>
                </div>

                {/* Feedback */}
                {err     && <div style={{ marginTop: 12, padding: '9px 12px', background: `${RED}08`, border: `1px solid ${RED}20`, borderRadius: 8, fontSize: 12, color: RED }}>{err}</div>}
                {success && <div style={{ marginTop: 12, padding: '9px 12px', background: `${GRN}08`, border: `1px solid ${GRN}20`, borderRadius: 8, fontSize: 12, color: GRN }}>{success}</div>}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    {preview && preview !== (profile?.avatar || '') && (
                        <button type="button" onClick={() => { setPreview(profile?.avatar || ''); setAvatar(profile?.avatar || ''); }}
                            style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Remove photo
                        </button>
                    )}
                    <button type="button" onClick={save} disabled={saving}
                        style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: saving ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: saving ? 'none' : '0 2px 12px rgba(29,110,245,.28)', transition: 'all .15s' }}>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Account info panel */}
            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '13px 20px', borderBottom: `1px solid ${t.bord}`, fontSize: 12, fontWeight: 600, color: t.sub, textTransform: 'uppercase', letterSpacing: '.07em' }}>Account Information</div>
                {[
                    { label: 'User ID',      value: (profile?._id ?? profile?.id ?? '—').toString().slice(-10) },
                    { label: 'Role',         value: roleLabel },
                    { label: 'Status',       value: profile?.status ? profile.status.charAt(0).toUpperCase() + profile.status.slice(1) : 'Active' },
                    { label: 'Member since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
                ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 20px', borderBottom: `1px solid ${t.bord2}` }}>
                        <span style={{ fontSize: 13, color: t.sub }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const SB_WIDTH = 252;

/* ══════════════════════════════════════════════════════════════════════════
   CREDENTIALS VIEWER
══════════════════════════════════════════════════════════════════════════ */
function SecCredentials({ isDark }: { isDark: boolean }) {
    const t = T(isDark);
    const [raw, setRaw]         = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');
    const [search, setSearch]   = useState('');
    const [copied, setCopied]   = useState<string | null>(null);

    interface Cred { name: string; email: string; role: string; password: string; createdAt: string; }

    function parse(text: string): Cred[] {
        return text.split('---\n')
            .filter(e => e.trim() && !e.startsWith('#'))
            .map(entry => {
                const get = (key: string) => { const m = entry.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')); return m ? m[1].trim() : ''; };
                return { name: get('Name'), email: get('Email'), role: get('Role'), password: get('Password'), createdAt: get('Created At') };
            }).filter(c => c.email && c.email !== 'N/A');
    }

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/founder/credentials`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
        }).then(async r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
        }).then(text => { setRaw(text); }).catch(e => setError(e.message)).finally(() => setLoading(false));
    }, []);

    const creds = parse(raw).filter(c =>
        !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    );

    const copy = (val: string, key: string) => { navigator.clipboard.writeText(val).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); }); };

    const roleColor: Record<string, string> = { founder: '#7c3aed', admin: '#1d6ef5', manager: '#1d6ef5', sub_admin: '#0891b2', quality_manager: '#0d9488', quality_control: '#0d9488', staff: '#059669', it_staff: '#d97706' };

    const download = () => { const b = new Blob([raw], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'orbit_credentials.txt'; a.click(); URL.revokeObjectURL(u); };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, margin: 0 }}>Credentials Registry</h2>
                    <p style={{ fontSize: 13, color: t.muted, margin: '4px 0 0' }}>All platform account credentials — IT access only</p>
                </div>
                <button onClick={download} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1d6ef5,#4f46e5)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    Download .txt
                </button>
            </div>

            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.bord}`, background: t.surf, color: t.text, fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} />

            {loading && <div style={{ padding: 40, textAlign: 'center', color: t.muted }}>Loading…</div>}
            {error   && <div style={{ padding: 14, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: 13 }}>{error}</div>}

            {!loading && !error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {creds.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: t.muted }}>No accounts found.</div>}
                    {creds.map((c, i) => {
                        const color = roleColor[c.role] || '#64748b';
                        return (
                            <div key={i} style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1.5fr 2fr 2fr 1fr', gap: '8px 16px', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{c.name}</div>
                                    <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${color}20`, color }}>{c.role}</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: t.muted, marginBottom: 2 }}>Email</div>
                                    <div style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span style={{ wordBreak: 'break-all' }}>{c.email}</span>
                                        <button onClick={() => copy(c.email, `e${i}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copied === `e${i}` ? '#059669' : t.muted }}>
                                            {copied === `e${i}` ? '✓' : <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: t.muted, marginBottom: 2 }}>Password</div>
                                    <div style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace' }}>
                                        <span>{c.password}</span>
                                        <button onClick={() => copy(c.password, `p${i}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copied === `p${i}` ? '#059669' : t.muted }}>
                                            {copied === `p${i}` ? '✓' : <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: t.muted, textAlign: 'right' }}>{c.createdAt}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   UNIFIED IT SIDEBAR
══════════════════════════════════════════════════════════════════════════ */
function ITSidebar({ active, onNav, isDark, onLogout }: {
    active: NavSection;
    onNav: (s: NavSection) => void;
    isDark: boolean;
    onLogout: () => void;
}) {
    const t = T(isDark);
    const [open, setOpen] = useState({ userMgmt: true, security: true, system: true });
    const toggle = (g: keyof typeof open) => setOpen(p => ({ ...p, [g]: !p[g] }));

    const userName  = localStorage.getItem('fullName') || 'IT Staff';
    const userEmail = localStorage.getItem('email') || 'IT Operations';
    const userInit  = userName.charAt(0).toUpperCase();

    const navItemStyle = (id: NavSection): React.CSSProperties => {
        const isActive = active === id;
        return {
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 12px 7px 14px', borderRadius: 7, width: '100%',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            background: isActive ? (isDark ? 'rgba(29,110,245,.13)' : 'rgba(29,110,245,.08)') : 'transparent',
            color: isActive ? BLUE : t.sub,
            fontSize: 13, fontWeight: isActive ? 600 : 400,
            fontFamily: 'inherit', transition: 'background .12s',
            position: 'relative',
        };
    };

    const activeBar = (id: NavSection) => active === id ? (
        <span style={{ position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 2.5, borderRadius: '0 2px 2px 0', background: BLUE, boxShadow: `0 0 6px ${BLUE}88` }} />
    ) : null;

    const Chevron = ({ open: o }: { open: boolean }) => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform .2s', transform: o ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
        </svg>
    );

    const GroupBtn = ({ label, groupKey }: { label: string; groupKey: keyof typeof open }) => (
        <button type="button" onClick={() => toggle(groupKey)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 12px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', fontFamily: 'inherit', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = t.sub)}
            onMouseLeave={e => (e.currentTarget.style.color = t.muted)}>
            {label}
            <Chevron open={open[groupKey]} />
        </button>
    );

    /* ── Icons ── */
    const ico = {
        dashboard: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
        users:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
        roles:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
        security:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
        sessions:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
        audit:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
        health:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
        settings:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
        credentials: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>,
        logout:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    };

    const NavBtn = ({ id, label, icon }: { id: NavSection; label: string; icon: React.ReactNode }) => (
        <button type="button" onClick={() => onNav(id)} style={navItemStyle(id)}
            onMouseEnter={e => { if (active !== id) e.currentTarget.style.background = t.hover; }}
            onMouseLeave={e => { if (active !== id) e.currentTarget.style.background = 'transparent'; }}>
            {activeBar(id)}
            <span style={{ opacity: active === id ? 1 : .6, flexShrink: 0 }}>{icon}</span>
            {label}
        </button>
    );

    const sep = <div style={{ height: 1, background: t.bord, margin: '8px 12px' }} />;

    return (
        <div style={{
            width: SB_WIDTH, position: 'fixed', top: 0, bottom: 0, left: 0,
            background: t.nav, borderRight: `1px solid ${t.navbd}`,
            display: 'flex', flexDirection: 'column',
            zIndex: 50, overflowY: 'auto', overflowX: 'hidden',
            fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif',
        }}>
            {/* Brand */}
            <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${t.navbd}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: `${BLUE}14`, border: `1px solid ${BLUE}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: t.text, letterSpacing: '-.02em', lineHeight: 1.2 }}>Orbit</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: BLUE, letterSpacing: '.1em', textTransform: 'uppercase' }}>IT Console</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>

                {/* Dashboard */}
                <NavBtn id="dashboard" label="Dashboard" icon={ico.dashboard} />

                {sep}

                {/* User Management */}
                <GroupBtn label="User Management" groupKey="userMgmt" />
                {open.userMgmt && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                        <NavBtn id="users"  label="Users"              icon={ico.users} />
                        <NavBtn id="roles"  label="Roles & Permissions" icon={ico.roles} />
                    </div>
                )}

                {sep}

                {/* Security */}
                <GroupBtn label="Security" groupKey="security" />
                {open.security && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                        <NavBtn id="security"     label="Security Center" icon={ico.security}     />
                        <NavBtn id="sessions"     label="Sessions"        icon={ico.sessions}     />
                        <NavBtn id="audit"        label="Audit Logs"      icon={ico.audit}        />
                        <NavBtn id="credentials"  label="Credentials"     icon={ico.credentials}  />
                    </div>
                )}

                {sep}

                {/* System */}
                <GroupBtn label="System" groupKey="system" />
                {open.system && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                        <NavBtn id="health"   label="System Health" icon={ico.health}   />
                        <NavBtn id="settings" label="Settings"      icon={ico.settings} />
                    </div>
                )}
            </nav>

            {/* Account */}
            <div style={{ padding: '12px', borderTop: `1px solid ${t.navbd}`, flexShrink: 0 }}>
                <button type="button" onClick={() => onNav('profile')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 4, background: active === 'profile' ? (isDark ? 'rgba(29,110,245,.13)' : 'rgba(29,110,245,.08)') : (isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.025)'), border: `1px solid ${active === 'profile' ? 'rgba(29,110,245,.22)' : t.bord}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s', textAlign: 'left' }}
                    onMouseEnter={e => { if (active !== 'profile') e.currentTarget.style.background = t.hover; }}
                    onMouseLeave={e => { if (active !== 'profile') e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.025)'; }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${BLUE}, #5b8ef5)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0, overflow: 'hidden' }}>
                        {userInit}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: active === 'profile' ? BLUE : t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                        <div style={{ fontSize: 10, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={active === 'profile' ? BLUE : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                </button>
                <button type="button" onClick={onLogout}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: `${RED}cc`, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${RED}0e`; e.currentTarget.style.color = RED; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = `${RED}cc`; }}>
                    {ico.logout}
                    Log out
                </button>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   ROOT COMPONENT
══════════════════════════════════════════════════════════════════════════ */
const ITPortal = () => {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const t = T(isDark);
    const [active, setActive]           = useState<NavSection>('dashboard');
    const [roleFilter, setRoleFilter]   = useState('');

    const [health,   setHealth]   = useState<any>(null);
    const [users,    setUsers]    = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [audit,    setAudit]    = useState<any[]>([]);
    const [loadU,    setLoadU]    = useState(true);
    const [loadS,    setLoadS]    = useState(false);
    const [loadA,    setLoadA]    = useState(false);

    useEffect(() => {
        const role = localStorage.getItem('role');
        if (role !== 'admin' && role !== 'it_staff') navigate('/dashboard');
    }, [navigate]);

    const fetchHealth = useCallback(async () => {
        try {
            const r = await fetch(`${API}/system/health`, { headers: ah() });
            if (r.ok) setHealth(await r.json());
        } catch {}
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoadU(true);
        try {
            const r = await fetch(`${API}/users`, { headers: ah() });
            if (r.ok) setUsers(await r.json());
        } catch {} finally { setLoadU(false); }
    }, []);

    const fetchSessions = useCallback(async () => {
        setLoadS(true);
        try {
            const r = await fetch(`${API}/users/sessions`, { headers: ah() });
            if (r.ok) setSessions(await r.json());
        } catch {} finally { setLoadS(false); }
    }, []);

    const fetchAudit = useCallback(async () => {
        setLoadA(true);
        try {
            const r = await fetch(`${API}/system/audit-logs`, { headers: ah() });
            if (r.ok) setAudit(await r.json());
        } catch {} finally { setLoadA(false); }
    }, []);

    useEffect(() => { fetchHealth(); fetchUsers(); fetchAudit(); }, [fetchHealth, fetchUsers, fetchAudit]);
    useEffect(() => { if (active === 'sessions') fetchSessions(); }, [active, fetchSessions]);
    useEffect(() => { if (active === 'health') fetchHealth(); }, [active, fetchHealth]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s' }}>
            <style>{`
                @keyframes itSlide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
            `}</style>

            {/* ── Single unified sidebar ── */}
            <ITSidebar active={active} onNav={setActive} isDark={isDark} onLogout={handleLogout} />

            {/* ── Main content ── */}
            <div style={{ flex: 1, marginLeft: SB_WIDTH, minWidth: 0, padding: '28px 32px 52px' }}>
                {active === 'dashboard' && <SecDashboard health={health} users={users} sessions={sessions} audit={audit} isDark={isDark} />}
                {active === 'users'     && <SecUsers     users={users}    loading={loadU}  onRefresh={fetchUsers} initialRoleFilter={roleFilter} isDark={isDark} />}
                {active === 'roles'     && <SecRoles     users={users}    onSelectRole={role => { setRoleFilter(role); setActive('users'); }} isDark={isDark} />}
                {active === 'security'  && <SecSecurity  users={users}    audit={audit}                                isDark={isDark} />}
                {active === 'sessions'  && <SecSessions  sessions={sessions} loading={loadS} onRefresh={fetchSessions} isDark={isDark} />}
                {active === 'audit'       && <SecAudit       audit={audit}  loading={loadA}             isDark={isDark} />}
                {active === 'credentials' && <SecCredentials                                         isDark={isDark} />}
                {active === 'health'     && <SecHealth    health={health} onRefresh={fetchHealth}    isDark={isDark} />}
                {active === 'settings'  && <SecSettings  health={health}  onRefresh={fetchHealth}                      isDark={isDark} />}
                {active === 'profile'   && <SecProfile                                                                 isDark={isDark} />}
            </div>
        </div>
    );
};

export default ITPortal;
