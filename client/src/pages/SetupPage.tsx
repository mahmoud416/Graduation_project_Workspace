import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1`;

const BLUE = '#1d6ef5';
const GRN  = '#10b981';
const AMB  = '#f59e0b';
const RED  = '#ef4444';
const PURP = '#8b5cf6';

/* ─── Password strength ──────────────────────────────────────────────────── */
function pwStrength(p: string): { score: number; label: string; color: string } {
    if (!p)         return { score: 0, label: '',        color: 'transparent' };
    if (p.length < 8) return { score: 1, label: 'Too short', color: RED };
    const has = (re: RegExp) => re.test(p);
    let s = 1;
    if (has(/[A-Z]/))    s++;
    if (has(/[0-9]/))    s++;
    if (has(/[^A-Za-z0-9]/)) s++;
    if (p.length >= 12)  s++;
    if (s <= 2) return { score: s, label: 'Weak',     color: RED   };
    if (s <= 3) return { score: s, label: 'Fair',     color: AMB   };
    if (s <= 4) return { score: s, label: 'Strong',   color: GRN   };
    return              { score: s, label: 'Very strong', color: GRN };
}

/* ─── Eye icons ──────────────────────────────────────────────────────────── */
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

/* ─── Form field ─────────────────────────────────────────────────────────── */
function Field({
    label, type = 'text', value, onChange, placeholder, required, autoComplete,
    rightSlot, hint, error: fieldError,
    isDark,
}: {
    label: string; type?: string; value: string; onChange: (v: string) => void;
    placeholder?: string; required?: boolean; autoComplete?: string;
    rightSlot?: React.ReactNode; hint?: string; error?: string;
    isDark: boolean;
}) {
    const inbg = isDark ? 'rgba(255,255,255,.04)' : '#ffffff';
    const inbd = isDark ? 'rgba(255,255,255,.1)'  : 'rgba(0,0,0,.1)';
    const textC = isDark ? '#f1f4f9' : '#0f172a';
    const labelC = isDark ? '#94a3b8' : '#374151';
    const errBd  = fieldError ? RED : undefined;

    return (
        <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: labelC, marginBottom: 5 }}>
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    autoComplete={autoComplete}
                    style={{
                        width: '100%', padding: rightSlot ? '9px 38px 9px 12px' : '9px 12px',
                        background: inbg, border: `1.5px solid ${errBd ?? inbd}`,
                        borderRadius: 8, color: textC, fontSize: 14,
                        outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit',
                        transition: 'border-color .15s, box-shadow .15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,110,245,.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = errBd ?? inbd; e.currentTarget.style.boxShadow = 'none'; }}
                />
                {rightSlot && (
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                        {rightSlot}
                    </div>
                )}
            </div>
            {fieldError && <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>{fieldError}</div>}
            {hint && !fieldError && <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,.35)' : '#94a3b8', marginTop: 4 }}>{hint}</div>}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SETUP PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function SetupPage() {
    const navigate   = useNavigate();
    const { isDark } = useTheme();

    const [fullName,  setFullName]  = useState('');
    const [email,     setEmail]     = useState('');
    const [password,  setPassword]  = useState('');
    const [confirm,   setConfirm]   = useState('');
    const [showPwd,   setShowPwd]   = useState(false);
    const [showConf,  setShowConf]  = useState(false);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState<string | null>(null);
    const [done,      setDone]      = useState(false);

    const strength   = pwStrength(password);
    const pwOk       = password.length >= 8;
    const confirmErr = confirm && confirm !== password ? 'Passwords do not match' : '';
    const canSubmit  = fullName.trim() && email && pwOk && confirm === password && !loading;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!pwOk) { setError('Password must be at least 8 characters.'); return; }
        if (password !== confirm) { setError('Passwords do not match.'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName.trim(), email, password }),
            });
            if (res.status === 409) {
                setError('A Founder account already exists. Please sign in.');
                return;
            }
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.detail || 'Setup failed. Please try again.');
            }
            setDone(true);
            setTimeout(() => navigate('/login', { replace: true }), 2200);
        } catch (err: any) {
            setError(err.message || 'Setup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /* ── Theme tokens ── */
    const pageBg   = isDark ? '#0a0c14' : '#f5f6fa';
    const cardBg   = isDark ? '#111420' : '#ffffff';
    const cardBd   = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
    const textH    = isDark ? '#f1f4f9' : '#0f172a';
    const textSub  = isDark ? '#64748b' : '#64748b';
    const eyeC     = isDark ? '#64748b' : '#94a3b8';

    /* ── Success state ── */
    if (done) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pageBg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s', padding: 20 }}>
                <div style={{ textAlign: 'center', padding: '48px 40px', background: cardBg, border: `1px solid ${cardBd}`, borderRadius: 16, maxWidth: 360, width: '100%', boxShadow: isDark ? '0 24px 64px rgba(0,0,0,.4)' : '0 8px 32px rgba(0,0,0,.08)', animation: 'setupFadeUp .4s ease-out both' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${GRN}14`, border: `1px solid ${GRN}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: textH, marginBottom: 8, letterSpacing: '-.02em' }}>Founder account created</h2>
                    <p style={{ fontSize: 14, color: textSub, lineHeight: 1.65, marginBottom: 0 }}>
                        Setup is complete. Redirecting to sign in…
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pageBg, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', transition: 'background .2s', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 420, animation: 'setupFadeUp .4s ease-out both' }}>

                {/* Card */}
                <div style={{ background: cardBg, border: `1px solid ${cardBd}`, borderRadius: 16, padding: '36px 36px 32px', boxShadow: isDark ? '0 24px 64px rgba(0,0,0,.4)' : '0 8px 32px rgba(0,0,0,.08)' }}>

                    {/* Header */}
                    <div style={{ marginBottom: 28, textAlign: 'center' }}>
                        {/* Logo mark */}
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${BLUE}14`, border: `1px solid ${BLUE}28`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: textH, letterSpacing: '-.02em', marginBottom: 6 }}>
                            Create Founder account
                        </h1>
                        <p style={{ fontSize: 13, color: textSub, lineHeight: 1.6 }}>
                            This runs once. After completion, this page is permanently disabled.
                        </p>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', marginBottom: 24 }} />

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Full name */}
                        <Field
                            label="Full name"
                            value={fullName}
                            onChange={setFullName}
                            placeholder="e.g. Alex Carter"
                            required
                            autoComplete="name"
                            isDark={isDark}
                        />

                        {/* Email */}
                        <Field
                            label="Email address"
                            type="email"
                            value={email}
                            onChange={setEmail}
                            placeholder="founder@example.com"
                            required
                            autoComplete="email"
                            isDark={isDark}
                        />

                        {/* Password */}
                        <div>
                            <Field
                                label="Password"
                                type={showPwd ? 'text' : 'password'}
                                value={password}
                                onChange={setPassword}
                                placeholder="At least 8 characters"
                                required
                                autoComplete="new-password"
                                isDark={isDark}
                                rightSlot={
                                    <button type="button" onClick={() => setShowPwd(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: eyeC, padding: 0, display: 'flex', alignItems: 'center', transition: 'color .15s' }}>
                                        {showPwd ? <EyeOff /> : <EyeOn />}
                                    </button>
                                }
                            />
                            {/* Strength bar */}
                            {password.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i <= strength.score ? strength.color : (isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'), transition: 'background .3s' }} />
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 11, color: strength.color }}>{strength.label}</div>
                                </div>
                            )}
                        </div>

                        {/* Confirm password */}
                        <Field
                            label="Confirm password"
                            type={showConf ? 'text' : 'password'}
                            value={confirm}
                            onChange={setConfirm}
                            placeholder="Re-enter password"
                            required
                            autoComplete="new-password"
                            error={confirmErr}
                            isDark={isDark}
                            rightSlot={
                                <button type="button" onClick={() => setShowConf(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: eyeC, padding: 0, display: 'flex', alignItems: 'center', transition: 'color .15s' }}>
                                    {showConf ? <EyeOff /> : <EyeOn />}
                                </button>
                            }
                        />

                        {/* Privilege notice */}
                        <div style={{ display: 'flex', gap: 10, padding: '10px 12px', background: isDark ? `${PURP}08` : `${PURP}06`, border: `1px solid ${PURP}20`, borderRadius: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PURP} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                            </svg>
                            <span style={{ fontSize: 12, color: PURP, lineHeight: 1.55 }}>
                                This account will have <strong>Founder</strong> privileges — full platform access.
                            </span>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: isDark ? 'rgba(239,68,68,.08)' : '#fef2f2', border: `1px solid ${isDark ? 'rgba(239,68,68,.2)' : '#fecaca'}`, borderRadius: 8 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <span style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            style={{
                                width: '100%', padding: '10px 0', marginTop: 4,
                                background: canSubmit ? 'linear-gradient(135deg, #1d6ef5 0%, #0ea5e9 100%)' : (isDark ? 'rgba(29,110,245,.25)' : 'rgba(29,110,245,.35)'),
                                border: 'none', borderRadius: 8, color: 'white',
                                fontSize: 14, fontWeight: 600,
                                cursor: canSubmit ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                fontFamily: 'inherit',
                                boxShadow: canSubmit ? '0 2px 12px rgba(29,110,245,.3)' : 'none',
                                transition: 'all .15s',
                            }}
                            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.opacity = '.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >
                            {loading ? (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'setupSpin .8s linear infinite' }}>
                                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                                    </svg>
                                    Creating account…
                                </>
                            ) : 'Create Founder Account'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p style={{ textAlign: 'center', fontSize: 12, color: isDark ? '#334155' : '#94a3b8', marginTop: 16, lineHeight: 1.6 }}>
                    Already have an account?{' '}
                    <button type="button" onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BLUE, fontSize: 12, fontWeight: 500, padding: 0 }}>
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
}
