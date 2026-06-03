/**
 * TaskFlowDetail — Orbit Collaboration Hub
 * Handles: /taskflow?projectId=public-group  (workspace announcements)
 *          /taskflow?projectId=all-sub-admin  (operations center)
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';
import Sidebar from '../components/Sidebar';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

/* ── theme ──────────────────────────────────────────────────────────────── */
const T = (d: boolean) => ({
  bg:    d ? '#0b0d14' : '#f0f4f8',
  surf:  d ? '#111420' : '#ffffff',
  surf2: d ? '#161924' : '#f8fafc',
  surf3: d ? '#1c2030' : '#edf2f7',
  bord:  d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)',
  text:  d ? '#f0f4f9' : '#0f172a',
  sub:   d ? 'rgba(255,255,255,.62)' : '#334155',
  muted: d ? 'rgba(255,255,255,.28)' : '#94a3b8',
  hover: d ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
  inbg:  d ? 'rgba(255,255,255,.04)' : '#f8fafc',
  inbd:  d ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.10)',
});

const CH: Record<string, { label: string; accent: string; gradient: string; desc: string; icon: string }> = {
  'public-group': {
    label: 'public', accent: '#4f46e5',
    gradient: 'linear-gradient(135deg,#6d28d9 0%,#4f46e5 55%,#2563eb 100%)',
    desc: 'Open workspace channel — all members', icon: '🌐',
  },
  'all-sub-admin': {
    label: 'all-sub-admin', accent: '#ea580c',
    gradient: 'linear-gradient(135deg,#c2410c 0%,#ea580c 55%,#f59e0b 100%)',
    desc: 'Manager coordination & operations', icon: '⚡',
  },
};

/* ── types ──────────────────────────────────────────────────────────────── */
type Member    = { user_id?: string; name: string; role: string; avatar: string; online: boolean; email?: string };
type Attach    = { id?: string; _id?: string; file_name: string; download_url?: string; size?: number };
type Msg       = { id?: string; _id?: string; user_id?: string; user_name: string; message: string; created_at?: string; attachments?: Attach[] };
type Resource  = { id?: string; _id?: string; file_name: string; uploader_name?: string; created_at?: string; download_url?: string; uploaded_by: string; uploader_role: string; size?: number };
type TaskEntry = { id: string; title: string; done: boolean; assignees?: string[]; due?: string; status?: string };
type Board     = { overview: { title: string; status_badge: string; progress: number }; tasks: TaskEntry[]; members: Member[]; resources: Resource[]; comments: Msg[] };
type Reaction  = { emoji: string; count: number; mine: boolean };

