import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import PrivateRoute from './components/PrivateRoute';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Targets from './pages/Targets';
import Scans from './pages/Scans';

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0e0e1c',
              color: '#f1f0ff',
              border: '1px solid #1e1e3a',
              borderRadius: 10,
              fontSize: 12
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#0e0e1c' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#0e0e1c' } }
          }}
        />

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/targets"
            element={
              <PrivateRoute>
                <Targets />
              </PrivateRoute>
            }
          />
          <Route
            path="/scans"
            element={
              <PrivateRoute>
                <Scans />
              </PrivateRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
