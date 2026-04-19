import { useState, useEffect, useMemo } from 'react';
import {
  Shield, AlertTriangle, Activity, Clock, Zap, TrendingUp, TrendingDown,
  ShieldAlert, Layers3, ServerCog, Target, ScanLine, BrainCircuit,
  Crosshair, Timer, Radio, Cpu, ArrowUpRight, ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios.config';
import useAuth from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import Layout from '../components/layout';
import ActivityLog from '../components/ActivityLog';
import { formatDate } from '../utils/helpers';

/* ── Helpers ── */
const sevColor = s => ({ critical: '#ff3b5c', high: '#ff6b35', medium: '#ffb800', low: '#818cf8', info: '#64748b' }[s] || '#64748b');

const MetricCard = ({ icon: Icon, value, label, sub, color, bg, trend, trendVal }) => (
  <motion.div 
    whileHover={{ y: -6, scale: 1.02, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)' }}
    className="stat-card fade-up cyber-metric-card"
  >
    <div className="stat-icon-wrap" style={{ background: bg }}>
      <Icon size={18} color={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </div>
    <div className="stat-val">{value}</div>
    <div className="stat-lbl">{label}</div>
    {trend && (
      <div className={`stat-trend ${trend}`} style={{ color: trend === 'up' ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '10px', fontWeight: 700, marginTop: 8 }}>
        {trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {trendVal}
      </div>
    )}
    {sub && <div className="stat-sub" style={{ marginTop: trend ? 4 : 8 }}>{sub}</div>}
  </motion.div>
);

const LiveOperationItem = ({ source, target, title, severity, time, meta }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '130px 1fr auto',
    gap: 12,
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.01)',
    transition: 'all 0.2s',
  }} className="operation-row-hover">
    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
      {source}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {target || '0.0.0.0'} | {meta || 'Passive scan'}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div className={`sev-badge ${severity || 'info'}`}>{severity || 'info'}</div>
      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4, fontFamily: "'JetBrains Mono'" }}>{time}</div>
    </div>
  </div>
);

