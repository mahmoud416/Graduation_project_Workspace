import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import lilogo from '../assets/lilogo.svg';
import { useTheme } from '../contexts/useTheme';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const EyeOn = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
);

const EyeOff = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);

const FEATURES = [
    'AI-powered quality control and scoring',
    'Multi-team project and task management',
    'Accreditation report workflows',
    'Real-time analytics and insights',
];

export default function Login() {
    const navigate   = useNavigate();
    const { isDark } = useTheme();
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [showPwd,  setShowPwd]  = useState(false);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) throw new Error((await res.text()) || 'Authentication failed');
            const d = await res.json();
            localStorage.setItem('userId',   d._id);
            localStorage.setItem('role',     d.role);
            localStorage.setItem('fullName', d.name  ?? '');
            localStorage.setItem('email',    d.email ?? email);
            if (d.token) localStorage.setItem('token', d.token);
            window.dispatchEvent(new Event('workspace:user-update'));
            if      (d.role === 'founder')                                            navigate('/founder',         { replace: true });
            else if (d.role === 'sub_admin')                                          navigate('/subadmin',        { replace: true });
            else if (d.role === 'it_staff')                                           navigate('/it-portal',       { replace: true });
            else if (d.role === 'quality_control' || d.role === 'quality_manager')   navigate('/quality-control', { replace: true });
            else                                                                      navigate('/dashboard',       { replace: true });
        } catch (err: any) {
            setError(err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    /* ── Theme tokens for the form panel ── */
    const panelBg  = isDark ? '#0f172a'                   : '#ffffff';
    const titleC   = isDark ? '#f1f5f9'                   : '#0f172a';
    const subC     = isDark ? '#64748b'                   : '#64748b';
    const labelC   = isDark ? '#94a3b8'                   : '#374151';
    const inputBg  = isDark ? 'rgba(255,255,255,.04)'     : '#ffffff';
    const inputBd  = isDark ? 'rgba(255,255,255,.12)'     : '#e2e8f0';
    const inputC   = isDark ? '#f1f5f9'                   : '#0f172a';
    const eyeC     = isDark ? '#64748b'                   : '#94a3b8';
    const errorBg  = isDark ? 'rgba(239,68,68,.08)'       : '#fef2f2';
    const errorBd  = isDark ? 'rgba(239,68,68,.2)'        : '#fecaca';
    const errorC   = isDark ? '#f87171'                   : '#dc2626';
    const footerC  = isDark ? '#334155'                   : '#94a3b8';

    return (
        <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif' }}>
            <style>{`
                .login-input:focus  { border-color: #1d6ef5; box-shadow: 0 0 0 3px rgba(29,110,245,.12); outline: none; }
                .login-input::placeholder { color: ${isDark ? 'rgba(255,255,255,.25)' : '#94a3b8'}; }
                .login-btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(29,110,245,.4); }
                .login-btn:active:not(:disabled) { transform: translateY(0); }
            `}</style>

            {/* ══ LEFT: Brand panel (fixed dark — intentional branding surface) ══ */}
            <div className="hidden lg:flex" style={{
                width: 420, flexShrink: 0,
                background: 'linear-gradient(160deg, #0c1a38 0%, #071028 55%, #04091a 100%)',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '48px 52px',
                position: 'relative',
                overflow: 'hidden',
                borderRight: '1px solid rgba(29,110,245,.1)',
            }}>
                {/* Subtle ambient glow — no planets, no stars */}
                <div style={{ position: 'absolute', top: '10%', left: '-20%', width: 500, height: 420, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(29,110,245,.07) 0%, transparent 68%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '5%',  right: '-20%', width: 400, height: 320, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(139,92,246,.05) 0%, transparent 68%)', pointerEvents: 'none' }} />

                {/* Logo */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={lilogo} alt="Orbit" style={{ width: 36, height: 36, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(29,110,245,.5))' }} />
                    <span style={{ fontSize: 20, fontWeight: 800, color: 'white', fontFamily: '"Space Grotesk","Inter",sans-serif', letterSpacing: '-.01em' }}>Orbit</span>
                </div>

                {/* Center copy */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h2 style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-.02em', lineHeight: 1.25, marginBottom: 16 }}>
                        Quality management for the modern institution.
                    </h2>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', lineHeight: 1.75, marginBottom: 36 }}>
                        AI-powered accreditation workflows, project tracking, and team collaboration — all in one workspace.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                        {FEATURES.map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                                <div style={{ width: 18, height: 18, borderRadius: 5, background: 'rgba(29,110,245,.2)', border: '1px solid rgba(29,110,245,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="#1d6ef5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer status */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>All systems operational</span>
                </div>
            </div>

            {/* ══ RIGHT: Sign-in form ══ */}
            <div style={{
                flex: 1,
                background: panelBg,
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                padding: '64px 32px',
                transition: 'background .2s',
            }}>
                <div style={{ width: '100%', maxWidth: 380 }}>

                    {/* Mobile logo */}
                    <div className="flex lg:hidden" style={{ marginBottom: 36, alignItems: 'center', gap: 10 }}>
                        <img src={lilogo} alt="Orbit" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                        <span style={{ fontSize: 16, fontWeight: 800, color: titleC, fontFamily: '"Space Grotesk","Inter",sans-serif' }}>Orbit</span>
                    </div>

                    {/* Heading */}
                    <div style={{ marginBottom: 28 }}>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: titleC, letterSpacing: '-.02em', marginBottom: 6 }}>
                            Sign in to Orbit
                        </h1>
                        <p style={{ fontSize: 14, color: subC }}>
                            Enter your credentials to continue.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* Email */}
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: labelC, marginBottom: 5 }}>
                                Email address
                            </label>
                            <input
                                className="login-input"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                                style={{ width: '100%', padding: '9px 12px', background: inputBg, border: `1.5px solid ${inputBd}`, borderRadius: 8, fontSize: 14, color: inputC, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', transition: 'border-color .15s, box-shadow .15s' }}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: labelC, marginBottom: 5 }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="login-input"
                                    type={showPwd ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    style={{ width: '100%', padding: '9px 38px 9px 12px', background: inputBg, border: `1.5px solid ${inputBd}`, borderRadius: 8, fontSize: 14, color: inputC, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', transition: 'border-color .15s, box-shadow .15s' }}
                                />
                                <button type="button" onClick={() => setShowPwd(p => !p)}
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: eyeC, padding: 0, display: 'flex', alignItems: 'center', transition: 'color .15s' }}>
                                    {showPwd ? <EyeOff /> : <EyeOn />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: errorBg, border: `1px solid ${errorBd}`, borderRadius: 7 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={errorC} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <span style={{ fontSize: 13, color: errorC }}>{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            className="login-btn"
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', padding: '10px 0', marginTop: 2,
                                background: loading ? 'rgba(29,110,245,.5)' : 'linear-gradient(135deg, #1d6ef5 0%, #0ea5e9 100%)',
                                border: 'none', borderRadius: 8, color: 'white',
                                fontSize: 14, fontWeight: 600,
                                cursor: loading ? 'default' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                fontFamily: 'inherit',
                                boxShadow: loading ? 'none' : '0 2px 12px rgba(29,110,245,.3)',
                                transition: 'opacity .15s, transform .15s, box-shadow .15s',
                            }}
                        >
                            {loading ? (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'loginSpin .8s linear infinite' }}>
                                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                                    </svg>
                                    Signing in…
                                </>
                            ) : 'Sign in'}
                        </button>
                    </form>

                    <p style={{ marginTop: 24, fontSize: 12, color: footerC, textAlign: 'center', lineHeight: 1.65 }}>
                        Access is restricted to authorized personnel.
                        <br />Contact your administrator to request access.
                    </p>
                </div>
            </div>
        </div>
    );
}
