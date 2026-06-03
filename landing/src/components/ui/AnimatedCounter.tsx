'use client';

import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

interface AnimatedCounterProps {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  format?: 'k' | 'raw';
}

export default function AnimatedCounter({
  to,
  suffix = '',
  prefix = '',
  duration = 2.4,
  format = 'k',
}: AnimatedCounterProps) {
  const ref       = useRef<HTMLSpanElement>(null);
  const isInView  = useInView(ref, { once: true });
  const started   = useRef(false);

  useEffect(() => {
    if (!isInView || !ref.current || started.current) return;
    started.current = true;

    const startTime = performance.now();
    const endTime   = startTime + duration * 1000;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    function frame(now: number) {
      const progress = Math.min((now - startTime) / (endTime - startTime), 1);
      const value    = Math.round(easeOut(progress) * to);

      let display = '';
      if (format === 'k' && value >= 1000) {
        display = Math.floor(value / 1000) + 'K';
      } else {
        display = value.toLocaleString();
      }

      if (ref.current) {
        ref.current.textContent = prefix + display + suffix;
      }

      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }, [isInView, to, duration, suffix, prefix, format]);

  return (
    <span ref={ref}>
      {prefix}0{suffix}
    </span>
  );
}