const MiniSeverityBar = ({ label, value, tone }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span>{value}</span>
    </div>
    <div style={{ height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, (value || 0) * 5 + 5)}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ height: '100%', background: sevColor(tone), boxShadow: `0 0 10px ${sevColor(tone)}40` }}
      />
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [evData, statsData] = await Promise.all([
          api.get('/user/dashboard-events'),
          api.get('/user/dashboard-stats')
        ]);
        setEvents(evData.data.data.events || []);
        setStats(statsData.data.data.stats || {});
      } catch (err) {
        toast.error('Intelligence sync delayed');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const aggregatedStats = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    events.forEach(e => {
      const s = (e.severity || 'info').toLowerCase();
      if (counts[s] !== undefined) counts[s]++;
    });
    const avgRisk = events.length ? Math.round(events.reduce((acc, e) => acc + (e.riskScore || 0), 0) / events.length) : 0;
    return { counts, avgRisk };
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (activeTab === 'all') return events;
    return events.filter(e => (e.severity || 'info').toLowerCase() === activeTab);
  }, [events, activeTab]);

  return (
    <Layout>
      <div className="dashboard-container" style={{ padding: '28px', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* ── Dashboard Header: Operational Context ── */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div className="status-orb pulse" />
              <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)' }}>
                Security Center <span className="holographic-text">Intelligence HUB</span>
              </h1>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: '14px', letterSpacing: '0.01em' }}>
              Welcome back, <span style={{ color: 'var(--indigo-l)', fontWeight: 800 }}>{user?.username || 'Commander'}</span>. AI Neural Engine is at <span style={{ color: 'var(--green)', fontWeight: 700 }}>Peak Optimization</span>.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, marginBottom: 4 }}>System Coordinates & Time</div>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: "'JetBrains Mono'", color: 'var(--text)', whiteSpace: 'nowrap' }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} // {new Date().toLocaleTimeString()}
            </div>
          </div>
        </motion.div>

        {/* ── Key Operational Metrics ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <MetricCard 
            icon={ShieldAlert}
            value={`${aggregatedStats.avgRisk}/100`}
            label="Avg Risk Exposure"
            sub="Network-wide threat score"
            color="var(--red)"
            bg="rgba(239,68,68,0.12)"
            trend="down"
            trendVal="4.2%"
          />
          <MetricCard 
            icon={Target}
            value={stats?.totalTargets || events.length}
            label="Monitored Assets"
            sub="Live attack surface nodes"
            color="var(--cyan)"
            bg="rgba(6,182,212,0.12)"
          />
          <MetricCard 
            icon={BrainCircuit}
            value={events.filter(e => e.source === 'ai-pentester').length}
            label="AI Interventions"
            sub="Automated cognition findings"
            color="var(--purple)"
            bg="rgba(168,85,247,0.12)"
            trend="up"
            trendVal="+8"
          />
          <MetricCard 
            icon={Zap}
            value={aggregatedStats.counts.critical + aggregatedStats.counts.high}
            label="High-Risk Alarms"
            sub="Active breach indicators"
            color="var(--amber)"
            bg="rgba(245,158,11,0.12)"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '32px' }}>
          
          {/* ── PRIMARY FEED: SOC TIMELINE ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div className="dark-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Radio size={16} color="var(--red)" style={{ animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)' }}>Global Intelligence Feed</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['all', 'critical', 'high', 'medium'].map(t => (
                    <button 
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`tab-btn ${activeTab === t ? 'active' : ''}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '640px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                {loading ? (
                  Array(6).fill(0).map((_, i) => (
                    <div key={i} className="skeleton-card" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                      <div className="skeleton-line skeleton-sm" />
                      <div className="skeleton-line skeleton-lg" />
                    </div>
                  ))
                ) : filteredEvents.length > 0 ? (
                  filteredEvents.map(event => (
                    <motion.div 
                      key={event.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <LiveOperationItem 
                        source={event.source === 'ai-pentester' ? '🤖 AI HIVE' : event.source === 'recon-agent' ? '📡 RECON' : '🛡️ NETWORK'}
                        target={event.target}
                        title={event.title}
                        severity={event.severity}
                        time={formatDate(event.timestamp)}
                        meta={event.meta}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)' }}>
                    <Shield size={40} style={{ marginBottom: 16, opacity: 0.1 }} />
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>All sectors clear. No active threats detected.</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              <div className="dark-card" style={{ padding: '20px' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)', marginBottom: '20px' }}>
                  <ScanLine size={16} /> Surface Matrix Distribution
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <MiniSeverityBar label="External Exposed APIs" value={stats?.apiCount || 14} tone="critical" />
                  <MiniSeverityBar label="Active Subdomains" value={stats?.subdomainCount || 42} tone="high" />
                  <MiniSeverityBar label="Open Network Ports" value={stats?.portCount || 82} tone="medium" />
                  <MiniSeverityBar label="Identified CVEs" value={aggregatedStats.counts.critical + aggregatedStats.counts.high} tone="critical" />
                </div>
              </div>
              
              <div className="dark-card" style={{ padding: '20px' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)', marginBottom: '20px' }}>
                  <Cpu size={16} /> AI Neural Hive Status
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: 16 }}>
                  <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Cortex Optimization</span>
                  <span style={{ color: 'var(--indigo-l)', fontWeight: 900, textShadow: '0 0 10px var(--indigo-glow)' }}>ONLINE [ACTIVE]</span>
                </div>
                <div className="ai-status-grid">
                  <div className="ai-status-node active">OSINT ENGINE</div>
                  <div className="ai-status-node active">VULN DISCOVERY</div>
                  <div className="ai-status-node">EXPLOIT CHAIN</div>
                  <div className="ai-status-node active">REPORT GENERATOR</div>
                </div>
                <div style={{ marginTop: 16, padding: '12px', background: 'rgba(99,102,241,0.05)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.1)' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
                    AI is currently analyzing the last 48 hours of scan telemetry to predict lateral movement paths.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* ── SIDE COLUMN: Insights, Recommendations & Operations ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div className="dark-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)', marginBottom: '20px' }}>
                <BrainCircuit size={16} color="var(--purple)" /> Cogntive Insights
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="ai-rec-item">
                  <div className="ai-rec-icon"><ShieldAlert size={14} /></div>
                  <div className="ai-rec-text">Immediate: Block RDP port 3389 on primary DB node.</div>
                  <div className="ai-rec-action" onClick={() => toast.success('Rule deployed to firewall')}>FIX</div>
                </div>
                <div className="ai-rec-item">
                  <div className="ai-rec-icon"><Activity size={14} /></div>
                  <div className="ai-rec-text">Nmap detected outdated OpenSSH (7.6p1). Patch required.</div>
                  <div className="ai-rec-action" onClick={() => toast.success('Patching scheduled')}>PATCH</div>
                </div>
                <div className="ai-rec-item">
                  <div className="ai-rec-icon"><Zap size={14} /></div>
                  <div className="ai-rec-text">Expired SSL cert found on internal gateway node.</div>
                  <div className="ai-rec-action" onClick={() => toast.success('Certificate rotated')}>RENEW</div>
                </div>
              </div>
              {/* Decoration */}
              <BrainCircuit size={140} style={{ position: 'absolute', bottom: -30, right: -30, opacity: 0.025, transform: 'rotate(-20deg)', pointerEvents: 'none' }} />
            </div>

            <div className="dark-card" style={{ padding: '20px' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)', marginBottom: '20px' }}>
                <ServerCog size={16} /> Grid Health
              </div>
              <div className="health-grid">
                <div className="health-item">
                  <div className="health-k">Cortex AI</div>
                  <div className="health-v">SYNCED</div>
                </div>
                <div className="health-item">
                  <div className="health-k">Scanners</div>
                  <div className="health-v">READY [4/4]</div>
                </div>
                <div className="health-item">
                  <div className="health-k">Websocket</div>
                  <div className="health-v">CONNECTED</div>
                </div>
                <div className="health-item">
                  <div className="health-k">ThreatDB</div>
                  <div className="health-v">OPTIMIZED</div>
                </div>
              </div>
            </div>

            <div className="dark-card" style={{ flex: 1, padding: '20px' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)', marginBottom: '20px' }}>
                <Clock size={16} /> Operation Log
              </div>
              <div style={{ marginTop: 10 }}>
                <ActivityLog limit={6} compact />
              </div>
            </div>

          </div>

        </div>

      </div>

      <style jsx>{`
        .status-orb { width: 10px; height: 10px; border-radius: 50%; background: var(--green); box-shadow: 0 0 15px var(--green-glow); }
        .operation-row-hover:hover { background: rgba(255,255,255,0.03) !important; transform: translateX(8px); border-color: rgba(129,140,248,0.2) !important; }
        
        @keyframes pulse { 0% { opacity: 0.6; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.6; transform: scale(0.9); } }
      `}</style>
    </Layout>
  );
};

export default Dashboard;
