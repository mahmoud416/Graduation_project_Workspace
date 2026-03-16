import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { QCStandard, QualityRule } from '../types';

const API = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'Content-Type': 'application/json',
});

const CATEGORIES = ['general', 'text', 'image', 'file'];

function RuleRow({ rule, onChange, onRemove }: {
  rule: QualityRule & { _new?: boolean };
  onChange: (updated: QualityRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`flex gap-2.5 items-center bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2.5 border border-gray-100 dark:border-gray-700 transition-opacity ${!rule.is_active ? 'opacity-50' : ''}`}>
      <input
        value={rule.rule}
        onChange={e => onChange({ ...rule, rule: e.target.value })}
        placeholder="Enter rule text..."
        className="flex-1 bg-transparent border-none text-gray-800 dark:text-gray-200 text-sm outline-none placeholder:text-gray-400"
      />
      <select
        value={rule.category}
        onChange={e => onChange({ ...rule, category: e.target.value as QualityRule['category'] })}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-500 dark:text-gray-400 text-xs px-2 py-1"
      >
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
        <input
          type="checkbox"
          checked={rule.is_active}
          onChange={e => onChange({ ...rule, is_active: e.target.checked })}
          className="w-3.5 h-3.5 accent-blue-600"
        />
        <span className="text-[11px] text-gray-400 dark:text-gray-500">Active</span>
      </label>
      <button
        onClick={onRemove}
        className="bg-transparent border-none text-red-500 cursor-pointer text-base px-1 hover:text-red-400"
      >✕</button>
    </div>
  );
}

