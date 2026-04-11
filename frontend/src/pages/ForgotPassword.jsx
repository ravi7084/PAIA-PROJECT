/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Forgot Password Page                ║
 * ╚══════════════════════════════════════════════╝
 */

import { useState }     from 'react';
import { Link }         from 'react-router-dom';
import { useForm }      from 'react-hook-form';
import { Shield, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api   from '../api/axios.config';

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [sentTo,  setSentTo]  = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSentTo(data.email);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="orb orb-1" /><div className="orb orb-2" />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }} className="fade-up">

        {!sent ? (
          <div className="auth-card">
            <div className="logo-mark">
              <div className="logo-hex"><Shield size={20} color="#fff" strokeWidth={2.2} /></div>
              <div><div className="logo-text">PAIA</div><div className="logo-sub">Pentest AI Agent</div></div>
            </div>

            <div className="auth-title">Reset password</div>
            <div className="auth-desc">Enter your email and we'll send a secure reset link</div>

            <form onSubmit={handleSubmit(onSubmit)}>
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
                {errors.email && <div className="ferr-msg show">{errors.email.message}</div>}
              </div>

              <button type="submit" disabled={loading} className="btn-auth btn-primary">
                {loading ? <><div className="spinner" /> Sending...</> : 'Send reset link'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <Link to="/login" className="goto-link">
                <ArrowLeft size={12} /> Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          /* Success state */
          <div className="auth-card">
            <div className="success-screen">
              <div className="success-ring">
                <CheckCircle size={26} color="var(--green)" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                Check your inbox
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
                A reset link was sent to <strong style={{ color: 'var(--text2)' }}>{sentTo}</strong>.
                Check your spam folder too. The link expires in 10 minutes.
              </div>
              <div style={{ marginTop: 16 }}>
                <Link to="/login" className="goto-link" style={{ display: 'inline-flex' }}>
                  <ArrowLeft size={12} /> Back to sign in
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;