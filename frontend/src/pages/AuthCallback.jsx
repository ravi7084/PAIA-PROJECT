/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Auth Callback Page                  ║
 * ║   Handles Google OAuth redirect              ║
 * ╚══════════════════════════════════════════════╝
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield }    from 'lucide-react';
import toast         from 'react-hot-toast';
import api           from '../api/axios.config';
import useAuth       from '../hooks/useAuth';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const { login }      = useAuth();
  const navigate       = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken  = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');

      if (!accessToken || !refreshToken) {
        toast.error('Google sign-in failed. Please try again.');
        navigate('/login');
        return;
      }

      try {
        // Store tokens first so the request is authenticated
        localStorage.setItem('accessToken',  accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        const res = await api.get('/auth/me');
        const user = res.data.data.user;

        login(user, accessToken, refreshToken);
        toast.success(`Welcome, ${user.name.split(' ')[0]}!`);
        navigate('/dashboard', { replace: true });
      } catch {
        localStorage.clear();
        toast.error('Failed to complete sign-in. Please try again.');
        navigate('/login');
      }
    };

    handleCallback();
  }, []);

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
        Completing sign-in...
      </p>
    </div>
  );
};

export default AuthCallback;