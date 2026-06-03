'use client';

import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  glowColor?: string;
  topLine?: boolean;
  as?: 'div' | 'article' | 'section';
}

const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

export default function GlassCard({
  children,
  className,
  hover = true,
  delay = 0,
  glowColor,
  topLine = false,
}: GlassCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay }}
      whileHover={hover ? { y: -4, borderColor: 'rgba(255,255,255,0.13)' } : undefined}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-white/[0.03] border border-white/[0.07]',
        'backdrop-blur-sm transition-all duration-300',
        hover && 'hover:shadow-card cursor-default',
        glowColor && `hover:shadow-[0_0_40px_${glowColor}]`,
        className,
      )}
    >
      {topLine && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(26,111,255,.5),transparent)' }}
        />
      )}
      {children}
    </motion.div>
  );
}
