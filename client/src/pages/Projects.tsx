import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../contexts/useTheme';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

/* ── Color tokens ─────────────────────────────────────────────────────────── */
const BLUE = '#1d6ef5';
const GRN  = '#10b981';
const RED  = '#ef4444';
const AMB  = '#f59e0b';
const PURP = '#8b5cf6';
const TEAL = '#06b6d4';
const ORNG = '#f97316';
const PINK = '#ec4899';

const T = (d: boolean) => ({
    bg:    d ? '#0b0d14' : '#f1f5f9',
    surf:  d ? '#111420' : '#ffffff',
    surf2: d ? '#161924' : '#f8fafc',
    bord:  d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
    bord2: d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
    text:  d ? '#f1f4f9' : '#0f172a',
    sub:   d ? 'rgba(255,255,255,.60)' : '#334155',
    muted: d ? 'rgba(255,255,255,.32)' : '#94a3b8',
    hover: d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
    inbg:  d ? 'rgba(255,255,255,.04)' : '#f8fafc',
    inbd:  d ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)',
    shadow:d ? '0 20px 60px rgba(0,0,0,.6)' : '0 12px 40px rgba(0,0,0,.1)',
});

/* ── Configs ──────────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string }> = {
    ACTIVE:    { label: 'Active',    color: GRN       },
    ON_HOLD:   { label: 'On Hold',   color: '#eab308' },
    COMPLETED: { label: 'Completed', color: BLUE      },
};

function getStatusCfg(status: string) {
    return STATUS_CFG[status] ?? STATUS_CFG[status?.toUpperCase()] ?? { label: status, color: '#eab308' };
}

const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: RED  },
    high:   { label: 'High',   color: ORNG },
    medium: { label: 'Medium', color: AMB  },
    low:    { label: 'Low',    color: TEAL },
};

const CHANNEL_GRADIENT: Record<string, string> = {
    'public-group':  'linear-gradient(135deg, #1a56db 0%, #7c3aed 100%)',
    'all-sub-admin': 'linear-gradient(135deg, #ea580c 0%, #b91c1c 100%)',
};

const GROUP_CFG: Record<string, { label: string; typeLabel: string; icon: string; color: string; desc: string }> = {
    'public-group':  { label: 'public',        typeLabel: 'Public Channel', icon: '🌐', color: BLUE, desc: 'Open to all workspace members'     },
    'all-sub-admin': { label: 'all-sub-admin',  typeLabel: 'Admin Channel',  icon: '👥', color: PURP, desc: 'Manager coordination channel'       },
};

const TEAM_COLORS = [BLUE, PURP, GRN, TEAL, ORNG, AMB, RED, PINK];
const teamColor   = (name: string) => TEAM_COLORS[((name.charCodeAt(0) ?? 0) * 3 + name.length) % TEAM_COLORS.length];

/* ── Types ────────────────────────────────────────────────────────────────── */
type Person    = { id: string; name: string; email?: string };
type Team      = {
    id: string; name: string; description?: string; memberCount?: number;
    user_role?: string; manager_name?: string;
    active_project_count?: number; last_activity?: string;
    status?: string; created_at?: string;
};
type WsProject = {
    id: string; title: string; description: string;
    status: string; priority?: string; progress: number;
    team_id?: string; sub_admins?: Person[]; staff?: Person[];
    due_date?: string; updated_at?: string;
    is_system_card?: boolean; owner_id?: string;
};
type TabId = 'overview' | 'projects' | 'teams';

/* ── Auth ─────────────────────────────────────────────────────────────────── */
const ah = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'X-User-Id': localStorage.getItem('userId') ?? '',
});

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function fmtDate(iso?: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtRelative(iso?: string | null) {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return fmtDate(iso);
}
function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
}
function avatarBg(name: string) {
    const hue = ((name.charCodeAt(0) ?? 0) * 47 + (name.charCodeAt(1) ?? 0) * 13) % 360;
    return `linear-gradient(135deg, hsl(${hue},55%,44%), hsl(${hue + 40},48%,32%))`;
}

/* ── Atoms ────────────────────────────────────────────────────────────────── */
function UAv({ name, size = 24 }: { name: string; size?: number }) {
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', background: avatarBg(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .38), fontWeight: 700, color: 'white', flexShrink: 0, letterSpacing: '-.01em', userSelect: 'none' }}>
            {initials(name)}
        </div>
    );
}
function PBar({ pct, color = GRN, isDark }: { pct: number; color?: string; isDark: boolean }) {
    return (
        <div style={{ height: 3, borderRadius: 4, background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', overflow: 'hidden', width: '100%' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width .5s' }} />
        </div>
    );
}
function fld(t: ReturnType<typeof T>): React.CSSProperties {
    return { width: '100%', padding: '8px 11px', background: t.inbg, border: `1.5px solid ${t.inbd}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', transition: 'border-color .15s' };
}
function FieldWrap({ label, required, isDark, children }: { label: string; required?: boolean; isDark: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T(isDark).sub, marginBottom: 5 }}>
                {label}{required && <span style={{ color: RED, marginLeft: 3 }}>*</span>}
            </label>
            {children}
        </div>
    );
}
function ErrBanner({ msg }: { msg: string }) {
    return <div style={{ padding: '9px 12px', background: `${RED}08`, border: `1px solid ${RED}20`, borderRadius: 8, fontSize: 12, color: RED }}>{msg}</div>;
}
function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
    useEffect(() => { const id = setTimeout(onDone, 3500); return () => clearTimeout(id); }, [msg, onDone]);
    return (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 900, padding: '11px 18px', borderRadius: 10, background: ok ? GRN : RED, color: 'white', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)', animation: 'wsSlide .2s ease-out both' }}>
            {msg}
        </div>
    );
}

/* ── Modal shell ──────────────────────────────────────────────────────────── */
function ModalShell({ title, subtitle, onClose, children, isDark, wide }: {
    title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; isDark: boolean; wide?: boolean;
}) {
    const t = T(isDark);
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '"Inter",-apple-system,sans-serif' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)' }} />
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: wide ? 700 : 560, maxHeight: '92vh', overflowY: 'auto', background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 16, boxShadow: t.shadow, animation: 'wsSlide .18s ease-out both' }}>
                <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: t.surf, zIndex: 1, borderRadius: '16px 16px 0 0' }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{title}</div>
                        {subtitle && <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{subtitle}</div>}
                    </div>
                    <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: t.hover, border: `1px solid ${t.bord}`, cursor: 'pointer', color: t.muted, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>
                {children}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CREATE TEAM MODAL — 2-step: details + member assignment
   POST /teams accepts: name, description, managerIds, subManagerIds, staffIds
══════════════════════════════════════════════════════════════════════════════ */
function CreateTeamModal({ onClose, onCreated, isDark, allUsers }: {
    onClose: () => void; onCreated: () => void; isDark: boolean; allUsers: any[];
}) {
    const t = T(isDark); const f = fld(t);
    const [step,    setStep]    = useState(1);
    const [name,    setName]    = useState('');
    const [desc,    setDesc]    = useState('');
    const [color,   setColor]   = useState(BLUE);
    const [loading, setLoading] = useState(false);
    const [err,     setErr]     = useState('');
    const [managerIds,  setManagerIds]  = useState<string[]>([]);
    const [subAdminIds, setSubAdminIds] = useState<string[]>([]);
    const [staffIds,    setStaffIds]    = useState<string[]>([]);

    const managers  = allUsers.filter(u => ['admin', 'manager'].includes(u.role));
    const subAdmins = allUsers.filter(u => ['sub_admin', 'subadmin'].includes(u.role));
    const staffList = allUsers.filter(u => u.role === 'staff');

    const toggleId = (id: string, list: string[], setList: (l: string[]) => void) =>
        setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

    const submit = async () => {
        setErr(''); setLoading(true);
        try {
            const payload = {
                name: name.trim(), description: desc.trim(),
                managerIds,
                subManagerIds: subAdminIds,
                staffIds,
            };
            const r = await fetch(`${API}/teams`, { method: 'POST', headers: ah(), body: JSON.stringify(payload) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
            onCreated(); onClose();
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
    };

    const UserPick = ({ users, selected, onToggle, empty, roleLabel }: {
        users: any[]; selected: string[]; onToggle: (id: string) => void; empty: string; roleLabel: string;
    }) => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.sub }}>{roleLabel}</label>
                {selected.length > 0 && <span style={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>{selected.length} selected</span>}
            </div>
            <div style={{ maxHeight: 150, overflowY: 'auto', border: `1px solid ${t.bord}`, borderRadius: 8 }}>
                {users.length === 0
                    ? <div style={{ padding: 12, fontSize: 12, color: t.muted, textAlign: 'center' }}>{empty}</div>
                    : users.map(u => {
                        const uid = u._id ?? u.id; const sel = selected.includes(uid);
                        return (
                            <div key={uid} onClick={() => onToggle(uid)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer', borderBottom: `1px solid ${t.bord2}`, background: sel ? `${BLUE}08` : 'transparent', transition: 'background .1s' }}
                                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = t.hover; }}
                                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
                                <UAv name={u.name || u.email || 'U'} size={24} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unnamed'}</div>
                                    <div style={{ fontSize: 11, color: t.muted }}>{u.email}</div>
                                </div>
                                {sel && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                        );
                    })}
            </div>
        </div>
    );

    return (
        <ModalShell title="New Team" subtitle={`Step ${step} of 2 — ${step === 1 ? 'Details' : 'Add Members'}`} onClose={onClose} isDark={isDark} wide>
            {/* Step indicators */}
            <div style={{ padding: '10px 24px 12px', borderBottom: `1px solid ${t.bord}`, display: 'flex', alignItems: 'center', gap: 0 }}>
                {['Details', 'Members'].map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === 0 ? 1 : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: i + 1 <= step ? BLUE : t.inbg, border: `1.5px solid ${i + 1 <= step ? BLUE : t.inbd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i + 1 <= step ? 'white' : t.muted, transition: 'all .2s' }}>
                                {i + 1 < step ? '✓' : i + 1}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: i + 1 === step ? 600 : 400, color: i + 1 === step ? t.text : t.muted }}>{s}</span>
                        </div>
                        {i === 0 && <div style={{ flex: 1, height: 1, background: step > 1 ? BLUE : t.bord, margin: '0 12px', transition: 'background .2s' }} />}
                    </div>
                ))}
            </div>

            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {step === 1 && <>
                    <div style={{ height: 3, borderRadius: 4, background: color }} />
                    <FieldWrap label="Team name" required isDark={isDark}>
                        <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Design Team" style={f}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </FieldWrap>
                    <FieldWrap label="Description" isDark={isDark}>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What does this team work on?" rows={2}
                            style={{ ...f, resize: 'vertical' as const }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </FieldWrap>
                    <FieldWrap label="Color" isDark={isDark}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {TEAM_COLORS.map(c => (
                                <button key={c} type="button" onClick={() => setColor(c)}
                                    style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: color === c ? '3px solid white' : '2px solid transparent', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', cursor: 'pointer', transition: 'all .15s', flexShrink: 0 }} />
                            ))}
                        </div>
                    </FieldWrap>
                </>}

                {step === 2 && <>
                    <div style={{ padding: '9px 12px', borderRadius: 8, background: `${BLUE}06`, border: `1px solid ${BLUE}14`, fontSize: 12, color: t.sub, lineHeight: 1.5 }}>
                        Add members to <strong style={{ color: t.text }}>{name}</strong>. All fields are optional — you can also add members later.
                    </div>
                    <UserPick users={managers}  selected={managerIds}  onToggle={id => toggleId(id, managerIds,  setManagerIds)}  empty="No managers found"  roleLabel="Managers (Admin)" />
                    <UserPick users={subAdmins} selected={subAdminIds} onToggle={id => toggleId(id, subAdminIds, setSubAdminIds)} empty="No sub admins found" roleLabel="Sub Admins" />
                    <UserPick users={staffList} selected={staffIds}    onToggle={id => toggleId(id, staffIds,    setStaffIds)}    empty="No staff found"     roleLabel="Staff Members" />
                    {(managerIds.length + subAdminIds.length + staffIds.length) > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {[...managerIds, ...subAdminIds, ...staffIds].map(id => {
                                const u = allUsers.find(x => (x._id ?? x.id) === id);
                                return u ? (
                                    <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: `${BLUE}12`, fontSize: 11, color: BLUE, fontWeight: 500 }}>
                                        {u.name || u.email}
                                    </span>
                                ) : null;
                            })}
                        </div>
                    )}
                </>}

                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={step > 1 ? () => setStep(1) : onClose}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {step > 1 ? '← Back' : 'Cancel'}
                    </button>
                    {step === 1
                        ? <button type="button" disabled={!name.trim()} onClick={() => setStep(2)}
                            style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: !name.trim() ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: !name.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                            Next: Add Members →
                          </button>
                        : <button type="button" onClick={submit} disabled={loading}
                            style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: loading ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                            {loading ? 'Creating…' : `Create Team${(managerIds.length + subAdminIds.length + staffIds.length) > 0 ? ` · ${managerIds.length + subAdminIds.length + staffIds.length} members` : ''}`}
                          </button>
                    }
                </div>
            </div>
        </ModalShell>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TEAM MEMBERS MODAL — fetches GET /teams/{id}/members
