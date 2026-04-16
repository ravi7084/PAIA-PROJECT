import { useState, useEffect, useMemo } from 'react';
import {
  Shield, AlertTriangle, Activity, Clock, Zap, TrendingUp, TrendingDown,
  ShieldAlert, Layers3, ServerCog, Target, ScanLine, BrainCircuit,
  Crosshair, Timer, Radio, Cpu, ArrowUpRight, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.config';
import useAuth from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import Layout from '../components/layout';
import ActivityLog from '../components/ActivityLog';
import { formatDate } from '../utils/helpers';
import { DASHBOARD_UPDATE_EVENT, getDashboardEvents } from '../utils/dashboardRealtime';

/* Helpers */
const sevColor = s => ({ critical: '#ff3b5c', high: '#ff6b35', medium: '#ffb800', low: '#818cf8', info: '#64748b' }[s] || '#64748b');

const MetricCard = ({ icon: Icon, value, label, sub, color, bg, trend, trendVal }) => (
  <div className="stat-card fade-up">
    <div className="stat-icon-wrap" style={{ background: bg }}>
      <Icon size={17} color={color} strokeWidth={1.8} />
    </div>
    <div className="stat-val">{value}</div>
    <div className="stat-lbl">{label}</div>
    {trend && (
      <div className={`stat-trend ${trend}`}>
        {trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {trendVal}
      </div>
    )}
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

const ThreatFeedItem = ({ severity, title, meta, time }) => (
  <div className={`threat-feed-item ${severity}`}>
    <div className={`threat-dot ${severity}`} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="threat-title">{title}</div>
      <div className="threat-meta">{meta} {time}</div>
    </div>
    <span className={`sev-badge ${severity}`}>{severity}</span>
  </div>
);

const AIRecCard = ({ icon, text, action }) => (
  <div className="ai-rec-item">
    <div className="ai-rec-icon">{icon}</div>
    <div className="ai-rec-text">{text}</div>
    <div className="ai-rec-action">{action}</div>
  </div>
);

const MiniSeverityBar = ({ label, value, tone }) => (
  <div className="severity-row">
    <div className="severity-row-top"><span>{label}</span><span>{value}</span></div>
    <div className="severity-track">
      <div className={`severity-fill ${tone}`} style={{ width: `${Math.min(Math.max(value * 5, value === 0 ? 4 : 6), 100)}%` }} />
    </div>
  </div>
);

const LiveOperationItem = ({ source, target, title, severity, time, meta }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '130px 1fr auto',
    gap: 10,
    alignItems: 'center',
    padding: '9px 10px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
  }}>
    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700 }}>
      {source}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {target || 'target not available'} | {meta || 'live event stream'}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div className={`sev-badge ${severity || 'info'}`}>{severity || 'info'}</div>
      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>{time}</div>
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

/*  Mock threat feed (backend will send via WebSocket) */
const mockThreats = [
  { severity: 'critical', title: 'SSH Brute Force Detected', meta: '192.168.1.45  Port 22', time: '2m ago' },
  { severity: 'high', title: 'Outdated Apache Version', meta: 'CVE-2021-41773 example.com', time: '8m ago' },
  { severity: 'medium', title: 'SSL Certificate Expiring', meta: 'api.target.io  5 days left', time: '15m ago' },
  { severity: 'low', title: 'Information Disclosure', meta: 'Server header exposed on target.com', time: '1h ago' },
  { severity: 'critical', title: 'SQL Injection Vector', meta: 'login.php?id=  target.io', time: '2h ago' },
];

const mockRecs = [
  { icon: '', text: 'Close SSH port 22 on 192.168.1.45 brute force attempts detected', action: 'Apply fix' },
  { icon: '', text: 'Update Apache 2.4.49 2.4.58 on example.com (CVE-2021-41773)', action: 'View CVE' },
  { icon: '', text: 'Renew SSL certificate for api.target.io before expiration', action: 'Renew' },
  { icon: '', text: 'Enable rate limiting on login endpoints to prevent brute force', action: 'Configure' },
];

