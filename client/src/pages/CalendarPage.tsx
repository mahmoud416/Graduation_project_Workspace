import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../contexts/useTheme';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

/* ═══════════════════════════════════════════════ TYPES */
interface CalEvent {
    id: string;
    title: string;
    description?: string;
    type: string;
    start_date: string;   // YYYY-MM-DD
    end_date?: string;
    start_time?: string;  // HH:MM
    end_time?: string;
    priority: string;
    location?: string;
    meeting_link?: string;
    project_id?: string;
    owner_id: string;
    attendee_ids: string[];
    visibility: string;
    reminder_minutes?: number;
    recurrence: string;
    color?: string;
    status: string;
    created_by: string;
}
interface WsProject { id: string; title: string; }
interface WsUser    { id: string; name: string; email?: string; }
type CalView = 'month' | 'week' | 'day' | 'agenda';

/* ═══════════════════════════════════════════════ CONSTANTS */
const EVENT_TYPE_CFG: Record<string, { label: string; color: string; icon: string }> = {
    meeting:          { label: 'Meeting',          color: '#3b82f6', icon: '👥' },
    project_deadline: { label: 'Project Deadline', color: '#ef4444', icon: '🎯' },
    review_session:   { label: 'Review Session',   color: '#8b5cf6', icon: '🔍' },
    training_session: { label: 'Training Session', color: '#10b981', icon: '📚' },
    quality_audit:    { label: 'Quality Audit',    color: '#f59e0b', icon: '✅' },
    team_event:       { label: 'Team Event',       color: '#06b6d4', icon: '🏆' },
    reminder:         { label: 'Reminder',         color: '#6366f1', icon: '🔔' },
    personal_event:   { label: 'Personal Event',   color: '#ec4899', icon: '👤' },
    task_deadline:    { label: 'Task Deadline',    color: '#f97316', icon: '⏰' },
    milestone:        { label: 'Milestone',        color: '#14b8a6', icon: '🏁' },
};
const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
    low:    { label: 'Low',    color: '#64748b' },
    medium: { label: 'Medium', color: '#f59e0b' },
    high:   { label: 'High',   color: '#f97316' },
    urgent: { label: 'Urgent', color: '#ef4444' },
};
const VISIBILITY_OPTS = [
    { value: 'workspace',       label: 'Entire Workspace' },
    { value: 'team',            label: 'Team' },
    { value: 'project_members', label: 'Project Members' },
    { value: 'private',         label: 'Private' },
];
const RECURRENCE_OPTS = [
    { value: 'none',    label: 'Does not repeat' },
    { value: 'daily',   label: 'Daily' },
    { value: 'weekly',  label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly',  label: 'Yearly' },
];
const REMINDER_OPTS = [
    { value: 15,   label: '15 min before' },
    { value: 60,   label: '1 hour before' },
    { value: 720,  label: '12 hours before' },
    { value: 1440, label: '1 day before' },
];
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_FULL    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/* ═══════════════════════════════════════════════ THEME */
const T = (d: boolean) => ({
    bg:     d ? '#0b0d14' : '#f1f5f9',
    surf:   d ? '#111420' : '#ffffff',
    surf2:  d ? '#161924' : '#f8fafc',
    surf3:  d ? '#1c2030' : '#eef2f7',
    bord:   d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
    bord2:  d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
    text:   d ? '#f1f4f9' : '#0f172a',
    sub:    d ? 'rgba(255,255,255,.60)' : '#334155',
    muted:  d ? 'rgba(255,255,255,.32)' : '#94a3b8',
    hover:  d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
    inbg:   d ? 'rgba(255,255,255,.04)' : '#f8fafc',
    inbd:   d ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)',
    shadow: d ? '0 20px 60px rgba(0,0,0,.65)' : '0 12px 40px rgba(0,0,0,.12)',
});

