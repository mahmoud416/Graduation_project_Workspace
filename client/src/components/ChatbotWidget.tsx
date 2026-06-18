import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface Message {
    id: number;
    from: 'user' | 'bot';
    text: string;
    time: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const now = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

const GREETING: Message = {
    id: 0,
    from: 'bot',
    text: "Hi! I'm the Orbit AI assistant. Ask me about projects, tasks, team members, quality reports, or anything in your workspace.",
    time: now(),
};

/* ─── Bold **text** formatter ─────────────────────────────────────────────── */
function BoldText({ text }: { text: string }) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return (
        <>
            {parts.map((part, i) =>
                i % 2 === 1
                    ? <strong key={i} style={{ fontWeight: 700, color: 'rgba(255,255,255,.95)' }}>{part}</strong>
                    : <span key={i}>{part}</span>
            )}
        </>
    );
}

/* ─── Orbit wordmark (small) ──────────────────────────────────────────────── */
function OrbitAIBrand() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Logo mark */}
            <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'rgba(29,110,245,.2)',
                border: '1px solid rgba(29,110,245,.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 0 12px rgba(29,110,245,.25)',
            }}>
                <span style={{
                    fontFamily: '"Space Grotesk","Inter",sans-serif',
                    fontWeight: 900, fontSize: 14, color: 'white',
                    position: 'relative', display: 'inline-block',
                }}>
                    O
                    <span style={{
                        position: 'absolute', top: 1, right: 0,
                        width: 4, height: 4, borderRadius: '50%',
                        background: '#1d6ef5',
                        boxShadow: '0 0 6px rgba(29,110,245,1)',
                    }} />
                </span>
            </div>
            <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>Orbit AI</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,.8)', display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>Online · AI Powered</span>
                </div>
            </div>
        </div>
    );
}

