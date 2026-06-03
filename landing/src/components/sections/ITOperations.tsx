'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import GlassCard from '@/components/ui/GlassCard';

const INFRA = [
  { icon: '🖥️', bg: 'rgba(26,111,255,.12)',   label: 'API Server Uptime',        value: '99.98%', bar: 99, barColor: '#10b981', status: 'ONLINE',   statusClass: 'status-ok'   },
  { icon: '🐳', bg: 'rgba(6,182,212,.12)',    label: 'Docker Containers Active', value: '12 / 12', bar: 100,barColor: '#06b6d4', status: 'RUNNING',  statusClass: 'status-ok'   },
  { icon: '🗄️', bg: 'rgba(16,185,129,.12)',  label: 'MongoDB Storage Used',      value: '2.4 TB',  bar: 48, barColor: '#10b981', status: 'HEALTHY',  statusClass: 'status-ok'   },
  { icon: '⚙️', bg: 'rgba(245,158,11,.12)',  label: 'CPU Load Average',           value: '78%',    bar: 78, barColor: '#f59e0b', status: 'SCALING',  statusClass: 'status-warn' },
  { icon: '🔒', bg: 'rgba(139,92,246,.12)', label: 'Security Alerts',             value: '0',       bar: 2,  barColor: '#8b5cf6', status: 'SECURE',   statusClass: 'status-ok'   },
  { icon: '🚀', bg: 'rgba(26,111,255,.12)',   label: 'API Response Time',          value: '14 ms',  bar: 14, barColor: '#1a6fff', status: 'LIVE',     statusClass: 'status-ok'   },
] as const;

const MON = [
  { label: 'Frontend CDN',   val: '100%', color: '#10b981' },
  { label: 'API Req/min',    val: '4.8K', color: '#1a6fff' },
  { label: 'AI Analyses/day',val: '3.2K', color: '#8b5cf6' },
  { label: 'SLA Compliance', val: '99.9%',color: '#06b6d4' },
] as const;

export default function ITOperations() {
  const ref      = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="it-ops" ref={ref} className="relative py-32 overflow-hidden" style={{ background: '#080812' }}>
      <div className="absolute -bottom-40 -right-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(26,111,255,.04) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <SectionHeader
          badge="IT Operations"
          title="Mission"
          highlight="Infrastructure"
          subtitle="Real-time visibility into every server, container, API, and deployment. DevOps meets mission control."
        />

        {/* Infra grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          {INFRA.map((card, i) => (
            <GlassCard key={i} delay={i * 0.07} topLine className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-xl"
                  style={{ background: card.bg }}>
                  {card.icon}
                </div>
                <span className={`tag text-[10px] font-bold px-2.5 py-1 rounded-full ${card.statusClass}`}>
                  {card.status}
                </span>
              </div>
              <div className="font-display text-2xl font-bold tracking-tight mb-1">{card.value}</div>
              <div className="text-[12px] text-slate-500 mb-3">{card.label}</div>
              <div className="h-[4px] rounded-full bg-white/[0.07] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: card.barColor }}
                  initial={{ width: 0 }}
                  animate={isInView ? { width: `${card.bar}%` } : {}}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 + i * 0.08 }}
                />
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Monitoring panel */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-5 p-7 rounded-2xl border border-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          {MON.map(m => (
            <div key={m.label} className="text-center">
              <div
                className="w-2.5 h-2.5 rounded-full mx-auto mb-3"
                style={{ background: m.color, boxShadow: `0 0 8px ${m.color}`, animation: 'pulse-glow 3s ease-in-out infinite' }}
              />
              <div className="font-display text-2xl font-bold" style={{ color: m.color }}>{m.val}</div>
              <div className="text-[11px] text-slate-500 mt-1 tracking-wide">{m.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
