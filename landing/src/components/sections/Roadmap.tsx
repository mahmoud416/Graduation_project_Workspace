'use client';

import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import { ROADMAP } from '@/lib/constants';

export default function Roadmap() {
  return (
    <section id="roadmap" className="relative py-32 overflow-hidden">
      <div className="absolute -top-40 -left-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(26,111,255,.04) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <SectionHeader
          center
          badge="Mission Timeline"
          title="The"
          highlight="Cosmic Roadmap"
          subtitle="From launch to enterprise-grade intelligence — each quarter a new orbit unlocked."
        />

        {/* Desktop: horizontal timeline */}
        <div className="hidden md:block relative mt-20">
          {/* Track line */}
          <div className="absolute top-[14px] left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, #1a6fff, #8b5cf6, #06b6d4, #10b981)' }} />

          <div className="grid grid-cols-4 gap-0">
            {ROADMAP.map((item, i) => (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="pt-14 px-4 text-center"
              >
                {/* Dot on timeline */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 z-10 rounded-full border-4 border-space-dark transition-all"
                  style={{
                    width:  item.status === 'active' ? 28 : 22,
                    height: item.status === 'active' ? 28 : 22,
                    top:    item.status === 'active' ? -3 : 0,
                    background:   item.color,
                    boxShadow:    item.status !== 'planned' ? `0 0 16px ${item.color}` : 'none',
                  }}
                />

                {/* Q label */}
                <p
                  className="text-[12px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: item.status === 'planned' ? '#475569' : item.color }}
                >
                  {item.q} {item.status === 'complete' ? '— ✓' : item.status === 'active' ? '— In Progress' : '— Planned'}
                </p>

                <h3 className="font-display text-[17px] font-bold mb-3">{item.title}</h3>

                <ul className="text-[13px] text-slate-400 leading-[1.9] text-left mx-auto w-fit">
                  {item.items.map(it => (
                    <li key={it} className="flex items-start gap-2">
                      <span style={{ color: item.status === 'planned' ? '#475569' : item.color }}>
                        {item.status === 'complete' ? '✓' : '•'}
                      </span>
                      {it}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="md:hidden flex flex-col gap-8 mt-10 relative">
          <div className="absolute left-[14px] top-0 bottom-0 w-[2px]"
            style={{ background: 'linear-gradient(to bottom, #1a6fff, #8b5cf6, #06b6d4, #10b981)' }} />

          {ROADMAP.map((item, i) => (
            <motion.div
              key={item.q}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="pl-12 relative"
            >
              <div
                className="absolute left-0 top-1 rounded-full border-4 border-space-dark"
                style={{ width: 28, height: 28, background: item.color, boxShadow: item.status !== 'planned' ? `0 0 12px ${item.color}` : 'none' }}
              />
              <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: item.color }}>{item.q}</p>
              <h3 className="font-display text-lg font-bold mb-2">{item.title}</h3>
              <ul className="text-[13px] text-slate-400 space-y-1">
                {item.items.map(it => (
                  <li key={it} className="flex gap-2">
                    <span style={{ color: item.color }}>•</span>{it}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
