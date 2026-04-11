/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Private Route Guard                 ║
 * ║   Redirects to /login if not authenticated   ║
 * ╚══════════════════════════════════════════════╝
 */

import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { Shield } from 'lucide-react';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show full-screen spinner while checking auth state
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, background: 'var(--indigo)',
          borderRadius: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 0 24px rgba(79,70,229,0.5)',
        }}>
          <Shield size={22} color="#fff" strokeWidth={2.2} />
        </div>
        <div className="spinner" style={{ width: 20, height: 20 }} />
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          Verifying session...
        </p>
      </div>
    );
  }

  // Not authenticated — redirect to login and remember where user wanted to go
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default PrivateRoute;