══════════════════════════════════════════════════════════════════════════════ */
function TeamMembersModal({ team, isDark, onClose }: { team: Team; isDark: boolean; onClose: () => void }) {
    const t = T(isDark);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [err,     setErr]     = useState('');

    useEffect(() => {
        fetch(`${API}/teams/${team.id}/members`, { headers: ah() })
            .then(async r => {
                if (!r.ok) throw new Error('Could not load members');
                return r.json();
            })
            .then(setMembers)
            .catch(e => setErr(e.message))
            .finally(() => setLoading(false));
    }, [team.id]);

    const byRole = {
        admin:    members.filter(m => ['admin', 'manager'].includes(m.role?.toLowerCase())),
        subadmin: members.filter(m => ['subadmin', 'sub_admin'].includes(m.role?.toLowerCase())),
        member:   members.filter(m => m.role?.toLowerCase() === 'member'),
    };

    const RoleGroup = ({ title, items, color }: { title: string; items: any[]; color: string }) => {
        if (items.length === 0) return null;
        return (
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</span>
                    <span style={{ fontSize: 11, color: t.muted }}>· {items.length}</span>
                </div>
                {items.map(m => (
                    <div key={m._id ?? m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: t.surf2, marginBottom: 4 }}>
                        <UAv name={m.user_full_name || m.user_id || 'U'} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.user_full_name || 'Unknown user'}
                            </div>
                            <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>
                                {m.user_id}
                            </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${color}14`, color, textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>
                            {m.role}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <ModalShell title={team.name} subtitle={`${members.length} member${members.length !== 1 ? 's' : ''}`} onClose={onClose} isDark={isDark}>
            <div style={{ padding: '20px 24px' }}>
                {/* Team color bar */}
                <div style={{ height: 3, borderRadius: 4, background: teamColor(team.name), marginBottom: 18 }} />

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: t.muted, fontSize: 13 }}>Loading members…</div>
                ) : err ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: RED, fontSize: 13 }}>{err}</div>
                ) : members.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.sub }}>No members yet</div>
                        <div style={{ fontSize: 12, color: t.muted }}>Create a new team and add members from the creation form.</div>
                    </div>
                ) : (
                    <>
                        <RoleGroup title="Admins / Managers" items={byRole.admin}    color={BLUE} />
                        <RoleGroup title="Sub Admins"         items={byRole.subadmin} color={PURP} />
                        <RoleGroup title="Staff Members"      items={byRole.member}   color={GRN}  />
                    </>
                )}

                <button type="button" onClick={onClose}
                    style={{ marginTop: 8, width: '100%', padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Close
                </button>
            </div>
        </ModalShell>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CREATE PROJECT MODAL — 3-step
══════════════════════════════════════════════════════════════════════════════ */
function CreateProjectModal({ teams, allUsers, initialTeamId, onClose, onCreated, isDark }: {
    teams: Team[]; allUsers: any[]; initialTeamId?: string;
    onClose: () => void; onCreated: () => void; isDark: boolean;
}) {
    const t = T(isDark); const f = fld(t);
    const [step, setStep] = useState(1); const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
    const [title, setTitle] = useState(''); const [desc, setDesc] = useState('');
    const [teamId, setTeamId] = useState(initialTeamId ?? ''); const [priority, setPriority] = useState('medium');
    const [projStatus, setProjStatus] = useState('ACTIVE');
    const [subAdminIds, setSubAdminIds] = useState<string[]>([]); const [staffIds, setStaffIds] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');
    const [teamAutoFilled, setTeamAutoFilled] = useState(false);
    const subAdmins = allUsers.filter(u => ['sub_admin', 'subadmin', 'manager'].includes(u.role));
    const staffList = allUsers.filter(u => u.role === 'staff');
    const toggleId  = (id: string, list: string[], setList: (l: string[]) => void) =>
        setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

    const handleTeamChange = async (newTeamId: string) => {
        setTeamId(newTeamId);
        if (!newTeamId) { setTeamAutoFilled(false); return; }
        try {
            const r = await fetch(`${API}/teams/${newTeamId}/members`, { headers: ah() });
            if (!r.ok) return;
            const members: any[] = await r.json();
            const newSubAdmins = members
                .filter(m => ['subadmin','sub_admin','manager'].includes(m.role?.toLowerCase()))
                .map(m => m.user_id);
            const newStaff = members
                .filter(m => m.role?.toLowerCase() === 'member')
                .map(m => m.user_id);
            setSubAdminIds(newSubAdmins);
            setStaffIds(newStaff);
            setTeamAutoFilled(true);
        } catch { /* silently ignore */ }
    };

    useEffect(() => { if (initialTeamId) void handleTeamChange(initialTeamId); }, []);
    const STEPS = ['Details', 'Assign Team', 'Schedule'];
    const submit = async () => {
        setErr(''); setLoading(true);
        try {
            const payload: Record<string, unknown> = { title: title.trim(), description: desc.trim(), status: projStatus, priority, progress: 0, sub_admin_ids: subAdminIds, staff_ids: staffIds, due_date: dueDate || undefined };
            if (teamId) payload.team_id = teamId;
            const r = await fetch(`${API}/projects`, { method: 'POST', headers: ah(), body: JSON.stringify(payload) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
            onCreated(); onClose();
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
    };
    const UserPick = ({ users, selected, onToggle, empty }: { users: any[]; selected: string[]; onToggle: (id: string) => void; empty: string }) => (
        <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${t.bord}`, borderRadius: 8 }}>
            {users.length === 0 ? <div style={{ padding: 12, fontSize: 12, color: t.muted, textAlign: 'center' }}>{empty}</div>
                : users.map(u => { const uid = u._id ?? u.id; const sel = selected.includes(uid); return (
                    <div key={uid} onClick={() => onToggle(uid)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${t.bord2}`, background: sel ? `${BLUE}08` : 'transparent', transition: 'background .1s' }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = t.hover; }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
                        <UAv name={u.name || u.email || 'U'} size={26} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unnamed'}</div>
                            <div style={{ fontSize: 11, color: t.muted }}>{u.email}</div>
                        </div>
                        {sel && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>); })}
        </div>
    );
    return (
        <ModalShell title="New Project" subtitle={`Step ${step} of ${STEPS.length} — ${STEPS[step - 1]}`} onClose={onClose} isDark={isDark} wide>
            <div style={{ padding: '12px 24px 14px', borderBottom: `1px solid ${t.bord}` }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {STEPS.map((s, i) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: i + 1 <= step ? BLUE : t.inbg, border: `1.5px solid ${i + 1 <= step ? BLUE : t.inbd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i + 1 <= step ? 'white' : t.muted, transition: 'all .2s' }}>
                                    {i + 1 < step ? '✓' : i + 1}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: i + 1 === step ? 600 : 400, color: i + 1 === step ? t.text : t.muted }}>{s}</span>
                            </div>
                            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i + 1 < step ? BLUE : t.bord, margin: '0 12px', transition: 'background .2s' }} />}
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {step === 1 && <>
                    <FieldWrap label="Project name" required isDark={isDark}>
                        <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Website Redesign" style={f}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </FieldWrap>
                    <FieldWrap label="Description" isDark={isDark}>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What is this project about?" rows={2}
                            style={{ ...f, resize: 'vertical' as const }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </FieldWrap>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <FieldWrap label="Team" isDark={isDark}>
                            <select value={teamId} onChange={e => void handleTeamChange(e.target.value)} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                                onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                                <option value="">No team</option>
                                {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                            </select>
                            {teamAutoFilled && teamId && (
                                <div style={{ marginTop: 5, fontSize: 11, color: GRN, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    Members auto-filled from team — you can adjust in step 2
                                </div>
                            )}
                        </FieldWrap>
                        <FieldWrap label="Status" isDark={isDark}>
                            <select value={projStatus} onChange={e => setProjStatus(e.target.value)} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                                onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                                <option value="ACTIVE">Active</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </FieldWrap>
                    </div>
                    <FieldWrap label="Priority" isDark={isDark}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {Object.entries(PRIORITY_CFG).map(([k, v]) => (
                                <button key={k} type="button" onClick={() => setPriority(k)}
                                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1.5px solid ${priority === k ? v.color : t.bord}`, background: priority === k ? `${v.color}12` : 'transparent', color: priority === k ? v.color : t.sub, fontSize: 12, fontWeight: priority === k ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </FieldWrap>
                </>}
                {step === 2 && <>
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: `${BLUE}06`, border: `1px solid ${BLUE}14`, fontSize: 12, color: t.sub, lineHeight: 1.5 }}>
                        Assign a <strong style={{ color: t.text }}>Sub Admin</strong> to manage this project, and <strong style={{ color: t.text }}>Staff Members</strong> to execute it.
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: t.sub }}>Sub Admin / Manager</label>
                            {subAdminIds.length > 0 && <span style={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>{subAdminIds.length} selected</span>}
                        </div>
                        <UserPick users={subAdmins} selected={subAdminIds} onToggle={id => toggleId(id, subAdminIds, setSubAdminIds)} empty="No sub admins found" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: t.sub }}>Staff Members</label>
                            {staffIds.length > 0 && <span style={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>{staffIds.length} selected</span>}
                        </div>
                        <UserPick users={staffList} selected={staffIds} onToggle={id => toggleId(id, staffIds, setStaffIds)} empty="No staff found" />
                    </div>
                </>}
                {step === 3 && <>
                    <FieldWrap label="Due date" isDark={isDark}>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={f}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </FieldWrap>
                    <div style={{ background: t.surf2, border: `1px solid ${t.bord}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.bord}`, fontSize: 11, fontWeight: 600, color: t.sub, textTransform: 'uppercase', letterSpacing: '.07em' }}>Summary</div>
                        {[{ label: 'Project', value: title || '—' }, { label: 'Team', value: teams.find(tm => tm.id === teamId)?.name || 'Standalone' }, { label: 'Status', value: STATUS_CFG[projStatus]?.label || projStatus }, { label: 'Priority', value: PRIORITY_CFG[priority]?.label || priority }, { label: 'Sub Admins', value: `${subAdminIds.length} assigned` }, { label: 'Staff', value: `${staffIds.length} assigned` }].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${t.bord2}` }}>
                                <span style={{ fontSize: 12, color: t.sub }}>{row.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                </>}
                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={step > 1 ? () => setStep(s => s - 1) : onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {step > 1 ? '← Back' : 'Cancel'}
                    </button>
                    {step < STEPS.length
                        ? <button type="button" disabled={step === 1 && !title.trim()} onClick={() => setStep(s => s + 1)} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: (step === 1 && !title.trim()) ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: (step === 1 && !title.trim()) ? 'default' : 'pointer', fontFamily: 'inherit' }}>Continue →</button>
                        : <button type="button" onClick={submit} disabled={loading} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: loading ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                            {loading ? 'Creating…' : 'Create Project'}
                          </button>
                    }
                </div>
            </div>
        </ModalShell>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   EDIT PROJECT MODAL
   PATCH /projects/{id} supports: title, description, status, sub_admin_ids, due_date
   priority and team_id are set at creation only; staff uses a separate endpoint
══════════════════════════════════════════════════════════════════════════════ */
function EditProjectModal({ project, allUsers, onClose, onSaved, isDark }: {
    project: WsProject; allUsers: any[];
    onClose: () => void; onSaved: () => void; isDark: boolean;
}) {
    const t = T(isDark); const f = fld(t);
    const [loading, setLoading] = useState(false);
    const [err, setErr]         = useState('');
    const [title, setTitle]     = useState(project.title);
    const [desc, setDesc]       = useState(project.description || '');
    const [status, setStatus]   = useState(project.status || 'ACTIVE');
    const [dueDate, setDueDate] = useState(project.due_date ? project.due_date.split('T')[0] : '');
    const [subAdminIds, setSubAdminIds] = useState<string[]>((project.sub_admins ?? []).map(s => s.id));

    const subAdmins = allUsers.filter(u => ['sub_admin', 'subadmin', 'manager'].includes(u.role));
    const toggleId  = (id: string, list: string[], setList: (l: string[]) => void) =>
        setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

    /* Only send fields that ProjectUpdate schema accepts */
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setErr(''); setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                title: title.trim(),
                description: desc.trim(),
                status,
                sub_admin_ids: subAdminIds,
                due_date: dueDate || undefined,
            };
            const r = await fetch(`${API}/projects/${project.id}`, { method: 'PATCH', headers: ah(), body: JSON.stringify(payload) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed to save'); }
            onSaved(); onClose();
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
    };

    const priorityCfg = project.priority ? PRIORITY_CFG[project.priority] : null;

    return (
        <ModalShell title="Edit Project" subtitle={project.title} onClose={onClose} isDark={isDark} wide>
            <form onSubmit={submit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Read-only info strip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: t.inbg, border: `1px solid ${t.bord}` }}>
                    <span style={{ fontSize: 11, color: t.muted }}>Priority:</span>
                    {priorityCfg
                        ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: `${priorityCfg.color}12`, color: priorityCfg.color }}>{priorityCfg.label}</span>
                        : <span style={{ fontSize: 11, color: t.muted }}>—</span>
                    }
                    <span style={{ fontSize: 11, color: t.muted, marginLeft: 8 }}>Priority and team cannot be changed after creation.</span>
                </div>

                <FieldWrap label="Project name" required isDark={isDark}>
                    <input value={title} onChange={e => setTitle(e.target.value)} required style={f}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </FieldWrap>
                <FieldWrap label="Description" isDark={isDark}>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                        style={{ ...f, resize: 'vertical' as const }}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </FieldWrap>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FieldWrap label="Status" isDark={isDark}>
                        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...f, background: isDark ? '#0f1220' : '#fff' }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                            <option value="ACTIVE">Active</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </FieldWrap>
                    <FieldWrap label="Due Date" isDark={isDark}>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={f}
                            onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                    </FieldWrap>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: t.sub }}>Manager / Sub Admin</label>
                        {subAdminIds.length > 0 && <span style={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>{subAdminIds.length} selected</span>}
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${t.bord}`, borderRadius: 8 }}>
                        {subAdmins.length === 0
                            ? <div style={{ padding: 12, fontSize: 12, color: t.muted, textAlign: 'center' }}>No sub admins found</div>
                            : subAdmins.map(u => {
                                const uid = u._id ?? u.id; const sel = subAdminIds.includes(uid);
                                return (
                                    <div key={uid} onClick={() => toggleId(uid, subAdminIds, setSubAdminIds)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${t.bord2}`, background: sel ? `${BLUE}08` : 'transparent', transition: 'background .1s' }}
                                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = t.hover; }}
                                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
                                        <UAv name={u.name || u.email || 'U'} size={24} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unnamed'}</div>
                                            <div style={{ fontSize: 11, color: t.muted }}>{u.email}</div>
                                        </div>
                                        {sel && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="submit" disabled={loading || !title.trim()} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: (!title.trim() || loading) ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: (!title.trim() || loading) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONFIRM DELETE
══════════════════════════════════════════════════════════════════════════════ */
function ConfirmDeleteModal({ project, onConfirm, onClose, loading, isDark }: { project: WsProject; onConfirm: () => void; onClose: () => void; loading: boolean; isDark: boolean }) {
    const t = T(isDark);
    return (
        <ModalShell title="Delete Project" onClose={onClose} isDark={isDark}>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 14, color: t.sub, lineHeight: 1.6, margin: 0 }}>
                    Permanently delete <strong style={{ color: t.text }}>{project.title}</strong>? All tasks and data will be lost.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="button" onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: loading ? `${RED}55` : RED, color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {loading ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   STATS STRIP
══════════════════════════════════════════════════════════════════════════════ */
function StatsStrip({ projects, isDark }: { projects: WsProject[]; isDark: boolean }) {
    const t = T(isDark);
    const active    = projects.filter(p => p.status === 'ACTIVE').length;
    const onHold    = projects.filter(p => p.status === 'ON_HOLD').length;
    const completed = projects.filter(p => p.status === 'COMPLETED').length;
    const managers  = new Set(projects.flatMap(p => (p.sub_admins ?? []).map(s => s.id))).size;
    const members   = new Set(projects.flatMap(p => (p.staff ?? []).map(s => s.id))).size;
    const lastAct   = projects.reduce<string | null>((l, p) => (!p.updated_at || (l && p.updated_at < l)) ? l : p.updated_at, null);
    const Pill = ({ value, label, color, dot }: { value: number; label: string; color: string; dot?: boolean }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: t.surf2, border: `1px solid ${t.bord}` }}>
            {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}88`, flexShrink: 0 }} />}
            <span style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 11, color: t.muted, lineHeight: 1 }}>{label}</span>
        </div>
    );
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 32px', background: t.surf, borderBottom: `1px solid ${t.bord}`, flexWrap: 'wrap' }}>
            <Pill value={projects.length} label="Total"   color={t.text as string} />
            <div style={{ width: 1, height: 22, background: t.bord, margin: '0 2px', flexShrink: 0 }} />
            <Pill value={active}    label="Active"  color={GRN}  dot />
            <Pill value={onHold}    label="On Hold" color={AMB}  dot />
            <Pill value={completed} label="Done"    color={BLUE} dot />
            <div style={{ width: 1, height: 22, background: t.bord, margin: '0 2px', flexShrink: 0 }} />
            <Pill value={managers} label="Managers" color={PURP} />
            <Pill value={members}  label="Staff"    color={TEAL} />
            {lastAct && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, background: t.surf2, border: `1px solid ${t.bord}` }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN, boxShadow: `0 0 6px ${GRN}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: t.muted }}>Last activity</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.sub }}>{fmtRelative(lastAct)}</span>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CHANNEL CARD — Discord + Slack inspired premium communication hub
