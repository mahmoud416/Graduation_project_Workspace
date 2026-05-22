import { useState, useRef, useCallback } from 'react';
import { evaluateTask, type EvaluationResult } from '../services/qcService';

interface Props {
    isOpen: boolean;
    taskId: string;
    taskTitle: string;
    projectId: string;
    reportType?: string;
    onClose: () => void;
}

const TaskAnalysisModal = ({ isOpen, taskId, taskTitle, projectId, reportType, onClose }: Props) => {
    const [description, setDescription] = useState(taskTitle);
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

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const imageFiles: string[] = [];
            const docFiles: { file_name: string; content: string; file_type: string }[] = [];

            await Promise.all(
                attachments.map(
                    (file) =>
                        new Promise<void>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const base64 = (reader.result as string).split(',')[1] ?? '';
                                if (file.type.startsWith('image/')) {
                                    imageFiles.push(base64);
                                } else {
                                    docFiles.push({ file_name: file.name, content: base64, file_type: file.type });
                                }
                                resolve();
                            };
                            reader.readAsDataURL(file);
                        }),
                ),
            );

            const data = await evaluateTask({
                task_title: description,
                task_description: description,
                task_id: taskId,
                report_type: reportType,
                files: docFiles,
                image_base64: imageFiles,
            });
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setDescription(taskTitle);
        setAttachments([]);
        setResult(null);
        setError(null);
        onClose();
    };

    const handleExport = () => {
        if (!result) return;
        const lines = [
            `AI Operations Analysis Report`,
            `Task: ${description}`,
            `Project: ${projectId}`,
            `Quality Score: ${result.compliance_score}%`,
            ``,
            `PASSED STANDARDS:`,
            ...result.passed_standards.map((s) => `  ✓ ${s.rule}`),
            ``,
            `FAILED STANDARDS:`,
            ...result.failed_standards.map((s) => `  ✗ ${s.rule} — ${s.reason}`),
            ``,
            `RECOMMENDATIONS:`,
            ...result.suggestions.map((s) => `  • ${s}`),
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis-${taskId}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    const score = result?.compliance_score ?? 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => e.target === e.currentTarget && handleClose()}>
            <div className="w-full max-w-3xl rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="relative flex flex-col items-center pt-7 pb-4 px-6">
                    <button type="button" onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.607L5 14.5m14.8.5l1.196 4.785a1 1 0 01-.97 1.215H3.974a1 1 0 01-.97-1.215L4.2 15m15.6 0H4.2" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white">AI Operations Analysis</h2>
                    <p className="text-sm text-gray-400 text-center mt-1">Upload your workflow or task specifications for<br />comprehensive heuristic evaluation.</p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Left: Input */}
                        <div className="flex flex-col gap-4">
                            <div>
                                <p className="text-xs font-semibold tracking-widest text-gray-400 mb-2">TASK DESCRIPTION</p>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={5}
                                    placeholder="Enter high-level objectives..."
                                    className="w-full rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 px-3 py-2 focus:outline-none focus:border-violet-500 resize-none"
                                />
                            </div>

                            <div>
                                <p className="text-xs font-semibold tracking-widest text-gray-400 mb-2">ATTACHMENTS</p>
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-6 cursor-pointer transition-colors ${isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-white/15 hover:border-violet-500/50'}`}
                                >
                                    <svg className="w-8 h-8 text-gray-500 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.325A4.5 4.5 0 0118 19.5H6.75z" />
                                    </svg>
                                    <p className="text-sm text-gray-400 text-center">
                                        {attachments.length > 0 ? `${attachments.length} file(s) selected` : 'Drop system logs or UI screenshots'}
                                    </p>
                                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                                </div>
                                {attachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {attachments.map((f, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 text-xs bg-white/10 text-gray-300 rounded-lg px-2 py-1">
                                                {f.name}
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setAttachments((prev) => prev.filter((_, j) => j !== i)); }} className="text-gray-400 hover:text-red-400">×</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleAnalyze}
                                disabled={loading || !description.trim()}
                                className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                            >
                                {loading ? (
                                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Analyzing...</>
                                ) : (
                                    <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg> Analyze with AI</>
                                )}
                            </button>
                        </div>

                        {/* Right: Results */}
                        <div className="flex flex-col gap-4">
                            {error && (
                                <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3">{error}</div>
                            )}

                            {!result && !loading && !error && (
                                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-gray-500">
                                    <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.607L5 14.5m14.8.5l1.196 4.785a1 1 0 01-.97 1.215H3.974a1 1 0 01-.97-1.215L4.2 15m15.6 0H4.2" />
                                    </svg>
                                    <p className="text-sm">Results will appear here after analysis</p>
                                </div>
                            )}

                            {loading && (
                                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-gray-400">
                                    <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-sm">Running deep heuristic evaluation…</p>
                                </div>
                            )}

                            {result && !loading && (
                                <>
                                    {/* Quality Score */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-xs font-semibold tracking-widest text-gray-400">QUALITY SCORE</p>
                                            <span className="text-2xl font-bold text-white">{score}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${score}%`,
                                                    background: score >= 75 ? '#6d28d9' : score >= 50 ? '#f59e0b' : '#ef4444',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Operational Standards */}
                                    <div>
                                        <p className="text-xs font-semibold tracking-widest text-gray-400 mb-2">OPERATIONAL STANDARDS</p>
                                        <div className="space-y-2">
                                            {result.passed_standards.map((s, i) => (
                                                <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-teal-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span className="text-sm text-gray-200">{s.rule}</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-teal-400 border border-teal-500/40 rounded px-2 py-0.5">PASSED</span>
                                                </div>
                                            ))}
                                            {result.failed_standards.map((s, i) => (
                                                <div key={i} className="flex items-center justify-between rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                                        </svg>
                                                        <span className="text-sm text-gray-200">{s.rule}</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-red-400 border border-red-500/40 rounded px-2 py-0.5">FAILED</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Recommendations */}
                                    {result.suggestions.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold tracking-widest text-gray-400 mb-2">OPTIMIZATION RECOMMENDATIONS</p>
                                            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                                                <ul className="space-y-2">
                                                    {result.suggestions.map((s, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                            <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                                                            {s}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={!result}
                        className="text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-40"
                    >
                        Export Report
                    </button>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="h-9 px-5 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white font-semibold transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskAnalysisModal;
