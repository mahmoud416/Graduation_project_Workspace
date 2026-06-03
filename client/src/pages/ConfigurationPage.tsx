import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../contexts/useTheme';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const BLUE  = '#1d6ef5';
const GRN   = '#10b981';
const RED   = '#ef4444';
const AMB   = '#f59e0b';
const PURP  = '#8b5cf6';
const TEAL  = '#06b6d4';

const T = (d: boolean) => ({
    bg:     d ? '#0a0c14' : '#f5f6fa',
    surf:   d ? '#111420' : '#ffffff',
    surf2:  d ? '#171b2e' : '#f8f9fc',
    bord:   d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)',
    bord2:  d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)',
    text:   d ? '#f1f4f9' : '#0f172a',
    sub:    d ? 'rgba(255,255,255,.55)' : '#475569',
    muted:  d ? 'rgba(255,255,255,.32)' : '#94a3b8',
    hover:  d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
    inbg:   d ? 'rgba(255,255,255,.04)' : '#f8fafc',
    inbd:   d ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)',
    shadow: d ? '0 20px 60px rgba(0,0,0,.65)' : '0 12px 40px rgba(0,0,0,.12)',
});

const ROLE_CFG: Record<string, { label: string; color: string }> = {
    founder:         { label: 'Founder',        color: AMB  },
    it_staff:        { label: 'IT Staff',        color: TEAL },
    admin:           { label: 'Admin',           color: BLUE },
    sub_admin:       { label: 'Sub Admin',       color: PURP },
    subadmin:        { label: 'Sub Admin',       color: PURP },
    manager:         { label: 'Manager',         color: '#0ea5e9' },
    quality_control: { label: 'Quality Control', color: GRN  },
    quality_manager: { label: 'QC Manager',      color: GRN  },
    staff:           { label: 'Staff',           color: '#64748b' },
};

const PERMISSIONS: Record<string, string[]> = {
    founder:         ['All permissions', 'IT account management', 'System configuration', 'Billing'],
    it_staff:        ['User management', 'Session control', 'Audit logs', 'System health'],
    admin:           ['Project management', 'Team management', 'Reports', 'Configuration'],
    sub_admin:       ['Team oversight', 'Task boards', 'Project reports'],
    subadmin:        ['Team oversight', 'Task boards', 'Project reports'],
    manager:         ['Team management', 'Project access', 'QC reports'],
    quality_control: ['Quality standards', 'AI evaluations', 'Reports'],
    quality_manager: ['Quality standards', 'AI evaluations', 'Reports', 'Standards config'],
    staff:           ['Task access', 'Project view', 'Calendar'],
};

const ah = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'X-User-Id': localStorage.getItem('userId') ?? '',
});

function relTime(iso?: string | null) {
    if (!iso) return '—';
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.round(d / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(d / 3600000);
    if (h < 24) return `${h}h ago`;
    const dy = Math.round(d / 86400000);
    if (dy < 7) return `${dy}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDate(iso?: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
}

function avatarBg(name: string) {
    const hue = ((name.charCodeAt(0) ?? 0) * 47 + (name.charCodeAt(1) ?? 0) * 13) % 360;
    return `linear-gradient(135deg, hsl(${hue},58%,44%), hsl(${hue + 35},50%,34%))`;
}

/* ── Atoms ─────────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 32 }: { name: string; size?: number }) {
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: avatarBg(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .34), fontWeight: 700, color: 'white', userSelect: 'none', letterSpacing: '-.01em' }}>
            {initials(name)}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, [string, string]> = {
        active:    [GRN,  `${GRN}14`],
        inactive:  ['#64748b', 'rgba(100,116,139,.12)'],
        suspended: [RED,  `${RED}12`],
    };
    const [c, bg] = map[status?.toLowerCase()] ?? map.inactive;
    return (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: bg, color: c }}>
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Active'}
        </span>
    );
}

function RoleBadge({ role }: { role: string }) {
    const cfg = ROLE_CFG[role] ?? { label: role, color: '#64748b' };
    return (
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: `${cfg.color}14`, color: cfg.color, whiteSpace: 'nowrap' }}>
            {cfg.label}
        </span>
    );
}

function fld(t: ReturnType<typeof T>): React.CSSProperties {
    return { width: '100%', padding: '8px 11px', background: t.inbg, border: `1.5px solid ${t.inbd}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', transition: 'border-color .15s' };
}

function ErrBanner({ msg }: { msg: string }) {
    return <div style={{ padding: '9px 12px', background: `${RED}08`, border: `1px solid ${RED}20`, borderRadius: 8, fontSize: 12, color: RED }}>{msg}</div>;
}

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
    useEffect(() => { const id = setTimeout(onDone, 3000); return () => clearTimeout(id); }, [msg, onDone]);
    return (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, padding: '11px 18px', borderRadius: 10, background: ok ? GRN : RED, color: 'white', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)', animation: 'umSlide .2s ease-out both' }}>
            {msg}
        </div>
    );
}

