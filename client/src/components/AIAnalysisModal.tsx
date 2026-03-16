import { useState, useRef, useCallback, useEffect } from 'react';
import type { QCAnalysis } from '../types';

interface ChatMsg { role: 'user' | 'assistant'; content: string; }
type ActiveTab = 'results' | 'chat';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

interface Props {
  taskId: string;
  projectId: string;
  taskTitle: string;
  taskDescription?: string;
  onClose: () => void;
}

type AnalysisState = 'idle' | 'loading' | 'success' | 'error';

export default function AIAnalysisModal({
  taskId,
  projectId,
  taskTitle,
  taskDescription = '',
  onClose,
}: Props) {
  const [state, setState] = useState<AnalysisState>('idle');
  const [result, setResult] = useState<QCAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [description, setDescription] = useState(taskDescription);
  const [images, setImages] = useState<File[]>([]);
  const [files, setFiles]   = useState<File[]>([]);
  const [standardIds, setStandardIds] = useState('');
  const [availableStandards, setAvailableStandards] = useState<{ _id: string; title: string; scope: string; rules_count: number }[]>([]);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  // Chat state
  const [activeTab, setActiveTab] = useState<ActiveTab>('results');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    fetch(`${API_BASE}/qc/standards`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const stds = (d.standards || []).map((s: Record<string, unknown>) => ({
          _id: s._id as string,
          title: s.title as string,
          scope: s.scope as string,
          rules_count: Array.isArray(s.rules) ? s.rules.length : 0,
        }));
        setAvailableStandards(stds);
        // Auto-select all standards by default
        setStandardIds(stds.map((s: { _id: string }) => s._id).join(','));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAnalyze = useCallback(async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token') || '';
      const form  = new FormData();
      form.append('task_id',          taskId);
      form.append('project_id',       projectId);
      form.append('task_title',       taskTitle);
      form.append('task_description', description);
      form.append('standard_ids',     standardIds);
      images.forEach(img => form.append('images', img));
      files.forEach(f   => form.append('files', f));

      const res = await fetch(`${API_BASE}/qc/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Analysis failed' }));
        throw new Error(err.detail || 'Analysis failed');
      }
      const data = await res.json();
      setResult(data);
      setState('success');
      setActiveTab('results');
      setChatMessages([]);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
      setState('error');
    }
  }, [taskId, projectId, taskTitle, description, standardIds, images, files]);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading || !result) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const updated: ChatMsg[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(updated);
    setIsChatLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const summary = JSON.stringify({
        score: result.compliance_score,
        passed: result.passed_standards.map(s => s.rule),
        failed: result.failed_standards.map(s => s.rule),
        suggestions: result.suggestions,
      });
      const res = await fetch(`${API_BASE}/qc/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId, project_id: projectId,
          task_title: taskTitle, task_description: description,
          analysis_summary: summary,
          conversation: updated.slice(0, -1),
          message: userMsg,
        }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'No response.' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get a response.' }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, result, chatMessages, taskId, projectId, taskTitle, description]);

  const scoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const scoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Needs Improvement';
    return 'Below Standard';
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-[700px] max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-50 dark:from-blue-900/30 to-transparent rounded-t-2xl">
          <div>
            <h2 className="text-gray-900 dark:text-white text-lg font-bold">
              AI Quality Analysis
            </h2>
            <p className="text-text-gray dark:text-gray-400 mt-1 text-sm">
              {taskTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-gray-400 dark:text-gray-500 text-xl cursor-pointer px-2 py-1 rounded-md hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >✕</button>
        </div>

        <div className="p-6">
          {/* Input form */}
          {(state === 'idle' || state === 'error') && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-sm font-semibold block mb-1.5">
                  Task Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the task in detail..."
                  rows={4}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Image upload */}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-sm font-semibold block mb-1.5">
                  Images <span className="text-gray-400 dark:text-gray-500 font-normal">(max 3, analyzed by GPT-4o Vision)</span>
                </label>
                <div
                  onClick={() => imageRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center cursor-pointer text-gray-400 dark:text-gray-500 transition-colors hover:border-blue-400 dark:hover:border-blue-500"
                >
                  {images.length > 0
                    ? <span className="text-blue-600 dark:text-blue-400">{images.map(f => f.name).join(', ')}</span>
                    : 'Click to upload images (PNG, JPG)'}
                </div>
                <input
                  ref={imageRef} type="file" multiple accept="image/*" hidden
                  onChange={e => setImages(Array.from(e.target.files || []).slice(0, 3))}
                />
              </div>

              {/* File upload */}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-sm font-semibold block mb-1.5">
                  Files <span className="text-gray-400 dark:text-gray-500 font-normal">(max 5, text/JSON/CSV/Markdown)</span>
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center cursor-pointer text-gray-400 dark:text-gray-500 transition-colors hover:border-blue-400 dark:hover:border-blue-500"
                >
                  {files.length > 0
                    ? <span className="text-blue-600 dark:text-blue-400">{files.map(f => f.name).join(', ')}</span>
                    : 'Click to upload files'}
                </div>
                <input
                  ref={fileRef} type="file" multiple hidden
                  onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 5))}
                />
              </div>

              {/* Standards selector */}
              {availableStandards.length > 0 && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-sm font-semibold block mb-1.5">
                    Quality Standards to Apply
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-[140px] overflow-y-auto flex flex-col gap-1.5">
                    {availableStandards.map(std => {
                      const selected = standardIds.split(',').includes(std._id);
                      return (
                        <label key={std._id} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const ids = standardIds.split(',').filter(Boolean);
                              const next = selected
                                ? ids.filter(id => id !== std._id)
                                : [...ids, std._id];
                              setStandardIds(next.join(','));
                            }}
                            className="w-3.5 h-3.5 accent-blue-600 shrink-0"
                          />
                          <span className="text-gray-700 dark:text-gray-300 text-sm truncate">{std.title}</span>
                          <span className="text-gray-400 dark:text-gray-500 text-[10px] ml-auto shrink-0">
                            {std.scope === 'global' ? 'Global' : 'Project'} · {std.rules_count} rules
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {state === 'error' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-red-600 dark:text-red-400 text-sm">
                  ⚠ {errorMsg}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                className="bg-gradient-to-r from-blue-600 to-violet-600 border-none rounded-xl py-3.5 text-white text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Analyze with AI
              </button>
            </div>
          )}

          {/* Loading state */}
          {state === 'loading' && (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 animate-spin mx-auto mb-5" />
              <p className="text-gray-500 dark:text-gray-400 text-base">
                AI is analyzing your task against quality standards...
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                This may take 10-20 seconds
              </p>
            </div>
          )}

          {/* Results */}
          {state === 'success' && result && (
            <div className="flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                {(['results', 'chat'] as const).map(tab => (
                  <button key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === tab
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'results' ? 'Results' : 'Ask AI'}
                  </button>
                ))}
              </div>

              {/* Results Tab */}
              {activeTab === 'results' && (
              <div className="flex flex-col gap-5">
              {/* Compliance Score */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm font-semibold tracking-wide uppercase">
                  Quality Compliance Score
                </p>
                <div className="text-5xl font-extrabold leading-none" style={{ color: scoreColor(result.compliance_score) }}>
                  {result.compliance_score.toFixed(0)}%
                </div>
                <div className="text-sm font-semibold mt-1.5" style={{ color: scoreColor(result.compliance_score) }}>
                  {scoreLabel(result.compliance_score)}
                </div>
                {/* Progress bar */}
                <div className="mt-4 bg-gray-200 dark:bg-gray-900 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      background: `linear-gradient(90deg, ${scoreColor(result.compliance_score)}, ${scoreColor(result.compliance_score)}aa)`,
                      width: `${result.compliance_score}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-gray-400 dark:text-gray-500 text-[11px]">
                    {result.passed_standards.length} passed
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 text-[11px]">
                    {result.failed_standards.length} failed
                  </span>
                </div>
              </div>

              {/* Passed Standards */}
              {result.passed_standards.length > 0 && (
                <div>
                  <h3 className="text-green-600 dark:text-green-400 text-sm font-bold mb-2.5 flex items-center gap-1.5">
                    Passed Standards ({result.passed_standards.length})
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {result.passed_standards.map((s, i) => (
                      <div key={i} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3.5 py-2.5">
                        <div className="text-green-700 dark:text-green-300 text-sm font-semibold">{s.rule}</div>
                        {s.result && <div className="text-green-600 dark:text-green-400 text-xs mt-1">{s.result}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Standards */}
              {result.failed_standards.length > 0 && (
                <div>
                  <h3 className="text-red-600 dark:text-red-400 text-sm font-bold mb-2.5 flex items-center gap-1.5">
                    Failed Standards ({result.failed_standards.length})
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {result.failed_standards.map((s, i) => (
                      <div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3.5 py-2.5">
                        <div className="text-red-700 dark:text-red-300 text-sm font-semibold">{s.rule}</div>
                        {s.reason && <div className="text-red-600 dark:text-red-400 text-xs mt-1">{s.reason}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Suggestions */}
              {result.suggestions.length > 0 && (
                <div>
                  <h3 className="text-amber-600 dark:text-amber-400 text-sm font-bold mb-2.5 flex items-center gap-1.5">
                    AI Improvement Tips
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {result.suggestions.map((s, i) => (
                      <div key={i} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3.5 py-2.5 text-amber-700 dark:text-amber-300 text-sm flex gap-2">
                        <span>→</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-analyze button */}
              <button
                onClick={() => setState('idle')}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 text-gray-500 dark:text-gray-400 text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Analyze Again
              </button>
            </div>
            )}

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ask follow-up questions about this task's quality analysis.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-3 min-h-[200px] max-h-[300px] overflow-y-auto">
                    {chatMessages.length === 0 && (
                      <p className="text-gray-400 dark:text-gray-500 text-sm text-center mt-8">
                        Ask a question about the analysis results...
                      </p>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl rounded-bl-sm px-4 py-2.5">
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                      placeholder="e.g. Why did it fail the acceptance criteria rule?"
                      disabled={isChatLoading}
                      className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim() || isChatLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-4 rounded-lg transition-colors cursor-pointer"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
