import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useTheme } from '../contexts/useTheme';

/* ── types ─────────────────────────────────────────────────────────────── */
interface FaqItem { q: string; a: string; }
interface GuideItem { icon: string; title: string; desc: string; steps: string[]; }
interface Category { id: string; icon: string; label: string; }

/* ── data ──────────────────────────────────────────────────────────────── */
const CATEGORIES: Category[] = [
    { id: 'all',       icon: '◈', label: 'All Topics' },
    { id: 'projects',  icon: '📁', label: 'Projects' },
    { id: 'tasks',     icon: '✅', label: 'Tasks' },
    { id: 'quality',   icon: '🎯', label: 'Quality Control' },
    { id: 'reports',   icon: '📊', label: 'Reports' },
    { id: 'team',      icon: '👥', label: 'Team' },
    { id: 'account',   icon: '⚙️', label: 'Account' },
];

const FAQS: (FaqItem & { category: string })[] = [
    {
        category: 'projects',
        q: 'How do I create a new project?',
        a: 'Go to Workspace → click "+ New Project" in the top-right corner. Fill in the project name, description, due date, and assign team members. Click "Create" to launch.',
    },
    {
        category: 'projects',
        q: 'How do I change a project\'s status?',
        a: 'Open the project → click the status badge (ACTIVE / ON HOLD / COMPLETED) at the top of the project page. Select the new status from the dropdown.',
    },
    {
        category: 'tasks',
        q: 'How do I submit a task for QC review?',
        a: 'Open the task → click "Submit for Review". Attach your PDF or Word document, select the report type, then click "Run AI Check". If the quality score is ≥ 85% the task auto-submits. If lower, review the AI feedback and improve your document first.',
    },
    {
        category: 'tasks',
        q: 'What does the AI quality score mean?',
        a: 'The score (0–100%) measures how well your document meets accreditation standards. Scoring is weighted: Structure 30%, Content Quality 30%, Completeness 20%, Formatting 10%, Accuracy 10%. You need ≥ 85% to pass.',
    },
    {
        category: 'tasks',
        q: 'Can I assign a task to multiple people?',
        a: 'Yes. When creating or editing a task, use the "Assignees" picker to select multiple team members. All assignees will be notified and can update the task.',
    },
    {
        category: 'quality',
        q: 'Which report types are supported?',
        a: 'Orbit supports 20 accreditation report types including Course Report, Program Report, Self-Study, Exam Results Analysis, Survey Analysis, Financial Reports, Field Training Reports, and more. The full list is available in the report-type selector when submitting.',
    },
    {
        category: 'quality',
        q: 'Why did my document fail QC?',
        a: 'Failed documents include a detailed breakdown showing which standards were not met and specific improvement suggestions. Review the "Failed Standards" and "Suggestions" sections in the QC result panel, then revise your document accordingly.',
    },
    {
        category: 'quality',
        q: 'Who can review QC submissions?',
        a: 'Users with the Quality Control or Quality Manager role can review, approve, or reject submissions from the Quality Control dashboard.',
    },
    {
        category: 'reports',
        q: 'How do I export a PDF report?',
        a: 'Go to Reports → click "↓ PDF" in the top-right toolbar. The browser\'s print dialog will open — choose "Save as PDF" as the destination. The report includes a cover page, executive summary, project portfolio table, and quality metrics.',
    },
    {
        category: 'reports',
        q: 'How often is report data refreshed?',
        a: 'Report data is pulled live from the API each time you open the Reports page. The timestamp "Last refreshed at …" shows when data was last loaded. Use the refresh button (↺) to manually reload.',
    },
    {
        category: 'team',
        q: 'How do I invite a new team member?',
        a: 'Go to User Management (admin) or Team page → click "Add Member" or "Invite". Enter their email and assign a role. They\'ll receive a login credential from the IT staff or admin.',
    },
    {
        category: 'team',
        q: 'What are the available user roles?',
        a: 'Orbit has 7 roles: Admin (full access), Sub-Admin (workspace management), Manager (project management), Staff (task execution), Quality Manager / Quality Control (QC workflows), IT Staff (system & credentials), and Founder (top-level analytics).',
    },
    {
        category: 'account',
        q: 'How do I change my password?',
        a: 'Go to Settings → Security tab → enter your current password and your new password, then click "Update Password".',
    },
    {
        category: 'account',
        q: 'How do I update my profile photo?',
        a: 'Go to Settings → Profile tab → click the avatar/photo area to upload a new image. Supported formats: JPG, PNG (max 2 MB).',
    },
    {
        category: 'account',
        q: 'How do I switch between light and dark mode?',
        a: 'Click your avatar in the top-right → select "Appearance" → toggle between Light and Dark. You can also access this from Settings → Appearance.',
    },
];

