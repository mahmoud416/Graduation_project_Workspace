import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const token = () => localStorage.getItem('token') || '';
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });
const authJsonHeaders = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Dataset {
  _id: string; name: string; description: string; label: string;
  dataset_type: string; tags: string[]; files: DatasetFile[];
  used_in_training: boolean; created_at: string; version: number;
}
interface DatasetFile { id: string; file_name: string; file_type: string; file_size: number; }
interface TrainingJob {
  _id: string; status: 'queued' | 'running' | 'completed' | 'failed';
  model_version: string; progress: number; notes: string;
  metrics: { datasets_processed: number; files_processed: number; patterns_extracted: number; accuracy_estimate: number; examples_learned: number; };
  patterns_summary: string[]; error_message?: string;
  created_at: string; completed_at?: string; duration_secs?: number;
}
interface ModelMetrics {
  total_datasets: number; total_jobs: number; completed_jobs: number; failed_jobs: number;
  current_version: string; current_accuracy: number; total_patterns: number; total_examples: number;
  avg_analysis_score: number;
  accuracy_history: { version: string; accuracy: number; date: string; examples: number }[];
  dataset_type_dist: Record<string, number>;
  label_distribution: Record<string, number>;
}
interface ModelStatus {
  status: string; version: string; accuracy: number; patterns: string[];
  total_examples: number; trained_at?: string; message?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatCard({ title, value, sub, color = '#6366f1', icon }: {
  title: string; value: string | number; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 border"
      style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)`, borderColor: `${color}30` }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{title}</div>
          <div className="text-3xl font-extrabold" style={{ color }}>{value}</div>
          {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
        {icon && <span className="text-3xl opacity-70">{icon}</span>}
      </div>
    </div>
  );
}

function AccuracyBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-2">
      <div className="h-2 rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    running:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    trained:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    untrained: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const icons: Record<string, string> = { queued: '⏳', running: '⚡', completed: '✅', failed: '❌', trained: '🧠', untrained: '🔲' };
  const cls = styles[status] || styles.untrained;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
      {icons[status] || ''} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function AccuracyHistoryChart({ data }: { data: { version: string; accuracy: number }[] }) {
  if (!data || data.length === 0)
    return <p className="text-gray-400 text-sm text-center py-4">No training history yet.</p>;
  const max = Math.max(...data.map(d => d.accuracy), 1);
  return (
    <div className="flex items-end gap-2 h-28 mt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            title={`v${d.version}: ${d.accuracy.toFixed(1)}%`}
            className="w-full rounded-t transition-all duration-700 cursor-default hover:opacity-80"
            style={{ background: `linear-gradient(to top, #6366f1, #8b5cf6)`, height: `${Math.max((d.accuracy / max) * 100, 4)}%`, minHeight: '4px' }}
          />
          <span className="text-[9px] text-gray-400 text-center leading-none">v{d.version}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function QualityManagerDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'datasets' | 'training' | 'patterns'>('overview');

  // Upload dataset form state
  const [uploading, setUploading] = useState(false);
  const [dsName, setDsName] = useState('');
  const [dsDesc, setDsDesc] = useState('');
  const [dsLabel, setDsLabel] = useState('good_quality');
  const [dsType, setDsType] = useState('task_examples');
  const [dsTags, setDsTags] = useState('');
  const [dsFiles, setDsFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Training form state
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [trainingNotes, setTrainingNotes] = useState('');
  const [training, setTraining] = useState(false);
  const [trainingMsg, setTrainingMsg] = useState('');

  // Polling state
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [mRes, sRes, dRes, jRes] = await Promise.all([
        fetch(`${API}/qc/ai/model-metrics`, { headers: authHeaders() }),
        fetch(`${API}/qc/ai/model-status`,  { headers: authHeaders() }),
        fetch(`${API}/qc/ai/datasets`,       { headers: authHeaders() }),
        fetch(`${API}/qc/ai/training-jobs`,  { headers: authHeaders() }),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (sRes.ok) setModelStatus(await sRes.json());
      if (dRes.ok) { const d = await dRes.json(); setDatasets(d.datasets || []); }
      if (jRes.ok) { const j = await jRes.json(); setJobs(j.jobs || []); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Poll running jobs
  useEffect(() => {
    if (!pollingJobId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`${API}/qc/ai/training-jobs/${pollingJobId}`, { headers: authHeaders() });
      if (res.ok) {
        const job: TrainingJob = await res.json();
        setJobs(prev => prev.map(j => j._id === pollingJobId ? job : j));
        if (job.status === 'completed' || job.status === 'failed') {
          setPollingJobId(null);
          setTrainingMsg(job.status === 'completed'
            ? `✅ Training complete! Model v${job.model_version} — Accuracy: ${job.metrics?.accuracy_estimate?.toFixed(1)}%`
            : `❌ Training failed: ${job.error_message}`);
          reload();
        }
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [pollingJobId, reload]);

  // ── Dataset Upload ──────────────────────────────────────────────────────────
  const handleUploadDataset = async () => {
    if (!dsName.trim()) return;
    setUploading(true);
    try {
      // 1. Create dataset record
      const form = new FormData();
      form.append('name', dsName);
      form.append('description', dsDesc);
      form.append('label', dsLabel);
      form.append('dataset_type', dsType);
      form.append('tags', dsTags);
      const res = await fetch(`${API}/qc/ai/datasets`, { method: 'POST', headers: authHeaders(), body: form });
      if (!res.ok) throw new Error('Failed to create dataset');
      const ds: Dataset = await res.json();

      // 2. Upload individual files
      for (const file of dsFiles) {
        const ff = new FormData();
        ff.append('file', file);
        await fetch(`${API}/qc/ai/datasets/${ds._id}/files`, { method: 'POST', headers: authHeaders(), body: ff });
      }

      // Reset form
      setDsName(''); setDsDesc(''); setDsTags(''); setDsFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      reload();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDataset = async (id: string) => {
    if (!confirm('Delete this dataset?')) return;
    await fetch(`${API}/qc/ai/datasets/${id}`, { method: 'DELETE', headers: authHeaders() });
    reload();
  };

  // ── Training Trigger ────────────────────────────────────────────────────────
  const handleTriggerTraining = async () => {
    if (selectedDatasets.length === 0) { alert('Select at least one dataset'); return; }
    setTraining(true); setTrainingMsg('');
    try {
      const form = new FormData();
      form.append('dataset_ids', selectedDatasets.join(','));
      form.append('notes', trainingNotes);
      const res = await fetch(`${API}/qc/ai/train`, { method: 'POST', headers: authHeaders(), body: form });
      if (!res.ok) throw new Error('Training trigger failed');
      const data = await res.json();
      setTrainingMsg(`⚡ Training job queued (${data.model_version}). Watching progress...`);
      setPollingJobId(data.job_id);
      setSelectedDatasets([]); setTrainingNotes('');
      reload();
    } catch (err: any) {
      setTrainingMsg(`❌ ${err.message}`);
    } finally {
      setTraining(false);
    }
  };

  const toggleDatasetSelection = (id: string) => {
    setSelectedDatasets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview',  label: '📊 Overview' },
    { id: 'datasets',  label: '📦 Datasets' },
    { id: 'training',  label: '🚀 Training' },
    { id: 'patterns',  label: '🧠 Patterns' },
  ] as const;

  const runningJob = jobs.find(j => j.status === 'running' || j.status === 'queued');

  return (
    <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
        <Header title="Quality Manager — AI Model" />
        <main className="page-main p-6 lg:p-8">

          {/* Page header */}
          <div className="mb-7 flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                🧠 AI Quality Model Manager
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Upload datasets, train the model, define patterns, and monitor model learning
              </p>
            </div>
            {modelStatus && (
              <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 border border-gray-200 dark:border-gray-700">
                <StatusPill status={modelStatus.status} />
                <div className="text-sm">
                  <div className="font-bold text-gray-800 dark:text-gray-200">Model {modelStatus.version}</div>
                  {modelStatus.status === 'trained' && (
                    <div className="text-gray-500 text-xs">Accuracy: {modelStatus.accuracy}%</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Running job progress bar */}
          {runningJob && (
            <div className="mb-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                  ⚡ Training in progress — Model {runningJob.model_version}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{runningJob.progress}%</span>
              </div>
              <div className="w-full bg-blue-100 dark:bg-blue-900 rounded-full h-2">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${runningJob.progress}%` }} />
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 w-fit">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-violet-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
              {activeTab === 'overview' && metrics && (
                <div className="space-y-5">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Datasets"        value={metrics.total_datasets}     color="#6366f1" icon="📦" />
                    <StatCard title="Training Runs"   value={metrics.total_jobs}         color="#8b5cf6" icon="🚀" />
                    <StatCard title="Model Accuracy"  value={`${metrics.current_accuracy}%`} color={metrics.current_accuracy >= 75 ? '#22c55e' : '#f59e0b'} icon="🎯" />
                    <StatCard title="Patterns Learned" value={metrics.total_patterns}    color="#0891b2" icon="🧩" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Examples Learned" value={metrics.total_examples}    color="#f59e0b" icon="📝" />
                    <StatCard title="Completed Runs"   value={metrics.completed_jobs}    color="#22c55e" icon="✅" />
                    <StatCard title="Failed Runs"      value={metrics.failed_jobs}       color="#ef4444" icon="❌" />
                    <StatCard title="Avg Task Score"   value={`${metrics.avg_analysis_score}%`} color="#6366f1" icon="📊" />
                  </div>

                  {/* Charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Accuracy history */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">Model Accuracy Over Time</h3>
                      <p className="text-xs text-gray-400 mb-3">Each bar = one training run</p>
                      <AccuracyHistoryChart data={metrics.accuracy_history} />
                    </div>

                    {/* Dataset distribution */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Dataset Distribution</h3>
                      <div className="space-y-3">
                        {Object.entries(metrics.dataset_type_dist).map(([type, count]) => (
                          <div key={type}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600 dark:text-gray-400 capitalize">{type.replace(/_/g, ' ')}</span>
                              <span className="font-bold text-gray-800 dark:text-gray-200">{count}</span>
                            </div>
                            <AccuracyBar value={(count / metrics.total_datasets) * 100 || 0} color="#6366f1" />
                          </div>
                        ))}
                        {Object.keys(metrics.dataset_type_dist).length === 0 && (
                          <p className="text-gray-400 text-sm">No datasets uploaded yet.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Label distribution */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Dataset Label Distribution</h3>
                    <div className="flex gap-4 flex-wrap">
                      {Object.entries(metrics.label_distribution).map(([label, count]) => (
                        <div key={label} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3 border border-gray-100 dark:border-gray-700">
                          <span className="text-lg">{label === 'good_quality' ? '✅' : '⚠️'}</span>
                          <div>
                            <div className="text-xs text-gray-500 capitalize">{label.replace(/_/g, ' ')}</div>
                            <div className="text-xl font-extrabold text-gray-800 dark:text-gray-100">{count}</div>
                          </div>
                        </div>
                      ))}
                      {Object.keys(metrics.label_distribution).length === 0 && (
                        <p className="text-gray-400 text-sm">No labeled datasets yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { label: '📦 Upload Dataset', tab: 'datasets', color: '#6366f1' },
                      { label: '🚀 Train Model',    tab: 'training', color: '#8b5cf6' },
                      { label: '🧠 View Patterns',  tab: 'patterns', color: '#0891b2' },
                      { label: '📊 QC Reports',     path: '/qc/reports', color: '#22c55e' },
                    ].map(action => (
                      <button
                        key={action.label}
                        onClick={() => 'tab' in action ? setActiveTab(action.tab as any) : navigate(action.path!)}
                        className="rounded-xl px-5 py-2.5 text-sm font-semibold border cursor-pointer transition-all hover:opacity-80 flex items-center gap-2"
                        style={{ background: `${action.color}15`, borderColor: `${action.color}40`, color: action.color }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── DATASETS TAB ──────────────────────────────────────────── */}
              {activeTab === 'datasets' && (
                <div className="space-y-5">
                  {/* Upload form */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-lg flex items-center gap-2">
                      📤 Upload New Dataset
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Dataset Name *</label>
                        <input value={dsName} onChange={e => setDsName(e.target.value)}
                          placeholder="e.g. High Quality Task Examples Q1"
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Tags (comma-separated)</label>
                        <input value={dsTags} onChange={e => setDsTags(e.target.value)}
                          placeholder="ui-ux, sprint-1, frontend"
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Label</label>
                        <select value={dsLabel} onChange={e => setDsLabel(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400">
                          <option value="good_quality">✅ Good Quality (positive examples)</option>
                          <option value="poor_quality">⚠️ Poor Quality (negative examples)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Dataset Type</label>
                        <select value={dsType} onChange={e => setDsType(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400">
                          <option value="task_examples">📝 Task Examples</option>
                          <option value="documentation">📄 Documentation</option>
                          <option value="screenshots">🖼️ Screenshots</option>
                          <option value="mixed">🗂️ Mixed</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Description</label>
                        <textarea value={dsDesc} onChange={e => setDsDesc(e.target.value)} rows={2}
                          placeholder="Describe what this dataset represents..."
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
                      </div>
                    </div>

                    {/* File dropzone */}
                    <div
                      className="border-2 border-dashed border-violet-300 dark:border-violet-700 rounded-xl p-6 text-center cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors mb-4"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); setDsFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
                    >
                      <div className="text-3xl mb-2">📂</div>
                      <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                        Drag & drop files or click to browse
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Supports: TXT, JSON, CSV, PDF, PNG, JPG, DOCX, MD
                      </div>
                      <input ref={fileInputRef} type="file" multiple className="hidden"
                        onChange={e => setDsFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
                    </div>

                    {/* File list */}
                    {dsFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {dsFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-lg px-3 py-1.5 text-xs font-medium border border-violet-200 dark:border-violet-800">
                            📎 {f.name}
                            <button onClick={() => setDsFiles(prev => prev.filter((_, j) => j !== i))}
                              className="ml-1 text-violet-400 hover:text-red-500 transition-colors">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={handleUploadDataset} disabled={uploading || !dsName.trim()}
                      className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer text-sm">
                      {uploading ? '⏳ Uploading...' : '📤 Upload Dataset'}
                    </button>
                  </div>

                  {/* Dataset list */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">
                      Uploaded Datasets ({datasets.length})
                    </h3>
                    {datasets.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-6">
                        No datasets yet. Upload your first dataset above.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {datasets.map(ds => (
                          <div key={ds._id}
                            className="flex items-start justify-between gap-3 rounded-xl p-4 border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{ds.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  ds.label === 'good_quality'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                }`}>{ds.label === 'good_quality' ? '✅ Good' : '⚠️ Poor'}</span>
                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">{ds.dataset_type.replace(/_/g, ' ')}</span>
                                {ds.used_in_training && <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">🚀 Trained</span>}
                              </div>
                              {ds.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{ds.description}</p>}
                              <div className="text-xs text-gray-400 mt-1">
                                {ds.files.length} file{ds.files.length !== 1 ? 's' : ''} · {new Date(ds.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <button onClick={() => handleDeleteDataset(ds._id)}
                              className="text-gray-400 hover:text-red-500 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer flex-shrink-0">
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TRAINING TAB ──────────────────────────────────────────── */}
              {activeTab === 'training' && (
                <div className="space-y-5">
                  {/* Training trigger */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1 text-lg">🚀 Start Training Run</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Select datasets to train on. The model will extract quality patterns and update its evaluation logic.
                    </p>

                    {trainingMsg && (
                      <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
                        trainingMsg.startsWith('✅')
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                          : trainingMsg.startsWith('❌')
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      }`}>
                        {trainingMsg}
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                        Select Datasets ({selectedDatasets.length} selected)
                      </label>
                      {datasets.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                          No datasets available. Upload datasets first.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                          {datasets.map(ds => (
                            <div
                              key={ds._id}
                              onClick={() => toggleDatasetSelection(ds._id)}
                              className={`flex items-center gap-3 rounded-xl p-3 border cursor-pointer transition-all ${
                                selectedDatasets.includes(ds._id)
                                  ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                selectedDatasets.includes(ds._id) ? 'border-violet-500 bg-violet-500' : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {selectedDatasets.includes(ds._id) && <span className="text-white text-[10px] font-bold">✓</span>}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{ds.name}</div>
                                <div className="text-xs text-gray-400">{ds.files.length} files · {ds.label === 'good_quality' ? '✅' : '⚠️'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Training Notes (optional)</label>
                      <input value={trainingNotes} onChange={e => setTrainingNotes(e.target.value)}
                        placeholder="e.g. Q1 baseline training with UI task examples"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>

                    <button
                      onClick={handleTriggerTraining}
                      disabled={training || selectedDatasets.length === 0 || !!runningJob}
                      className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer text-sm"
                    >
                      {training ? '⏳ Queuing...' : runningJob ? '⚡ Training in progress...' : '🚀 Start Training'}
                    </button>
                  </div>

                  {/* Training history */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Training History</h3>
                    {jobs.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-6">No training runs yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {jobs.map(job => (
                          <div key={job._id}
                            className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                                    Model v{job.model_version}
                                  </span>
                                  <StatusPill status={job.status} />
                                  {job.notes && (
                                    <span className="text-xs text-gray-400 italic">"{job.notes}"</span>
                                  )}
                                </div>
                                {job.status === 'completed' && job.metrics && (
                                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span>🎯 {job.metrics.accuracy_estimate?.toFixed(1)}% accuracy</span>
                                    <span>🧩 {job.metrics.patterns_extracted} patterns</span>
                                    <span>📝 {job.metrics.examples_learned} examples</span>
                                    <span>📦 {job.metrics.datasets_processed} datasets</span>
                                    {job.duration_secs && <span>⏱️ {job.duration_secs.toFixed(1)}s</span>}
                                  </div>
                                )}
                                {job.status === 'running' && (
                                  <div className="mt-2">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                      <span>Progress</span><span>{job.progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                      <div className="h-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all"
                                        style={{ width: `${job.progress}%` }} />
                                    </div>
                                  </div>
                                )}
                                {job.error_message && (
                                  <p className="text-xs text-red-500 mt-1">{job.error_message}</p>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 text-right flex-shrink-0">
                                <div>{new Date(job.created_at).toLocaleDateString()}</div>
                                <div>{new Date(job.created_at).toLocaleTimeString()}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── PATTERNS TAB ──────────────────────────────────────────── */}
              {activeTab === 'patterns' && (
                <div className="space-y-5">
                  {modelStatus && modelStatus.status === 'trained' ? (
                    <>
                      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">
                              🧩 Learned Quality Patterns
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              Model v{modelStatus.version} · {modelStatus.patterns.length} patterns · {modelStatus.total_examples} examples trained
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-extrabold text-violet-500">{modelStatus.accuracy}%</div>
                            <div className="text-xs text-gray-400">Estimated Accuracy</div>
                          </div>
                        </div>
                        <AccuracyBar value={modelStatus.accuracy} color="#8b5cf6" />
                        <div className="mt-4 space-y-2">
                          {modelStatus.patterns.map((pattern, i) => (
                            <div key={i}
                              className="flex items-start gap-3 bg-violet-50 dark:bg-violet-900/10 rounded-xl p-3 border border-violet-100 dark:border-violet-900/30">
                              <span className="text-violet-500 font-bold text-sm mt-0.5 flex-shrink-0">{i + 1}.</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{pattern}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10 rounded-2xl p-5 border border-violet-200 dark:border-violet-800">
                        <h4 className="font-bold text-violet-800 dark:text-violet-300 mb-2">💡 How patterns work</h4>
                        <p className="text-sm text-violet-700 dark:text-violet-400">
                          These patterns are automatically injected into every task analysis. When a team member clicks
                          <strong> "Analyze with AI"</strong> on a task, the AI evaluates it against both the defined
                          quality standards <em>and</em> these learned patterns from your training datasets.
                          The more high-quality example datasets you upload, the better the model becomes.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 border border-gray-200 dark:border-gray-700 text-center">
                      <div className="text-5xl mb-4">🧠</div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">No model trained yet</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto mb-6">
                        Upload datasets and run a training job to teach the AI model what high-quality tasks look like.
                        Learned patterns will appear here after the first successful training run.
                      </p>
                      <button onClick={() => setActiveTab('datasets')}
                        className="bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 cursor-pointer text-sm">
                        📦 Upload First Dataset
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </main>
      </div>
    </div>
  );
}
