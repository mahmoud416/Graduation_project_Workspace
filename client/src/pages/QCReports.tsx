import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

interface AnalyticsData {
  quality_score_trend: { date: string; avg_score: number; count: number }[];
  status_distribution: Record<string, number>;
  todo_completion_trend: { date: string; count: number }[];
  top_failing_standards: { rule: string; failures: number }[];
}

interface HistoryEntry {
  _id: string;
  task_id: string;
  task_title: string;
  project_id: string;
  compliance_score: number;
  analyzed_by: string;
  created_at: string;
}

function BarChart({ data, xKey, yKey, color = '#3b82f6', label = '' }: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color?: string;
  label?: string;
}) {
  if (!data || data.length === 0) return (
    <div className="text-gray-400 dark:text-gray-500 text-center py-6 text-sm">No data available</div>
  );
  const max = Math.max(...data.map(d => Number(d[yKey]) || 0), 1);
  return (
    <div>
      {label && <div className="text-gray-500 dark:text-gray-400 text-xs font-semibold mb-3 uppercase tracking-wide">{label}</div>}
      <div className="flex items-end gap-1 h-[120px]">
        {data.slice(-14).map((d, i) => {
          const val = Number(d[yKey]) || 0;
          const h = `${Math.max((val / max) * 100, 4)}%`;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                title={`${d[xKey]}: ${val.toFixed ? val.toFixed(1) : val}`}
                className="w-full rounded-t cursor-default transition-opacity hover:opacity-70"
                style={{ background: `${color}cc`, height: h, minHeight: '4px' }}
              />
              {i % 3 === 0 && (
                <span className="text-gray-400 dark:text-gray-500 text-[9px] -rotate-[30deg] whitespace-nowrap">
                  {String(d[xKey]).slice(5)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function QCReports() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const load = (d: number) => {
    setLoading(true);
    fetch(`${API}/qc/reports/analytics?days=${d}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setAnalytics(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const loadHistory = () => {
    fetch(`${API}/qc/analyses?limit=50`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setHistory(d.analyses || []))
      .catch(() => {});
  };

  useEffect(() => { load(days); }, [days]);
  useEffect(() => { loadHistory(); }, []);

  const exportCSV = async () => {
    setExporting('csv');
    const res = await fetch(`${API}/qc/reports/export/csv`, { headers: authHeaders() });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'qc_analyses.csv'; a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  };

  const exportPDF = async () => {
    setExporting('pdf');
    const res = await fetch(`${API}/qc/reports/export/pdf`, { headers: authHeaders() });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'qc_report.pdf'; a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  };

  const passing  = analytics?.status_distribution?.passing   || 0;
  const failing  = analytics?.status_distribution?.failing   || 0;
  const total    = passing + failing;
  const passRate = total > 0 ? Math.round((passing / total) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
        <Header title="Reports & Analytics" />
        <main className="page-main p-6 lg:p-8">
          <div className="flex justify-between items-start mb-7 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
              <p className="text-sm text-text-gray dark:text-gray-400 mt-1">Quality performance insights and trends</p>
            </div>
            <div className="flex gap-2.5 items-center">
              <select
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-500 dark:text-gray-400 text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last 365 days</option>
              </select>
              <button
                onClick={exportCSV}
                disabled={exporting === 'csv'}
                className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2 text-green-600 dark:text-green-400 text-sm font-semibold cursor-pointer hover:opacity-80"
              >
                {exporting === 'csv' ? '...' : 'CSV'}
              </button>
              <button
                onClick={exportPDF}
                disabled={exporting === 'pdf'}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-red-500 dark:text-red-400 text-sm font-semibold cursor-pointer hover:opacity-80"
              >
                {exporting === 'pdf' ? '...' : 'PDF'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-400 dark:text-gray-500 text-center py-16">Loading analytics...</div>
          ) : analytics ? (
            <div className="flex flex-col gap-5">
              {/* Pass/Fail stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Pass Rate', value: `${passRate}%`, color: '#22c55e', sub: `${passing} tasks` },
                  { label: 'Fail Rate', value: `${100 - passRate}%`, color: '#ef4444', sub: `${failing} tasks` },
                  { label: 'Total Analyses', value: total, color: '#3b82f6', sub: `last ${days} days` },
                ].map((c, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 text-center">
                    <div className="text-text-gray dark:text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">{c.label}</div>
                    <div className="text-4xl font-extrabold" style={{ color: c.color }}>{c.value}</div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs mt-1">{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-gray-800 dark:text-gray-200 mb-4 text-sm font-bold">Quality Score Trend</h3>
                  <BarChart data={analytics.quality_score_trend} xKey="date" yKey="avg_score" color="#3b82f6" />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-gray-800 dark:text-gray-200 mb-4 text-sm font-bold">Todo Completions</h3>
                  <BarChart data={analytics.todo_completion_trend} xKey="date" yKey="count" color="#22c55e" />
                </div>
              </div>

              {/* Top failing standards */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="text-gray-800 dark:text-gray-200 mb-4 text-sm font-bold">
                  Most Frequently Failed Standards
                </h3>
                {analytics.top_failing_standards.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-500 text-sm">No failure data yet. Keep running analyses!</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {analytics.top_failing_standards.map((s, i) => {
                      const maxFail = analytics.top_failing_standards[0]?.failures || 1;
                      return (
                        <div key={i}>
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-500 dark:text-gray-400 text-sm">{s.rule}</span>
                            <span className="text-red-400 text-sm font-bold">{s.failures}x</span>
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-900 rounded-full h-1.5">
                            <div
                              className="bg-red-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${(s.failures / maxFail) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI Evaluation History */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="text-gray-800 dark:text-gray-200 mb-4 text-sm font-bold">
                  AI Evaluation History
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">last 50 analyses</span>
                </h3>
                {history.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">
                    No evaluations yet. Run AI analysis on a task board to see results here.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                          <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide pb-2.5 pr-4">Task</th>
                          <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide pb-2.5 pr-4">Project</th>
                          <th className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide pb-2.5 pr-4">Score</th>
                          <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide pb-2.5 pr-4">Analyst</th>
                          <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide pb-2.5">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h, i) => {
                          const scoreColor = h.compliance_score >= 80 ? '#22c55e' : h.compliance_score >= 60 ? '#f59e0b' : '#ef4444';
                          return (
                            <tr
                              key={h._id || i}
                              className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                            >
                              <td className="py-2.5 pr-4">
                                <span className="text-gray-700 dark:text-gray-300 font-medium line-clamp-1">
                                  {h.task_title || h.task_id || '—'}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4">
                                <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">
                                  {h.project_id ? h.project_id.slice(-8) : '—'}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4 text-center">
                                <span
                                  className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                                  style={{ background: `${scoreColor}22`, color: scoreColor, border: `1px solid ${scoreColor}44` }}
                                >
                                  {h.compliance_score.toFixed(0)}%
                                </span>
                              </td>
                              <td className="py-2.5 pr-4">
                                <span className="text-gray-400 dark:text-gray-500 text-xs font-mono">
                                  {h.analyzed_by ? h.analyzed_by.slice(-8) : '—'}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span className="text-gray-400 dark:text-gray-500 text-xs">
                                  {new Date(h.created_at).toLocaleDateString()}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-red-500 text-center py-16">Failed to load analytics data.</div>
          )}
        </main>
      </div>
    </div>
  );
}