/* ── Modal shell ───────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children, isDark }: { title: string; onClose: () => void; children: React.ReactNode; isDark: boolean }) {
    const t = T(isDark);
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)' }} />
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 14, boxShadow: t.shadow, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', animation: 'umSlide .18s ease-out both' }}>
                <div style={{ padding: '16px 22px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{title}</span>
                    <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: t.hover, border: `1px solid ${t.bord}`, cursor: 'pointer', color: t.muted, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: '20px 22px' }}>{children}</div>
            </div>
        </div>
    );
}

function Field({ label, isDark, children }: { label: string; isDark: boolean; children: React.ReactNode }) {
    const t = T(isDark);
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.sub, marginBottom: 5 }}>{label}</label>
            {children}
        </div>
    );
}

/* ── Create User Modal ─────────────────────────────────────────────────────── */
function CreateUserModal({ onClose, onCreated, isDark }: { onClose: () => void; onCreated: () => void; isDark: boolean }) {
    const t = T(isDark);
    const f = fld(t);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', status: 'active' });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/auth/register`, {
                method: 'POST', headers: ah(),
                body: JSON.stringify({ full_name: form.name, email: form.email, password: form.password, role: form.role, status: form.status }),
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed to create user'); }
            onCreated(); onClose();
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
    };

    const canSubmit = form.name && form.email && form.password.length >= 8 && !loading;

    return (
        <Modal title="New User" onClose={onClose} isDark={isDark}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Full name *" isDark={isDark}>
                        <input value={form.name} onChange={set('name')} required placeholder="Sara Ahmad" style={f}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </Field>
                    <Field label="Email address *" isDark={isDark}>
                        <input type="email" value={form.email} onChange={set('email')} required placeholder="sara@example.com" style={f}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </Field>
                </div>
                <Field label="Password * (min 8 characters)" isDark={isDark}>
                    <input type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" style={f}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Role" isDark={isDark}>
                        <select value={form.role} onChange={set('role')} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                            {Object.entries(ROLE_CFG)
                                .filter(([k]) => !['founder', 'quality_manager', 'subadmin'].includes(k))
                                .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={onClose}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={!canSubmit}
                        style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: canSubmit ? BLUE : `${BLUE}50`, color: 'white', fontSize: 13, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                        {loading ? 'Creating…' : 'Create User'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* ── Edit User Modal ───────────────────────────────────────────────────────── */
function EditUserModal({ user, onClose, onSaved, isDark }: { user: any; onClose: () => void; onSaved: () => void; isDark: boolean }) {
    const t = T(isDark);
    const f = fld(t);
    const uid = user._id ?? user.id;
    const currentPwd = user.plain_password || '';
    const [form, setForm] = useState({ name: user.name || user.full_name || '', role: user.role || 'staff', status: user.status || 'active', newPassword: currentPwd });
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    const pwdChanged = form.newPassword !== currentPwd && form.newPassword.trim().length > 0;

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/users/${uid}`, {
                method: 'PATCH', headers: ah(),
                body: JSON.stringify({ name: form.name, role: form.role, status: form.status }),
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }

            if (pwdChanged) {
                if (form.newPassword.length < 8) throw new Error('Password must be at least 8 characters');
                const pr = await fetch(`${API}/auth/change-password`, {
                    method: 'POST', headers: ah(),
                    body: JSON.stringify({ user_id: uid, new_password: form.newPassword }),
                });
                if (!pr.ok) { const d = await pr.json(); throw new Error(d.detail || 'Password update failed'); }
            }

            onSaved(); onClose();
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
    };

    return (
        <Modal title="Edit User" onClose={onClose} isDark={isDark}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Full name" isDark={isDark}>
                    <input value={form.name} onChange={set('name')} style={f}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Role" isDark={isDark}>
                        <select value={form.role} onChange={set('role')} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                            {Object.entries(ROLE_CFG)
                                .filter(([k]) => !['founder', 'quality_manager', 'subadmin'].includes(k))
                                .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
                        {pwdChanged && form.newPassword.length < 8 && (
                            <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>Minimum 8 characters</div>
                        )}
                        {pwdChanged && form.newPassword.length >= 8 && (
                            <div style={{ fontSize: 11, color: AMB, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                Password will be updated on save
                            </div>
                        )}
                    </Field>
                </div>

                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={onClose}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={loading}
                        style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: loading ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* ── Reset Password Modal ──────────────────────────────────────────────────── */
function ResetPwdModal({ user, onClose, isDark }: { user: any; onClose: () => void; isDark: boolean }) {
    const t = T(isDark);
    const f = fld(t);
    const [pwd, setPwd] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [done, setDone] = useState(false);

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/auth/change-password`, {
                method: 'POST', headers: ah(),
                body: JSON.stringify({ user_id: user._id ?? user.id, new_password: pwd }),
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
            setDone(true); setTimeout(onClose, 1800);
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
    };

    if (done) return (
        <Modal title="Reset Password" onClose={onClose} isDark={isDark}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${GRN}14`, border: `1px solid ${GRN}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>Password reset successfully</div>
                <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>{user.name || user.email}</div>
            </div>
        </Modal>
    );

    return (
        <Modal title={`Reset Password — ${user.name || user.email}`} onClose={onClose} isDark={isDark}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="New password (min 8 characters)" isDark={isDark}>
                    <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required placeholder="••••••••" style={f}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </Field>
                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={onClose}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={loading || pwd.length < 8}
                        style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: (loading || pwd.length < 8) ? `${AMB}50` : AMB, color: 'white', fontSize: 13, fontWeight: 600, cursor: (loading || pwd.length < 8) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {loading ? 'Resetting…' : 'Reset Password'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* ── Confirm Delete Modal ──────────────────────────────────────────────────── */
function ConfirmModal({ title, body, onConfirm, onClose, loading, isDark }: {
    title: string; body: string; onConfirm: () => void; onClose: () => void; loading: boolean; isDark: boolean;
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
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: loading ? `${RED}55` : RED, color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {loading ? 'Deleting…' : 'Delete Account'}
                </button>
            </div>
        </Modal>
    );
}

/* ── Row action menu ───────────────────────────────────────────────────────── */
function UserActions({ user, onEdit, onReset, onToggle, onDelete, isDark }: {
    user: any; onEdit: () => void; onReset: () => void; onToggle: () => void; onDelete: () => void; isDark: boolean;
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

    const item = (label: string, icon: React.ReactNode, fn: () => void, danger = false) => (
        <button key={label} type="button"
            onClick={() => { fn(); setOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: danger ? RED : t.text, fontSize: 13, textAlign: 'left', borderRadius: 7, fontFamily: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.style.background = danger ? `${RED}08` : t.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {icon}{label}
        </button>
    );

    const isSuspended = user.status === 'suspended';

    return (
        <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(p => !p)}
                style={{ width: 28, height: 28, borderRadius: 6, background: open ? t.hover : 'transparent', border: `1px solid ${open ? t.bord : 'transparent'}`, cursor: 'pointer', color: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {open && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', width: 200, background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, boxShadow: t.shadow, zIndex: 600, padding: '4px', animation: 'umSlide .14s ease-out both' }}>
                    {item('Edit account',
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                        onEdit)}
                    {item('Reset password',
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
                        onReset)}
                    {item(
                        isSuspended ? 'Enable account' : 'Disable account',
                        isSuspended
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
                        onToggle, !isSuspended)}
                    <div style={{ height: 1, background: t.bord, margin: '3px 6px' }} />
                    {item('Delete account',
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>,
                        onDelete, true)}
                </div>
            )}
        </div>
    );
}

/* ── User detail drawer ────────────────────────────────────────────────────── */
function UserDrawer({ user, onClose, onEdit, isDark }: { user: any; onClose: () => void; onEdit: () => void; isDark: boolean }) {
    const t = T(isDark);
    const name = user.name || user.full_name || user.email || 'User';
    const roleCfg = ROLE_CFG[user.role] ?? { label: user.role, color: '#64748b' };
    const perms = PERMISSIONS[user.role] ?? ['Standard access'];

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 300, backdropFilter: 'blur(2px)', animation: 'umFade .15s ease-out both' }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: t.surf, borderLeft: `1px solid ${t.bord}`, zIndex: 301, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,.15)', animation: 'umDrawer .22s cubic-bezier(.34,1.56,.64,1) both', fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', overflowY: 'auto' }}>

                {/* Header */}
                <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <Avatar name={name} size={48} />
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: '-.01em' }}>{name}</div>
                            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{user.email}</div>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: t.hover, border: `1px solid ${t.bord}`, cursor: 'pointer', color: t.muted, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 }}>×</button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>

                    {/* Role + Status row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ background: t.surf2, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '14px 16px' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Role</div>
                            <RoleBadge role={user.role} />
                        </div>
                        <div style={{ background: t.surf2, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '14px 16px' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Status</div>
                            <StatusBadge status={user.status ?? 'active'} />
                        </div>
                    </div>

                    {/* Account details */}
                    <div style={{ background: t.surf2, border: `1px solid ${t.bord}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '11px 16px', borderBottom: `1px solid ${t.bord}`, fontSize: 11, fontWeight: 600, color: t.sub, textTransform: 'uppercase', letterSpacing: '.07em' }}>Account Details</div>
                        {[
                            { label: 'Last Login',    value: relTime(user.last_seen) },
                            { label: 'Member Since',  value: fmtDate(user.created_at) },
                            { label: 'Phone',         value: user.phone || '—' },
                            { label: 'User ID',       value: (user._id ?? user.id ?? '—').toString().slice(-8) },
                        ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${t.bord2}` }}>
                                <span style={{ fontSize: 13, color: t.sub }}>{row.label}</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{row.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Permissions */}
                    <div style={{ background: t.surf2, border: `1px solid ${t.bord}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '11px 16px', borderBottom: `1px solid ${t.bord}`, fontSize: 11, fontWeight: 600, color: t.sub, textTransform: 'uppercase', letterSpacing: '.07em' }}>Permissions</div>
                        <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {perms.map(p => (
                                <span key={p} style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 5, background: `${roleCfg.color}10`, border: `1px solid ${roleCfg.color}22`, color: roleCfg.color }}>{p}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.bord}`, flexShrink: 0 }}>
                    <button type="button" onClick={onEdit}
                        style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(29,110,245,.28)', transition: 'opacity .15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                        Edit Account
                    </button>
                </div>
            </div>
        </>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════════ */
const ConfigurationPage = () => {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const t = T(isDark);
    const f = fld(t);

    const [users,      setUsers]      = useState<any[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [search,     setSearch]     = useState('');
    const [roleF,      setRoleF]      = useState('');
    const [statusF,    setStatusF]    = useState('');
    const [sort,       setSort]       = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');
    const [page,       setPage]       = useState(1);

    const [showCreate, setShowCreate] = useState(false);
    const [editUser,   setEditUser]   = useState<any>(null);
    const [resetUser,  setResetUser]  = useState<any>(null);
    const [deleteUser, setDeleteUser] = useState<any>(null);
    const [delLoading, setDelLoading] = useState(false);
    const [drawerUser, setDrawerUser] = useState<any>(null);
    const [toggling,   setToggling]   = useState<string | null>(null);
    const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

    const PAGE_SIZE = 25;

    useEffect(() => {
        const role = localStorage.getItem('role');
        if (role !== 'admin' && role !== 'it_staff') navigate('/dashboard');
    }, [navigate]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/users`, { headers: ah() });
            if (r.ok) setUsers(await r.json());
        } catch { /* handled by loading state */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const stats = useMemo(() => ({
        total:     users.length,
        active:    users.filter(u => (u.status ?? 'active') === 'active').length,
        suspended: users.filter(u => u.status === 'suspended').length,
        admins:    users.filter(u => u.role === 'admin').length,
        subAdmins: users.filter(u => u.role === 'sub_admin' || u.role === 'subadmin').length,
        qc:        users.filter(u => u.role === 'quality_control' || u.role === 'quality_manager').length,
        staff:     users.filter(u => u.role === 'staff').length,
    }), [users]);

    const filtered = useMemo(() => {
        let list = users.filter(u => {
            if (roleF   && u.role !== roleF)                     return false;
            if (statusF && (u.status ?? 'active') !== statusF)   return false;
            if (search) {
                const q = search.toLowerCase();
                if (!(u.name ?? '').toLowerCase().includes(q) && !(u.email ?? '').toLowerCase().includes(q)) return false;
            }
            return true;
        });
        if (sort === 'newest') list = [...list].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
        if (sort === 'oldest') list = [...list].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
        if (sort === 'az')     list = [...list].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        if (sort === 'za')     list = [...list].sort((a, b) => (b.name ?? '').localeCompare(a.name ?? ''));
        return list;
    }, [users, roleF, statusF, search, sort]);

    const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
    const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleToggle = async (user: any) => {
        const uid = user._id ?? user.id;
        const isSuspended = user.status === 'suspended';
        setToggling(uid);
        try {
            if (!isSuspended) {
                await fetch(`${API}/system/force-logout/${uid}`, { method: 'POST', headers: ah() });
            } else {
                await fetch(`${API}/users/${uid}`, { method: 'PATCH', headers: ah(), body: JSON.stringify({ status: 'active' }) });
            }
            fetchUsers();
            setToast({ msg: isSuspended ? 'Account enabled' : 'Account suspended', ok: true });
        } catch { setToast({ msg: 'Action failed', ok: false }); } finally { setToggling(null); }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        const uid = deleteUser._id ?? deleteUser.id;
        setDelLoading(true);
        try {
            const r = await fetch(`${API}/users/${uid}`, { method: 'DELETE', headers: ah() });
            if (!r.ok && r.status !== 204) { const d = await r.json(); throw new Error(d.detail); }
            fetchUsers();
            setDeleteUser(null);
            setDrawerUser(null);
            setToast({ msg: 'Account deleted', ok: true });
        } catch (e: unknown) { setToast({ msg: e instanceof Error ? e.message : 'Delete failed', ok: false }); } finally { setDelLoading(false); }
    };

    const STAT_CARDS = [
        { label: 'Total Users',     value: stats.total,     color: BLUE },
        { label: 'Active',          value: stats.active,    color: GRN  },
        { label: 'Suspended',       value: stats.suspended, color: RED  },
        { label: 'Admins',          value: stats.admins,    color: BLUE },
        { label: 'Sub Admins',      value: stats.subAdmins, color: PURP },
        { label: 'Quality Control', value: stats.qc,        color: GRN  },
        { label: 'Staff',           value: stats.staff,     color: '#64748b' },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s' }}>
            <style>{`
                @keyframes umSlide  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
                @keyframes umFade   { from{opacity:0} to{opacity:1} }
                @keyframes umDrawer { from{transform:translateX(100%)} to{transform:translateX(0)} }
            `}</style>

            <Sidebar />

            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minWidth: 0, padding: '32px 36px 56px', transition: 'margin-left .22s' }}>

                {/* ── Page header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: t.muted, letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 5 }}>Administration</div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-.02em', margin: 0, marginBottom: 5 }}>User Management</h1>
                        <p style={{ fontSize: 13, color: t.sub, margin: 0 }}>Manage users, permissions, workspace assignments and account lifecycle.</p>
                    </div>
                    <button type="button" onClick={() => setShowCreate(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(29,110,245,.3)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        New User
                    </button>
                </div>

                {/* ── Statistics row ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 24 }}>
                    {STAT_CARDS.map(s => (
                        <div key={s.label} style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '14px 16px' }}>
                            <div style={{ fontSize: 11, color: t.muted, marginBottom: 6, fontWeight: 500 }}>{s.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: t.text, lineHeight: 1 }}>{loading ? '—' : s.value}</div>
                            <div style={{ height: 2, borderRadius: 2, background: `${s.color}18`, marginTop: 10, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: loading ? '0%' : `${Math.min((s.value / Math.max(stats.total, 1)) * 100, 100)}%`, background: s.color, borderRadius: 2, transition: 'width .6s ease' }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Filter bar ── */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
                        <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: t.muted }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search name or email…"
                            style={{ ...f, paddingLeft: 30 }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </div>
                    <select value={roleF} onChange={e => { setRoleF(e.target.value); setPage(1); }}
                        style={{ ...f, width: 150, background: isDark ? '#0f1220' : '#fff' }}>
                        <option value="">All roles</option>
                        {Object.entries(ROLE_CFG).filter(([k]) => !['quality_manager', 'subadmin'].includes(k)).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                    <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
                        style={{ ...f, width: 140, background: isDark ? '#0f1220' : '#fff' }}>
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
                        style={{ ...f, width: 145, background: isDark ? '#0f1220' : '#fff' }}>
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="az">Name A → Z</option>
                        <option value="za">Name Z → A</option>
                    </select>
                    {(search || roleF || statusF) && (
                        <button type="button"
                            onClick={() => { setSearch(''); setRoleF(''); setStatusF(''); setPage(1); }}
                            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                            Clear
                        </button>
                    )}
                    <span style={{ fontSize: 12, color: t.muted, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                        {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* ── Main table ── */}
                <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 12, overflow: 'hidden' }}>
                    {/* Table head */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.1fr 88px 108px 108px 40px', padding: '10px 20px', borderBottom: `1px solid ${t.bord}`, background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)' }}>
                        {['User', 'Role', 'Status', 'Last Login', 'Created', ''].map(h => (
                            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>{h}</div>
                        ))}
                    </div>

                    {loading ? (
                        <div style={{ padding: '44px', textAlign: 'center', color: t.muted, fontSize: 13 }}>Loading users…</div>
                    ) : slice.length === 0 ? (
                        <div style={{ padding: '52px', textAlign: 'center' }}>
                            <svg width="44" height="44" viewBox="0 0 52 52" fill="none" style={{ display: 'block', margin: '0 auto 14px', opacity: .25 }}>
                                <circle cx="26" cy="20" r="10" stroke={t.muted} strokeWidth="1.5"/>
                                <path d="M8 46c0-9.94 8.059-18 18-18s18 8.06 18 18" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <div style={{ fontSize: 14, fontWeight: 600, color: t.sub, marginBottom: 4 }}>No users found</div>
                            <div style={{ fontSize: 13, color: t.muted }}>Try adjusting your filters, or create a new user.</div>
                        </div>
                    ) : slice.map((u, i) => {
                        const name = u.name || u.full_name || u.email || 'User';
                        const uid = u._id ?? u.id ?? i;
                        return (
                            <div key={uid}
                                style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.1fr 88px 108px 108px 40px', padding: '11px 20px', borderBottom: i < slice.length - 1 ? `1px solid ${t.bord2}` : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background .1s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                onClick={() => setDrawerUser(u)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <Avatar name={name} size={30} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                        <div style={{ fontSize: 11, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                                    </div>
                                </div>
                                <div><RoleBadge role={u.role} /></div>
                                <div>
                                    {toggling === (u._id ?? u.id)
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
                        );
                    })}

                    {/* Pagination */}
                    {filtered.length > PAGE_SIZE && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: `1px solid ${t.bord}` }}>
                            <span style={{ fontSize: 12, color: t.muted }}>
                                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                            </span>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button type="button" onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
                                    style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, cursor: page === 1 ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: page === 1 ? .45 : 1 }}>
                                    ← Prev
                                </button>
                                <button type="button" onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages}
                                    style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: page === totalPages ? .45 : 1 }}>
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Overlays */}
            {showCreate  && <CreateUserModal  onClose={() => setShowCreate(false)}  onCreated={() => { fetchUsers(); setToast({ msg: 'User created', ok: true }); }} isDark={isDark} />}
            {editUser    && <EditUserModal    user={editUser}   onClose={() => setEditUser(null)}   onSaved={() => { fetchUsers(); setToast({ msg: 'User updated', ok: true }); }} isDark={isDark} />}
            {resetUser   && <ResetPwdModal   user={resetUser}  onClose={() => setResetUser(null)}  isDark={isDark} />}
            {deleteUser  && <ConfirmModal     title="Delete Account" body={`Permanently delete ${deleteUser.name ?? deleteUser.email}? This cannot be undone.`} onConfirm={handleDelete} onClose={() => setDeleteUser(null)} loading={delLoading} isDark={isDark} />}
            {drawerUser  && <UserDrawer       user={drawerUser} onClose={() => setDrawerUser(null)} onEdit={() => { setEditUser(drawerUser); setDrawerUser(null); }} isDark={isDark} />}
            {toast       && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
        </div>
    );
};

export default ConfigurationPage;
