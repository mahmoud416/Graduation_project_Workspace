import React, { useState, useEffect, useRef, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useTheme } from '../contexts/useTheme';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1`;
const tok = () => localStorage.getItem('token') ?? '';

const BLUE = '#1d6ef5';
const GRN  = '#10b981';
const RED  = '#ef4444';
const AMB  = '#f59e0b';
const PURP = '#8b5cf6';

const PAGE_SIZE = 10;

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface ITAccount {
    _id: string;
    name: string;
    email: string;
    status: 'active' | 'inactive';
    created_at?: string;
    last_login?: string;
}

type SortKey  = 'name' | 'created_at' | 'last_login' | 'status';
type SortDir  = 'asc'  | 'desc';

/* ─── Theme tokens ───────────────────────────────────────────────────────── */
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
    mbg:   d ? '#0f1220'               : '#ffffff',
    mbord: d ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.09)',
    shadow:d ? '0 24px 64px rgba(0,0,0,.7)' : '0 24px 64px rgba(0,0,0,.12)',
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function initials(n: string) {
    return n.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
}
function fmtDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function relTime(iso?: string) {
    if (!iso) return '—';
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.round(d / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(d / 3600000);
    if (h < 24) return `${h}h ago`;
    const dy = Math.round(d / 86400000);
    if (dy < 30) return `${dy}d ago`;
    return fmtDate(iso);
}
function avatarColor(name: string) {
    const hue = ((name.charCodeAt(0) ?? 0) * 47 + (name.charCodeAt(1) ?? 0) * 13) % 360;
    return `linear-gradient(135deg, hsl(${hue},62%,44%), hsl(${hue + 35},55%,34%))`;
}

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 32 }: { name: string; size?: number }) {
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .34), fontWeight: 700, color: 'white', letterSpacing: '-.01em', userSelect: 'none' }}>
            {initials(name)}
        </div>
    );
}

/* ─── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
    const { isDark } = useTheme();
    const on = status === 'active';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: on ? `${GRN}14` : (isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'), color: on ? GRN : isDark ? 'rgba(255,255,255,.4)' : '#64748b' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: on ? GRN : (isDark ? 'rgba(255,255,255,.3)' : '#94a3b8'), flexShrink: 0 }} />
            {on ? 'Active' : 'Inactive'}
        </span>
    );
}

/* ─── Sort icon ──────────────────────────────────────────────────────────── */
function SortIco({ active, dir }: { active: boolean; dir: SortDir }) {
    const c = active ? BLUE : 'currentColor';
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4, opacity: active ? 1 : .35 }}>
            <path d="M5 2L8 5H2L5 2Z" fill={dir === 'asc' && active ? c : 'currentColor'} opacity={dir === 'asc' && active ? 1 : .3} />
            <path d="M5 8L2 5H8L5 8Z" fill={dir === 'desc' && active ? c : 'currentColor'} opacity={dir === 'desc' && active ? 1 : .3} />
        </svg>
    );
}

/* ─── Theme-aware modal ──────────────────────────────────────────────────── */
function Modal({ title, width = 460, onClose, children }: { title: string; width?: number; onClose: () => void; children: React.ReactNode }) {
    const { isDark } = useTheme();
    const t = T(isDark);
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)' }} />
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: width, background: t.mbg, border: `1px solid ${t.mbord}`, borderRadius: 16, overflow: 'hidden', boxShadow: t.shadow, animation: 'facSlide .18s ease-out both' }}>
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{title}</span>
                    <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: t.hover, border: `1px solid ${t.bord}`, cursor: 'pointer', color: t.muted, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: '20px 22px' }}>{children}</div>
            </div>
        </div>
    );
}

/* ─── Form field (theme-aware) ───────────────────────────────────────────── */
function Field({ label, type = 'text', value, onChange, placeholder, required, disabled, hint }: {
    label: string; type?: string; value: string; onChange: (v: string) => void;
    placeholder?: string; required?: boolean; disabled?: boolean; hint?: string;
}) {
    const { isDark } = useTheme();
    const t = T(isDark);
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.sub, marginBottom: 5 }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} disabled={disabled}
                style={{ width: '100%', padding: '9px 11px', background: disabled ? t.surf2 : t.inbg, border: `1.5px solid ${t.inbd}`, borderRadius: 8, color: disabled ? t.muted : t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', transition: 'border-color .15s', opacity: disabled ? .7 : 1 }}
                onFocus={e => { if (!disabled) e.currentTarget.style.borderColor = BLUE; }}
                onBlur={e => { e.currentTarget.style.borderColor = t.inbd; }}
            />
            {hint && <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{hint}</div>}
        </div>
    );
}

/* ─── Primary / ghost buttons ────────────────────────────────────────────── */
function BtnPrimary({ label, loading, disabled, type = 'button', onClick, color = BLUE }: { label: string; loading?: boolean; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void; color?: string }) {
    return (
        <button type={type} onClick={onClick} disabled={disabled || loading}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: (disabled || loading) ? `${color}50` : color, color: 'white', fontSize: 13, fontWeight: 600, cursor: (disabled || loading) ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'opacity .15s' }}>
            {loading ? 'Loading…' : label}
        </button>
    );
}
function BtnGhost({ label, onClick }: { label: string; onClick: () => void }) {
    const { isDark } = useTheme();
    const t = T(isDark);
    return (
        <button type="button" onClick={onClick}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {label}
        </button>
    );
}

/* ─── Error banner ───────────────────────────────────────────────────────── */
function ErrBanner({ msg }: { msg: string }) {
    return <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, fontSize: 12, color: RED }}>{msg}</div>;
}

/* ══════════════════════════════════════════════════════════════════════════
   MODALS
══════════════════════════════════════════════════════════════════════════ */
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: ITAccount) => void }) {
    const { isDark } = useTheme();
    const t = T(isDark);
    const [name, setName]   = useState('');
    const [email, setEmail] = useState('');
    const [pwd, setPwd]     = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr]     = useState('');
    const pwdOk = pwd.length >= 8;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/founder/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` }, body: JSON.stringify({ full_name: name, email, password: pwd }) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed to create account'); }
            onCreated(await r.json()); onClose();
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    };

    return (
        <Modal title="Create IT Account" onClose={onClose}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Role lock notice */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: isDark ? 'rgba(139,92,246,.08)' : 'rgba(139,92,246,.06)', border: `1px solid rgba(139,92,246,.18)`, borderRadius: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PURP} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    <span style={{ fontSize: 12, color: PURP }}>Role is fixed to <strong>IT Staff</strong> — only the Founder can provision accounts.</span>
                </div>

                <Field label="Full Name" value={name} onChange={setName} placeholder="e.g. Sara Ahmad" required />
                <Field label="Email Address" type="email" value={email} onChange={setEmail} placeholder="sara@orbit.io" required />
                <Field label="Password" type="password" value={pwd} onChange={setPwd} placeholder="Minimum 8 characters" required
                    hint={pwd.length > 0 && !pwdOk ? 'Password must be at least 8 characters' : undefined} />

                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                    <BtnGhost label="Cancel" onClick={onClose} />
                    <BtnPrimary label="Create Account" type="submit" loading={loading} disabled={!name || !email || !pwdOk} />
                </div>
            </form>
        </Modal>
    );
}

