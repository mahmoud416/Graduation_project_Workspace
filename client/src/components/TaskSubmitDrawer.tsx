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

interface Props {
    isOpen: boolean;
    taskId: string;
    taskTitle: string;
    projectId: string;
    reportType?: string;
    onClose: () => void;
    onSuccess?: () => void;
}

const TaskSubmitDrawer = ({ isOpen, taskId, taskTitle, projectId, reportType, onClose, onSuccess }: Props) => {
    const [description, setDescription] = useState(taskTitle);
    const [submissionNotes, setSubmissionNotes] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        setAttachments((prev) => [...prev, ...Array.from(files)]);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
        },
        [handleFiles],
    );

    const handleAnalyzeAndSubmit = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const imageFiles: string[] = [];
            const docFiles: { file_name: string; content: string; file_type: string }[] = [];

            await Promise.all(
                attachments.map((file) =>
                    file.arrayBuffer().then((buf) => {
                        const base64 = arrayBufferToBase64(buf);
                        if (file.type.startsWith('image/')) {
                            imageFiles.push(base64);
                        } else {
                            docFiles.push({ file_name: file.name, content: base64, file_type: file.type });
                        }
                    }),
                ),
            );

            // This will evaluate and if >= 85, backend will submit the task automatically.
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

            if (data.compliance_score >= 85 && onSuccess) {
                // If it passes, we might want to notify the parent to refresh or close after a delay
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 3000);
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

    const score = result?.compliance_score ?? 0;
    const isPassed = score >= 85;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 transition-opacity">
            <div className="w-full max-w-lg h-full bg-[#1a1a2e] border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Submit Task</h2>
                            <p className="text-xs text-gray-400">AI Quality Check & Submission</p>
                        </div>
                    </div>
                    <button type="button" onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Left/Top: Input */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <p className="text-xs font-semibold tracking-widest text-gray-400 mb-2">TASK TITLE</p>
                            <input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 px-3 py-2.5 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <p className="text-xs font-semibold tracking-widest text-gray-400 mb-2">SUBMISSION NOTES (Optional)</p>
                            <textarea
                                value={submissionNotes}
                                onChange={(e) => setSubmissionNotes(e.target.value)}
                                rows={2}
                                placeholder="Any comments for the reviewers..."
                                className="w-full rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
                            />
                        </div>

                        <div>
                            <p className="text-xs font-semibold tracking-widest text-gray-400 mb-2">ATTACHMENTS (Required)</p>
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/15 hover:border-blue-500/50'}`}
                            >
                                <svg className="w-8 h-8 text-gray-500 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.325A4.5 4.5 0 0118 19.5H6.75z" />
                                </svg>
                                <p className="text-sm text-gray-400 text-center px-4">
                                    {attachments.length > 0 ? `${attachments.length} file(s) selected` : 'Drop your report files (PDF/Word) here'}
                                </p>
                                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                            </div>
                            {attachments.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {attachments.map((f, i) => (
                                        <span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/10 text-gray-300 rounded-md px-2.5 py-1.5 border border-white/5 shadow-sm">
                                            {f.name}
                                            <button type="button" onClick={(e) => { e.stopPropagation(); setAttachments((prev) => prev.filter((_, j) => j !== i)); }} className="text-gray-400 hover:text-red-400 ml-1">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleAnalyzeAndSubmit}
                            disabled={loading || !description.trim() || attachments.length === 0}
                            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-blue-900/20 mt-2"
                        >
                            {loading ? (
                                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Analyzing & Evaluating...</>
                            ) : (
                                <><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Evaluate & Submit</>
                            )}
                        </button>
                    </div>

                    {/* Results Section */}
                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 shadow-inner">{error}</div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400 bg-white/5 rounded-xl border border-white/5">
                            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-sm font-medium">Running strict quality evaluation against ministry standards…</p>
                        </div>
                    )}

                    {result && !loading && (
                        <div className={`rounded-xl border p-5 transition-all ${isPassed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            {/* Quality Score */}
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                                <div>
                                    <p className="text-xs font-bold tracking-widest text-gray-400">QUALITY SCORE</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-4xl font-extrabold ${isPassed ? 'text-green-400' : 'text-red-400'}`}>{score}%</span>
                                        <span className={`text-xs px-2 py-1 rounded-md font-bold ${isPassed ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                            {isPassed ? 'PASSED (≥85%)' : 'FAILED (<85%)'}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-16 h-16 rounded-full flex items-center justify-center border-4" style={{ borderColor: isPassed ? '#4ade80' : '#f87171' }}>
                                    {isPassed ? (
                                        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    )}
                                </div>
                            </div>

                            {isPassed ? (
                                <div className="text-sm text-green-300 mb-4 bg-green-500/10 p-3 rounded-lg border border-green-500/20 font-medium">
                                    🎉 Great job! The task has been submitted successfully to QC Review.
                                </div>
                            ) : (
                                <div className="text-sm text-red-300 mb-6 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                    <p className="font-bold mb-1">Submission Blocked</p>
                                    You must fix the critical errors below and reach at least 85% to submit this task.
                                </div>
                            )}

                            {/* Failed Standards (Detailed view for fixing) */}
                            {result.failed_standards.length > 0 && (
                                <div className="mb-5">
                                    <p className="text-xs font-bold tracking-widest text-red-400 mb-3 flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        CRITICAL ISSUES TO FIX
                                    </p>
                                    <div className="space-y-2.5">
                                        {result.failed_standards.map((s, i) => (
                                            <div key={i} className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                                                <p className="text-sm font-semibold text-gray-200 mb-1">{s.rule}</p>
                                                <p className="text-sm text-red-300/90 leading-relaxed">{s.reason}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recommendations */}
                            {result.suggestions.length > 0 && !isPassed && (
                                <div>
                                    <p className="text-xs font-bold tracking-widest text-yellow-400 mb-3">HOW TO IMPROVE</p>
                                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                                        <ul className="space-y-2">
                                            {result.suggestions.map((s, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-yellow-200/90 leading-relaxed">
                                                    <span className="text-yellow-400 mt-0.5 shrink-0">❖</span>
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskSubmitDrawer;
