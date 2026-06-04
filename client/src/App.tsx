import { useEffect, useState, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SetupPage from './pages/SetupPage';
import FounderAccountsPage from './pages/FounderAccountsPage';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import TasksPage from './pages/TasksPage';
import CalendarPage from './pages/CalendarPage';
import TeamPage from './pages/TeamPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import TaskMasterDashboard from './pages/TaskMasterDashboard';
import SubAdminPortal from './pages/SubAdminPortal';
import TaskFlowDetail from './pages/TaskFlowDetail';
import ProjectWorkspace from './pages/ProjectWorkspace';
import CreateTask from './pages/CreateTask';
import ConfigurationPage from './pages/ConfigurationPage';
import SessionLogsPage from './pages/SessionLogsPage';
import ITPortal from './pages/ITPortal';
import StaffProjectsPage from './pages/StaffProjectsPage';
import StaffTaskDetail from './pages/StaffTaskDetail';
import QCDashboard from './pages/QCDashboard';
import QualityInsights from './pages/QualityInsights';
import ChatbotWidget from './components/ChatbotWidget';
import TeamsPage from './pages/TeamsPage';
import TeamDetailsPage from './pages/TeamDetailsPage';
import ActiveProjectsPage from './pages/ActiveProjectsPage';
import ProgressProjectsPage from './pages/ProgressProjectsPage';
import PublicProjectsPage from './pages/PublicProjectsPage';
import PortfolioPage from './pages/PortfolioPage';
import FounderDashboard from './pages/FounderDashboard';
import CredentialsPage from './pages/CredentialsPage';
import HelpPage from './pages/HelpPage';

const USER_UPDATE_EVENT = 'workspace:user-update';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1';

function App() {
  const [role, setRole] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('role');
    }
    return null;
  });

  const [initChecked,  setInitChecked]  = useState(false);
  const [systemInited, setSystemInited] = useState(true);
  const [backendDown,  setBackendDown]  = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(10);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000); // 8 s timeout
    fetch(`${API_BASE}/system/init-status`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : { initialized: true })
      .then(data => { setSystemInited(data.initialized); setBackendDown(false); })
      .catch(err => {
        if (err.name === 'AbortError') {
          setBackendDown(true);
          setSystemInited(true); // show login rather than setup on timeout
        } else {
          setSystemInited(true); // network error — assume initialized, let login handle it
        }
      })
      .finally(() => { clearTimeout(timer); setInitChecked(true); });
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  useEffect(() => {
    if (!backendDown) { setRetryCountdown(10); return; }
    setRetryCountdown(10);
    let cd = 10;
    const tick = setInterval(() => {
      cd--;
      setRetryCountdown(cd);
      if (cd <= 0) { clearInterval(tick); window.location.reload(); }
    }, 1000);
    return () => clearInterval(tick);
  }, [backendDown]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncRole = () => setRole(localStorage.getItem('role'));
    const handleUserUpdate = () => syncRole();
    window.addEventListener('storage', syncRole);
    window.addEventListener(USER_UPDATE_EVENT, handleUserUpdate);
    return () => {
      window.removeEventListener('storage', syncRole);
      window.removeEventListener(USER_UPDATE_EVENT, handleUserUpdate);
    };
  }, []);

  const restrictForStaff = (page: ReactElement) => {
    if (role === 'staff') {
      return <Navigate to="/dashboard" replace />;
    }
    return page;
  };

  const restrictForSubAdminOnly = (page: ReactElement) => {
    if (role !== 'sub_admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return page;
  };

  const restrictToQualityControl = (page: ReactElement) => {
    if (!role) {
      return <Navigate to="/login" replace />;
    }
    if (
      role === 'quality_control' ||
      role === 'quality_manager' ||
      role === 'admin' ||
      role === 'manager' ||
      role === 'sub_admin'
    ) {
      return page;
    }
    return <Navigate to="/dashboard" replace />;
  };

  const redirectSubAdminDashboard = (page: ReactElement) => {
    if (role === 'sub_admin') {
      return <Navigate to="/subadmin" replace />;
    }
    return page;
  };

  const redirectQualityDashboard = (page: ReactElement) => {
    if (role === 'quality_control' || role === 'quality_manager') {
      return <Navigate to="/quality-control" replace />;
    }
    return page;
  };

  const redirectItStaff = (page: ReactElement) => {
    if (role === 'it_staff') {
      return <Navigate to="/it-portal" replace />;
    }
    return page;
  };

  const restrictToFounder = (page: ReactElement) => {
    if (role !== 'founder') {
      return <Navigate to="/dashboard" replace />;
    }
    return page;
  };

  if (!initChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa', gap: 12, fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid rgba(29,110,245,.2)', borderTopColor: '#1d6ef5', borderRadius: '50%', animation: 'appSpin 1s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#94a3b8' }}>Starting up…</span>
      </div>
    );
  }

  if (backendDown) {
    const circ = 2 * Math.PI * 22;
    return (
      <>
        <style>{`
          @keyframes _ring-expand {
            0%   { transform: scale(1); opacity: 0.5; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          @keyframes _icon-float {
            0%, 100% { transform: translateY(0); }
            50%       { transform: translateY(-8px); }
          }
          @keyframes _dot-bounce {
            0%, 80%, 100% { transform: translateY(0);   opacity: 0.25; }
            40%            { transform: translateY(-8px); opacity: 1; }
          }
          @keyframes _slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg,#eef2ff 0%,#f0f4ff 50%,#ede9fe 100%)', fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,sans-serif', padding: 24 }}>

          {/* pulsing icon */}
          <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 36, animation: '_slide-up .6s ease both' }}>
            <div style={{ position: 'absolute', inset: -18, borderRadius: '50%', border: '2px solid rgba(99,102,241,.35)', animation: '_ring-expand 2s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: -8,  borderRadius: '50%', border: '2px solid rgba(99,102,241,.2)',  animation: '_ring-expand 2s ease-out .6s infinite' }} />
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'white', boxShadow: '0 8px 30px rgba(99,102,241,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: '_icon-float 3.5s ease-in-out infinite' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M1.5 8.5a15 15 0 0121 0"        stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M5 12a10.5 10.5 0 0114 0"        stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" opacity=".7"/>
                <path d="M8.5 15.5a6 6 0 017 0"           stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" opacity=".45"/>
                <circle cx="12" cy="19" r="1.5" fill="#6366f1"/>
              </svg>
            </div>
          </div>

          {/* title + subtitle */}
          <div style={{ textAlign: 'center', animation: '_slide-up .6s .1s ease both', marginBottom: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>Connecting to server…</div>
            <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, maxWidth: 300 }}>
              The API server isn't responding.<br/>Make sure it's running and retry.
            </div>
          </div>

          {/* bouncing dots */}
          <div style={{ display: 'flex', gap: 7, margin: '24px 0 20px', animation: '_slide-up .6s .2s ease both' }}>
            {[0, .22, .44].map((d, i) => (
              <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: '#6366f1', animation: `_dot-bounce 1.4s ${d}s ease-in-out infinite` }} />
            ))}
          </div>

          {/* countdown ring */}
          <div style={{ position: 'relative', width: 56, height: 56, marginBottom: 24, animation: '_slide-up .6s .3s ease both' }}>
            <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="3.5"/>
              <circle cx="28" cy="28" r="22" fill="none" stroke="#6366f1" strokeWidth="3.5"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - retryCountdown / 10)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset .9s linear' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#4f46e5' }}>
              {retryCountdown}
            </div>
          </div>

          {/* retry button */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ animation: '_slide-up .6s .4s ease both', padding: '10px 30px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(99,102,241,.4)', transition: 'transform .15s, box-shadow .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(99,102,241,.55)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = '';             (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(99,102,241,.4)'; }}
          >
            Retry now
          </button>

        </div>
      </>
    );
  }

  if (!systemInited) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/setup" element={<Navigate to="/login" replace />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={redirectItStaff(redirectQualityDashboard(redirectSubAdminDashboard(<Dashboard />)))}
        />
        <Route path="/projects" element={restrictForStaff(<Projects />)} />
        <Route path="/projects/active" element={restrictForStaff(<ActiveProjectsPage />)} />
        <Route path="/projects/progress" element={restrictForStaff(<ProgressProjectsPage />)} />
        <Route path="/projects/public" element={restrictForStaff(<PublicProjectsPage />)} />
        <Route path="/tasks" element={restrictForStaff(<TasksPage />)} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/teams" element={restrictForStaff(<TeamsPage />)} />
        <Route path="/teams/:id" element={restrictForStaff(<TeamDetailsPage />)} />
        <Route path="/portfolio/:userId" element={restrictForStaff(<PortfolioPage />)} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/taskmaster" element={restrictForSubAdminOnly(<TaskMasterDashboard />)} />
        <Route path="/subadmin" element={<SubAdminPortal />} />
        <Route path="/taskflow"  element={<TaskFlowDetail />} />
        <Route path="/workspace" element={<ProjectWorkspace />} />
        <Route path="/create-task" element={<CreateTask />} />
        <Route path="/task-master" element={<TaskMasterDashboard />} />
        <Route path="/configuration" element={<ConfigurationPage />} />
        <Route path="/session-logs" element={<SessionLogsPage />} />
        <Route path="/it-portal" element={<ITPortal />} />
        <Route path="/my-projects" element={<StaffProjectsPage />} />
        <Route path="/staff-task" element={<StaffTaskDetail />} />
        <Route path="/quality-manager" element={restrictToQualityControl(<QCDashboard />)} />
        <Route path="/quality-control" element={restrictToQualityControl(<QCDashboard />)} />
        <Route path="/qc/dashboard" element={restrictToQualityControl(<QCDashboard />)} />
        <Route path="/quality-insights" element={restrictToQualityControl(<QualityInsights />)} />
        <Route path="/founder" element={restrictToFounder(<FounderDashboard />)} />
        <Route path="/founder/accounts" element={restrictToFounder(<FounderAccountsPage />)} />
        <Route path="/founder/credentials" element={restrictToFounder(<CredentialsPage />)} />
        <Route path="/help" element={<HelpPage />} />
      </Routes>
      {role && <ChatbotWidget />}
    </BrowserRouter>
  );
}

export default App;