function EditModal({ account, onClose, onUpdated }: { account: ITAccount; onClose: () => void; onUpdated: (a: ITAccount) => void }) {
    const [name,  setName]  = useState(account.name);
    const [email, setEmail] = useState(account.email);
    const [loading, setLoading] = useState(false);
    const [err, setErr]     = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/founder/accounts/${account._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` }, body: JSON.stringify({ full_name: name, email }) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed to update'); }
            onUpdated(await r.json()); onClose();
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    };

    return (
        <Modal title="Edit Account" onClose={onClose}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Full Name" value={name} onChange={setName} required />
                <Field label="Email Address" type="email" value={email} onChange={setEmail} required />
                <Field label="Role" value="IT Staff" onChange={() => {}} disabled />
                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                    <BtnGhost label="Cancel" onClick={onClose} />
                    <BtnPrimary label="Save Changes" type="submit" loading={loading} disabled={!name || !email} />
                </div>
            </form>
        </Modal>
    );
}

function ResetPwdModal({ account, onClose }: { account: ITAccount; onClose: () => void }) {
    const { isDark } = useTheme();
    const t = T(isDark);
    const [pwd, setPwd]   = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr]   = useState('');
    const [done, setDone] = useState(false);
    const pwdOk = pwd.length >= 8;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setErr(''); setLoading(true);
        try {
            const r = await fetch(`${API}/founder/accounts/${account._id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` }, body: JSON.stringify({ new_password: pwd }) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
            setDone(true); setTimeout(onClose, 1600);
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    };

    if (done) {
        return (
            <Modal title="Reset Password" onClose={onClose}>
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${GRN}14`, border: `1px solid ${GRN}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4 }}>Password reset</div>
                    <div style={{ fontSize: 13, color: t.muted }}>New password has been set for {account.name}.</div>
                </div>
            </Modal>
        );
    }

    return (
        <Modal title="Reset Password" onClose={onClose}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '10px 12px', background: isDark ? 'rgba(245,158,11,.07)' : 'rgba(245,158,11,.05)', border: `1px solid rgba(245,158,11,.18)`, borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: AMB }}>Resetting password for <strong style={{ color: t.text }}>{account.name}</strong></span>
                </div>
                <Field label="New Password" type="password" value={pwd} onChange={setPwd} placeholder="Minimum 8 characters" required
                    hint={pwd.length > 0 && !pwdOk ? 'Password must be at least 8 characters' : undefined} />
                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                    <BtnGhost label="Cancel" onClick={onClose} />
                    <BtnPrimary label="Reset Password" type="submit" loading={loading} disabled={!pwdOk} color={AMB} />
                </div>
            </form>
        </Modal>
    );
}

function DeleteModal({ account, onClose, onDeleted }: { account: ITAccount; onClose: () => void; onDeleted: (id: string) => void }) {
    const { isDark } = useTheme();
    const t = T(isDark);
    const [loading, setLoading] = useState(false);
    const [err, setErr]   = useState('');

    const confirm = async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/founder/accounts/${account._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` } });
            if (!r.ok && r.status !== 204) throw new Error('Failed to delete');
            onDeleted(account._id); onClose();
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    };

    return (
        <Modal title="Delete Account" width={420} onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '14px 16px', background: `${RED}08`, border: `1px solid ${RED}20`, borderRadius: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 4 }}>{account.name}</div>
                    <div style={{ fontSize: 12, color: t.muted }}>{account.email}</div>
                    <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>This action cannot be undone. The account will be permanently deleted.</div>
                </div>
                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10 }}>
                    <BtnGhost label="Cancel" onClick={onClose} />
                    <BtnPrimary label="Delete Account" loading={loading} onClick={confirm} color={RED} />
                </div>
            </div>
        </Modal>
    );
}

