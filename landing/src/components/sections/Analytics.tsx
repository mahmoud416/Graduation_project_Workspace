'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useMemo } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import GlassCard from '@/components/ui/GlassCard';

// ── Line chart path ──────────────────────────────────────────────────────────
const POINTS = [50, 45, 38, 42, 30, 35, 22, 28, 15, 20, 12, 8, 6];
function lineD(pts: number[]) {
  return pts.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * 200) / (pts.length - 1)},${y}`).join(' ');
}
function areaD(pts: number[]) {
  return lineD(pts) + ` L200,60 L0,60 Z`;
}

// ── Heatmap ──────────────────────────────────────────────────────────────────
const opacities = [.05, .1, .15, .3, .5, .65, .8, 1];
function HeatMap() {
  const cells = useMemo(() =>
    Array.from({ length: 84 }, (_, i) => opacities[Math.floor(Math.random() * opacities.length)]),
  []);
  return (
    <div className="grid gap-[4px]" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
      {cells.map((op, i) => (
        <div key={i} className="heatmap-cell" style={{ background: `rgba(26,111,255,${op})` }} />
      ))}
    </div>
  );
}

// ── Donut chart ──────────────────────────────────────────────────────────────
const DONUT_CIRC = 2 * Math.PI * 50;
const DONUT_SEGS = [
  { pct: 0.85, color: '#10b981', label: 'On Track' },
  { pct: 0.10, color: '#f59e0b', label: 'At Risk'  },
  { pct: 0.05, color: '#ef4444', label: 'Blocked'  },
];
function Donut({ animate }: { animate: boolean }) {
  let offset = 0;
  return (
    <div className="relative w-[130px] h-[130px] mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="12" />
        {DONUT_SEGS.map((seg, i) => {
          const dash = DONUT_CIRC * seg.pct;
          const off  = DONUT_CIRC - dash - offset;
          const rot  = (offset / DONUT_CIRC) * 360;
          offset += dash;
          return (
            <motion.circle
              key={i}
              cx="60" cy="60" r="50"
              fill="none" stroke={seg.color} strokeWidth="12"
              initial={{ strokeDasharray: `${dash} ${DONUT_CIRC}`, strokeDashoffset: off, opacity: 0 }}
              animate={animate ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.3 + i * 0.15 }}
              style={{ strokeDasharray: `${dash} ${DONUT_CIRC}`, strokeDashoffset: off, transform: `rotate(${rot}deg)`, transformOrigin: '60px 60px' }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold">85%</span>
        <span className="text-[10px] text-slate-500 mt-0.5">On Track</span>
      </div>
    </div>
  );
}

// ── Mini bar chart ─────────────────────────────────────────────────────────
const BARS = [35, 55, 40, 70, 60, 85, 75, 90, 80, 95, 88, 100];

export default function Analytics() {
  const ref      = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="analytics" ref={ref} className="relative py-32 overflow-hidden">
      <div className="absolute -top-40 -left-24 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(26,111,255,.04) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <SectionHeader
          badge="Analytics"
          title="Insights Across"
          highlight="the Galaxy"
          subtitle="Every metric — from quality trends to team velocity — visualized in real-time premium dashboards."
        />

        {/* Top row: 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Line chart */}
          <GlassCard topLine className="p-6 col-span-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-semibold">Quality Score Trend</span>
              <span className="tag tag-green">↑ 12%</span>
            </div>
            <div className="font-display text-3xl font-bold text-orbit-blue mt-1 mb-4">88.4%</div>
            <svg viewBox="0 0 200 60" className="w-full h-[70px] overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#1a6fff" stopOpacity=".3" />
                  <stop offset="100%" stopColor="#1a6fff" stopOpacity="0"  />
                </linearGradient>
              </defs>
              <motion.path
                d={areaD(POINTS)} fill="url(#lg)"
                initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
              <motion.path
                d={lineD(POINTS)} fill="none" stroke="#1a6fff" strokeWidth="2" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={isInView ? { pathLength: 1 } : {}}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
              />
            </svg>
          </GlassCard>

          {/* Bar chart */}
          <GlassCard topLine className="p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-semibold">Task Completion</span>
              <span className="tag tag-blue">This Month</span>
            </div>
            <div className="font-display text-3xl font-bold mt-1 mb-4">
              347 <span className="text-base text-slate-500 font-normal">tasks</span>
            </div>
            <div className="flex items-end gap-1 h-[60px]">
              {BARS.map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{ background: 'linear-gradient(to top, #1a6fff, rgba(26,111,255,.4))', minHeight: 4 }}
                  initial={{ height: 0 }}
                  animate={isInView ? { height: `${h}%` } : {}}
                  transition={{ duration: 0.7, delay: 0.05 * i + 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
            </div>
          </GlassCard>

          {/* Donut */}
          <GlassCard topLine className="p-6">
            <span className="text-[13px] font-semibold">Project Health</span>
            <div className="mt-4">
              <Donut animate={isInView} />
            </div>
            <div className="flex items-center justify-center gap-4 mt-4">
              {DONUT_SEGS.map(s => (
                <span key={s.label} className="text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-slate-400">{s.label}</span>
                </span>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Bottom row: heatmap + productivity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          <GlassCard topLine className="p-6 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-semibold">Team Activity Heatmap</span>
              <span className="text-[12px] text-slate-500">Last 12 weeks</span>
            </div>
            <HeatMap />
            <div className="flex items-center gap-1 mt-3 text-[11px] text-slate-500">
              Less
              {[.1, .3, .5, .8, 1].map(op => (
                <div key={op} className="w-2.5 h-2.5 rounded-sm mx-0.5" style={{ background: `rgba(26,111,255,${op})` }} />
              ))}
              More
            </div>
          </GlassCard>

          <GlassCard topLine className="p-6">
            <span className="text-[13px] font-semibold block mb-1">Productivity Score</span>
            <div className="font-display text-4xl font-bold text-orbit-purple mb-4">92.1</div>
            <div className="flex flex-col gap-3">
              {[
                { team: 'QA Team',     pct: 96, color: '#8b5cf6' },
                { team: 'Engineering', pct: 89, color: '#1a6fff'  },
                { team: 'Analytics',   pct: 94, color: '#06b6d4'  },
              ].map(row => (
                <div key={row.team}>
                  <div className="flex justify-between text-[12px] text-slate-400 mb-1">
                    <span>{row.team}</span>
                    <span className="text-white font-semibold">{row.pct}%</span>
                  </div>
                  <div className="h-[4px] rounded-full bg-white/[0.07] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: row.color }}
                      initial={{ width: 0 }}
                      animate={isInView ? { width: `${row.pct}%` } : {}}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