const GUIDES: (GuideItem & { category: string })[] = [
    {
        category: 'projects',
        icon: '🚀',
        title: 'Getting Started with Workspace',
        desc: 'Set up your first project and invite your team in minutes.',
        steps: [
            'Log in and navigate to "Workspace" in the sidebar',
            'Click "+ New Project" and fill in the project details',
            'Assign team members from the Members picker',
            'Create tasks inside the project and set due dates',
            'Monitor progress from the Dashboard',
        ],
    },
    {
        category: 'tasks',
        icon: '📋',
        title: 'Submitting a Task for AI Review',
        desc: 'Learn how to pass the AI quality check and get your task approved.',
        steps: [
            'Open your assigned task from My Projects or the project board',
            'Click "Submit for Review" and attach your PDF/Word document',
            'Select the correct report type from the dropdown (e.g., Course Report)',
            'Click "Run AI Quality Check" — wait for the score',
            'If score ≥ 85%: task auto-submits ✅. If lower: review the AI feedback and re-upload',
        ],
    },
    {
        category: 'quality',
        icon: '🎯',
        title: 'Managing QC Reviews',
        desc: 'For Quality Control staff — how to review and process submissions.',
        steps: [
            'Navigate to "Quality Control" in the sidebar',
            'View pending submissions in the review queue',
            'Click a submission to see the AI score, document preview, and standards breakdown',
            'Choose "Approve" (passes), "Revision Required" (send back with notes), or "Reject"',
            'The task owner is notified automatically',
        ],
    },
    {
        category: 'reports',
        icon: '📊',
        title: 'Generating an Analytics Report',
        desc: 'Export a professional PDF report for stakeholders.',
        steps: [
            'Go to "Reports" from the sidebar',
            'Wait for the dashboard to load all platform metrics',
            'Use status/priority filters to focus on specific projects',
            'Click "↓ PDF" to open the print dialog',
            'Select "Save as PDF" and save to your computer',
        ],
    },
];