export default function QCStandards() {
  const [standards, setStandards] = useState<QCStandard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [datasetUpload, setDatasetUpload] = useState<{ standardId: string; file: File | null }>({ standardId: '', file: null });
  const [uploadingDataset, setUploadingDataset] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', standard_type: 'text_rules',
    scope: 'global', project_ids: '',
  });
  const [rules, setRules] = useState<QualityRule[]>([]);

  const resetForm = () => {
    setForm({ title: '', description: '', standard_type: 'text_rules', scope: 'global', project_ids: '' });
    setRules([]);
    setEditingId(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (std: QCStandard) => {
    setEditingId(std._id);
    setForm({
      title: std.title,
      description: std.description,
      standard_type: std.standard_type,
      scope: std.scope,
      project_ids: std.project_ids?.join(', ') || '',
    });
    setRules(std.rules.map(r => ({ ...r })));
    setError('');
    setShowForm(true);
  };

  const load = () => {
    setLoading(true);
    fetch(`${API}/qc/standards`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setStandards(d.standards || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addRule = () => {
    setRules(prev => [...prev, { id: Date.now().toString(), rule: '', category: 'general', is_active: true }]);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const body = {
        ...form,
        project_ids: form.project_ids ? form.project_ids.split(',').map(s => s.trim()) : [],
        rules: rules.filter(r => r.rule.trim()),
      };
      const url = editingId ? `${API}/qc/standards/${editingId}` : `${API}/qc/standards`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: authHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).detail || `Failed to ${editingId ? 'update' : 'create'}`);
      setShowForm(false);
      resetForm();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    }
    setSaving(false);
  };

  const deleteStandard = async (id: string) => {
    if (!confirm('Delete this standard?')) return;
    await fetch(`${API}/qc/standards/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };

  const uploadDataset = async (standardId: string) => {
    if (!datasetUpload.file) return;
    setUploadingDataset(true);
    const formData = new FormData();
    formData.append('file', datasetUpload.file);
    formData.append('description', datasetUpload.file.name);
    await fetch(`${API}/qc/standards/${standardId}/dataset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: formData,
    });
    setDatasetUpload({ standardId: '', file: null });
    setUploadingDataset(false);
    load();
  };

  return (
    <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
        <Header title="Quality Standards" />
        <main className="page-main p-6 lg:p-8">
          <div className="flex justify-between items-start mb-7">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Quality Standards</h1>
              <p className="text-sm text-text-gray dark:text-gray-400 mt-1">
                Define rules and datasets for AI task evaluation
              </p>
            </div>
            <button
              onClick={openCreate}
              className="bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl px-5 py-2.5 text-white text-sm font-semibold cursor-pointer border-none hover:opacity-90 transition-opacity"
            >
              + New Standard
            </button>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
              <h3 className="text-gray-800 dark:text-gray-200 mb-5 text-base font-bold">
                {editingId ? 'Edit Quality Standard' : 'Create New Quality Standard'}
              </h3>
              <div className="flex flex-col gap-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">TITLE *</label>
                    <input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g., UI Design Standards"
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">TYPE</label>
                    <select
                      value={form.standard_type}
                      onChange={e => setForm(f => ({ ...f, standard_type: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm"
                    >
                      <option value="text_rules">Text Rules</option>
                      <option value="dataset">Dataset</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">DESCRIPTION</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe what this standard evaluates..."
                    rows={2}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">SCOPE</label>
                    <select
                      value={form.scope}
                      onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm"
                    >
                      <option value="global">Global (all projects)</option>
                      <option value="project">Specific project(s)</option>
                    </select>
                  </div>
                  {form.scope === 'project' && (
                    <div>
                      <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold block mb-1.5">PROJECT IDs (comma-separated)</label>
                      <input
                        value={form.project_ids}
                        onChange={e => setForm(f => ({ ...f, project_ids: e.target.value }))}
                        placeholder="id1, id2, ..."
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  )}
                </div>

                {/* Rules builder */}
                {form.standard_type === 'text_rules' && (
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <label className="text-gray-500 dark:text-gray-400 text-xs font-semibold">QUALITY RULES</label>
                      <button
                        onClick={addRule}
                        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-1 text-blue-600 dark:text-blue-400 text-xs cursor-pointer hover:opacity-80"
                      >
                        + Add Rule
                      </button>
                    </div>
                    {rules.length === 0 && (
                      <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        No rules yet. Click "Add Rule" to define quality criteria.
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      {rules.map((rule, i) => (
                        <RuleRow
                          key={rule.id}
                          rule={rule}
                          onChange={updated => setRules(prev => prev.map((r, idx) => idx === i ? updated : r))}
                          onRemove={() => setRules(prev => prev.filter((_, idx) => idx !== i))}
                        />
                      ))}
                    </div>
                    <div className="mt-2">
                      <div className="text-gray-400 dark:text-gray-500 text-[11px]">
                        Example rules: "Task must have a detailed description" · "UI images must show navigation" · "Docs must include numbered steps"
                      </div>
                    </div>
                  </div>
                )}

                {error && <div className="text-red-400 text-sm">⚠ {error}</div>}

                <div className="flex gap-2.5 justify-end">
                  <button
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-5 py-2.5 text-gray-500 dark:text-gray-400 text-sm cursor-pointer hover:opacity-80"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className={`rounded-lg px-6 py-2.5 text-white text-sm font-bold border-none ${saving ? 'bg-gray-400 dark:bg-gray-600 cursor-default' : 'bg-gradient-to-br from-blue-600 to-violet-600 cursor-pointer hover:opacity-90'}`}
                  >
                    {saving ? 'Saving...' : editingId ? 'Update Standard' : 'Create Standard'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400 dark:text-gray-500 text-center py-16">Loading standards...</div>
          ) : standards.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-dashed border-gray-300 dark:border-gray-600">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-gray-800 dark:text-gray-200 mb-2 font-bold">No Quality Standards Yet</h3>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                Create your first standard to start evaluating tasks with AI.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {standards.map(std => (
                <div key={std._id} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-gray-900 dark:text-gray-100 text-[15px] font-bold">{std.title}</h3>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          std.scope === 'global'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {std.scope === 'global' ? 'GLOBAL' : 'PROJECT'}
                        </span>
                        <span className="bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded px-2 py-0.5 text-[11px] font-semibold">
                          {std.standard_type === 'text_rules' ? 'TEXT RULES' : 'DATASET'}
                        </span>
                      </div>
                      <p className="text-text-gray dark:text-gray-400 mt-1.5 text-sm">{std.description}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(std)}
                        className="bg-transparent border-none text-gray-400 dark:text-gray-500 cursor-pointer text-sm hover:text-blue-500 transition-colors px-1"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => deleteStandard(std._id)}
                        className="bg-transparent border-none text-gray-400 dark:text-gray-500 cursor-pointer text-base hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {std.rules.length > 0 && (
                    <div>
                      <div className="text-gray-400 dark:text-gray-500 text-[11px] font-semibold mb-2 uppercase tracking-wide">
                        Rules ({std.rules.filter(r => r.is_active).length} active)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {std.rules.map(r => (
                          <span
                            key={r.id}
                            className={`bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-md px-2.5 py-1 text-gray-500 dark:text-gray-400 text-xs ${!r.is_active ? 'opacity-40' : ''}`}
                          >
                            [{r.category}] {r.rule}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {std.standard_type === 'dataset' && (
                    <div className="mt-3">
                      <div className="text-gray-400 dark:text-gray-500 text-[11px] font-semibold mb-2 uppercase">
                        Dataset Files ({std.dataset_files.length})
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="file"
                          onChange={e => setDatasetUpload({ standardId: std._id, file: e.target.files?.[0] || null })}
                          className="text-gray-500 dark:text-gray-400 text-xs"
                        />
                        {datasetUpload.standardId === std._id && datasetUpload.file && (
                          <button
                            onClick={() => uploadDataset(std._id)}
                            disabled={uploadingDataset}
                            className="bg-blue-600 border-none rounded-md px-3 py-1.5 text-white text-xs cursor-pointer hover:bg-blue-700"
                          >
                            {uploadingDataset ? 'Uploading...' : 'Upload'}
                          </button>
                        )}
                      </div>
                      {std.dataset_files.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {std.dataset_files.map(f => (
                            <span key={f.id} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-0.5 text-gray-400 dark:text-gray-500 text-[11px]">
                              📎 {f.file_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
