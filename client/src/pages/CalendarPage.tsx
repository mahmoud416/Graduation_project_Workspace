import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

/* ─────────────────── Types ─────────────────── */
interface CalendarEvent {
    id: string;
    title: string;
    description?: string | null;
    date: string;   // "YYYY-MM-DD"
    color: string;  // Tailwind bg class
}

/* ─────────────────── Constants ─────────────────── */
const COLORS = [
    { label: 'Blue',    cls: 'bg-blue-500',    ring: 'ring-blue-500',    dot: 'bg-blue-500'    },
    { label: 'Emerald', cls: 'bg-emerald-500', ring: 'ring-emerald-500', dot: 'bg-emerald-500' },
    { label: 'Violet',  cls: 'bg-violet-500',  ring: 'ring-violet-500',  dot: 'bg-violet-500'  },
    { label: 'Red',     cls: 'bg-red-500',     ring: 'ring-red-500',     dot: 'bg-red-500'     },
    { label: 'Orange',  cls: 'bg-orange-400',  ring: 'ring-orange-400',  dot: 'bg-orange-400'  },
    { label: 'Pink',    cls: 'bg-pink-500',    ring: 'ring-pink-500',    dot: 'bg-pink-500'    },
];

const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const toDateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

/* ─────────────────── API helpers ─────────────────── */
const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
});

