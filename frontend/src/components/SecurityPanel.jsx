import { Shield, Monitor, Clock } from 'lucide-react';
import VerificationBadge from './VerificationBadge';
import RoleBadge from './RoleBadge';
import { formatDate } from '../utils/helpers';

const SecurityPanel = ({ user, getInitials, onResendVerification }) => {
  return (
    <div className="dark-card" style={{ marginBottom: 14 }}>
      <div className="card-title">
        <Shield size={13} />
        Security Center
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(124,58,237,0.06))',
          border: '1px solid rgba(79,70,229,0.12)',
          marginBottom: 14,
        }}
      >
        <div className="profile-avatar" style={{ marginBottom: 0 }}>
          {getInitials(user?.name)}
        </div>

        <div>
          <div className="profile-name">{user?.name}</div>
          <div className="profile-email">{user?.email}</div>

          <div className="profile-badges">
            <RoleBadge role={user?.role} />
            <span className="pill pill-gray">{user?.authProvider}</span>
            <VerificationBadge verified={user?.isEmailVerified} />
          </div>
        </div>

        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div
            style={{
              fontSize: 9,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            Member since
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {formatDate(user?.createdAt)}
          </div>
        </div>
      </div>

      <div className="security-grid">
        <div className="security-item">
          <div className="security-label">Current Session</div>
          <div className="security-value">
            <Monitor size={14} />
            Active on this device
          </div>
        </div>

        <div className="security-item">
          <div className="security-label">Last Login</div>
          <div className="security-value">
            <Clock size={14} />
            {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'First login'}
          </div>
        </div>

        <div className="security-item">
          <div className="security-label">Role</div>
          <div className="security-value">
            <RoleBadge role={user?.role} />
          </div>
        </div>

        <div className="security-item">
          <div className="security-label">Email Status</div>
          <div className="security-value">
            <VerificationBadge verified={user?.isEmailVerified} />
          </div>
        </div>
      </div>

      {!user?.isEmailVerified && (
        <div className="verify-banner">
          <div>Your email is not verified yet.</div>
          <button className="banner-cta" onClick={onResendVerification}>
            Resend verification
          </button>
        </div>
      )}
    </div>
  );
};

export default SecurityPanel;