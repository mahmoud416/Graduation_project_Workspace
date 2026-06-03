'use client';

import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import { TEAM } from '@/lib/constants';

const BADGES: Record<string, { label: string; icon: string }> = {
  'Founder & CEO':             { label: 'Mission Commander', icon: '⭐' },
  'Lead Backend Engineer':     { label: 'Systems Architect',  icon: '⚙️' },
  'AI / ML Engineer':          { label: 'AI Specialist',      icon: '🧠' },
  'UX / UI Designer':          { label: 'Design Lead',        icon: '🎨' },
  'Platform Engineer':         { label: 'Platform Engineer',  icon: '⚙️' },
  'QA & Accreditation Lead':   { label: 'QA Director',        icon: '✅' },
};

export default function Team() {
  return (
    <section id="team" className="relative py-32 overflow-hidden" style={{ background: '#080812' }}>

      {/* Background nebula glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(26,111,255,0.05) 0%, transparent 65%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 50% 40% at 80% 80%, rgba(139,92,246,0.04) 0%, transparent 60%)',
      }} />

      {/* Subtle scan lines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.012]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,1) 3px, rgba(255,255,255,1) 4px)',
      }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <SectionHeader
          center
          badge="Mission Crew"
          title="Meet The"
          highlight="Mission Crew"
          subtitle="The visionaries and engineers behind Orbit — building the future of intelligent workspaces."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {TEAM.map((member, i) => {
            const badge = BADGES[member.role] ?? { label: 'Crew Member', icon: '🚀' };
            return (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 44 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -10, transition: { duration: 0.3, ease: 'easeOut' } }}
                className="group cursor-default"
              >
                <div
                  className="relative overflow-hidden rounded-2xl p-8 text-center transition-all duration-400"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {/* Hover glow overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                    style={{
                      background: `radial-gradient(ellipse 90% 60% at 50% 0%, ${member.from}18, transparent 70%)`,
                      boxShadow: `inset 0 1px 0 ${member.from}35, 0 0 30px ${member.from}15`,
                    }}
                  />

                  {/* Status indicator */}
                  <div className="absolute top-4 right-5 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
                    </span>
                    <span className="text-[9px] text-[#10b981] font-bold tracking-widest uppercase">Active</span>
                  </div>

                  {/* Avatar */}
                  <div className="relative w-32 h-32 mx-auto mb-6">
                    {/* Outermost orbit ring — slow rotate */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 18 + i * 2, repeat: Infinity, ease: 'linear' }}
                      className="absolute"
                      style={{
                        inset: '-14px',
                        borderRadius: '50%',
                        border: `1px dashed ${member.from}45`,
                      }}
                    />
                    {/* Second ring — counter-rotate */}
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 12 + i, repeat: Infinity, ease: 'linear' }}
                      className="absolute"
                      style={{
                        inset: '-6px',
                        borderRadius: '50%',
                        border: `1px solid ${member.from}55`,
                      }}
                    />
                    {/* Pulsing glow ring */}
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2.8 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-0 rounded-full"
                      style={{ boxShadow: `0 0 28px ${member.from}55` }}
                    />
                    {/* Inner border */}
                    <div className="absolute inset-0 rounded-full" style={{ border: `2px solid ${member.from}70` }} />
                    {/* Photo circle */}
                    <div
                      className="relative w-full h-full rounded-full flex items-center justify-center font-display font-black text-white text-3xl overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${member.from}, ${member.to})` }}
                    >
                      {/* Shimmer on hover */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
                      {member.initials}
                    </div>
                  </div>

                  {/* Mission badge */}
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4 text-[10px] font-black tracking-[0.12em] uppercase"
                    style={{
                      background: `${member.from}18`,
                      border: `1px solid ${member.from}38`,
                      color: member.from,
                    }}
                  >
                    <span style={{ fontSize: '11px' }}>{badge.icon}</span>
                    {badge.label}
                  </div>

                  {/* Name & role */}
                  <h3 className="font-display text-[18px] font-bold text-white mb-1.5 leading-tight">{member.name}</h3>
                  <p className="text-[13px] text-slate-400 mb-6">{member.role}</p>

                  {/* Social links */}
                  <div className="flex items-center justify-center gap-3">
                    {[
                      { icon: 'in', label: 'LinkedIn' },
                      { icon: '⌥', label: 'GitHub'   },
                      { icon: '✉', label: 'Email'    },
                    ].map(({ icon, label }) => (
                      <motion.a
                        key={label}
                        href="#"
                        title={label}
                        whileHover={{ scale: 1.18, y: -2 }}
                        whileTap={{ scale: 0.92 }}
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[12px] font-bold text-slate-400 hover:text-white transition-colors duration-200"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                      >
                        {icon}
                      </motion.a>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
