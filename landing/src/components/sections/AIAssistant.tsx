'use client';

import { useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import GlassCard from '@/components/ui/GlassCard';

const TERMINAL_LINES = [
  { type: 'prompt', text: 'orbit >' },          { type: 'out', text: 'Analyzing workspace activity...' },
  { type: 'sep', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' },
  { type: 'info', text: '▶ Scanning 24 active projects' },
  { type: 'info', text: '▶ Reviewing 347 open tasks' },
  { type: 'info', text: '▶ Processing 12 pending QA reports' },
  { type: 'blank' },
  { type: 'error', text: '⚠ RISK:' }, { type: 'out', text: ' Project Alpha — documentation gap' },
  { type: 'warn', text: '  ↳ Missing: course_spec_ENG301.pdf' },
  { type: 'warn', text: '  ↳ Missing: assessment_evidence_Q4.pdf' },
  { type: 'blank' },
  { type: 'ok', text: '✓ ANALYSIS:' }, { type: 'out', text: ' Quality score would improve to' },
  { type: 'purple', text: '  97% compliance' }, { type: 'out', text: ' if gaps are resolved.' },
  { type: 'blank' },
  { type: 'ok', text: '✓ ACTION:' }, { type: 'out', text: ' Assigning @sara.ahmed as reviewer' },
  { type: 'ok', text: '✓ ACTION:' }, { type: 'out', text: ' ETA recalculated: 2 days' },
  { type: 'blank' },
  { type: 'prompt', text: 'orbit >' }, { type: 'cursor' },
] as const;

const LINE_COLORS: Record<string, string> = {
  prompt: '#1a6fff', out: '#94a3b8', sep: '#475569',
  info: '#94a3b8', error: '#ef4444', warn: '#f59e0b',
  ok: '#10b981', purple: '#8b5cf6', blank: 'transparent',
};

const INSIGHTS = [
  {
    icon: '⚠️', bg: 'rgba(239,68,68,.12)', badge: 'High Risk', badgeBg: 'rgba(239,68,68,.15)', badgeColor: '#ef4444',
    title: 'Project Alpha — Risk Detected',
    desc: 'Documentation missing for 3 course specifications. Testing phase 4 days behind schedule.',
  },
  {
    icon: '📌', bg: 'rgba(245,158,11,.12)', badge: 'Attention', badgeBg: 'rgba(245,158,11,.15)', badgeColor: '#f59e0b',
    title: 'QA Review Deadline Approaching',
    desc: 'Annual QA report due in 6 days. 3 sections still pending reviewer sign-off.',
  },
  {
    icon: '✅', bg: 'rgba(16,185,129,.12)', badge: 'AI Suggestion', badgeBg: 'rgba(16,185,129,.15)', badgeColor: '#10b981',
    title: 'Recommended Action',
    desc: 'Assign 2 additional reviewers to Project Alpha. Estimated resolution: 2 days.',
  },
] as const;

function Terminal() {
  const ref      = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <div
      ref={ref}
      className="rounded-2xl overflow-hidden border border-white/[0.07]"
      style={{ background: '#0a0a14' }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.07]" style={{ background: 'rgba(255,255,255,.02)' }}>
        <span className="w-3 h-3 rounded-full bg-red-500" />
        <span className="w-3 h-3 rounded-full bg-amber-400" />
        <span className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-[12px] text-slate-500 ml-3 font-mono">orbit-intelligence — live analysis</span>
      </div>

      {/* Lines */}
      <div className="p-7 font-mono text-[13px] leading-[2.1] min-h-[360px] relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 30% 50%, rgba(139,92,246,.05) 0%, transparent 70%)' }}
        />
        {TERMINAL_LINES.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: i * 0.09 + 0.2, duration: 0.25 }}
            className="relative z-10"
            style={{ color: LINE_COLORS[line.type] || '#94a3b8' }}
          >
            {line.type === 'blank'   ? <>&nbsp;</> :
             line.type === 'cursor'  ? <span className="cursor-blink" /> :
             line.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  return (
    <section id="ai-section" className="relative py-32 overflow-hidden" style={{ background: '#080812' }}>
      <div className="absolute -bottom-40 -right-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,.05) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-2 gap-12 items-start">

          {/* Left — insights */}
          <div>
            <SectionHeader
              badge="Orbit Intelligence"
              title="Orbit"
              highlight="Intelligence"
              subtitle="The AI layer that never sleeps — monitoring projects, tasks, and quality reports, surfacing risks before they become problems."
            />

            <div className="flex flex-col gap-4">
              {INSIGHTS.map((ins, i) => (
                <GlassCard key={i} delay={i * 0.1} className="flex gap-4 p-5">
                  <div className="w-9 h-9 rounded-[9px] flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: ins.bg }}>
                    {ins.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[14px] font-semibold mb-1">{ins.title}</h4>
                    <p className="text-[12px] text-slate-400 leading-relaxed">{ins.desc}</p>
                    <span
                      className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-[4px]"
                      style={{ background: ins.badgeBg, color: ins.badgeColor }}
                    >
                      {ins.badge}
                    </span>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Right — terminal */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Terminal />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
