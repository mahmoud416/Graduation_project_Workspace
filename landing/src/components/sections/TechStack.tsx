'use client';

import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import { TECH } from '@/lib/constants';

export default function TechStack() {
  return (
    <section id="tech" className="relative py-28 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <SectionHeader
          center
          badge="Technology"
          title="Powered by"
          highlight="Precision Technology"
          subtitle="Enterprise-grade technologies assembled to deliver a mission-critical platform."
        />

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4">
          {TECH.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, boxShadow: `0 0 30px ${tech.glow}` }}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl
                bg-white/[0.03] border border-white/[0.07]
                transition-all duration-300 cursor-default"
            >
              <span className="text-3xl">{tech.icon}</span>
              <span className="text-[11px] font-semibold text-slate-400 tracking-wide text-center leading-tight">
                {tech.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
