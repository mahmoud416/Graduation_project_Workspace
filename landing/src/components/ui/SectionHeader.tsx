'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  badge: string;
  title: string;
  highlight: string;
  subtitle?: string;
  center?: boolean;
  className?: string;
  titleSize?: string;
}

export default function SectionHeader({
  badge, title, highlight, subtitle, center = false, className, titleSize,
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-16', center && 'text-center', className)}>
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55 }}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5',
          'border border-orbit-blue/40 bg-orbit-blue/10',
          'text-orbit-blue text-xs font-semibold tracking-widest uppercase',
          center && 'mx-auto',
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-orbit-blue2 animate-pulse" />
        {badge}
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.75, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'font-display font-bold tracking-tight leading-tight mb-4',
          titleSize ?? 'text-4xl md:text-5xl lg:text-[56px]',
        )}
      >
        {title}{' '}
        <span className="gradient-text-blue">{highlight}</span>
      </motion.h2>

      {/* Subtitle */}
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.2 }}
          className={cn(
            'text-[17px] text-slate-400 leading-relaxed max-w-xl',
            center && 'mx-auto',
          )}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
