/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Reset Password Page                 ║
 * ╚══════════════════════════════════════════════╝
 */

import { useState }              from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm }               from 'react-hook-form';
import { Shield, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast   from 'react-hot-toast';
import api     from '../api/axios.config';
import useAuth from '../hooks/useAuth';
import { getPasswordStrength, strengthColor } from '../utils/helpers';

const ResetPassword = () => {
  const [showPw,   setShowPw]   = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [pwScore,  setPwScore]  = useState(0);
  const { login }               = useAuth();
  const navigate                = useNavigate();
  const [searchParams]          = useSearchParams();
  const token                   = searchParams.get('token');

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const watchPw = watch('newPassword', '');

  const onSubmit = async (data) => {
    if (!token) {
      toast.error('Reset token is missing. Please use the link from your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.patch('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      });
      const { user, accessToken, refreshToken } = res.data.data;
      login(user, accessToken, refreshToken);
      toast.success('Password reset! You are now signed in.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed. Please request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="orb orb-1" /><div className="orb orb-2" />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }} className="fade-up">
        <div className="auth-card">

          {/* Logo */}
          <div className="logo-mark">
            <div className="logo-hex"><Shield size={20} color="#fff" strokeWidth={2.2} /></div>
            <div><div className="logo-text">PAIA</div><div className="logo-sub">Pentest AI Agent</div></div>
          </div>

          <div className="auth-title">Set new password</div>
          <div className="auth-desc">Choose a strong password for your account</div>

          {/* Invalid link state */}
          {!token ? (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              fontSize: 12, color: '#fca5a5', lineHeight: 1.6,
            }}>
              Invalid reset link. Please request a new one from the forgot password page.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* New Password */}
              <div className="fgroup">
                <label className="flabel">New password</label>
                <div className={`field-box${errors.newPassword ? ' field-error' : ''}`}>
                  <div className="field-icon"><Lock size={15} /></div>
                  <input
                    className="field-input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 8 chars, upper+lower+number"
                    {...register('newPassword', {
                      required:  'Password is required',
                      minLength: { value: 8, message: 'At least 8 characters' },
                      pattern:   { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: 'Need uppercase, lowercase and number' },
                      onChange:  (e) => setPwScore(getPasswordStrength(e.target.value)),
                    })}
                  />
                  <button type="button" className="field-toggle" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* Strength bars */}
                <div className="pw-bars">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="pw-bar"
                      style={{ background: i < pwScore ? strengthColor(pwScore) : 'rgba(255,255,255,0.06)' }}
                    />
                  ))}
                </div>
                {errors.newPassword && (
                  <div className="ferr-msg show">{errors.newPassword.message}</div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="fgroup">
                <label className="flabel">Confirm new password</label>
                <div className={`field-box${errors.confirmPassword ? ' field-error' : ''}`}>
                  <div className="field-icon"><Lock size={15} /></div>
                  <input
                    className="field-input"
                    type={showConf ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (val) => val === watchPw || 'Passwords do not match',
                    })}
                  />
                  <button type="button" className="field-toggle" onClick={() => setShowConf(!showConf)}>
                    {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <div className="ferr-msg show">{errors.confirmPassword.message}</div>
                )}
              </div>

              <button type="submit" disabled={loading} className="btn-auth btn-primary">
                {loading ? <><div className="spinner" /> Resetting...</> : 'Reset & sign in'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <Link to="/login" className="goto-link">
              <ArrowLeft size={12} /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;