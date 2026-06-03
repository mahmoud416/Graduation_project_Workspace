'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { NAV_LINKS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';

// ── Orbit wordmark — "i" dot replaced with pulsing electric-blue orb ──────
function OrbitWordmark() {
  return (
    <a
      href="#hero"
      className="flex-shrink-0 flex items-center select-none"
      aria-label="Orbit"
    >
      <span
        className="font-display font-bold tracking-[-0.04em] text-white leading-none"
        style={{ fontSize: '22px' }}
      >
        Orb
        {/* ── the "i" with custom glowing dot ── */}
        <span className="relative inline-block">
          {/* dotless i (U+0131) — same glyph, no dot */}
          ı
          {/* electric-blue pulsing dot */}
          <motion.span
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              width:  '5px',
              height: '5px',
              top:    '1px',
              left:   '50%',
              x:      '-50%',
              background: '#00aaff',
            }}
            animate={{
              boxShadow: [
                '0 0 4px #00aaff, 0 0  8px rgba(0,170,255,0.55)',
                '0 0 9px #00aaff, 0 0 20px rgba(0,170,255,0.85), 0 0 35px rgba(0,170,255,0.35)',
                '0 0 4px #00aaff, 0 0  8px rgba(0,170,255,0.55)',
              ],
              scale: [1, 1.35, 1],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
        t
      </span>
    </a>
  );
}

// ── Hover-animated nav link ────────────────────────────────────────────────
function NavLink({ href, label }: { href: string; label: string }) {
  const ref  = useRef<HTMLAnchorElement>(null);
  const mx   = useMotionValue(0);
  const smx  = useSpring(mx, { stiffness: 400, damping: 28 });

  return (
    <motion.a
      ref={ref}
      href={href}
      style={{ x: smx }}
      onMouseMove={e => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left - r.width / 2) * 0.18);
      }}
      onMouseLeave={() => mx.set(0)}
      className="relative text-[13px] font-medium text-slate-400 hover:text-white transition-colors duration-200 tracking-wide group py-1"
    >
      {label}
      {/* underline reveal */}
      <span className="absolute bottom-0 left-0 w-0 h-px bg-white/40 group-hover:w-full transition-all duration-300 rounded-full" />
    </motion.a>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open,     setOpen]     = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 55);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 h-[68px] transition-all duration-500',
          scrolled
            ? 'bg-[rgba(5,5,13,0.78)] backdrop-blur-[22px] border-b border-white/[0.06]'
            : 'bg-transparent',
        )}
      >
        <div className="max-w-[1280px] mx-auto h-full px-8 md:px-10 flex items-center justify-between">

          {/* ── Wordmark — left ── */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <OrbitWordmark />
          </motion.div>

          {/* ── Navigation — right ── */}
          <motion.nav
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="hidden md:flex items-center gap-6"
            aria-label="Primary navigation"
          >
            {NAV_LINKS.map(link => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}

            {/* thin divider */}
            <div className="w-px h-[14px] bg-white/[0.1] mx-1" />

            {/* Sign In */}
            <a
              href={`${APP_URL}/login`}
              className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors duration-200 tracking-wide"
            >
              Sign In
            </a>

            {/* Launch CTA */}
            <motion.a
              href={`${APP_URL}/login`}
              whileHover={{ scale: 1.04, backgroundColor: 'rgba(255,255,255,0.12)' }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 px-5 py-[9px] rounded-full
                text-[13px] font-semibold text-white tracking-wide
                border border-white/[0.14] bg-white/[0.07]
                transition-colors duration-200"
            >
              Launch Orbit
              <motion.span
                animate={{ x: [0, 2, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-[11px] opacity-60"
              >
                →
              </motion.span>
            </motion.a>
          </motion.nav>

          {/* ── Mobile hamburger ── */}
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px]"
            aria-label="Toggle menu"
          >
            <span className={cn('block h-px bg-white/70 transition-all duration-300',
              open ? 'w-5 rotate-45 translate-y-[7px]' : 'w-5')} />
            <span className={cn('block h-px bg-white/70 transition-all duration-300',
              open ? 'w-0 opacity-0' : 'w-3.5')} />
            <span className={cn('block h-px bg-white/70 transition-all duration-300',
              open ? 'w-5 -rotate-45 -translate-y-[7px]' : 'w-5')} />
          </button>
        </div>
      </header>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[68px] left-0 right-0 z-40
              bg-[rgba(5,5,13,0.96)] backdrop-blur-2xl
              border-b border-white/[0.07]"
          >
            <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-5">
              {NAV_LINKS.map(link => (
                <a key={link.href} href={link.href} onClick={() => setOpen(false)}
                  className="text-[15px] font-medium text-slate-300 hover:text-white transition-colors tracking-wide">
                  {link.label}
                </a>
              ))}
              <div className="pt-5 border-t border-white/[0.07] flex items-center gap-4">
                <a href={`${APP_URL}/login`} onClick={() => setOpen(false)}
                  className="text-[14px] font-medium text-slate-400 hover:text-white transition-colors">
                  Sign In
                </a>
                <a href={`${APP_URL}/login`} onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                    border border-white/[0.14] bg-white/[0.07] text-white font-semibold text-[14px]">
                  Launch Orbit →
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
