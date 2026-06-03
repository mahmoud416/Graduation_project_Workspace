'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// ── Texture helpers ────────────────────────────────────────────────────────
function createCircleTex(size = 64, sharpness = 0.2): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0,         'rgba(255,255,255,1)');
  g.addColorStop(sharpness, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.65,      'rgba(255,255,255,0.15)');
  g.addColorStop(1,         'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function createNebulaTex(size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0,   'rgba(255,255,255,0.6)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.75,'rgba(255,255,255,0.04)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// ── Logo ────────────────────────────────────────────────────────────────────
function OrbitLogo() {
  const divRef = useRef<HTMLDivElement>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.getElapsedTime() * 0.9) * 0.025;
    if (divRef.current) divRef.current.style.transform = `scale(${s})`;
  });
  return (
    <Html center zIndexRange={[10, 20]} style={{ pointerEvents: 'none' }}>
      <div ref={divRef} style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', willChange: 'transform' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lilogo.svg" alt="Orbit" style={{
          width: '100%', height: '100%', objectFit: 'contain',
          filter: 'drop-shadow(0 0 16px rgba(26,111,255,0.9)) drop-shadow(0 0 40px rgba(26,111,255,0.5))',
        }} />
      </div>
    </Html>
  );
}

// ── Glow core ────────────────────────────────────────────────────────────────
function GlowCore() {
  const icoRef = useRef<THREE.Mesh>(null);
  const atm1   = useRef<THREE.Mesh>(null);
  const light1 = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (icoRef.current) { icoRef.current.rotation.y += 0.008; icoRef.current.rotation.x += 0.003; }
    if (atm1.current)   atm1.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06);
    if (light1.current) light1.current.intensity = 12 + Math.sin(t * 2.2) * 3;
  });
  return (
    <group>
      <mesh ref={icoRef}>
        <icosahedronGeometry args={[0.25, 2]} />
        <meshStandardMaterial color="#3399ff" emissive="#1166ff" emissiveIntensity={3} roughness={0.05} metalness={0.9} />
      </mesh>
      <mesh ref={atm1}>
        <sphereGeometry args={[0.55, 20, 20]} />
        <meshBasicMaterial color="#1a6fff" transparent opacity={0.08} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <pointLight ref={light1} color="#1a6fff" intensity={12} distance={18} decay={2} />
      <pointLight color="#7733ff" intensity={4} distance={10} decay={2} position={[0, 1, 0]} />
    </group>
  );
}

// ── 5 energy rings ────────────────────────────────────────────────────────────
type RC = { radius: number; tube: number; color: string; opacity: number; rx: number; ry: number; rz: number; sx: number; sy: number; sz: number };
const RINGS: RC[] = [
  { radius: 1.80, tube: 0.016, color: '#1a6fff', opacity: 0.70, rx: 0,     ry: 0,   rz: 0,    sx: 0,     sy: 0.012, sz: 0     },
  { radius: 2.40, tube: 0.012, color: '#4499ff', opacity: 0.55, rx: 1.05,  ry: 0,   rz: 0,    sx: 0,     sy: 0.009, sz: 0.004 },
  { radius: 3.00, tube: 0.010, color: '#8b5cf6', opacity: 0.42, rx: -0.70, ry: 0.4, rz: 0,    sx: 0.006, sy: 0,     sz: 0.007 },
  { radius: 3.55, tube: 0.008, color: '#00ccff', opacity: 0.30, rx: 0.30,  ry: 1.2, rz: 0,    sx: 0.005, sy: 0.004, sz: 0     },
  { radius: 4.10, tube: 0.006, color: '#1a6fff', opacity: 0.18, rx: -1.40, ry: 0,   rz: 0.60, sx: 0.003, sy: 0.002, sz: 0.006 },
];

