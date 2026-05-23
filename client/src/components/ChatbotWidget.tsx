import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
    id: number;
    from: 'user' | 'bot';
    text: string;
    time: string;
}

const BOT_NAME = 'Workspace Assistant';

const now = () =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

const GREETING: Message = {
    id: 0,
    from: 'bot',
    text: "Hi there! 👋 I'm your Workspace Assistant. Ask me about projects, tasks, team members, calendar, or anything else you need help with.",
    time: now(),
};

const getBotReply = (input: string): string => {
    const t = input.toLowerCase().trim();

    if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|مرحبا|أهلا|سلام)/.test(t))
        return "Hello! 👋 How can I help you today?";

    if (/(thank|شكر)/.test(t))
        return "You're welcome! Is there anything else I can help with? 😊";

    if (/(project|مشروع)/.test(t))
        return "📁 Projects are managed from the **Projects** page. Each card shows the project status, your team, and progress. Click any card to open its TaskFlow board.";

    if (/(task|todo|to-do|مهمة|تاسك)/.test(t))
        return "✅ Tasks live inside each project's **TaskFlow** board. You can add to-do items, mark them done, assign team members, and track progress. Completing tasks automatically updates the project progress.";

    if (/(calendar|تقويم|موعد)/.test(t))
        return "📅 The **Calendar** page shows your tasks and deadlines in a monthly/weekly view. It's great for planning upcoming work.";

    if (/(team|member|staff|colleague|فريق|موظف)/.test(t))
        return "👥 The **Team** page lists all workspace members with their roles. Admins can manage assignments and access levels from there.";

    if (/(report|analytic|stat|progress|تقرير)/.test(t))
        return "📊 Head to the **Reports** page for project analytics, progress charts, and completion statistics across all your projects.";

    if (/(setting|profile|account|password|notification|إعدادات)/.test(t))
        return "⚙️ Visit **Settings** to update your profile, change your password, configure notifications, and switch between light and dark mode.";

    if (/(dashboard|home|الرئيسية)/.test(t))
        return "🏠 Your **Dashboard** gives you a quick overview of all assigned projects, recent activity, and key stats at a glance.";

    if (/(channel|public|#public|شانل)/.test(t))
        return "📢 **Channels** are workspace-wide spaces. **#public** is open to everyone. Click on a channel card from the Projects page to join the conversation.";

    if (/(admin|sub.?admin|role|صلاحية)/.test(t))
        return "🔑 Roles control access: **Admins** create projects and manage users. **Sub-admins** lead project teams. **Staff** work on assigned projects. Contact your admin to change roles.";

    if (/(login|logout|sign)/.test(t))
        return "🔐 You can log out from the bottom of the sidebar. To log in again, navigate to the login page.";

    if (/(help|assist|مساعدة)/.test(t))
        return "💡 I can help you navigate the workspace! Ask me about: **projects**, **tasks**, **calendar**, **team**, **reports**, **settings**, or **channels**.";

    if (/(bye|goodbye|see you|مع السلامة)/.test(t))
        return "Goodbye! 👋 Feel free to ask me anything anytime.";

    return "🤔 I'm not sure about that one. Try asking me about **projects**, **tasks**, **team**, **calendar**, or **reports** — or contact your admin for more specific help.";
};

// ─── ChatbotWidget ────────────────────────────────────────────────────────────

const ChatbotWidget = () => {
    const [open, setOpen]           = useState(false);
    const [messages, setMessages]   = useState<Message[]>([GREETING]);
    const [input, setInput]         = useState('');
    const [typing, setTyping]       = useState(false);
    const [unread, setUnread]       = useState(1);
    const bottomRef                 = useRef<HTMLDivElement>(null);
    const inputRef                  = useRef<HTMLInputElement>(null);
    const idRef                     = useRef(1);

    // Auto-scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    // Focus input when panel opens
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

        try {
            const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
            const token = localStorage.getItem('token') ?? '';
            
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: text })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get response from AI');
            }
            
            const data = await response.json();
            const botMsg: Message = { id: idRef.current++, from: 'bot', text: data.reply, time: now() };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg: Message = { 
                id: idRef.current++, 
                from: 'bot', 
                text: "Sorry, I'm having trouble connecting right now. Please try again later.", 
                time: now() 
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setTyping(false);
            if (!open) setUnread(n => n + 1);
        }
    }, [input, open]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatText = (text: string) => {
        // Bold **text**
        const parts = text.split(/\*\*(.+?)\*\*/g);
        return parts.map((part, i) =>
            i % 2 === 1
                ? <strong key={i} className="font-semibold">{part}</strong>
                : <span key={i}>{part}</span>
        );
    };

    return (
        <>
            {/* ── Chat panel ─────────────────────────────────────────────── */}
            {open && (
                <div
                    className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
                    style={{ height: '500px' }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-5 py-4 text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1d7bf4 0%, #4f46e5 100%)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                                </svg>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold leading-tight">{BOT_NAME}</p>
                                <p className="text-white/70 text-[10px]">Online · Ready to help</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
                            aria-label="Close chat"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.from === 'bot' && (
                                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold mr-2 mt-1 flex-shrink-0">
                                        AI
                                    </div>
                                )}
                                <div className={`max-w-[78%] flex flex-col gap-0.5 ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                        msg.from === 'user'
                                            ? 'bg-primary text-white rounded-br-sm'
                                            : 'bg-gray-100 dark:bg-gray-800 text-text-dark dark:text-gray-100 rounded-bl-sm'
                                    }`}>
                                        {formatText(msg.text)}
                                    </div>
                                    <span className="text-[10px] text-text-gray dark:text-gray-500 px-1">{msg.time}</span>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {typing && (
                            <div className="flex justify-start">
                                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold mr-2 mt-1 flex-shrink-0">
                                    AI
                                </div>
                                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm">
                                    <div className="flex gap-1 items-center h-4">
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 bg-white dark:bg-gray-900">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 text-text-dark dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-2.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                            type="button"
                            onClick={sendMessage}
                            disabled={!input.trim()}
                            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-primary text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            aria-label="Send message"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* ── Floating bubble button ──────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #1d7bf4 0%, #4f46e5 100%)' }}
                aria-label={open ? 'Close chat' : 'Open chat assistant'}
            >
                {/* Pulse ring */}
                {!open && unread > 0 && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-primary/40" />
                )}

                {/* Unread badge */}
                {!open && unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                        {unread}
                    </span>
                )}

                {/* Icon toggle */}
                <span className={`transition-all duration-200 ${open ? 'rotate-90 scale-90' : 'rotate-0 scale-100'}`}>
                    {open ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                    )}
                </span>
            </button>
        </>
    );
};

export default ChatbotWidget;