async function apiFetchEvents(): Promise<CalendarEvent[]> {
    const res = await fetch(`${API_BASE}/events`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<CalendarEvent[]>;
}
async function apiCreateEvent(data: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const res = await fetch(`${API_BASE}/events`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: data.title, description: data.description, date: data.date, color: data.color }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<CalendarEvent>;
}
async function apiUpdateEvent(id: string, data: Partial<Omit<CalendarEvent,'id'>>): Promise<CalendarEvent> {
    const res = await fetch(`${API_BASE}/events/${id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<CalendarEvent>;
}
async function apiDeleteEvent(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok && res.status !== 204) throw new Error(`${res.status}`);
}

/* ─────────────────── Component ─────────────────── */
const CalendarPage = () => {
    const today = new Date();
    const [year, setYear]   = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [events, setEvents]   = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [role, setRole]   = useState<string | null>(null);

    /* Modal */
    const [modalOpen, setModalOpen]       = useState(false);
    const [isSaving, setIsSaving]         = useState(false);
    const [modalDate, setModalDate]       = useState('');
    const [modalTitle, setModalTitle]     = useState('');
    const [modalDesc, setModalDesc]       = useState('');
    const [modalColor, setModalColor]     = useState(COLORS[0].cls);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const titleRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setRole(localStorage.getItem('role'));
        const sync = () => setRole(localStorage.getItem('role'));
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);

    const isAdmin = role === 'admin';

    /* Fetch events */
    const loadEvents = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await apiFetchEvents();
            setEvents(data);
        } catch { /* silent — non-admin might get 403; just show empty */ }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { void loadEvents(); }, [loadEvents]);

    /* Grid */
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = useMemo(() => {
        const cells: Array<{ day: number | null; ds: string }> = [];
        for (let i = 0; i < firstDay; i++) cells.push({ day: null, ds: '' });
        for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, ds: toDateStr(year, month, d) });
        while (cells.length % 7 !== 0) cells.push({ day: null, ds: '' });
        return cells;
    }, [year, month, daysInMonth, firstDay]);

    const byDate = useMemo(() => {
        const m: Record<string, CalendarEvent[]> = {};
        events.forEach(e => { (m[e.date] ??= []).push(e); });
        return m;
    }, [events]);

    /* Navigation */
    const prevMonth = () => month === 0 ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1);
    const nextMonth = () => month === 11 ? (setYear(y => y+1), setMonth(0)) : setMonth(m => m+1);
    const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

    const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    /* Open modals */
    const openAdd = (ds: string) => {
        if (!isAdmin) return;
        setEditingEvent(null);
        setModalDate(ds);
        setModalTitle('');
        setModalDesc('');
        setModalColor(COLORS[0].cls);
        setModalOpen(true);
        setTimeout(() => titleRef.current?.focus(), 50);
    };
    const openEdit = (ev: CalendarEvent, e: React.MouseEvent) => {
        if (!isAdmin) return;
        e.stopPropagation();
        setEditingEvent(ev);
        setModalDate(ev.date);
        setModalTitle(ev.title);
        setModalDesc(ev.description ?? '');
        setModalColor(ev.color);
        setModalOpen(true);
        setTimeout(() => titleRef.current?.focus(), 50);
    };

    /* Save */
    const handleSave = async () => {
        const title = modalTitle.trim();
        if (!title || isSaving) return;
        try {
            setIsSaving(true);
            if (editingEvent) {
                const updated = await apiUpdateEvent(editingEvent.id, {
                    title, description: modalDesc || null, date: modalDate, color: modalColor,
                });
                setEvents(prev => prev.map(e => e.id === editingEvent.id ? updated : e));
            } else {
                const created = await apiCreateEvent({ title, description: modalDesc || null, date: modalDate, color: modalColor });
                setEvents(prev => [...prev, created]);
            }
            setModalOpen(false);
        } catch { /* silent */ }
        finally { setIsSaving(false); }
    };

    /* Delete */
    const handleDelete = async () => {
        if (!editingEvent || isSaving) return;
        try {
            setIsSaving(true);
            await apiDeleteEvent(editingEvent.id);
            setEvents(prev => prev.filter(e => e.id !== editingEvent.id));
            setModalOpen(false);
        } catch { /* silent */ }
        finally { setIsSaving(false); }
    };

    /* Upcoming */
    const upcoming = events
        .filter(e => e.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 8);

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />

            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title="Calendar" />

                <main className="page-main p-6 md:p-8">
                    <div className="flex gap-6">

                        {/* ═══════════ Main Calendar ═══════════ */}
                        <div className="flex-1 min-w-0">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

                                {/* ── Top bar ── */}
                                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                                    <div className="flex items-center gap-2">
                                        <button onClick={prevMonth}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>

                                        <h2 className="text-lg font-bold text-white w-48 text-center select-none">
                                            {MONTHS[month]} {year}
                                        </h2>

                                        <button onClick={nextMonth}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>

                                        <button onClick={goToday}
                                            className="ml-1 px-3 py-1 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors">
                                            Today
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-white/70 text-xs hidden sm:block">
                                            {events.length} event{events.length !== 1 ? 's' : ''}
                                        </span>
                                        {isAdmin && (
                                            <button onClick={() => openAdd(todayStr)}
                                                className="h-9 px-4 bg-white text-blue-600 font-bold text-sm rounded-xl hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-sm">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                </svg>
                                                Add Event
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* ── Day headers ── */}
                                <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
                                    {DAYS.map(d => (
                                        <div key={d}
                                            className="py-2.5 text-center text-[11px] font-bold text-text-gray dark:text-gray-400 uppercase tracking-wide">
                                            {d}
                                        </div>
                                    ))}
                                </div>

                                {/* ── Grid cells ── */}
                                <div className={`grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-gray-700/40 ${isLoading ? 'opacity-50' : ''}`}>
                                    {grid.map((cell, idx) => {
                                        const isToday   = cell.ds === todayStr;
                                        const isWeekend = [0, 6].includes(idx % 7);
                                        const dayEvs    = cell.ds ? (byDate[cell.ds] ?? []) : [];

                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => cell.day != null && openAdd(cell.ds)}
                                                className={`
                                                    min-h-[108px] p-1.5 relative transition-colors group
                                                    ${!cell.day ? 'bg-gray-50/60 dark:bg-gray-700/10' : ''}
                                                    ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                                                    ${isWeekend && cell.day ? (isToday ? '' : 'bg-gray-50/40 dark:bg-gray-800/40') : ''}
                                                    ${cell.day && isAdmin ? 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/10' : ''}
                                                `}
                                            >
                                                {cell.day != null && (
                                                    <>
                                                        <div className={`
                                                            w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 select-none
                                                            ${isToday
                                                                ? 'bg-blue-600 text-white shadow-sm'
                                                                : 'text-text-dark dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'}
                                                        `}>
                                                            {cell.day}
                                                        </div>

                                                        <div className="space-y-0.5">
                                                            {dayEvs.slice(0, 3).map(ev => (
                                                                <div
                                                                    key={ev.id}
                                                                    onClick={e => openEdit(ev, e)}
                                                                    title={ev.title}
                                                                    className={`
                                                                        ${ev.color} text-white text-[10px] px-1.5 py-0.5
                                                                        rounded-md truncate font-semibold leading-4 shadow-sm
                                                                        ${isAdmin ? 'cursor-pointer hover:brightness-90' : 'cursor-default'}
                                                                    `}
                                                                >
                                                                    {ev.title}
                                                                </div>
                                                            ))}
                                                            {dayEvs.length > 3 && (
                                                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold px-1">
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
                        </div>

                        {/* ═══════════ Sidebar ═══════════ */}
                        <div className="w-72 flex-shrink-0 space-y-4">

                            {/* Upcoming events */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 bg-gradient-to-r from-slate-700 to-slate-800 dark:from-gray-700 dark:to-gray-800">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-white">Upcoming Events</h3>
                                        <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full">
                                            {upcoming.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4">
                                    {isLoading ? (
                                        <p className="text-xs text-text-gray dark:text-gray-400 text-center py-4">Loading…</p>
                                    ) : upcoming.length === 0 ? (
                                        <div className="text-center py-6">
                                            <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-xs text-text-gray dark:text-gray-400">No upcoming events</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {upcoming.map(ev => {
                                                const [evY, evM, evD] = ev.date.split('-').map(Number);
                                                const label = `${MONTHS[evM - 1].slice(0,3)} ${evD}${evY !== today.getFullYear() ? ` ${evY}` : ''}`;
                                                return (
                                                    <div key={ev.id}
                                                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ev.color}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-sm font-medium text-text-dark dark:text-gray-100 truncate">{ev.title}</div>
                                                            <div className="text-xs text-text-gray dark:text-gray-400">{label}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info card */}
                            <div className={`rounded-2xl p-5 border ${
                                isAdmin
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40'
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <svg className={`w-4 h-4 ${isAdmin ? 'text-blue-600 dark:text-blue-400' : 'text-text-gray dark:text-gray-400'}`}
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className={`text-xs font-bold uppercase ${isAdmin ? 'text-blue-600 dark:text-blue-400' : 'text-text-gray dark:text-gray-400'}`}>
                                        {isAdmin ? 'Admin — Event Manager' : 'View Only'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                    {isAdmin
                                        ? 'Click any day on the calendar or use "Add Event" to create events. Team members will see your events.'
                                        : 'Events are created by the admin and shared with the whole team. Check back regularly.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* ═══════════ Add / Edit Modal ═══════════ */}
            {modalOpen && isAdmin && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => !isSaving && setModalOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-base font-bold text-white">
                                    {editingEvent ? 'Edit Event' : 'New Event'}
                                </h2>
                            </div>
                            <button
                                onClick={() => !isSaving && setModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            >
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-text-gray dark:text-gray-400 mb-1.5">
                                    Title <span className="text-danger">*</span>
                                </label>
                                <input
                                    ref={titleRef}
                                    type="text"
                                    value={modalTitle}
                                    onChange={e => setModalTitle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') void handleSave(); }}
                                    placeholder="e.g. Team Meeting, Sprint Review…"
                                    disabled={isSaving}
                                    className="w-full h-11 px-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700/50 text-text-dark dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-text-gray dark:text-gray-400 mb-1.5">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={modalDate}
                                    onChange={e => setModalDate(e.target.value)}
                                    disabled={isSaving}
                                    className="w-full h-11 px-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700/50 text-text-dark dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-text-gray dark:text-gray-400 mb-1.5">
                                    Note (optional)
                                </label>
                                <textarea
                                    value={modalDesc}
                                    onChange={e => setModalDesc(e.target.value)}
                                    rows={2}
                                    disabled={isSaving}
                                    placeholder="Short description for the event…"
                                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700/50 text-text-dark dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-text-gray dark:text-gray-400 mb-2">
                                    Color
                                </label>
                                <div className="flex items-center gap-2.5">
                                    {COLORS.map(c => (
                                        <button
                                            key={c.cls}
                                            type="button"
                                            disabled={isSaving}
                                            onClick={() => setModalColor(c.cls)}
                                            title={c.label}
                                            className={`
                                                w-8 h-8 rounded-full ${c.cls} flex items-center justify-center
                                                transition-all hover:scale-110 disabled:cursor-not-allowed
                                                ${modalColor === c.cls ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}
                                            `}
                                        >
                                            {modalColor === c.cls && (
                                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/40 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            {editingEvent ? (
                                <button
                                    onClick={() => void handleDelete()}
                                    disabled={isSaving}
                                    className="h-9 px-4 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Delete
                                </button>
                            ) : <span />}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setModalOpen(false)}
                                    disabled={isSaving}
                                    className="h-9 px-4 text-sm font-medium text-text-dark dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => void handleSave()}
                                    disabled={!modalTitle.trim() || isSaving}
                                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm flex items-center gap-1.5"
                                >
                                    {isSaving ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                    ) : null}
                                    {editingEvent ? 'Save Changes' : 'Create Event'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPage;
