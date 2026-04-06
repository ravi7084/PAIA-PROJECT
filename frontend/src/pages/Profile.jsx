/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Profile / Settings Page            ║
 * ║   Edit profile + change password            ║
 * ╚══════════════════════════════════════════════╝
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { User, Lock, Eye, EyeOff, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.config';
import useAuth from '../hooks/useAuth';
import Layout from '../components/layout';
import SecurityPanel from '../components/SecurityPanel';

const ProfileSkeleton = () => (
  <div className="profile-loading-wrap">
    <div className="dark-card skeleton-card skeleton-card-tall">
      <div className="skeleton-line skeleton-sm" />
      <div className="skeleton-line skeleton-lg" />
      <div className="skeleton-line skeleton-md" />
      <div className="skeleton-line skeleton-md" />
    </div>

    <div className="profile-loading-grid">
      <div className="form-card skeleton-card skeleton-card-tall">
        <div className="skeleton-line skeleton-sm" />
        <div className="skeleton-line skeleton-lg" />
        <div className="skeleton-line skeleton-lg" />
        <div className="skeleton-line skeleton-md" />
      </div>

      <div className="form-card skeleton-card skeleton-card-tall">
        <div className="skeleton-line skeleton-sm" />
        <div className="skeleton-line skeleton-lg" />
        <div className="skeleton-line skeleton-lg" />
        <div className="skeleton-line skeleton-md" />
      </div>
    </div>

    <div className="form-card skeleton-card">
      <div className="skeleton-line skeleton-sm" />
      <div className="skeleton-line skeleton-md" />
      <div className="skeleton-line skeleton-lg" />
    </div>
  </div>
);

const Profile = () => {
  const { user, updateUser, getInitials } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const profileForm = useForm({
    defaultValues: { name: user?.name || '' },
  });

  const passwordForm = useForm();
  const watchNew = passwordForm.watch('newPassword', '');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 450);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user?.name) {
      profileForm.reset({ name: user.name || '' });
    }
  }, [user, profileForm]);

  const onSaveProfile = async (data) => {
    if (data.name.trim() === user?.name) {
      toast('No changes to save.', { icon: 'ℹ️' });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.patch('/user/profile', { name: data.name.trim() });
      updateUser(res.data.data.user);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (data) => {
    setSavingPw(true);
    try {
      await api.patch('/user/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      passwordForm.reset();
      toast.success('Password changed successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const onLogoutAll = async () => {
    toast.success('Logout from all devices feature will be connected next');
  };

  const onResendVerification = async () => {
    toast.success('Verification email resend feature will be connected next');
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Security & Profile</h2>
        <p>Manage your account, identity and authentication preferences</p>
      </div>

      {pageLoading ? (
        <ProfileSkeleton />
      ) : (
        <>
          <SecurityPanel
            user={user}
            getInitials={getInitials}
            onResendVerification={onResendVerification}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: user?.authProvider === 'google' ? '1fr' : '1fr 1fr',
              gap: 14,
              marginTop: 14,
            }}
          >
            <div className="form-card">
              <div className="form-card-title">Profile Information</div>

              <form onSubmit={profileForm.handleSubmit(onSaveProfile)}>
                <div className="fgroup">
                  <label className="flabel">Full name</label>
                  <div className={`field-box${profileForm.formState.errors.name ? ' field-error' : ''}`}>
                    <div className="field-icon">
                      <User size={15} />
                    </div>
                    <input
                      className="field-input"
                      type="text"
                      placeholder="Your full name"
                      {...profileForm.register('name', {
                        required: 'Name is required',
                        minLength: { value: 2, message: 'At least 2 characters' },
                      })}
                    />
                  </div>
                  {profileForm.formState.errors.name && (
                    <div className="ferr-msg show">{profileForm.formState.errors.name.message}</div>
                  )}
                </div>

                <div className="fgroup">
                  <label className="flabel">Email address</label>
                  <div className="field-box" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                    <div className="field-icon" style={{ color: 'var(--text3)' }}>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                        />
                      </svg>
                    </div>
                    <input
                      className="field-input"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      style={{ cursor: 'not-allowed' }}
                    />
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>
                    Email address cannot be changed
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="btn-auth btn-primary"
                    style={{ width: 'auto', padding: '9px 18px', fontSize: 12 }}
                  >
                    {savingProfile ? (
                      <>
                        <div className="spinner" /> Saving...
                      </>
                    ) : (
                      'Save changes'
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="form-card">
              <div className="form-card-title">Change Password</div>

              {user?.authProvider === 'google' ? (
                <div
                  style={{
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontSize: 12,
                    color: '#fcd34d',
                    lineHeight: 1.6,
                  }}
                >
                  Your account uses Google sign-in. Password management is handled by Google.
                </div>
              ) : (
                <form onSubmit={passwordForm.handleSubmit(onChangePassword)}>
                  <div className="fgroup">
                    <label className="flabel">Current password</label>
                    <div className={`field-box${passwordForm.formState.errors.currentPassword ? ' field-error' : ''}`}>
                      <div className="field-icon">
                        <Lock size={15} />
                      </div>
                      <input
                        className="field-input"
                        type={showCur ? 'text' : 'password'}
                        placeholder="Your current password"
                        {...passwordForm.register('currentPassword', {
                          required: 'Current password is required',
                        })}
                      />
                      <button type="button" className="field-toggle" onClick={() => setShowCur(!showCur)}>
                        {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.currentPassword && (
                      <div className="ferr-msg show">{passwordForm.formState.errors.currentPassword.message}</div>
                    )}
                  </div>

                  <div className="fgroup">
                    <label className="flabel">New password</label>
                    <div className={`field-box${passwordForm.formState.errors.newPassword ? ' field-error' : ''}`}>
                      <div className="field-icon">
                        <Lock size={15} />
                      </div>
                      <input
                        className="field-input"
                        type={showNew ? 'text' : 'password'}
                        placeholder="Min 8 chars, upper+lower+number"
                        {...passwordForm.register('newPassword', {
                          required: 'New password is required',
                          minLength: { value: 8, message: 'At least 8 characters' },
                          pattern: {
                            value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                            message: 'Need uppercase, lowercase and number',
                          },
                        })}
                      />
                      <button type="button" className="field-toggle" onClick={() => setShowNew(!showNew)}>
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.newPassword && (
                      <div className="ferr-msg show">{passwordForm.formState.errors.newPassword.message}</div>
                    )}
                  </div>

                  <div className="fgroup">
                    <label className="flabel">Confirm new password</label>
                    <div className={`field-box${passwordForm.formState.errors.confirmPassword ? ' field-error' : ''}`}>
                      <div className="field-icon">
                        <Lock size={15} />
                      </div>
                      <input
                        className="field-input"
                        type={showConf ? 'text' : 'password'}
                        placeholder="Re-enter new password"
                        {...passwordForm.register('confirmPassword', {
                          required: 'Please confirm your new password',
                          validate: (val) => val === watchNew || 'Passwords do not match',
                        })}
                      />
                      <button type="button" className="field-toggle" onClick={() => setShowConf(!showConf)}>
                        {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirmPassword && (
                      <div className="ferr-msg show">{passwordForm.formState.errors.confirmPassword.message}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      type="submit"
                      disabled={savingPw}
                      className="btn-auth btn-primary"
                      style={{ width: 'auto', padding: '9px 18px', fontSize: 12 }}
                    >
                      {savingPw ? (
                        <>
                          <div className="spinner" /> Updating...
                        </>
                      ) : (
                        'Update password'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="form-card" style={{ marginTop: 14 }}>
            <div className="form-card-title">Session Management</div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Logout all devices
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  End all active sessions and force re-login everywhere.
                </div>
              </div>

              <button
                className="btn-auth btn-secondary"
                style={{ width: 'auto', padding: '10px 18px' }}
                onClick={onLogoutAll}
              >
                <LogOut size={14} />
                Logout all devices
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default Profile;