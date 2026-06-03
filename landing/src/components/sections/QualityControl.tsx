'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────
const SCORE   = 92;
const MAIN_R  = 80;
const MAIN_C  = 2 * Math.PI * MAIN_R;
const MAIN_OFF = MAIN_C * (1 - SCORE / 100);

const METRIC_RINGS = [
  { label: 'Structure',    value: 94, color: '#10b981', r: 61, w: 6 },
  { label: 'Content',      value: 89, color: '#1a6fff', r: 47, w: 6 },
  { label: 'Completeness', value: 78, color: '#8b5cf6', r: 33, w: 6 },
  { label: 'Formatting',   value: 95, color: '#f59e0b', r: 19, w: 5 },
];

const STANDARDS = [
  { label: 'Documentation',      pass: true  },
  { label: 'Learning Outcomes',  pass: true  },
  { label: 'Format & Structure', pass: true  },
  { label: 'Data Accuracy',      pass: true  },
  { label: 'Section Compliance', pass: true  },
  { label: 'Assessment Evidence',pass: false },
  { label: 'PLO Alignment',      pass: true  },
  { label: 'Executive Summary',  pass: true  },
  { label: 'References Format',  pass: true  },
  { label: 'Course Spec',        pass: true  },
  { label: 'Program Spec',       pass: true  },
  { label: 'Survey Analysis',    pass: false },
];

const AI_LINES = [
  { d: 0.2,  text: '> Initializing Orbit AI v2.5...',           c: '#8b5cf6' },
  { d: 0.9,  text: '> Loading: NCAAA Accreditation 2024',        c: '#475569' },
  { d: 1.5,  text: '> Document scanned — 48 pages',              c: '#475569' },
  { d: 2.1,  text: '> Structure check........... PASS ✓',        c: '#10b981' },
  { d: 2.7,  text: '> Learning outcomes........  PASS ✓',        c: '#10b981' },
  { d: 3.3,  text: '> Evidence validation........ PARTIAL ⚠',   c: '#f59e0b' },
  { d: 3.9,  text: '> Final score: 92 / 100',                    c: '#1a6fff' },
  { d: 4.3,  text: '> ── STATUS: APPROVED FOR SUBMISSION ──',    c: '#10b981' },
];

const RECS = [
  { p: 'HIGH', c: '#ef4444', text: 'Attach 2 cycles of assessment evidence', gain: '+8%' },
  { p: 'MED',  c: '#f59e0b', text: 'Expand PLO mapping in section 3.2',     gain: '+3%' },
  { p: 'OK',   c: '#10b981', text: '47 / 48 accreditation standards met',   gain: null  },
];

// ── Corner brackets (sci-fi HUD element) ──────────────────────────────────
function HudCorners({ color = 'rgba(245,158,11,0.5)' }: { color?: string }) {
  const b = `border-[1.5px]`;
  const s = 'absolute w-3 h-3 pointer-events-none';
  return (
    <>
      <span aria-hidden className={`${s} ${b} top-0 left-0 border-r-0 border-b-0`} style={{ borderColor: color }} />
      <span aria-hidden className={`${s} ${b} top-0 right-0 border-l-0 border-b-0`} style={{ borderColor: color }} />
      <span aria-hidden className={`${s} ${b} bottom-0 left-0 border-r-0 border-t-0`} style={{ borderColor: color }} />
      <span aria-hidden className={`${s} ${b} bottom-0 right-0 border-l-0 border-t-0`} style={{ borderColor: color }} />
    </>
  );
}

// ── Pulse dot ──────────────────────────────────────────────────────────────
function PulseDot({ color = '#f59e0b' }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <motion.span
        animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        className="absolute inline-flex h-full w-full rounded-full"
        style={{ background: color }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

// ── AI Core: the central animated visual ──────────────────────────────────
function AICore({ isInView }: { isInView: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const dur = 2200;
    const t0  = performance.now();
    const f   = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setCount(Math.round(p * SCORE));
      if (p < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }, [isInView]);

  const RINGS = [
    { sz: 280, dur: 32, rev: false, c: 'rgba(245,158,11,0.10)' },
    { sz: 220, dur: 22, rev: true,  c: 'rgba(26,111,255,0.14)'  },
    { sz: 165, dur: 16, rev: false, c: 'rgba(245,158,11,0.18)' },
    { sz: 118, dur: 11, rev: true,  c: 'rgba(139,92,246,0.22)'  },
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 310, height: 310 }}>
      {/* Background glow */}
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 65%)',
      }} />

      {/* Orbit rings */}
      {RINGS.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: r.sz, height: r.sz,
            top: '50%', left: '50%',
            border: `1px solid ${r.c}`,
            animation: `hub-orbit ${r.dur}s linear infinite${r.rev ? ' reverse' : ''}`,
          }}
        >
          <div
            className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
            style={{
              background: i % 2 === 0 ? '#f59e0b' : '#1a6fff',
              boxShadow: `0 0 10px ${i % 2 === 0 ? '#f59e0b' : '#1a6fff'}`,
            }}
          />
        </div>
      ))}

      {/* Central score ring */}
      <div className="relative z-10" style={{ width: 100, height: 100 }}>
        <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <filter id="coreGlow">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx="55" cy="55" r="48" fill="none" stroke="rgba(245,158,11,0.12)" strokeWidth="7" />
          <motion.circle
            cx="55" cy="55" r="48"
            fill="none" stroke="url(#coreGrad)" strokeWidth="7" strokeLinecap="round"
            filter="url(#coreGlow)"
            initial={{ strokeDasharray: 301, strokeDashoffset: 301 }}
            animate={isInView ? { strokeDashoffset: 301 * (1 - SCORE / 100) } : {}}
            transition={{ duration: 2.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[26px] font-black text-white leading-none">{count}%</span>
          <span className="text-[8px] font-black tracking-[0.18em] text-amber-400/80 uppercase mt-0.5">PASS</span>
        </div>
      </div>
    </div>
  );
}

