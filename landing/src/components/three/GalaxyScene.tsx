'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function circleTex(size = 64, soft = 0.22): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!, r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(soft, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function nebulaTex(size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!, r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(0.4, 'rgba(255,255,255,0.15)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// ── Stars ──────────────────────────────────────────────────────────────────
function StarField({ count = 7000 }: { count?: number }) {
  const tex = useMemo(() => circleTex(64, 0.18), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 55 + Math.random() * 180, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      pos[i*3] = r * Math.sin(p) * Math.cos(t); pos[i*3+1] = r * Math.sin(p) * Math.sin(t); pos[i*3+2] = r * Math.cos(p);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
  }, [count]);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.005; });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={tex} alphaMap={tex} color="#aabbff" size={0.30} transparent opacity={0.68} sizeAttenuation depthWrite={false} alphaTest={0.01} />
    </points>
  );
}

// ── Space dust ─────────────────────────────────────────────────────────────
function SpaceDust({ count = 3000 }: { count?: number }) {
  const tex = useMemo(() => circleTex(32, 0.2), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 12 + Math.random() * 70, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      pos[i*3] = r * Math.sin(p) * Math.cos(t); pos[i*3+1] = r * Math.sin(p) * Math.sin(t); pos[i*3+2] = r * Math.cos(p);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
  }, [count]);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => { if (ref.current) { ref.current.rotation.y = clock.getElapsedTime() * 0.007; ref.current.rotation.x = clock.getElapsedTime() * 0.003; } });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={tex} alphaMap={tex} color="#8899cc" size={0.13} transparent opacity={0.25} sizeAttenuation depthWrite={false} alphaTest={0.01} />
    </points>
  );
}

// ── Nebula clouds ──────────────────────────────────────────────────────────
function NebulaCloud({ color, cx, cy, cz, spread, count }: { color: string; cx: number; cy: number; cz: number; spread: number; count: number }) {
  const tex = useMemo(() => nebulaTex(128), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() + Math.random() - 1) * spread * 0.55 + cx;
      pos[i*3+1] = (Math.random() + Math.random() - 1) * spread * 0.20 + cy;
      pos[i*3+2] = (Math.random() + Math.random() - 1) * spread * 0.35 + cz;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
  }, [count, cx, cy, cz, spread]);
  return (
    <points geometry={geo}>
      <pointsMaterial map={tex} alphaMap={tex} color={color} size={5.0} transparent opacity={0.065} sizeAttenuation depthWrite={false} alphaTest={0.001} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── Shooting stars ─────────────────────────────────────────────────────────
function ShootingStars() {
  const ref = useRef<THREE.Group>(null);
  type S = { line: THREE.Line; vx: number; vy: number; life: number };
  const pool = useRef<S[]>([]);
  useFrame(() => {
    const g = ref.current; if (!g) return;
    if (Math.random() < 0.0035) {
      const geo = new THREE.BufferGeometry();
      const sx = (Math.random() - 0.5) * 95, sy = (Math.random() - 0.5) * 58, sz = (Math.random() - 0.5) * 25;
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([sx, sy, sz, sx-10, sy-3.5, sz]), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
      const line = new THREE.Line(geo, mat); g.add(line);
      pool.current.push({ line, vx: -0.38, vy: -0.13, life: 1 });
    }
    for (let i = pool.current.length - 1; i >= 0; i--) {
      const s = pool.current[i];
      s.line.position.x += s.vx; s.line.position.y += s.vy; s.life -= 0.019;
      (s.line.material as THREE.LineBasicMaterial).opacity = s.life * 0.8;
      if (s.life <= 0) { g.remove(s.line); s.line.geometry.dispose(); (s.line.material as THREE.Material).dispose(); pool.current.splice(i, 1); }
    }
  });
  return <group ref={ref} />;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.07} color="#050520" />
      <StarField count={7000} />
      <SpaceDust count={3000} />
      <NebulaCloud color="#1a5fff" cx={-16} cy={6}   cz={-18} spread={70} count={220} />
      <NebulaCloud color="#6622bb" cx={14}  cy={-5}  cz={-14} spread={60} count={185} />
      <NebulaCloud color="#0077aa" cx={3}   cy={10}  cz={-22} spread={55} count={160} />
      <NebulaCloud color="#1a4fff" cx={22}  cy={3}   cz={-24} spread={45} count={130} />
      <ShootingStars />
    </>
  );
}

export default function GalaxyScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 65, near: 0.1, far: 550 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.6]}
      style={{ background: 'transparent' }}
    >
      <Scene />
    </Canvas>
  );
}
