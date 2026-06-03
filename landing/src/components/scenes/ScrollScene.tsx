'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface Props {
  num: string;
  name: string;
  accent: string;
  bg?: string;
  children: React.ReactNode;
}

export default function ScrollScene({
  num, name, accent, bg = '#05050d', children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Scroll progress while this scene is in viewport
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // ── Camera-through-space transforms ────────────────────────────────────
  // Entering: zoom in from 0.91 → 1  (flying toward the scene)
  // Leaving:  continue zooming 1 → 1.06 (flying through and past it)
  const scale   = useTransform(scrollYProgress, [0, 0.20, 0.78, 1], [0.91, 1, 1, 1.06]);
  const opacity = useTransform(scrollYProgress, [0, 0.16, 0.78, 1], [0,    1, 1, 0   ]);
  const y       = useTransform(scrollYProgress, [0, 0.20           ], [80,  0          ]);

  return (
    <div ref={ref} className="relative overflow-hidden" style={{ background: bg }}>

      {/* ── Scene-specific ambient glow ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 55% 45% at 50% 50%, ${accent}0a 0%, transparent 70%)`,
        }}
      />

      {/* ── Giant watermark number ── */}
      <div
        aria-hidden
        className="absolute right-6 bottom-12 font-display font-black select-none pointer-events-none leading-[0.9] z-[1]"
        style={{
          fontSize: 'clamp(110px, 18vw, 240px)',
          color: `${accent}07`,
          letterSpacing: '-0.04em',
        }}
      >
        {num}
      </div>

      {/* ── Scene identifier label ── */}
      <div className="absolute top-8 left-8 md:left-14 z-20 flex items-center gap-2.5 select-none pointer-events-none">
        <span
          className="font-display text-[11px] font-black tracking-[0.18em]"
          style={{ color: `${accent}80` }}
        >
          {num}
        </span>
        <div className="w-5 h-px" style={{ background: `${accent}45` }} />
        <span className="text-[10px] font-semibold text-slate-600 tracking-[0.14em] uppercase">
          {name}
        </span>
      </div>

      {/* ── Animated content ── */}
      <motion.div style={{ scale, opacity, y }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
