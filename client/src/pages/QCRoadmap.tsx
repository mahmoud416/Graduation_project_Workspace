import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { RoadmapResult } from '../types';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'Content-Type': 'application/json',
});

export default function QCRoadmap() {
  const [form, setForm] = useState({
    project_id: '',
    project_title: '',
    project_description: '',
    tasks_summary: '',
    context: '',
  });
  const [result, setResult] = useState<RoadmapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bestPracticeType, setBestPracticeType] = useState('web application');
  const [practices, setPractices] = useState<string[]>([]);
  const [loadingPractices, setLoadingPractices] = useState(false);

  const handleAnalyze = async () => {
    if (!form.project_title.trim()) { setError('Project title is required'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const body = {
        ...form,
        tasks_summary: form.tasks_summary
          ? form.tasks_summary.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
      };
      const res = await fetch(`${API}/qc/roadmap/analyze`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Analysis failed');
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
    setLoading(false);
  };

  const handleBestPractices = async () => {
    setLoadingPractices(true);
    const formData = new FormData();
    formData.append('project_type', bestPracticeType);
    const res = await fetch(`${API}/qc/roadmap/best-practices`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: formData,
    });
    const data = await res.json();
    setPractices(data.best_practices || []);
    setLoadingPractices(false);
  };

  const Section = ({ title, items, color, icon }: { title: string; items: string[]; color: string; icon: string }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-[18px] border" style={{ borderColor: `${color}33` }}>
      <h4 className="text-sm font-bold mb-3 flex gap-1.5 items-center" style={{ color }}>
        {icon} {title} <span className="text-gray-400 dark:text-gray-500 font-normal">({items.length})</span>
      </h4>
      {items.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm">None detected.</p>
      ) : (
        <ul className="m-0 pl-4 flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{item}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
        <Header title="AI Roadmap Assistant" />
        <main className="page-main p-6 lg:p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">AI Roadmap Assistant</h1>
            <p className="text-sm text-text-gray dark:text-gray-400 mt-1">
              Analyze your project workflow and get AI-powered improvement recommendations
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
            {/* Input Panel */}
            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="text-gray-800 dark:text-gray-200 mb-4 text-[15px] font-bold">
                  Analyze Project Workflow
                </h3>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">PROJECT ID</label>
                    <input
                      value={form.project_id}
                      onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                      placeholder="Optional – paste project ID"
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">PROJECT TITLE *</label>
                    <input
                      value={form.project_title}
                      onChange={e => setForm(f => ({ ...f, project_title: e.target.value }))}
                      placeholder="e.g., E-commerce Mobile App"
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">PROJECT DESCRIPTION</label>
                    <textarea
                      value={form.project_description}
                      onChange={e => setForm(f => ({ ...f, project_description: e.target.value }))}
                      placeholder="What does this project do?"
                      rows={2}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">
                      CURRENT TASKS <span className="text-gray-400 dark:text-gray-500 font-normal">(one per line)</span>
                    </label>
                    <textarea
                      value={form.tasks_summary}
                      onChange={e => setForm(f => ({ ...f, tasks_summary: e.target.value }))}
                      placeholder={"Design UI mockups\nBuild login API\nWrite unit tests\nDeploy to staging"}
                      rows={6}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm resize-y font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">ADDITIONAL CONTEXT</label>
                    <input
                      value={form.context}
                      onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
                      placeholder="e.g., React Native app with Node.js backend"
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {error && <div className="text-red-400 text-sm">⚠ {error}</div>}

                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className={`rounded-xl py-3 text-sm font-bold border-none flex items-center justify-center gap-2 ${
                      loading ? 'bg-gray-300 dark:bg-gray-600 cursor-default text-gray-500' : 'bg-gradient-to-r from-cyan-600 to-blue-600 cursor-pointer text-white hover:opacity-90'
                    }`}
                  >
                    {loading ? 'Analyzing...' : 'Analyze Workflow'}
                  </button>
                </div>
              </div>

              {/* Best Practices Finder */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="text-gray-800 dark:text-gray-200 mb-3.5 text-[15px] font-bold">
                  Industry Best Practices
                </h3>
                <div className="flex gap-2 mb-3">
                  <input
                    value={bestPracticeType}
                    onChange={e => setBestPracticeType(e.target.value)}
                    placeholder="Project type..."
                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 text-gray-800 dark:text-gray-200 text-sm"
                  />
                  <button
                    onClick={handleBestPractices}
                    disabled={loadingPractices}
                    className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-3.5 py-2 text-violet-600 dark:text-violet-400 text-sm font-semibold cursor-pointer whitespace-nowrap hover:opacity-80"
                  >
                    {loadingPractices ? '...' : 'Search'}
                  </button>
                </div>
                {practices.length > 0 && (
                  <ul className="m-0 pl-4">
                    {practices.map((p, i) => (
                      <li key={i} className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Results Panel */}
            <div>
              {!result && !loading && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-dashed border-gray-300 dark:border-gray-600">
                  <div className="text-5xl mb-4">🗺️</div>
                  <h3 className="text-gray-800 dark:text-gray-200 mb-2 font-bold">Ready to Analyze</h3>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">
                    Fill in the project details and click "Analyze Workflow" to<br />
                    get AI-powered suggestions and workflow improvements.
                  </p>
                </div>
              )}

              {loading && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-cyan-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-[15px]">
                    AI is analyzing your project roadmap...
                  </p>
                </div>
              )}

              {result && (
                <div className="flex flex-col gap-3.5">
                  {/* Overall Assessment */}
                  <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 rounded-xl p-[18px] border border-blue-200 dark:border-blue-800/40">
                    <h4 className="text-blue-600 dark:text-blue-400 mb-2 text-[13px] font-bold uppercase tracking-wide">
                      Overall Assessment
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      {result.overall_assessment}
                    </p>
                  </div>

                  <Section title="Issues Detected" items={result.issues_detected} color="#ef4444" icon="⚠" />
                  <Section title="Suggested Tasks to Add" items={result.suggested_tasks} color="#3b82f6" icon="➕" />
                  <Section title="Workflow Improvements" items={result.workflow_improvements} color="#f59e0b" icon="⚙" />
                  <Section title="Industry Best Practices" items={result.best_practices} color="#8b5cf6" icon="🌐" />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
