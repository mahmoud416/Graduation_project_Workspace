/**
 * ProjectWorkspace — Orbit project execution workspace.
 * Route: /workspace?projectId=:id
 *
 * Step 2: Kanban board — rich task cards, column headers, inline task creation.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';
import Sidebar from '../components/Sidebar';
import MultiAssigneePicker from '../components/MultiAssigneePicker';
import type { TeamMember } from '../components/MultiAssigneePicker';
import TaskSubmitDrawer from '../components/TaskSubmitDrawer';
import type { EvaluationResult } from '../services/qcService';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

/* ── theme tokens ────────────────────────────────────────────────────────── */
const T = (d: boolean) => ({
  bg:    d ? '#0b0d14' : '#f0f4f8',
  surf:  d ? '#111420' : '#ffffff',
  surf2: d ? '#161924' : '#f8fafc',
  surf3: d ? '#1d2235' : '#edf2f7',
  bord:  d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
  bord2: d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
  text:  d ? '#f0f4f9' : '#0f172a',
  sub:   d ? 'rgba(255,255,255,.62)' : '#334155',
  muted: d ? 'rgba(255,255,255,.30)' : '#94a3b8',
  hover: d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
  inbg:  d ? 'rgba(255,255,255,.04)' : '#f8fafc',
  inbd:  d ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.10)',
  shadow:d ? '0 24px 64px rgba(0,0,0,.6)' : '0 12px 40px rgba(0,0,0,.10)',
});

const BLUE = '#1d6ef5', GRN = '#10b981', AMB = '#f59e0b', RED = '#ef4444', PURP = '#8b5cf6', ORNG = '#f97316';

/* ── kanban column config ────────────────────────────────────────────────── */
const KANBAN_COLS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo',        label: 'To Do',       color: '#64748b' },
  { id: 'in_progress', label: 'In Progress', color: BLUE      },
  { id: 'review',      label: 'Review',      color: AMB       },
  { id: 'done',        label: 'Done',        color: GRN       },
];

/* ── priority config ─────────────────────────────────────────────────────── */
const PRIO: Record<TaskPriority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: RED  },
  high:   { label: 'High',   color: ORNG },
  medium: { label: 'Medium', color: AMB  },
  low:    { label: 'Low',    color: '#64748b' },
};

/* ── helper types ────────────────────────────────────────────────────────── */
type TaskStatus   = 'todo' | 'in_progress' | 'review' | 'done';
type TaskPriority = 'low'  | 'medium'      | 'high'   | 'urgent';
type DetailTab    = 'info' | 'discussion'  | 'files'  | 'ai';

type CommentPayload = {
  message:         string;
  attachments?:    File[];
  replyToId?:      string;
  replyToPreview?: string;
  replyToAuthor?:  string;
  mentionedIds?:   string[];
  taskId?:         string;
};

type CreateTaskParams = {
  title:       string;
  status:      TaskStatus;
  priority:    TaskPriority;
  assigneeIds: string[];
  visibility:  'team' | 'private';
  due?:        string;
  reportType?: string;
  description?: string;
};
type ReportType   = { key: string; name_en: string; name_ar: string };

const DEFAULT_RT: ReportType[] = [
  { key: 'course_report',         name_en: 'Course Report',         name_ar: 'تقرير المقرر'     },
  { key: 'program_report',        name_en: 'Program Report',        name_ar: 'تقرير البرنامج'   },
  { key: 'course_specification',  name_en: 'Course Specification',  name_ar: 'توصيف المقرر'     },
  { key: 'program_specification', name_en: 'Program Specification', name_ar: 'توصيف البرنامج'   },
  { key: 'self_study',            name_en: 'Self-Study Report',     name_ar: 'التقرير الذاتي'   },
  { key: 'survey_analysis',       name_en: 'Survey Analysis',       name_ar: 'تحليل الاستبيان'  },
  { key: 'exam_results_analysis', name_en: 'Exam Results Analysis', name_ar: 'تحليل نتائج الاختبار' },
  { key: 'qa_unit_annual',        name_en: 'QA Annual Report',      name_ar: 'تقرير جودة سنوي'  },
  { key: 'other',                 name_en: 'Other',                 name_ar: 'أخرى'             },
];

type Task = {
  id: string; title: string; description?: string;
  assignee: string; assignee_ids?: string[];
  due: string; done: boolean; status?: TaskStatus; priority?: TaskPriority;
  report_type?: string; visibility?: 'team' | 'private';
  completed_by?: string[]; completed_by_names?: string[];
  created_by?: string; created_at?: string;
};
type Member = { user_id?: string; name: string; role: string; avatar: string; online: boolean; email?: string; responsibility?: string };
type Resource = { id?: string; _id?: string; file_name: string; uploader_name?: string; created_at?: string; download_url?: string; uploaded_by: string; uploader_role: string };
type Comment  = { id?: string; _id?: string; user_id?: string; user_name: string; message: string; created_at?: string; task_id?: string; reply_to_id?: string; reply_to_preview?: string; reply_to_author?: string; attachments?: { id?: string; _id?: string; file_name: string; download_url?: string }[] };
type Overview = { title: string; description: string; status_badge: string; progress: number };