function EnergyRing({ r }: { r: RC }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) { ref.current.rotation.x += r.sx; ref.current.rotation.y += r.sy; ref.current.rotation.z += r.sz; } });
  return (
    <mesh ref={ref} rotation={[r.rx, r.ry, r.rz]}>
      <torusGeometry args={[r.radius, r.tube, 14, 140]} />
      <meshBasicMaterial color={r.color} transparent opacity={r.opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── 2 energy pulses ────────────────────────────────────────────────────────
function Pulse({ offset = 0, color = '#1a6fff' }: { offset?: number; color?: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat  = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = ((clock.getElapsedTime() + offset) % 4) / 4;
    if (mesh.current) mesh.current.scale.setScalar(0.3 + t * 5.5);
    if (mat.current)  mat.current.opacity = Math.max(0, 0.45 * (1 - t * 1.5));
  });
  return (
    <mesh ref={mesh}>
      <torusGeometry args={[0.9, 0.022, 8, 90]} />
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── Light trails ───────────────────────────────────────────────────────────
const TC = 90;
type TP = { radius: number; tiltX: number; tiltZ: number; speed: number; color: string; startAngle?: number };

function LightTrail({ radius, tiltX, tiltZ, speed, color, startAngle = 0 }: TP) {
  const headRef  = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const angleRef = useRef(startAngle);
  const tc       = useMemo(() => new THREE.Color(color), [color]);
  const trailTex = useMemo(() => createCircleTex(32, 0.15), []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(TC * 3), col = new Float32Array(TC * 3);
    for (let i = 0; i < TC; i++) {
      const a = startAngle - (i / TC) * Math.PI * 0.9;
      pos[i*3] = radius * Math.cos(a); pos[i*3+1] = 0; pos[i*3+2] = radius * Math.sin(a);
      const b = Math.pow(1 - i / TC, 1.8);
      col[i*3] = tc.r * b; col[i*3+1] = tc.g * b; col[i*3+2] = tc.b * b;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    return g;
  }, [radius, startAngle, tc]);

  useFrame(() => {
    angleRef.current += speed;
    const a = angleRef.current;
    const pos = geo.attributes.position.array as Float32Array;
    const col = geo.attributes.color.array   as Float32Array;
    for (let i = 0; i < TC; i++) {
      const pa = a - (i / TC) * Math.PI * 0.9;
      pos[i*3] = radius * Math.cos(pa); pos[i*3+1] = 0; pos[i*3+2] = radius * Math.sin(pa);
      const b = Math.pow(1 - i / TC, 1.8);
      col[i*3] = tc.r * b; col[i*3+1] = tc.g * b; col[i*3+2] = tc.b * b;
    }
    geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    const hx = radius * Math.cos(a), hz = radius * Math.sin(a);
    if (headRef.current)  headRef.current.position.set(hx, 0, hz);
    if (lightRef.current) lightRef.current.position.set(hx, 0, hz);
  });

  return (
    <group rotation={[tiltX, 0, tiltZ]}>
      <points geometry={geo}>
        <pointsMaterial vertexColors map={trailTex} size={0.08} transparent opacity={1}
          sizeAttenuation depthWrite={false} alphaTest={0.01} blending={THREE.AdditiveBlending} />
      </points>
      <mesh ref={headRef}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight ref={lightRef} color={color} intensity={3} distance={4} decay={2} />
    </group>
  );
}

// ── Particles ──────────────────────────────────────────────────────────────
function SpaceDust() {
  const tex = useMemo(() => createCircleTex(32, 0.18), []);
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(280 * 3);
    for (let i = 0; i < 280; i++) {
      const r = 2.2 + Math.random() * 3.0, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      pos[i*3] = r * Math.sin(p) * Math.cos(t); pos[i*3+1] = r * Math.sin(p) * Math.sin(t); pos[i*3+2] = r * Math.cos(p);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame(({ clock }) => { if (ref.current) { ref.current.rotation.y = clock.getElapsedTime() * 0.030; ref.current.rotation.x = clock.getElapsedTime() * 0.010; } });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={tex} alphaMap={tex} color="#4488ff" size={0.055} transparent opacity={0.45} sizeAttenuation depthWrite={false} alphaTest={0.01} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── Camera ─────────────────────────────────────────────────────────────────
function CameraRig() {
  const mouse = useRef({ x: 0, y: 0 });
  const { size } = useThree();
  useEffect(() => {
    const fn = (e: MouseEvent) => { mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2; mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener('mousemove', fn, { passive: true });
    return () => window.removeEventListener('mousemove', fn);
  }, [size]);
  useFrame(({ camera }) => {
    camera.position.x += (mouse.current.x * 1.0 - camera.position.x) * 0.035;
    camera.position.y += (-mouse.current.y * 0.7 - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── Scene ──────────────────────────────────────────────────────────────────
function Scene() {
  return (
    <>
      <ambientLight intensity={0.15} color="#060620" />
      <GlowCore />
      <OrbitLogo />
      {RINGS.map((r, i) => <EnergyRing key={i} r={r} />)}
      <Pulse offset={0}    color="#1a6fff" />
      <Pulse offset={2.0}  color="#7744ff" />
      <LightTrail radius={2.30} tiltX={0.55}  tiltZ={0.0}  speed={0.026} color="#1a6fff" startAngle={0}            />
      <LightTrail radius={2.90} tiltX={-0.90} tiltZ={0.3}  speed={0.019} color="#8b5cf6" startAngle={Math.PI * 0.7} />
      <LightTrail radius={3.50} tiltX={1.20}  tiltZ={-0.4} speed={0.014} color="#00aaff" startAngle={Math.PI * 1.4} />
      <SpaceDust />
      <CameraRig />
    </>
  );
}

export default function LogoOrbit({ fov = 52, cameraZ = 8 }: { fov?: number; cameraZ?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 0, cameraZ], fov, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.6]}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