/* ─── Row action dropdown ────────────────────────────────────────────────── */
function ActionMenu({ account, onEdit, onReset, onToggle, onDelete }: { account: ITAccount; onEdit: () => void; onReset: () => void; onToggle: () => void; onDelete: () => void }) {
    const { isDark } = useTheme();
    const t = T(isDark);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);

    const menuItem = (label: string, icon: React.ReactNode, fn: () => void, danger = false) => (
        <button type="button" key={label} onClick={() => { fn(); setOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: danger ? RED : t.text, fontSize: 13, fontWeight: 400, textAlign: 'left', borderRadius: 7, fontFamily: 'inherit', transition: 'background .1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = danger ? `${RED}08` : t.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {icon}{label}
        </button>
    );

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setOpen(p => !p)}
                style={{ width: 30, height: 30, borderRadius: 7, background: open ? t.hover : 'transparent', border: `1px solid ${open ? t.bord : 'transparent'}`, cursor: 'pointer', color: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {open && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', width: 188, background: t.mbg, border: `1px solid ${t.mbord}`, borderRadius: 10, boxShadow: t.shadow, zIndex: 500, padding: '4px', animation: 'facSlide .14s ease-out both' }}>
                    {menuItem('Edit account', <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, onEdit)}
                    {menuItem('Reset password', <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>, onReset)}
                    {menuItem(
                        account.status === 'active' ? 'Deactivate' : 'Activate',
                        account.status === 'active'
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
                        onToggle,
                        account.status === 'active'
                    )}
                    <div style={{ height: 1, background: t.bord2, margin: '3px 6px' }} />
                    {menuItem('Delete account', <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>, onDelete, true)}
                </div>
            )}
        </div>
    );
}

