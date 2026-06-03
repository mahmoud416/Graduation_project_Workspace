'use client';

import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';

const tree = [
  {
    depth: 0, color: '#1a6fff', icon: '🌌',
    label: 'Orbit Workspace', sub: 'University Quality Assurance',
    children: [
      {
        depth: 1, color: '#8b5cf6', icon: '🏛️', label: 'Engineering Faculty',
        children: [
          {
            depth: 2, color: '#06b6d4', icon: '👥', label: 'QA Core Team',
            children: [
              { depth: 3, color: '#1a6fff', icon: '📋', label: 'Annual QA Report 2025', tag: 'Active',   tagColor: '#10b981' },
              { depth: 3, color: '#f59e0b', icon: '📋', label: 'Program Accreditation Review', tag: 'Review', tagColor: '#f59e0b' },
              { depth: 3, color: '#10b981', icon: '📋', label: 'Course Specification Audit',   tag: 'Done',   tagColor: '#1a6fff' },
            ],
          },
          {
            depth: 2, color: '#06b6d4', icon: '👥', label: 'Accreditation Team',
            children: [],
          },
        ],
      },
      {
        depth: 1, color: '#8b5cf6', icon: '🏛️', label: 'Business Faculty', children: [],
      },
    ],
  },
];

interface Node {
  depth: number; color: string; icon: string; label: string;
  sub?: string; tag?: string; tagColor?: string;
  children?: Node[];
}

function TreeNode({ node, index }: { node: Node; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
    >
      <div
        className="flex items-center gap-3 py-2.5 px-3 rounded-[10px] border border-transparent
          hover:bg-white/[0.03] hover:border-white/[0.07] transition-all duration-200 cursor-default group"
        style={{ paddingLeft: `${12 + node.depth * 32}px` }}
      >
        {/* Connector line */}
        {node.depth > 0 && (
          <div
            className="absolute left-0 border-l border-white/[0.07]"
            style={{ height: '100%', marginLeft: `${node.depth * 32 - 12}px` }}
          />
        )}

        {/* Dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: node.color, boxShadow: `0 0 6px ${node.color}` }}
        />

        {/* Icon */}
        <span className="text-base flex-shrink-0">{node.icon}</span>

        {/* Label */}
        <span className="text-[13px] font-medium text-white/90 flex-1">{node.label}</span>

        {/* Sub */}
        {node.sub && <span className="text-[12px] text-slate-500">{node.sub}</span>}

        {/* Tag */}
        {node.tag && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] ml-auto flex-shrink-0"
            style={{ background: `${node.tagColor}22`, color: node.tagColor }}
          >
            {node.tag}
          </span>
        )}
      </div>

      {/* Children */}
      {node.children?.map((child, i) => (
        <TreeNode key={i} node={child} index={index + i + 1} />
      ))}
    </motion.div>
  );
}

export default function Workspace() {
  return (
    <section id="workspace" className="relative py-32 overflow-hidden">
      <div className="absolute -bottom-40 -right-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,.05) 0%, transparent 70%)' }} />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <SectionHeader
          badge="Workspaces"
          title="Built for"
          highlight="Deep Focus"
          subtitle="Orbit organizes every layer of your organization — from enterprise workspace down to individual task — as a connected orbit path."
        />

        {/* Tree visualization */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative p-8 rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Background glow */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(26,111,255,.06) 0%, transparent 70%)' }}
          />

          {/* Left accent line */}
          <div className="absolute left-8 top-8 bottom-8 w-px"
            style={{ background: 'linear-gradient(to bottom, #1a6fff, rgba(26,111,255,0))' }} />

          <div className="relative pl-4">
            {tree.map((node, i) => (
              <TreeNode key={i} node={node} index={i} />
            ))}
          </div>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { label: 'Workspaces',   value: '∞',    color: '#1a6fff' },
            { label: 'Teams',        value: '500+',  color: '#8b5cf6' },
            { label: 'Active Tasks', value: '12K+',  color: '#10b981' },
            { label: 'Departments',  value: '60+',   color: '#06b6d4' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="p-5 rounded-2xl text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="font-display text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-slate-500 tracking-wide">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
