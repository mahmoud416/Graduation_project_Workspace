import type { QualityAnalysisResult } from '../types';

interface AiAnalysisModalProps {
    isOpen: boolean;
    taskTitle?: string;
    onClose: () => void;
    loading: boolean;
    result: QualityAnalysisResult | null;
    error: string | null;
}

const badgeColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-text-gray';
    const normalized = status.toLowerCase();
    if (normalized.includes('passed') || normalized === 'completed') {
        return 'bg-emerald-100 text-emerald-700';
    }
    if (normalized.includes('pending')) {
        return 'bg-amber-100 text-amber-700';
    }
    return 'bg-rose-100 text-rose-700';
};

const AiAnalysisModal = ({ isOpen, taskTitle, onClose, loading, result, error }: AiAnalysisModalProps) => {
    if (!isOpen) return null;

    const safePassed = result?.passed_rules ?? [];
    const safeFailed = result?.failed_rules ?? [];
    const suggestions = result?.suggestions ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-gray dark:text-gray-400">AI Quality Evaluation</p>
                        <h2 className="text-xl font-semibold text-text-dark dark:text-white">{taskTitle || 'Task detail'}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="text-text-gray dark:text-gray-300 hover:text-text-dark dark:hover:text-white">
                        Close
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-sm text-text-gray dark:text-gray-400">Running deep rule checks…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    {!loading && !error && result && (
                        <>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-xs uppercase text-text-gray dark:text-gray-400">Score</p>
                                    <p className="text-3xl font-bold text-text-dark dark:text-white">{typeof result.score === 'number' ? result.score.toFixed(1) : '—'}</p>
                                </div>
                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-xs uppercase text-text-gray dark:text-gray-400">Status</p>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badgeColor(result.status)}`}>
                                        {result.status ?? 'Unknown'}
                                    </span>
                                </div>
                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-xs uppercase text-text-gray dark:text-gray-400">Completed at</p>
                                    <p className="text-sm text-text-dark dark:text-gray-200">
                                        {result.completed_at ? new Date(result.completed_at).toLocaleString() : 'Pending'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-text-dark dark:text-white">Passed rules</h3>
                                        <span className="text-xs text-text-gray">{safePassed.length}</span>
                                    </div>
                                    {safePassed.length === 0 && <p className="text-sm text-text-gray">No rules passed yet.</p>}
                                    <ul className="space-y-3">
                                        {safePassed.map((rule, idx) => (
                                            <li key={rule.rule_id ?? idx} className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3">
                                                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{rule.label || 'Rule'}</p>
                                                {rule.notes && <p className="text-xs text-emerald-700 dark:text-emerald-100 mt-1">{rule.notes}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                                <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-text-dark dark:text-white">Failed rules</h3>
                                        <span className="text-xs text-text-gray">{safeFailed.length}</span>
                                    </div>
                                    {safeFailed.length === 0 && <p className="text-sm text-text-gray">No blocking issues reported.</p>}
                                    <ul className="space-y-3">
                                        {safeFailed.map((rule, idx) => (
                                            <li key={rule.rule_id ?? idx} className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-3">
                                                <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">{rule.label || 'Rule'}</p>
                                                {rule.notes && <p className="text-xs text-rose-700 dark:text-rose-100 mt-1">{rule.notes}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            </div>

                            {suggestions.length > 0 && (
                                <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                                    <h3 className="text-sm font-semibold text-text-dark dark:text-white mb-3">AI suggestions</h3>
                                    <ul className="list-disc pl-5 space-y-2 text-sm text-text-gray dark:text-gray-300">
                                        {suggestions.map((suggestion, idx) => (
                                            <li key={idx}>{suggestion}</li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiAnalysisModal;
