import { useEffect, useState, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
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

const USER_UPDATE_EVENT = 'workspace:user-update';

function App() {
  const [role, setRole] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('role');
    }
    return null;
  });

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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/signup" element={<SignUp />} />
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
        <Route path="/taskflow" element={<TaskFlowDetail />} />
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
      </Routes>
      {role && <ChatbotWidget />}
    </BrowserRouter>
  );
}

export default App;