/* ── helpers ─────────────────────────────────────────────────────────────── */
function ini(n: string) { return n.trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()??'').join(''); }
function avbg(n: string) { const h=((n.charCodeAt(0)??0)*47+(n.charCodeAt(1)??0)*13)%360; return `linear-gradient(135deg,hsl(${h},55%,44%),hsl(${h+40},48%,32%))`; }
function rel(iso?: string|null) {
  if (!iso) return '';
  const d = new Date(iso); const m = Math.floor((Date.now()-d.getTime())/60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}
function fmtTime(iso?: string|null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
}
function fmtSize(b?: number) {
  if (!b) return '';
  if (b < 1024*1024) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1024/1024).toFixed(1)} MB`;
}
function fileExt(name: string) { return (name.split('.').pop()??'').toUpperCase().slice(0,4); }
function fileColor(name: string) {
  const e = (name.split('.').pop()??'').toLowerCase();
  if (e==='pdf') return '#ef4444';
  if (['doc','docx'].includes(e)) return '#3b82f6';
  if (['xls','xlsx','csv'].includes(e)) return '#10b981';
  if (['jpg','jpeg','png','gif','svg','webp'].includes(e)) return '#8b5cf6';
  return '#64748b';
}
function isImg(name: string) { return /\.(jpe?g|png|gif|svg|webp)$/i.test(name); }
function hdr() { return { Authorization: `Bearer ${localStorage.getItem('token')??''}`, 'X-User-Id': localStorage.getItem('userId')??'' }; }
function cid(m: Msg) { return m.id ?? m._id ?? ''; }
function rid(r: Resource) { return r.id ?? r._id ?? ''; }

const POST_RE  = /^\[POST:(announcement|task|note)\] (.+?)\n([\s\S]*)$/;
const REPLY_RE = /^\[REPLY:([^\]]+)\]\n([\s\S]*)$/;
const isPost   = (t: string) => POST_RE.test(t);
const isReply  = (t: string) => REPLY_RE.test(t);
const parsePost  = (t: string) => { const m=t.match(POST_RE); return m?{type:m[1] as 'announcement'|'task'|'note',title:m[2],body:m[3].trim()}:null; };
const parseReply = (t: string, all: Msg[]) => { const m=t.match(REPLY_RE); if(!m) return null; return {original:all.find(x=>cid(x)===m[1]),text:m[2]}; };

const POST_CFG = {
  announcement: { label:'Announcement', color:'#6366f1', bg:'rgba(99,102,241,.12)', icon:'📢' },
  task:         { label:'Task',          color:'#10b981', bg:'rgba(16,185,129,.12)', icon:'📋' },
  note:         { label:'Note',          color:'#f59e0b', bg:'rgba(245,158,11,.12)', icon:'📝' },
};

const REACTIONS = ['👍','❤️','😂','🔥','✅'];

/* ── Avatar ─────────────────────────────────────────────────────────────── */
function Av({ name, size=30, online }: { name:string; size?:number; online?:boolean }) {
  return (
    <div style={{ position:'relative', flexShrink:0, width:size, height:size }}>
      <div style={{ width:size, height:size, borderRadius:'50%', background:avbg(name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*.37), fontWeight:700, color:'#fff', userSelect:'none' }}>
        {ini(name)}
      </div>
      {online !== undefined && (
        <span style={{ position:'absolute', bottom:0, right:0, width:Math.max(7,size*.28), height:Math.max(7,size*.28), borderRadius:'50%', background:online?'#10b981':'#475569', border:'2px solid transparent', outline:'2px solid transparent' }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ChannelPage
══════════════════════════════════════════════════════════════════════════ */
function ChannelPage({ channelId }: { channelId: string }) {
  const { isDark } = useTheme();
  const t = T(isDark);
  const ch = CH[channelId] ?? CH['public-group'];

  const userId   = localStorage.getItem('userId') ?? '';
  const userName = localStorage.getItem('name') ?? localStorage.getItem('userName') ?? 'You';
  const userRole = (localStorage.getItem('role') ?? '').toLowerCase();
  const isMgr    = ['admin','sub_admin','manager'].includes(userRole);

  /* refs */
  const feedRef    = useRef<HTMLDivElement>(null);
  const msgRef     = useRef<HTMLInputElement>(null);
  const attachRef  = useRef<HTMLInputElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const pFileRef   = useRef<HTMLInputElement>(null);

  /* core state */
  const [board,     setBoard]     = useState<Board|null>(null);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState<string|null>(null);

  /* chat */
  const [msg,       setMsg]       = useState('');
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [posting,   setPosting]   = useState(false);
  const [delMsg,    setDelMsg]    = useState<string|null>(null);
  const [replyTo,   setReplyTo]   = useState<Msg|null>(null);
  const [mQuery,    setMQuery]    = useState('');
  const [mOpen,     setMOpen]     = useState(false);
  const [mIds,      setMIds]      = useState<string[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [showPicker,setShowPicker]= useState<string|null>(null);
  const [expanded,  setExpanded]  = useState<Record<string,boolean>>({});

  /* resources */
  const [uploading, setUploading] = useState(false);
  const [delRes,    setDelRes]    = useState<string|null>(null);
  const [previewUrl,setPreviewUrl]= useState<string|null>(null);

  /* new post */
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [pType,       setPType]       = useState<'announcement'|'task'|'note'>('announcement');
  const [pTitle,      setPTitle]      = useState('');
  const [pBody,       setPBody]       = useState('');
  const [pFiles,      setPFiles]      = useState<File[]>([]);

  /* new task */
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [tTitle,      setTTitle]      = useState('');
  const [tDue,        setTDue]        = useState('');
  const [savingTask,  setSavingTask]  = useState(false);

  /* left panel */
  const [leftTab, setLeftTab] = useState<'board'|'tasks'|'files'|'members'>('board');


  /* ── load ─────────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/task-boards/${channelId}`, { headers: hdr() });
      if (!r.ok) throw new Error(await r.text());
      setBoard(await r.json());
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Load failed'); }
    finally { setLoading(false); }
  }, [channelId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [board?.comments?.length]);

  /* ── derived ──────────────────────────────────────────────────────────── */
  const onlineCount  = useMemo(() => (board?.members??[]).filter(m=>m.online).length, [board]);
  const posts        = useMemo(() => (board?.comments??[]).filter(m=>isPost(m.message)), [board]);
  const chatMsgs     = useMemo(() => (board?.comments??[]).filter(m=>!isPost(m.message)), [board]);
  const filteredChat = chatMsgs;
  const filteredM = useMemo(() => (board?.members??[]).filter(m=>m.name.toLowerCase().includes(mQuery.toLowerCase())).slice(0,6), [board, mQuery]);

  /* ── send message ─────────────────────────────────────────────────────── */
  const doSend = async (text: string, files: File[]) => {
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('message', text);
      if (mIds.length > 0) mIds.forEach(id => fd.append('mentioned_user_ids', id));
      files.forEach(f => fd.append('files', f));
      const r = await fetch(`${API}/task-boards/${channelId}/comments`, { method:'POST', headers:hdr(), body:fd });
      if (!r.ok) throw new Error(await r.text());
      setBoard(await r.json());
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Post failed'); }
    finally { setPosting(false); }
  };

  const sendChat = async () => {
    if (!msg.trim() && chatFiles.length === 0) return;
    const text = replyTo ? `[REPLY:${cid(replyTo)}]\n${msg.trim()}` : msg.trim();
    await doSend(text, chatFiles);
    setMsg(''); setChatFiles([]); setMIds([]); setReplyTo(null);
  };

  const sendPost = async () => {
    if (!pTitle.trim()) return;
    const text = `[POST:${pType}] ${pTitle.trim()}\n${pBody.trim()}`;
    await doSend(text, pFiles);
    setNewPostOpen(false); setPTitle(''); setPBody(''); setPFiles([]);
  };

  /* ── delete message ───────────────────────────────────────────────────── */
  const deleteMsg = async (id: string) => {
    setDelMsg(id);
    try {
      const r = await fetch(`${API}/task-boards/${channelId}/comments/${id}`, { method:'DELETE', headers:hdr() });
      if (!r.ok) throw new Error(await r.text());
      setBoard(await r.json());
    } catch {} finally { setDelMsg(null); }
  };

  /* ── upload resource ──────────────────────────────────────────────────── */
  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`${API}/task-boards/${channelId}/resources`, { method:'POST', headers:hdr(), body:fd });
      if (!r.ok) throw new Error(await r.text());
      setBoard(await r.json());
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value=''; }
  };

  const deleteRes = async (id: string) => {
    setDelRes(id);
    try {
      const r = await fetch(`${API}/task-boards/${channelId}/resources/${id}`, { method:'DELETE', headers:hdr() });
      if (!r.ok) throw new Error(await r.text());
      setBoard(await r.json());
    } catch {} finally { setDelRes(null); }
  };

  /* ── toggle task done ─────────────────────────────────────────────────── */
  const toggleTask = async (taskId: string, currentDone: boolean) => {
    setBoard(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, done: !currentDone } : t) } : prev);
    try {
      const r = await fetch(`${API}/task-boards/${channelId}/todos/${taskId}`, {
        method: 'PATCH',
        headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !currentDone }),
      });
      if (!r.ok) {
        setBoard(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, done: currentDone } : t) } : prev);
      } else {
        const updated = await r.json();
        if (updated?.tasks) setBoard(updated);
      }
    } catch {
      setBoard(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, done: currentDone } : t) } : prev);
    }
  };

  /* ── create task via post ─────────────────────────────────────────────── */
  const createTask = async () => {
    if (!tTitle.trim()) return;
    setSavingTask(true);
    await doSend(`[POST:task] ${tTitle.trim()}\nDue: ${tDue || 'TBD'}`, []);
    setNewTaskOpen(false); setTTitle(''); setTDue('');
    setSavingTask(false);
  };

  /* ── reactions (client-side) ──────────────────────────────────────────── */
  const toggleReaction = (msgId: string, emoji: string) => {
    setReactions(prev => {
      const cur = prev[msgId] ?? REACTIONS.map(e=>({emoji:e,count:0,mine:false}));
      return { ...prev, [msgId]: cur.map(r => r.emoji===emoji ? {...r, count:r.mine?r.count-1:r.count+1, mine:!r.mine} : r) };
    });
    setShowPicker(null);
  };
  const getMsgReactions = (msgId: string): Reaction[] =>
    reactions[msgId] ?? REACTIONS.map(e=>({emoji:e,count:0,mine:false}));

  /* ── mention input ────────────────────────────────────────────────────── */
  const handleMsgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setMsg(v);
    const cur = e.target.selectionStart ?? v.length;
    const at = v.slice(0,cur).lastIndexOf('@');
    if (at !== -1) { const q = v.slice(0,cur).slice(at+1); if (!q.includes(' ')) { setMQuery(q); setMOpen(true); return; } }
    setMOpen(false); setMQuery('');
  };
  const pickMention = (m: Member) => {
    const cur = msgRef.current?.selectionStart ?? msg.length;
    const at = msg.slice(0,cur).lastIndexOf('@');
    setMsg(msg.slice(0,at)+`@${m.name} `+msg.slice(cur));
    if (m.user_id) setMIds(p=>[...new Set([...p,m.user_id!])]);
    setMOpen(false); setMQuery(''); msgRef.current?.focus();
  };
  const renderMsg = (text: string) => text.split(/(@\S+)/g).map((p,i) =>
    p.startsWith('@')
      ? <span key={i} style={{padding:'1px 5px',borderRadius:4,background:`${ch.accent}1a`,color:ch.accent,fontSize:12,fontWeight:600}}>{p}</span>
      : <span key={i}>{p}</span>);

  const canDel  = (m: Msg)      => isMgr || (!!userId && m.user_id===userId);
  const canDelR = (r: Resource) => isMgr || (!!userId && r.uploaded_by===userId);

  /* ── activity feed (derived from board data) ──────────────────────────── */
  const activityFeed = useMemo(() => {
    const items: {id:string; type:string; actor:string; detail:string; time?:string; icon:string; color:string}[] = [];
    (board?.comments??[]).slice(-20).reverse().forEach(m => {
      const p = parsePost(m.message);
      if (p) {
        items.push({id:cid(m),type:'post',actor:m.user_name,detail:`posted a ${p.type}: "${p.title}"`,time:m.created_at,icon:POST_CFG[p.type].icon,color:POST_CFG[p.type].color});
      } else if (isReply(m.message)) {
        items.push({id:cid(m),type:'reply',actor:m.user_name,detail:'replied to a post',time:m.created_at,icon:'↩',color:'#6366f1'});
      } else if ((m.attachments??[]).length>0) {
        items.push({id:cid(m),type:'file',actor:m.user_name,detail:`shared ${m.attachments!.length} file(s)`,time:m.created_at,icon:'📎',color:'#8b5cf6'});
      } else {
        items.push({id:cid(m),type:'msg',actor:m.user_name,detail:m.message.slice(0,50),time:m.created_at,icon:'💬',color:'#64748b'});
      }
    });
    (board?.resources??[]).slice(-5).reverse().forEach(r => {
      items.push({id:rid(r),type:'upload',actor:r.uploader_name??r.uploaded_by,detail:`uploaded "${r.file_name}"`,time:r.created_at,icon:'📄',color:'#10b981'});
    });
    return items.sort((a,b) => new Date(b.time??0).getTime() - new Date(a.time??0).getTime()).slice(0,12);
  }, [board]);

  /* ── loading / error ──────────────────────────────────────────────────── */
  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:T(isDark).muted,fontFamily:'"Inter",-apple-system,sans-serif'}}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{animation:'spin 1s linear infinite'}} className="animate-spin"><circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path opacity=".75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
      <span style={{fontSize:13}}>Loading channel…</span>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{display:'flex',flex:1,flexDirection:'column',overflow:'hidden',fontFamily:'"Inter",-apple-system,sans-serif',background:t.bg,height:'100%'}}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{height:54,display:'flex',alignItems:'center',gap:12,padding:'0 20px',borderBottom:`1px solid ${t.bord}`,background:t.surf,flexShrink:0,zIndex:10}}>
        <span style={{fontSize:22,fontWeight:900,color:ch.accent,fontFamily:'monospace'}}>#</span>
        <div>
          <div style={{fontSize:14,fontWeight:800,color:t.text,lineHeight:1.2}}>{ch.label}</div>
          <div style={{fontSize:10,color:t.muted}}>{(board?.members??[]).length} members · {onlineCount} online</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:20,background:`${ch.accent}14`,border:`1px solid ${ch.accent}22`}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#10b981'}} />
            <span style={{fontSize:11,fontWeight:600,color:ch.accent}}>{onlineCount} online</span>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>

        {/* ════════════════════════════════════════════════════════
            LEFT PANEL — Board / Tasks / Files / Members
        ════════════════════════════════════════════════════════ */}
        <div style={{width:310,flexShrink:0,borderRight:`1px solid ${t.bord}`,background:t.surf2,display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* tabs */}
          <div style={{display:'flex',borderBottom:`1px solid ${t.bord}`,flexShrink:0,background:t.surf}}>
            {([['board','Board'],['tasks','Tasks'],['files','Files'],['members','Members']] as const).map(([id,label])=>(
              <button key={id} type="button" onClick={()=>setLeftTab(id)}
                style={{flex:1,padding:'10px 4px',border:'none',background:'transparent',color:leftTab===id?ch.accent:t.muted,borderBottom:`2px solid ${leftTab===id?ch.accent:'transparent'}`,fontSize:11,fontWeight:leftTab===id?700:500,cursor:'pointer',fontFamily:'inherit',transition:'color .15s'}}>
                {label}
              </button>
            ))}
          </div>

          <div style={{flex:1,overflowY:'auto',scrollbarWidth:'thin',scrollbarColor:`${t.bord} transparent`}}>

            {/* ── BOARD TAB ──────────────────────────────────────── */}
            {leftTab === 'board' && (
              <div style={{display:'flex',flexDirection:'column',gap:0}}>

                {/* Announcements section */}
                <div style={{padding:'14px 14px 0'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{fontSize:15}}>📢</span>
                      <span style={{fontSize:12,fontWeight:700,color:t.text}}>Announcements</span>
                    </div>
                    {isMgr && (
                      <button type="button" onClick={()=>{setPType('announcement');setNewPostOpen(true);}}
                        style={{display:'flex',alignItems:'center',gap:3,padding:'3px 9px',borderRadius:6,border:`1px solid ${ch.accent}`,background:`${ch.accent}12`,color:ch.accent,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                        + New
                      </button>
                    )}
                  </div>

                  {/* announcement cards */}
                  {posts.filter(m=>parsePost(m.message)?.type==='announcement').length === 0 && (
                    <div style={{textAlign:'center',padding:'20px 0 10px',color:t.muted,fontSize:11}}>No announcements yet.</div>
                  )}
                  <div style={{display:'flex',flexDirection:'column',gap:8,paddingBottom:14}}>
                    {posts.filter(m=>parsePost(m.message)?.type==='announcement').map(m=>{
                      const post = parsePost(m.message)!;
                      const mid  = cid(m);
                      const replies = (board?.comments??[]).filter(x=>{ const r=parseReply(x.message,board?.comments??[]); return r&&r.original&&cid(r.original)===mid; });
                      return (
                        <div key={mid} style={{borderRadius:10,border:`1px solid ${t.bord}`,background:t.surf,overflow:'hidden'}}>
                          <div style={{height:3,background:ch.accent}} />
                          <div style={{padding:'10px 12px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                              <span style={{fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:20,background:`${ch.accent}18`,color:ch.accent,letterSpacing:'.04em'}}>📌 PINNED</span>
                              <span style={{fontSize:9,color:t.muted,marginLeft:'auto'}}>{rel(m.created_at)}</span>
                              {canDel(m) && <button type="button" onClick={()=>void deleteMsg(mid)} style={{fontSize:10,color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',opacity:.7}}>×</button>}
                            </div>
                            <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:post.body?5:0,lineHeight:1.3}}>{post.title}</div>
                            {post.body && <div style={{fontSize:11,color:t.sub,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{post.body}</div>}
                            {(m.attachments??[]).length>0 && (
                              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:6}}>
                                {(m.attachments??[]).map(att=>{
                                  const url = att.download_url?`${API}${att.download_url}`:undefined;
                                  return url?<a key={att.id??att.file_name} href={url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:5,border:`1px solid ${t.bord}`,background:t.surf2,fontSize:10,color:t.sub,textDecoration:'none'}}>📎 {att.file_name}</a>:null;
                                })}
                              </div>
                            )}
                            <div style={{display:'flex',alignItems:'center',gap:12,marginTop:8}}>
                              <span style={{fontSize:10,color:t.muted}}>{m.user_name} · {fmtTime(m.created_at)}</span>
                              <span style={{fontSize:10,color:t.muted,display:'flex',alignItems:'center',gap:3}}>
                                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                {Math.floor(Math.random()*50)+10}
                              </span>
                              <button type="button" onClick={()=>{setReplyTo(m);setTimeout(()=>msgRef.current?.focus(),50);}}
                                style={{marginLeft:'auto',fontSize:10,color:t.muted,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}
                                onMouseEnter={e=>(e.currentTarget.style.color=ch.accent)} onMouseLeave={e=>(e.currentTarget.style.color=t.muted)}>
                                ↩ Reply{replies.length>0?` (${replies.length})`:''}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{height:1,background:t.bord,margin:'0 14px'}} />

                {/* Channel Tasks */}
                <div style={{padding:'14px 14px 0'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{fontSize:15}}>📋</span>
                      <span style={{fontSize:12,fontWeight:700,color:t.text}}>Channel Tasks</span>
                    </div>
                    <button type="button" onClick={()=>setNewTaskOpen(true)}
                      style={{display:'flex',alignItems:'center',gap:3,padding:'3px 9px',borderRadius:6,border:`1px solid #10b981`,background:'rgba(16,185,129,.1)',color:'#10b981',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      + New Task
                    </button>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,paddingBottom:14}}>
                    {[...(board?.tasks??[]), ...posts.filter(m=>parsePost(m.message)?.type==='task').map(m=>({id:cid(m),title:parsePost(m.message)!.title,done:false,due:parsePost(m.message)!.body.replace('Due: ','').trim()}))].slice(0,5).map((task,i)=>(
                      <div key={task.id??i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:`1px solid ${t.bord}`,background:t.surf}}>
                        <div onClick={()=>task.id && toggleTask(task.id, task.done)} style={{width:14,height:14,borderRadius:3,border:`2px solid ${task.done?'#10b981':t.bord}`,background:task.done?'#10b981':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s'}}>
                          {task.done && <svg width="8" height="8" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:600,color:task.done?t.muted:t.sub,textDecoration:task.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.title}</div>
                        </div>
                        {(task as TaskEntry & {due?:string}).due && (task as TaskEntry & {due?:string}).due !== 'TBD' && (
                          <span style={{fontSize:9,color:t.muted,flexShrink:0}}>{(task as TaskEntry & {due?:string}).due}</span>
                        )}
                      </div>
                    ))}
                    {(board?.tasks??[]).length===0 && posts.filter(m=>parsePost(m.message)?.type==='task').length===0 && (
                      <div style={{textAlign:'center',padding:'16px 0',color:t.muted,fontSize:11}}>No tasks yet.</div>
                    )}
                    {(board?.tasks??[]).length > 5 && (
                      <button type="button" style={{fontSize:11,color:ch.accent,background:'none',border:'none',cursor:'pointer',textAlign:'left',fontFamily:'inherit',padding:'4px 0'}}>View all tasks →</button>
                    )}
                  </div>
                </div>

                <div style={{height:1,background:t.bord,margin:'0 14px'}} />

                {/* Quick Actions */}
                <div style={{padding:'14px'}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Quick Actions</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {label:'New Post',    color:'#6366f1', action:()=>{setPType('note');setNewPostOpen(true);}},
                      {label:'New Task',    color:'#10b981', action:()=>setNewTaskOpen(true)},
                      {label:'Upload File', color:'#3b82f6', action:()=>fileRef.current?.click()},
                      {label:'Announcement',color:'#f59e0b', action:()=>{setPType('announcement');setNewPostOpen(true);}},
                    ].map(a=>(
                      <button key={a.label} type="button" onClick={a.action}
                        style={{padding:'9px 6px',borderRadius:8,border:`1px solid ${a.color}22`,background:`${a.color}0f`,color:a.color,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background=`${a.color}22`}}
                        onMouseLeave={e=>{e.currentTarget.style.background=`${a.color}0f`}}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TASKS TAB ──────────────────────────────────────── */}
            {leftTab === 'tasks' && (
              <div style={{padding:14}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <span style={{fontSize:12,fontWeight:700,color:t.text}}>All Tasks · {(board?.tasks??[]).length}</span>
                  <button type="button" onClick={()=>setNewTaskOpen(true)} style={{fontSize:11,color:'#10b981',background:'rgba(16,185,129,.1)',border:'1px solid #10b981',borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:700,fontFamily:'inherit'}}>+ Task</button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {(board?.tasks??[]).map((task,i)=>(
                    <div key={task.id??i} style={{padding:'9px 12px',borderRadius:9,border:`1px solid ${t.bord}`,background:t.surf}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div onClick={()=>task.id && toggleTask(task.id, task.done)} style={{width:14,height:14,borderRadius:3,border:`2px solid ${task.done?'#10b981':t.bord}`,background:task.done?'#10b981':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s'}}>
                          {task.done&&<svg width="8" height="8" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span style={{fontSize:12,fontWeight:600,color:task.done?t.muted:t.text,flex:1,textDecoration:task.done?'line-through':'none'}}>{task.title}</span>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:task.done?'rgba(16,185,129,.12)':'rgba(99,102,241,.1)',color:task.done?'#10b981':'#6366f1',fontWeight:600}}>{task.done?'Done':'Open'}</span>
                      </div>
                    </div>
                  ))}
                  {(board?.tasks??[]).length===0 && <div style={{textAlign:'center',padding:'30px 0',color:t.muted,fontSize:12}}>No tasks in this channel.</div>}
                </div>
              </div>
            )}

            {/* ── FILES TAB ──────────────────────────────────────── */}
            {leftTab === 'files' && (
              <div style={{padding:14}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <span style={{fontSize:12,fontWeight:700,color:t.text}}>Files · {(board?.resources??[]).length}</span>
                  <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading}
                    style={{fontSize:11,color:'#3b82f6',background:'rgba(59,130,246,.1)',border:'1px solid #3b82f6',borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:700,fontFamily:'inherit'}}>
                    {uploading?'…':'+ Upload'}
                  </button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {(board?.resources??[]).map(res=>{
                    const url = res.download_url?`${API}${res.download_url}`:undefined;
                    const id = rid(res);
                    const ext = fileExt(res.file_name);
                    const col = fileColor(res.file_name);
                    return (
                      <div key={id||res.file_name} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,border:`1px solid ${t.bord}`,background:t.surf}}>
                        <div style={{width:32,height:32,borderRadius:6,background:`${col}18`,border:`1px solid ${col}28`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <span style={{fontSize:8,fontWeight:800,color:col}}>{ext}</span>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:600,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{res.file_name}</div>
                          <div style={{fontSize:10,color:t.muted}}>{res.uploader_name??res.uploaded_by} · {rel(res.created_at)}</div>
                        </div>
                        <div style={{display:'flex',gap:4,flexShrink:0}}>
                          {url && isImg(res.file_name) && (
                            <button type="button" onClick={()=>setPreviewUrl(`${API}${res.download_url}`)} style={{width:24,height:24,borderRadius:5,border:`1px solid ${t.bord}`,background:'transparent',color:t.muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>👁</button>
                          )}
                          {url && <a href={url} download target="_blank" rel="noreferrer" style={{width:24,height:24,borderRadius:5,border:`1px solid ${t.bord}`,background:'transparent',color:t.muted,display:'flex',alignItems:'center',justifyContent:'center',textDecoration:'none',fontSize:11}}>↓</a>}
                          {id&&canDelR(res)&&<button type="button" onClick={()=>void deleteRes(id)} disabled={delRes===id} style={{width:24,height:24,borderRadius:5,border:`1px solid ${t.bord}`,background:'transparent',color:'#ef4444',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:delRes===id?.5:1}}>×</button>}
                        </div>
                      </div>
                    );
                  })}
                  {(board?.resources??[]).length===0 && <div style={{textAlign:'center',padding:'30px 0',color:t.muted,fontSize:12}}>No files yet. Upload one!</div>}
                </div>
              </div>
            )}

            {/* ── MEMBERS TAB ────────────────────────────────────── */}
            {leftTab === 'members' && (
              <div style={{padding:14}}>
                <div style={{fontSize:12,fontWeight:700,color:t.text,marginBottom:12}}>Members · {(board?.members??[]).length}</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {(board?.members??[]).map(m=>(
                    <div key={m.user_id??m.name} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,border:`1px solid ${t.bord}`,background:t.surf}}>
                      <Av name={m.name} size={32} online={m.online} />
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:t.text}}>{m.name}</div>
                        <div style={{fontSize:10,color:t.muted,textTransform:'capitalize'}}>{m.role.replace(/_/g,' ')}</div>
                      </div>
                      <div style={{width:8,height:8,borderRadius:'50%',background:m.online?'#10b981':'#475569',flexShrink:0}} />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            CENTER — Chat / Discussion
        ════════════════════════════════════════════════════════ */}
        <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden',minWidth:0}}>

          {/* error */}
          {err && <div style={{margin:'8px 16px 0',padding:'7px 10px',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.22)',borderRadius:8,fontSize:11,color:'#ef4444',flexShrink:0}}>{err}</div>}

          {/* messages */}
          <div ref={feedRef} style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:0,scrollbarWidth:'thin',scrollbarColor:`${t.bord} transparent`}}>

            {filteredChat.length===0 && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,gap:12,color:t.muted,paddingTop:40}}>
                <div style={{fontSize:40}}>{ch.icon}</div>
                <div style={{fontSize:14,fontWeight:700,color:t.sub}}>Welcome to #{ch.label}</div>
                <div style={{fontSize:12,color:t.muted,textAlign:'center',maxWidth:300}}>{ch.desc}</div>
              </div>
            )}

            {filteredChat.map((m, i)=>{
              const all = board?.comments??[];
              const prev = i>0?filteredChat[i-1]:null;
              const grouped = !!prev && prev.user_id===m.user_id && Math.abs(new Date(m.created_at??'').getTime()-new Date(prev.created_at??'').getTime())<5*60000;
              const isOwn = m.user_id===userId;
              const mid = cid(m);
              const replyData = isReply(m.message)?parseReply(m.message,all):null;
              const msgReactions = getMsgReactions(mid);
              const activeReactions = msgReactions.filter(r=>r.count>0);
              const replies = all.filter(x=>{ const r=parseReply(x.message,all); return r&&r.original&&cid(r.original)===mid&&!isPost(m.message); });
              const showReplies = expanded[mid];

              return (
                <div key={mid} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'3px 6px',borderRadius:8,marginBottom:grouped?0:6,position:'relative',transition:'background .12s'}}
                  onMouseEnter={e=>(e.currentTarget.style.background=t.hover)}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>

                  {/* avatar or spacer */}
                  {!grouped ? <Av name={m.user_name} size={34} /> : <div style={{width:34,flexShrink:0}} />}

                  <div style={{flex:1,minWidth:0}}>
                    {/* name + time */}
                    {!grouped && (
                      <div style={{display:'flex',alignItems:'baseline',gap:7,marginBottom:2}}>
                        <span style={{fontSize:13,fontWeight:700,color:isOwn?ch.accent:t.text}}>{m.user_name}</span>
                        <span style={{fontSize:10,color:t.muted}}>{fmtTime(m.created_at)} · {rel(m.created_at)}</span>
                        {canDel(m) && (
                          <button type="button" onClick={()=>void deleteMsg(mid)} disabled={delMsg===mid} style={{marginLeft:'auto',fontSize:10,color:'#ef4444',background:'none',border:'none',cursor:'pointer',opacity:delMsg===mid?.4:.6,fontFamily:'inherit'}}>
                            delete
                          </button>
                        )}
                        <button type="button" style={{fontSize:11,color:t.muted,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',opacity:.5}} onClick={()=>{}}>⋯</button>
                      </div>
                    )}

                    {/* reply context */}
                    {replyData && (
                      <div style={{marginBottom:4,padding:'4px 8px',borderLeft:`2px solid ${ch.accent}`,background:`${ch.accent}09`,borderRadius:'0 5px 5px 0',fontSize:11,color:t.muted,cursor:'pointer'}}
                        onClick={()=>{ const id=replyData.original?cid(replyData.original):''; if(id){document.getElementById(`msg-${id}`)?.scrollIntoView({behavior:'smooth',block:'center'});} }}>
                        <span style={{fontWeight:600,color:ch.accent}}>↩ {replyData.original?.user_name??'Unknown'}</span>: {' '}
                        {(replyData.original?.message??'').slice(0,80)}
                      </div>
                    )}

                    {/* message text */}
                    <div id={`msg-${mid}`} style={{fontSize:13,color:t.sub,lineHeight:1.65,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>
                      {renderMsg(replyData?replyData.text:m.message)}
                    </div>

                    {/* file attachments */}
                    {(m.attachments??[]).length>0 && (
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
                        {(m.attachments??[]).map(att=>{
                          const url = att.download_url?`${API}${att.download_url}`:undefined;
                          const col = fileColor(att.file_name);
                          const img = isImg(att.file_name);
                          return (
                            <div key={att.id??att.file_name} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:`1px solid ${t.bord}`,background:t.surf2}}>
                              <div style={{width:28,height:28,borderRadius:5,background:`${col}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:col,flexShrink:0}}>{fileExt(att.file_name)}</div>
                              <div>
                                <div style={{fontSize:11,fontWeight:600,color:t.text}}>{att.file_name}</div>
                                {fmtSize(att.size) && <div style={{fontSize:9,color:t.muted}}>{fmtSize(att.size)}</div>}
                              </div>
                              <div style={{display:'flex',gap:4,marginLeft:8}}>
                                {img&&url&&<button type="button" onClick={()=>setPreviewUrl(url)} style={{fontSize:11,background:`${col}14`,border:`1px solid ${col}22`,color:col,borderRadius:4,cursor:'pointer',padding:'2px 6px',fontFamily:'inherit'}}>Preview</button>}
                                {url&&<a href={url} download target="_blank" rel="noreferrer" style={{fontSize:11,background:t.surf3,border:`1px solid ${t.bord}`,color:t.sub,borderRadius:4,padding:'2px 6px',textDecoration:'none',fontWeight:500}}>↓ Download</a>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* reactions row */}
                    {activeReactions.length>0 && (
                      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:5}}>
                        {activeReactions.map(r=>(
                          <button key={r.emoji} type="button" onClick={()=>toggleReaction(mid,r.emoji)}
                            style={{display:'flex',alignItems:'center',gap:3,padding:'2px 8px',borderRadius:20,border:`1px solid ${r.mine?ch.accent:t.bord}`,background:r.mine?`${ch.accent}14`:t.surf2,cursor:'pointer',fontSize:12,color:r.mine?ch.accent:t.sub,fontWeight:r.mine?700:400}}>
                            {r.emoji} <span style={{fontSize:11}}>{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* action bar */}
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                      {/* reply */}
                      <button type="button" onClick={()=>{setReplyTo(m);setTimeout(()=>msgRef.current?.focus(),50);}}
                        style={{fontSize:11,color:t.muted,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:500,display:'flex',alignItems:'center',gap:3}}
                        onMouseEnter={e=>(e.currentTarget.style.color=ch.accent)} onMouseLeave={e=>(e.currentTarget.style.color=t.muted)}>
                        ↩ Reply
                      </button>
                      {/* add reaction */}
                      <div style={{position:'relative'}}>
                        <button type="button" onClick={()=>setShowPicker(showPicker===mid?null:mid)}
                          style={{fontSize:12,color:t.muted,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}
                          onMouseEnter={e=>(e.currentTarget.style.color=t.sub)} onMouseLeave={e=>(e.currentTarget.style.color=t.muted)}>
                          😊 +
                        </button>
                        {showPicker===mid && (
                          <div style={{position:'absolute',bottom:'100%',left:0,background:t.surf,border:`1px solid ${t.bord}`,borderRadius:10,padding:'6px 8px',display:'flex',gap:4,boxShadow:'0 8px 24px rgba(0,0,0,.25)',zIndex:50,marginBottom:4}}>
                            {REACTIONS.map(e=>(
                              <button key={e} type="button" onClick={()=>toggleReaction(mid,e)}
                                style={{fontSize:16,background:'transparent',border:'none',cursor:'pointer',borderRadius:6,padding:'3px',transition:'transform .1s'}}
                                onMouseEnter={ev=>(ev.currentTarget.style.transform='scale(1.3)')} onMouseLeave={ev=>(ev.currentTarget.style.transform='scale(1)')}>
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* view replies */}
                      {replies.length>0 && (
                        <button type="button" onClick={()=>setExpanded(p=>({...p,[mid]:!p[mid]}))}
                          style={{fontSize:11,color:ch.accent,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>
                          {showReplies?'Hide':'View'} {replies.length} {replies.length===1?'reply':'replies'}
                        </button>
                      )}
                    </div>

                    {/* inline thread replies */}
                    {showReplies && replies.length>0 && (
                      <div style={{marginTop:8,paddingLeft:12,borderLeft:`2px solid ${t.bord}`,display:'flex',flexDirection:'column',gap:6}}>
                        {replies.map(rx=>{
                          const rd = parseReply(rx.message, board?.comments??[]);
                          return (
                            <div key={cid(rx)} style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                              <Av name={rx.user_name} size={22} />
                              <div style={{flex:1}}>
                                <span style={{fontSize:11,fontWeight:700,color:t.text}}>{rx.user_name}</span>
                                <span style={{fontSize:9,color:t.muted,marginLeft:6}}>{rel(rx.created_at)}</span>
                                <div style={{fontSize:12,color:t.sub,marginTop:2}}>{renderMsg(rd?rd.text:rx.message)}</div>
                              </div>
                              {canDel(rx)&&<button type="button" onClick={()=>void deleteMsg(cid(rx))} style={{fontSize:10,color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>×</button>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Message Input ─────────────────────────────────────────── */}
          <div style={{padding:'10px 14px 14px',borderTop:`1px solid ${t.bord}`,background:t.surf,flexShrink:0}}>
            {/* reply strip */}
            {replyTo && (
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'5px 10px',borderRadius:8,background:`${ch.accent}0d`,border:`1px solid ${ch.accent}22`}}>
                <span style={{fontSize:11,color:ch.accent}}>↩ Replying to <strong>{replyTo.user_name}</strong>: {(isPost(replyTo.message)?parsePost(replyTo.message)?.title:replyTo.message)?.slice(0,60)}</span>
                <button type="button" onClick={()=>setReplyTo(null)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:t.muted,fontSize:18,lineHeight:1}}>×</button>
              </div>
            )}
            {/* attached files */}
            {chatFiles.length>0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                {chatFiles.map((f,i)=>(
                  <span key={`${f.name}-${i}`} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:5,background:`${ch.accent}0d`,border:`1px solid ${ch.accent}22`,fontSize:11,color:ch.accent}}>
                    {f.name}
                    <button type="button" onClick={()=>setChatFiles(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:ch.accent,fontSize:14,lineHeight:1}}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{position:'relative'}}>
              {/* @mention dropdown */}
              {mOpen&&filteredM.length>0 && (
                <div style={{position:'absolute',bottom:'100%',marginBottom:4,left:0,width:220,background:t.surf,border:`1px solid ${t.bord}`,borderRadius:10,overflow:'hidden',boxShadow:'0 8px 24px rgba(0,0,0,.2)',zIndex:50}}>
                  {filteredM.map(m=>(
                    <button key={m.user_id??m.name} type="button" onMouseDown={e=>{e.preventDefault();pickMention(m);}}
                      style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'8px 12px',border:'none',background:'transparent',cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}
                      onMouseEnter={e=>(e.currentTarget.style.background=t.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <Av name={m.name} size={22} />
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:t.text}}>{m.name}</div>
                        <div style={{fontSize:10,color:t.muted,textTransform:'capitalize'}}>{m.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',gap:8,background:t.surf2,border:`1.5px solid ${t.inbd}`,borderRadius:12,padding:'0 12px',transition:'border-color .15s'}}
                onFocusCapture={e=>(e.currentTarget.style.borderColor=ch.accent)} onBlurCapture={e=>(e.currentTarget.style.borderColor=t.inbd)}>
                <input ref={msgRef} type="text" value={msg} onChange={handleMsgChange}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!mOpen){e.preventDefault();void sendChat();}if(e.key==='Escape'){setMOpen(false);setReplyTo(null);}}}
                  onBlur={()=>setTimeout(()=>setMOpen(false),150)}
                  placeholder={`Message #${ch.label}… @ to mention, / for commands`} disabled={posting}
                  style={{flex:1,padding:'11px 0',background:'transparent',border:'none',outline:'none',color:t.text,fontSize:13,fontFamily:'inherit'}} />
                <input ref={attachRef} type="file" multiple style={{display:'none'}} onChange={e=>{if(e.target.files)setChatFiles(p=>[...p,...Array.from(e.target.files!)]);}} />
                <button type="button" onClick={()=>attachRef.current?.click()} title="Attach file" style={{background:'none',border:'none',cursor:'pointer',color:t.muted,padding:'4px',lineHeight:1,fontSize:16}}>📎</button>
                <button type="button" title="Emoji" style={{background:'none',border:'none',cursor:'pointer',color:t.muted,padding:'4px',lineHeight:1,fontSize:16}}>😊</button>
                <button type="button" title="Mention" onClick={()=>setMsg(p=>p+'@')} style={{background:'none',border:'none',cursor:'pointer',color:t.muted,padding:'4px',lineHeight:1,fontSize:15,fontWeight:700,fontFamily:'monospace'}}>@</button>
                <button type="button" onClick={()=>void sendChat()} disabled={posting||(!msg.trim()&&chatFiles.length===0)}
                  style={{width:32,height:32,borderRadius:9,border:'none',background:posting||(!msg.trim()&&chatFiles.length===0)?`${ch.accent}55`:ch.accent,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14,transition:'all .15s'}}>
                  →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            RIGHT PANEL — Channel Overview / Files / Members / Activity
        ════════════════════════════════════════════════════════ */}
        <div style={{width:270,flexShrink:0,borderLeft:`1px solid ${t.bord}`,background:t.surf2,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{flex:1,overflowY:'auto',scrollbarWidth:'thin',scrollbarColor:`${t.bord} transparent`}}>

            {/* Channel Overview */}
            <div style={{padding:'16px 14px',borderBottom:`1px solid ${t.bord}`}}>
              <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:12}}>Channel Overview</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:0}}>
                {[
                  {icon:'👥',val:(board?.members??[]).length,label:'Members',color:'#6366f1'},
                  {icon:'🟢',val:onlineCount,label:'Online',color:'#10b981'},
                  {icon:'📋',val:(board?.tasks??[]).length,label:'Tasks',color:'#f59e0b'},
                  {icon:'📄',val:(board?.resources??[]).length,label:'Files',color:'#3b82f6'},
                ].map(s=>(
                  <div key={s.label} style={{padding:'10px 10px',borderRadius:9,border:`1px solid ${t.bord}`,background:t.surf,display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:30,height:30,borderRadius:7,background:`${s.color}14`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{s.icon}</div>
                    <div>
                      <div style={{fontSize:17,fontWeight:800,color:t.text,lineHeight:1}}>{s.val}</div>
                      <div style={{fontSize:10,color:t.muted}}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Files */}
            <div style={{padding:'14px 14px',borderBottom:`1px solid ${t.bord}`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:t.text}}>Recent Files</span>
                <button type="button" onClick={()=>fileRef.current?.click()} style={{fontSize:11,color:ch.accent,background:'none',border:'none',cursor:'pointer',fontWeight:700,fontFamily:'inherit'}}>+ Add</button>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {(board?.resources??[]).slice(0,4).map(res=>{
                  const url = res.download_url?`${API}${res.download_url}`:undefined;
                  const col = fileColor(res.file_name);
                  return (
                    <div key={rid(res)||res.file_name} style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:30,height:30,borderRadius:6,background:`${col}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:col,flexShrink:0}}>{fileExt(res.file_name)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        {url?<a href={url} target="_blank" rel="noreferrer" style={{fontSize:11,color:t.sub,textDecoration:'none',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{res.file_name}</a>
                        :<span style={{fontSize:11,color:t.muted,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{res.file_name}</span>}
                        <span style={{fontSize:9,color:t.muted}}>{res.uploader_name??res.uploaded_by}</span>
                      </div>
                      {rid(res)&&canDelR(res)&&<button type="button" onClick={()=>void deleteRes(rid(res))} style={{fontSize:11,color:t.muted,background:'none',border:'none',cursor:'pointer'}}
                        onMouseEnter={e=>(e.currentTarget.style.color='#ef4444')} onMouseLeave={e=>(e.currentTarget.style.color=t.muted)}>×</button>}
                    </div>
                  );
                })}
                {(board?.resources??[]).length===0&&<div style={{fontSize:11,color:t.muted,textAlign:'center',padding:'8px 0'}}>No files yet.</div>}
                {(board?.resources??[]).length>4&&<button type="button" onClick={()=>setLeftTab('files')} style={{fontSize:11,color:ch.accent,background:'none',border:'none',cursor:'pointer',textAlign:'left',fontFamily:'inherit',padding:'2px 0'}}>View all files →</button>}
              </div>
            </div>

            {/* Active Members */}
            <div style={{padding:'14px 14px',borderBottom:`1px solid ${t.bord}`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:t.text}}>Active Members</span>
                <button type="button" onClick={()=>setLeftTab('members')} style={{fontSize:11,color:ch.accent,background:'none',border:'none',cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>View all</button>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:0}}>
                {(board?.members??[]).slice(0,8).map((m,i)=>(
                  <div key={m.user_id??m.name} title={m.name} style={{marginLeft:i>0?-6:0,zIndex:8-i}}>
                    <Av name={m.name} size={32} online={m.online} />
                  </div>
                ))}
                {(board?.members??[]).length>8&&<div style={{width:32,height:32,borderRadius:'50%',background:t.surf3,border:`2px solid ${t.surf2}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:t.muted,marginLeft:-6}}>+{(board?.members??[]).length-8}</div>}
              </div>
            </div>

            {/* Channel Activity */}
            <div style={{padding:'14px 14px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:t.text}}>Channel Activity</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {activityFeed.slice(0,6).map((a,i)=>(
                  <div key={`${a.id}-${i}`} style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                    <div style={{width:26,height:26,borderRadius:6,background:`${a.color}14`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{a.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:t.sub,lineHeight:1.45}}>
                        <strong style={{color:t.text}}>{a.actor}</strong> {a.detail}
                      </div>
                      <div style={{fontSize:10,color:t.muted,marginTop:1}}>{rel(a.time)}</div>
                    </div>
                  </div>
                ))}
                {activityFeed.length===0&&<div style={{fontSize:11,color:t.muted,textAlign:'center',padding:'12px 0'}}>No activity yet.</div>}
              </div>
            </div>

          </div>
        </div>

        {/* ── New Post Modal ──────────────────────────────────────────────── */}
        {newPostOpen && (
          <div style={{position:'absolute',inset:0,zIndex:60,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setNewPostOpen(false)}>
            <div style={{width:500,borderRadius:16,background:t.surf,border:`1px solid ${t.bord}`,boxShadow:'0 24px 64px rgba(0,0,0,.4)',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:'14px 18px',borderBottom:`1px solid ${t.bord}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:`${ch.accent}08`}}>
                <div style={{fontSize:14,fontWeight:700,color:t.text}}>📌 New Board Post</div>
                <button type="button" onClick={()=>setNewPostOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:t.muted,fontSize:20,lineHeight:1}}>×</button>
              </div>
              <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:12}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Type</div>
                  <div style={{display:'flex',gap:7}}>
                    {(Object.entries(POST_CFG) as [typeof pType, typeof POST_CFG[typeof pType]][]).map(([k,v])=>(
                      <button key={k} type="button" onClick={()=>setPType(k)}
                        style={{flex:1,padding:'7px 0',borderRadius:8,border:`2px solid ${pType===k?v.color:t.bord}`,background:pType===k?v.bg:'transparent',color:pType===k?v.color:t.muted,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
                        {v.icon} {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Title <span style={{color:'#ef4444'}}>*</span></div>
                  <input value={pTitle} onChange={e=>setPTitle(e.target.value)} placeholder="Enter a title…"
                    style={{width:'100%',padding:'9px 11px',borderRadius:8,border:`1px solid ${t.inbd}`,background:t.surf2,color:t.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
                    onFocus={e=>(e.currentTarget.style.borderColor=ch.accent)} onBlur={e=>(e.currentTarget.style.borderColor=t.inbd)} />
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Body</div>
                  <textarea value={pBody} onChange={e=>setPBody(e.target.value)} rows={4} placeholder="Add details, links, or instructions…"
                    style={{width:'100%',padding:'9px 11px',borderRadius:8,border:`1px solid ${t.inbd}`,background:t.surf2,color:t.text,fontSize:13,outline:'none',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}}
                    onFocus={e=>(e.currentTarget.style.borderColor=ch.accent)} onBlur={e=>(e.currentTarget.style.borderColor=t.inbd)} />
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Attachments</div>
                  <input ref={pFileRef} type="file" multiple style={{display:'none'}} onChange={e=>{if(e.target.files)setPFiles(p=>[...p,...Array.from(e.target.files!)]);}} />
                  <button type="button" onClick={()=>pFileRef.current?.click()} style={{padding:'5px 12px',borderRadius:6,border:`1px dashed ${t.bord}`,background:'transparent',color:t.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>📎 Attach files</button>
                  {pFiles.length>0 && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:6}}>
                      {pFiles.map((f,i)=>(
                        <span key={i} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:5,background:`${ch.accent}0d`,border:`1px solid ${ch.accent}22`,fontSize:10,color:ch.accent}}>
                          {f.name}<button type="button" onClick={()=>setPFiles(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:ch.accent,fontSize:13,lineHeight:1}}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{padding:'10px 18px',borderTop:`1px solid ${t.bord}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button type="button" onClick={()=>setNewPostOpen(false)} style={{padding:'7px 16px',borderRadius:8,border:`1px solid ${t.bord}`,background:'transparent',color:t.muted,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button type="button" onClick={()=>void sendPost()} disabled={posting||!pTitle.trim()}
                  style={{padding:'7px 18px',borderRadius:8,border:'none',background:posting||!pTitle.trim()?`${ch.accent}55`:ch.accent,color:'#fff',fontSize:12,fontWeight:700,cursor:posting||!pTitle.trim()?'not-allowed':'pointer',fontFamily:'inherit'}}>
                  {posting?'Posting…':'Publish Post'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── New Task Modal ──────────────────────────────────────────────── */}
        {newTaskOpen && (
          <div style={{position:'absolute',inset:0,zIndex:60,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setNewTaskOpen(false)}>
            <div style={{width:420,borderRadius:14,background:t.surf,border:`1px solid ${t.bord}`,boxShadow:'0 20px 50px rgba(0,0,0,.35)'}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:'13px 18px',borderBottom:`1px solid ${t.bord}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(16,185,129,.06)'}}>
                <div style={{fontSize:14,fontWeight:700,color:t.text}}>📋 New Channel Task</div>
                <button type="button" onClick={()=>setNewTaskOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:t.muted,fontSize:20}}>×</button>
              </div>
              <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:12}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Task Title <span style={{color:'#ef4444'}}>*</span></div>
                  <input value={tTitle} onChange={e=>setTTitle(e.target.value)} placeholder="What needs to be done?"
                    style={{width:'100%',padding:'9px 11px',borderRadius:8,border:`1px solid ${t.inbd}`,background:t.surf2,color:t.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
                    onFocus={e=>(e.currentTarget.style.borderColor='#10b981')} onBlur={e=>(e.currentTarget.style.borderColor=t.inbd)} />
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Due Date</div>
                  <input type="date" value={tDue} onChange={e=>setTDue(e.target.value)}
                    style={{width:'100%',padding:'9px 11px',borderRadius:8,border:`1px solid ${t.inbd}`,background:t.surf2,color:t.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
                    onFocus={e=>(e.currentTarget.style.borderColor='#10b981')} onBlur={e=>(e.currentTarget.style.borderColor=t.inbd)} />
                </div>
              </div>
              <div style={{padding:'10px 18px',borderTop:`1px solid ${t.bord}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button type="button" onClick={()=>setNewTaskOpen(false)} style={{padding:'7px 16px',borderRadius:8,border:`1px solid ${t.bord}`,background:'transparent',color:t.muted,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button type="button" onClick={()=>void createTask()} disabled={savingTask||!tTitle.trim()}
                  style={{padding:'7px 18px',borderRadius:8,border:'none',background:savingTask||!tTitle.trim()?'rgba(16,185,129,.4)':'#10b981',color:'#fff',fontSize:12,fontWeight:700,cursor:savingTask||!tTitle.trim()?'not-allowed':'pointer',fontFamily:'inherit'}}>
                  {savingTask?'Saving…':'Create Task'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Image Preview Lightbox ──────────────────────────────────────── */}
        {previewUrl && (
          <div onClick={()=>setPreviewUrl(null)} style={{position:'absolute',inset:0,zIndex:70,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out',backdropFilter:'blur(4px)'}}>
            <img src={previewUrl} alt="preview" style={{maxWidth:'85vw',maxHeight:'80vh',borderRadius:10,boxShadow:'0 24px 64px rgba(0,0,0,.6)'}} />
          </div>
        )}

      </div>

      {/* hidden file inputs */}
      <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadFile(f);}} />

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Page wrapper
══════════════════════════════════════════════════════════════════════════ */
export default function TaskFlowDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const channelId = params.get('projectId') ?? '';

  useEffect(() => {
    if (channelId && !CH[channelId]) {
      navigate(`/workspace?projectId=${channelId}`, { replace: true });
    }
  }, [channelId, navigate]);

  if (!channelId || !CH[channelId]) return null;

  return (
    <div className="flex min-h-screen" style={{ overflow: 'hidden', height: '100vh' }}>
      <Sidebar />
      <div className="flex-1 transition-[margin] duration-200" style={{ marginLeft: 'var(--sidebar-width, 88px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <ChannelPage channelId={channelId} />
      </div>
    </div>
  );
}
