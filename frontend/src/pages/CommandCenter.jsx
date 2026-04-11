import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radar, Activity, Clock, Zap, Globe, Shield, AlertTriangle,
  Radio, Cpu, Crosshair, Eye, Terminal as TerminalIcon,
} from 'lucide-react';
import Layout from '../components/layout';
import useAuth from '../hooks/useAuth';

/* ── Mock Data for Command Center ── */
const mockGraphData = {
  nodes: [
    { id: 'target-1', label: 'example.com', type: 'target', risk: 'high' },
    { id: 'port-80', label: 'HTTP :80', type: 'service', risk: 'medium' },
    { id: 'port-443', label: 'HTTPS :443', type: 'service', risk: 'low' },
    { id: 'port-22', label: 'SSH :22', type: 'service', risk: 'critical' },
    { id: 'port-3306', label: 'MySQL :3306', type: 'service', risk: 'high' },
    { id: 'dns-1', label: 'ns1.example.com', type: 'dns', risk: 'info' },
    { id: 'sub-1', label: 'api.example.com', type: 'subdomain', risk: 'medium' },
    { id: 'sub-2', label: 'admin.example.com', type: 'subdomain', risk: 'critical' },
    { id: 'threat-1', label: 'CVE-2021-41773', type: 'threat', risk: 'critical' },
    { id: 'threat-2', label: 'Weak SSH Key', type: 'threat', risk: 'high' },
  ],
  links: [
    { source: 'target-1', target: 'port-80' }, { source: 'target-1', target: 'port-443' },
    { source: 'target-1', target: 'port-22' }, { source: 'target-1', target: 'port-3306' },
    { source: 'target-1', target: 'dns-1' }, { source: 'target-1', target: 'sub-1' },
    { source: 'target-1', target: 'sub-2' }, { source: 'port-80', target: 'threat-1' },
    { source: 'port-22', target: 'threat-2' }, { source: 'sub-2', target: 'threat-1' },
  ],
};

const colorMap = { critical: '#ff3b5c', high: '#ff6b35', medium: '#ffb800', low: '#818cf8', info: '#64748b' };
const typeColorMap = { target: '#818cf8', service: '#06b6d4', dns: '#64748b', subdomain: '#a855f7', threat: '#ff3b5c' };

const mockTimeline = [
  { time: '00:00:02', event: 'Scan initiated — target: example.com', severity: 'info' },
  { time: '00:00:05', event: 'DNS resolution complete — 4 records found', severity: 'success' },
  { time: '00:00:12', event: 'Port scan started — TCP SYN scan', severity: 'info' },
  { time: '00:00:34', event: 'Open port discovered: 22 (SSH)', severity: 'medium' },
  { time: '00:00:35', event: 'Open port discovered: 80 (HTTP)', severity: 'medium' },
  { time: '00:00:36', event: 'Open port discovered: 443 (HTTPS)', severity: 'info' },
  { time: '00:00:37', event: 'Open port discovered: 3306 (MySQL)', severity: 'high' },
  { time: '00:01:02', event: 'Web scan started — Apache 2.4.49 detected', severity: 'info' },
  { time: '00:01:45', event: 'CRITICAL: CVE-2021-41773 — Path Traversal', severity: 'critical' },
  { time: '00:02:10', event: 'SSH weak key detected — 1024-bit RSA', severity: 'high' },
  { time: '00:02:30', event: 'AI Decision: Recommend deep web scan', severity: 'info' },
  { time: '00:03:00', event: 'MySQL exposed to public — no auth required', severity: 'critical' },
  { time: '00:03:45', event: 'Subdomain discovered: admin.example.com', severity: 'medium' },
  { time: '00:04:10', event: 'Scan complete — Report generated', severity: 'success' },
];

const mockAIStream = [
  { text: 'Initializing reconnaissance module...', type: 'system' },
  { text: 'Resolving DNS for example.com → 93.184.216.34', type: 'action' },
  { text: 'Running Nmap SYN scan on top 1000 ports...', type: 'action' },
  { text: 'FINDING: Port 22 running OpenSSH 7.4 — known vulnerabilities exist', type: 'warning' },
  { text: 'FINDING: Port 80 running Apache 2.4.49 — CVE-2021-41773 applies', type: 'critical' },
  { text: 'DECISION: Initiating web vulnerability scan based on Apache version', type: 'decision' },
  { text: 'Running Nikto against http://example.com...', type: 'action' },
  { text: 'FINDING: Directory traversal possible via /cgi-bin path', type: 'critical' },
  { text: 'DECISION: Recommending immediate patching of Apache', type: 'decision' },
  { text: 'Generating risk score based on CVSS v3.1 vectors...', type: 'system' },
  { text: 'Risk Score: 82/100 — HIGH RISK environment', type: 'critical' },
  { text: 'Report generation complete. 4 critical findings.', type: 'system' },
];

