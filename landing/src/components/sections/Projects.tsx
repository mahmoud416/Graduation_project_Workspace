'use client';

import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';

const COLS = [
  {
    id: 'backlog', title: '📋 Backlog', color: 'rgba(255,255,255,.6)',
    cards: [
      { title: 'Research competitive accreditation standards', tags: [{ l: 'Research', c: 'blue' }], progress: 15, avatars: ['A'] },
      { title: 'Define KPIs for QA unit annual report',        tags: [{ l: 'Planning', c: 'purple' }], avatars: ['M'] },
      { title: 'Prepare team onboarding workspace templates',   tags: [{ l: 'Workspace', c: 'blue' }] },
    ],
  },
  {
    id: 'inprogress', title: '⚡ In Progress', color: '#1a6fff', borderGlow: 'rgba(26,111,255,.3)',
    cards: [
      { title: 'Annual QA Report — Section 3: Learning Outcomes', tags: [{ l: 'QA Report', c: 'blue' }, { l: 'High', c: 'amber' }], progress: 68, avatars: ['S', 'O'] },
      { title: 'Course specification data collection Q4',          tags: [{ l: 'Course Spec', c: 'blue' }], progress: 45, avatars: ['K'] },
      { title: 'Program self-study report drafting',               tags: [{ l: 'Self Study', c: 'purple' }], progress: 30 },
    ],
  },
  {
    id: 'review', title: '🔍 AI Review', color: '#f59e0b',
    cards: [
      { title: 'Exam results analysis — Fall 2024',  tags: [{ l: 'Pending AI', c: 'amber' }], progress: 85, progressColor: '#f59e0b' },
      { title: 'Field training feedback report',     tags: [{ l: 'Under Review', c: 'amber' }], progress: 90, progressColor: '#f59e0b', avatars: ['A'] },
    ],
  },
  {
    id: 'done', title: '✅ Completed', color: '#10b981',
    cards: [
      { title: 'Reviewer reports — External Panel 2024', tags: [{ l: 'Approved', c: 'green' }], progress: 100, progressColor: '#10b981', done: true },
      { title: 'Student satisfaction survey analysis',    tags: [{ l: 'Done', c: 'green' }],     progress: 100, progressColor: '#10b981', done: true },
      { title: 'Research ethics committee report',        tags: [{ l: 'Delivered', c: 'green' }],                                           done: true },
    ],
  },
] as const;

const TAG_COLORS: Record<string, string> = {
  blue: 'tag-blue', green: 'tag-green', amber: 'tag-amber',
  red: 'tag-red', purple: 'tag-purple', cyan: 'tag-cyan',
};
const AVG_COLORS = ['#3b82f6','#8b5cf6','#10b981','#06b6d4','#f59e0b'];

export default function Projects() {
  return (
    <section id="projects" className="relative py-32 overflow-hidden" style={{ background: '#080812' }}>
      <div className="absolute -top-40 -left-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(26,111,255,.04) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <SectionHeader
          badge="Project Management"
          title="Projects"
          highlight="In Motion"
          subtitle="Kanban boards, sprint planning, milestones, and deadlines — all animated and alive. Every task tracked from kickoff to delivery."
        />

        {/* Kanban board */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLS.map((col, ci) => (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ci * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl p-4 min-h-[300px]"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${(col as any).borderGlow ? 'rgba(26,111,255,.3)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-semibold" style={{ color: col.color as string }}>
                  {col.title}
                </span>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(26,111,255,.15)', color: '#00aaff' }}
                >
                  {col.cards.length}
                </span>
              </div>

              {/* Cards */}
              {col.cards.map((card, ki) => (
                <motion.div
                  key={ki}
                  className="kanban-card"
                  style={{ opacity: (card as any).done ? 0.65 : 1 }}
                  whileHover={{ y: -3, borderColor: 'rgba(255,255,255,.13)' }}
                >
                  <p className="text-[13px] font-semibold leading-snug mb-2.5 text-white/90">{card.title}</p>

                  {/* Tags + avatars */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(card as any).tags?.map((t: any) => (
                      <span key={t.l} className={`tag ${TAG_COLORS[t.c] || 'tag-blue'}`}>{t.l}</span>
                    ))}
                    {(card as any).avatars && (
                      <div className="flex ml-auto">
                        {(card as any).avatars.map((a: string, ai: number) => (
                          <div
                            key={ai}
                            className="w-5 h-5 rounded-full border-2 border-space-darker -ml-1.5 first:ml-0
                              flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ background: AVG_COLORS[ai % AVG_COLORS.length] }}
                          >
                            {a}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {(card as any).progress != null && (
                    <div className="mt-2.5 h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(card as any).progress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: (card as any).progressColor || '#1a6fff' }}
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