/* ─── ChatbotWidget ───────────────────────────────────────────────────────── */
const ChatbotWidget = () => {
    const location = useLocation();
    const [open,     setOpen]     = useState(false);
    const [messages, setMessages] = useState<Message[]>([GREETING]);
    const [input,    setInput]    = useState('');
    const [typing,   setTyping]   = useState(false);
    const [unread,   setUnread]   = useState(1);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef  = useRef<HTMLInputElement>(null);
    const idRef     = useRef(1);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

    useEffect(() => {
        if (open) {
            setUnread(0);
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [open]);

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text) return;

        const userMsg: Message = { id: idRef.current++, from: 'user', text, time: now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setTyping(true);

        const botId = idRef.current++;
        let appended = false;

        try {
            const token = localStorage.getItem('token') ?? '';
            const res = await fetch(`${API_BASE}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ message: text }),
            });
            if (!res.ok || !res.body) throw new Error('API error');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                const piece = decoder.decode(value, { stream: true });
                if (!piece) continue;

                if (!appended) {
                    appended = true;
                    setTyping(false);
                    setMessages(prev => [...prev, { id: botId, from: 'bot', text: piece, time: now() }]);
                } else {
                    setMessages(prev => prev.map(m =>
                        m.id === botId ? { ...m, text: m.text + piece } : m
                    ));
                }
            }

            if (!appended) {
                setMessages(prev => [...prev, {
                    id: botId, from: 'bot',
                    text: "I'm having trouble connecting right now. Please try again in a moment.",
                    time: now(),
                }]);
            }
        } catch {
            setMessages(prev => [...prev, {
                id: idRef.current++, from: 'bot',
                text: "I'm having trouble connecting right now. Please try again in a moment.",
                time: now(),
            }]);
        } finally {
            setTyping(false);
            if (!open) setUnread(n => n + 1);
        }
    }, [input, open]);

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    /* Hide on project workspace — sidebar already has team chat */
    if (location.pathname.startsWith('/workspace')) return null;

    return (
        <>

            {/* ══ Chat panel ══════════════════════════════════════════════════ */}
            {open && (
                <div
                    style={{
                        position: 'fixed', bottom: 88, right: 24, zIndex: 50,
                        width: 370, maxWidth: 'calc(100vw - 3rem)',
                        height: 520,
                        display: 'flex', flexDirection: 'column',
                        borderRadius: 18,
                        background: 'rgba(10,12,20,0.96)',
                        border: '1px solid rgba(29,110,245,.16)',
                        boxShadow: '0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)',
                        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                        overflow: 'hidden',
                        animation: 'cbFadeUp .25s ease-out both',
                    }}
                >
                    {/* Top accent line */}
                    <div style={{ height: 2, background: 'linear-gradient(to right, transparent, #1d6ef5, #8b5cf6, transparent)', flexShrink: 0 }} />

                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px 12px',
                        borderBottom: '1px solid rgba(255,255,255,.06)',
                        flexShrink: 0,
                        background: 'rgba(29,110,245,.04)',
                    }}>
                        <OrbitAIBrand />
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: 'rgba(255,255,255,.06)',
                                border: '1px solid rgba(255,255,255,.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'rgba(255,255,255,.5)',
                                transition: 'all .15s',
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="cb-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {messages.map(msg => (
                            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                                {/* Bot avatar */}
                                {msg.from === 'bot' && (
                                    <div style={{
                                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                                        background: 'rgba(29,110,245,.2)',
                                        border: '1px solid rgba(29,110,245,.35)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9, fontWeight: 900, color: '#1d6ef5',
                                        fontFamily: 'monospace', marginBottom: 2,
                                    }}>AI</div>
                                )}
                                <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: msg.from === 'user' ? 'flex-end' : 'flex-start' }}>
                                    <div style={{
                                        padding: '9px 13px',
                                        borderRadius: msg.from === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                                        fontSize: 13, lineHeight: 1.6,
                                        ...(msg.from === 'user' ? {
                                            background: 'linear-gradient(135deg, #1d6ef5, #0ea5e9)',
                                            color: 'white',
                                            boxShadow: '0 2px 12px rgba(29,110,245,.3)',
                                        } : {
                                            background: 'rgba(255,255,255,.05)',
                                            border: '1px solid rgba(255,255,255,.07)',
                                            color: 'rgba(255,255,255,.82)',
                                        }),
                                    }}>
                                        <BoldText text={msg.text} />
                                    </div>
                                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,.22)', paddingInline: 3, fontFamily: 'monospace' }}>{msg.time}</span>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {typing && (
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                                <div style={{
                                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                                    background: 'rgba(29,110,245,.2)', border: '1px solid rgba(29,110,245,.35)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, fontWeight: 900, color: '#1d6ef5', fontFamily: 'monospace',
                                }}>AI</div>
                                <div style={{
                                    padding: '10px 14px', borderRadius: '14px 14px 14px 3px',
                                    background: 'rgba(255,255,255,.05)',
                                    border: '1px solid rgba(255,255,255,.07)',
                                    display: 'flex', gap: 4, alignItems: 'center',
                                }}>
                                    {[0, 150, 300].map(d => (
                                        <span key={d} style={{
                                            width: 5, height: 5, borderRadius: '50%',
                                            background: 'rgba(29,110,245,.7)',
                                            animation: `cbBounce 1.2s ease-in-out ${d}ms infinite`,
                                            display: 'block',
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div style={{
                        flexShrink: 0,
                        borderTop: '1px solid rgba(255,255,255,.06)',
                        padding: '10px 12px',
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'rgba(255,255,255,.02)',
                    }}>
                        <input
                            ref={inputRef}
                            className="cb-input"
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder="Ask Orbit AI…"
                            style={{
                                flex: 1, fontSize: 13,
                                background: 'rgba(255,255,255,.04)',
                                border: '1px solid rgba(255,255,255,.08)',
                                borderRadius: 10, padding: '9px 13px',
                                color: 'white', fontFamily: 'inherit',
                                transition: 'border-color .2s, box-shadow .2s',
                            }}
                        />
                        <button
                            type="button"
                            onClick={sendMessage}
                            disabled={!input.trim()}
                            className="cb-send"
                            style={{
                                width: 38, height: 38, flexShrink: 0,
                                borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: 'rgba(29,110,245,.7)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', transition: 'all .18s',
                                boxShadow: '0 2px 10px rgba(29,110,245,.25)',
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* ══ Floating trigger button ══════════════════════════════════════ */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 50,
                    width: 52, height: 52, borderRadius: '50%',
                    background: open
                        ? 'rgba(29,110,245,.2)'
                        : 'linear-gradient(135deg, #1d6ef5 0%, #0ea5e9 100%)',
                    border: open ? '1px solid rgba(29,110,245,.4)' : 'none',
                    cursor: 'pointer', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: open ? 'none' : '0 8px 28px rgba(29,110,245,.5)',
                    transition: 'all .22s cubic-bezier(.25,.46,.45,.94)',
                    transform: open ? 'rotate(45deg)' : 'rotate(0)',
                }}
                aria-label={open ? 'Close Orbit AI' : 'Open Orbit AI'}
            >
                {/* Pulse ring when closed and unread */}
                {!open && unread > 0 && (
                    <span style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'rgba(29,110,245,.4)',
                        animation: 'cbPing 1.5s ease-in-out infinite',
                    }} />
                )}

                {/* Unread badge */}
                {!open && unread > 0 && (
                    <span style={{
                        position: 'absolute', top: -3, right: -3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#ef4444', color: 'white',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #05060f',
                    }}>{unread}</span>
                )}

                {/* Icon */}
                {open ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                )}
            </button>

        </>
    );
};

export default ChatbotWidget;
