import { useState, useEffect, useRef } from 'react';
import {
  ScanLine, Search, Wifi, Globe, Shield, AlertTriangle,
  Play, Loader2, CheckCircle2, ChevronDown, ChevronUp,
  ArrowRight, Radio, Cpu, Clock,
} from 'lucide-react';
import Layout from '../components/layout';
import AutoReconPanel from '../components/AutoReconPanel';

const scanFlowSteps = [
  { label: 'Recon', icon: Search, phase: 'recon' },
  { label: 'Scan', icon: ScanLine, phase: 'scan' },
  { label: 'Analyze', icon: Cpu, phase: 'analyze' },
  { label: 'Report', icon: Shield, phase: 'report' },
];

const ScanFlowVisualizer = ({ activePhase = 'idle' }) => {
  const phaseOrder = ['recon', 'scan', 'analyze', 'report'];
  const activeIdx = phaseOrder.indexOf(activePhase);

  return (
    <div className="scan-flow" style={{ justifyContent: 'center', padding: '20px 0' }}>
      {scanFlowSteps.map((step, i) => {
        const Icon = step.icon;
        const isDone = activeIdx > i;
        const isActive = activeIdx === i;
        const isPending = activeIdx < i;
        const nodeClass = isDone ? 'done' : isActive ? 'active' : 'pending';
        const connectorClass = isDone ? 'done' : isActive ? 'active' : '';

        return (
          <div key={step.phase} style={{ display: 'flex', alignItems: 'center' }}>
            <div className="scan-flow-step">
              <div className={`scan-flow-node ${nodeClass}`}>
                {isDone ? <CheckCircle2 size={18} color="var(--indigo-l)" /> :
                  isActive ? <Loader2 size={18} className="spin" color="var(--green)" /> :
                    <Icon size={18} color="var(--text3)" />}
              </div>
              <div className="scan-flow-label" style={{
                color: isDone ? 'var(--indigo-l)' : isActive ? 'var(--green)' : 'var(--text3)'
              }}>
                {step.label}
              </div>
            </div>
            {i < scanFlowSteps.length - 1 && (
              <div className={`scan-flow-connector ${connectorClass}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const mockTerminalLines = [
  { prompt: '~', text: 'paia scan --target example.com --mode full', type: 'cmd' },
  { prompt: '', text: '[*] Initializing scan pipeline...', type: 'info' },
  { prompt: '', text: '[*] Phase 1: Passive reconnaissance', type: 'info' },
  { prompt: '', text: '[+] DNS Resolution: example.com → 93.184.216.34', type: 'success' },
  { prompt: '', text: '[+] WHOIS data retrieved — registrar: Cloudflare', type: 'success' },
  { prompt: '', text: '[*] Phase 2: Port scanning (top 1000 ports)', type: 'info' },
  { prompt: '', text: '[+] 22/tcp   open  ssh     OpenSSH 7.4', type: 'success' },
  { prompt: '', text: '[+] 80/tcp   open  http    Apache 2.4.49', type: 'success' },
  { prompt: '', text: '[+] 443/tcp  open  https   nginx/1.18', type: 'success' },
  { prompt: '', text: '[!] 3306/tcp open  mysql   MySQL 5.7.34', type: 'warning' },
  { prompt: '', text: '[*] Phase 3: Vulnerability analysis', type: 'info' },
  { prompt: '', text: '[!!] CRITICAL: CVE-2021-41773 found on port 80', type: 'critical' },
  { prompt: '', text: '[!] HIGH: MySQL exposed without authentication', type: 'warning' },
  { prompt: '', text: '[*] Phase 4: Generating report...', type: 'info' },
  { prompt: '', text: '[+] Scan complete — 4 findings, risk score: 78/100', type: 'success' },
];

const TerminalUI = () => {
  const [lines, setLines] = useState([]);
  const termRef = useRef(null);

  useEffect(() => {
    setLines([]);
    const timers = mockTerminalLines.map((line, i) =>
      setTimeout(() => {
        setLines(prev => [...prev, line]);
      }, (i + 1) * 350)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const colorMap = {
    cmd: 'var(--text)',
    info: 'var(--cyan)',
    success: 'var(--green)',
    warning: 'var(--amber)',
    critical: 'var(--red)',
  };

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-dot red" />
        <div className="terminal-dot yellow" />
        <div className="terminal-dot green" />
        <span className="terminal-title">paia-scan-engine — live output</span>
      </div>
      <div className="terminal-body" ref={termRef}>
        {lines.map((line, i) => (
          <div key={i} className="terminal-line" style={{ marginBottom: 2 }}>
            {line.prompt && <span className="terminal-prompt">{line.prompt} $</span>}
            <span style={{ color: colorMap[line.type] || 'var(--green)' }}>{line.text}</span>
          </div>
        ))}
        {lines.length < mockTerminalLines.length && (
          <div className="terminal-line">
            <span className="terminal-cursor" />
          </div>
        )}
      </div>
    </div>
  );
};

const Scans = () => {
  const [activePhase, setActivePhase] = useState('idle');

  // Simulate scan phase progression
  useEffect(() => {
    const phases = ['recon', 'scan', 'analyze', 'report'];
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < phases.length) {
        setActivePhase(phases[idx]);
        idx++;
      } else {
        clearInterval(timer);
      }
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Layout>
      <div className="page-header">
        <h2><ScanLine size={22} /> Scan Center</h2>
        <p>Run reconnaissance, network, and web vulnerability scans with real-time visual feedback</p>
      </div>

      {/* ── Scan Flow Visualizer ── */}
      <div className="dark-card" style={{ marginBottom: 14 }}>
        <div className="card-title"><Radio size={13} /> Scan Pipeline</div>
        <ScanFlowVisualizer activePhase={activePhase} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* ── Terminal UI ── */}
        <div className="dark-card">
          <div className="card-title"><Cpu size={13} /> Live Terminal Output</div>
          <TerminalUI />
        </div>

        {/* ── Scan Stats ── */}
        <div className="dark-card">
          <div className="card-title"><Shield size={13} /> Scan Intelligence</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.1)',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>LAST SCAN</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>example.com</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--green)' }}>78</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700 }}>RISK SCORE</div>
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.05)',
              border: '1px solid rgba(99,102,241,0.1)',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>TOTAL SCANS</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>24 scans completed</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--indigo-l)' }}>24</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700 }}>TOTAL</div>
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', borderRadius: 10, background: 'rgba(255,59,92,0.05)',
              border: '1px solid rgba(255,59,92,0.1)',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>CRITICAL FINDINGS</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>2 critical vulnerabilities</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--red)' }}>2</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700 }}>CRITICAL</div>
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', borderRadius: 10, background: 'rgba(6,182,212,0.05)',
              border: '1px solid rgba(6,182,212,0.1)',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>AVG SCAN TIME</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>3m 24s per target</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Clock size={20} color="var(--cyan)" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Existing Auto Recon Panel ── */}
      <AutoReconPanel />
    </Layout>
  );
};

export default Scans;
