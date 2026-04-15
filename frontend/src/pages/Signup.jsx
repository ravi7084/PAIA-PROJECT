/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Signup Page                         ║
 * ╚══════════════════════════════════════════════╝
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Shield, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.config';
import useAuth from '../hooks/useAuth';
import { getPasswordStrength, strengthColor } from '../utils/helpers';

const Signup = () => {
  const [showPw, setShowPw] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pwScore, setPwScore] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const watchPw = watch('password', '');

  const onSubmit = async (data) => {
    setLoading(true);

    try {
      const payload = {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        confirmPassword: data.confirmPassword,
      };

      const res = await api.post('/auth/register', payload);

      const { user, accessToken, refreshToken } = res.data.data;
      login(user, accessToken, refreshToken);
      toast.success(`Welcome to PAIA, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      console.error('Signup error:', err.response?.data || err.message);
      toast.error(
        err.response?.data?.errors?.[0]?.message ||
        err.response?.data?.message ||
        'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <div
        style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}
        className="fade-up"
      >
        <div className="auth-card">
          <div className="logo-mark">
            <div className="logo-hex">
              <Shield size={20} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <div className="logo-text">PAIA</div>
              <div className="logo-sub">Pentest AI Agent</div>
            </div>
          </div>

          <div className="auth-title">Create account</div>
          <div className="auth-desc">Join your security testing workspace</div>

          <button
            type="button"
            className="btn-ghost"
            style={{ marginBottom: 14 }}
            onClick={() => {
              window.location.href = `${process.env.REACT_APP_API_URL}/auth/google`;
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-txt">or with email</span>
            <div className="auth-divider-line" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="fgroup">
              <label className="flabel">Full name</label>
              <div className={`field-box${errors.name ? ' field-error' : ''}`}>
                <div className="field-icon">
                  <User size={15} />
                </div>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Full name"
                  {...register('name', {
                    required: 'Name is required',
                    minLength: {
                      value: 2,
                      message: 'Name must be at least 2 characters',
                    },
                  })}
                />
              </div>
              {errors.name && <div className="ferr-msg show">{errors.name.message}</div>}
            </div>

            <div className="fgroup">
              <label className="flabel">Email address</label>
              <div className={`field-box${errors.email ? ' field-error' : ''}`}>
                <div className="field-icon">
                  <Mail size={15} />
                </div>
                <input
                  className="field-input"
                  type="email"
                  placeholder="Enter your email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /\S+@\S+\.\S+/,
                      message: 'Enter a valid email',
                    },
                  })}
                />
              </div>
              {errors.email && <div className="ferr-msg show">{errors.email.message}</div>}
            </div>

            <div className="fgroup">
              <label className="flabel">Password</label>
              <div className={`field-box${errors.password ? ' field-error' : ''}`}>
                <div className="field-icon">
                  <Lock size={15} />
                </div>
                <input
                  className="field-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 8 chars, upper+lower+number"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'At least 8 characters',
                    },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Need uppercase, lowercase and number',
                    },
                    onChange: (e) => setPwScore(getPasswordStrength(e.target.value)),
                  })}
                />
                <button
                  type="button"
                  className="field-toggle"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div className="pw-bars">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="pw-bar"
                    style={{
                      background:
                        i < pwScore
                          ? strengthColor(pwScore)
                          : 'rgba(255,255,255,0.06)',
                    }}
                  />
                ))}
              </div>

              {errors.password && <div className="ferr-msg show">{errors.password.message}</div>}
            </div>

            <div className="fgroup">
              <label className="flabel">Confirm password</label>
              <div className={`field-box${errors.confirmPassword ? ' field-error' : ''}`}>
                <div className="field-icon">
                  <Lock size={15} />
                </div>
                <input
                  className="field-input"
                  type={showConf ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (val) => val === watchPw || 'Passwords do not match',
                  })}
                />
                <button
                  type="button"
                  className="field-toggle"
                  onClick={() => setShowConf(!showConf)}
                >
                  {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <div className="ferr-msg show">{errors.confirmPassword.message}</div>
              )}
            </div>

            <div className="check-row">
              <input
                type="checkbox"
                className="check-box"
                id="terms"
                {...register('terms', { required: 'You must accept the terms' })}
              />
              <label htmlFor="terms" className="check-txt">
                I agree to the <span>Terms of Service</span> and confirm I only
                test systems I own or have written authorization to test.
              </label>
            </div>

            {errors.terms && (
              <div className="ferr-msg show" style={{ marginBottom: 8 }}>
                {errors.terms.message}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-auth btn-primary">
              {loading ? (
                <>
                  <div className="spinner" /> Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;