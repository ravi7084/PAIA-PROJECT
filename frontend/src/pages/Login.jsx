/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Login Page                          ║
 * ╚══════════════════════════════════════════════╝
 */

import { useState, useEffect }         from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm }                      from 'react-hook-form';
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast    from 'react-hot-toast';
import api      from '../api/axios.config';
import useAuth  from '../hooks/useAuth';

const Login = () => {
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();
  const navigate              = useNavigate();
  const location              = useLocation();
  const [searchParams]        = useSearchParams();
  const from                  = location.state?.from?.pathname || '/dashboard';

  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    if (searchParams.get('verified') === 'true')
      toast.success('Email verified! You can now sign in.');
    if (searchParams.get('error') === 'oauth_failed')
      toast.error('Google sign-in failed. Please try again.');
    if (searchParams.get('error') === 'oauth_unavailable')
      toast.error('Google sign-in is not configured yet. Add real Google OAuth credentials first.');
  }, []);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      const { user, accessToken, refreshToken } = res.data.data;
      login(user, accessToken, refreshToken);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }} className="fade-up">
        <div className="auth-card">

          {/* Logo */}
          <div className="logo-mark">
            <div className="logo-hex"><Shield size={20} color="#fff" strokeWidth={2.2} /></div>
            <div><div className="logo-text">PAIA</div><div className="logo-sub">Pentest AI Agent</div></div>
          </div>

          <div className="auth-title">Welcome back</div>
          <div className="auth-desc">Sign in to your security testing workspace</div>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Email */}
            <div className="fgroup">
              <label className="flabel">Email address</label>
              <div className={`field-box${errors.email ? ' field-error' : ''}`}>
                <div className="field-icon"><Mail size={15} /></div>
                <input
                  className="field-input"
                  type="email"
                  placeholder="ravi@bbdu.ac.in"
                  {...register('email', {
                    required: 'Email is required',
                    pattern:  { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                  })}
                />
              </div>
              {errors.email && (
                <div className="ferr-msg show">{errors.email.message}</div>
              )}
            </div>

            {/* Password */}
            <div className="fgroup">
              <label className="flabel">Password</label>
              <div className={`field-box${errors.password ? ' field-error' : ''}`}>
                <div className="field-icon"><Lock size={15} /></div>
                <input
                  className="field-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  className="field-toggle"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <div className="ferr-msg show">{errors.password.message}</div>
              )}
              <div className="forgot-row">
                <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn-auth btn-primary" style={{ marginTop: 4 }}>
              {loading ? <><div className="spinner" /> Signing in...</> : 'Sign in to workspace'}
            </button>
          </form>

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-txt">or continue with</span>
            <div className="auth-divider-line" />
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => { window.location.href = `${process.env.REACT_APP_API_URL}/auth/google`; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="auth-switch">
            New to PAIA? <Link to="/signup">Create free account</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