/* ── helpers ─────────────────────────────────────────────────────────────── */
function ini(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join(''); }
function avbg(name: string) {
  const h = ((name.charCodeAt(0) ?? 0) * 47 + (name.charCodeAt(1) ?? 0) * 13) % 360;
  return `linear-gradient(135deg,hsl(${h},55%,44%),hsl(${h + 40},48%,32%))`;
}
function fmtDue(due: string) {
  if (!due || due === 'TBD') return { text: 'No due date', color: '#64748b', overdue: false };
  const d = new Date(due);
  if (isNaN(d.getTime())) return { text: due, color: '#64748b', overdue: false };
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (days < 0)  return { text: `${text} ·overdue`, color: RED,  overdue: true  };
  if (days <= 3) return { text,                      color: AMB,  overdue: true  };
  return               { text,                       color: GRN,  overdue: false };
}
function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function hdr() { return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`, 'X-User-Id': localStorage.getItem('userId') ?? '' }; }
function taskStatus(t: Task): TaskStatus { if (t.status) return t.status; return t.done ? 'done' : 'todo'; }
/* only admins / sub-admins / managers may create & manage tasks — staff cannot */
function isManagerRole(): boolean {
  const role = (localStorage.getItem('role') ?? '').toLowerCase();
  return ['admin', 'sub_admin', 'manager'].includes(role);
}

/* ── Avatar atom ─────────────────────────────────────────────────────────── */
function Av({ name, size = 28, outline }: { name: string; size?: number; outline?: string }) {
  return (
    <div title={name} style={{ width: size, height: size, borderRadius: '50%', background: avbg(name), flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .37),
      fontWeight: 700, color: '#fff', userSelect: 'none', boxShadow: outline ? `0 0 0 2px ${outline}` : undefined }}>
      {ini(name)}
    </div>
  );
}

/* ── AI storage types ────────────────────────────────────────────────────── */
type AIEntry = {
  score:             number;
  passed:            boolean;
  evaluatedAt:       string;
  failed_standards?: { rule: string; reason: string }[];
  suggestions?:      string[];
};

function aiReadStore(projectId: string): Record<string, AIEntry[]> {
  try { return JSON.parse(localStorage.getItem(`orbit_ai_${projectId}`) ?? '{}'); } catch { return {}; }
}
function aiGet(projectId: string, taskId: string): AIEntry | null {
  return aiReadStore(projectId)[taskId]?.[0] ?? null;
}
function aiGetHistory(projectId: string, taskId: string): AIEntry[] {
  return aiReadStore(projectId)[taskId] ?? [];
}
function aiSave(projectId: string, taskId: string, result: { compliance_score: number; failed_standards?: { rule: string; reason: string }[]; suggestions?: string[] }): AIEntry[] {
  const entry: AIEntry = {
    score:            result.compliance_score,
    passed:           result.compliance_score >= 70,
    evaluatedAt:      new Date().toISOString(),
    failed_standards: result.failed_standards ?? [],
    suggestions:      result.suggestions ?? [],
  };
  const store  = aiReadStore(projectId);
  const next   = [entry, ...(store[taskId] ?? [])].slice(0, 5);
  store[taskId] = next;
  try { localStorage.setItem(`orbit_ai_${projectId}`, JSON.stringify(store)); } catch { /* quota */ }
  return next;
}

/* ── activity-feed derivation ────────────────────────────────────────────── */
type ActivityItem = { id: string; type: 'comment'|'done'|'upload'; actorName: string; action: string; detail: string; time?: string; color: string };

function deriveActivity(tasks: Task[], comments: Comment[], resources: Resource[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  [...comments].slice(-10).forEach(c =>
    items.push({ id: `c-${c.id ?? c._id}`, type: 'comment', actorName: c.user_name, action: 'posted', detail: c.message.slice(0, 52) + (c.message.length > 52 ? '…' : ''), time: c.created_at, color: BLUE }));
  tasks.filter(t => t.done).forEach(t => {
    const actor = t.completed_by_names?.[0] ?? t.assignee ?? 'Team';
    items.push({ id: `done-${t.id}`, type: 'done', actorName: actor, action: 'completed', detail: `"${t.title.slice(0, 38)}${t.title.length > 38 ? '…' : ''}"`, time: t.created_at, color: GRN });
  });
  resources.forEach(r =>
    items.push({ id: `r-${r.id ?? r._id}`, type: 'upload', actorName: r.uploader_name ?? 'Team', action: 'uploaded', detail: r.file_name, time: r.created_at, color: PURP }));
  return items.sort((a, b) => ((b.time ?? '') > (a.time ?? '') ? 1 : -1)).slice(0, 12);
}

/* ── AI-summary from localStorage ────────────────────────────────────────── */
type AISummary = { taskId: string; taskTitle: string; score: number; passed: boolean; evaluatedAt: string };

function getAiSummaries(projectId: string, tasks: Task[]): AISummary[] {
  try {
    const store = aiReadStore(projectId);
    return Object.entries(store)
      .map(([taskId, entries]) => {
        const task   = tasks.find(t => t.id === taskId);
        const latest = entries[0];
        if (!task || !latest) return null;
        return { taskId, taskTitle: task.title, score: latest.score, passed: latest.passed, evaluatedAt: latest.evaluatedAt };
      })
      .filter((x): x is AISummary => x !== null)
      .sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
  } catch { return []; }
}

/* ══════════════════════════════════════════════════════════════════════════
   TaskCard — rich task card with priority stripe and metadata
══════════════════════════════════════════════════════════════════════════ */
interface TaskCardProps {
  task:          Task;
  members:       Member[];
  projectId:     string;
  selectedId:    string | null;
  isDark:        boolean;
  onSelect:      (id: string) => void;
}

function TaskCard({ task, members, projectId, selectedId, isDark, onSelect }: TaskCardProps) {
  const t      = T(isDark);
  const [hov, setHov] = useState(false);
  const sel    = selectedId === task.id;
  const prio   = PRIO[task.priority ?? 'medium'];
  const due    = fmtDue(task.due);
  const ai     = aiGet(projectId, task.id);

  /* resolve full member objects from assignee_ids */
  const assignees = (task.assignee_ids ?? [])
    .map(id => members.find(m => m.user_id === id))
    .filter(Boolean) as Member[];

  /* per-user completion */
  const currentUid  = localStorage.getItem('userId') ?? '';
  const completedIds = task.completed_by ?? [];
  const iCurrentDone = completedIds.includes(currentUid) || (assignees.length === 0 && task.done);
  const showCompl    = assignees.length > 0;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onSelect(task.id)}
      style={{
        background:   sel ? (isDark ? '#1a2540' : '#eff6ff') : t.surf,
        border:       `1px solid ${sel ? `${BLUE}44` : hov ? t.bord : t.bord2}`,
        borderLeft:   `3px solid ${prio.color}`,
        borderRadius: 8,
        padding:      '11px 12px',
        cursor:       'pointer',
        transition:   'all .15s',
        boxShadow:    hov && !sel ? '0 3px 14px rgba(0,0,0,.09)' : 'none',
        transform:    hov && !sel ? 'translateY(-1px)' : 'none',
      }}
    >
      {/* Row 1 — badges */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 7, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${prio.color}18`, color: prio.color, letterSpacing: '.04em', textTransform: 'uppercase' as const, border: `1px solid ${prio.color}24` }}>
          {prio.label}
        </span>
        {task.report_type && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${PURP}14`, color: PURP, fontWeight: 500, border: `1px solid ${PURP}22`, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {task.report_type.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Row 2 — title */}
      <div style={{
        fontSize: 13, fontWeight: 600, color: iCurrentDone ? t.muted : t.text,
        lineHeight: 1.45, marginBottom: showCompl ? 8 : 9,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden', textDecoration: iCurrentDone ? 'line-through' : 'none',
      }}>
        {task.title}
      </div>

      {/* Row 3 — multi-assignee completion (only when >1 assignee) */}
      {showCompl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {assignees.slice(0, 4).map((m, i) => {
              const done = completedIds.includes(m.user_id ?? '');
              return (
                <div key={m.user_id ?? m.name} style={{ marginLeft: i > 0 ? -7 : 0, position: 'relative', zIndex: 4 - i, border: `2px solid ${sel ? (isDark ? '#1a2540' : '#eff6ff') : t.surf}`, borderRadius: '50%' }}>
                  <Av name={m.name} size={20} />
                  {done && (
                    <span style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: GRN, border: `1.5px solid ${sel ? (isDark ? '#1a2540' : '#eff6ff') : t.surf}`, fontSize: 5, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: 10, color: t.muted, fontWeight: 500 }}>
            {completedIds.length}/{assignees.length} done
          </span>
        </div>
      )}

      {/* Row 4 — metadata strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
        {/* due date */}
        {task.due && task.due !== 'TBD' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: due.color, fontWeight: 500 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {due.text}
          </span>
        )}

        {/* assignees (when single or no completion row) */}
        {!showCompl && assignees.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {assignees.slice(0, 3).map((m, i) => (
              <div key={m.user_id ?? m.name} style={{ marginLeft: i > 0 ? -6 : 0, border: `1.5px solid ${sel ? (isDark ? '#1a2540' : '#eff6ff') : t.surf}`, borderRadius: '50%', zIndex: 3 - i }}>
                <Av name={m.name} size={18} />
              </div>
            ))}
            {assignees.length > 3 && <span style={{ fontSize: 10, color: t.muted, marginLeft: 3 }}>+{assignees.length - 3}</span>}
          </div>
        )}
        {/* fallback assignee text (no ids) */}
        {!showCompl && assignees.length === 0 && task.assignee && task.assignee !== 'Unassigned' && (
          <Av name={task.assignee} size={18} />
        )}

        {/* AI review badge */}
        {ai ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: ai.passed ? GRN : RED, marginLeft: 'auto', padding: '1px 5px', borderRadius: 4, background: ai.passed ? `${GRN}14` : `${RED}12`, border: `1px solid ${ai.passed ? GRN : RED}22` }}>
            {ai.passed ? '✓' : '✗'} {ai.score}%
          </span>
        ) : (taskStatus(task) === 'review') ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: AMB, marginLeft: 'auto', padding: '1px 5px', borderRadius: 4, background: `${AMB}12`, border: `1px solid ${AMB}22` }}>
            AI Needed
          </span>
        ) : null}

        {/* private lock */}
        {task.visibility === 'private' && (
          <span style={{ fontSize: 10, color: t.muted, marginLeft: ai ? 0 : 'auto' }}>🔒</span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   KanbanColumn — single column, no inline form (modal used instead)
══════════════════════════════════════════════════════════════════════════ */
interface KanbanColProps {
  col:          typeof KANBAN_COLS[number];
  tasks:        Task[];
  members:      Member[];
  projectId:    string;
  selectedId:   string | null;
  isDark:       boolean;
  onSelect:     (id: string) => void;
  onOpenCreate: () => void;
}

function KanbanColumn({ col, tasks, members, projectId, selectedId, isDark, onSelect, onOpenCreate }: KanbanColProps) {
  const t = T(isDark);
  const canCreate = isManagerRole();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 220, borderRight: `1px solid ${t.bord2}`, overflow: 'hidden' }}>

      {/* column header */}
      <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, boxShadow: `0 0 6px ${col.color}55` }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: t.sub, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>{col.label}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: `${col.color}14`, color: col.color }}>{tasks.length}</span>
        </div>
        {canCreate && (
          <button type="button" onClick={onOpenCreate}
            style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all .15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${col.color}14`; e.currentTarget.style.color = col.color; e.currentTarget.style.borderColor = `${col.color}44`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.muted; e.currentTarget.style.borderColor = t.bord; }}>
            +
          </button>
        )}
      </div>

      {/* card list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 4px', display: 'flex', flexDirection: 'column', gap: 6, scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} members={members} projectId={projectId} selectedId={selectedId} isDark={isDark} onSelect={onSelect} />
        ))}
        {tasks.length === 0 && (
          canCreate ? (
            <div onClick={onOpenCreate} style={{ padding: '20px 8px', textAlign: 'center' as const, color: t.muted, fontSize: 11, border: `1.5px dashed ${t.bord2}`, borderRadius: 8, margin: '4px 0', cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${col.color}55`; e.currentTarget.style.color = col.color; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord2; e.currentTarget.style.color = t.muted; }}>
              + Add task
            </div>
          ) : (
            <div style={{ padding: '20px 8px', textAlign: 'center' as const, color: t.muted, fontSize: 11 }}>
              No tasks
            </div>
          )
        )}
      </div>

      {/* + Add task footer — managers only */}
      {canCreate && (
        <div style={{ padding: '6px 8px 8px', flexShrink: 0 }}>
          <button type="button" onClick={onOpenCreate}
            style={{ width: '100%', padding: '6px 0', borderRadius: 7, border: `1px dashed ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: 'inherit', transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${col.color}55`; e.currentTarget.style.color = col.color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.color = t.muted; }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add task
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   KanbanBoard — 4 columns, no duplicate header strip
══════════════════════════════════════════════════════════════════════════ */
interface KanbanBoardProps {
  tasks:        Task[];
  members:      Member[];
  projectId:    string;
  selectedId:   string | null;
  isDark:       boolean;
  onSelect:     (id: string | null) => void;
  onOpenCreate: (col: TaskStatus) => void;
}

function KanbanBoard({ tasks, members, projectId, selectedId, isDark, onSelect, onOpenCreate }: KanbanBoardProps) {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {KANBAN_COLS.map(col => (
        <KanbanColumn
          key={col.id}
          col={col}
          tasks={tasks.filter(tk => taskStatus(tk) === col.id)}
          members={members}
          projectId={projectId}
          selectedId={selectedId}
          isDark={isDark}
          onSelect={id => onSelect(selectedId === id ? null : id)}
          onOpenCreate={() => onOpenCreate(col.id)}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CreateTaskModal — full-form task creation overlay
══════════════════════════════════════════════════════════════════════════ */
interface CreateModalProps {
  members:       Member[];
  reportTypes:   ReportType[];
  defaultStatus: TaskStatus;
  isDark:        boolean;
  onClose:       () => void;
  onSubmit:      (p: CreateTaskParams) => Promise<void>;
}

function CreateTaskModal({ members, reportTypes, defaultStatus, isDark, onClose, onSubmit }: CreateModalProps) {
  const t = T(isDark);
  const [title,      setTitle]      = useState('');
  const [status,     setStatus]     = useState<TaskStatus>(defaultStatus);
  const [priority,   setPriority]   = useState<TaskPriority>('medium');
  const [assignees,  setAssignees]  = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'team' | 'private'>('team');
  const [due,        setDue]        = useState('');
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');

  /* ref keeps latest status for handleSubmit (avoids stale closure) */
  const statusRef = useRef<TaskStatus>(defaultStatus);
  useEffect(() => { statusRef.current = status; }, [status]);

  const handleSubmit = async () => {
    if (!title.trim()) { setErr('Task title is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSubmit({ title: title.trim(), status: statusRef.current, priority, assigneeIds: assignees, visibility, due: due || undefined, reportType: reportType || undefined, description: description.trim() || undefined });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: t.inbg, border: `1.5px solid ${t.inbd}`, borderRadius: 7, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 460, background: t.surf, borderRadius: 14, border: `1px solid ${t.bord}`, boxShadow: t.shadow, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Modal header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${t.bord}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>New Task</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Add a task to the board</div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>×</button>
        </div>

        {/* Form body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '70vh' }}>

          {/* Title */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 6 }}>Task Title *</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?"
              onKeyDown={e => { if (e.key === 'Enter') void handleSubmit(); if (e.key === 'Escape') onClose(); }}
              autoFocus
              style={{ ...inp }}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
              onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
          </div>

          {/* Status */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 7 }}>Status</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {KANBAN_COLS.map(col => (
                <button key={col.id} type="button" onClick={() => setStatus(col.id)}
                  style={{ flex: 1, padding: '6px 4px', borderRadius: 7, fontSize: 11, fontWeight: status === col.id ? 700 : 500, cursor: 'pointer', border: `1px solid ${status === col.id ? col.color : t.bord}`, background: status === col.id ? `${col.color}1c` : 'transparent', color: status === col.id ? col.color : t.muted, transition: 'all .15s', fontFamily: 'inherit' }}>
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 7 }}>Priority</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {(Object.entries(PRIO) as [TaskPriority, { label: string; color: string }][]).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setPriority(k)}
                  style={{ flex: 1, padding: '5px 4px', borderRadius: 7, fontSize: 11, fontWeight: priority === k ? 700 : 500, cursor: 'pointer', border: `1px solid ${priority === k ? v.color : t.bord}`, background: priority === k ? `${v.color}18` : 'transparent', color: priority === k ? v.color : t.muted, transition: 'all .15s', fontFamily: 'inherit' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 7 }}>Assign To</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
              {members.filter(m => m.user_id).map(m => {
                const sel = assignees.includes(m.user_id!);
                return (
                  <div key={m.user_id} onClick={() => setAssignees(prev => sel ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id!])}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${sel ? BLUE : t.bord}`, background: sel ? `${BLUE}12` : t.inbg, transition: 'all .15s' }}>
                    <Av name={m.name} size={20} outline={sel ? BLUE : undefined} />
                    <span style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? BLUE : t.sub }}>{m.name}</span>
                    {sel && <span style={{ fontSize: 10, color: BLUE }}>✓</span>}
                  </div>
                );
              })}
              {members.filter(m => m.user_id).length === 0 && (
                <span style={{ fontSize: 12, color: t.muted, fontStyle: 'italic' }}>No team members yet</span>
              )}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 7 }}>Visibility</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['team', '👥 All team members'], ['private', '🔒 Assigned only']] as const).map(([v, lbl]) => (
                <button key={v} type="button" onClick={() => setVisibility(v)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: visibility === v ? 700 : 500, cursor: 'pointer', border: `1px solid ${visibility === v ? BLUE : t.bord}`, background: visibility === v ? `${BLUE}12` : 'transparent', color: visibility === v ? BLUE : t.muted, transition: 'all .15s', fontFamily: 'inherit' }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Due date + Report type (compact row) */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 6 }}>Due Date</div>
              <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ ...inp, fontSize: 12 }}
                onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 6 }}>Report Type</div>
              <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ ...inp, fontSize: 12, cursor: 'pointer', background: isDark ? '#0f1220' : '#fff' }}
                onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
                onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
                <option value="">None</option>
                {reportTypes.map(r => <option key={r.key} value={r.key}>{r.name_en}</option>)}
              </select>
            </div>
          </div>

          {/* Error */}
          {err && <div style={{ fontSize: 12, color: RED, padding: '6px 10px', background: `${RED}0a`, border: `1px solid ${RED}22`, borderRadius: 7 }}>{err}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${t.bord}`, display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button type="button" onClick={() => void handleSubmit()} disabled={saving || !title.trim()}
            style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: saving || !title.trim() ? `${BLUE}55` : BLUE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !title.trim() ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: title.trim() ? '0 2px 10px rgba(29,110,245,.28)' : 'none', transition: 'all .15s' }}>
            {saving ? 'Creating…' : '+ Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TeamChatPane — compact bottom pane: member list + project discussion
══════════════════════════════════════════════════════════════════════════ */
function TeamChatPane({ members, comments, isDark, onPost }: {
  members:  Member[];
  comments: Comment[];
  isDark:   boolean;
  onPost:   (p: CommentPayload) => Promise<void>;
}) {
  const t        = T(isDark);
  const threadRef = useRef<HTMLDivElement>(null);
  const [text, setText]     = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [comments.length]);

  const send = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try { await onPost({ message: text.trim() }); setText(''); }
    finally { setPosting(false); }
  };

  return (
    <div style={{ height: 240, flexShrink: 0, borderTop: `1px solid ${t.bord}`, display: 'flex', background: t.surf2 }}>

      {/* Members list */}
      <div style={{ width: 168, flexShrink: 0, borderRight: `1px solid ${t.bord}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${t.bord2}` }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>
            Team · {members.length}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 1, scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>
          {members.map(m => (
            <div key={m.user_id ?? m.name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 5px', borderRadius: 6, transition: 'background .12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Av name={m.name} size={24} />
                <span style={{ position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: m.online ? GRN : '#475569', border: `1.5px solid ${t.surf2}` }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{m.name}</div>
                <div style={{ fontSize: 9, color: t.muted, textTransform: 'capitalize' as const }}>{m.role.replace(/_/g, ' ')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Discussion column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${t.bord2}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Team Discussion</span>
          {comments.length > 0 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${BLUE}14`, color: BLUE, fontWeight: 700 }}>{comments.length}</span>}
        </div>

        {/* Thread */}
        <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6, scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>
          {comments.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 11, fontStyle: 'italic' as const }}>
              No messages yet
            </div>
          )}
          {comments.slice(-20).map(c => (
            <div key={c.id ?? c._id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <Av name={c.user_name} size={20} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 5, marginBottom: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.sub }}>{c.user_name}</span>
                  <span style={{ fontSize: 9, color: t.muted }}>{fmtTime(c.created_at)}</span>
                </div>
                <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.45, wordBreak: 'break-word' as const }}>{renderMentions(c.message)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Compose */}
        <div style={{ padding: '5px 8px 7px', borderTop: `1px solid ${t.bord2}`, flexShrink: 0, display: 'flex', gap: 5 }}>
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Write a message… (Enter to send)"
            disabled={posting}
            style={{ flex: 1, padding: '6px 9px', background: t.inbg, border: `1.5px solid ${t.inbd}`, borderRadius: 7, color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', opacity: posting ? .6 : 1 }}
            onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
            onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
          <button type="button" onClick={() => void send()} disabled={!text.trim() || posting}
            style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: text.trim() && !posting ? BLUE : `${BLUE}44`, color: '#fff', cursor: text.trim() && !posting ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ProjectHeader — compact 52px bar with all project context
══════════════════════════════════════════════════════════════════════════ */
interface HeaderProps {
  overview: Overview | null;
  members:  Member[];
  tasks:    Task[];
  isDark:   boolean;
  onBack:         () => void;
  onAddTask:      () => void;
  onMembersClick: () => void;
}

function ProjectHeader({ overview, members, tasks, isDark, onBack, onAddTask, onMembersClick }: HeaderProps) {
  const t      = T(isDark);
  const done   = tasks.filter(tk => tk.done).length;
  const pct    = tasks.length ? Math.round((done / tasks.length) * 100) : (overview?.progress ?? 0);
  const due    = overview ? fmtDue('') : null; // placeholder; real due date not in overview currently
  void due;

  const statusCfg: Record<string, { color: string }> = {
    ACTIVE:    { color: GRN  },
    ON_HOLD:   { color: AMB  },
    COMPLETED: { color: BLUE },
    'IN PROGRESS': { color: BLUE },
  };
  const badgeColor = statusCfg[(overview?.status_badge ?? '').toUpperCase()]?.color ?? '#64748b';

  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
      background: t.surf, borderBottom: `1px solid ${t.bord}`, flexShrink: 0,
    }}>
      {/* ← back to workspace */}
      <button type="button" onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all .15s' }}
        onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.bord; }}
        onMouseLeave={e => { e.currentTarget.style.color = t.muted; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Workspace
      </button>

      <div style={{ width: 1, height: 20, background: t.bord, flexShrink: 0 }} />

      {/* project title + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '0 1 auto' }}>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
          {overview?.title ?? '…'}
        </h1>
        {overview && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${badgeColor}16`, color: badgeColor, border: `1px solid ${badgeColor}28`, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {overview.status_badge}
          </span>
        )}
      </div>

      {/* progress */}
      {tasks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 80, height: 4, borderRadius: 4, background: t.bord, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? GRN : BLUE, borderRadius: 4, transition: 'width .4s' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: pct === 100 ? GRN : t.muted, whiteSpace: 'nowrap' }}>{pct}%</span>
        </div>
      )}

      {/* task count quick stat */}
      {tasks.length > 0 && (
        <span style={{ fontSize: 11, color: t.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {done}/{tasks.length} done
        </span>
      )}

      {/* spacer */}
      <div style={{ flex: 1 }} />

      {/* team avatars */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {members.slice(0, 5).map((m, i) => (
          <div key={m.user_id ?? m.name} title={m.name} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i, border: `2px solid ${t.surf}`, borderRadius: '50%' }}>
            <Av name={m.name} size={28} />
          </div>
        ))}
        {members.length > 5 && (
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.surf3, border: `2px solid ${t.surf}`, fontSize: 10, color: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, marginLeft: -8 }}>
            +{members.length - 5}
          </div>
        )}
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button type="button" onClick={onMembersClick}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: `1px solid ${t.bord}`, background: t.hover, color: t.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          Members
        </button>
        {isManagerRole() && (
          <button type="button" onClick={onAddTask}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 7, border: 'none', background: BLUE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(29,110,245,.28)', transition: 'opacity .15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Task
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   WorkspaceBody — 3-panel shell
   [Kanban Area (flex:1)] [Task Panel (380px, animated)] [Sidebar (264px)]
══════════════════════════════════════════════════════════════════════════ */
interface BodyProps {
  tasks:                Task[];
  members:              Member[];
  resources:            Resource[];
  comments:             Comment[];
  reportTypes:          ReportType[];
  projectId:            string;
  isDark:               boolean;
  selectedTaskId:       string | null;
  onSelectTask:         (id: string | null) => void;
  onOpenCreate:         (col: TaskStatus) => void;
  onPatchTask:          (taskId: string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteTask:         (taskId: string) => void;
  onAddComment:         (payload: CommentPayload) => Promise<void>;
  onDeleteComment:      (commentId: string) => Promise<void>;
  onUploadResource:     (file: File) => Promise<void>;
  onDeleteResource:     (resourceId: string) => Promise<void>;
  onOpenAIReview:       (task: Task) => void;
  onAddMember:          (userId: string) => Promise<void>;
  onRemoveMember:       (memberId: string) => Promise<void>;
  onChangeMemberRole:   (memberId: string, role: string) => Promise<void>;
  onOpenTaskThread:     (taskId: string) => void;
  detailInitialTab:     DetailTab;
}

function WorkspaceBody({ tasks, members, resources, comments, reportTypes, projectId, isDark, selectedTaskId, onSelectTask, onOpenCreate, onPatchTask, onDeleteTask, onAddComment, onDeleteComment, onUploadResource, onDeleteResource, onOpenAIReview, onAddMember, onRemoveMember, onChangeMemberRole, onOpenTaskThread, detailInitialTab }: BodyProps) {
  const t = T(isDark);
  const selectedTask = tasks.find(tk => tk.id === selectedTaskId) ?? null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── kanban area + team chat ────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <KanbanBoard
          tasks={tasks}
          members={members}
          projectId={projectId}
          selectedId={selectedTaskId}
          isDark={isDark}
          onSelect={onSelectTask}
          onOpenCreate={onOpenCreate}
        />
      </div>

      {/* ── task detail panel (slides in/out, no overlay) ─────────────── */}
      <div style={{ width: selectedTaskId ? 380 : 0, overflow: 'hidden', flexShrink: 0, transition: 'width .22s cubic-bezier(.4,0,.2,1)', borderLeft: selectedTaskId ? `1px solid ${t.bord}` : 'none' }}>
        <div style={{ width: 380, height: '100%' }}>
          {selectedTask && (
            <TaskDetailPanel
              task={selectedTask}
              members={members}
              reportTypes={reportTypes}
              resources={resources}
              comments={comments}
              projectId={projectId}
              isDark={isDark}
              onClose={() => onSelectTask(null)}
              onPatch={onPatchTask}
              onDelete={onDeleteTask}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              onUploadResource={onUploadResource}
              onDeleteResource={onDeleteResource}
              onOpenAIReview={() => selectedTask && onOpenAIReview(selectedTask)}
              initialTab={detailInitialTab}
            />
          )}
        </div>
      </div>

      {/* ── collaboration sidebar ─────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, borderLeft: `1px solid ${t.bord}`, background: t.surf2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CollaborationSidebar
          tasks={tasks} members={members} resources={resources} comments={comments}
          projectId={projectId} isDark={isDark}
          onAddComment={onAddComment} onDeleteComment={onDeleteComment}
          onAddMember={onAddMember} onRemoveMember={onRemoveMember} onChangeMemberRole={onChangeMemberRole}
          onDeleteResource={onDeleteResource}
          onOpenTaskThread={onOpenTaskThread}
        />
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   TaskDetailPanel — inline side panel (not a modal)
   Board stays visible; panel slides in from the right edge of the kanban.
══════════════════════════════════════════════════════════════════════════ */
interface PanelProps {
  task:             Task;
  members:          Member[];
  reportTypes:      ReportType[];
  resources:        Resource[];
  comments:         Comment[];
  projectId:        string;
  isDark:           boolean;
  onClose:          () => void;
  onPatch:          (taskId: string, updates: Record<string, unknown>) => Promise<void>;
  onDelete:         (taskId: string) => void;
  onAddComment:     (payload: CommentPayload) => Promise<void>;
  onDeleteComment:  (commentId: string) => Promise<void>;
  onUploadResource: (file: File) => Promise<void>;
  onDeleteResource: (resourceId: string) => Promise<void>;
  onOpenAIReview:   () => void;
  initialTab?:      DetailTab;
}

/* ── mention-text renderer ───────────────────────────────────────────── */
function renderMentions(text: string): React.ReactNode[] {
  return text.split(/(@\S+)/g).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} style={{ color: BLUE, fontWeight: 600, background: `${BLUE}14`, padding: '0 3px', borderRadius: 3 }}>{part}</span>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

/* ── ComposeBox ───────────────────────────────────────────────────────── */
interface ComposeProps {
  members:       Member[];
  replyTo:       Comment | null;
  onClearReply:  () => void;
  onSubmit:      (p: CommentPayload) => Promise<void>;
  isDark:        boolean;
}
function ComposeBox({ members, replyTo, onClearReply, onSubmit, isDark }: ComposeProps) {
  const t            = T(isDark);
  const [text, setText]           = useState('');
  const [files, setFiles]         = useState<File[]>([]);
  const [posting, setPosting]     = useState(false);
  const [mentionQ, setMentionQ]   = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const taRef   = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* auto-resize */
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  /* mention candidates */
  const candidates = useMemo(() => {
    if (mentionQ === null) return [];
    const q = mentionQ.toLowerCase();
    const specials = [
      { user_id: '__all__',  name: 'all',  role: 'Notify everyone'  },
      { user_id: '__team__', name: 'team', role: 'Notify team'       },
    ].filter(s => !q || s.name.startsWith(q));
    const people = members.filter(m => m.user_id && (
      m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    )).slice(0, 5);
    return [...specials, ...people].slice(0, 6) as { user_id: string; name: string; role: string }[];
  }, [mentionQ, members]);

  const selectMention = (c: { user_id: string; name: string }) => {
    const el = taRef.current;
    if (!el) return;
    const cur = el.selectionStart ?? text.length;
    const before = text.slice(0, cur).replace(/@(\w*)$/, `@${c.name} `);
    const after  = text.slice(cur);
    const next   = before + after;
    setText(next);
    setMentionQ(null);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = before.length; });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const cur = e.target.selectionStart;
    const m   = val.slice(0, cur).match(/@(\w*)$/);
    if (m) { setMentionQ(m[1]); setMentionIdx(0); }
    else     setMentionQ(null);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQ !== null && candidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, candidates.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); selectMention(candidates[mentionIdx]); return; }
      if (e.key === 'Escape')    { setMentionQ(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
  };

  const submit = async () => {
    if ((!text.trim() && files.length === 0) || posting) return;
    setPosting(true);
    const mentionedIds = members.filter(m => m.user_id && text.includes(`@${m.name}`)).map(m => m.user_id!);
    try {
      await onSubmit({
        message:        text.trim(),
        attachments:    files.length > 0 ? files : undefined,
        replyToId:      replyTo?.id ?? replyTo?._id,
        replyToPreview: replyTo?.message.slice(0, 100),
        replyToAuthor:  replyTo?.user_name,
        mentionedIds,
      });
      setText(''); setFiles([]);
    } finally { setPosting(false); }
  };

  const canSend = (text.trim().length > 0 || files.length > 0) && !posting;

  return (
    <div style={{ padding: '8px 12px 10px', borderTop: `1px solid ${t.bord}`, background: t.surf, position: 'relative', flexShrink: 0 }}>

      {/* @mention dropdown */}
      {mentionQ !== null && candidates.length > 0 && (
        <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 8, boxShadow: isDark ? '0 8px 24px rgba(0,0,0,.55)' : '0 8px 24px rgba(0,0,0,.13)', overflow: 'hidden', marginBottom: 4, zIndex: 50 }}>
          {candidates.map((c, i) => (
            <div key={c.user_id}
              onMouseDown={e => { e.preventDefault(); selectMention(c); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', background: i === mentionIdx ? (isDark ? 'rgba(29,110,245,.18)' : 'rgba(29,110,245,.09)') : 'transparent' }}>
              <Av name={c.name} size={22} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>@{c.name}</div>
                <div style={{ fontSize: 10, color: t.muted }}>{c.role}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply banner */}
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', marginBottom: 6, background: `${BLUE}0b`, border: `1px solid ${BLUE}24`, borderRadius: 6 }}>
          <span style={{ width: 2, minHeight: 14, background: BLUE, borderRadius: 2, flexShrink: 0, alignSelf: 'stretch' }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: BLUE }}>{replyTo.user_name} </span>
            <span style={{ color: t.muted }}>{replyTo.message.slice(0, 60)}{replyTo.message.length > 60 ? '…' : ''}</span>
          </div>
          <button type="button" onClick={onClearReply} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Pending file chips */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 6 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: t.surf3, border: `1px solid ${t.bord}`, borderRadius: 5, fontSize: 10, color: t.sub }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
              <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{f.name}</span>
              <button type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end' }}>
        <textarea ref={taRef} value={text} onChange={handleChange} onKeyDown={handleKey}
          placeholder="Write a message… (@ to mention)" disabled={posting} rows={1}
          style={{ flex: 1, padding: '7px 10px', background: t.inbg, border: `1.5px solid ${t.inbd}`, borderRadius: 8, color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' as const, overflow: 'hidden', transition: 'border-color .15s', opacity: posting ? .6 : 1, display: 'block' }}
          onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
          onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />

        <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => { setFiles(p => [...p, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />

        <button type="button" title="Attach" onClick={() => fileRef.current?.click()}
          style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: files.length > 0 ? BLUE : t.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color .15s' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>

        <button type="button" title="Send (Enter)" onClick={() => void submit()} disabled={!canSend}
          style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: canSend ? BLUE : `${BLUE}44`, color: '#fff', cursor: canSend ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
          {posting
            ? <span style={{ fontSize: 11, fontWeight: 700 }}>…</span>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

/* ── DiscussionPanel ──────────────────────────────────────────────────── */
interface DiscussionProps {
  comments:        Comment[];
  members:         Member[];
  currentUserId:   string;
  isMgr:           boolean;
  isDark:          boolean;
  onPost:          (p: CommentPayload) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
}
function DiscussionPanel({ comments, members, currentUserId, isMgr, isDark, onPost, onDeleteComment }: DiscussionProps) {
  const t        = T(isDark);
  const threadRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  /* scroll to bottom when new message arrives */
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [comments.length]);

  /* group consecutive messages from same author (≤5 min apart) */
  type MsgGroup = { authorName: string; authorId?: string; items: Comment[] };
  const groups = useMemo<MsgGroup[]>(() => {
    const result: MsgGroup[] = [];
    for (const c of comments) {
      const last = result[result.length - 1];
      const gap  = last
        ? new Date(c.created_at ?? '').getTime() - new Date(last.items[last.items.length - 1].created_at ?? '').getTime()
        : Infinity;
      if (last && last.authorName === c.user_name && gap < 5 * 60_000) {
        last.items.push(c);
      } else {
        result.push({ authorName: c.user_name, authorId: c.user_id, items: [c] });
      }
    }
    return result;
  }, [comments]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Thread */}
      <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 14, scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>
        {comments.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12, fontStyle: 'italic', textAlign: 'center' as const, padding: '32px 0' }}>
            No messages yet.<br />Be the first to comment.
          </div>
        )}

        {groups.map((grp, gi) => (
          <div key={`grp-${gi}`} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <Av name={grp.authorName} size={28} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{grp.authorName}</span>
                <span style={{ fontSize: 10, color: t.muted }}>{fmtTime(grp.items[0].created_at)}</span>
              </div>
              {/* Individual messages */}
              {grp.items.map(c => (
                <MessageRow
                  key={c.id ?? c._id}
                  comment={c}
                  isOwn={(c.user_id ?? '') === currentUserId}
                  canDelete={(c.user_id ?? '') === currentUserId || isMgr}
                  isDark={isDark}
                  onReply={() => setReplyTo(c)}
                  onDelete={() => void onDeleteComment(c.id ?? c._id ?? '')}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Compose */}
      <ComposeBox
        members={members}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSubmit={async p => { await onPost(p); setReplyTo(null); }}
        isDark={isDark}
      />
    </div>
  );
}

/* ── MessageRow ───────────────────────────────────────────────────────── */
function MessageRow({ comment: c, isOwn: _isOwn, canDelete, isDark, onReply, onDelete }: {
  comment: Comment; isOwn: boolean; canDelete: boolean; isDark: boolean; onReply: () => void; onDelete: () => void;
}) {
  void _isOwn;
  const t = T(isDark);
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ position: 'relative', marginBottom: 2, paddingRight: hov ? 80 : 0, transition: 'padding-right .1s' }}>

      {/* Reply-to quote */}
      {c.reply_to_id && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 4, padding: '3px 8px', background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.035)', borderLeft: `2px solid ${BLUE}66`, borderRadius: '0 5px 5px 0', cursor: 'default' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: BLUE, flexShrink: 0 }}>{c.reply_to_author}</span>
          <span style={{ fontSize: 11, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.reply_to_preview}</span>
        </div>
      )}

      {/* Message text */}
      <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.55, wordBreak: 'break-word' as const }}>
        {renderMentions(c.message)}
      </div>

      {/* Attachments */}
      {(c.attachments ?? []).length > 0 && (
        <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {c.attachments!.map(att => (
            <a key={att.id ?? att._id ?? att.file_name} href={att.download_url ?? '#'} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: BLUE, textDecoration: 'none', padding: '4px 8px', background: `${BLUE}0a`, border: `1px solid ${BLUE}1a`, borderRadius: 5, maxWidth: 220 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{att.file_name}</span>
            </a>
          ))}
        </div>
      )}

      {/* Hover action bar */}
      {hov && (
        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 1, background: t.surf, border: `1px solid ${t.bord}`, borderRadius: 6, padding: '2px 3px', boxShadow: isDark ? '0 2px 10px rgba(0,0,0,.45)' : '0 2px 10px rgba(0,0,0,.10)' }}>
          <button type="button" onClick={onReply}
            style={{ padding: '2px 7px', borderRadius: 4, border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', fontWeight: 600 }}
            onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
            onMouseLeave={e => (e.currentTarget.style.color = t.muted)}>
            Reply
          </button>
          {canDelete && (
            <button type="button" onClick={onDelete}
              style={{ padding: '2px 7px', borderRadius: 4, border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', fontWeight: 600 }}
              onMouseEnter={e => (e.currentTarget.style.color = RED)}
              onMouseLeave={e => (e.currentTarget.style.color = t.muted)}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── AIReviewPanel ────────────────────────────────────────────────────── */
/* ── PropRow — defined OUTSIDE TaskDetailPanel so React doesn't remount on every render */
function PropRow({ label, isDark, children }: { label: string; isDark: boolean; children: React.ReactNode }) {
  const t = T(isDark);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: `1px solid ${t.bord2}` }}>
      <div style={{ width: 86, fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' as const, flexShrink: 0, paddingTop: 2 }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function AIReviewPanel({ taskId, projectId, isDark, onSubmitForReview }: {
  taskId: string; projectId: string; isDark: boolean; onSubmitForReview: () => void;
}) {
  const t       = T(isDark);
  const history = aiGetHistory(projectId, taskId);
  const latest  = history[0] ?? null;
  const rc      = latest ? (latest.passed ? GRN : latest.score >= 60 ? AMB : RED) : BLUE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Submit button — always at top */}
      <button type="button" onClick={onSubmitForReview}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(29,110,245,.28)', transition: 'opacity .15s' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Submit For AI Review
      </button>

      {/* No review yet */}
      {!latest && (
        <div style={{ textAlign: 'center' as const, color: t.muted, fontSize: 12, lineHeight: 1.7, padding: '12px 0' }}>
          No AI review yet.<br />
          <span style={{ fontSize: 11 }}>Upload the task report and run an evaluation.</span>
        </div>
      )}

      {latest && (
        <>
          {/* Score ring + label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', border: `3px solid ${rc}`, background: `${rc}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: rc }}>{latest.score}%</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: rc }}>{latest.passed ? 'Quality Passed' : 'Quality Failed'}</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                {latest.passed ? 'Score ≥ 70% threshold' : 'Below 70% — blocked'}
              </div>
              <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>{fmtTime(latest.evaluatedAt)}</div>
            </div>
          </div>

          {/* Score bar with threshold marker */}
          <div>
            <div style={{ height: 6, borderRadius: 6, background: t.bord, overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: '100%', width: `${latest.score}%`, background: rc, borderRadius: 6, transition: 'width .4s' }} />
              <div style={{ position: 'absolute', top: 0, left: '70%', width: 2, height: '100%', background: GRN, opacity: .8 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 9, color: t.muted }}>
              <span>0%</span><span style={{ color: GRN }}>70% pass</span><span>100%</span>
            </div>
          </div>

          {/* Failed standards */}
          {(latest.failed_standards ?? []).length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: RED, letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 7 }}>
                Critical Issues · {latest.failed_standards!.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {latest.failed_standards!.map((s, i) => (
                  <div key={i} style={{ padding: '8px 10px', borderRadius: 7, background: `${RED}08`, border: `1px solid ${RED}22` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 3 }}>{s.rule}</div>
                    <div style={{ fontSize: 11, color: RED, lineHeight: 1.45 }}>{s.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {(latest.suggestions ?? []).length > 0 && !latest.passed && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: AMB, letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 7 }}>
                How to Improve
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 7, background: `${AMB}08`, border: `1px solid ${AMB}20` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {latest.suggestions!.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 11, color: t.sub, lineHeight: 1.45 }}>
                      <span style={{ color: AMB, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>›</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Evaluation history — last 5 */}
          {history.length > 1 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 7 }}>
                History · last {Math.min(history.length, 5)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {history.slice(0, 5).map((entry, i) => {
                  const ec = entry.passed ? GRN : entry.score >= 60 ? AMB : RED;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 6, background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)', border: `1px solid ${t.bord2}` }}>
                      <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: ec, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: ec }}>{entry.score}% — {entry.passed ? 'Passed' : 'Failed'}</div>
                        <div style={{ fontSize: 10, color: t.muted }}>{fmtTime(entry.evaluatedAt)}</div>
                      </div>
                      {i === 0 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${BLUE}14`, color: BLUE, fontWeight: 700 }}>Latest</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TaskDetailPanel — 4-tab panel: Info | Discussion | Files | AI
══════════════════════════════════════════════════════════════════════════ */
function TaskDetailPanel({ task, members, reportTypes, resources, comments, projectId, isDark, onClose, onPatch, onDelete, onAddComment, onDeleteComment, onUploadResource, onDeleteResource, onOpenAIReview, initialTab = 'info' }: PanelProps) {
  const t    = T(isDark);
  const prio = PRIO[task.priority ?? 'medium'];
  const status = taskStatus(task);
  const due  = fmtDue(task.due);

  /* comments scoped to THIS task — never the project-wide chat */
  const taskComments = useMemo(() => comments.filter(c => c.task_id === task.id), [comments, task.id]);

  /* ── detail tabs ────────────────────────────────────────────────────── */
  const [detailTab, setDetailTab] = useState<DetailTab>(initialTab);

  /* reset tab when task changes (honour requested initial tab, e.g. opening a thread) */
  useEffect(() => { setDetailTab(initialTab); }, [task.id, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── edit-mode draft state ──────────────────────────────────────────── */
  const [editMode,   setEditMode]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDesc,  setDraftDesc]  = useState(task.description ?? '');
  const [draftPrio,  setDraftPrio]  = useState<TaskPriority>(task.priority ?? 'medium');
  const [draftDue,   setDraftDue]   = useState(task.due === 'TBD' ? '' : task.due);
  const [draftRT,    setDraftRT]    = useState(task.report_type ?? '');
  const [draftVis,   setDraftVis]   = useState<'team' | 'private'>(task.visibility ?? 'team');
  const [draftIds,   setDraftIds]   = useState<string[]>(task.assignee_ids ?? []);

  /* reset draft whenever a different task is selected */
  useEffect(() => {
    setEditMode(false);
    setDraftTitle(task.title);
    setDraftDesc(task.description ?? '');
    setDraftPrio(task.priority ?? 'medium');
    setDraftDue(task.due === 'TBD' ? '' : task.due);
    setDraftRT(task.report_type ?? '');
    setDraftVis(task.visibility ?? 'team');
    setDraftIds(task.assignee_ids ?? []);
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── resolve members ────────────────────────────────────────────────── */
  const currentUserId   = localStorage.getItem('userId') ?? '';
  const currentUserName = localStorage.getItem('name') ?? localStorage.getItem('userName') ?? '';
  const userRole        = (localStorage.getItem('role') ?? '').toLowerCase();
  const isMgr           = ['admin', 'sub_admin', 'manager'].includes(userRole);

  const assignees   = (task.assignee_ids ?? []).map(id => members.find(m => m.user_id === id)).filter(Boolean) as Member[];
  const isAssigned  = (task.assignee_ids ?? []).includes(currentUserId);
  const hasCompleted = (task.completed_by ?? []).includes(currentUserId);

  /* ── handlers ────────────────────────────────────────────────────────── */
  const handleStatusChip = (newStatus: TaskStatus) =>
    void onPatch(task.id, { status: newStatus, done: newStatus === 'done' });

  const handleCompletionToggle = async () => {
    const prev  = task.completed_by ?? [];
    const names = task.completed_by_names ?? [];
    const newIds   = hasCompleted ? prev.filter(id => id !== currentUserId) : [...prev, currentUserId];
    const newNames = hasCompleted ? names.filter(n => n !== currentUserName) : [...names, currentUserName];
    const allDone  = newIds.length >= Math.max(assignees.length, 1);
    await onPatch(task.id, { completed_by: newIds, completed_by_names: newNames, done: allDone, status: allDone ? 'done' : status });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const assigneeName = draftIds.length > 0
        ? draftIds.map(id => members.find(m => m.user_id === id)?.name).filter(Boolean).join(', ')
        : 'Unassigned';
      await onPatch(task.id, {
        title:        draftTitle.trim() || task.title,
        description:  draftDesc.trim() || undefined,
        priority:     draftPrio,
        due:          draftDue || 'TBD',
        report_type:  draftRT || undefined,
        visibility:   draftVis,
        assignee:     assigneeName,
        assignee_ids: draftIds,
      });
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task permanently?')) return;
    setDeleting(true);
    try { onDelete(task.id); } finally { setDeleting(false); }
  };

  /* ── shared input style ──────────────────────────────────────────────── */
  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '6px 9px', background: t.inbg, border: `1.5px solid ${t.inbd}`,
    borderRadius: 6, color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box' as const, transition: 'border-color .15s', ...extra,
  });
  const sel = (extra?: React.CSSProperties): React.CSSProperties => ({
    ...inp(), cursor: 'pointer', background: isDark ? '#0f1220' : '#fff', ...extra,
  });

  /* PropRow is defined at module level — passing isDark so it can read theme tokens */

  /* ── current user context (used across tabs) ─────────────────────────── */
  const aiReview    = aiGet(projectId, task.id);
  const discBadge   = taskComments.length > 0 ? taskComments.length : undefined;
  const filesBadge  = resources.length > 0 ? resources.length : undefined;
  const aiBadge     = aiReview ? `${aiReview.score}%` : undefined;

  const PANEL_TABS: { id: DetailTab; label: string; badge?: string | number }[] = [
    { id: 'info',       label: 'Info'       },
    { id: 'discussion', label: 'Discussion', badge: discBadge  },
    { id: 'files',      label: 'Files',      badge: filesBadge },
    { id: 'ai',         label: 'AI Review',  badge: aiBadge    },
  ];

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.surf, fontFamily: '"Inter",-apple-system,sans-serif' }}>

      {/* priority top stripe */}
      <div style={{ height: 3, background: prio.color, flexShrink: 0 }} />

      {/* ── panel header ───────────────────────────────────────────────── */}
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 5 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.4, flex: 1, paddingRight: 8 }}>{task.title}</div>
          <button type="button" onClick={onClose}
            style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
            ×
          </button>
        </div>

        {/* Description — editable right below the title */}
        {task.description
          ? <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.55, whiteSpace: 'pre-wrap' as const, marginBottom: 6 }}>{task.description}</div>
          : <div style={{ fontSize: 11, color: t.muted, fontStyle: 'italic', marginBottom: 4, cursor: 'pointer' }} onClick={() => { setDetailTab('info'); setEditMode(true); }}>+ Add description…</div>
        }

        <span style={{ fontSize: 10, color: t.muted }}>
          {task.created_at ? new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Task'}
        </span>
      </div>

      {/* ── status chips ────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          {KANBAN_COLS.map(col => {
            const active = status === col.id;
            return (
              <button key={col.id} type="button" onClick={() => handleStatusChip(col.id)}
                style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer', border: `1px solid ${active ? col.color : t.bord}`, background: active ? `${col.color}1c` : 'transparent', color: active ? col.color : t.muted, transition: 'all .15s', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.color = t.muted; } }}>
                {col.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── tab bar (fixed, not inside scroll) ───────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.bord}`, flexShrink: 0, background: isDark ? 'rgba(255,255,255,.015)' : 'rgba(0,0,0,.015)' }}>
        {PANEL_TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setDetailTab(tab.id)}
            style={{ flex: 1, padding: '7px 4px 6px', border: 'none', background: 'transparent', color: detailTab === tab.id ? t.text : t.muted, borderBottom: `2px solid ${detailTab === tab.id ? BLUE : 'transparent'}`, fontSize: 10, fontWeight: detailTab === tab.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .15s', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: detailTab === tab.id ? `${BLUE}18` : t.bord, color: detailTab === tab.id ? BLUE : t.muted, fontWeight: 700 }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── tab content area (flex: 1, no outer scroll) ───────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── INFO tab: properties + description + completion + delete ─────── */}
        {detailTab === 'info' && (
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>

            {/* edit/save bar */}
            {isMgr && (
              <div style={{ padding: '8px 14px', borderBottom: `1px solid ${t.bord}`, display: 'flex', gap: 6 }}>
                {editMode ? (
                  <>
                    <button type="button" onClick={() => void handleSave()} disabled={saving}
                      style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', background: saving ? `${BLUE}55` : BLUE, color: '#fff', fontSize: 11, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      {saving ? 'Saving…' : '✓ Save'}
                    </button>
                    <button type="button" onClick={() => setEditMode(false)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setEditMode(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.bord}`, background: t.hover, color: t.sub, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = BLUE; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.color = t.sub; }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit task
                  </button>
                )}
              </div>
            )}

            <div style={{ padding: '4px 14px 16px' }}>

        {/* Title — only shows in edit mode */}
        {editMode && (
          <PropRow label="Title" isDark={isDark}>
            <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)}
              style={{ ...inp(), fontSize: 12, fontWeight: 600 }}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
              onBlur={e  => (e.currentTarget.style.borderColor = t.inbd)} />
          </PropRow>
        )}

        {/* Priority */}
        <PropRow label="Priority" isDark={isDark}>
          {editMode ? (
            <select value={draftPrio} onChange={e => setDraftPrio(e.target.value as TaskPriority)} style={sel()}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
              {(Object.entries(PRIO) as [TaskPriority, { label: string; color: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: `${prio.color}18`, color: prio.color, border: `1px solid ${prio.color}24` }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: prio.color }} />{prio.label}
            </span>
          )}
        </PropRow>

        {/* Due date */}
        <PropRow label="Due Date" isDark={isDark}>
          {editMode ? (
            <input type="date" value={draftDue} onChange={e => setDraftDue(e.target.value)} style={inp()}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)} />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: task.due === 'TBD' || !task.due ? t.muted : due.color }}>
              {task.due === 'TBD' || !task.due ? 'No due date' : due.text}
            </span>
          )}
        </PropRow>

        {/* Assignees */}
        <PropRow label="Assignees" isDark={isDark}>
          {editMode ? (
            <MultiAssigneePicker
              members={members.filter(m => m.user_id).map(m => ({ id: m.user_id!, name: m.name, role: m.role, email: m.email } as TeamMember))}
              selectedIds={draftIds}
              onChange={setDraftIds}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
              {assignees.length > 0 ? assignees.map((m, i) => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ marginLeft: i > 0 ? -5 : 0, border: `2px solid ${t.surf}`, borderRadius: '50%', zIndex: 4 - i }}>
                    <Av name={m.name} size={22} />
                  </div>
                  {assignees.length === 1 && <span style={{ fontSize: 12, color: t.sub }}>{m.name}</span>}
                </div>
              )) : (
                <span style={{ fontSize: 12, color: t.muted, fontStyle: 'italic' }}>Unassigned</span>
              )}
              {assignees.length > 1 && (
                <span style={{ fontSize: 11, color: t.muted }}>({assignees.length})</span>
              )}
            </div>
          )}
        </PropRow>

        {/* Report type */}
        <PropRow label="Report Type" isDark={isDark}>
          {editMode ? (
            <select value={draftRT} onChange={e => setDraftRT(e.target.value)} style={sel()}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
              <option value="">None</option>
              {reportTypes.map(r => <option key={r.key} value={r.key}>{r.name_en}</option>)}
            </select>
          ) : (
            task.report_type ? (
              <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 9px', borderRadius: 5, background: `${PURP}14`, color: PURP, border: `1px solid ${PURP}22` }}>
                {reportTypes.find(r => r.key === task.report_type)?.name_en ?? task.report_type.replace(/_/g, ' ')}
              </span>
            ) : <span style={{ fontSize: 12, color: t.muted, fontStyle: 'italic' }}>None</span>
          )}
        </PropRow>

        {/* Visibility */}
        <PropRow label="Visibility" isDark={isDark}>
          {editMode ? (
            <select value={draftVis} onChange={e => setDraftVis(e.target.value as 'team' | 'private')} style={sel()}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)} onBlur={e => (e.currentTarget.style.borderColor = t.inbd)}>
              <option value="team">👥 Team (visible to all)</option>
              <option value="private">🔒 Private (assignees only)</option>
            </select>
          ) : (
            <span style={{ fontSize: 12, color: t.sub }}>
              {task.visibility === 'private' ? '🔒 Private' : '👥 Team'}
            </span>
          )}
        </PropRow>

        {/* Description — inline editable */}
        <div style={{ paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 7 }}>Description</div>
          {editMode ? (
            <textarea value={draftDesc} onChange={e => setDraftDesc(e.target.value)} rows={4}
              placeholder="Add a description…"
              style={{ ...inp({ resize: 'vertical' as const }), fontSize: 12, width: '100%', boxSizing: 'border-box' as const }}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
              onBlur={e  => (e.currentTarget.style.borderColor = t.inbd)} />
          ) : task.description ? (
            <div
              style={{ fontSize: 13, color: t.sub, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, cursor: isMgr ? 'pointer' : 'default', padding: '6px 8px', borderRadius: 6, border: `1px solid transparent`, transition: 'border-color .15s, background .15s' }}
              title={isMgr ? 'Click to edit' : undefined}
              onClick={() => isMgr && setEditMode(true)}
              onMouseEnter={e => { if (isMgr) { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.background = t.hover; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}>
              {task.description}
            </div>
          ) : (
            <div
              style={{ fontSize: 12, color: t.muted, fontStyle: 'italic', cursor: isMgr ? 'pointer' : 'default', padding: '8px', borderRadius: 6, border: `1px dashed ${isMgr ? t.bord : 'transparent'}`, transition: 'border-color .15s' }}
              onClick={() => isMgr && setEditMode(true)}
              onMouseEnter={e => { if (isMgr) e.currentTarget.style.borderColor = BLUE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isMgr ? t.bord : 'transparent'; }}>
              {isMgr ? '+ Add description…' : 'No description.'}
            </div>
          )}
        </div>

        {/* Completion tracker */}
        {assignees.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.bord}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Completion</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {assignees.map((m, i) => {
                  const done = (task.completed_by ?? []).includes(m.user_id ?? '');
                  return (
                    <div key={m.user_id ?? m.name} title={m.name + (done ? ' ✓' : '')} style={{ marginLeft: i > 0 ? -8 : 0, position: 'relative', zIndex: 4 - i, border: `2px solid ${t.surf}`, borderRadius: '50%' }}>
                      <Av name={m.name} size={26} />
                      <span style={{ position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: done ? GRN : t.surf3, border: `1.5px solid ${t.surf}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, color: '#fff' }}>
                        {done ? '✓' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <span style={{ fontSize: 11, color: t.muted, fontWeight: 500 }}>
                {(task.completed_by ?? []).length} of {assignees.length} done
              </span>
            </div>
            {isAssigned && (
              <button type="button" onClick={() => void handleCompletionToggle()}
                style={{ width: '100%', padding: '6px 0', borderRadius: 7, border: `1px solid ${hasCompleted ? GRN : t.bord}`, background: hasCompleted ? `${GRN}10` : 'transparent', color: hasCompleted ? GRN : t.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${hasCompleted ? GRN : t.muted}`, background: hasCompleted ? GRN : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', transition: 'all .2s' }}>
                  {hasCompleted ? '✓' : ''}
                </span>
                {hasCompleted ? 'Mark as incomplete' : 'Mark my participation done'}
              </button>
            )}
          </div>
        )}

        {/* Delete */}
        {isMgr && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.bord}` }}>
            <button type="button" onClick={() => void handleDelete()} disabled={deleting}
              style={{ width: '100%', padding: '6px 0', borderRadius: 7, border: `1px solid ${RED}28`, background: `${RED}06`, color: RED, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? .5 : 1 }}>
              {deleting ? 'Deleting…' : 'Delete task'}
            </button>
          </div>
        )}
            </div>{/* /padding div */}
          </div>
        )}{/* /info tab */}

        {/* ── DISCUSSION tab ───────────────────────────────────────────────── */}
        {detailTab === 'discussion' && (
          <DiscussionPanel
            comments={taskComments}
            members={members}
            currentUserId={currentUserId}
            isMgr={isMgr}
            isDark={isDark}
            onPost={p => onAddComment({ ...p, taskId: task.id })}
            onDeleteComment={onDeleteComment}
          />
        )}

        {/* ── FILES tab ────────────────────────────────────────────────────── */}
        {detailTab === 'files' && (
          <FilesTab
            resources={resources}
            isDark={isDark}
            currentUserId={currentUserId}
            isMgr={isMgr}
            onUpload={onUploadResource}
            onDelete={onDeleteResource}
          />
        )}

        {/* ── AI REVIEW tab ────────────────────────────────────────────────── */}
        {detailTab === 'ai' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>
            <AIReviewPanel taskId={task.id} projectId={projectId} isDark={isDark} onSubmitForReview={onOpenAIReview} />
          </div>
        )}

      </div>{/* /tab content area */}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CollaborationSidebar — Step 4: 4-tab sidebar
   Tabs: Team | Feed | Files | AI
══════════════════════════════════════════════════════════════════════════ */
type SidebarTab = 'team' | 'chat' | 'threads' | 'files' | 'ai';

/* ── TeamTab ──────────────────────────────────────────────────────────── */
function TeamTab({ members, comments, isDark, currentUserName, mentions, projectId, isMgr, onAddMember, onRemoveMember, onChangeMemberRole }: {
  members: Member[]; comments: Comment[]; isDark: boolean; currentUserName: string; mentions: Comment[];
  projectId: string; isMgr: boolean;
  onAddMember:        (userId: string)   => Promise<void>;
  onRemoveMember:     (memberId: string) => Promise<void>;
  onChangeMemberRole: (memberId: string, role: string) => Promise<void>;
}) {
  const t           = T(isDark);
  const onlineCount = members.filter(m => m.online).length;

  /* ── add member state ──────────────────────────────────────────────── */
  const [showAdd,    setShowAdd]    = useState(false);
  const [addSearch,  setAddSearch]  = useState('');
  const [available,  setAvailable]  = useState<{ user_id: string; name: string; role: string; email?: string }[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [actionId,   setActionId]   = useState<string | null>(null);

  const searchUsers = useCallback(async (q: string) => {
    setAddLoading(true);
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/members/available${q ? `?search=${encodeURIComponent(q)}` : ''}`, { headers: hdr() });
      if (r.ok) { const d = await r.json(); setAvailable(d.members ?? []); }
    } finally { setAddLoading(false); }
  }, [projectId]);

  useEffect(() => { if (showAdd) void searchUsers(addSearch); }, [showAdd, addSearch, searchUsers]);

  const doAdd = async (userId: string) => {
    setActionId(userId);
    try { await onAddMember(userId); setShowAdd(false); setAddSearch(''); }
    finally { setActionId(null); }
  };

  const doRemove = async (memberId: string) => {
    if (!window.confirm('Remove this member?')) return;
    setActionId(memberId);
    try { await onRemoveMember(memberId); }
    finally { setActionId(null); }
  };

  const doRole = async (memberId: string, role: string) => {
    setActionId(memberId);
    try { await onChangeMemberRole(memberId, role); }
    finally { setActionId(null); }
  };

  const inpStyle: React.CSSProperties = { width: '100%', padding: '5px 8px', background: t.inbg, border: `1px solid ${t.inbd}`, borderRadius: 6, color: t.text, fontSize: 11, outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Team header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>
          Team · {members.length}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onlineCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: GRN, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />{onlineCount} online
            </span>
          )}
          {isMgr && (
            <button type="button" onClick={() => setShowAdd(p => !p)}
              style={{ fontSize: 11, fontWeight: 700, color: showAdd ? BLUE : t.muted, background: showAdd ? `${BLUE}12` : 'transparent', border: `1px solid ${showAdd ? BLUE : t.bord}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
              {showAdd ? '× Close' : '+ Add'}
            </button>
          )}
        </div>
      </div>

      {/* Add member panel */}
      {showAdd && isMgr && (
        <div style={{ marginBottom: 10, padding: '8px', background: t.surf2, borderRadius: 8, border: `1px solid ${t.bord}` }}>
          <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search users…" style={inpStyle} autoFocus />
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 160, overflowY: 'auto' }}>
            {addLoading && <div style={{ fontSize: 11, color: t.muted, padding: '6px 0', textAlign: 'center' as const }}>Searching…</div>}
            {!addLoading && available.length === 0 && <div style={{ fontSize: 11, color: t.muted, padding: '6px 0', textAlign: 'center' as const }}>No users found</div>}
            {available.map(u => (
              <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 5, transition: 'background .12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Av name={u.name} size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'capitalize' as const }}>{u.role}</div>
                </div>
                <button type="button" onClick={() => void doAdd(u.user_id)} disabled={actionId === u.user_id}
                  style={{ padding: '2px 8px', borderRadius: 5, border: 'none', background: BLUE, color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', opacity: actionId === u.user_id ? .5 : 1, fontFamily: 'inherit' }}>
                  {actionId === u.user_id ? '…' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {members.map(m => (
          <div key={m.user_id ?? m.name}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6, transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Av name={m.name} size={26} />
              <span style={{ position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: m.online ? GRN : '#475569', border: `1.5px solid ${isDark ? '#111420' : '#ffffff'}` }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{m.name}</div>
              <div style={{ fontSize: 10, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{m.role.replace(/_/g, ' ')}</div>
            </div>
            {isMgr && m.user_id && (
              <button type="button" title="Remove member" onClick={() => void doRemove(m.user_id!)} disabled={actionId === m.user_id}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 14, lineHeight: 1, padding: '2px', opacity: actionId === m.user_id ? .4 : 1, transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = RED)}
                onMouseLeave={e => (e.currentTarget.style.color = t.muted)}>
                ×
              </button>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <div style={{ fontSize: 12, color: t.muted, fontStyle: 'italic', textAlign: 'center' as const, padding: '16px 0' }}>No team members</div>
        )}
      </div>

      {/* Mentions section */}
      {mentions.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.bord}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 8 }}>
            Mentions · {mentions.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {mentions.slice(0, 5).map(c => (
              <div key={c.id ?? c._id} style={{ padding: '7px 9px', background: isDark ? `${BLUE}0a` : `${BLUE}06`, borderRadius: 7, border: `1px solid ${BLUE}18` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <Av name={c.user_name} size={16} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.sub }}>{c.user_name}</span>
                  <span style={{ fontSize: 10, color: t.muted, marginLeft: 'auto' }}>{fmtTime(c.created_at)}</span>
                </div>
                <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.4, display: '-webkit-box' as const, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                  {c.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discussion preview — last 3 comments */}
      {comments.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.bord}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 8 }}>
            Recent Messages
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...comments].slice(-3).reverse().map(c => (
              <div key={c.id ?? c._id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                <Av name={c.user_name} size={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.sub }}>{c.user_name}</span>
                    <span style={{ fontSize: 9, color: t.muted }}>{fmtTime(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {c.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── FeedTab ──────────────────────────────────────────────────────────── */
function FeedTab({ items, isDark }: { items: ActivityItem[]; isDark: boolean }) {
  const t = T(isDark);

  const Icon = ({ type, color }: { type: ActivityItem['type']; color: string }) => {
    if (type === 'comment') return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    );
    if (type === 'done') return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    );
  };

  if (items.length === 0) {
    return (
      <div style={{ padding: '32px 14px', textAlign: 'center' as const, color: t.muted, fontSize: 12 }}>
        No recent activity
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 10 }}>
        Activity · {items.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, idx) => (
          <div key={item.id} style={{ display: 'flex', gap: 9, padding: '7px 0', borderBottom: idx < items.length - 1 ? `1px solid ${t.bord2}` : 'none' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <Icon type={item.type} color={item.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.4 }}>
                <span style={{ fontWeight: 700, color: t.text }}>{item.actorName}</span>
                {' '}{item.action}{' '}
                <span style={{ color: item.color }}>{item.detail}</span>
              </div>
              {item.time && (
                <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>{fmtTime(item.time)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── FilesTab ─────────────────────────────────────────────────────────── */
function FilesTab({ resources, isDark, currentUserId, isMgr, onUpload, onDelete }: {
  resources:      Resource[];
  isDark:         boolean;
  currentUserId?: string;
  isMgr?:         boolean;
  onUpload?:      (f: File) => Promise<void>;
  onDelete?:      (id: string) => Promise<void>;
}) {
  const t = T(isDark);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function extColor(ext: string): string {
    if (ext === 'PDF')                          return RED;
    if (['DOC', 'DOCX'].includes(ext))          return BLUE;
    if (['XLS', 'XLSX', 'CSV'].includes(ext))   return GRN;
    if (['JPG', 'JPEG', 'PNG', 'GIF', 'SVG', 'WEBP'].includes(ext)) return PURP;
    return '#64748b';
  }

  const isImage = (name: string) => /\.(jpe?g|png|gif|svg|webp)$/i.test(name);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    e.target.value = '';
    setUploading(true);
    try { await onUpload(file); } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    setDeletingId(id);
    try { await onDelete(id); } finally { setDeletingId(null); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Upload bar */}
      {onUpload && (
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: `1px dashed ${uploading ? t.bord : BLUE}`, background: uploading ? t.surf3 : `${BLUE}08`, color: uploading ? t.muted : BLUE, fontSize: 11, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', fontFamily: 'inherit', width: '100%', justifyContent: 'center', transition: 'all .15s' }}>
            {uploading
              ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path opacity=".75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>Uploading…</>
              : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload file</>
            }
          </button>
        </div>
      )}

      {/* Image preview lightbox */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={preview} alt="preview" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,.6)' }} />
        </div>
      )}

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>
        {resources.length === 0 && (
          <div style={{ padding: '28px 0', textAlign: 'center' as const, color: t.muted, fontSize: 12 }}>
            {onUpload ? 'No files yet. Upload the first one.' : 'No files uploaded yet.'}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {resources.map((r, idx) => {
            const ext    = (r.file_name.split('.').pop() ?? 'FILE').toUpperCase();
            const color  = extColor(ext);
            const img    = isImage(r.file_name);
            const rid    = r.id ?? r._id ?? `${idx}`;
            const canDel = onDelete && (isMgr || (r.uploaded_by === currentUserId));
            const deleting = deletingId === rid;
            return (
              <div key={rid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 7, border: `1px solid transparent`, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'; e.currentTarget.style.borderColor = t.bord; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>

                {/* Thumb / type badge */}
                {img && r.download_url ? (
                  <div onClick={() => setPreview(r.download_url!)} style={{ width: 34, height: 34, borderRadius: 5, overflow: 'hidden', flexShrink: 0, cursor: 'zoom-in', border: `1px solid ${t.bord}` }}>
                    <img src={r.download_url} alt={r.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: 5, background: `${color}14`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color, letterSpacing: '.02em' }}>{ext.slice(0, 4)}</span>
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.file_name}</div>
                  <div style={{ fontSize: 10, color: t.muted }}>
                    {r.uploader_name ?? r.uploaded_by}{r.created_at ? ` · ${fmtTime(r.created_at)}` : ''}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  {r.download_url && (
                    <a href={r.download_url} download target="_blank" rel="noreferrer" title="Download"
                      style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                  )}
                  {canDel && (
                    <button type="button" title="Remove" onClick={() => void handleDelete(rid)} disabled={deleting}
                      style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${t.bord}`, background: 'transparent', color: deleting ? t.muted : RED, cursor: deleting ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting ? .5 : 1, transition: 'color .15s' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── AITab ────────────────────────────────────────────────────────────── */
function AITab({ summaries, tasks, projectId, isDark }: {
  summaries: AISummary[]; tasks: Task[]; projectId: string; isDark: boolean;
}) {
  const t = T(isDark);

  /* Pending: in 'review' status, no AI review yet or last review failed */
  const pending = tasks.filter(tk => {
    if (taskStatus(tk) !== 'review') return false;
    const ai = aiGet(projectId, tk.id);
    return !ai || !ai.passed;
  });
  /* Failed: have a review but failed */
  const failed = summaries.filter(s => !s.passed);

  if (summaries.length === 0 && pending.length === 0) {
    return (
      <div style={{ padding: '28px 14px', textAlign: 'center' as const, color: t.muted, fontSize: 12, lineHeight: 1.6 }}>
        No AI reviews yet.<br />
        <span style={{ fontSize: 11 }}>Open a task and click "Submit For AI Review."</span>
      </div>
    );
  }

  const passCount = summaries.filter(s => s.passed).length;
  const avgScore  = summaries.length > 0 ? Math.round(summaries.reduce((acc, s) => acc + s.score, 0) / summaries.length) : 0;

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Summary stats */}
      {summaries.length > 0 && (
        <div style={{ display: 'flex', gap: 5 }}>
          {[
            { label: 'Avg',    value: `${avgScore}%`, color: avgScore >= 85 ? GRN : avgScore >= 60 ? AMB : RED },
            { label: 'Passed', value: `${passCount}`, color: GRN },
            { label: 'Failed', value: `${summaries.length - passCount}`, color: RED },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, padding: '7px 4px', borderRadius: 7, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)', border: `1px solid ${t.bord}`, textAlign: 'center' as const }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: t.muted, marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pending reviews */}
      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: AMB, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 6 }}>
            Pending Review · {pending.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pending.map(tk => (
              <div key={tk.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 6, background: `${AMB}08`, border: `1px solid ${AMB}20` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: AMB, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>{tk.title}</span>
                <span style={{ fontSize: 9, color: AMB, fontWeight: 700, flexShrink: 0 }}>PENDING</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed reviews */}
      {failed.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 6 }}>
            Failed · {failed.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {failed.map(s => (
              <div key={s.taskId} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 6, background: `${RED}07`, border: `1px solid ${RED}20` }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: RED, flexShrink: 0 }}>{s.score}%</span>
                <span style={{ fontSize: 11, color: t.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>{s.taskTitle}</span>
                <span style={{ fontSize: 9, color: t.muted, flexShrink: 0 }}>{fmtTime(s.evaluatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent evaluations — last 5 across all tasks */}
      {summaries.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 6 }}>
            Recent · {Math.min(summaries.length, 5)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {summaries.slice(0, 5).map(s => (
              <div key={s.taskId} style={{ padding: '7px 9px', borderRadius: 7, border: `1px solid ${s.passed ? `${GRN}22` : `${RED}20`}`, background: s.passed ? `${GRN}06` : `${RED}05` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.sub, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{s.taskTitle}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: s.passed ? GRN : RED, marginLeft: 6, flexShrink: 0 }}>{s.score}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: s.passed ? GRN : RED }}>{s.passed ? 'PASSED' : 'FAILED'}</span>
                  <span style={{ fontSize: 9, color: t.muted }}>{fmtTime(s.evaluatedAt)}</span>
                </div>
                <div style={{ marginTop: 4, height: 2, borderRadius: 2, background: t.bord, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.score}%`, background: s.passed ? GRN : s.score >= 60 ? AMB : RED, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── TaskThreadsTab — list of per-task discussions ───────────────────── */
function TaskThreadsTab({ tasks, comments, isDark, onOpen }: {
  tasks: Task[]; comments: Comment[]; isDark: boolean; onOpen: (taskId: string) => void;
}) {
  const t = T(isDark);

  /* one entry per task that has at least one task-scoped comment */
  const threads = useMemo(() => {
    return tasks
      .map(tk => {
        const tComments = comments.filter(c => c.task_id === tk.id);
        if (tComments.length === 0) return null;
        const last = tComments[tComments.length - 1];
        return { task: tk, count: tComments.length, last };
      })
      .filter((x): x is { task: Task; count: number; last: Comment } => x !== null)
      .sort((a, b) => (b.last.created_at ?? '').localeCompare(a.last.created_at ?? ''));
  }, [tasks, comments]);

  if (threads.length === 0) {
    return (
      <div style={{ padding: '28px 14px', textAlign: 'center' as const, color: t.muted, fontSize: 12, lineHeight: 1.6 }}>
        No task discussions yet.<br />
        <span style={{ fontSize: 11 }}>Open a task and write in its Discussion tab.</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 2 }}>
        Task Discussions · {threads.length}
      </div>
      {threads.map(({ task, count, last }) => (
        <button key={task.id} type="button" onClick={() => onOpen(task.id)}
          style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' as const, padding: '9px 10px', borderRadius: 8, border: `1px solid ${t.bord}`, background: t.surf, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = `${BLUE}55`; e.currentTarget.style.background = isDark ? 'rgba(29,110,245,.07)' : 'rgba(29,110,245,.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.bord; e.currentTarget.style.background = t.surf; }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{task.title}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: `${BLUE}14`, color: BLUE, flexShrink: 0 }}>{count}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 17 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: t.sub, flexShrink: 0 }}>{last.user_name}:</span>
            <span style={{ fontSize: 10, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{last.message || '📎 attachment'}</span>
            <span style={{ fontSize: 9, color: t.muted, marginLeft: 'auto', flexShrink: 0 }}>{fmtTime(last.created_at)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── CollaborationSidebar ─────────────────────────────────────────────── */
function CollaborationSidebar({ tasks, members, resources, comments, projectId, isDark, onAddComment, onDeleteComment, onAddMember, onRemoveMember, onChangeMemberRole, onDeleteResource, onOpenTaskThread }: {
  tasks: Task[]; members: Member[]; resources: Resource[]; comments: Comment[];
  projectId: string; isDark: boolean;
  onAddComment:       (p: CommentPayload) => Promise<void>;
  onDeleteComment:    (id: string)        => Promise<void>;
  onAddMember:        (userId: string)    => Promise<void>;
  onRemoveMember:     (memberId: string)  => Promise<void>;
  onChangeMemberRole: (memberId: string, role: string) => Promise<void>;
  onDeleteResource:   (id: string)        => Promise<void>;
  onOpenTaskThread:   (taskId: string)    => void;
}) {
  const t               = T(isDark);
  const [activeTab, setActiveTab] = useState<SidebarTab>('chat');
  const currentUserName = localStorage.getItem('name') ?? localStorage.getItem('userName') ?? '';
  const currentUserId   = localStorage.getItem('userId') ?? '';
  const userRole        = (localStorage.getItem('role') ?? '').toLowerCase();
  const isMgr           = ['admin', 'sub_admin', 'manager'].includes(userRole);

  /* main chat shows ONLY project-wide messages — task discussions live in their task */
  const generalComments = useMemo(() => comments.filter(c => !c.task_id), [comments]);
  const threadCount     = useMemo(() => new Set(comments.filter(c => c.task_id).map(c => c.task_id)).size, [comments]);

  const aiSummaries = useMemo(() => getAiSummaries(projectId, tasks), [projectId, tasks]);

  const mentions = useMemo(() => {
    if (!currentUserName) return [];
    const lower = currentUserName.toLowerCase();
    return comments.filter(c =>
      c.user_name.toLowerCase() !== lower && c.message.toLowerCase().includes(lower)
    );
  }, [comments, currentUserName]);

  const tabs: { id: SidebarTab; label: string; badge?: number; badgeColor?: string }[] = [
    { id: 'chat',    label: 'Chat',    badge: generalComments.length > 0 ? generalComments.length : undefined, badgeColor: BLUE },
    { id: 'threads', label: 'Threads', badge: threadCount > 0 ? threadCount : undefined, badgeColor: PURP },
    { id: 'team',    label: 'Team',    badge: mentions.length > 0 ? mentions.length : undefined, badgeColor: AMB  },
    { id: 'files',   label: 'Files',   badge: resources.length > 0 ? resources.length : undefined, badgeColor: PURP },
    { id: 'ai',      label: 'AI',      badge: aiSummaries.length > 0 ? aiSummaries.length : undefined, badgeColor: GRN  },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Sidebar header */}
      <div style={{ padding: '11px 14px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>
          {activeTab === 'chat'    ? 'Team Chat'
           : activeTab === 'threads' ? 'Task Discussions'
           : activeTab === 'team'    ? 'Team Members'
           : activeTab === 'files'   ? 'Files'
           : 'AI Reviews'}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.bord}`, flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '7px 4px 6px', border: 'none', background: 'transparent',
              color: activeTab === tab.id ? t.text : t.muted,
              borderBottom: `2px solid ${activeTab === tab.id ? BLUE : 'transparent'}`,
              fontSize: 11, fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'color .15s', position: 'relative',
            }}>
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{ position: 'absolute', top: 4, right: 2, minWidth: 14, height: 14, borderRadius: 7, background: tab.badgeColor ?? BLUE, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — Chat gets flex layout with pinned compose bar */}
      {activeTab === 'chat' && (
        <DiscussionPanel
          comments={generalComments}
          members={members}
          currentUserId={currentUserId}
          isMgr={isMgr}
          isDark={isDark}
          onPost={onAddComment}
          onDeleteComment={onDeleteComment}
        />
      )}

      {activeTab !== 'chat' && (
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>
          {activeTab === 'threads' && <TaskThreadsTab tasks={tasks} comments={comments} isDark={isDark} onOpen={onOpenTaskThread} />}
          {activeTab === 'team'  && <TeamTab  members={members} comments={generalComments} isDark={isDark} currentUserName={currentUserName} mentions={mentions} projectId={projectId} isMgr={isMgr} onAddMember={onAddMember} onRemoveMember={onRemoveMember} onChangeMemberRole={onChangeMemberRole} />}
          {activeTab === 'files' && <FilesTab resources={resources} isDark={isDark} currentUserId={currentUserId} isMgr={isMgr} onDelete={onDeleteResource} />}
          {activeTab === 'ai'    && <AITab    summaries={aiSummaries} tasks={tasks} projectId={projectId} isDark={isDark} />}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ProjectWorkspace — main page component
══════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════
   MembersModal — team roster overlay
══════════════════════════════════════════════════════════════════════════ */
function MembersModal({ members, isDark, onClose }: { members: Member[]; isDark: boolean; onClose: () => void }) {
  const t           = T(isDark);
  const onlineCount = members.filter(m => m.online).length;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440, background: t.surf, borderRadius: 14, border: `1px solid ${t.bord}`, boxShadow: t.shadow, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${t.bord}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Team Members</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
              {members.length} member{members.length !== 1 ? 's' : ''} · {onlineCount} online
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${t.bord}`, background: 'transparent', color: t.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            ×
          </button>
        </div>

        {/* Member list */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px 12px 14px', scrollbarWidth: 'thin' as const, scrollbarColor: `${t.bord} transparent` }}>
          {members.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center' as const, color: t.muted, fontSize: 13 }}>No team members yet.</div>
          )}
          {members.map(m => (
            <div key={m.user_id ?? m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 8, transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Av name={m.name} size={40} />
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: m.online ? GRN : '#475569', border: `2px solid ${t.surf}` }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{m.name}</div>
                <div style={{ fontSize: 11, color: t.muted, textTransform: 'capitalize' as const }}>
                  {m.role.replace(/_/g, ' ')}
                  {m.email ? ` · ${m.email}` : ''}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: m.online ? `${GRN}14` : t.surf3, color: m.online ? GRN : t.muted, flexShrink: 0 }}>
                {m.online ? 'Online' : 'Offline'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProjectWorkspace() {
  const [params]      = useSearchParams();
  const navigate      = useNavigate();
  const { isDark }    = useTheme();
  const t             = T(isDark);
  const projectId     = params.get('projectId') ?? '';

  const [overview,   setOverview]   = useState<Overview | null>(null);
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [members,    setMembers]    = useState<Member[]>([]);
  const [resources,  setResources]  = useState<Resource[]>([]);
  const [comments,   setComments]   = useState<Comment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  /* which detail tab to open the task panel on (e.g. 'discussion' when opening a thread) */
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab>('info');

  /* normal task selection opens the Info tab */
  const handleSelectTask = useCallback((id: string | null) => {
    setDetailInitialTab('info');
    setSelectedTaskId(id);
  }, []);

  /* open a task straight into its Discussion tab (from the sidebar threads list) */
  const handleOpenTaskThread = useCallback((taskId: string) => {
    setDetailInitialTab('discussion');
    setSelectedTaskId(taskId);
  }, []);

  /* create task modal */
  const [createModal,   setCreateModal]   = useState<{ defaultStatus: TaskStatus } | null>(null);
  const [membersOpen,   setMembersOpen]   = useState(false);

  /* report types for task detail panel */
  const [reportTypes, setReportTypes] = useState<ReportType[]>(DEFAULT_RT);

  /* ── load board data ─────────────────────────────────────────────────── */
  const loadBoard = useCallback(async () => {
    if (!projectId) { setError('No project ID provided.'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/task-boards/${projectId}`, { headers: hdr() });
      if (!r.ok) throw new Error(await r.text() || 'Failed to load project');
      const data = await r.json();
      setOverview(data.overview ?? null);
      setTasks((data.tasks ?? []).map((tk: Task) => ({ ...tk, id: tk.id ?? (tk as any)._id })));
      setMembers((data.members ?? []).map((m: Member) => ({ ...m, avatar: m.avatar || ini(m.name), online: m.online ?? false })));
      setResources((data.resources ?? []).map((res: Resource) => ({ ...res, id: res.id ?? res._id })));
      setComments((data.comments ?? []).map((c: Comment) => ({ ...c, id: c.id ?? c._id })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  /* ── fetch report types ─────────────────────────────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem('token'), uid = localStorage.getItem('userId');
    if (!token) return;
    fetch(`${API}/quality/report-types`, { headers: { Authorization: `Bearer ${token}`, 'X-User-Id': uid ?? '' } })
      .then(r => r.ok ? r.json() : null)
      .then(d => Array.isArray(d) && d.length > 0 ? setReportTypes(d) : undefined)
      .catch(() => {/* use defaults */});
  }, []);

  /* ── patch task ─────────────────────────────────────────────────────────── */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handlePatchTask = useCallback(async (taskId: string, updates: Record<string, unknown>) => {
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/todos/${taskId}`, {
        method: 'PATCH',
        headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!r.ok) throw new Error(await r.text() || 'Update failed');
      const data = await r.json();
      setTasks((data.tasks ?? []).map((tk: Task) => ({ ...tk, id: tk.id ?? (tk as any)._id })));
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Update failed');
    }
  }, [projectId, showToast]);

  /* ── delete task ─────────────────────────────────────────────────────────── */
  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/todos/${taskId}`, {
        method: 'DELETE',
        headers: hdr(),
      });
      if (!r.ok) throw new Error(await r.text() || 'Delete failed');
      const data = await r.json();
      setTasks((data.tasks ?? []).map((tk: Task) => ({ ...tk, id: tk.id ?? (tk as any)._id })));
      setSelectedTaskId(null);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Delete failed');
    }
  }, [projectId, showToast]);

  /* ── create task (from modal) ───────────────────────────────────────────── */
  const handleCreateTask = useCallback(async (params: CreateTaskParams) => {
    if (!projectId) return;
    const assigneeName = params.assigneeIds.length > 0
      ? params.assigneeIds.map(id => members.find(m => m.user_id === id)?.name).filter(Boolean).join(', ')
      : 'Unassigned';
    const r = await fetch(`${API}/task-boards/${projectId}/todos`, {
      method: 'POST',
      headers: { ...hdr(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:        params.title,
        description:  params.description,
        status:       params.status,
        assignee:     assigneeName,
        due:          params.due || 'TBD',
        done:         false,
        priority:     params.priority,
        visibility:   params.visibility,
        assignee_ids: params.assigneeIds,
        report_type:  params.reportType,
      }),
    });
    if (!r.ok) throw new Error(await r.text() || 'Create failed');
    const data = await r.json();
    setTasks((data.tasks ?? []).map((tk: Task) => ({ ...tk, id: tk.id ?? (tk as any)._id })));
    setCreateModal(null);
  }, [projectId, members]);

  /* ── add comment ─────────────────────────────────────────────────────── */
  const handleAddComment = useCallback(async (payload: CommentPayload) => {
    const fd = new FormData();
    fd.append('message', payload.message);
    (payload.attachments ?? []).forEach(f => fd.append('attachments', f));
    (payload.mentionedIds ?? []).forEach(id => fd.append('mentioned_user_ids', id));
    if (payload.replyToId)      fd.append('reply_to_id',      payload.replyToId);
    if (payload.replyToPreview) fd.append('reply_to_preview', payload.replyToPreview);
    if (payload.replyToAuthor)  fd.append('reply_to_author',  payload.replyToAuthor);
    if (payload.taskId)         fd.append('task_id',          payload.taskId);
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/comments`, { method: 'POST', headers: hdr(), body: fd });
      if (!r.ok) throw new Error(await r.text() || 'Failed to post');
      const data = await r.json();
      setComments((data.comments ?? []).map((c: Comment) => ({ ...c, id: c.id ?? c._id })));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to post comment'); }
  }, [projectId]);

  /* ── delete comment ───────────────────────────────────────────────────── */
  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/comments/${commentId}`, { method: 'DELETE', headers: hdr() });
      if (!r.ok) throw new Error(await r.text() || 'Delete failed');
      const data = await r.json();
      setComments((data.comments ?? []).map((c: Comment) => ({ ...c, id: c.id ?? c._id })));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Delete failed'); }
  }, [projectId]);

  /* ── upload resource ──────────────────────────────────────────────────── */
  const handleUploadResource = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/resources`, { method: 'POST', headers: hdr(), body: fd });
      if (!r.ok) throw new Error(await r.text() || 'Upload failed');
      const data = await r.json();
      setResources((data.resources ?? []).map((res: Resource) => ({ ...res, id: res.id ?? res._id })));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Upload failed'); }
  }, [projectId]);

  /* ── delete resource ──────────────────────────────────────────────────── */
  const handleDeleteResource = useCallback(async (resourceId: string) => {
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/resources/${resourceId}`, { method: 'DELETE', headers: hdr() });
      if (!r.ok) throw new Error(await r.text() || 'Delete failed');
      const data = await r.json();
      setResources((data.resources ?? []).map((res: Resource) => ({ ...res, id: res.id ?? res._id })));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Delete failed'); }
  }, [projectId]);

  /* ── member management ──────────────────────────────────────────────── */
  const handleAddMember = useCallback(async (userId: string) => {
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/members`, {
        method: 'POST',
        headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!r.ok) throw new Error(await r.text() || 'Add failed');
      const data = await r.json();
      setMembers((data.members ?? []).map((m: Member) => ({ ...m, avatar: m.avatar || ini(m.name), online: m.online ?? false })));
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Add member failed'); }
  }, [projectId, showToast]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      });
      if (!r.ok) throw new Error(await r.text() || 'Remove failed');
      const data = await r.json();
      setMembers((data.members ?? []).map((m: Member) => ({ ...m, avatar: m.avatar || ini(m.name), online: m.online ?? false })));
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Remove member failed'); }
  }, [projectId, showToast]);

  const handleChangeMemberRole = useCallback(async (memberId: string, role: string) => {
    try {
      const r = await fetch(`${API}/task-boards/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', role }),
      });
      if (!r.ok) throw new Error(await r.text() || 'Update failed');
      const data = await r.json();
      setMembers((data.members ?? []).map((m: Member) => ({ ...m, avatar: m.avatar || ini(m.name), online: m.online ?? false })));
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Role update failed'); }
  }, [projectId, showToast]);

  /* ── AI review drawer ────────────────────────────────────────────────── */
  const [drawerTask, setDrawerTask]   = useState<Task | null>(null);
  const [, forceAIRefresh]            = useState(0);

  const handleEvaluated = useCallback((result: EvaluationResult, taskId: string) => {
    aiSave(projectId, taskId, {
      compliance_score: result.compliance_score,
      failed_standards: result.failed_standards,
      suggestions:      result.suggestions,
    });
    forceAIRefresh(v => v + 1);
  }, [projectId]);

  /* ── guard: redirect channels to /taskflow ───────────────────────────── */
  useEffect(() => {
    if (projectId === 'public-group' || projectId === 'all-sub-admin') {
      navigate(`/taskflow?projectId=${projectId}`, { replace: true });
    }
  }, [projectId, navigate]);

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: t.bg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'margin .2s', minWidth: 0 }}>

        {/* Loading */}
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 13, gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path opacity=".75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
            Loading workspace…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div style={{ padding: '16px 20px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.22)', borderRadius: 10, color: '#ef4444', fontSize: 13, textAlign: 'center', maxWidth: 400 }}>
              {error}
              <br />
              <button type="button" onClick={() => void loadBoard()} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
            </div>
          </div>
        )}

        {/* Workspace */}
        {!loading && !error && (
          <>
            <ProjectHeader
              overview={overview}
              members={members}
              tasks={tasks}
              isDark={isDark}
              onBack={() => navigate('/projects')}
              onAddTask={() => setCreateModal({ defaultStatus: 'todo' })}
              onMembersClick={() => setMembersOpen(true)}
            />
            <WorkspaceBody
              tasks={tasks}
              members={members}
              resources={resources}
              comments={comments}
              reportTypes={reportTypes}
              projectId={projectId}
              isDark={isDark}
              selectedTaskId={selectedTaskId}
              onSelectTask={handleSelectTask}
              onOpenCreate={col => setCreateModal({ defaultStatus: col })}
              onPatchTask={handlePatchTask}
              onDeleteTask={id => void handleDeleteTask(id)}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onUploadResource={handleUploadResource}
              onDeleteResource={handleDeleteResource}
              onOpenAIReview={setDrawerTask}
              onAddMember={handleAddMember}
              onRemoveMember={handleRemoveMember}
              onChangeMemberRole={handleChangeMemberRole}
              onOpenTaskThread={handleOpenTaskThread}
              detailInitialTab={detailInitialTab}
            />
          </>
        )}
      </div>

      {/* Members modal */}
      {membersOpen && <MembersModal members={members} isDark={isDark} onClose={() => setMembersOpen(false)} />}

      {/* Toast notification (non-blocking errors) */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 600, background: isDark ? '#1e2236' : '#fff', border: `1px solid rgba(239,68,68,.35)`, borderRadius: 10, padding: '10px 18px', fontSize: 12, fontWeight: 600, color: '#ef4444', boxShadow: '0 8px 24px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {toast}
        </div>
      )}

      {/* Create Task Modal */}
      {createModal && (
        <CreateTaskModal
          key={createModal.defaultStatus}
          members={members}
          reportTypes={reportTypes}
          defaultStatus={createModal.defaultStatus}
          isDark={isDark}
          onClose={() => setCreateModal(null)}
          onSubmit={handleCreateTask}
        />
      )}

      {/* AI Review Drawer */}
      {drawerTask && (
        <TaskSubmitDrawer
          isOpen={true}
          taskId={drawerTask.id}
          taskTitle={drawerTask.title}
          projectId={projectId}
          reportType={drawerTask.report_type}
          onClose={() => setDrawerTask(null)}
          onEvaluated={(result, taskId) => handleEvaluated(result, taskId)}
          onSuccess={() => void loadBoard()}
        />
      )}
    </div>
  );
}
