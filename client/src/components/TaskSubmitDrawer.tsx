import { useState, useRef, useCallback } from 'react';
import { evaluateTask, type EvaluationResult } from '../services/qcService';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
        parts.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK))));
    }
    return btoa(parts.join(''));
}

function fmtSize(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
    isOpen: boolean;
    taskId: string;
    taskTitle: string;
    projectId: string;
    reportType?: string;
    onClose: () => void;
    onSuccess?: () => void;
    onEvaluated?: (result: EvaluationResult, taskId: string) => void;
}

const TaskSubmitDrawer = ({ isOpen, taskId, taskTitle, reportType, onClose, onSuccess, onEvaluated }: Props) => {
    const [description, setDescription]       = useState(taskTitle);
    const [submissionNotes, setSubmissionNotes] = useState('');
    const [attachments, setAttachments]        = useState<File[]>([]);
    const [loading, setLoading]                = useState(false);
    const [result, setResult]                  = useState<EvaluationResult | null>(null);
    const [error, setError]                    = useState<string | null>(null);
    const [isDragging, setIsDragging]          = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        setAttachments(prev => [...prev, ...Array.from(files)]);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const handleAnalyzeAndSubmit = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const imageFiles: string[] = [];
            const docFiles: { file_name: string; content: string; file_type: string }[] = [];
            await Promise.all(attachments.map(file =>
                file.arrayBuffer().then(buf => {
                    const base64 = arrayBufferToBase64(buf);
                    if (file.type.startsWith('image/')) imageFiles.push(base64);
                    else docFiles.push({ file_name: file.name, content: base64, file_type: file.type });
                })
            ));
            const data = await evaluateTask({
                task_title: description,
                task_description: description,
                task_id: taskId,
                report_type: reportType,
                files: docFiles,
                image_base64: imageFiles,
                submission_notes: submissionNotes,
            });
            setResult(data);
            onEvaluated?.(data, taskId);
            if (data.compliance_score >= 70 && onSuccess) {
                setTimeout(() => { onSuccess(); onClose(); }, 3000);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setDescription(taskTitle);
        setSubmissionNotes('');
        setAttachments([]);
        setResult(null);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    const score    = result?.compliance_score ?? 0;
    const isPassed = score >= 70;
    const circ     = 2 * Math.PI * 28; // r=28

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)' }}>
            <div style={{ width: '100%', maxWidth: 460, height: '100%', background: '#0e1117', borderLeft: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,.6)' }}>

                {/* ── Header ── */}
                <div style={{ padding: '20px 22px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'linear-gradient(135deg,rgba(99,102,241,.12) 0%,rgba(14,17,23,0) 60%)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99,102,241,.4)' }}>
                                <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-.01em' }}>Submit Task</div>
                                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 500, marginTop: 1 }}>AI Quality Check & Submission</div>
                            </div>
                        </div>
                        <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, borderRadius: 6, lineHeight: 1, transition: 'color .15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Task Title */}
                    <div>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Task Title</label>
                        <input value={description} onChange={e => setDescription(e.target.value)}
                            style={{ width: '100%', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#e2e8f0', fontSize: 13, padding: '9px 12px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color .15s' }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
                            onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)')}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Notes <span style={{ fontWeight: 400, color: '#334155' }}>(optional)</span></label>
                        <textarea value={submissionNotes} onChange={e => setSubmissionNotes(e.target.value)} rows={2}
                            placeholder="Any comments for the reviewers…"
                            style={{ width: '100%', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#e2e8f0', fontSize: 13, padding: '9px 12px', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
                            onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)')}
                        />
                    </div>

                    {/* Drop zone */}
                    <div>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Attachments <span style={{ color: '#ef4444' }}>*</span></label>
                        <div
                            onDragOver={e  => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            style={{ borderRadius: 12, border: `2px dashed ${isDragging ? '#6366f1' : 'rgba(255,255,255,.12)'}`, background: isDragging ? 'rgba(99,102,241,.08)' : 'rgba(255,255,255,.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', cursor: 'pointer', transition: 'border-color .2s, background .2s', userSelect: 'none' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: isDragging ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, transition: 'background .2s' }}>
                                <svg width="20" height="20" fill="none" stroke={isDragging ? '#818cf8' : '#64748b'} strokeWidth="1.6" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.325A4.5 4.5 0 0118 19.5H6.75z"/>
                                </svg>
                            </div>
                            <div style={{ fontSize: 13, color: isDragging ? '#818cf8' : '#94a3b8', fontWeight: 500, textAlign: 'center' }}>
                                {attachments.length > 0 ? `${attachments.length} file(s) ready` : 'Drop PDF / Word files here'}
                            </div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>or click to browse</div>
                            <input ref={fileInputRef} type="file" multiple className="hidden" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
                        </div>

                        {/* File chips */}
                        {attachments.length > 0 && (
                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {attachments.map((f, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '7px 10px' }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="14" height="14" fill="none" stroke="#818cf8" strokeWidth="1.8" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{fmtSize(f.size)}</div>
                                        </div>
                                        <button type="button" onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter((_, j) => j !== i)); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2, lineHeight: 1, transition: 'color .15s', borderRadius: 4 }}
                                            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                                            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#fca5a5', fontSize: 13, padding: '10px 14px' }}>{error}</div>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div style={{ borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                            <div style={{ position: 'relative', width: 48, height: 48 }}>
                                <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
                                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(99,102,241,.2)" strokeWidth="3"/>
                                    <circle cx="24" cy="24" r="20" fill="none" stroke="#6366f1" strokeWidth="3"
                                        strokeDasharray="125.6" strokeDashoffset="0" strokeLinecap="round"
                                        style={{ animation: 'drawer-spin 1.2s linear infinite' }}/>
                                </svg>
                                <style>{`@keyframes drawer-spin { to { stroke-dashoffset: -125.6 } }`}</style>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Evaluating against standards…</div>
                                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>This may take a few seconds</div>
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && !loading && (
                        <div style={{ borderRadius: 14, border: `1px solid ${isPassed ? 'rgba(74,222,128,.2)' : 'rgba(248,113,113,.2)'}`, background: isPassed ? 'rgba(74,222,128,.05)' : 'rgba(248,113,113,.05)', padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                            {/* Score row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                                {/* Circular score */}
                                <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
                                    <svg width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5"/>
                                        <circle cx="34" cy="34" r="28" fill="none"
                                            stroke={isPassed ? '#4ade80' : '#f87171'} strokeWidth="5"
                                            strokeDasharray={circ}
                                            strokeDashoffset={circ * (1 - score / 100)}
                                            strokeLinecap="round"
                                            style={{ transition: 'stroke-dashoffset .8s ease' }}/>
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: isPassed ? '#4ade80' : '#f87171' }}>{score}%</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#475569', textTransform: 'uppercase', marginBottom: 5 }}>Quality Score</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{isPassed ? 'Passed' : 'Failed'}</div>
                                    <div style={{ marginTop: 4, display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: isPassed ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)', color: isPassed ? '#86efac' : '#fca5a5' }}>
                                        {isPassed ? '≥ 70% — Auto-submitted to QC' : `< 70% — ${70 - score}% needed to pass`}
                                    </div>
                                </div>
                            </div>

                            {/* Pass banner */}
                            {isPassed && (
                                <div style={{ borderRadius: 8, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', padding: '10px 12px', fontSize: 13, color: '#86efac', fontWeight: 500 }}>
                                    Task submitted successfully to QC Review.
                                </div>
                            )}

                            {/* Fail banner */}
                            {!isPassed && (
                                <div style={{ borderRadius: 8, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', padding: '10px 12px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>Submission Blocked</div>
                                    <div style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.6 }}>Fix the issues below and resubmit to reach 70%.</div>
                                </div>
                            )}

                            {/* Failed standards */}
                            {result.failed_standards.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#f87171', textTransform: 'uppercase', marginBottom: 8 }}>Critical Issues</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {result.failed_standards.map((s, i) => (
                                            <div key={i} style={{ borderRadius: 8, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.15)', padding: '9px 11px' }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>{s.rule}</div>
                                                <div style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.55 }}>{s.reason}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Suggestions */}
                            {result.suggestions.length > 0 && !isPassed && (
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#fbbf24', textTransform: 'uppercase', marginBottom: 8 }}>How to Improve</div>
                                    <div style={{ borderRadius: 8, background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.15)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {result.suggestions.map((s, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#fde68a', lineHeight: 1.55 }}>
                                                <span style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }}>▸</span>
                                                {s}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer / CTA ── */}
                <div style={{ padding: '14px 22px 18px', borderTop: '1px solid rgba(255,255,255,.07)', flexShrink: 0, background: 'rgba(0,0,0,.2)' }}>
                    <button type="button" onClick={handleAnalyzeAndSubmit}
                        disabled={loading || !description.trim() || attachments.length === 0}
                        style={{ width: '100%', height: 44, borderRadius: 11, border: 'none', background: loading || !description.trim() || attachments.length === 0 ? 'rgba(99,102,241,.3)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', fontSize: 13, fontWeight: 700, cursor: loading || !description.trim() || attachments.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(99,102,241,.35)', transition: 'opacity .15s, transform .15s' }}
                        onMouseEnter={e => { if (!loading && description.trim() && attachments.length > 0) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}>
                        {loading ? (
                            <>
                                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'drawer-btn-spin .8s linear infinite' }}/>
                                <style>{`@keyframes drawer-btn-spin { to { transform: rotate(360deg) } }`}</style>
                                Analyzing…
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                Evaluate &amp; Submit
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default TaskSubmitDrawer;
