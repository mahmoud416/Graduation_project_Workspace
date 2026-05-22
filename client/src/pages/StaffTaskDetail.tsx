import { useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { triggerAIAnalysis } from '../services/qcService';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const authToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '');

async function downloadTemplate(reportTypeKey: string, lang: 'ar' | 'en') {
    const res = await fetch(`${API_BASE}/quality/templates/${reportTypeKey}?lang=${lang}`, {
        headers: { Authorization: `Bearer ${authToken()}` },
    });
    if (!res.ok) throw new Error('Template not found');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const disp = res.headers.get('Content-Disposition') ?? '';
    const match = disp.match(/filename="([^"]+)"/);
    a.href = url;
    a.download = match ? match[1] : `template_${reportTypeKey}_${lang}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

type FormattingSection = { present?: boolean; issues?: string; weakness?: string; score?: number };

interface FormattingCompliance {
    formatting_score: number;
    cover_page?: FormattingSection;
    table_of_contents?: FormattingSection;
    introduction?: FormattingSection;
    main_body?: FormattingSection & { well_structured?: boolean };
    conclusion?: FormattingSection;
    recommendations?: FormattingSection & { actionable?: boolean };
    appendices?: FormattingSection;
    signatures_approvals?: FormattingSection;
    language_quality?: FormattingSection;
    visual_organization?: FormattingSection;
    missing_sections?: string[];
    formatting_strengths?: string[];
    formatting_weaknesses?: string[];
}

interface AnalysisResult {
    compliance_score: number;
    passed_standards: { rule: string; result: string }[];
    failed_standards: { rule: string; reason: string }[];
    suggestions: string[];
    formatting_compliance?: FormattingCompliance;
    report_type_compliance?: {
        is_compliant: boolean;
        missing_elements: string[];
        compliance_note: string;
    };
}

export default function StaffTaskDetail() {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const projectId = params.get('projectId') ?? '';
    const taskId = params.get('taskId') ?? '';
    const taskTitle = params.get('taskTitle') ?? 'Task';
    const taskAssignee = params.get('assignee') ?? '';
    const taskDue = params.get('due') ?? '';
    const taskReportType = params.get('reportType') ?? '';

    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState('');
    const [templateLoading, setTemplateLoading] = useState<'ar' | 'en' | null>(null);
    const [templateError, setTemplateError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadTemplate = async (lang: 'ar' | 'en') => {
        if (!taskReportType) return;
        setTemplateLoading(lang);
        setTemplateError('');
        try {
            await downloadTemplate(taskReportType, lang);
        } catch {
            setTemplateError('Failed to download template. Please try again.');
        } finally {
            setTemplateLoading(null);
        }
    };

    const handleFile = (f: File) => {
        const name = f.name.toLowerCase();
        if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.doc')) {
            setError('Only PDF and Word (.docx) files are supported.');
            return;
        }
        setError('');
        setFile(f);
        setResult(null);
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    }, []);

    const runTest = async () => {
        if (!file) { setError('Please upload a PDF first.'); return; }
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const data = await triggerAIAnalysis({
                taskId,
                projectId,
                taskTitle,
                taskDescription: `Report Type: ${taskReportType}. Assignee: ${taskAssignee}. Due: ${taskDue}.`,
                documentFiles: [file],
            });
            setResult(data as AnalysisResult);
        } catch (err: any) {
            setError(err?.message ?? 'Analysis failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const score = result?.compliance_score ?? 0;
    const fmtScore = result?.formatting_compliance?.formatting_score ?? null;

    const scoreColor = (s: number) =>
        s >= 75 ? 'text-green-600 dark:text-green-400'
        : s >= 50 ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

    const scoreBg = (s: number) =>
        s >= 75 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
        : s >= 50 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';

    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                <Header title={taskTitle} />
                <main className="page-main p-6 space-y-6">

                    {/* Back + Title */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-1.5 text-sm text-text-gray dark:text-gray-400 hover:text-primary transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>
                        <span className="text-text-gray dark:text-gray-500">/</span>
                        <h1 className="text-xl font-bold text-text-dark dark:text-white truncate">{taskTitle}</h1>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* LEFT — Task Info + Upload */}
                        <div className="lg:col-span-1 space-y-4">

                            {/* Task Info Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                                <h2 className="text-sm font-bold text-text-dark dark:text-white uppercase tracking-wide">Task Info</h2>
                                <div className="space-y-2 text-sm">
                                    {taskAssignee && (
                                        <div className="flex items-center gap-2 text-text-gray dark:text-gray-400">
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <span>{taskAssignee}</span>
                                        </div>
                                    )}
                                    {taskDue && (
                                        <div className="flex items-center gap-2 text-text-gray dark:text-gray-400">
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                            <span>Due {taskDue}</span>
                                        </div>
                                    )}
                                    {taskReportType && (
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="text-primary font-medium">{taskReportType}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Template Download Card */}
                            {taskReportType && (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <h2 className="text-sm font-bold text-text-dark dark:text-white uppercase tracking-wide">Download Template</h2>
                                    </div>
                                    <p className="text-xs text-text-gray dark:text-gray-400">Use the official template for your report submission.</p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void handleDownloadTemplate('ar')}
                                            disabled={templateLoading !== null}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {templateLoading === 'ar' ? (
                                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                            )}
                                            عربي
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDownloadTemplate('en')}
                                            disabled={templateLoading !== null}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-primary border border-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {templateLoading === 'en' ? (
                                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                            )}
                                            English
                                        </button>
                                    </div>
                                    {templateError && (
                                        <p className="text-xs text-red-500 dark:text-red-400">{templateError}</p>
                                    )}
                                </div>
                            )}

                            {/* Upload Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                                <h2 className="text-sm font-bold text-text-dark dark:text-white uppercase tracking-wide">Submit Report</h2>

                                {/* Drop Zone */}
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={onDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                                        ${dragging ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600 hover:border-primary/60 hover:bg-primary/5'}`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.docx,.doc"
                                        className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                                    />
                                    {file ? (
                                        <div className="space-y-1">
                                            <svg className="w-8 h-8 text-primary mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-sm font-semibold text-text-dark dark:text-white truncate">{file.name}</p>
                                            <p className="text-xs text-text-gray">{(file.size / 1024).toFixed(0)} KB — click to change</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <svg className="w-8 h-8 text-text-gray dark:text-gray-500 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                            </svg>
                                            <p className="text-sm text-text-gray dark:text-gray-400">Drag & drop or <span className="text-primary font-semibold">browse</span></p>
                                            <p className="text-xs text-text-gray dark:text-gray-500">PDF or Word (.docx)</p>
                                        </div>
                                    )}
                                </div>

                                {error && (
                                    <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                                )}

                                <button
                                    type="button"
                                    onClick={() => void runTest()}
                                    disabled={!file || loading}
                                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                            </svg>
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                            Run Compliance Test
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* RIGHT — Results */}
                        <div className="lg:col-span-2 space-y-4">
                            {!result && !loading && (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-10 flex flex-col items-center justify-center text-center space-y-3 min-h-[300px]">
                                    <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    <p className="text-text-gray dark:text-gray-400 text-sm">Upload a PDF and run the compliance test to see results.</p>
                                </div>
                            )}

                            {loading && (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-10 flex flex-col items-center justify-center min-h-[300px] space-y-4">
                                    <svg className="w-10 h-10 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    <p className="text-sm font-medium text-text-dark dark:text-white">AI is analyzing your document...</p>
                                    <p className="text-xs text-text-gray dark:text-gray-400">Checking content & formatting compliance</p>
                                </div>
                            )}

                            {result && (
                                <>
                                    {/* Score Cards */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={`rounded-2xl border p-5 text-center ${scoreBg(score)}`}>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-text-gray dark:text-gray-400 mb-1">Content Score</p>
                                            <p className={`text-4xl font-black ${scoreColor(score)}`}>{score.toFixed(0)}%</p>
                                            <p className={`text-sm font-bold mt-1 ${scoreColor(score)}`}>
                                                {score >= 75 ? '✓ Compliant' : score >= 50 ? '⚠ Partial' : '✗ Non-Compliant'}
                                            </p>
                                        </div>
                                        {fmtScore !== null && (
                                            <div className={`rounded-2xl border p-5 text-center ${scoreBg(fmtScore)}`}>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-text-gray dark:text-gray-400 mb-1">Formatting Score</p>
                                                <p className={`text-4xl font-black ${scoreColor(fmtScore)}`}>{fmtScore}%</p>
                                                <p className={`text-sm font-bold mt-1 ${scoreColor(fmtScore)}`}>
                                                    {fmtScore >= 75 ? '✓ Good Format' : fmtScore >= 50 ? '⚠ Partial' : '✗ Poor Format'}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Report Type Compliance */}
                                    {result.report_type_compliance && (
                                        <div className={`rounded-2xl border p-5 ${result.report_type_compliance.is_compliant ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-sm font-bold ${result.report_type_compliance.is_compliant ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                    {result.report_type_compliance.is_compliant ? '✓ Report Type Compliant' : '✗ Report Type Non-Compliant'}
                                                </span>
                                            </div>
                                            {result.report_type_compliance.compliance_note && (
                                                <p className="text-xs text-text-gray dark:text-gray-400">{result.report_type_compliance.compliance_note}</p>
                                            )}
                                            {result.report_type_compliance.missing_elements.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Missing Elements:</p>
                                                    <ul className="space-y-0.5">
                                                        {result.report_type_compliance.missing_elements.map((el, i) => (
                                                            <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1">
                                                                <span className="mt-0.5">•</span> {el}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Formatting Details */}
                                    {result.formatting_compliance && (
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                                            <h3 className="text-sm font-bold text-text-dark dark:text-white">Formatting Details</h3>

                                            {result.formatting_compliance.missing_sections && result.formatting_compliance.missing_sections.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Missing Sections</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {result.formatting_compliance.missing_sections.map((s, i) => (
                                                            <span key={i} className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs border border-red-200 dark:border-red-700">{s}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {result.formatting_compliance.formatting_strengths && result.formatting_compliance.formatting_strengths.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Strengths</p>
                                                    <ul className="space-y-1">
                                                        {result.formatting_compliance.formatting_strengths.map((s, i) => (
                                                            <li key={i} className="text-xs text-text-gray dark:text-gray-400 flex items-start gap-1.5">
                                                                <span className="text-green-500 mt-0.5">✓</span> {s}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {result.formatting_compliance.formatting_weaknesses && result.formatting_compliance.formatting_weaknesses.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Weaknesses</p>
                                                    <ul className="space-y-1">
                                                        {result.formatting_compliance.formatting_weaknesses.map((s, i) => (
                                                            <li key={i} className="text-xs text-text-gray dark:text-gray-400 flex items-start gap-1.5">
                                                                <span className="text-red-500 mt-0.5">✗</span> {s}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Passed / Failed Standards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {result.passed_standards.length > 0 && (
                                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                                                <h3 className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-3">
                                                    ✓ Passed ({result.passed_standards.length})
                                                </h3>
                                                <ul className="space-y-2">
                                                    {result.passed_standards.map((s, i) => (
                                                        <li key={i} className="text-xs text-text-gray dark:text-gray-400 border-l-2 border-green-400 pl-2">
                                                            <span className="font-medium text-text-dark dark:text-gray-200">{s.rule}</span>
                                                            {s.result && <p className="mt-0.5">{s.result}</p>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {result.failed_standards.length > 0 && (
                                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                                                <h3 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-3">
                                                    ✗ Failed ({result.failed_standards.length})
                                                </h3>
                                                <ul className="space-y-2">
                                                    {result.failed_standards.map((s, i) => (
                                                        <li key={i} className="text-xs text-text-gray dark:text-gray-400 border-l-2 border-red-400 pl-2">
                                                            <span className="font-medium text-text-dark dark:text-gray-200">{s.rule}</span>
                                                            {s.reason && <p className="mt-0.5">{s.reason}</p>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* Suggestions */}
                                    {result.suggestions.length > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                                            <h3 className="text-sm font-bold text-text-dark dark:text-white mb-3">💡 Improvement Suggestions</h3>
                                            <ol className="space-y-2">
                                                {result.suggestions.map((s, i) => (
                                                    <li key={i} className="text-xs text-text-gray dark:text-gray-400 flex gap-2">
                                                        <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                                                        <span>{s}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
