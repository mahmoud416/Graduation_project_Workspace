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
import StaffProjectsPage from './pages/StaffProjectsPage';
import ChatbotWidget from './components/ChatbotWidget';

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

  const redirectSubAdminDashboard = (page: ReactElement) => {
    if (role === 'sub_admin') {
      return <Navigate to="/subadmin" replace />;
    }
    return page;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={redirectSubAdminDashboard(<Dashboard />)} />
        <Route path="/projects" element={restrictForStaff(<Projects />)} />
        <Route path="/tasks" element={restrictForStaff(<TasksPage />)} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/team" element={restrictForStaff(<TeamPage />)} />
        <Route path="/reports" element={restrictForStaff(<ReportsPage />)} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/taskmaster" element={restrictForSubAdminOnly(<TaskMasterDashboard />)} />
        <Route path="/subadmin" element={<SubAdminPortal />} />
        <Route path="/taskflow" element={<TaskFlowDetail />} />
        <Route path="/create-task" element={<CreateTask />} />
        <Route path="/task-master" element={<TaskMasterDashboard />} />
        <Route path="/configuration" element={<ConfigurationPage />} />
        <Route path="/my-projects" element={<StaffProjectsPage />} />
      </Routes>
      {role && <ChatbotWidget />}
    </BrowserRouter>
  );
}

export default App;
