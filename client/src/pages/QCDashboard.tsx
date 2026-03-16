import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { QCDashboardStats, QCAnalysis } from '../types';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const token = () => localStorage.getItem('token') || '';
const authHeaders = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

function StatCard({ title, value, sub, color = '#3b82f6' }: {
  title: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
      <div className="text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wide mb-2">
        {title}
      </div>
      <div className="text-3xl font-extrabold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-bold border"
      style={{ background: `${color}22`, color, borderColor: `${color}44` }}
    >
      {score.toFixed(0)}%
    </span>
  );
}

function MiniTrend({ data }: { data: { date: string; avg_score: number }[] }) {
  if (!data || data.length === 0) return (
    <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
      No trend data yet. Run AI analyses to see the score trend.
    </p>
  );
  const max = Math.max(...data.map(d => d.avg_score), 1);
  return (
    <div className="flex items-end gap-1 h-[80px] mt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            title={`${d.date}: ${d.avg_score}%`}
            className="w-full rounded-t cursor-default hover:opacity-70 transition-opacity"
            style={{
              background: d.avg_score >= 80 ? '#22c55e' : d.avg_score >= 60 ? '#f59e0b' : '#ef4444',
              height: `${Math.max((d.avg_score / max) * 100, 4)}%`,
              minHeight: '4px',
            }}
          />
          {i % 3 === 0 && (
            <span className="text-[9px] text-gray-400 dark:text-gray-500">{d.date}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function QCDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<QCDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/qc/reports/dashboard`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
        <Header title="QC Dashboard" />
        <main className="page-main p-6 lg:p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">QC Dashboard</h1>
            <p className="text-sm text-text-gray dark:text-gray-400 mt-1">
              AI-powered quality assurance overview
            </p>
          </div>

          {loading ? (
            <div className="text-gray-400 dark:text-gray-500 text-center py-16">
              <div className="w-10 h-10 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 animate-spin mx-auto mb-3" />
              Loading dashboard...
            </div>
          ) : stats ? (
            <>
              {/* Stats Grid — 7 cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-7">
                <StatCard title="Standards"      value={stats.total_standards}                 color="#3b82f6" />
                <StatCard title="Total Analyses" value={stats.total_analyses}                  color="#8b5cf6" />
                <StatCard title="Avg Compliance" value={`${stats.avg_compliance_score}%`}      color={stats.avg_compliance_score >= 70 ? '#22c55e' : '#f59e0b'} />
                <StatCard title="Passing"        value={stats.tasks_passing_qc}                color="#22c55e" />
                <StatCard title="Failing"        value={stats.tasks_failing_qc}                color="#ef4444" />
                <StatCard title="Awaiting QC"    value={stats.tasks_awaiting_qc}               color="#f59e0b" sub="not yet analyzed" />
                <StatCard title="Todo Checks"    value={stats.total_todo_completions}          color="#0891b2" />
              </div>

              {/* Main grid: recent analyses + compliance by project */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 mb-5">
                {/* Recent Analyses */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-gray-800 dark:text-gray-200 mb-4 text-[15px] font-bold">
                    Recent AI Analyses
                  </h3>
                  {stats.recent_analyses.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      No analyses yet. Click "Analyze with AI" on any task board.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {stats.recent_analyses.map((a: QCAnalysis, i) => (
                        <div
                          key={i}
                          className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 flex justify-between items-center border border-gray-100 dark:border-gray-700"
                        >
                          <div>
                            <div className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                              {a.task_title || 'Untitled Task'}
                            </div>
                            <div className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
                              {new Date(a.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <ScoreBadge score={a.compliance_score} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compliance by Project */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-gray-800 dark:text-gray-200 mb-4 text-[15px] font-bold">
                    Score by Project
                  </h3>
                  {stats.compliance_by_project.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-500 text-sm">No project data yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {stats.compliance_by_project.map((p, i) => (
                        <div key={i}>
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs truncate max-w-[140px]">
                              {p.project_id.slice(-8)}
                            </span>
                            <span
                              className="text-xs font-bold ml-2"
                              style={{ color: p.avg_score >= 70 ? '#22c55e' : '#ef4444' }}
                            >
                              {p.avg_score}%
                            </span>
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-900 rounded-full h-1.5">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                background: p.avg_score >= 70 ? '#22c55e' : '#ef4444',
                                width: `${p.avg_score}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quality Score Trend (14 days) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 mb-5">
                <h3 className="text-gray-800 dark:text-gray-200 mb-1 text-[15px] font-bold">
                  Quality Score Trend
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">last 14 days</span>
                </h3>
                <MiniTrend data={stats.quality_trend_14d ?? []} />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: '📋  Manage Standards', path: '/qc/standards', color: '#2563eb' },
                  { label: '📊  View Reports',      path: '/qc/reports',   color: '#7c3aed' },
                  { label: '🗺  Roadmap AI',         path: '/qc/roadmap',   color: '#0891b2' },
                  { label: '🧠  AI Model Training',  path: '/qm',           color: '#6366f1' },
                ].map(action => (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    className="rounded-xl px-5 py-3 text-sm font-semibold flex items-center gap-2 border cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: `${action.color}15`, borderColor: `${action.color}44`, color: action.color }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-red-500 text-center py-16">
              Unable to load dashboard data. Check your connection.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
