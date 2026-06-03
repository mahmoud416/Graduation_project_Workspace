'use client';

import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import GlassCard from '@/components/ui/GlassCard';
import { MISSION_FEATURES, PLATFORM_MODULES, HUB_ANGLES } from '@/lib/constants';

// Orbit ring sizes and animation speeds
const RINGS = [
  { size: 180, dur: '8s',  dir: 'normal',  color: 'rgba(26,111,255,0.3)',  dot: '#1a6fff' },
  { size: 280, dur: '14s', dir: 'reverse', color: 'rgba(139,92,246,0.2)', dot: '#8b5cf6' },
  { size: 380, dur: '20s', dir: 'normal',  color: 'rgba(6,182,212,0.15)',  dot: '#06b6d4' },
  { size: 480, dur: '28s', dir: 'reverse', color: 'rgba(255,255,255,0.05)', dot: '#ffffff' },
] as const;

function HubVisualization() {
  return (
    <div className="relative w-full max-w-[500px] aspect-square mx-auto select-none">
      {/* Orbit rings */}
      {RINGS.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width:  r.size,
            height: r.size,
            top:  `calc(50% - ${r.size / 2}px)`,
            left: `calc(50% - ${r.size / 2}px)`,
            borderColor: r.color,
            animation: `hub-orbit ${r.dur} linear infinite ${r.dir}`,
          }}
        >
          {/* Dot on ring */}
          <div
            className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
            style={{ background: r.dot, boxShadow: `0 0 8px ${r.dot}` }}
          />
        </div>
      ))}

      {/* 6 Module nodes */}
      {PLATFORM_MODULES.map((mod, i) => {
        const angleDeg = HUB_ANGLES[i] - 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        // Use percentage-based positioning so it scales with container
        const pctX = 50 + 26 * Math.cos(angleRad);
        const pctY = 50 + 26 * Math.sin(angleRad);
        return (
          <motion.div
            key={mod.id}
            whileHover={{ scale: 1.2 }}
            className="absolute w-12 h-12 rounded-full flex items-center justify-center text-xl
              border border-white/10 cursor-default"
            style={{
              left: `${pctX}%`,
              top:  `${pctY}%`,
              transform: 'translate(-50%,-50%)',
              background: `${mod.color}22`,
              borderColor: `${mod.color}55`,
              boxShadow: `0 0 16px ${mod.color}33`,
            }}
            title={mod.name}
          >
            {mod.icon}
          </motion.div>
        );
      })}

      {/* Center Orbit core */}
      <motion.div
        animate={{ boxShadow: ['0 0 40px rgba(26,111,255,.4)', '0 0 80px rgba(26,111,255,.7)', '0 0 40px rgba(26,111,255,.4)'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-[88px] h-[88px] rounded-full z-10
          flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1a6fff, #8b5cf6)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/slogo.svg" alt="Orbit" style={{ width: 52, height: 52, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
      </motion.div>
    </div>
  );
}

export default function MissionControl() {
  return (
    <section id="mission" className="relative py-32 overflow-hidden" style={{ background: '#080812' }}>
      {/* Glow */}
      <div className="absolute -top-40 -left-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(26,111,255,.05) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left — text */}
          <div>
            <SectionHeader
              badge="The Platform"
              title="The"
              highlight="Command Center"
              subtitle="Orbit unifies every layer of your organization — teams, projects, tasks, quality standards, and analytics — into one living, intelligent ecosystem."
              titleSize="text-4xl md:text-5xl lg:text-[48px]"
            />

            <div className="flex flex-col gap-4 mt-2">
              {MISSION_FEATURES.map((feat, i) => (
                <GlassCard
                  key={feat.title}
                  delay={0.1 * i}
                  className="flex items-center gap-4 px-5 py-4 hover:translate-x-1"
                >
                  <div
                    className="w-10 h-10 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: feat.color, color: feat.text }}
                  >
                    {feat.icon}
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold mb-1">{feat.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Right — hub */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <HubVisualization />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