/* ── component ──────────────────────────────────────────────────────────── */
const HelpPage = () => {
    const { isDark } = useTheme();
    const navigate = useNavigate();

    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery,    setSearchQuery]    = useState('');
    const [openFaq,        setOpenFaq]        = useState<number | null>(null);
    const [openGuide,      setOpenGuide]      = useState<number | null>(null);
    const [contactSent,    setContactSent]    = useState(false);
    const [contactMsg,     setContactMsg]     = useState('');

    /* theme tokens */
    const bg    = isDark ? '#0b0d14' : '#f0f4f8';
    const surf  = isDark ? '#111420' : '#ffffff';
    const surf2 = isDark ? '#161924' : '#f8fafc';
    const bord  = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
    const text  = isDark ? '#f0f4f9' : '#0f172a';
    const sub   = isDark ? 'rgba(255,255,255,.62)' : '#334155';
    const muted = isDark ? 'rgba(255,255,255,.28)' : '#94a3b8';
    const BD    = `1px solid ${bord}`;

    const S: React.CSSProperties = { background: surf, border: BD, borderRadius: 16 };

    /* filtered data */
    const q = searchQuery.toLowerCase();
    const filteredFaqs = FAQS.filter(f =>
        (activeCategory === 'all' || f.category === activeCategory) &&
        (!q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
    );
    const filteredGuides = GUIDES.filter(g =>
        (activeCategory === 'all' || g.category === activeCategory) &&
        (!q || g.title.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q))
    );

    const handleContactSend = () => {
        if (!contactMsg.trim()) return;
        setContactSent(true);
        setContactMsg('');
        setTimeout(() => setContactSent(false), 4000);
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
            <Sidebar />
            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', transition: 'margin .22s', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Header title="Help Center" />
                <main className="page-main" style={{ padding: '24px 28px 48px', fontFamily: '"Inter",-apple-system,sans-serif' }}>

                    {/* ── Hero ── */}
                    <div style={{ ...S, padding: '36px 32px', marginBottom: 24, background: isDark ? 'linear-gradient(135deg,#111420,#0f172a)' : 'linear-gradient(135deg,#eff6ff,#eef2ff)', position: 'relative', overflow: 'hidden' }}>
                        {/* decorative rings */}
                        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', border: '1px solid rgba(29,110,245,.12)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', top: -10, right: -10, width: 100, height: 100, borderRadius: '50%', border: '1px solid rgba(29,110,245,.18)', pointerEvents: 'none' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(29,110,245,.12)', border: '1px solid rgba(29,110,245,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>◈</div>
                            <div>
                                <h1 style={{ fontSize: 22, fontWeight: 900, color: text, letterSpacing: '-.02em', margin: 0 }}>Orbit Help Center</h1>
                                <p style={{ fontSize: 13, color: sub, margin: 0 }}>Everything you need to use the platform effectively</p>
                            </div>
                        </div>

                        {/* search */}
                        <div style={{ position: 'relative', maxWidth: 500 }}>
                            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="15" height="15" fill="none" stroke={muted} strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                            </svg>
                            <input
                                type="text"
                                placeholder="Search questions, guides, topics…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}`, background: isDark ? 'rgba(255,255,255,.05)' : '#fff', color: text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>

                    {/* ── Category pills ── */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                        {CATEGORIES.map(c => (
                            <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1px solid ${activeCategory === c.id ? 'rgba(29,110,245,.4)' : bord}`, background: activeCategory === c.id ? 'rgba(29,110,245,.12)' : surf2, color: activeCategory === c.id ? '#1d6ef5' : sub, fontSize: 12, fontWeight: activeCategory === c.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                                <span>{c.icon}</span>{c.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

                        {/* ── Left column ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* Quick Guides */}
                            {filteredGuides.length > 0 && (
                                <div style={S}>
                                    <div style={{ padding: '18px 20px', borderBottom: BD }}>
                                        <h2 style={{ fontSize: 14, fontWeight: 800, color: text, margin: 0 }}>Quick Guides</h2>
                                        <p style={{ fontSize: 12, color: muted, margin: '2px 0 0' }}>Step-by-step walkthroughs for common tasks</p>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 1, background: bord }}>
                                        {filteredGuides.map((g, i) => (
                                            <div key={i} style={{ background: surf, padding: '16px 18px', cursor: 'pointer', transition: 'background .15s' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.03)' : '#f8faff')}
                                                onMouseLeave={e => (e.currentTarget.style.background = surf)}
                                                onClick={() => setOpenGuide(openGuide === i ? null : i)}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                        <span style={{ fontSize: 20, flexShrink: 0 }}>{g.icon}</span>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 3 }}>{g.title}</div>
                                                            <div style={{ fontSize: 11, color: muted, lineHeight: 1.4 }}>{g.desc}</div>
                                                        </div>
                                                    </div>
                                                    <svg style={{ flexShrink: 0, marginTop: 2, transform: openGuide === i ? 'rotate(180deg)' : '', transition: 'transform .2s' }} width="12" height="12" fill="none" stroke={muted} strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                                                </div>
                                                {openGuide === i && (
                                                    <ol style={{ margin: '14px 0 0 30px', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                                                        {g.steps.map((step, si) => (
                                                            <li key={si} style={{ fontSize: 12, color: sub, lineHeight: 1.5 }}>
                                                                <span style={{ color: '#1d6ef5', fontWeight: 700, marginRight: 4 }}>{si + 1}.</span>{step}
                                                            </li>
                                                        ))}
                                                    </ol>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* FAQ */}
                            {filteredFaqs.length > 0 && (
                                <div style={S}>
                                    <div style={{ padding: '18px 20px', borderBottom: BD }}>
                                        <h2 style={{ fontSize: 14, fontWeight: 800, color: text, margin: 0 }}>Frequently Asked Questions</h2>
                                        <p style={{ fontSize: 12, color: muted, margin: '2px 0 0' }}>{filteredFaqs.length} questions</p>
                                    </div>
                                    <div>
                                        {filteredFaqs.map((f, i) => (
                                            <div key={i} style={{ borderBottom: i < filteredFaqs.length - 1 ? BD : 'none' }}>
                                                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background .15s' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.03)' : '#f8faff')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                    <span style={{ fontSize: 13, fontWeight: openFaq === i ? 700 : 500, color: openFaq === i ? '#1d6ef5' : text, lineHeight: 1.4 }}>{f.q}</span>
                                                    <svg style={{ flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : '', transition: 'transform .2s' }} width="13" height="13" fill="none" stroke={muted} strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                                                </button>
                                                {openFaq === i && (
                                                    <div style={{ padding: '0 20px 16px', fontSize: 13, color: sub, lineHeight: 1.65 }}>{f.a}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {filteredFaqs.length === 0 && filteredGuides.length === 0 && (
                                <div style={{ ...S, padding: 48, textAlign: 'center' }}>
                                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 6 }}>No results found</div>
                                    <div style={{ fontSize: 13, color: muted }}>Try different keywords or browse all topics</div>
                                    <button onClick={() => { setSearchQuery(''); setActiveCategory('all'); }} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1d6ef5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Show all topics</button>
                                </div>
                            )}
                        </div>

                        {/* ── Right column ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Quick links */}
                            <div style={S}>
                                <div style={{ padding: '16px 18px', borderBottom: BD }}>
                                    <h3 style={{ fontSize: 13, fontWeight: 800, color: text, margin: 0 }}>Quick Links</h3>
                                </div>
                                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {[
                                        { label: 'Dashboard',      path: '/dashboard',       icon: '🏠' },
                                        { label: 'Workspace',      path: '/projects',        icon: '📁' },
                                        { label: 'Reports',        path: '/reports',         icon: '📊' },
                                        { label: 'Quality Control',path: '/quality-control', icon: '🎯' },
                                        { label: 'Settings',       path: '/settings',        icon: '⚙️' },
                                    ].map(item => (
                                        <button key={item.path} onClick={() => navigate(item.path)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: sub, fontFamily: 'inherit', transition: 'background .12s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                            <span style={{ width: 28, height: 28, borderRadius: 7, background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Key features */}
                            <div style={S}>
                                <div style={{ padding: '16px 18px', borderBottom: BD }}>
                                    <h3 style={{ fontSize: 13, fontWeight: 800, color: text, margin: 0 }}>Platform Highlights</h3>
                                </div>
                                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[
                                        { icon: '🤖', title: 'AI Quality Check', desc: '20 accreditation report types scored automatically by Gemini AI' },
                                        { icon: '📈', title: 'Live Analytics', desc: 'Real-time project health, task burndown, and team productivity' },
                                        { icon: '🔔', title: 'Notifications', desc: 'Instant alerts for task assignments, QC results, and deadlines' },
                                        { icon: '🔒', title: 'Role-Based Access', desc: '7 user roles with fine-grained permissions across all features' },
                                    ].map((f, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(29,110,245,.08)', border: '1px solid rgba(29,110,245,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{f.icon}</span>
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 2 }}>{f.title}</div>
                                                <div style={{ fontSize: 11, color: muted, lineHeight: 1.4 }}>{f.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Contact support */}
                            <div style={{ ...S, padding: '18px' }}>
                                <h3 style={{ fontSize: 13, fontWeight: 800, color: text, margin: '0 0 4px' }}>Need more help?</h3>
                                <p style={{ fontSize: 12, color: muted, margin: '0 0 14px', lineHeight: 1.5 }}>Can't find what you're looking for? Send a message to the admin team.</p>
                                <textarea
                                    placeholder="Describe your issue or question…"
                                    value={contactMsg}
                                    onChange={e => setContactMsg(e.target.value)}
                                    rows={3}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${bord}`, background: isDark ? 'rgba(255,255,255,.04)' : '#f8fafc', color: text, fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
                                />
                                {contactSent ? (
                                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 9, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                                        ✅ Message sent — the admin team will get back to you soon.
                                    </div>
                                ) : (
                                    <button onClick={handleContactSend} style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 9, border: 'none', background: '#1d6ef5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity .15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                                        Send Message
                                    </button>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div style={{ marginTop: 32, padding: '14px 20px', borderRadius: 12, background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)', border: BD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 12, color: muted }}>Orbit Platform · Help Center</span>
                        <span style={{ fontSize: 11, color: muted }}>For system administration, contact your IT staff or founder account</span>
                    </div>

                </main>
            </div>
        </div>
    );
};

export default HelpPage;