// ── Main score rings + nested metrics ─────────────────────────────────────
function ScoreRings({ isInView }: { isInView: boolean }) {
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Big ring */}
      <div className="relative" style={{ width: 240, height: 240 }}>
        {/* Outer glow pulse */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.38, 0.15] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute rounded-full pointer-events-none"
          style={{ inset: '-14px', boxShadow: '0 0 50px rgba(245,158,11,0.25)' }}
        />
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#f59e0b" />
              <stop offset="55%"  stopColor="#fcd34d" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <filter id="mainGlow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx="100" cy="100" r={MAIN_R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          {/* Main ring */}
          <motion.circle
            cx="100" cy="100" r={MAIN_R}
            fill="none" stroke="url(#mainGrad)" strokeWidth="10" strokeLinecap="round"
            filter="url(#mainGlow)"
            initial={{ strokeDasharray: MAIN_C, strokeDashoffset: MAIN_C }}
            animate={isInView ? { strokeDashoffset: MAIN_OFF } : {}}
            transition={{ duration: 2.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Nested metric rings */}
          {METRIC_RINGS.map((m, i) => {
            const c   = 2 * Math.PI * m.r;
            const off = c * (1 - m.value / 100);
            return (
              <motion.circle
                key={i}
                cx="100" cy="100" r={m.r}
                fill="none" stroke={m.color} strokeWidth={m.w} strokeLinecap="round"
                initial={{ strokeDasharray: c, strokeDashoffset: c }}
                animate={isInView ? { strokeDashoffset: off } : {}}
                transition={{ duration: 2.0, delay: 0.7 + i * 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={{ opacity: 0.75 }}
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="font-display font-black text-white leading-none"
            style={{ fontSize: '52px' }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5 }}
          >
            {SCORE}
          </motion.span>
          <span className="text-[11px] font-black text-amber-400/90 tracking-[0.14em] uppercase mt-1">Quality Score</span>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: '0 0 6px #10b981' }} />
            <span className="text-[9px] text-green-400 font-bold tracking-widest uppercase">Approved</span>
          </div>
        </div>
      </div>

      {/* Metric legend */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 w-full max-w-[260px]">
        {METRIC_RINGS.map(m => (
          <div key={m.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
            <span className="text-[11px] text-slate-500 flex-1">{m.label}</span>
            <span className="text-[11px] font-black" style={{ color: m.color }}>{m.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI analysis terminal stream ────────────────────────────────────────────
function AIStream({ isInView }: { isInView: boolean }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    AI_LINES.forEach((l, i) => {
      ids.push(setTimeout(() => setN(i + 1), l.d * 1000));
    });
    return () => ids.forEach(clearTimeout);
  }, [isInView]);

  return (
    <div className="relative rounded-xl p-5 overflow-hidden" style={{
      background: 'rgba(0,0,0,0.65)',
      border: '1px solid rgba(245,158,11,0.18)',
    }}>
      <HudCorners color="rgba(245,158,11,0.55)" />

      {/* Terminal header */}
      <div className="flex items-center gap-2 mb-3.5 pb-3 border-b border-white/[0.05]">
        <PulseDot color="#f59e0b" />
        <span className="text-[10px] font-black text-amber-400/75 tracking-[0.18em] uppercase">
          Orbit AI — Live Analysis
        </span>
        <span className="ml-auto text-[9px] text-slate-700 font-mono">v2.5.1</span>
      </div>

      {/* Output lines */}
      <div className="font-mono text-[12px] leading-[1.85] space-y-px min-h-[168px]">
        {AI_LINES.slice(0, n).map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            style={{ color: l.c }}
          >
            {l.text}
            {i === n - 1 && n < AI_LINES.length && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.65, repeat: Infinity }}
                className="ml-0.5"
              >█</motion.span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Floating AI recommendations ────────────────────────────────────────────
function Recommendations({ isInView }: { isInView: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[10px] font-black text-slate-600 tracking-[0.16em] uppercase mb-0.5">
        AI Recommendations
      </div>
      {RECS.map((r, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 3.8 + i * 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center gap-3 px-4 py-3 rounded-xl overflow-hidden"
          style={{
            background: `${r.c}0d`,
            border: `1px solid ${r.c}28`,
          }}
        >
          <HudCorners color={`${r.c}45`} />
          <div
            className="w-1.5 h-6 rounded-full flex-shrink-0"
            style={{ background: r.c, boxShadow: `0 0 8px ${r.c}` }}
          />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: r.c }}>
              {r.p}
            </span>
            <p className="text-[12px] text-white/75 leading-snug mt-0.5">{r.text}</p>
          </div>
          {r.gain && (
            <span className="text-[13px] font-black flex-shrink-0" style={{ color: '#10b981' }}>
              {r.gain}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ── Compliance standards grid ──────────────────────────────────────────────
function StandardsGrid({ isInView }: { isInView: boolean }) {
  const passed = STANDARDS.filter(s => s.pass).length;

  return (
    <div className="relative rounded-2xl p-6 overflow-hidden" style={{
      background: 'rgba(255,255,255,0.018)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <HudCorners color="rgba(16,185,129,0.45)" />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <PulseDot color="#10b981" />
        <span className="text-[11px] font-black text-slate-400 tracking-[0.14em] uppercase">
          Accreditation Standards
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="font-display text-[22px] font-black" style={{ color: '#10b981' }}>{passed}</span>
          <span className="text-[13px] text-slate-600">/ {STANDARDS.length} Passed</span>
        </div>
      </div>

      {/* Compliance cells */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {STANDARDS.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.4 + i * 0.07, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl text-center cursor-default group"
            style={{
              background: s.pass ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              border:     `1px solid ${s.pass ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
            }}
          >
            <motion.div
              whileHover={{ scale: 1.15 }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-black"
              style={{
                background: s.pass ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                color: s.pass ? '#10b981' : '#ef4444',
                boxShadow: `0 0 10px ${s.pass ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}
            >
              {s.pass ? '✓' : '✗'}
            </motion.div>
            <span className="text-[10px] text-slate-400 leading-tight">{s.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────
export default function QualityControl() {
  const ref      = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="quality" ref={ref} className="relative py-24 overflow-hidden">
      {/* Amber atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(245,158,11,0.07) 0%, transparent 70%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 40% 35% at 80% 70%, rgba(16,185,129,0.04) 0%, transparent 60%)',
      }} />

      {/* HUD grid lines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.022,
        backgroundImage: `
          linear-gradient(rgba(245,158,11,1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(245,158,11,1) 1px, transparent 1px)
        `,
        backgroundSize: '52px 52px',
      }} />

      {/* Horizontal scan line */}
      <motion.div
        aria-hidden
        className="absolute left-0 right-0 h-px pointer-events-none z-[1]"
        style={{ background: 'linear-gradient(to right, transparent 5%, rgba(245,158,11,0.35) 40%, rgba(245,158,11,0.35) 60%, transparent 95%)' }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
      />

      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <PulseDot color="#f59e0b" />
            <span className="text-[11px] font-black text-amber-400 tracking-[0.16em] uppercase">AI Quality Core</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 22 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.85, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight leading-tight mb-4"
          >
            The AI That{' '}
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 45%, #10b981 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Never Misses
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="text-[16px] text-slate-400 max-w-lg mx-auto leading-relaxed"
          >
            Every submission analyzed against 48 accreditation standards in real-time.
            Score, flag, and recommend — automatically.
          </motion.p>
        </div>

        {/* ── 3-column command center ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Column 1 — AI Core */}
          <div className="relative flex flex-col items-center justify-center gap-4 p-6 rounded-2xl min-h-[400px]"
            style={{ background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)' }}>
            <HudCorners color="rgba(245,158,11,0.55)" />
            <div className="flex items-center gap-2">
              <PulseDot color="#f59e0b" />
              <span className="text-[10px] font-black text-amber-400/65 tracking-[0.2em] uppercase">AI Core — Active</span>
            </div>
            <AICore isInView={isInView} />
            <div className="grid grid-cols-3 gap-2 w-full mt-2">
              {[{ v: '142', l: 'Passed' }, { v: '23', l: 'Flagged' }, { v: '86%', l: 'Rate' }].map(s => (
                <div key={s.l} className="text-center p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="font-display text-[17px] font-black text-white leading-none">{s.v}</div>
                  <div className="text-[9px] text-slate-600 mt-1 uppercase tracking-wide">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2 — Score Rings */}
          <div className="relative flex flex-col items-center justify-center p-6 rounded-2xl min-h-[400px]"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <HudCorners color="rgba(26,111,255,0.45)" />
            <div className="flex items-center gap-2 mb-4">
              <PulseDot color="#1a6fff" />
              <span className="text-[10px] font-black text-blue-400/65 tracking-[0.2em] uppercase">Compliance Score</span>
            </div>
            <ScoreRings isInView={isInView} />
          </div>

          {/* Column 3 — AI Stream + Recommendations */}
          <div className="flex flex-col gap-4 justify-center">
            <AIStream isInView={isInView} />
            <Recommendations isInView={isInView} />
          </div>
        </div>

        {/* ── Standards grid ── */}
        <StandardsGrid isInView={isInView} />
      </div>
    </section>
  );
}