const CommandCenter = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [visibleTimeline, setVisibleTimeline] = useState([]);
  const [visibleAI, setVisibleAI] = useState([]);
  const [graphHover, setGraphHover] = useState(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Animate timeline entries
  useEffect(() => {
    setVisibleTimeline([]);
    setVisibleAI([]);
    const t1 = mockTimeline.map((item, i) =>
      setTimeout(() => setVisibleTimeline(prev => [...prev, item]), (i + 1) * 400)
    );
    const t2 = mockAIStream.map((item, i) =>
      setTimeout(() => setVisibleAI(prev => [...prev, item]), (i + 1) * 600)
    );
    return () => { t1.forEach(clearTimeout); t2.forEach(clearTimeout); };
  }, []);

  // Simple canvas graph renderer
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = canvas.parentElement.clientHeight;

    // Position nodes in a circular layout
    const cx = W / 2, cy = H / 2;
    const nodes = mockGraphData.nodes.map((n, i) => {
      if (n.type === 'target') return { ...n, x: cx, y: cy };
      const angle = ((i - 1) / (mockGraphData.nodes.length - 1)) * Math.PI * 2;
      const r = Math.min(W, H) * 0.35;
      return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });

    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n);

    // Animate
    let t = 0;
    const render = () => {
      t += 0.005;
      ctx.clearRect(0, 0, W, H);

      // Draw links
      mockGraphData.links.forEach(link => {
        const s = nodeMap[link.source];
        const d = nodeMap[link.target];
        if (!s || !d) return;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(d.x, d.y);
        ctx.strokeStyle = 'rgba(99,102,241,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Animated particle on link
        const px = s.x + (d.x - s.x) * ((Math.sin(t * 2 + s.x) + 1) / 2);
        const py = s.y + (d.y - s.y) * ((Math.sin(t * 2 + s.x) + 1) / 2);
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99,102,241,0.4)';
        ctx.fill();
      });

      // Draw nodes
      nodes.forEach(n => {
        const color = typeColorMap[n.type] || '#64748b';
        const riskColor = colorMap[n.risk] || '#64748b';
        const radius = n.type === 'target' ? 22 : n.type === 'threat' ? 14 : 12;
        const pulseR = radius + 4 + Math.sin(t * 3) * 3;

        // Glow
        if (n.risk === 'critical' || n.risk === 'high') {
          ctx.beginPath();
          ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = `${riskColor}15`;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${color}20`;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(240,238,255,0.7)';
        ctx.fillText(n.label, n.x, n.y + radius + 14);
      });

      animFrameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const cleanup = drawGraph();
    const handleResize = () => drawGraph();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (typeof cleanup === 'function') cleanup();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawGraph]);

  const aiTypeStyle = {
    system: { color: 'var(--text3)' },
    action: { color: 'var(--cyan)' },
    warning: { color: 'var(--amber)' },
    critical: { color: 'var(--red)', fontWeight: 700 },
    decision: { color: 'var(--indigo-l)', fontWeight: 700 },
  };

  return (
    <Layout>
      <div className="page-header">
        <h2><Radar size={22} /> Command Center</h2>
        <p>Real-time attack surface visualization, threat timeline, and AI decision stream</p>
      </div>

      {/* ── Active Scan Stats ── */}
      <div className="stats-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(6,182,212,0.08)' }}>
            <Globe size={17} color="var(--cyan)" />
          </div>
          <div className="stat-val">3</div>
          <div className="stat-lbl">Attack Surfaces</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(16,185,129,0.08)' }}>
            <Activity size={17} color="var(--green)" />
          </div>
          <div className="stat-val">1</div>
          <div className="stat-lbl">Active Scans</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(255,59,92,0.08)' }}>
            <AlertTriangle size={17} color="var(--red)" />
          </div>
          <div className="stat-val">4</div>
          <div className="stat-lbl">Critical Findings</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(99,102,241,0.08)' }}>
            <Cpu size={17} color="var(--indigo-l)" />
          </div>
          <div className="stat-val">12</div>
          <div className="stat-lbl">AI Decisions</div>
        </div>
      </div>

      <div className="cmd-center-grid">
        {/* ── Attack Surface Map ── */}
        <div className="dark-card cmd-center-full">
          <div className="card-title"><Eye size={13} /> Live Attack Surface Map</div>
          <div className="graph-container" style={{ height: 400 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(typeColorMap).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'capitalize' }}>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Threat Timeline ── */}
        <div className="dark-card">
          <div className="card-title"><Clock size={13} /> Threat Timeline</div>
          <div className="timeline-container">
            {visibleTimeline.map((item, i) => (
              <div key={i} className="timeline-item">
                <div className={`timeline-dot ${item.severity}`} />
                <div className="timeline-content">
                  <div className="timeline-title">{item.event}</div>
                  <div className="timeline-time">{item.time}</div>
                </div>
              </div>
            ))}
            {visibleTimeline.length < mockTimeline.length && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', color: 'var(--indigo-l)', fontSize: 11 }}>
                <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                Monitoring...
              </div>
            )}
          </div>
        </div>

        {/* ── AI Decisions Live Stream ── */}
        <div className="dark-card">
          <div className="card-title"><Cpu size={13} /> AI Decision Stream</div>
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span className="terminal-title">paia-ai-engine — live</span>
            </div>
            <div className="terminal-body">
              {visibleAI.map((item, i) => (
                <div key={i} className="terminal-line" style={{ marginBottom: 4 }}>
                  <span className="terminal-prompt">▶</span>
                  <span style={aiTypeStyle[item.type] || {}}>{item.text}</span>
                </div>
              ))}
              {visibleAI.length < mockAIStream.length && (
                <div className="terminal-line">
                  <span className="terminal-prompt">▶</span>
                  <span className="terminal-cursor" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CommandCenter;
