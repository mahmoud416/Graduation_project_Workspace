import { useEffect, useState } from 'react';
import { useTheme } from '../contexts/useTheme';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1';

interface Credential {
  name: string;
  email: string;
  role: string;
  password: string;
  createdAt: string;
}

function parseCredentials(raw: string): Credential[] {
  const entries = raw.split('---\n').filter(e => e.trim() && !e.startsWith('#'));
  return entries.map(entry => {
    const get = (key: string) => {
      const match = entry.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return match ? match[1].trim() : '';
    };
    return {
      name:      get('Name'),
      email:     get('Email'),
      role:      get('Role'),
      password:  get('Password'),
      createdAt: get('Created At'),
    };
  }).filter(c => c.email);
}

const roleColor: Record<string, string> = {
  founder:   '#7c3aed',
  sub_admin: '#1d6ef5',
  staff:     '#059669',
  it_staff:  '#d97706',
};

const roleLabel: Record<string, string> = {
  founder:   'Founder',
  sub_admin: 'Admin',
  staff:     'Staff',
  it_staff:  'IT Staff',
};

export default function CredentialsPage() {
  const { isDark } = useTheme();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(`${API_BASE}/founder/credentials`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.text();
      })
      .then(text => {
        setRaw(text);
        setCredentials(parseCredentials(text));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = () => {
    const blob = new Blob([raw], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'orbit_credentials.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const filtered = credentials.filter(c => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || c.role === roleFilter;
    return matchSearch && matchRole;
  });

  const bg    = isDark ? '#0f172a' : '#f8fafc';
  const card  = isDark ? '#1e293b' : '#ffffff';
  const border = isDark ? '#334155' : '#e2e8f0';
  const text  = isDark ? '#f1f5f9' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '32px 24px', fontFamily: '"Inter",-apple-system,sans-serif' }}>

      {/* Header */}
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: text }}>Credentials Registry</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: muted }}>
              All platform accounts — generated passwords. Founder-only access.
            </p>
          </div>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg,#1d6ef5,#4f46e5)',
              color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(29,110,245,.35)',
            }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download .txt
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, margin: '20px 0', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{
              flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${border}`, background: card, color: text,
              fontSize: 13, outline: 'none',
            }}
          />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`,
              background: card, color: text, fontSize: 13, cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">All Roles</option>
            <option value="founder">Founder</option>
            <option value="sub_admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="it_staff">IT Staff</option>
          </select>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {Object.entries(roleLabel).map(([role, label]) => {
            const count = credentials.filter(c => c.role === role).length;
            if (!count) return null;
            return (
              <span key={role} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: roleColor[role] + '20', color: roleColor[role],
                border: `1px solid ${roleColor[role]}40`,
              }}>
                {label}: {count}
              </span>
            );
          })}
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: isDark ? '#334155' : '#f1f5f9', color: muted }}>
            Total: {credentials.length}
          </span>
        </div>

        {/* State: loading / error */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: muted }}>Loading credentials…</div>
        )}
        {error && (
          <div style={{ padding: 16, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Credential cards */}
        {!loading && !error && (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: muted, fontSize: 14 }}>No accounts match your filter.</div>
            )}
            {filtered.map((cred, idx) => {
              const color = roleColor[cred.role] || '#64748b';
              return (
                <div key={idx} style={{
                  background: card, border: `1px solid ${border}`, borderRadius: 12,
                  padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: '12px 20px', alignItems: 'center',
                  boxShadow: isDark ? '0 1px 4px rgba(0,0,0,.3)' : '0 1px 4px rgba(0,0,0,.06)',
                }}>
                  {/* Name + role */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: text }}>{cred.name}</div>
                    <span style={{
                      display: 'inline-block', marginTop: 4, padding: '2px 8px',
                      borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: color + '20', color,
                    }}>
                      {roleLabel[cred.role] || cred.role}
                    </span>
                  </div>

                  {/* Email */}
                  <div>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 2 }}>Email</div>
                    <div style={{ fontSize: 13, color: text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ wordBreak: 'break-all' }}>{cred.email}</span>
                      <button onClick={() => handleCopy(cred.email, `email-${idx}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copied === `email-${idx}` ? '#059669' : muted }}>
                        {copied === `email-${idx}`
                          ? <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          : <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 2 }}>Password</div>
                    <div style={{ fontSize: 13, color: text, display: 'flex', alignItems: 'center', gap: 6, fontFamily: '"Courier New",monospace' }}>
                      <span>{cred.password}</span>
                      <button onClick={() => handleCopy(cred.password, `pw-${idx}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copied === `pw-${idx}` ? '#059669' : muted, fontFamily: 'inherit' }}>
                        {copied === `pw-${idx}`
                          ? <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          : <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Created At */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: muted }}>{cred.createdAt}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
