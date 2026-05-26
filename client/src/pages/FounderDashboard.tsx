import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { ShieldAlert, Activity, BookOpen, Layers, Edit3, Save, Plus, Building2, CheckCircle2, History, Database, Cpu, DollarSign, TrendingUp, AlertTriangle, AlertCircle, Info } from 'lucide-react';


export default function FounderDashboard() {
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  const [entities, setEntities] = useState<any[]>([]);
  const [newEntityForm, setNewEntityForm] = useState({ name: '', description: '', frameworks: [] as string[], subscription_tier: 'Basic' });
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  useEffect(() => {
    fetchFrameworks();
    fetchEntities();
    fetchMetrics();
    fetchAuditLogs();
  }, []);

  const fetchFrameworks = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/frameworks`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setFrameworks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntities = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/entities`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/founder/metrics`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setMetrics(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/founder/audit-logs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/frameworks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          name: 'New Framework',
          description: 'Description here',
          ai_prompt_template: 'Enter prompt here',
          acceptance_threshold: 70
        })
      });
      if (!res.ok) throw new Error('Failed to create');
      const data = await res.json();
      setFrameworks([...frameworks, data]);
      setEditingId(data._id);
      setEditForm(data);
    } catch (err) {
      console.error('Error creating framework', err);
    }
  };

  const handleUpdate = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/frameworks/${editingId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setFrameworks(frameworks.map(f => f._id === editingId ? data : f));
      setEditingId(null);
    } catch (err) {
      console.error('Error updating framework', err);
    }
  };

  const handleCreateEntity = async () => {
    if (!newEntityForm.name) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/entities`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          name: newEntityForm.name,
          description: newEntityForm.description,
          quality_framework_ids: newEntityForm.frameworks,
          subscription_tier: newEntityForm.subscription_tier
        })
      });
      if (!res.ok) throw new Error('Failed to create entity');
      const data = await res.json();
      setEntities([...entities, data]);
      setNewEntityForm({ name: '', description: '', frameworks: [], subscription_tier: 'Basic' });
    } catch (err) {
      console.error('Error creating entity', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background dark:bg-gray-950">
        <Sidebar />
        <div className="flex-1 ml-[var(--sidebar-width)]">
          <Header title="Global Dashboard" />
          <div className="flex h-screen items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
        <Header title="Global Dashboard" />
        <main className="page-main p-8 relative">
          <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Founder & Global Compliance Dashboard
            </h1>
            <p className="mt-3 text-gray-400 text-lg">
              Manage Quality Systems, AI Frameworks, and Cross-Tenant Metrics.
            </p>
          </div>

          {/* Top Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-indigo-500 transition-all shadow-lg flex items-center">
               <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 mr-4">
                  <Activity size={28} />
               </div>
               <div>
                 <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Health / Active</p>
                 <h3 className="text-xl font-bold">{metrics ? metrics.active_now : '-'} Users</h3>
               </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-purple-500 transition-all shadow-lg flex items-center">
               <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400 mr-4">
                  <Building2 size={28} />
               </div>
               <div>
                 <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Active Tenants</p>
                 <h3 className="text-xl font-bold">{metrics ? metrics.total_entities : '-'}</h3>
               </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-blue-500 transition-all shadow-lg flex items-center">
               <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 mr-4">
                  <Cpu size={28} />
               </div>
               <div>
                 <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">AI Evals Pending</p>
                 <h3 className="text-xl font-bold">{metrics ? metrics.pending_ai_evals : '-'}</h3>
               </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-green-500 transition-all shadow-lg flex items-center">
               <div className="p-3 bg-green-500/10 rounded-lg text-green-400 mr-4">
                  <ShieldAlert size={28} />
               </div>
               <div>
                 <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Global AI Score</p>
                 <h3 className="text-xl font-bold text-green-400">{metrics ? `${metrics.avg_quality_score}%` : '-'}</h3>
               </div>
            </div>
          </div>

          {/* Premium SaaS Analytics Section */}
          {metrics && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
              
              {/* Financials & Growth */}
              <div className="lg:col-span-1 bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-xl flex flex-col">
                <div className="flex items-center mb-6">
                  <DollarSign className="text-green-400 mr-2" size={20} />
                  <h3 className="text-lg font-bold text-white">MRR & Growth</h3>
                </div>
                
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-400 mb-1">Monthly Recurring Revenue</p>
                  <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
                    ${metrics.financials?.mrr?.toLocaleString() || 0}
                  </h2>
                </div>
                
                <div className="mt-auto space-y-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Subscription Distribution</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Enterprise ($999/mo)</span>
                    <span className="text-sm font-bold text-yellow-400">{metrics.financials?.tier_distribution?.Enterprise || 0}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
                    <div className="bg-yellow-500 h-1.5 rounded-full" style={{width: `${((metrics.financials?.tier_distribution?.Enterprise || 0) / (metrics.total_entities || 1)) * 100}%`}}></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Pro ($299/mo)</span>
                    <span className="text-sm font-bold text-blue-400">{metrics.financials?.tier_distribution?.Pro || 0}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${((metrics.financials?.tier_distribution?.Pro || 0) / (metrics.total_entities || 1)) * 100}%`}}></div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Basic ($49/mo)</span>
                    <span className="text-sm font-bold text-gray-400">{metrics.financials?.tier_distribution?.Basic || 0}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div className="bg-gray-500 h-1.5 rounded-full" style={{width: `${((metrics.financials?.tier_distribution?.Basic || 0) / (metrics.total_entities || 1)) * 100}%`}}></div>
                  </div>
                </div>
              </div>

              {/* AI Evaluation Trends */}
              <div className="lg:col-span-1 bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <TrendingUp className="text-blue-400 mr-2" size={20} />
                    <h3 className="text-lg font-bold text-white">AI Evaluation Trends</h3>
                  </div>
                  <span className="text-xs text-gray-500">Last 7 Days</span>
                </div>
                
                <div className="h-48 flex items-end justify-between space-x-2">
                  {metrics.ai_trends?.map((trend: any, idx: number) => {
                    const total = trend.accepted + trend.rejected;
                    const acceptedHeight = total > 0 ? (trend.accepted / 250) * 100 : 0; // scaled for 250 max
                    const rejectedHeight = total > 0 ? (trend.rejected / 250) * 100 : 0;
                    
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1 group">
                        <div className="relative w-full flex flex-col justify-end items-center h-40 mb-2">
                          {/* Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 transition-opacity">
                            {trend.accepted} Accepted<br/>{trend.rejected} Rejected
                          </div>
                          
                          {/* Bars */}
                          <div className="w-full max-w-[20px] bg-red-500/80 rounded-t-sm transition-all duration-500" style={{ height: `${rejectedHeight}%` }}></div>
                          <div className="w-full max-w-[20px] bg-green-500/80 rounded-t-sm -mt-1 transition-all duration-500" style={{ height: `${acceptedHeight}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-500">{trend.day}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex items-center justify-center space-x-6 mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center text-xs text-gray-400">
                    <div className="w-3 h-3 bg-green-500/80 rounded-sm mr-2"></div> Accepted
                  </div>
                  <div className="flex items-center text-xs text-gray-400">
                    <div className="w-3 h-3 bg-red-500/80 rounded-sm mr-2"></div> Rejected
                  </div>
                </div>
              </div>

              {/* System Alerts */}
              <div className="lg:col-span-1 bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-xl">
                <div className="flex items-center mb-6">
                  <AlertTriangle className="text-red-400 mr-2" size={20} />
                  <h3 className="text-lg font-bold text-white">System Alerts</h3>
                </div>
                
                <div className="space-y-4">
                  {metrics.system_alerts?.map((alert: any) => (
                    <div key={alert.id} className={`p-3 rounded-lg border flex items-start ${
                      alert.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
                      alert.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                      'bg-blue-500/10 border-blue-500/30'
                    }`}>
                      <div className="mt-0.5 mr-3">
                        {alert.type === 'error' ? <AlertCircle className="text-red-400" size={16} /> :
                         alert.type === 'warning' ? <AlertTriangle className="text-yellow-400" size={16} /> :
                         <Info className="text-blue-400" size={16} />}
                      </div>
                      <div>
                        <p className={`text-sm ${
                          alert.type === 'error' ? 'text-red-200' :
                          alert.type === 'warning' ? 'text-yellow-200' :
                          'text-blue-200'
                        }`}>{alert.message}</p>
                        <span className={`text-[10px] mt-1 block ${
                          alert.type === 'error' ? 'text-red-400' :
                          alert.type === 'warning' ? 'text-yellow-500' :
                          'text-blue-400'
                        }`}>{alert.time}</span>
                      </div>
                    </div>
                  ))}
                  
                  {(!metrics.system_alerts || metrics.system_alerts.length === 0) && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No active alerts. System is stable.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quality Frameworks Section */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
              <div className="flex items-center">
                <BookOpen className="text-indigo-400 mr-3" size={24} />
                <h2 className="text-xl font-bold text-white">Quality Frameworks Engine</h2>
              </div>
              <button 
                onClick={handleCreate}
                className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
              >
                <Plus size={16} className="mr-2" /> New Framework
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {frameworks.map((fw) => (
                  <div key={fw._id} className="bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-indigo-500/50 transition-all">
                    {editingId === fw._id ? (
                      <div className="space-y-4">
                        <input 
                          type="text" 
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                          placeholder="Framework Name"
                        />
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                          placeholder="Description"
                          rows={2}
                        />
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">AI Prompt Template</label>
                          <textarea
                            value={editForm.ai_prompt_template}
                            onChange={(e) => setEditForm({...editForm, ai_prompt_template: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm font-mono"
                            placeholder="You are an AI evaluator..."
                            rows={4}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                             <label className="text-sm text-gray-400">Threshold (%)</label>
                             <input 
                               type="number" 
                               value={editForm.acceptance_threshold}
                               onChange={(e) => setEditForm({...editForm, acceptance_threshold: parseInt(e.target.value)})}
                               className="w-20 bg-gray-800 border border-gray-600 rounded p-1 text-white text-center"
                             />
                          </div>
                          <button 
                            onClick={handleUpdate}
                            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm transition-colors"
                          >
                            <Save size={16} className="mr-2" /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-3">
                           <h3 className="text-lg font-bold text-white">{fw.name}</h3>
                           <button onClick={() => { setEditingId(fw._id); setEditForm(fw); }} className="text-gray-400 hover:text-indigo-400">
                             <Edit3 size={18} />
                           </button>
                        </div>
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{fw.description}</p>
                        
                        <div className="bg-gray-800 rounded p-3 mb-4">
                           <p className="text-xs text-gray-500 mb-1 uppercase font-semibold tracking-wider">AI Prompt (Preview)</p>
                           <p className="text-sm text-gray-300 font-mono truncate">{fw.ai_prompt_template}</p>
                        </div>
                        
                        <div className="flex items-center justify-between border-t border-gray-800 pt-3">
                           <span className="text-xs text-gray-500">Status: <span className={fw.is_active ? 'text-green-400' : 'text-red-400'}>{fw.is_active ? 'Active' : 'Inactive'}</span></span>
                           <span className="text-xs text-gray-500">Acceptance: <span className="text-white font-medium">{fw.acceptance_threshold}%</span></span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                
                {frameworks.length === 0 && (
                   <div className="col-span-2 text-center py-12 bg-gray-900 rounded-xl border border-dashed border-gray-700">
                     <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
                     <h3 className="text-lg font-medium text-gray-300 mb-2">No Frameworks Found</h3>
                     <p className="text-gray-500 max-w-sm mx-auto">Get started by creating your first global quality framework to evaluate tasks across workspaces.</p>
                   </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Tenant / Entity Management Section */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl mt-10">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
              <div className="flex items-center">
                <Building2 className="text-purple-400 mr-3" size={24} />
                <h2 className="text-xl font-bold text-white">Tenant & Workspace Provisioning</h2>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add New Tenant */}
              <div className="lg:col-span-1 bg-gray-900 border border-gray-700 rounded-xl p-5 shadow-inner h-fit">
                <h3 className="text-lg font-bold text-white mb-4">Onboard New Tenant</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1 font-semibold">Entity Name</label>
                    <input 
                      type="text" 
                      value={newEntityForm.name}
                      onChange={(e) => setNewEntityForm({...newEntityForm, name: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1 font-semibold">Description</label>
                    <textarea
                      value={newEntityForm.description}
                      onChange={(e) => setNewEntityForm({...newEntityForm, description: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500"
                      placeholder="Brief description..."
                      rows={2}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400 block mb-1 font-semibold">Subscription Tier</label>
                    <select
                      value={newEntityForm.subscription_tier}
                      onChange={(e) => setNewEntityForm({...newEntityForm, subscription_tier: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="Basic">Basic (5 Teams, 1000 AI Tokens)</option>
                      <option value="Pro">Pro (15 Teams, 10000 AI Tokens)</option>
                      <option value="Enterprise">Enterprise (50 Teams, 50000 AI Tokens)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400 block mb-2 font-semibold">Assign Quality Frameworks</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {frameworks.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No frameworks available to assign.</p>
                      ) : (
                        frameworks.map(fw => (
                          <label key={fw._id} className="flex items-center space-x-3 p-2 bg-gray-800 rounded border border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors">
                            <input 
                              type="checkbox"
                              checked={newEntityForm.frameworks.includes(fw._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewEntityForm({...newEntityForm, frameworks: [...newEntityForm.frameworks, fw._id]});
                                } else {
                                  setNewEntityForm({...newEntityForm, frameworks: newEntityForm.frameworks.filter(id => id !== fw._id)});
                                }
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-900 border-gray-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm font-medium text-gray-300 truncate" title={fw.name}>{fw.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleCreateEntity}
                    disabled={!newEntityForm.name}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:text-gray-400 text-white rounded-lg transition-colors font-medium text-sm mt-4"
                  >
                    <Plus size={18} className="mr-2" /> Create Tenant
                  </button>
                </div>
              </div>
              
              {/* Existing Tenants */}
              <div className="lg:col-span-2">
                <h3 className="text-lg font-bold text-white mb-4">Active Tenants</h3>
                {entities.length === 0 ? (
                   <div className="text-center py-12 bg-gray-900 rounded-xl border border-dashed border-gray-700 h-full flex flex-col justify-center items-center">
                     <Building2 size={40} className="text-gray-600 mb-3" />
                     <h3 className="text-md font-medium text-gray-300 mb-1">No Tenants Yet</h3>
                     <p className="text-sm text-gray-500">Onboard your first client or organization.</p>
                   </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {entities.map(ent => (
                      <div key={ent._id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 hover:border-purple-500/50 transition-all flex flex-col">
                         <div className="flex justify-between items-start mb-2">
                            <h4 className="text-md font-bold text-white truncate pr-2">{ent.name}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ent.subscription_tier === 'Enterprise' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : ent.subscription_tier === 'Pro' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-700 text-gray-300'}`}>
                              {ent.subscription_tier || 'Basic'}
                            </span>
                         </div>
                         <p className="text-xs text-gray-400 mb-2 line-clamp-2 min-h-[32px]">{ent.description || 'No description provided.'}</p>
                         
                         <div className="flex justify-between items-center bg-gray-950 rounded p-2 mb-3 border border-gray-800">
                            <div className="text-center">
                              <p className="text-[10px] text-gray-500 uppercase">Teams</p>
                              <p className="text-xs font-bold text-gray-200">{ent.team_ids?.length || 0} / {ent.max_teams || 5}</p>
                            </div>
                            <div className="w-px h-6 bg-gray-800"></div>
                            <div className="text-center">
                              <p className="text-[10px] text-gray-500 uppercase">AI Quota</p>
                              <p className="text-xs font-bold text-gray-200">{ent.ai_tokens_used || 0} / {ent.ai_quota || 1000}</p>
                            </div>
                         </div>
                         
                         <div className="mt-auto pt-3 border-t border-gray-800">
                           <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Active Frameworks</p>
                           {ent.quality_framework_ids && ent.quality_framework_ids.length > 0 ? (
                             <div className="flex flex-wrap gap-1.5">
                               {ent.quality_framework_ids.map((fwId: string) => {
                                 const fw = frameworks.find(f => f._id === fwId);
                                 return fw ? (
                                   <span key={fwId} className="flex items-center text-xs bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded border border-indigo-800/50">
                                      <CheckCircle2 size={12} className="mr-1 text-indigo-400" />
                                      {fw.name}
                                   </span>
                                 ) : null;
                               })}
                             </div>
                           ) : (
                             <span className="text-xs text-gray-500 italic">None assigned</span>
                           )}
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Global Audit Logs */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl mt-10 mb-10">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
              <div className="flex items-center">
                <History className="text-blue-400 mr-3" size={24} />
                <h2 className="text-xl font-bold text-white">Global Security & Audit Logs</h2>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-700 text-xs uppercase tracking-wider text-gray-500">
                    <th className="p-4 font-semibold">Timestamp</th>
                    <th className="p-4 font-semibold">Action</th>
                    <th className="p-4 font-semibold">Entity / Tenant</th>
                    <th className="p-4 font-semibold">User</th>
                    <th className="p-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="p-4 text-xs text-gray-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-200">
                        {log.action}
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {log.entity_name}
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {log.user}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${log.status === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 text-sm">
                        No audit logs available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
        </main>
      </div>
    </div>
  );
}
