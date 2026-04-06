/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Dashboard Page                      ║
 * ║   Home after login — stats, roadmap, info    ║
 * ╚══════════════════════════════════════════════╝
 */

import { useState, useEffect } from 'react';
import {
  Target,
  ScanLine,
  AlertTriangle,
  Shield,
  CheckCircle,
  Clock,
  UserCircle2,
  BadgeCheck,
  Activity,
  ShieldAlert,
  Layers3,
  ServerCog,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.config';
import useAuth from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import Layout from '../components/layout';
import ActivityLog from '../components/ActivityLog';
import { formatDate } from '../utils/helpers';


const phases = [
  { label: 'Authentication & Sessions', phase: 'Phase 1', done: true },
  { label: 'Target Management', phase: 'Phase 2', done: false },
  { label: 'Scan Engine', phase: 'Phase 3', done: false },
  { label: 'AI Decision Agent', phase: 'Phase 4', done: false },
  { label: 'Reports & Dashboard', phase: 'Phase 5', done: false },
];

const StatCard = ({ icon: Icon, value, label, color, bg, sub }) => (
  <div className="dark-card advanced-stat-card" style={{ cursor: 'default' }}>
    <div className="stat-icon-wrap" style={{ background: bg }}>
      <Icon size={16} color={color} strokeWidth={1.8} />
    </div>
    <div className="stat-val">{value}</div>
    <div className="stat-lbl">{label}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

const MiniSeverityBar = ({ label, value, tone }) => (
  <div className="severity-row">
    <div className="severity-row-top">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div className="severity-track">
      <div
        className={`severity-fill ${tone}`}
        style={{ width: `${Math.max(value, value === 0 ? 6 : 0)}%` }}
      />
    </div>
  </div>
);

const SkeletonCard = ({ lines = 3, tall = false }) => (
  <div className={`dark-card skeleton-card ${tall ? 'skeleton-card-tall' : ''}`}>
    <div className="skeleton-line skeleton-sm" />
    <div className="skeleton-line skeleton-lg" />
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className={`skeleton-line ${i % 2 === 0 ? 'skeleton-md' : 'skeleton-sm'}`} />
    ))}
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/user/dashboard-stats');
        setStats(res.data.data.stats);
      } catch {
        toast.error('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const severityData = [
    { label: 'Critical', value: stats?.criticalVulns ?? 0, tone: 'critical' },
    { label: 'High', value: stats?.highVulns ?? 0, tone: 'high' },
    { label: 'Medium', value: stats?.mediumVulns ?? 0, tone: 'medium' },
    { label: 'Low', value: stats?.lowVulns ?? 0, tone: 'low' },
  ];

  return (
    <Layout>
      <div className="page-header">
        <h2>{greeting()}, {user?.name?.split(' ')[0]} 👋</h2>
        <p>Here's your security testing workspace overview</p>
      </div>

      <div className="banner" style={{ marginBottom: 16 }}>
        <div className="banner-icon">
          <Shield size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="banner-title">Phase 1 complete — authentication & session management live</div>
          <div className="banner-sub">
            JWT auth, Google OAuth, email verification, password reset, role-based access — all operational.
          </div>
        </div>
        <button
          className="banner-cta"
          onClick={() => toast('Phase 2 — Target Management coming next!', { icon: '🚀' })}
        >
          Start Phase 2 →
        </button>
      </div>
      {loading ? (
        <>
          <div className="advanced-stats-grid">
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </div>

          <div className="advanced-dashboard-grid">
            <SkeletonCard lines={4} tall />
            <SkeletonCard lines={4} tall />
            <SkeletonCard lines={4} tall />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 188px',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <SkeletonCard lines={4} tall />
            <SkeletonCard lines={5} tall />
          </div>

          <div className="advanced-bottom-grid">
            <SkeletonCard lines={4} tall />
            <SkeletonCard lines={5} tall />
          </div>
        </>
      ) : (
        <>
          <div className="advanced-stats-grid">
            <StatCard
              icon={Target}
              value={stats?.totalTargets ?? 0}
              label="Total targets"
              color="var(--amber)"
              bg="rgba(245,158,11,0.08)"
              sub="Ready for target onboarding"
            />
            <StatCard
              icon={ScanLine}
              value={stats?.activeScans ?? 0}
              label="Active scans"
              color="var(--indigo-l)"
              bg="rgba(79,70,229,0.10)"
              sub="No scan running right now"
            />
            <StatCard
              icon={AlertTriangle}
              value={stats?.criticalVulns ?? 0}
              label="Critical vulns"
              color="var(--red)"
              bg="rgba(239,68,68,0.08)"
              sub="No live findings in phase 1"
            />
            <StatCard
              icon={Shield}
              value={`${stats?.securityScore ?? 0}%`}
              label="Security score"
              color="var(--green)"
              bg="rgba(16,185,129,0.08)"
              sub={stats?.emailVerified ? 'Healthy account posture' : 'Verify email to improve'}
            />
          </div>

          <div className="advanced-dashboard-grid">
            <div className="dark-card">
              <div className="card-title">
                <ShieldAlert size={13} />
                Security posture
              </div>

              <div className="posture-score-wrap">
                <div className="posture-score-ring">
                  <div className="posture-score-inner">
                    <div className="posture-score-value">
                      {`${stats?.securityScore ?? 0}%`}
                    </div>
                    <div className="posture-score-label">Overall</div>
                  </div>
                </div>

                <div className="posture-points">
                  <div className="posture-point">
                    <span className="posture-dot good" />
                    Email {stats?.emailVerified ? 'verified' : 'pending verification'}
                  </div>
                  <div className="posture-point">
                    <span className="posture-dot info" />
                    Auth provider: {stats?.authProvider || user?.authProvider}
                  </div>
                  <div className="posture-point">
                    <span className="posture-dot neutral" />
                    Profile completion: {`${stats?.profileCompletion ?? 0}%`}
                  </div>
                  <div className="posture-point">
                    <span className="posture-dot info" />
                    Current session: {stats?.currentSession ? 'active' : 'inactive'}
                  </div>
                </div>
              </div>
            </div>

            <div className="dark-card">
              <div className="card-title">
                <Layers3 size={13} />
                Vulnerability distribution
              </div>

              <div className="severity-list">
                {severityData.map((item) => (
                  <MiniSeverityBar
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    tone={item.tone}
                  />
                ))}
              </div>

              <div className="severity-note">
                Severity breakdown will automatically populate once scan engine goes live.
              </div>
            </div>

            <div className="dark-card">
              <div className="card-title">
                <ServerCog size={13} />
                Platform health
              </div>

              <div className="health-grid">
                <div className="health-item">
                  <div className="health-k">API status</div>
                  <div className="health-v ok">Operational</div>
                </div>
                <div className="health-item">
                  <div className="health-k">Auth status</div>
                  <div className="health-v ok">Protected</div>
                </div>
                <div className="health-item">
                  <div className="health-k">Email verification</div>
                  <div className={`health-v ${stats?.emailVerified ? 'ok' : 'warn'}`}>
                    {stats?.emailVerified ? 'Verified' : 'Pending'}
                  </div>
                </div>
                <div className="health-item">
                  <div className="health-k">Scan readiness</div>
                  <div className="health-v info">Phase 2 pending</div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 188px',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div className="dark-card">
              <div className="card-title">
                <ScanLine size={13} />
                Recent scans
              </div>

              <div className="empty-state">
                <div className="empty-icon">
                  <ScanLine size={20} />
                </div>
                <div className="empty-title">No scans yet</div>
                <div className="empty-sub">
                  Add a target in Phase 2 to start scanning.
                  <br />
                  The AI agent handles everything automatically.
                </div>
                <div className="empty-badge">
                  <Clock size={10} />
                  Unlocks in Phase 2
                </div>
              </div>
            </div>

            <div className="dark-card">
              <div className="card-title">Build roadmap</div>
              {phases.map(({ label, phase, done }) => (
                <div className="rm-row" key={phase}>
                  <div className={`rm-num ${done ? 'rm-done' : 'rm-todo'}`}>
                    {done ? (
                      <CheckCircle size={10} strokeWidth={3} />
                    ) : (
                      <span>{phase.replace('Phase ', '')}</span>
                    )}
                  </div>
                  <div>
                    <div
                      className="rm-label"
                      style={{ color: done ? 'var(--text)' : 'var(--text3)' }}
                    >
                      {label}
                    </div>
                    <div className="rm-phase">{phase}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="advanced-bottom-grid">
            <ActivityLog notifications={notifications} />

            <div className="dark-card">
              <div className="card-title">
                <Activity size={13} />
                Account overview
              </div>

              <div className="acc-grid">
                <div className="acc-item">
                  <div className="acc-label">Profile completion</div>
                  <div className="acc-value">{`${stats?.profileCompletion ?? 0}%`}</div>
                </div>

                <div className="acc-item">
                  <div className="acc-label">Email status</div>
                  <div className="acc-value">
                    {stats?.emailVerified ? 'Verified' : 'Not verified'}
                  </div>
                </div>

                <div className="acc-item">
                  <div className="acc-label">Auth provider</div>
                  <div className="acc-value" style={{ textTransform: 'capitalize' }}>
                    {stats?.authProvider || user?.authProvider}
                  </div>
                </div>

                <div className="acc-item">
                  <div className="acc-label">Member since</div>
                  <div className="acc-value" style={{ fontSize: 10 }}>
                    {formatDate(stats?.memberSince || user?.createdAt)}
                  </div>
                </div>
              </div>

              <div className="session-mini-grid">
                <div className="acc-item session-mini-card">
                  <UserCircle2 size={16} color="var(--indigo-l)" />
                  <div>
                    <div className="acc-label" style={{ marginBottom: 2 }}>Current session</div>
                    <div className="acc-value">
                      {stats?.currentSession ? 'Active on this device' : 'No active session'}
                    </div>
                  </div>
                </div>

                <div className="acc-item session-mini-card">
                  <BadgeCheck size={16} color="var(--green)" />
                  <div>
                    <div className="acc-label" style={{ marginBottom: 2 }}>Last login</div>
                    <div className="acc-value" style={{ fontSize: 10 }}>
                      {stats?.lastLoginAt ? formatDate(stats.lastLoginAt) : 'First login'}
                    </div>
                  </div>
                </div>
              </div>

              {!stats?.emailVerified && (
                <div className="dashboard-warning-note">
                  Your email is not verified yet. Go to Settings to review your account security.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default Dashboard;