══════════════════════════════════════════════════════════════════════════════ */
function ChannelSparkline({ seed, color }: { seed: number; color: string }) {
    const bars = Array.from({ length: 14 }, (_, i) => {
        const v = ((seed * 13 + i * 47 + i * i * 7) % 80) + 20;
        return Math.min(100, v);
    });
    const maxH = 18;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: maxH }}>
            {bars.map((h, i) => (
                <div key={i} style={{
                    width: 5, borderRadius: 3,
                    height: `${(h / 100) * maxH}px`,
                    background: color,
                    opacity: 0.3 + (h / 100) * 0.6,
                    transition: 'height .3s',
                }} />
            ))}
        </div>
    );
}

function ChannelStatPill({ icon, value, label, accent }: { icon: React.ReactNode; value: string | number; label: string; accent?: string }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 10px', borderRadius: 10,
            background: 'rgba(0,0,0,.22)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.1)', flex: 1, minWidth: 0,
        }}>
            <span style={{ color: accent ?? 'rgba(255,255,255,.7)', display: 'flex', flexShrink: 0 }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '-.02em' }}>{value}</div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{label}</div>
            </div>
        </div>
    );
}

function ChannelCard({ group, isDark, onClick, overrideMemberCount, extraStats }: {
    group: WsProject; isDark: boolean; onClick: () => void; overrideMemberCount?: number;
    extraStats?: { totalProjects: number; activeProjects: number };
}) {
    const isPublic    = group.id === 'public-group';
    const cfg         = GROUP_CFG[group.id] ?? { label: group.title?.toLowerCase().replace(/\s+/g, '-'), typeLabel: 'Channel', icon: '💬', color: BLUE, desc: (group as any).description };
    const gradient    = CHANNEL_GRADIENT[group.id] ?? `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.color}bb 100%)`;
    const memberCount = overrideMemberCount ?? ((group.staff ?? []).length + (group.sub_admins ?? []).length);
    const onlineCount = Math.max(1, Math.round(memberCount * 0.38));
    const sparkSeed   = isPublic ? 3741 : 6823;
    const [hover, setHover] = useState(false);

    /* SVG icons */
    const IcoUsers   = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
    const IcoOnline  = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>;
    const IcoFolder  = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>;
    const IcoFlash   = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;

    const stats = isPublic
        ? [
            { icon: IcoUsers,  value: memberCount,                          label: 'Members',  accent: 'rgba(147,197,253,1)' },
            { icon: IcoOnline, value: onlineCount,                          label: 'Online',   accent: '#4ade80' },
            { icon: IcoFolder, value: extraStats?.totalProjects  ?? '—',    label: 'Projects', accent: 'rgba(196,181,253,1)' },
            { icon: IcoFlash,  value: extraStats?.activeProjects ?? '—',    label: 'Active',   accent: '#fbbf24' },
          ]
        : [
            { icon: IcoUsers,  value: memberCount,                          label: 'Leaders',  accent: '#fb923c' },
            { icon: IcoOnline, value: onlineCount,                          label: 'Online',   accent: '#4ade80' },
            { icon: IcoFolder, value: extraStats?.totalProjects  ?? '—',    label: 'Projects', accent: '#fbbf24' },
            { icon: IcoFlash,  value: extraStats?.activeProjects ?? '—',    label: 'Active',   accent: '#f87171' },
          ];

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: gradient, borderRadius: 16, padding: '18px 20px 16px',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0,
                transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s',
                transform: hover ? 'translateY(-6px) scale(1.012)' : 'none',
                boxShadow: hover ? '0 28px 64px rgba(0,0,0,.42)' : '0 8px 32px rgba(0,0,0,.28)',
            }}
        >
            {/* ── Decorative noise / depth orbs ── */}
            <div style={{ position: 'absolute', right: -80, top: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: -50, bottom: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(0,0,0,.12)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: 60, bottom: 30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />

            {/* ── Row 1: Live pill + type badge ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Animated live dot */}
                    <div style={{ position: 'relative', width: 8, height: 8 }}>
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 0 0 rgba(74,222,128,.7)', animation: 'livePulse 2s infinite' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)' }}>{cfg.typeLabel}</span>
                </div>
                {/* Hash icon badge */}
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,.9)' }}>#</div>
            </div>

            {/* ── Row 2: Channel name ── */}
            <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '-.04em', lineHeight: 1.05, display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 300, opacity: .4, lineHeight: 1.5 }}>#</span>
                    {cfg.label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 3, lineHeight: 1.4 }}>{cfg.desc}</div>
            </div>

            {/* ── Row 3: Stats grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, position: 'relative' }}>
                {stats.map(s => (
                    <ChannelStatPill key={s.label} icon={s.icon} value={s.value} label={s.label} accent={s.accent} />
                ))}
            </div>

            {/* ── Row 4: Activity sparkline ── */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', flexShrink: 0 }}>Trend</span>
                <ChannelSparkline seed={sparkSeed} color="rgba(255,255,255,.9)" />
            </div>

            {/* ── Row 5: Footer ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.15)', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {group.updated_at ? fmtRelative(group.updated_at) : 'Active'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        0 unread
                    </div>
                </div>
                <button type="button"
                    onClick={e => { e.stopPropagation(); onClick(); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 16px', borderRadius: 9,
                        border: '1.5px solid rgba(255,255,255,.4)',
                        background: hover ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.18)',
                        color: 'white', fontSize: 12, fontWeight: 800,
                        cursor: 'pointer', fontFamily: 'inherit',
                        backdropFilter: 'blur(12px)',
                        transition: 'background .18s, transform .18s',
                        transform: hover ? 'scale(1.04)' : 'none',
                        letterSpacing: '.02em',
                        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
                    }}>
                    Open Channel
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>

            <style>{`@keyframes livePulse { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.7)} 50%{box-shadow:0 0 0 5px rgba(74,222,128,0)} }`}</style>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PROJECT CARD — 3-dot menu (Edit + Delete)
══════════════════════════════════════════════════════════════════════════════ */
function HRow({ label, person, extra, isDark }: { label: string; person?: { name: string; email?: string } | null; extra?: string; isDark: boolean }) {
    const t = T(isDark);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', width: 56, flexShrink: 0 }}>{label}</span>
            {person ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UAv name={person.name || (person as any).email || '?'} size={18} />
                    <span style={{ fontSize: 12, color: t.sub, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                        {person.name || (person as any).email || 'Unknown'}
                    </span>
                    {extra && <span style={{ fontSize: 10, color: t.muted }}>{extra}</span>}
                </div>
            ) : (
                <span style={{ fontSize: 11, color: t.muted, fontStyle: 'italic' }}>Unassigned</span>
            )}
        </div>
    );
}

function ProjectCard({ project, team, allUsers, isDark, role, onClick, onEdit, onDelete, onChangeStatus }: {
    project: WsProject; team?: Team; allUsers: any[]; isDark: boolean; role: string;
    onClick: () => void; onEdit: () => void; onDelete: () => void;
    onChangeStatus?: (status: string) => void;
}) {
    const t = T(isDark);
    const [hover, setHover]       = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [statusSub, setStatusSub] = useState(false);

    const statusCfg = getStatusCfg(project.status);
    const priorityCfg = project.priority ? PRIORITY_CFG[project.priority] : null;
    const owner     = allUsers.find(u => (u._id ?? u.id) === project.owner_id) ?? null;
    const primarySA = (project.sub_admins ?? [])[0] ?? null;
    const extraSA   = (project.sub_admins ?? []).length - 1;
    const staffList = project.staff ?? [];

    useEffect(() => {
        if (!menuOpen) return;
        const close = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('[data-proj-menu]') === null) setMenuOpen(false); };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [menuOpen]);

    return (
        <div
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onClick}
            style={{ background: t.surf, border: `1px solid ${hover ? `${statusCfg.color}38` : t.bord}`, borderTop: `3px solid ${statusCfg.color}`, borderRadius: 10, padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 13, position: 'relative', transition: 'all .2s', boxShadow: hover ? `0 6px 28px rgba(0,0,0,.09)` : '0 1px 3px rgba(0,0,0,.04)', transform: hover ? 'translateY(-2px)' : 'none' }}
        >
            {/* 3-dot action menu — only for roles that can manage projects */}
            {['founder', 'admin', 'manager'].includes(role) && (
            <div data-proj-menu="1" style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}
                onClick={e => e.stopPropagation()}>
                <button type="button"
                    onClick={() => setMenuOpen(o => !o)}
                    style={{ width: 28, height: 28, borderRadius: 7, background: menuOpen ? t.surf2 : hover ? t.surf2 : 'transparent', border: `1px solid ${menuOpen ? t.bord : hover ? t.bord : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.sub, fontSize: 16, transition: 'all .15s', letterSpacing: 1 }}>
                    ···
                </button>
                {menuOpen && (
                    <div style={{ position: 'absolute', top: 32, right: 0, background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, boxShadow: t.shadow, zIndex: 200, minWidth: 172 }}>
                        {/* Edit — only admin/founder/manager */}
                        {['founder', 'admin', 'manager'].includes(role) && (
                        <button type="button"
                            onClick={() => { setMenuOpen(false); setStatusSub(false); onEdit(); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', width: '100%', border: 'none', borderRadius: '10px 10px 0 0', background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                            onMouseEnter={e => (e.currentTarget.style.background = t.hover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit Project
                        </button>
                        )}

                        {/* Change Status — inline expand */}
                        {onChangeStatus && (
                            <>
                                <div style={{ height: 1, background: t.bord }} />
                                {/* header row */}
                                <button type="button" onClick={() => setStatusSub(s => !s)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 9, padding: '9px 14px', width: '100%', border: 'none', background: statusSub ? t.hover : 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = t.hover)} onMouseLeave={e => { if (!statusSub) e.currentTarget.style.background = 'transparent'; }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusCfg(project.status).color, flexShrink: 0 }} />
                                        Change Status
                                    </div>
                                    <span style={{ fontSize: 10, color: t.muted, transition: 'transform .15s', display: 'inline-block', transform: statusSub ? 'rotate(90deg)' : 'none' }}>▸</span>
                                </button>
                                {/* inline status options */}
                                {statusSub && (
                                    <div style={{ background: t.surf2, borderTop: `1px solid ${t.bord}`, borderBottom: `1px solid ${t.bord}` }}>
                                        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                                            const isCurrent = project.status === key;
                                            return (
                                                <button key={key} type="button"
                                                    onClick={() => { onChangeStatus(key); setMenuOpen(false); setStatusSub(false); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px 8px 26px', width: '100%', border: 'none', background: isCurrent ? `${cfg.color}14` : 'transparent', color: isCurrent ? cfg.color : t.sub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: isCurrent ? 700 : 400 }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = `${cfg.color}18`)} onMouseLeave={e => (e.currentTarget.style.background = isCurrent ? `${cfg.color}14` : 'transparent')}>
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                                                    {cfg.label}
                                                    {isCurrent && <span style={{ marginLeft: 'auto', fontSize: 11, color: cfg.color }}>✓</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Delete — only founder/admin */}
                        {['founder', 'admin'].includes(role) && (
                            <>
                                <div style={{ height: 1, background: t.bord }} />
                                <button type="button"
                                    onClick={() => { setMenuOpen(false); setStatusSub(false); onDelete(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', width: '100%', border: 'none', borderRadius: '0 0 10px 10px', background: 'transparent', color: RED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = `${RED}08`)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                                    Delete Project
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
            )}

            {/* Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: `${statusCfg.color}14`, color: statusCfg.color }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusCfg.color, boxShadow: `0 0 5px ${statusCfg.color}` }} />
                    {statusCfg.label}
                </span>
                {priorityCfg && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: `${priorityCfg.color}12`, color: priorityCfg.color }}>{priorityCfg.label}</span>}
                {team && (
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: `${teamColor(team.name)}10`, color: teamColor(team.name), display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: teamColor(team.name) }} />{team.name}
                    </span>
                )}
            </div>

            {/* Title */}
            <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.35, marginBottom: 4, paddingRight: 32 }}>{project.title}</div>
                {project.description && (
                    <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                        {project.description}
                    </div>
                )}
            </div>

            {/* Progress */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: 11, color: t.muted }}>Progress</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color }}>{project.progress}%</span>
                </div>
                <PBar pct={project.progress} color={statusCfg.color} isDark={isDark} />
            </div>

            {/* Hierarchy */}
            <div style={{ borderTop: `1px solid ${t.bord2}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <HRow label="Owner"   person={owner}   isDark={isDark} />
                <HRow label="Manager" person={primarySA} extra={extraSA > 0 ? `+${extraSA}` : undefined} isDark={isDark} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', width: 56, flexShrink: 0 }}>Team</span>
                    {staffList.length === 0 ? (
                        <span style={{ fontSize: 11, color: t.muted, fontStyle: 'italic' }}>No staff</span>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {staffList.slice(0, 5).map((m, i) => (
                                <div key={m.id} style={{ marginLeft: i > 0 ? -7 : 0, border: `2px solid ${isDark ? '#111420' : '#fff'}`, borderRadius: '50%', zIndex: 5 - i, position: 'relative' }}>
                                    <UAv name={m.name || 'S'} size={20} />
                                </div>
                            ))}
                            {staffList.length > 5 && (
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: t.surf2, border: `2px solid ${isDark ? '#111420' : '#fff'}`, fontSize: 9, color: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -7, fontWeight: 600, flexShrink: 0 }}>
                                    +{staffList.length - 5}
                                </div>
                            )}
                            <span style={{ fontSize: 11, color: t.muted, marginLeft: 8 }}>{staffList.length} member{staffList.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: `1px solid ${t.bord2}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span style={{ fontSize: 11, color: t.muted }}>{fmtDate(project.due_date) ?? 'No due date'}</span>
                </div>
                {project.updated_at && <span style={{ fontSize: 11, color: t.muted }}>{fmtRelative(project.updated_at)}</span>}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PROJECT LIST ROW
══════════════════════════════════════════════════════════════════════════════ */
function ProjectRow({ project, team, allUsers, isDark, role, onClick, onEdit, onDelete }: {
    project: WsProject; team?: Team; allUsers: any[]; isDark: boolean; role: string;
    onClick: () => void; onEdit: () => void; onDelete: () => void;
}) {
    const t = T(isDark);
    const [hover, setHover]     = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const statusCfg   = STATUS_CFG[project.status] ?? { label: project.status, color: BLUE };
    const priorityCfg = project.priority ? PRIORITY_CFG[project.priority] : null;
    const owner       = allUsers.find(u => (u._id ?? u.id) === project.owner_id);
    const primarySA   = (project.sub_admins ?? [])[0];
    const staffCount  = (project.staff ?? []).length;

    useEffect(() => {
        if (!menuOpen) return;
        const close = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('[data-row-menu]') === null) setMenuOpen(false); };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [menuOpen]);

    return (
        <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{ display: 'grid', gridTemplateColumns: '8px minmax(0,2fr) 82px 170px 130px 130px 82px 36px', alignItems: 'center', gap: 14, padding: '11px 18px', borderBottom: `1px solid ${t.bord2}`, cursor: 'pointer', background: hover ? t.hover : 'transparent', transition: 'background .1s' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusCfg.color, flexShrink: 0, boxShadow: `0 0 5px ${statusCfg.color}55` }} />
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.title}</div>
                {team ? <div style={{ fontSize: 11, color: teamColor(team.name), marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: teamColor(team.name) }} />{team.name}</div>
                    : project.description ? <div style={{ fontSize: 11, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{project.description}</div> : null}
            </div>
            {priorityCfg ? <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: `${priorityCfg.color}14`, color: priorityCfg.color, textAlign: 'center', whiteSpace: 'nowrap' }}>{priorityCfg.label}</span> : <span />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><PBar pct={project.progress} color={statusCfg.color} isDark={isDark} /></div>
                <span style={{ fontSize: 11, color: t.muted, flexShrink: 0, minWidth: 28, textAlign: 'right' }}>{project.progress}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {owner ? <><UAv name={owner.name || owner.email || 'A'} size={20} /><span style={{ fontSize: 12, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner.name || 'Admin'}</span></> : <span style={{ fontSize: 11, color: t.muted }}>—</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {primarySA ? <><UAv name={primarySA.name || 'M'} size={20} /><span style={{ fontSize: 12, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primarySA.name}</span></> : <span style={{ fontSize: 11, color: t.muted }}>—</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, color: t.sub, fontWeight: 500 }}>{staffCount} staff</span>
                {project.due_date && <span style={{ fontSize: 10, color: t.muted }}>{fmtDate(project.due_date)}</span>}
            </div>
            {/* Row action menu — only for roles that can manage projects */}
            {['founder', 'admin', 'manager'].includes(role) && (
            <div data-row-menu="1" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                {hover && (
                    <>
                        <button type="button" onClick={() => setMenuOpen(o => !o)}
                            style={{ width: 28, height: 28, borderRadius: 6, background: menuOpen ? t.surf2 : t.hover, border: `1px solid ${t.bord}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.sub, fontSize: 14, letterSpacing: 1 }}>
                            ···
                        </button>
                        {menuOpen && (
                            <div style={{ position: 'absolute', top: 32, right: 0, background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, boxShadow: t.shadow, zIndex: 200, minWidth: 148, overflow: 'hidden' }}>
                                {['founder', 'admin', 'manager'].includes(role) && (
                                <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%', border: 'none', background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = t.hover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    Edit
                                </button>
                                )}
                                {['founder', 'admin'].includes(role) && (
                                    <>
                                        <div style={{ height: 1, background: t.bord }} />
                                        <button type="button" onClick={() => { setMenuOpen(false); onDelete(); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%', border: 'none', background: 'transparent', color: RED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = `${RED}08`)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   EDIT TEAM MEMBERS MODAL — add / remove members with role assignment
══════════════════════════════════════════════════════════════════════════════ */
function EditTeamMembersModal({ team, isDark, allUsers, onClose, onSaved }: {
    team: Team; isDark: boolean; allUsers: any[];
    onClose: () => void; onSaved: () => void;
}) {
    const t = T(isDark);
    const [currentMembers, setCurrentMembers] = useState<any[]>([]);
    const [managerIds,  setManagerIds]  = useState<string[]>([]);
    const [subAdminIds, setSubAdminIds] = useState<string[]>([]);
    const [staffIds,    setStaffIds]    = useState<string[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [saving,      setSaving]      = useState(false);
    const [err,         setErr]         = useState('');

    const managers  = allUsers.filter(u => ['admin', 'manager'].includes(u.role));
    const subAdmins = allUsers.filter(u => ['sub_admin', 'subadmin'].includes(u.role));
    const staff     = allUsers.filter(u => u.role === 'staff' || u.role === 'member');

    useEffect(() => {
        fetch(`${API}/teams/${team.id}/members`, { headers: ah() })
            .then(r => r.json())
            .then((members: any[]) => {
                setCurrentMembers(members);
                setManagerIds(members.filter(m => ['admin','manager'].includes(m.role?.toLowerCase())).map(m => m.user_id));
                setSubAdminIds(members.filter(m => ['subadmin','sub_admin'].includes(m.role?.toLowerCase())).map(m => m.user_id));
                setStaffIds(members.filter(m => m.role?.toLowerCase() === 'member').map(m => m.user_id));
            })
            .catch(() => setErr('Could not load members'))
            .finally(() => setLoading(false));
    }, [team.id]);

    const toggle = (id: string, list: string[], setList: (l: string[]) => void) =>
        setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

    const save = async () => {
        setSaving(true); setErr('');
        try {
            const desired = [
                ...managerIds.map(id => ({ id, role: 'manager' })),
                ...subAdminIds.map(id => ({ id, role: 'subadmin' })),
                ...staffIds.map(id => ({ id, role: 'member' })),
            ];
            const currentIds = currentMembers.map(m => m.user_id);
            const desiredIds = desired.map(d => d.id);

            const toAdd    = desired.filter(d => !currentIds.includes(d.id));
            const toRemove = currentMembers.filter(m => !desiredIds.includes(m.user_id) && !['admin'].includes(m.role?.toLowerCase()));

            for (const m of toRemove) {
                await fetch(`${API}/teams/${team.id}/members/${m.user_id}`, { method: 'DELETE', headers: ah() });
            }
            for (const m of toAdd) {
                await fetch(`${API}/teams/${team.id}/members`, {
                    method: 'POST', headers: ah(),
                    body: JSON.stringify({ user_id: m.id, role: m.role })
                });
            }
            onSaved(); onClose();
        } catch { setErr('Failed to save changes'); }
        finally { setSaving(false); }
    };

    const totalSelected = managerIds.length + subAdminIds.length + staffIds.length;

    const UserPick = ({ users, selected, onToggle, roleLabel, color }: { users: any[]; selected: string[]; onToggle: (id: string) => void; roleLabel: string; color: string }) => (
        <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>{roleLabel}</span>
                <span style={{ fontSize: 11, color, fontWeight: 600 }}>{selected.length} selected</span>
            </div>
            <div style={{ maxHeight: 140, overflowY: 'auto', border: `1px solid ${t.bord}`, borderRadius: 8 }}>
                {users.length === 0 ? <div style={{ padding: 10, fontSize: 12, color: t.muted, textAlign: 'center' }}>No users</div>
                : users.map(u => { const uid = u._id ?? u.id; const sel = selected.includes(uid); return (
                    <div key={uid} onClick={() => onToggle(uid)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${t.bord2}`, background: sel ? `${color}08` : 'transparent', transition: 'background .1s' }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = t.hover; }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
                        <UAv name={u.name || u.email || 'U'} size={26} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unnamed'}</div>
                            <div style={{ fontSize: 11, color: t.muted }}>{u.email}</div>
                        </div>
                        {sel && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>);
                })}
            </div>
        </div>
    );

    return (
        <ModalShell title={`Edit Members · ${team.name}`} subtitle={`${totalSelected} member${totalSelected !== 1 ? 's' : ''} selected`} onClose={onClose} isDark={isDark} wide>
            <div style={{ padding: '20px 24px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>Loading…</div>
                ) : (
                    <>
                        <UserPick users={managers}  selected={managerIds}  onToggle={id => toggle(id, managerIds,  setManagerIds)}  roleLabel="Managers (Admin)" color={BLUE} />
                        <UserPick users={subAdmins} selected={subAdminIds} onToggle={id => toggle(id, subAdminIds, setSubAdminIds)} roleLabel="Sub Admins"        color={PURP} />
                        <UserPick users={staff}     selected={staffIds}    onToggle={id => toggle(id, staffIds,    setStaffIds)}    roleLabel="Staff Members"     color={GRN}  />
                        {err && <ErrBanner msg={err} />}
                        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                            <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                            <button type="button" onClick={save} disabled={saving} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: saving ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </ModalShell>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   EDIT TEAM DETAILS MODAL — rename + description
══════════════════════════════════════════════════════════════════════════════ */
function EditTeamModal({ team, isDark, onClose, onSaved }: {
    team: Team; isDark: boolean; onClose: () => void; onSaved: () => void;
}) {
    const t = T(isDark); const f = fld(t);
    const [name, setName] = useState(team.name);
    const [desc, setDesc] = useState(team.description ?? '');
    const [saving, setSaving] = useState(false);
    const [err,    setErr]    = useState('');

    const save = async () => {
        if (!name.trim()) { setErr('Name is required'); return; }
        setSaving(true); setErr('');
        try {
            const r = await fetch(`${API}/teams/${team.id}`, {
                method: 'PUT', headers: ah(),
                body: JSON.stringify({ name: name.trim(), description: desc.trim() })
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
            onSaved(); onClose();
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); }
        finally { setSaving(false); }
    };

    return (
        <ModalShell title="Edit Team" subtitle={team.name} onClose={onClose} isDark={isDark}>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <FieldWrap label="Team Name" required isDark={isDark}>
                    <input value={name} onChange={e => setName(e.target.value)} style={f}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </FieldWrap>
                <FieldWrap label="Description" isDark={isDark}>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                        style={{ ...f, resize: 'vertical' as const }}
                        onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
                </FieldWrap>
                {err && <ErrBanner msg={err} />}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="button" onClick={save} disabled={saving || !name.trim()} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: (saving || !name.trim()) ? `${BLUE}50` : BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: (saving || !name.trim()) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TEAM CARD
══════════════════════════════════════════════════════════════════════════════ */
function TeamCard({ team, teamStats, isDark, onViewProjects, onCreateProject, onViewMembers, onEditMembers, onEditDetails, onDelete, canCreate }: {
    team: Team;
    teamStats?: { total: number; active: number; lastActivity?: string };
    isDark: boolean;
    onViewProjects: () => void; onCreateProject: () => void; onViewMembers: () => void;
    onEditMembers?: () => void; onEditDetails?: () => void; onDelete?: () => void;
    canCreate?: boolean;
}) {
    const t = T(isDark); const color = teamColor(team.name);
    const [hover, setHover] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const statusLabel = team.status === 'active' ? 'Active' : team.status === 'inactive' ? 'Inactive' : 'No Projects';
    const statusColor = team.status === 'active' ? GRN : team.status === 'inactive' ? AMB : t.muted;

    const projectCount  = teamStats?.total ?? 0;
    const activeCount   = teamStats?.active ?? team.active_project_count ?? 0;
    const lastActivity  = teamStats?.lastActivity ?? team.last_activity;
    const createdDate   = team.created_at ? fmtDate(team.created_at) : null;

    return (
        <div onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setMenuOpen(false); }}
            style={{ background: t.surf, border: `1px solid ${hover ? `${color}35` : t.bord}`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, transition: 'all .2s', boxShadow: hover ? `0 6px 24px rgba(0,0,0,.08)` : '0 1px 3px rgba(0,0,0,.04)', transform: hover ? 'translateY(-2px)' : 'none', position: 'relative' }}>

            {/* Header: name + status badge + 3-dot menu */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: `${color}14`, border: `1.5px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color, flexShrink: 0 }}>{initials(team.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: `${statusColor}14`, color: statusColor, border: `1px solid ${statusColor}28`, flexShrink: 0 }}>{statusLabel}</span>
                    </div>
                    {team.manager_name && (
                        <div style={{ fontSize: 11, color: t.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Manager: <span style={{ color: t.sub, fontWeight: 500 }}>{team.manager_name}</span>
                        </div>
                    )}
                </div>
                {canCreate !== false && (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
                        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${menuOpen ? color : t.bord}`, background: menuOpen ? `${color}12` : 'transparent', color: menuOpen ? color : t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', lineHeight: 1 }}>
                        ···
                    </button>
                    {menuOpen && (
                        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 200, minWidth: 170, background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, boxShadow: t.shadow, overflow: 'hidden', animation: 'wsSlide .12s ease-out both' }}>
                            {[
                                { label: 'Edit Members',  action: onEditMembers  },
                                { label: 'Edit Details',  action: onEditDetails  },
                                { label: 'Delete Team',   action: onDelete, danger: true },
                            ].map(({ label, action, danger }) => (
                                <button key={label} type="button" disabled={!action}
                                    onClick={e => { e.stopPropagation(); setMenuOpen(false); action?.(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', color: danger ? RED : t.sub, fontSize: 13, fontWeight: 500, cursor: action ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left', transition: 'background .1s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = danger ? `${RED}0c` : t.hover)}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                    { val: team.memberCount ?? 0, label: 'Members' },
                    { val: projectCount,           label: 'Projects' },
                    { val: activeCount,            label: 'Active' },
                ].map(({ val, label }) => (
                    <div key={label} style={{ background: t.surf2, border: `1px solid ${t.bord2}`, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: t.text, lineHeight: 1 }}>{val}</div>
                        <div style={{ fontSize: 10, color: t.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Meta: dates */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {lastActivity && (
                    <div style={{ fontSize: 11, color: t.muted }}>
                        Last activity: <span style={{ color: t.sub }}>{fmtRelative(lastActivity)}</span>
                    </div>
                )}
                {createdDate && (
                    <div style={{ fontSize: 11, color: t.muted }}>
                        Created: <span style={{ color: t.sub }}>{createdDate}</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={onViewProjects}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1px solid ${color}30`, background: hover ? `${color}10` : 'transparent', color, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
                    Projects
                </button>
                <button type="button" onClick={onViewMembers}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.color = t.sub; }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                    Members
                </button>
                {canCreate !== false && (
                <button type="button" onClick={onCreateProject}
                    style={{ padding: '7px 10px', borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = t.sub)} onMouseLeave={e => (e.currentTarget.style.color = t.muted)}
                    title="New project in this team">
                    +
                </button>
                )}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   WORKSPACE SECTION HEADER — distinct visual label for each major section
══════════════════════════════════════════════════════════════════════════════ */
function WorkSection({ icon, title, badge, sub, color, action, onAction, isDark }: {
    icon: string; title: string; badge?: string | number; sub: string; color: string;
    action?: string; onAction?: () => void; isDark: boolean;
}) {
    const t = T(isDark);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Color bar */}
                <div style={{ width: 3, height: 40, borderRadius: 4, background: color, flexShrink: 0, marginTop: 2 }} />
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15 }}>{icon}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: '-.01em' }}>{title}</span>
                        {badge !== undefined && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${color}14`, color, border: `1px solid ${color}24` }}>{badge}</span>
                        )}
                    </div>
                    <p style={{ fontSize: 12, color: t.muted, margin: '3px 0 0', paddingLeft: 23 }}>{sub}</p>
                </div>
            </div>
            {action && onAction && (
                <button type="button" onClick={onAction}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color, fontWeight: 600, background: `${color}0d`, border: `1px solid ${color}22`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${color}1a`)} onMouseLeave={e => (e.currentTarget.style.background = `${color}0d`)}>
                    {action}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ACTIVITY FEED — recent project updates as timeline
══════════════════════════════════════════════════════════════════════════════ */
function ActivityFeed({ projects, isDark, onNavigate }: {
    projects: WsProject[]; isDark: boolean; onNavigate: (id: string) => void;
}) {
    const t = T(isDark);
    const items = useMemo(() =>
        [...projects]
            .filter(p => p.updated_at)
            .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
            .slice(0, 8),
        [projects]
    );

    if (items.length === 0) return (
        <div style={{ padding: '20px', textAlign: 'center', color: t.muted, fontSize: 13 }}>No recent activity.</div>
    );

    const icons: Record<string, string> = { ACTIVE: '🟢', ON_HOLD: '🟡', COMPLETED: '✅' };

    return (
        <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 12, overflow: 'hidden' }}>
            {items.map((p, i) => {
                const statusCfg = getStatusCfg(p.status);
                const isLast    = i === items.length - 1;
                return (
                    <div key={p.id}
                        onClick={() => onNavigate(p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', cursor: 'pointer', borderBottom: isLast ? 'none' : `1px solid ${t.bord2}`, transition: 'background .1s', background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {/* Timeline dot + connector */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 14 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusCfg.color, boxShadow: `0 0 6px ${statusCfg.color}77`, flexShrink: 0 }} />
                            {!isLast && <div style={{ width: 1, height: 16, background: t.bord2, marginTop: 2 }} />}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{p.title}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${statusCfg.color}12`, color: statusCfg.color, flexShrink: 0 }}>{statusCfg.label}</span>
                                {p.progress > 0 && (
                                    <span style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{p.progress}% done</span>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                                {(p.sub_admins ?? [])[0] ? `Managed by ${(p.sub_admins ?? [])[0].name}` : 'No manager assigned'}
                            </div>
                        </div>
                        {/* Time */}
                        <span style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{fmtRelative(p.updated_at)}</span>
                        {/* Arrow */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </div>
                );
            })}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   FILTER BAR
══════════════════════════════════════════════════════════════════════════════ */
function FilterBar({ search, onSearch, statusF, onStatus, priorityF, onPriority, managerF, onManager, sortBy, onSort, view, onView, managers, isDark }: {
    search: string; onSearch: (v: string) => void; statusF: string; onStatus: (v: string) => void;
    priorityF: string; onPriority: (v: string) => void; managerF: string; onManager: (v: string) => void;
    sortBy: string; onSort: (v: string) => void; view: 'grid' | 'list'; onView: (v: 'grid' | 'list') => void;
    managers: Person[]; isDark: boolean;
}) {
    const t = T(isDark);
    const sel: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: `1px solid ${t.bord}`, background: isDark ? '#0f1220' : '#fff', color: t.sub, fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .15s', flexShrink: 0 };
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: t.surf, borderBottom: `1px solid ${t.bord}`, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 260 }}>
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: t.muted, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search projects…"
                    style={{ ...fld(t), paddingLeft: 30, fontSize: 12 }}
                    onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
            </div>
            <select value={statusF} onChange={e => onStatus(e.target.value)} style={sel} onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.bord)}>
                <option value="all">All Status</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On Hold</option><option value="COMPLETED">Completed</option>
            </select>
            <select value={priorityF} onChange={e => onPriority(e.target.value)} style={sel} onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.bord)}>
                <option value="all">All Priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            {managers.length > 0 && (
                <select value={managerF} onChange={e => onManager(e.target.value)} style={sel} onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.bord)}>
                    <option value="all">All Managers</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
            )}
            <select value={sortBy} onChange={e => onSort(e.target.value)} style={sel} onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.bord)}>
                <option value="updated">Recently Updated</option><option value="name">Name A–Z</option><option value="progress">Progress</option><option value="due_date">Due Date</option>
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', background: t.surf2, border: `1px solid ${t.bord}`, borderRadius: 8, overflow: 'hidden' }}>
                {(['grid', 'list'] as const).map(v => (
                    <button key={v} type="button" onClick={() => onView(v)}
                        style={{ padding: '6px 12px', border: 'none', background: view === v ? BLUE : 'transparent', color: view === v ? 'white' : t.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s' }}>
                        {v === 'grid'
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        }
                        {v === 'grid' ? 'Grid' : 'List'}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
const Projects = () => {
    const navigate   = useNavigate();
    const { isDark } = useTheme();
    const t          = T(isDark);
    const role       = localStorage.getItem('role') ?? '';

    const [allItems, setAllItems] = useState<WsProject[]>([]);
    const [teams,    setTeams]    = useState<Team[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loading,  setLoading]  = useState(true);

    const [tab,          setTab]          = useState<TabId>('overview');
    const [view,         setView]         = useState<'grid' | 'list'>('grid');
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [managerFilter,  setManagerFilter]  = useState('all');
    const [teamFilter,     setTeamFilter]     = useState('all');
    const [sortBy,         setSortBy]         = useState('updated');

    const [showCreateProject, setShowCreateProject] = useState(false);
    const [showCreateTeam,    setShowCreateTeam]    = useState(false);
    const [createInitTeam,    setCreateInitTeam]    = useState<string | undefined>();
    const [deleteTarget,   setDeleteTarget]   = useState<WsProject | null>(null);
    const [editTarget,     setEditTarget]     = useState<WsProject | null>(null);
    const [viewMembersTeam, setViewMembersTeam] = useState<Team | null>(null);
    const [editMembersTeam, setEditMembersTeam] = useState<Team | null>(null);
    const [editDetailsTeam, setEditDetailsTeam] = useState<Team | null>(null);
    const [deleteTeamTarget, setDeleteTeamTarget] = useState<Team | null>(null);
    const [deletingTeam,    setDeletingTeam]    = useState(false);
    const [deleting,       setDeleting]       = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    /* Channel member counts derived from allUsers */
    const publicMemberCount   = allUsers.length;
    const subAdminMemberCount = allUsers.filter(u => ['sub_admin', 'subadmin'].includes(u.role)).length +
                                allUsers.filter(u => u.role === 'admin').length;

    const fetchProjects = useCallback(async () => {
        try { const r = await fetch(`${API}/projects`, { headers: ah() }); if (r.ok) setAllItems(await r.json()); } catch { }
    }, []);
    const fetchTeams = useCallback(async () => {
        try { const r = await fetch(`${API}/teams`, { headers: ah() }); if (r.ok) setTeams(await r.json()); } catch { }
    }, []);
    const fetchUsers = useCallback(async () => {
        try { const r = await fetch(`${API}/users`, { headers: ah() }); if (r.ok) setAllUsers(await r.json()); } catch { }
    }, []);
    useEffect(() => {
        Promise.all([fetchProjects(), fetchTeams(), fetchUsers()]).finally(() => setLoading(false));
    }, [fetchProjects, fetchTeams, fetchUsers]);

    /* Detect system cards by flag OR by known IDs (in case backend omits the flag) */
    const SYSTEM_IDS = useMemo(() => new Set(['public-group', 'all-sub-admin']), []);
    const isSystemCard = (p: WsProject) => p.is_system_card === true || SYSTEM_IDS.has(p.id);

    const groups   = useMemo(() => allItems.filter(isSystemCard),  [allItems, isSystemCard]);
    const projects = useMemo(() => allItems.filter(p => !isSystemCard(p)), [allItems, isSystemCard]);

    const allManagers = useMemo(() => {
        const seen = new Set<string>(); const out: Person[] = [];
        projects.forEach(p => (p.sub_admins ?? []).forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); out.push(s); } }));
        return out;
    }, [projects]);

    const byTeam = useMemo(() => {
        const m: Record<string, { total: number; active: number; lastActivity?: string }> = {};
        projects.forEach(p => {
            if (p.team_id) {
                if (!m[p.team_id]) m[p.team_id] = { total: 0, active: 0 };
                m[p.team_id].total++;
                if ((p.status ?? '').toUpperCase() === 'ACTIVE') m[p.team_id].active++;
                if (p.updated_at && (!m[p.team_id].lastActivity || p.updated_at > m[p.team_id].lastActivity!))
                    m[p.team_id].lastActivity = p.updated_at;
            }
        });
        return m;
    }, [projects]);

    const filteredProjects = useMemo(() => {
        let r = projects;
        if (teamFilter !== 'all')     r = r.filter(p => p.team_id === teamFilter);
        if (statusFilter !== 'all')   r = r.filter(p => p.status === statusFilter);
        if (priorityFilter !== 'all') r = r.filter(p => p.priority === priorityFilter);
        if (managerFilter !== 'all')  r = r.filter(p => (p.sub_admins ?? []).some(s => s.id === managerFilter));
        if (search) { const q = search.toLowerCase(); r = r.filter(p => (p.title ?? '').toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)); }
        return [...r].sort((a, b) => {
            if (sortBy === 'name')     return a.title.localeCompare(b.title);
            if (sortBy === 'due_date') return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
            if (sortBy === 'progress') return b.progress - a.progress;
            return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
        });
    }, [projects, teamFilter, statusFilter, priorityFilter, managerFilter, search, sortBy]);

    const teamFor = (p: WsProject) => p.team_id ? teams.find(tm => tm.id === p.team_id) : undefined;

    const handleDeleteTeam = async (team: Team) => {
        if (!window.confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
        setDeletingTeam(true);
        try {
            const r = await fetch(`${API}/teams/${team.id}`, { method: 'DELETE', headers: ah() });
            if (!r.ok && r.status !== 204) throw new Error('Failed');
            fetchTeams(); setToast({ msg: 'Team deleted', ok: true });
        } catch { setToast({ msg: 'Delete failed', ok: false }); } finally { setDeletingTeam(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return; setDeleting(true);
        try {
            await fetch(`${API}/projects/${deleteTarget.id}`, { method: 'DELETE', headers: ah() });
            fetchProjects(); setDeleteTarget(null); setToast({ msg: 'Project deleted', ok: true });
        } catch { setToast({ msg: 'Delete failed', ok: false }); } finally { setDeleting(false); }
    };

    const handleStatusChange = async (projectId: string, newStatus: string) => {
        try {
            const r = await fetch(`${API}/projects/${projectId}`, {
                method: 'PATCH',
                headers: { ...ah(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!r.ok) throw new Error(await r.text());
            fetchProjects();
            setToast({ msg: `Status changed to ${STATUS_CFG[newStatus]?.label ?? newStatus}`, ok: true });
        } catch { setToast({ msg: 'Status update failed', ok: false }); }
    };

    // Only founder/admin/manager can create projects or teams
    const canCreate      = ['founder', 'admin', 'manager'].includes(role);
    // Sub-admin can manage tasks but NOT projects/teams
    const isSubAdmin     = role === 'sub_admin';
    const isStaff        = role === 'staff';
    const canManageProject = canCreate; // same set
    const resetFilters = () => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); setManagerFilter('all'); setTeamFilter('all'); setSortBy('updated'); };

    /* Unfiltered recent projects for the Overview — not affected by any active filters */
    const recentProjects = useMemo(() =>
        [...projects].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')),
        [projects]
    );

    /* Switch tab and clear filters when going back to Overview */
    const handleSetTab = (newTab: TabId) => {
        setTab(newTab);
        if (newTab === 'overview') resetFilters();
    };

    const TAB_COUNTS: Record<TabId, number | null> = { overview: null, projects: projects.length, teams: teams.length };

    const renderProjects = (list: WsProject[], showEmpty = true) => {
        if (list.length === 0 && showEmpty) return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
                <svg width="44" height="44" viewBox="0 0 52 52" fill="none" style={{ opacity: .15 }}><rect x="6" y="6" width="40" height="40" rx="6" stroke={t.muted} strokeWidth="1.5"/><line x1="14" y1="18" x2="38" y2="18" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="14" y1="26" x2="30" y2="26" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.sub }}>No projects found</div>
                <div style={{ fontSize: 13, color: t.muted }}>{search || statusFilter !== 'all' || priorityFilter !== 'all' ? 'Try adjusting your filters.' : 'Create your first project to get started.'}</div>
                {canCreate && statusFilter === 'all' && priorityFilter === 'all' && !search && (
                    <button type="button" onClick={() => setShowCreateProject(true)}
                        style={{ marginTop: 4, padding: '9px 20px', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + New Project
                    </button>
                )}
            </div>
        );
        if (view === 'grid') return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
                {list.map(p => (
                    <ProjectCard key={p.id} project={p} team={teamFor(p)} allUsers={allUsers} isDark={isDark} role={role}
                        onClick={() => navigate(`/workspace?projectId=${p.id}`)}
                        onEdit={() => setEditTarget(p)}
                        onDelete={() => setDeleteTarget(p)}
                        onChangeStatus={s => void handleStatusChange(p.id, s)} />
                ))}
            </div>
        );
        return (
            <div style={{ background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '8px minmax(0,2fr) 82px 170px 130px 130px 82px 36px', gap: 14, padding: '9px 18px', background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', borderBottom: `1px solid ${t.bord}` }}>
                    {['', 'Project', 'Priority', 'Progress', 'Owner', 'Manager', 'Staff / Due', ''].map((h, i) => (
                        <div key={i} style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>{h}</div>
                    ))}
                </div>
                {list.map(p => (
                    <ProjectRow key={p.id} project={p} team={teamFor(p)} allUsers={allUsers} isDark={isDark} role={role}
                        onClick={() => navigate(`/workspace?projectId=${p.id}`)}
                        onEdit={() => setEditTarget(p)}
                        onDelete={() => setDeleteTarget(p)} />
                ))}
            </div>
        );
    };


    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s' }}>
            <style>{`@keyframes wsSlide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }`}</style>

            <Sidebar />

            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minWidth: 0, display: 'flex', flexDirection: 'column' }}>

                {/* Page header + tabs */}
                <div style={{ padding: '18px 32px 0', background: t.surf, borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <h1 style={{ fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-.03em', margin: 0 }}>Workspace</h1>
                                {!loading && (
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        {[
                                            { val: projects.filter(p => p.status === 'ACTIVE').length, label: 'Active', color: GRN },
                                            { val: projects.filter(p => p.status === 'ON_HOLD').length, label: 'On Hold', color: AMB },
                                            { val: projects.filter(p => p.status === 'COMPLETED').length, label: 'Done', color: BLUE },
                                        ].map(({ val, label, color }) => val > 0 ? (
                                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: `${color}0f`, color, border: `1px solid ${color}20` }}>
                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />{val} {label}
                                            </span>
                                        ) : null)}
                                    </div>
                                )}
                            </div>
                            <p style={{ fontSize: 12, color: t.muted, margin: 0 }}>
                                {projects.length} project{projects.length !== 1 ? 's' : ''} · {groups.length} channel{groups.length !== 1 ? 's' : ''} · {teams.length} team{teams.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {canCreate && (
                                <>
                                    <button type="button" onClick={() => setShowCreateTeam(true)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.bord}`, background: t.hover, color: t.sub, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = PURP; e.currentTarget.style.color = PURP; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.color = t.sub; }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                                        New Team
                                    </button>
                                    <button type="button" onClick={() => { setCreateInitTeam(undefined); setShowCreateProject(true); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(29,110,245,.28)', transition: 'opacity .15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        New Project
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 0 }}>
                        {(['overview', 'projects', 'teams'] as TabId[]).map(tid => {
                            const labels: Record<TabId, string> = { overview: 'Overview', projects: 'Projects', teams: 'Teams' };
                            const active = tab === tid;
                            const cnt    = TAB_COUNTS[tid];
                            return (
                                <button key={tid} type="button" onClick={() => handleSetTab(tid)}
                                    style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? t.text : t.muted, borderBottom: active ? `2px solid ${BLUE}` : '2px solid transparent', marginBottom: -1, transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {labels[tid]}
                                    {cnt !== null && cnt > 0 && (
                                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: active ? `${BLUE}14` : t.surf2, color: active ? BLUE : t.muted, border: `1px solid ${active ? `${BLUE}22` : t.bord}` }}>{cnt}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {tab === 'projects' && (
                    <FilterBar
                        search={search} onSearch={setSearch}
                        statusF={statusFilter} onStatus={setStatusFilter}
                        priorityF={priorityFilter} onPriority={setPriorityFilter}
                        managerF={managerFilter} onManager={setManagerFilter}
                        sortBy={sortBy} onSort={setSortBy}
                        view={view} onView={setView}
                        managers={allManagers} isDark={isDark}
                    />
                )}

                <div style={{ flex: 1, padding: '24px 32px 48px', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: t.muted, fontSize: 13 }}>Loading workspace…</div>
                    ) : tab === 'overview' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                            {/* ══ SECTION 1: WORKSPACE CHANNELS ══ */}
                            <div style={{ marginBottom: 40 }}>
                                <WorkSection
                                    icon="💬" title="Channels" badge={groups.length}
                                    sub="Communication spaces — separate from projects. Use channels for team coordination and announcements."
                                    color={PURP} isDark={isDark}
                                />
                                {groups.length === 0 ? (
                                    <div style={{ padding: '28px', textAlign: 'center', background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 12, color: t.muted, fontSize: 13 }}>
                                        No channels available.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        {groups
                                            // Staff cannot see the all-sub-admin channel
                                            .filter(g => !(isStaff && g.id === 'all-sub-admin'))
                                            .map(g => (
                                            <ChannelCard key={g.id} group={g} isDark={isDark}
                                                overrideMemberCount={g.id === 'public-group' ? publicMemberCount : g.id === 'all-sub-admin' ? subAdminMemberCount : undefined}
                                                extraStats={{ totalProjects: projects.length, activeProjects: projects.filter(p => (p.status ?? '').toUpperCase() === 'ACTIVE').length }}
                                                onClick={() => navigate(`/taskflow?projectId=${g.id}`)} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Section divider */}
                            <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)', marginBottom: 40 }} />

                            {/* ══ SECTION 2: PROJECTS ══ */}
                            <div style={{ marginBottom: 40 }}>
                                <WorkSection
                                    icon="🗂" title="Projects" badge={projects.length}
                                    sub="Active workstreams with assigned ownership, managers, and staff teams."
                                    color={BLUE}
                                    action={projects.length > 6 ? `View all ${projects.length}` : undefined}
                                    onAction={() => handleSetTab('projects')}
                                    isDark={isDark}
                                />
                                {renderProjects(recentProjects.slice(0, 6), true)}
                                {projects.length > 6 && (
                                    <button type="button" onClick={() => handleSetTab('projects')}
                                        style={{ marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 9, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = t.hover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        View all {projects.length} projects →
                                    </button>
                                )}
                            </div>

                            {/* Section divider */}
                            {teams.length > 0 && <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)', marginBottom: 40 }} />}

                            {/* ══ SECTION 3: TEAMS ══ */}
                            {teams.length > 0 && (
                                <div style={{ marginBottom: 40 }}>
                                    <WorkSection
                                        icon="👥" title="Teams" badge={teams.length}
                                        sub="People organized by Admin → Sub Admin → Staff hierarchy. Projects belong to teams."
                                        color={GRN}
                                        action={teams.length > 4 ? 'View all' : undefined}
                                        onAction={() => handleSetTab('teams')}
                                        isDark={isDark}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                                        {teams.slice(0, 4).map(tm => (
                                            <TeamCard key={tm.id} team={tm} teamStats={byTeam[tm.id]} isDark={isDark}
                                                canCreate={canCreate}
                                                onViewProjects={() => { resetFilters(); setTeamFilter(tm.id); setTab('projects'); }}
                                                onCreateProject={() => { setCreateInitTeam(tm.id); setShowCreateProject(true); }}
                                                onViewMembers={() => setViewMembersTeam(tm)}
                                                onEditMembers={() => setEditMembersTeam(tm)}
                                                onEditDetails={() => setEditDetailsTeam(tm)}
                                                onDelete={() => void handleDeleteTeam(tm)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section divider */}
                            {projects.length > 0 && <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)', marginBottom: 40 }} />}

                            {/* ══ SECTION 4: ACTIVITY FEED ══ */}
                            {projects.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <WorkSection
                                        icon="⚡" title="Recent Activity" badge={undefined}
                                        sub="Latest project updates across the workspace — click any item to open."
                                        color={AMB} isDark={isDark}
                                    />
                                    <ActivityFeed
                                        projects={projects} isDark={isDark}
                                        onNavigate={id => navigate(`/workspace?projectId=${id}`)}
                                    />
                                </div>
                            )}
                        </div>

                    ) : tab === 'projects' ? (
                        <div>
                            {(statusFilter !== 'all' || priorityFilter !== 'all' || managerFilter !== 'all' || teamFilter !== 'all' || search) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 12, color: t.muted }}>Filtered:</span>
                                    {statusFilter !== 'all'   && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: `${GRN}12`,  color: GRN,  fontWeight: 600 }}>{STATUS_CFG[statusFilter]?.label}</span>}
                                    {priorityFilter !== 'all' && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: `${ORNG}12`, color: ORNG, fontWeight: 600 }}>{PRIORITY_CFG[priorityFilter]?.label}</span>}
                                    {managerFilter !== 'all'  && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: `${PURP}12`, color: PURP, fontWeight: 600 }}>{allManagers.find(m => m.id === managerFilter)?.name}</span>}
                                    {teamFilter !== 'all'     && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: `${TEAL}12`, color: TEAL, fontWeight: 600 }}>{teams.find(tm => tm.id === teamFilter)?.name}</span>}
                                    <button type="button" onClick={resetFilters} style={{ fontSize: 11, color: t.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Clear all</button>
                                    <span style={{ fontSize: 12, color: t.sub, marginLeft: 4 }}>{filteredProjects.length} result{filteredProjects.length !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                            {renderProjects(filteredProjects)}
                        </div>

                    ) : (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div>
                                    <h2 style={{ fontSize: 12, fontWeight: 700, color: t.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '.08em' }}>Teams · {teams.length}</h2>
                                    <p style={{ fontSize: 12, color: t.muted, margin: '2px 0 0' }}>Team spaces with projects and members</p>
                                </div>
                                {canCreate && (
                                <button type="button" onClick={() => setShowCreateTeam(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = t.hover; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    New Team
                                </button>
                                )}
                            </div>
                            {teams.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: t.sub }}>No teams yet</div>
                                    {canCreate && (
                                    <button type="button" onClick={() => setShowCreateTeam(true)}
                                        style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                                        + Create Team
                                    </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                                    {teams.map(tm => (
                                        <TeamCard key={tm.id} team={tm} teamStats={byTeam[tm.id]} isDark={isDark}
                                            canCreate={canCreate}
                                            onViewProjects={() => { resetFilters(); setTeamFilter(tm.id); setTab('projects'); }}
                                            onCreateProject={() => { setCreateInitTeam(tm.id); setShowCreateProject(true); }}
                                            onViewMembers={() => setViewMembersTeam(tm)}
                                            onEditMembers={() => setEditMembersTeam(tm)}
                                            onEditDetails={() => setEditDetailsTeam(tm)}
                                            onDelete={() => void handleDeleteTeam(tm)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Overlays */}
            {showCreateTeam && (
                <CreateTeamModal onClose={() => setShowCreateTeam(false)} allUsers={allUsers}
                    onCreated={() => { fetchTeams(); setToast({ msg: 'Team created', ok: true }); }} isDark={isDark} />
            )}
            {showCreateProject && (
                <CreateProjectModal teams={teams} allUsers={allUsers} initialTeamId={createInitTeam}
                    onClose={() => { setShowCreateProject(false); setCreateInitTeam(undefined); }}
                    onCreated={() => { fetchProjects(); setToast({ msg: 'Project created', ok: true }); }} isDark={isDark} />
            )}
            {editTarget && (
                <EditProjectModal project={editTarget} allUsers={allUsers}
                    onClose={() => setEditTarget(null)}
                    onSaved={() => { fetchProjects(); setToast({ msg: 'Project updated', ok: true }); }} isDark={isDark} />
            )}
            {deleteTarget && (
                <ConfirmDeleteModal project={deleteTarget} loading={deleting}
                    onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} isDark={isDark} />
            )}
            {viewMembersTeam && (
                <TeamMembersModal team={viewMembersTeam} isDark={isDark} onClose={() => setViewMembersTeam(null)} />
            )}
            {editMembersTeam && (
                <EditTeamMembersModal team={editMembersTeam} isDark={isDark} allUsers={allUsers}
                    onClose={() => setEditMembersTeam(null)}
                    onSaved={() => { fetchTeams(); setToast({ msg: 'Members updated', ok: true }); }} />
            )}
            {editDetailsTeam && (
                <EditTeamModal team={editDetailsTeam} isDark={isDark}
                    onClose={() => setEditDetailsTeam(null)}
                    onSaved={() => { fetchTeams(); setToast({ msg: 'Team updated', ok: true }); }} />
            )}
            {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
        </div>
    );
};

export default Projects;
