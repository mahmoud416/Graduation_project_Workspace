'use client';

import { motion } from 'framer-motion';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';

const COLS = [
  {
    title: 'Platform',
    links: [
      { label: 'Orbit Ecosystem', href: '#mission'   },
      { label: 'Workspaces',      href: '#workspace' },
      { label: 'Quality AI',      href: '#quality'   },
      { label: 'Analytics',       href: '#analytics' },
      { label: 'Mission Crew',    href: '#team'      },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact',  href: '#contact' },
      { label: 'GitHub',   href: 'https://github.com/mahmoud416' },
      { label: 'LinkedIn', href: '#'                              },
      { label: 'Email',    href: 'mailto:hexacore037@gmail.com'   },
    ],
  },
];

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06]" style={{ background: '#03040c' }}>
      {/* Subtle top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-orbit-blue/40 to-transparent pointer-events-none" />
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-40 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(26,111,255,0.06) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">

        {/* ── CTA strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="py-14 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/[0.06]"
        >
          <div>
            <p className="font-display text-[22px] md:text-[26px] font-bold text-white mb-1">
              Ready to enter orbit?
            </p>
            <p className="text-slate-400 text-[14px]">
              Join teams already operating at mission-critical performance.
            </p>
          </div>
          <motion.a
            href={`${APP_URL}/login`}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="flex-shrink-0 inline-flex items-center gap-2 px-7 py-3.5 rounded-full
              text-[14px] font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #1a6fff, #0a3fff)',
              boxShadow: '0 0 28px rgba(26,111,255,0.3)',
            }}
          >
            Launch Orbit
            <span>→</span>
          </motion.a>
        </motion.div>

        {/* ── Links grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 py-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="col-span-2 md:col-span-2"
          >
            <a href="#hero" className="inline-flex items-center mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lilogo.svg" alt="Orbit" className="h-9 w-auto object-contain" />
            </a>
            <p className="text-[13px] text-slate-500 leading-relaxed max-w-[280px] mb-5">
              An AI-powered platform for workspace management, project delivery,
              team collaboration, and quality assurance.
            </p>
            {/* Social */}
            <div className="flex items-center gap-3">
              {[
                { label: 'GitHub',   href: 'https://github.com/mahmoud416', icon: '⌥' },
                { label: 'Email',    href: 'mailto:hexacore037@gmail.com',   icon: '✉' },
                { label: 'LinkedIn', href: '#',                              icon: 'in' },
              ].map(s => (
                <motion.a
                  key={s.label}
                  href={s.href}
                  title={s.label}
                  whileHover={{ scale: 1.12, y: -1 }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold
                    text-slate-400 hover:text-white border border-white/[0.08] hover:border-white/20
                    bg-white/[0.03] transition-colors duration-200"
                >
                  {s.icon}
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Link columns */}
          {COLS.map((col, i) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * (i + 1) }}
            >
              <h5 className="text-[10px] font-black tracking-[0.18em] uppercase text-slate-600 mb-4">
                {col.title}
              </h5>
              <ul className="space-y-2.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    <a href={link.href}
                      className="text-[13px] text-slate-400 hover:text-white transition-colors duration-200">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-white/[0.06] py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-slate-700">
            © {year} Orbit. All rights reserved.
          </p>
          <p className="text-[12px] font-semibold text-orbit-blue/60 tracking-[0.14em]">
            Stay In Orbit ◆
          </p>
        </div>
      </div>
    </footer>
  );
}
