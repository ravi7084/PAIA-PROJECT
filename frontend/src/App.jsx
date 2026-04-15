import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import PrivateRoute from './components/PrivateRoute';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Targets from './pages/Targets';
import Scans from './pages/Scans';
import AIAgent from './pages/AIAgent';
import ThreatIntel from './pages/ThreatIntel';
import Reports from './pages/Reports';
import CommandCenter from './pages/CommandCenter';

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(12,12,24,0.95)',
              backdropFilter: 'blur(12px)',
              color: '#f0eeff',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              fontSize: 12,
              boxShadow: '0 15px 40px rgba(0,0,0,0.4)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#0c0c18' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#0c0c18' } },
          }}
        />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/command-center" element={<PrivateRoute><CommandCenter /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/targets" element={<PrivateRoute><Targets /></PrivateRoute>} />
          <Route path="/scans" element={<PrivateRoute><Scans /></PrivateRoute>} />
          <Route path="/ai-agent" element={<PrivateRoute><AIAgent /></PrivateRoute>} />
          <Route path="/threat-intel" element={<PrivateRoute><ThreatIntel /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
