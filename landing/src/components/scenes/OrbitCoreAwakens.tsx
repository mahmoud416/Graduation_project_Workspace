'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const MODULES = [
  { name: 'Workspace',    color: '#3b82f6' },
  { name: 'Projects',     color: '#10b981' },
  { name: 'Quality AI',   color: '#f59e0b' },
  { name: 'Analytics',    color: '#06b6d4' },
  { name: 'Team Collab',  color: '#ec4899' },
  { name: 'AI Assistant', color: '#8b5cf6' },
];

// CSS-only orbit rings — no Three.js, no conflict with Hero canvas
function CSSOrbitCore() {
  const RINGS = [
    { size: 220, dur: '28s', dir: 'normal',  opacity: 0.18, color: '#1a6fff' },
    { size: 320, dur: '20s', dir: 'reverse', opacity: 0.12, color: '#4488ff' },
    { size: 420, dur: '36s', dir: 'normal',  opacity: 0.08, color: '#8b5cf6' },
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 480, height: 480 }}>
      {/* Radial glow */}
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(26,111,255,0.14) 0%, rgba(139,92,246,0.06) 45%, transparent 70%)',
      }} />

      {/* CSS orbit rings */}
      {RINGS.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: r.size, height: r.size,
            top: '50%', left: '50%',
            border: `1px solid ${r.color}`,
            opacity: r.opacity,
            animation: `hub-orbit ${r.dur} linear infinite${r.dir === 'reverse' ? ' reverse' : ''}`,
          }}
        >
          <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
            style={{ background: r.color, boxShadow: `0 0 10px ${r.color}, 0 0 20px ${r.color}55` }} />
        </div>
      ))}

      {/* Center: Orbit logo */}
      <div className="relative z-10 flex items-center justify-center">
        {/* Pulse glow */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.45, 0.2] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute rounded-full pointer-events-none"
          style={{ inset: '-30px', background: 'radial-gradient(circle, rgba(26,111,255,0.3) 0%, transparent 70%)' }}
        />
        {/* Rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: '-16px',
            border: '1.5px solid rgba(26,111,255,0.5)',
            borderTopColor: 'rgba(26,111,255,0.9)',
          }}
        />
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/lilogo.svg"
          alt="Orbit"
          style={{
            width: 150, height: 150,
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 16px rgba(26,111,255,0.8)) drop-shadow(0 0 40px rgba(26,111,255,0.4))',
          }}
        />
      </div>

      {/* Orbit particle dots */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360;
        const r = 100 + (i % 3) * 25;
        return (
          <motion.div
            key={i}
            animate={{ opacity: [0.15, 0.6, 0.15], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2.5 + (i % 4) * 0.4, repeat: Infinity, delay: i * 0.18 }}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 3, height: 3,
              background: i % 2 === 0 ? '#1a6fff' : '#8b5cf6',
              left: `calc(50% + ${r * Math.cos((angle * Math.PI) / 180)}px)`,
              top:  `calc(50% + ${r * Math.sin((angle * Math.PI) / 180) * 0.38}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function OrbitCoreAwakens() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const textOpacity = useTransform(scrollYProgress, [0.08, 0.28, 0.72, 0.88], [0, 1, 1, 0]);
  const textY       = useTransform(scrollYProgress, [0.08, 0.28], [45, 0]);
  const coreOpacity = useTransform(scrollYProgress, [0.05, 0.25, 0.78, 0.92], [0, 1, 1, 0]);

  return (
    <section
      ref={ref}
      className="relative min-h-screen overflow-hidden flex items-center"
      style={{ background: '#03050d' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 55% 55% at 62% 50%, rgba(26,111,255,0.08) 0%, transparent 65%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 35% 40% at 35% 50%, rgba(139,92,246,0.05) 0%, transparent 60%)',
      }} />

      {/* Watermark */}
      <div aria-hidden className="absolute right-6 bottom-10 font-display font-black select-none pointer-events-none leading-none"
        style={{ fontSize: 'clamp(100px, 16vw, 220px)', color: 'rgba(26,111,255,0.04)' }}>
        02
      </div>

      {/* Scene label */}
      <div className="absolute top-8 left-10 md:left-14 z-20 flex items-center gap-2 select-none pointer-events-none">
        <span className="font-display text-[11px] font-black tracking-[0.18em] text-[#1a6fff80]">02</span>
        <div className="w-4 h-px bg-[#1a6fff45]" />
        <span className="text-[10px] font-semibold text-slate-700 tracking-[0.14em] uppercase">Orbit Core Awakens</span>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-10 md:px-16 xl:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[80vh]">

          {/* Left: text */}
          <motion.div style={{ opacity: textOpacity, y: textY }} className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-2.5 mb-8 self-start">
              <span className="relative flex h-[7px] w-[7px]">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1a6fff] opacity-55" />
                <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#1a6fff]" />
              </span>
              <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Orbit Core</span>
            </div>

            <h2
              className="font-display font-bold leading-[1.03] tracking-[-2px] mb-6"
              style={{ fontSize: 'clamp(36px, 4.5vw, 62px)' }}
            >
              The Heart of
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #1a6fff 0%, #00aaff 50%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                the Galaxy
              </span>
            </h2>

            <p className="text-[15px] md:text-[16px] text-slate-400 leading-[1.75] mb-10 max-w-[420px]">
              Orbit Core connects every module — workspaces, teams, projects, AI quality, and analytics — into one living, intelligent ecosystem.
            </p>

            <div className="flex flex-wrap gap-2">
              {MODULES.map(m => (
                <span key={m.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
                  style={{ background: `${m.color}12`, border: `1px solid ${m.color}30`, color: m.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                  {m.name}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right: CSS Orbit Core */}
          <motion.div
            style={{ opacity: coreOpacity }}
            className="hidden lg:flex items-center justify-center"
          >
            <CSSOrbitCore />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
