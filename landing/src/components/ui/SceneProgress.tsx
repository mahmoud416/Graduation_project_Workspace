'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const SCENES = [
  { id: 'hero',      label: 'Deep Space'      },
  { id: 'mission',   label: 'Orbit Ecosystem' },
  { id: 'workspace', label: 'Workspace'       },
  { id: 'projects',  label: 'Projects'        },
  { id: 'quality',   label: 'Quality AI'      },
  { id: 'analytics', label: 'Analytics'       },
  { id: 'team',      label: 'Mission Crew'    },
  { id: 'contact',   label: 'Contact'         },
];

export default function SceneProgress() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SCENES.forEach((scene, i) => {
      const el = document.getElementById(scene.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(i); },
        { threshold: 0.35 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-end gap-2.5">
      {SCENES.map((scene, i) => (
        <a
          key={scene.id}
          href={`#${scene.id}`}
          className="group relative flex items-center gap-2.5"
          title={scene.label}
        >
          {/* Label on hover */}
          <span className="absolute right-full mr-3 text-[10px] font-semibold text-slate-400 tracking-wide whitespace-nowrap
            opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            {scene.label}
          </span>
          {/* Indicator */}
          <motion.div
            animate={{
              width:           active === i ? 22 : 5,
              height:          5,
              backgroundColor: active === i ? '#1a6fff' : 'rgba(255,255,255,0.18)',
              boxShadow:       active === i ? '0 0 10px rgba(26,111,255,0.7)' : 'none',
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-full"
          />
        </a>
      ))}
    </div>
  );
}