/* ─── Activity event ─────────────────────────────────────────────────────── */
function ActivityEvent({ label, detail, time, color = BLUE }: { label: string; detail: string; time?: string; color?: string }) {
    const { isDark } = useTheme();
    const t = T(isDark);
    return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>{detail}</div>
            </div>
            {time && <div style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{time}</div>}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function FounderAccountsPage() {
    const { isDark } = useTheme();
    const t = T(isDark);

    const [accounts,     setAccounts]     = useState<ITAccount[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');
    const [sortKey,      setSortKey]      = useState<SortKey>('created_at');
    const [sortDir,      setSortDir]      = useState<SortDir>('desc');
    const [page,         setPage]         = useState(1);
    const [showCreate,   setShowCreate]   = useState(false);
    const [editTarget,   setEditTarget]   = useState<ITAccount | null>(null);
    const [resetTarget,  setResetTarget]  = useState<ITAccount | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ITAccount | null>(null);
    const [togglingId,   setTogglingId]   = useState<string | null>(null);

    /* ── Data fetch ── */
    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/founder/accounts`, { headers: { Authorization: `Bearer ${tok()}` } });
            if (r.ok) setAccounts(await r.json());
        } finally { setLoading(false); }
    };
    useEffect(() => { fetchAccounts(); }, []);

    /* ── Filtering + sorting + pagination ── */
    const filtered = useMemo(() => {
        let list = [...accounts];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
        }
        if (statusFilter) list = list.filter(a => a.status === statusFilter);
        list.sort((a, b) => {
            let va: any, vb: any;
            if (sortKey === 'name')       { va = a.name.toLowerCase();  vb = b.name.toLowerCase(); }
            else if (sortKey === 'status'){ va = a.status;               vb = b.status; }
            else { va = a[sortKey] ?? ''; vb = b[sortKey] ?? ''; }
            return sortDir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
        });
        return list;
    }, [accounts, search, statusFilter, sortKey, sortDir]);

    const totalPages  = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
    const safePage    = Math.min(page, totalPages);
    const pageSlice   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const active      = accounts.filter(a => a.status === 'active').length;
    const inactive    = accounts.length - active;
    const todayLogins = accounts.filter(a => {
        if (!a.last_login) return false;
        return new Date(a.last_login).toDateString() === new Date().toDateString();
    }).length;

    /* ── Sort handler ── */
    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
        setPage(1);
    };

    /* ── Toggle status ── */
    const handleToggle = async (acc: ITAccount) => {
        setTogglingId(acc._id);
        try {
            const r = await fetch(`${API}/founder/accounts/${acc._id}/toggle-status`, { method: 'POST', headers: { Authorization: `Bearer ${tok()}` } });
            if (r.ok) { const d = await r.json(); setAccounts(p => p.map(a => a._id === acc._id ? { ...a, status: d.status } : a)); }
        } finally { setTogglingId(null); }
    };

    /* ── Recent activity derived from accounts ── */
    const recentLogins = useMemo(() =>
        [...accounts].filter(a => a.last_login).sort((a, b) => new Date(b.last_login!).getTime() - new Date(a.last_login!).getTime()).slice(0, 6),
        [accounts]
    );
    const recentCreated = useMemo(() =>
        [...accounts].sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime()).slice(0, 5),
        [accounts]
    );

    const colHd = (label: string, key: SortKey) => (
        <button type="button" onClick={() => handleSort(key)}
            style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            {label}<SortIco active={sortKey === key} dir={sortDir} />
        </button>
    );

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s' }}>
            <style>{`.fac-row:hover { background: ${t.hover}; } .fac-row { transition: background .1s; }`}</style>

            <Sidebar />

            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Header title="IT Accounts" subtitle="Founder Console" />

                {/* ── Page content ── */}
                <div style={{ flex: 1, padding: '80px 32px 48px' }}>

                    {/* Page header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-.02em', marginBottom: 4 }}>IT Staff Accounts</h1>
                            <p style={{ fontSize: 13, color: t.muted }}>Manage IT staff access. Only the Founder can provision accounts — no self-registration.</p>
                        </div>
                        <button type="button" onClick={() => setShowCreate(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: '0 2px 12px rgba(29,110,245,.3)', transition: 'opacity .15s' }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Create Account
                        </button>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                        {[
                            { label: 'Total Accounts', value: accounts.length, color: BLUE   },
                            { label: 'Active',          value: active,          color: GRN    },
                            { label: 'Inactive',        value: inactive,        color: '#64748b' },
                            { label: 'Logins Today',    value: todayLogins,     color: PURP   },
                        ].map(s => (
                            <div key={s.label} style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, padding: '14px 18px' }}>
                                <div style={{ fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 6 }}>{s.label}</div>
                                <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Main 2-col layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'flex-start' }}>

                        {/* ── Left: Table ── */}
                        <div>
                            {/* Filter toolbar */}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
                                {/* Search */}
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: t.muted }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or email…"
                                        style={{ width: '100%', padding: '8px 12px 8px 30px', background: t.surf, border: `1.5px solid ${t.bord}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, transition: 'border-color .15s' }}
                                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                                        onBlur={e => (e.currentTarget.style.borderColor = t.bord)} />
                                </div>

                                {/* Status filter */}
                                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
                                    style={{ padding: '8px 12px', background: t.surf, border: `1.5px solid ${t.bord}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                                    <option value="">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>

                                {/* Result count */}
                                <span style={{ fontSize: 12, color: t.muted, whiteSpace: 'nowrap' }}>
                                    {filtered.length} account{filtered.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Table */}
                            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 12, overflow: 'visible' }}>
                                {/* Header row */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 100px 36px', gap: 0, padding: '10px 16px', borderBottom: `1px solid ${t.bord}`, background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', borderRadius: '12px 12px 0 0' }}>
                                    {colHd('Name', 'name')}
                                    {colHd('Status', 'status')}
                                    {colHd('Created', 'created_at')}
                                    {colHd('Last Login', 'last_login')}
                                    <div />
                                </div>

                                {/* Rows */}
                                {loading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0' }}>
                                        <div style={{ width: 18, height: 18, border: `2px solid ${t.bord}`, borderTopColor: BLUE, borderRadius: '50%', animation: 'facSpin 1s linear infinite' }} />
                                        <span style={{ fontSize: 13, color: t.muted }}>Loading accounts…</span>
                                    </div>
                                ) : pageSlice.length === 0 ? (
                                    <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                                        {/* SVG empty state */}
                                        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ display: 'block', margin: '0 auto 16px', opacity: .35 }}>
                                            <circle cx="26" cy="20" r="10" stroke={t.muted} strokeWidth="1.5"/>
                                            <path d="M8 46c0-9.94 8.059-18 18-18s18 8.06 18 18" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round"/>
                                        </svg>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: t.sub, marginBottom: 6 }}>
                                            {search || statusFilter ? 'No accounts match your search' : 'No IT accounts yet'}
                                        </div>
                                        <div style={{ fontSize: 13, color: t.muted, marginBottom: search || statusFilter ? 0 : 16 }}>
                                            {search || statusFilter ? 'Try adjusting your filters or search term.' : 'Create the first IT account for your platform.'}
                                        </div>
                                        {!search && !statusFilter && (
                                            <button type="button" onClick={() => setShowCreate(true)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                                Create first account
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    pageSlice.map((acc, i) => (
                                        <div key={acc._id} className="fac-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 100px 36px', gap: 0, padding: '11px 16px', borderBottom: i < pageSlice.length - 1 ? `1px solid ${t.bord2}` : 'none', alignItems: 'center' }}>
                                            {/* Name + email */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                <Avatar name={acc.name} size={32} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
                                                    <div style={{ fontSize: 11, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</div>
                                                </div>
                                            </div>

                                            {/* Status */}
                                            <div>
                                                {togglingId === acc._id
                                                    ? <span style={{ fontSize: 11, color: t.muted }}>Updating…</span>
                                                    : <StatusBadge status={acc.status} />
                                                }
                                            </div>

                                            {/* Created */}
                                            <div style={{ fontSize: 12, color: t.muted }}>{fmtDate(acc.created_at)}</div>

                                            {/* Last login */}
                                            <div style={{ fontSize: 12, color: acc.last_login ? t.sub : t.muted }}>{relTime(acc.last_login)}</div>

                                            {/* Actions */}
                                            <ActionMenu
                                                account={acc}
                                                onEdit={() => setEditTarget(acc)}
                                                onReset={() => setResetTarget(acc)}
                                                onToggle={() => handleToggle(acc)}
                                                onDelete={() => setDeleteTarget(acc)}
                                            />
                                        </div>
                                    ))
                                )}

                                {/* Pagination */}
                                {filtered.length > PAGE_SIZE && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${t.bord}` }}>
                                        <span style={{ fontSize: 12, color: t.muted }}>
                                            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                                        </span>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button type="button" onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={safePage === 1}
                                                style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: safePage === 1 ? t.muted : t.sub, cursor: safePage === 1 ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: safePage === 1 ? .5 : 1 }}>
                                                ← Prev
                                            </button>
                                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                                const pg = totalPages <= 5 ? i + 1 : safePage <= 3 ? i + 1 : safePage >= totalPages - 2 ? totalPages - 4 + i : safePage - 2 + i;
                                                return (
                                                    <button key={pg} type="button" onClick={() => setPage(pg)}
                                                        style={{ width: 30, height: 28, borderRadius: 6, border: `1px solid ${pg === safePage ? BLUE : t.bord}`, background: pg === safePage ? BLUE : 'transparent', color: pg === safePage ? 'white' : t.sub, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: pg === safePage ? 600 : 400 }}>
                                                        {pg}
                                                    </button>
                                                );
                                            })}
                                            <button type="button" onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={safePage === totalPages}
                                                style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: safePage === totalPages ? t.muted : t.sub, cursor: safePage === totalPages ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: safePage === totalPages ? .5 : 1 }}>
                                                Next →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Right: Activity panel ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Recent Logins */}
                            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 12, padding: '16px 18px' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: t.sub, marginBottom: 12 }}>Recent Logins</div>
                                {recentLogins.length === 0 ? (
                                    <div style={{ fontSize: 12, color: t.muted, padding: '12px 0', textAlign: 'center' }}>No login activity yet.</div>
                                ) : recentLogins.map(a => (
                                    <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: `1px solid ${t.bord2}` }}>
                                        <Avatar name={a.name} size={26} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                                        </div>
                                        <div style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{relTime(a.last_login)}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Audit Timeline */}
                            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 12, padding: '16px 18px' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: t.sub, marginBottom: 4 }}>Account Activity</div>
                                <div style={{ fontSize: 11, color: t.muted, marginBottom: 12 }}>Recent account creations</div>
                                <div style={{ borderLeft: `2px solid ${t.bord}`, paddingLeft: 14 }}>
                                    {recentCreated.length === 0 ? (
                                        <div style={{ fontSize: 12, color: t.muted, padding: '8px 0' }}>No accounts created yet.</div>
                                    ) : recentCreated.map((a, i) => (
                                        <div key={a._id} style={{ marginBottom: i < recentCreated.length - 1 ? 14 : 0, position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: -18, top: 5, width: 7, height: 7, borderRadius: '50%', background: GRN, border: `2px solid ${t.surf}` }} />
                                            <ActivityEvent
                                                label={a.name}
                                                detail={`Account created · ${a.email}`}
                                                time={relTime(a.created_at)}
                                                color={GRN}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Security notice */}
                            <div style={{ background: isDark ? 'rgba(29,110,245,.06)' : 'rgba(29,110,245,.04)', border: `1px solid rgba(29,110,245,.16)`, borderRadius: 12, padding: '14px 16px' }}>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: BLUE, marginBottom: 4 }}>Access Policy</div>
                                        <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.6 }}>
                                            Only the Founder can create IT accounts. Self-registration is disabled across the platform.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showCreate   && <CreateModal   onClose={() => setShowCreate(false)}   onCreated={a => setAccounts(p => [a, ...p])} />}
            {editTarget   && <EditModal     account={editTarget}   onClose={() => setEditTarget(null)}   onUpdated={u => setAccounts(p => p.map(a => a._id === u._id ? u : a))} />}
            {resetTarget  && <ResetPwdModal account={resetTarget}  onClose={() => setResetTarget(null)} />}
            {deleteTarget && <DeleteModal   account={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={id => setAccounts(p => p.filter(a => a._id !== id))} />}
        </div>
    );
}