/* ═══════════════════════════════════════════════ API */
const ah = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${localStorage.getItem('token') ?? ''}`,
    'X-User-Id':    localStorage.getItem('userId') ?? '',
});

async function apiFetchEvents(): Promise<CalEvent[]> {
    try {
        const r = await fetch(`${API}/events`, { headers: ah() });
        return r.ok ? r.json() : [];
    } catch { return []; }
}
async function apiCreate(data: Record<string, unknown>): Promise<CalEvent> {
    const r = await fetch(`${API}/events`, { method: 'POST', headers: ah(), body: JSON.stringify(data) });
    if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
    return r.json();
}
async function apiUpdate(id: string, data: Record<string, unknown>): Promise<CalEvent> {
    const r = await fetch(`${API}/events/${id}`, { method: 'PUT', headers: ah(), body: JSON.stringify(data) });
    if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
    return r.json();
}
async function apiDelete(id: string): Promise<void> {
    await fetch(`${API}/events/${id}`, { method: 'DELETE', headers: ah() });
}
async function apiFetchProjects(): Promise<WsProject[]> {
    try {
        const r = await fetch(`${API}/projects`, { headers: ah() });
        if (!r.ok) return [];
        const arr: any[] = await r.json();
        return arr
            .filter(p => p._id !== 'public-group' && p._id !== 'all-sub-admin')
            .map(p => ({ id: p._id ?? p.id, title: p.title }));
    } catch { return []; }
}
async function apiFetchUsers(): Promise<WsUser[]> {
    try {
        const r = await fetch(`${API}/users`, { headers: ah() });
        if (!r.ok) return [];
        const arr: any[] = await r.json();
        return arr.map(u => ({ id: u._id ?? u.id, name: u.name ?? u.email ?? 'Unknown', email: u.email }));
    } catch { return []; }
}

/* ═══════════════════════════════════════════════ UTILS */
const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateStr  = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const dateToStr  = (d: Date) => toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
const strToDate  = (s: string) => new Date(s + 'T00:00:00');
const todayStr   = () => { const n = new Date(); return toDateStr(n.getFullYear(), n.getMonth(), n.getDate()); };

function evColor(ev: CalEvent) { return ev.color ?? EVENT_TYPE_CFG[ev.type]?.color ?? '#3b82f6'; }

function fmtTime(t?: string) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${pad2(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

function fmtDateLabel(ds: string, today: string) {
    if (ds === today) return 'Today';
    const td  = strToDate(today);
    td.setDate(td.getDate() + 1);
    if (ds === dateToStr(td)) return 'Tomorrow';
    const d   = strToDate(ds);
    return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function getWeekDays(anchor: Date): Date[] {
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - anchor.getDay());
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

/* ═══════════════════════════════════════════════ EVENT CHIP */
function EventChip({ ev, isDark, onClick }: { ev: CalEvent; isDark: boolean; onClick: (e: React.MouseEvent) => void }) {
    const color = evColor(ev);
    const [hov, setHov] = useState(false);
    return (
        <div onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            title={`${ev.title}${ev.start_time ? ` · ${fmtTime(ev.start_time)}` : ''}`}
            style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '2px 5px',
                borderRadius: 4, background: hov ? color : `${color}cc`,
                color: 'white', fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                transition: 'background .1s', userSelect: 'none',
            }}>
            {ev.start_time && <span style={{ opacity: .7, fontSize: 9, flexShrink: 0 }}>{fmtTime(ev.start_time)}</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════ EVENT MODAL */
interface ModalProps {
    editing: CalEvent | null;
    initDate: string;
    initTime: string;
    isDark: boolean;
    canDelete: boolean;
    projects: WsProject[];
    users: WsUser[];
    saving: boolean;
    onSave: (d: Record<string, unknown>) => void;
    onDelete: () => void;
    onClose: () => void;
}

function EventModal({ editing, initDate, initTime, isDark, canDelete, projects, users, saving, onSave, onDelete, onClose }: ModalProps) {
    const t = T(isDark);

    const [title,      setTitle]      = useState(editing?.title ?? '');
    const [type,       setType]       = useState(editing?.type ?? 'meeting');
    const [priority,   setPriority]   = useState(editing?.priority ?? 'medium');
    const [startDate,  setStartDate]  = useState(editing?.start_date ?? initDate);
    const [endDate,    setEndDate]    = useState(editing?.end_date ?? initDate);
    const [startTime,  setStartTime]  = useState(editing?.start_time ?? initTime);
    const [endTime,    setEndTime]    = useState(editing?.end_time ?? '');
    const [desc,       setDesc]       = useState(editing?.description ?? '');
    const [location,   setLocation]   = useState(editing?.location ?? '');
    const [link,       setLink]       = useState(editing?.meeting_link ?? '');
    const [visibility, setVisibility] = useState(editing?.visibility ?? 'workspace');
    const [recurrence, setRecurrence] = useState(editing?.recurrence ?? 'none');
    const [projectId,  setProjectId]  = useState(editing?.project_id ?? '');
    const [reminder,   setReminder]   = useState(editing?.reminder_minutes?.toString() ?? '');
    const [attendees,  setAttendees]  = useState<string[]>(editing?.attendee_ids ?? []);
    const [showPicker, setShowPicker] = useState(false);

    const cfg = EVENT_TYPE_CFG[type] ?? EVENT_TYPE_CFG.meeting;

    const toggleAttendee = (uid: string) =>
        setAttendees(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);

    const submit = () => {
        if (!title.trim() || saving) return;
        onSave({
            title: title.trim(), type, priority,
            start_date: startDate, end_date: endDate || startDate,
            start_time: startTime || undefined, end_time: endTime || undefined,
            description: desc || undefined, location: location || undefined,
            meeting_link: link || undefined, visibility, recurrence,
            project_id: projectId || undefined,
            reminder_minutes: reminder ? parseInt(reminder) : undefined,
            attendee_ids: attendees,
        });
    };

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [saving, onClose]);

    const inp: React.CSSProperties = {
        width: '100%', padding: '7px 10px', background: t.inbg, border: `1px solid ${t.inbd}`,
        borderRadius: 7, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    };
    const sel = { ...inp, background: isDark ? '#0f1220' : '#fff', cursor: 'pointer' };
    const lbl: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: t.muted, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '.07em' };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '"Inter",-apple-system,sans-serif' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} />
            <div onClick={e => e.stopPropagation()} style={{
                position: 'relative', zIndex: 1, width: '100%', maxWidth: 640,
                maxHeight: '93vh', display: 'flex', flexDirection: 'column',
                background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 18,
                boxShadow: t.shadow, overflow: 'hidden', animation: 'calSlide .18s ease',
            }}>
                {/* Header */}
                <div style={{ padding: '15px 22px', borderBottom: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${cfg.color}12`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{cfg.icon}</div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{editing ? 'Edit Event' : 'New Event'}</div>
                            <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>{cfg.label}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: t.hover, border: `1px solid ${t.bord}`, cursor: 'pointer', color: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontFamily: 'inherit' }}>×</button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>

                    {/* Title */}
                    <div>
                        <label style={lbl}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title…"
                            style={{ ...inp, fontSize: 14, fontWeight: 600 }}
                            onFocus={e => (e.target.style.borderColor = cfg.color)} onBlur={e => (e.target.style.borderColor = t.inbd)} />
                    </div>

                    {/* Type + Priority row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={lbl}>Event Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} style={sel}>
                                {Object.entries(EVENT_TYPE_CFG).map(([k, v]) => (
                                    <option key={k} value={k}>{v.icon} {v.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={lbl}>Priority</label>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {Object.entries(PRIORITY_CFG).map(([k, v]) => (
                                    <button key={k} type="button" onClick={() => setPriority(k)} style={{
                                        flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 10.5, fontWeight: 600,
                                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                                        border: `1.5px solid ${priority === k ? v.color : t.bord}`,
                                        background: priority === k ? `${v.color}14` : 'transparent',
                                        color: priority === k ? v.color : t.muted,
                                    }}>{v.label}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Dates + Times */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                        {([
                            { label: 'Start Date', type: 'date', val: startDate, set: setStartDate },
                            { label: 'Start Time', type: 'time', val: startTime, set: setStartTime },
                            { label: 'End Date',   type: 'date', val: endDate,   set: setEndDate   },
                            { label: 'End Time',   type: 'time', val: endTime,   set: setEndTime   },
                        ] as const).map(f => (
                            <div key={f.label}>
                                <label style={lbl}>{f.label}</label>
                                <input type={f.type} value={f.val} onChange={e => (f.set as (s: string) => void)(e.target.value)}
                                    style={{ ...inp, fontSize: 12 }}
                                    onFocus={e => (e.target.style.borderColor = cfg.color)}
                                    onBlur={e => (e.target.style.borderColor = t.inbd)} />
                            </div>
                        ))}
                    </div>

                    {/* Description */}
                    <div>
                        <label style={lbl}>Description</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Add details…"
                            style={{ ...inp, resize: 'vertical' as const, minHeight: 56 }}
                            onFocus={e => (e.target.style.borderColor = cfg.color)} onBlur={e => (e.target.style.borderColor = t.inbd)} />
                    </div>

                    {/* Location + Visibility */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={lbl}>Location</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Room, address…" style={inp}
                                onFocus={e => (e.target.style.borderColor = cfg.color)} onBlur={e => (e.target.style.borderColor = t.inbd)} />
                        </div>
                        <div>
                            <label style={lbl}>Visibility</label>
                            <select value={visibility} onChange={e => setVisibility(e.target.value)} style={sel}>
                                {VISIBILITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Meeting Link + Recurrence */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={lbl}>Meeting Link</label>
                            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://meet.google.com/…" style={inp}
                                onFocus={e => (e.target.style.borderColor = cfg.color)} onBlur={e => (e.target.style.borderColor = t.inbd)} />
                        </div>
                        <div>
                            <label style={lbl}>Recurrence</label>
                            <select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={sel}>
                                {RECURRENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Project + Reminder */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={lbl}>Related Project</label>
                            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={sel}>
                                <option value="">None</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={lbl}>Reminder</label>
                            <select value={reminder} onChange={e => setReminder(e.target.value)} style={sel}>
                                <option value="">No reminder</option>
                                {REMINDER_OPTS.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Attendees */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                            <label style={{ ...lbl, marginBottom: 0 }}>Attendees {attendees.length > 0 && `(${attendees.length})`}</label>
                            <button type="button" onClick={() => setShowPicker(s => !s)}
                                style={{ fontSize: 11, color: cfg.color, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                                {showPicker ? '▲ Hide' : '▼ Select'}
                            </button>
                        </div>
                        {attendees.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                                {attendees.map(uid => {
                                    const u = users.find(x => x.id === uid);
                                    return u ? (
                                        <span key={uid} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: `${cfg.color}14`, fontSize: 11, color: cfg.color, fontWeight: 500 }}>
                                            {u.name}
                                            <span onClick={() => toggleAttendee(uid)} style={{ cursor: 'pointer', opacity: .7, marginLeft: 2 }}>×</span>
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        )}
                        {showPicker && (
                            <div style={{ border: `1px solid ${t.bord}`, borderRadius: 8, maxHeight: 130, overflowY: 'auto' }}>
                                {users.length === 0
                                    ? <div style={{ padding: 10, fontSize: 12, color: t.muted, textAlign: 'center' }}>No users found</div>
                                    : users.map(u => {
                                        const picked = attendees.includes(u.id);
                                        return (
                                            <div key={u.id} onClick={() => toggleAttendee(u.id)} style={{
                                                display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px',
                                                cursor: 'pointer', background: picked ? `${cfg.color}08` : 'transparent',
                                                borderBottom: `1px solid ${t.bord2}`, transition: 'background .1s',
                                            }}>
                                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                                    {(u.name[0] ?? '?').toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                                                    {u.email && <div style={{ fontSize: 10, color: t.muted }}>{u.email}</div>}
                                                </div>
                                                {picked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '11px 22px', borderTop: `1px solid ${t.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surf2, flexShrink: 0 }}>
                    {editing && canDelete
                        ? <button onClick={onDelete} disabled={saving} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#ef444414', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                        : <span />
                    }
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onClose} disabled={saving} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                        <button onClick={submit} disabled={!title.trim() || saving} style={{
                            padding: '7px 20px', borderRadius: 8, border: 'none',
                            background: !title.trim() || saving ? `${cfg.color}55` : cfg.color,
                            color: 'white', fontSize: 13, fontWeight: 700,
                            cursor: !title.trim() || saving ? 'default' : 'pointer', fontFamily: 'inherit',
                            boxShadow: `0 4px 12px ${cfg.color}40`,
                        }}>
                            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Event'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════ UPCOMING PANEL */
function UpcomingPanel({ events, isDark, today, onEventClick }: {
    events: CalEvent[]; isDark: boolean; today: string; onEventClick: (ev: CalEvent) => void;
}) {
    const t = T(isDark);

    const tomorrow = useMemo(() => {
        const d = strToDate(today); d.setDate(d.getDate() + 1); return dateToStr(d);
    }, [today]);
    const weekEnd = useMemo(() => {
        const d = strToDate(today); d.setDate(d.getDate() + 7); return dateToStr(d);
    }, [today]);

    const overdue    = useMemo(() => events.filter(e => e.start_date < today && e.status !== 'completed'), [events, today]);
    const todayEvs   = useMemo(() => events.filter(e => e.start_date === today), [events, today]);
    const tomorrowEv = useMemo(() => events.filter(e => e.start_date === tomorrow), [events, tomorrow]);
    const thisWeek   = useMemo(() => events.filter(e => e.start_date > tomorrow && e.start_date <= weekEnd), [events, tomorrow, weekEnd]);

    const total = overdue.length + todayEvs.length + tomorrowEv.length + thisWeek.length;

    type SectionProps = { label: string; badge: number; items: CalEvent[]; accent: string };
    const Section = ({ label, badge, items, accent }: SectionProps) => {
        if (items.length === 0) return null;
        return (
            <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.muted }}>{label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${accent}14`, color: accent }}>{badge}</span>
                </div>
                {items.map(ev => {
                    const cfg  = EVENT_TYPE_CFG[ev.type] ?? EVENT_TYPE_CFG.meeting;
                    const pCfg = PRIORITY_CFG[ev.priority] ?? PRIORITY_CFG.medium;
                    return (
                        <div key={ev.id} onClick={() => onEventClick(ev)}
                            style={{ display: 'flex', gap: 7, padding: '7px 9px', borderRadius: 8, marginBottom: 3, cursor: 'pointer', border: `1px solid ${t.bord2}`, transition: 'all .12s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = t.hover; e.currentTarget.style.borderColor = t.bord; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.bord2; }}>
                            <div style={{ width: 3, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                                <div style={{ display: 'flex', gap: 5, marginTop: 2, alignItems: 'center' }}>
                                    {ev.start_time && <span style={{ fontSize: 10, color: t.muted }}>{fmtTime(ev.start_time)}</span>}
                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: `${pCfg.color}14`, color: pCfg.color, textTransform: 'uppercase' as const }}>{ev.priority}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={{ width: 252, flexShrink: 0, borderLeft: `1px solid ${t.bord}`, display: 'flex', flexDirection: 'column', background: t.surf, height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '13px 14px 10px', borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Upcoming</span>
                    {total > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#1d6ef514', color: '#1d6ef5' }}>{total}</span>}
                </div>
                <p style={{ fontSize: 11, color: t.muted, margin: '2px 0 0' }}>Events needing attention</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
                {total === 0 ? (
                    <div style={{ textAlign: 'center', paddingTop: 32, color: t.muted }}>
                        <div style={{ fontSize: 26, marginBottom: 7 }}>📅</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>All clear!</div>
                        <div style={{ fontSize: 11, marginTop: 3 }}>No upcoming events</div>
                    </div>
                ) : (
                    <>
                        <Section label="Overdue"    badge={overdue.length}    items={overdue}    accent="#ef4444" />
                        <Section label="Today"      badge={todayEvs.length}   items={todayEvs}   accent="#1d6ef5" />
                        <Section label="Tomorrow"   badge={tomorrowEv.length} items={tomorrowEv} accent="#10b981" />
                        <Section label="This Week"  badge={thisWeek.length}   items={thisWeek}   accent="#f59e0b" />
                    </>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════ MONTH VIEW */
function MonthView({ year, month, events, isDark, today, canCreate, onDateClick, onEventClick }: {
    year: number; month: number; events: CalEvent[];
    isDark: boolean; today: string; canCreate: boolean;
    onDateClick: (ds: string) => void; onEventClick: (ev: CalEvent) => void;
}) {
    const t         = T(isDark);
    const firstDay  = new Date(year, month, 1).getDay();
    const daysInMon = new Date(year, month + 1, 0).getDate();

    const cells = useMemo(() => {
        const arr: Array<{ day: number | null; ds: string }> = [];
        for (let i = 0; i < firstDay; i++) arr.push({ day: null, ds: '' });
        for (let d = 1; d <= daysInMon; d++) arr.push({ day: d, ds: toDateStr(year, month, d) });
        while (arr.length % 7 !== 0) arr.push({ day: null, ds: '' });
        return arr;
    }, [year, month, firstDay, daysInMon]);

    const byDate = useMemo(() => {
        const m: Record<string, CalEvent[]> = {};
        events.forEach(ev => { (m[ev.start_date] ??= []).push(ev); });
        return m;
    }, [events]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: t.surf2, borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
                {DAYS_SHORT.map((d, i) => (
                    <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: i === 0 || i === 6 ? '#ef4444' : t.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                        {d}
                    </div>
                ))}
            </div>
            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, overflow: 'auto' }}>
                {cells.map((cell, idx) => {
                    const isToday   = cell.ds === today;
                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                    const dayEvs    = cell.ds ? (byDate[cell.ds] ?? []) : [];

                    return (
                        <div key={idx} onClick={() => cell.day && canCreate && onDateClick(cell.ds)}
                            style={{
                                minHeight: 108, padding: '5px 3px 3px',
                                borderRight: `1px solid ${t.bord}`, borderBottom: `1px solid ${t.bord}`,
                                background: cell.day == null
                                    ? (isDark ? 'rgba(255,255,255,.012)' : 'rgba(0,0,0,.012)')
                                    : isToday
                                    ? (isDark ? 'rgba(29,110,245,.10)' : 'rgba(29,110,245,.06)')
                                    : isWeekend
                                    ? (isDark ? 'rgba(255,255,255,.015)' : 'rgba(0,0,0,.015)')
                                    : 'transparent',
                                cursor: cell.day && canCreate ? 'pointer' : 'default',
                                transition: 'background .12s', overflow: 'hidden',
                            }}
                            onMouseEnter={e => { if (cell.day && canCreate) e.currentTarget.style.background = isDark ? 'rgba(29,110,245,.08)' : 'rgba(29,110,245,.04)'; }}
                            onMouseLeave={e => {
                                if (!cell.day) return;
                                e.currentTarget.style.background = isToday
                                    ? (isDark ? 'rgba(29,110,245,.10)' : 'rgba(29,110,245,.06)')
                                    : isWeekend ? (isDark ? 'rgba(255,255,255,.015)' : 'rgba(0,0,0,.015)') : 'transparent';
                            }}>
                            {cell.day != null && (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 3, marginBottom: 2 }}>
                                        <span style={{
                                            width: 22, height: 22, borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11.5, fontWeight: isToday ? 700 : 500,
                                            background: isToday ? '#1d6ef5' : 'transparent',
                                            color: isToday ? 'white' : isWeekend ? '#ef4444' : t.sub,
                                        }}>{cell.day}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 1px' }}>
                                        {dayEvs.slice(0, 3).map(ev => (
                                            <EventChip key={ev.id} ev={ev} isDark={isDark}
                                                onClick={e => { e.stopPropagation(); onEventClick(ev); }} />
                                        ))}
                                        {dayEvs.length > 3 && (
                                            <div style={{ fontSize: 10, color: '#1d6ef5', fontWeight: 600, padding: '0 3px', cursor: 'pointer' }}>
                                                +{dayEvs.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════ WEEK VIEW */
const HR_START = 6;
const HR_END   = 22;
const HR_PX    = 60;
const GRID_H   = (HR_END - HR_START) * HR_PX;

function timeMins(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minsTop(m: number)  { return ((m - HR_START * 60) / 60) * HR_PX; }

function WeekView({ weekDays, events, isDark, today, canCreate, onSlotClick, onEventClick }: {
    weekDays: Date[]; events: CalEvent[];
    isDark: boolean; today: string; canCreate: boolean;
    onSlotClick: (ds: string, hr: number) => void; onEventClick: (ev: CalEvent) => void;
}) {
    const t     = T(isDark);
    const hours = Array.from({ length: HR_END - HR_START }, (_, i) => HR_START + i);

    const weekDs = useMemo(() => new Set(weekDays.map(d => dateToStr(d))), [weekDays]);

    const allDay = useMemo(() => {
        const m: Record<string, CalEvent[]> = {};
        weekDays.forEach(d => { m[dateToStr(d)] = []; });
        events.forEach(ev => { if (!ev.start_time && weekDs.has(ev.start_date)) m[ev.start_date].push(ev); });
        return m;
    }, [weekDays, events, weekDs]);

    const timed = useMemo(() => {
        const m: Record<string, CalEvent[]> = {};
        weekDays.forEach(d => { m[dateToStr(d)] = []; });
        events.forEach(ev => { if (ev.start_time && weekDs.has(ev.start_date)) m[ev.start_date].push(ev); });
        return m;
    }, [weekDays, events, weekDs]);

    const hasAllDay = weekDays.some(d => (allDay[dateToStr(d)] ?? []).length > 0);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', background: t.surf2, borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
                <div />
                {weekDays.map(d => {
                    const ds = dateToStr(d); const isToday = ds === today;
                    return (
                        <div key={ds} style={{ padding: '8px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{DAYS_SHORT[d.getDay()]}</div>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: isToday ? '#1d6ef5' : 'transparent', color: isToday ? 'white' : t.text }}>{d.getDate()}</div>
                        </div>
                    );
                })}
            </div>

            {/* All-day strip */}
            {hasAllDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 9, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>All day</span>
                    </div>
                    {weekDays.map(d => {
                        const ds = dateToStr(d); const evs = allDay[ds] ?? [];
                        return (
                            <div key={ds} style={{ padding: '3px 2px', minHeight: 24, borderLeft: `1px solid ${t.bord}` }}>
                                {evs.map(ev => <EventChip key={ev.id} ev={ev} isDark={isDark} onClick={e => { e.stopPropagation(); onEventClick(ev); }} />)}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Time grid */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', minHeight: GRID_H }}>
                    {/* Hour labels */}
                    <div style={{ position: 'relative' }}>
                        {hours.map(h => (
                            <div key={h} style={{ position: 'absolute', top: (h - HR_START) * HR_PX - 8, right: 6, fontSize: 9.5, color: t.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                            </div>
                        ))}
                    </div>
                    {/* Day columns */}
                    {weekDays.map(d => {
                        const ds = dateToStr(d); const isToday = ds === today;
                        const evs = timed[ds] ?? [];
                        return (
                            <div key={ds} style={{ position: 'relative', height: GRID_H, borderLeft: `1px solid ${t.bord}`, background: isToday ? (isDark ? 'rgba(29,110,245,.04)' : 'rgba(29,110,245,.025)') : 'transparent' }}>
                                {/* Hour rows (click target) */}
                                {hours.map(h => (
                                    <div key={h} style={{ position: 'absolute', top: (h - HR_START) * HR_PX, left: 0, right: 0, height: HR_PX, borderTop: `1px solid ${t.bord2}`, cursor: canCreate ? 'pointer' : 'default' }}
                                        onClick={() => canCreate && onSlotClick(ds, h)} />
                                ))}
                                {/* Events */}
                                {evs.map((ev, i) => {
                                    const sm = timeMins(ev.start_time!);
                                    const em = ev.end_time ? timeMins(ev.end_time) : sm + 60;
                                    const top = minsTop(sm); const h = Math.max(26, ((em - sm) / 60) * HR_PX - 2);
                                    const c = evColor(ev);
                                    return (
                                        <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev); }} style={{
                                            position: 'absolute', top, left: `${Math.min(i * 3, 12)}%`, right: 2, height: h, zIndex: 10 + i,
                                            background: `${c}cc`, borderLeft: `3px solid ${c}`, borderRadius: 5,
                                            padding: '2px 4px', color: 'white', fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                                            overflow: 'hidden', boxShadow: `0 1px 6px ${c}30`,
                                        }}>
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                                            {h > 38 && <div style={{ fontSize: 9, opacity: .8 }}>{fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════ DAY VIEW */
function DayView({ date, events, isDark, today, canCreate, onSlotClick, onEventClick }: {
    date: Date; events: CalEvent[];
    isDark: boolean; today: string; canCreate: boolean;
    onSlotClick: (ds: string, hr: number) => void; onEventClick: (ev: CalEvent) => void;
}) {
    const t       = T(isDark);
    const ds      = dateToStr(date);
    const isToday = ds === today;
    const hours   = Array.from({ length: HR_END - HR_START }, (_, i) => HR_START + i);

    const allDay = useMemo(() => events.filter(e => e.start_date === ds && !e.start_time), [events, ds]);
    const timed  = useMemo(() => events.filter(e => e.start_date === ds &&  e.start_time), [events, ds]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', background: t.surf2, borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
                <div />
                <div style={{ padding: '10px 16px' }}>
                    <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>{DAYS_FULL[date.getDay()]}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, background: isToday ? '#1d6ef5' : 'transparent', color: isToday ? 'white' : t.text }}>{date.getDate()}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: t.sub }}>{MONTHS_FULL[date.getMonth()]} {date.getFullYear()}</span>
                        {isToday && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#1d6ef514', color: '#1d6ef5', border: '1px solid #1d6ef530' }}>Today</span>}
                    </div>
                </div>
            </div>

            {/* All-day strip */}
            {allDay.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 9, color: t.muted, fontWeight: 600, textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '.05em' }}>All day</span>
                    </div>
                    <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {allDay.map(ev => <EventChip key={ev.id} ev={ev} isDark={isDark} onClick={e => { e.stopPropagation(); onEventClick(ev); }} />)}
                    </div>
                </div>
            )}

            {/* Time grid */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', minHeight: GRID_H }}>
                    <div style={{ position: 'relative' }}>
                        {hours.map(h => (
                            <div key={h} style={{ position: 'absolute', top: (h - HR_START) * HR_PX - 8, right: 8, fontSize: 9.5, color: t.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                            </div>
                        ))}
                    </div>
                    <div style={{ position: 'relative', height: GRID_H, borderLeft: `1px solid ${t.bord}`, background: isToday ? (isDark ? 'rgba(29,110,245,.04)' : 'rgba(29,110,245,.025)') : 'transparent' }}>
                        {hours.map(h => (
                            <div key={h} style={{ position: 'absolute', top: (h - HR_START) * HR_PX, left: 0, right: 0, height: HR_PX, borderTop: `1px solid ${t.bord2}`, cursor: canCreate ? 'pointer' : 'default' }}
                                onClick={() => canCreate && onSlotClick(ds, h)} />
                        ))}
                        {timed.map((ev, i) => {
                            const sm = timeMins(ev.start_time!);
                            const em = ev.end_time ? timeMins(ev.end_time) : sm + 60;
                            const top = minsTop(sm); const h = Math.max(34, ((em - sm) / 60) * HR_PX - 2);
                            const c   = evColor(ev); const cfg = EVENT_TYPE_CFG[ev.type] ?? EVENT_TYPE_CFG.meeting;
                            return (
                                <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev); }} style={{
                                    position: 'absolute', top, left: `${i * 3}%`, right: 10, height: h, zIndex: 10 + i,
                                    background: `${c}18`, border: `1px solid ${c}44`, borderLeft: `4px solid ${c}`,
                                    borderRadius: 8, padding: '6px 10px', cursor: 'pointer', boxShadow: `0 2px 8px ${c}20`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 13 }}>{cfg.icon}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                                            <div style={{ fontSize: 11, color: t.muted }}>{fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}{ev.location ? ` · ${ev.location}` : ''}</div>
                                        </div>
                                    </div>
                                    {h > 70 && ev.description && (
                                        <div style={{ fontSize: 11, color: t.muted, marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{ev.description}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════ AGENDA VIEW */
function AgendaView({ events, isDark, today, onEventClick }: {
    events: CalEvent[]; isDark: boolean; today: string; onEventClick: (ev: CalEvent) => void;
}) {
    const t = T(isDark);

    const grouped = useMemo(() => {
        const m: Record<string, CalEvent[]> = {};
        [...events].sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.start_time ?? '').localeCompare(b.start_time ?? '')).forEach(ev => { (m[ev.start_date] ??= []).push(ev); });
        return m;
    }, [events]);

    const dates = Object.keys(grouped).sort();

    if (dates.length === 0) return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: T(isDark).muted, padding: 40 }}>
            <div style={{ fontSize: 38, opacity: .35 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.sub }}>No events yet</div>
            <div style={{ fontSize: 12 }}>Create your first event to see it here.</div>
        </div>
    );

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px' }}>
            {dates.map(ds => {
                const evs    = grouped[ds];
                const isPast = ds < today;
                const d      = strToDate(ds);
                return (
                    <div key={ds} style={{ marginBottom: 24 }}>
                        {/* Date header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                                background: ds === today ? '#1d6ef5' : isPast ? t.surf3 : t.surf2,
                                border: `1px solid ${ds === today ? '#1d6ef5' : t.bord}`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: ds === today ? 'rgba(255,255,255,.7)' : t.muted, textTransform: 'uppercase', letterSpacing: '.07em', lineHeight: 1 }}>{MONTHS_SHORT[d.getMonth()]}</span>
                                <span style={{ fontSize: 18, fontWeight: 800, color: ds === today ? 'white' : isPast ? t.muted : t.text, lineHeight: 1.1 }}>{d.getDate()}</span>
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: ds === today ? '#1d6ef5' : isPast ? t.muted : t.text }}>
                                    {fmtDateLabel(ds, today)}
                                    {isPast && ds !== today && <span style={{ fontSize: 9, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: '#ef444414', color: '#ef4444', fontWeight: 700 }}>Overdue</span>}
                                </div>
                                <div style={{ fontSize: 11, color: t.muted }}>{evs.length} event{evs.length !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                        {/* Event rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 56 }}>
                            {evs.map(ev => {
                                const cfg  = EVENT_TYPE_CFG[ev.type] ?? EVENT_TYPE_CFG.meeting;
                                const pCfg = PRIORITY_CFG[ev.priority] ?? PRIORITY_CFG.medium;
                                const c    = evColor(ev);
                                return (
                                    <div key={ev.id} onClick={() => onEventClick(ev)} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 12,
                                        padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                                        background: t.surf, border: `1px solid ${t.bord}`,
                                        borderLeft: `3px solid ${c}`, transition: 'all .14s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = t.surf2; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = t.surf; }}>
                                        <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                                                <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{ev.title}</span>
                                                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${c}14`, color: c, border: `1px solid ${c}30` }}>{cfg.label}</span>
                                                <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: `${pCfg.color}14`, color: pCfg.color }}>{pCfg.label}</span>
                                                {ev.recurrence !== 'none' && <span style={{ fontSize: 9.5, color: t.muted, padding: '1px 5px', borderRadius: 4, background: t.surf2, border: `1px solid ${t.bord}` }}>↻ {ev.recurrence}</span>}
                                            </div>
                                            {ev.start_time && <div style={{ fontSize: 11.5, color: t.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                {fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
                                            </div>}
                                            {ev.location && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                {ev.location}
                                            </div>}
                                            {ev.description && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{ev.description}</div>}
                                        </div>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}><polyline points="9 18 15 12 9 6"/></svg>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════ MAIN PAGE */
const CalendarPage = () => {
    const { isDark } = useTheme();
    const t = T(isDark);

    const role      = localStorage.getItem('role') ?? '';
    const userId    = localStorage.getItem('userId') ?? '';
    const canCreate = ['founder', 'admin', 'sub_admin'].includes(role);
    const canDelete = ['founder', 'admin', 'sub_admin'].includes(role);

    const TODAY = todayStr();

    const [view,        setView]        = useState<CalView>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events,      setEvents]      = useState<CalEvent[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [projects,    setProjects]    = useState<WsProject[]>([]);
    const [users,       setUsers]       = useState<WsUser[]>([]);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing,   setEditing]   = useState<CalEvent | null>(null);
    const [initDate,  setInitDate]  = useState(TODAY);
    const [initTime,  setInitTime]  = useState('');
    const [saving,    setSaving]    = useState(false);
    const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        const data = await apiFetchEvents();
        setEvents(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadEvents();
        apiFetchProjects().then(setProjects);
        apiFetchUsers().then(setUsers);
    }, [loadEvents]);

    const navigate = useCallback((dir: -1 | 1) => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            if (view === 'month')       d.setMonth(d.getMonth() + dir);
            else if (view === 'week')   d.setDate(d.getDate() + 7 * dir);
            else if (view === 'day')    d.setDate(d.getDate() + dir);
            else                        d.setDate(d.getDate() + 7 * dir);
            return d;
        });
    }, [view]);

    const goToday = () => setCurrentDate(new Date());

    const year     = currentDate.getFullYear();
    const month    = currentDate.getMonth();
    const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

    const headerTitle = useMemo(() => {
        if (view === 'month') return `${MONTHS_FULL[month]} ${year}`;
        if (view === 'week') {
            const s = weekDays[0]; const e = weekDays[6];
            if (s.getMonth() === e.getMonth())
                return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
            return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
        }
        if (view === 'day') return `${DAYS_FULL[currentDate.getDay()]}, ${MONTHS_FULL[month]} ${currentDate.getDate()}, ${year}`;
        return 'Agenda';
    }, [view, year, month, currentDate, weekDays]);

    const visibleEvents = useMemo(() => {
        if (view === 'agenda') return events;
        if (view === 'month') {
            const s = toDateStr(year, month, 1);
            const e = toDateStr(year, month, new Date(year, month + 1, 0).getDate());
            return events.filter(ev => ev.start_date >= s && ev.start_date <= e);
        }
        if (view === 'week') {
            const s = dateToStr(weekDays[0]); const e = dateToStr(weekDays[6]);
            return events.filter(ev => ev.start_date >= s && ev.start_date <= e);
        }
        return events.filter(ev => ev.start_date === dateToStr(currentDate));
    }, [events, view, year, month, currentDate, weekDays]);

    const openNew = (ds: string, hr?: number) => {
        if (!canCreate) return;
        setEditing(null);
        setInitDate(ds);
        setInitTime(hr != null ? `${pad2(hr)}:00` : '');
        setModalOpen(true);
    };
    const openEdit = (ev: CalEvent) => {
        if (!canCreate && ev.created_by !== userId) return;
        setEditing(ev);
        setInitDate(ev.start_date);
        setInitTime('');
        setModalOpen(true);
    };

    const handleSave = async (data: Record<string, unknown>) => {
        setSaving(true);
        try {
            if (editing) {
                const updated = await apiUpdate(editing.id, data);
                setEvents(prev => prev.map(e => e.id === editing.id ? updated : e));
                setToast({ msg: 'Event updated', ok: true });
            } else {
                const created = await apiCreate(data);
                setEvents(prev => [...prev, created]);
                setToast({ msg: 'Event created', ok: true });
            }
            setModalOpen(false);
        } catch (err: unknown) {
            setToast({ msg: err instanceof Error ? err.message : 'Failed', ok: false });
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            await apiDelete(editing.id);
            setEvents(prev => prev.filter(e => e.id !== editing.id));
            setModalOpen(false);
            setToast({ msg: 'Event deleted', ok: true });
        } catch { setToast({ msg: 'Delete failed', ok: false }); }
        finally { setSaving(false); }
    };

    const VIEWS: { key: CalView; label: string }[] = [
        { key: 'month',  label: 'Month'  },
        { key: 'week',   label: 'Week'   },
        { key: 'day',    label: 'Day'    },
        { key: 'agenda', label: 'Agenda' },
    ];

    const BLUE = '#1d6ef5';

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s' }}>
            <style>{`
                @keyframes calSlide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
                @keyframes calToast { 0%{opacity:0;transform:translateY(8px)} 15%{opacity:1;transform:translateY(0)} 85%{opacity:1} 100%{opacity:0} }
                @keyframes calSpin  { to{transform:rotate(360deg)} }
            `}</style>

            <Sidebar />

            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>

                {/* ── TOP TOOLBAR ── */}
                <div style={{ height: 56, padding: '0 20px', flexShrink: 0, background: t.surf, borderBottom: `1px solid ${t.bord}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    {/* Left: nav + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {([-1, 1] as const).map(dir => (
                            <button key={dir} onClick={() => navigate(dir)} style={{
                                width: 28, height: 28, borderRadius: 7, border: `1px solid ${t.bord}`,
                                background: 'transparent', color: t.sub, fontSize: 17, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'all .12s',
                            }} onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = BLUE; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.color = t.sub; }}>
                                {dir === -1 ? '‹' : '›'}
                            </button>
                        ))}
                        <h1 style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: '-.02em', margin: 0, minWidth: 180 }}>{headerTitle}</h1>
                        <button onClick={goToday} style={{ padding: '4px 11px', borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = BLUE; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.color = t.sub; }}>
                            Today
                        </button>
                        {loading && <div style={{ width: 14, height: 14, border: `2px solid ${t.bord}`, borderTopColor: BLUE, borderRadius: '50%', animation: 'calSpin 1s linear infinite', flexShrink: 0 }} />}
                    </div>

                    {/* Center: view tabs */}
                    <div style={{ display: 'flex', background: t.surf2, border: `1px solid ${t.bord}`, borderRadius: 9, overflow: 'hidden' }}>
                        {VIEWS.map(v => (
                            <button key={v.key} onClick={() => setView(v.key)} style={{
                                padding: '5px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                fontSize: 12, fontWeight: view === v.key ? 700 : 500,
                                background: view === v.key ? BLUE : 'transparent',
                                color: view === v.key ? 'white' : t.muted, transition: 'all .15s',
                            }}>
                                {v.label}
                            </button>
                        ))}
                    </div>

                    {/* Right: event count + new event */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {!loading && <span style={{ fontSize: 11, color: t.muted }}>{events.length} event{events.length !== 1 ? 's' : ''}</span>}
                        {canCreate ? (
                            <button onClick={() => openNew(TODAY)} style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 9, border: 'none',
                                background: BLUE, color: 'white', fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 2px 10px ${BLUE}40`, transition: 'opacity .15s',
                            }} onMouseEnter={e => (e.currentTarget.style.opacity = '.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                New Event
                            </button>
                        ) : (
                            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: t.surf2, color: t.muted, border: `1px solid ${t.bord}` }}>View Only</span>
                        )}
                    </div>
                </div>

                {/* ── MAIN CONTENT + PANEL ── */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                        {view === 'month' && (
                            <MonthView year={year} month={month} events={visibleEvents} isDark={isDark} today={TODAY} canCreate={canCreate} onDateClick={ds => openNew(ds)} onEventClick={openEdit} />
                        )}
                        {view === 'week' && (
                            <WeekView weekDays={weekDays} events={visibleEvents} isDark={isDark} today={TODAY} canCreate={canCreate} onSlotClick={(ds, hr) => openNew(ds, hr)} onEventClick={openEdit} />
                        )}
                        {view === 'day' && (
                            <DayView date={currentDate} events={visibleEvents} isDark={isDark} today={TODAY} canCreate={canCreate} onSlotClick={(ds, hr) => openNew(ds, hr)} onEventClick={openEdit} />
                        )}
                        {view === 'agenda' && (
                            <AgendaView events={events} isDark={isDark} today={TODAY} onEventClick={openEdit} />
                        )}
                    </div>

                    <UpcomingPanel events={events} isDark={isDark} today={TODAY} onEventClick={openEdit} />
                </div>
            </div>

            {/* ── MODAL ── */}
            {modalOpen && (
                <EventModal
                    editing={editing} initDate={initDate} initTime={initTime}
                    isDark={isDark} canDelete={canDelete}
                    projects={projects} users={users}
                    saving={saving}
                    onSave={handleSave} onDelete={handleDelete}
                    onClose={() => !saving && setModalOpen(false)}
                />
            )}

            {/* ── TOAST ── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
                    padding: '10px 18px', borderRadius: 10, animation: 'calToast 3.2s ease both',
                    background: toast.ok ? '#10b981' : '#ef4444', color: 'white', fontSize: 13, fontWeight: 600,
                    boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                }} onAnimationEnd={() => setToast(null)}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default CalendarPage;