const timeAgo = (iso) => {
  if (!iso) return 'just now';
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

const recActionBySeverity = (severity) => {
  if (severity === 'critical') return 'Investigate now';
  if (severity === 'high') return 'Patch urgently';
  if (severity === 'medium') return 'Review controls';
  return 'Monitor';
};

const sourceLabel = (source) => {
  if (source === 'scan-center') return 'Scan Center';
  if (source === 'threat-intel') return 'Threat Intel';
  return 'Security Stream';
};

const Dashboard = () => {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [realtimeEvents, setRealtimeEvents] = useState([]);

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
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get('/user/dashboard-events');
        if (res.data.success) {
          setRealtimeEvents(res.data.data.events);
        } else {
          setRealtimeEvents(getDashboardEvents());
        }
      } catch {
        setRealtimeEvents(getDashboardEvents());
      }
    };
    fetchEvents();

    const onRealtimeUpdate = (ev) => {
      if (!ev?.detail) return;
      setRealtimeEvents((prev) => {
        // Prevent duplicate events if they were already fetched from history
        if (prev.some(p => p.id === ev.detail.id)) return prev;
        return [ev.detail, ...prev].slice(0, 100);
      });
    };

    const onStorage = (ev) => {
      if (ev.key !== 'paia_dashboard_events_v1') return;
      // When storage changes, we might want to refresh from backend or merge
      // For now, simple re-sync with localStorage if backend fails
      setRealtimeEvents(getDashboardEvents());
    };

    window.addEventListener(DASHBOARD_UPDATE_EVENT, onRealtimeUpdate);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(DASHBOARD_UPDATE_EVENT, onRealtimeUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const eventCounts = realtimeEvents.reduce(
    (acc, item) => {
      const key = item?.severity || 'info';
      if (acc[key] !== undefined) acc[key] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const liveRiskScore = realtimeEvents.length
    ? Math.round(realtimeEvents.reduce((sum, item) => sum + Number(item?.riskScore || 0), 0) / realtimeEvents.length)
    : null;

  const liveThreatFeed = realtimeEvents.length
    ? realtimeEvents.slice(0, 5).map((item) => ({
      severity: item.severity || 'info',
      title: item.title || 'Security event',
      meta: [item.target, item.meta].filter(Boolean).join(' | ') || 'event stream',
      time: timeAgo(item.timestamp),
    }))
    : mockThreats;

  const liveRecommendations = realtimeEvents.length
    ? realtimeEvents.slice(0, 4).map((item) => ({
      icon: item.source === 'scan-center' ? 'ðŸ› ï¸' : 'ðŸ§ ',
      text: `${item.title} (${item.target || 'target'})`,
      action: recActionBySeverity(item.severity || 'info'),
    }))
    : mockRecs;

  const criticalCount = Math.max(stats?.criticalVulns ?? 0, eventCounts.critical);
  const highCount = Math.max(stats?.highVulns ?? 0, eventCounts.high);
  const mediumCount = Math.max(stats?.mediumVulns ?? 0, eventCounts.medium);
  const lowCount = Math.max(stats?.lowVulns ?? 0, eventCounts.low);

  const severityData = [
    { label: 'Critical', value: criticalCount, tone: 'critical' },
    { label: 'High', value: highCount, tone: 'high' },
    { label: 'Medium', value: mediumCount, tone: 'medium' },
    { label: 'Low', value: lowCount, tone: 'low' },
  ];

  const liveOperations = realtimeEvents
    .filter((item) => item?.source === 'scan-center' || item?.source === 'threat-intel')
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      source: sourceLabel(item.source),
      target: item.target || '',
      title: item.title || 'Security event',
      severity: item.severity || 'info',
      meta: item.meta || '',
      time: timeAgo(item.timestamp),
    }));

  return (
    <Layout>
      {/* Header */}
      <div className="page-header">
        <h2>{greeting()}, {user?.name?.split(' ')[0]}</h2>
        <p>Security Operations Center. Real-time threat visibility and AI-driven intelligence</p>
      </div>

      {/* System Status Banner */}
      <div className="banner">
        <div className="banner-icon"><Shield size={14} /></div>
        <div style={{ flex: 1 }}>
          <div className="banner-title">All systems operational AI Agent, Threat Intelligence & Scan Engine active</div>
          <div className="banner-sub">
            PAIA is monitoring your attack surface in real-time.
          </div>
        </div>
        <button className="banner-cta" onClick={() => toast('Launching AI scan...', { icon: '' })}>
          Quick Scan 
        </button>
      </div>

      {loading ? (
        <>
          <div className="stats-grid">
            <SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} />
          </div>
          <div className="dashboard-two-col"><SkeletonCard lines={4} tall /><SkeletonCard lines={4} tall /></div>
          <div className="dashboard-two-col"><SkeletonCard lines={4} tall /><SkeletonCard lines={4} tall /></div>
        </>
      ) : (
        <>
          {/* SOC Metrics */}
          <div className="stats-grid">
            <MetricCard
              icon={Timer}
              value="4.2s"
              label="MTTD"
              color="var(--cyan)"
              bg="rgba(6,182,212,0.08)"
              trend="up"
              trendVal="12% faster"
            />
            <MetricCard
              icon={Zap}
              value="18m"
              label="MTTR"
              color="var(--green)"
              bg="rgba(16,185,129,0.08)"
              trend="up"
              trendVal="8% improved"
            />
            <MetricCard
              icon={Crosshair}
              value={`${liveRiskScore ?? stats?.securityScore ?? 0}/100`}
              label="Risk Score"
              color={(liveRiskScore ?? stats?.securityScore ?? 0) > 70 ? 'var(--green)' : 'var(--amber)'}
              bg={(liveRiskScore ?? stats?.securityScore ?? 0) > 70 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)'}
              sub={realtimeEvents.length ? 'Updated from live scan stream' : 'Based on latest scan results'}
            />
            <MetricCard
              icon={AlertTriangle}
              value={criticalCount}
              label="Active Threats"
              color="var(--red)"
              bg="rgba(239,68,68,0.08)"
              sub={`${highCount} high, ${mediumCount} medium`}
            />
          </div>

          {/* Live Threat Feed + AI Recommendations  */}
          <div className="dashboard-two-col">
            <div className="dark-card">
              <div className="card-title"><Radio size={13} /> Live Threat Feed</div>
              <div className="threat-feed">
                {liveThreatFeed.map((t, i) => (
                  <ThreatFeedItem key={i} {...t} />
                ))}
              </div>
            </div>

            <div className="dark-card">
              <div className="card-title"><BrainCircuit size={13} /> AI Recommendations</div>
              <div className="ai-recs">
                {liveRecommendations.map((r, i) => (
                  <AIRecCard key={i} {...r} />
                ))}
              </div>
            </div>
          </div>

          {/* Vulnerability Distribution + Platform Health */}
          <div className="dark-card" style={{ marginTop: 14 }}>
            <div className="card-title"><ScanLine size={13} /> Live Target Operations</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {liveOperations.length ? (
                liveOperations.map((item) => <LiveOperationItem key={item.id} {...item} />)
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  No live scan activity yet. Start a scan from Scan Center or Threat Intel.
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-two-col">
            <div className="dark-card">
              <div className="card-title"><Layers3 size={13} /> Vulnerability Heatmap</div>
              <div className="severity-list" style={{ marginBottom: 12 }}>
                {severityData.map(item => (
                  <MiniSeverityBar key={item.label} {...item} />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                {severityData.map(item => (
                  <div key={item.label} style={{
                    textAlign: 'center', padding: '10px 8px', borderRadius: 8,
                    background: `${sevColor(item.tone)}10`,
                    border: `1px solid ${sevColor(item.tone)}20`,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: sevColor(item.tone) }}>{item.value}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="dark-card">
              <div className="card-title"><ServerCog size={13} /> Platform Health</div>
              <div className="health-grid">
                <div className="health-item">
                  <div className="health-k">API Gateway</div>
                  <div className="health-v ok">Operational</div>
                </div>
                <div className="health-item">
                  <div className="health-k">AI Engine (Gemini)</div>
                  <div className="health-v ok">Connected</div>
                </div>
                <div className="health-item">
                  <div className="health-k">Scan Engine</div>
                  <div className="health-v ok">Ready</div>
                </div>
                <div className="health-item">
                  <div className="health-k">Threat Intel APIs</div>
                  <div className="health-v ok">6/7 Active</div>
                </div>
                <div className="health-item">
                  <div className="health-k">WebSocket</div>
                  <div className="health-v ok">Connected</div>
                </div>
                <div className="health-item">
                  <div className="health-k">Database</div>
                  <div className="health-v ok">MongoDB Atlas</div>
                </div>
              </div>
            </div>
          </div>

          {/*  Activity Log + Account Overview  */}
          <div className="advanced-bottom-grid">
            <ActivityLog notifications={notifications} />

            <div className="dark-card">
              <div className="card-title"><Activity size={13} /> Account Overview</div>
              <div className="acc-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="acc-item">
                  <div className="acc-label">Role</div>
                  <div className="acc-value" style={{ textTransform: 'capitalize' }}>{user?.role || 'analyst'}</div>
                </div>
                <div className="acc-item">
                  <div className="acc-label">Email</div>
                  <div className="acc-value">{stats?.emailVerified ? 'Verified' : 'Pending'}</div>
                </div>
                <div className="acc-item">
                  <div className="acc-label">Auth</div>
                  <div className="acc-value" style={{ textTransform: 'capitalize' }}>{stats?.authProvider || user?.authProvider}</div>
                </div>
                <div className="acc-item">
                  <div className="acc-label">Since</div>
                  <div className="acc-value" style={{ fontSize: 10 }}>{formatDate(stats?.memberSince || user?.createdAt)}</div>
                </div>
              </div>

              {!stats?.emailVerified && (
                <div className="dashboard-warning-note">
                  Email not verified. Verify to unlock full platform capabilities.
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

