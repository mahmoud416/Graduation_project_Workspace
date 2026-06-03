'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

const GalaxyScene = dynamic(() => import('@/components/three/GalaxyScene'), {
  ssr: false,
  loading: () => null,
});

const LogoOrbit = dynamic(() => import('@/components/ui/LogoOrbit'), {
  ssr: false,
  loading: () => null,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen overflow-hidden"
      style={{ background: '#05050d' }}
    >
      {/* ══════════════════════════════════════════════════════════
          LEFT PANEL — solid dark, zero visual interference
      ══════════════════════════════════════════════════════════ */}
      <div
        className="relative z-10 flex flex-shrink-0 items-center
          w-full lg:w-[46%]
          px-10 sm:px-14 xl:px-20
          pt-28 pb-16"
        style={{ background: '#05050d' }}
      >
        {/* Faint right-edge gradient so left blends into right panel */}
        <div
          className="absolute inset-y-0 right-0 w-24 pointer-events-none hidden lg:block"
          style={{ background: 'linear-gradient(to right, #05050d, transparent)' }}
        />

        <div className="relative w-full max-w-[520px]">

          {/* ── Status badge ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2.5 mb-8"
          >
            <span className="relative flex h-[7px] w-[7px] flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1a6fff] opacity-50" />
              <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#1a6fff]" />
            </span>
            <span className="text-[11px] font-semibold text-slate-500 tracking-[0.16em] uppercase">
              Workspace · AI · Quality · Analytics
            </span>
          </motion.div>

          {/* ── Headline ── */}
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="font-display font-bold leading-[1.03] tracking-[-2px] mb-6"
            style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}
          >
            Your Workspace.
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #1a6fff 0%, #00aaff 48%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              In Perfect Orbit.
            </span>
          </motion.h1>

          {/* ── Description ── */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.55 }}
            className="text-[16px] md:text-[17px] text-slate-400 leading-[1.75] mb-10"
            style={{ maxWidth: 440 }}
          >
            An AI-powered platform for workspace management,
            project delivery, team collaboration, and quality assurance.
          </motion.p>

          {/* ── CTA buttons ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.72 }}
            className="flex flex-wrap items-center gap-3 mb-14"
          >
            <motion.a
              href={`${APP_URL}/login`}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full
                text-[14px] font-semibold text-white group"
              style={{
                background: 'linear-gradient(135deg, #1a6fff, #0a3fff)',
                boxShadow: '0 0 28px rgba(26,111,255,0.28)',
              }}
            >
              Launch Orbit
              <span className="group-hover:translate-x-1 transition-transform duration-200 opacity-80">→</span>
            </motion.a>

            <a
              href="#mission"
              className="inline-flex items-center px-7 py-3.5 rounded-full
                text-[14px] font-medium text-slate-400 hover:text-white
                border border-white/[0.1] hover:border-white/[0.18]
                transition-all duration-200"
            >
              Explore Platform
            </a>
          </motion.div>

          {/* ── Stats ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.05, duration: 0.8 }}
            className="flex items-center gap-7 pt-7 border-t border-white/[0.06]"
          >
            {[
              { val: '10K+',  label: 'Teams'      },
              { val: '250K+', label: 'Projects'   },
              { val: '99.9%', label: 'Uptime'     },
              { val: '24/7',  label: 'AI Monitor' },
            ].map(s => (
              <div key={s.label}>
                <div className="font-display text-[19px] font-bold text-white leading-none">{s.val}</div>
                <div className="text-[10px] text-slate-600 mt-1 tracking-wide">{s.label}</div>
              </div>
            ))}
          </motion.div>

          {/* ── Mobile: CSS Orbit Core (shown when right panel is hidden) ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.3, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden mt-12 flex items-center justify-center"
          >
            <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
              {/* Glow */}
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                background: 'radial-gradient(circle, rgba(26,111,255,0.15) 0%, transparent 70%)',
              }} />
              {/* Rings */}
              {[
                { size: 210, dur: '28s', op: 0.15, c: '#1a6fff' },
                { size: 160, dur: '18s', rev: true, op: 0.20, c: '#4488ff' },
                { size: 116, dur: '12s', op: 0.25, c: '#8b5cf6' },
              ].map((r, i) => (
                <div key={i} className="absolute rounded-full"
                  style={{ width: r.size, height: r.size, top: '50%', left: '50%', border: `1px solid ${r.c}`, opacity: r.op, animation: `hub-orbit ${r.dur} linear infinite${(r as any).rev ? ' reverse' : ''}` }}>
                  <div className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ background: r.c, boxShadow: `0 0 8px ${r.c}` }} />
                </div>
              ))}
              {/* Logo */}
              <div className="relative z-10">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                  className="absolute rounded-full"
                  style={{ inset: '-12px', border: '1px solid rgba(26,111,255,0.4)', borderTopColor: 'rgba(26,111,255,0.85)' }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/lilogo.svg" alt="Orbit" style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(26,111,255,0.7))' }} />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          RIGHT PANEL — visuals only, no text
          Galaxy is contained here; never bleeds into left panel
      ══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex absolute inset-y-0 right-0 w-[57%] items-center justify-center overflow-hidden">

        {/* Galaxy atmosphere — scoped to right panel */}
        <div className="absolute inset-0 z-0">
          <GalaxyScene />
        </div>

        {/* Left-edge fade: blends into the solid left panel */}
        <div
          className="absolute inset-y-0 left-0 w-52 z-[1] pointer-events-none"
          style={{ background: 'linear-gradient(to right, #05050d, transparent)' }}
        />

        {/* Bottom fade: connects to next section */}
        <div
          className="absolute bottom-0 left-0 right-0 h-36 z-[1] pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, #05050d)' }}
        />

        {/* Top fade */}
        <div
          className="absolute top-0 left-0 right-0 h-28 z-[1] pointer-events-none"
          style={{ background: 'linear-gradient(to top, transparent, rgba(5,5,13,0.6))' }}
        />

        {/* Soft edge vignette */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 85% 75% at 62% 50%, transparent 28%, rgba(5,5,13,0.45) 80%, rgba(5,5,13,0.85) 100%)',
          }}
        />

        {/* Orbit Core — fills entire right panel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6, delay: 0.5 }}
          className="absolute inset-0 z-10"
        >
          <LogoOrbit />
        </motion.div>
      </div>

      {/* ── Scroll hint ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 1 }}
        className="absolute bottom-7 left-10 sm:left-14 xl:left-20 z-20
          flex items-center gap-3 text-slate-700 text-[10px] tracking-[0.16em] uppercase"
      >
        <div className="w-5 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
        Scroll to explore
      </motion.div>
    </section>
  );
}
