import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  BrainCircuit, Play, Loader2, Square, Download, Trash2,
  CheckCircle2, AlertTriangle, Shield, ChevronDown, ChevronUp,
  Zap, Search, Globe, Clock, Activity, Cpu, Terminal, Eye,
  Skull, Briefcase, Wrench, GitBranch, Sparkles, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/layout';
import { startAIScan, getAIScanStatus, stopAIScan, getAIScanHistory, deleteAIScan } from '../api/aiAgent.api';

const SOCKET_URL = (() => {
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  return (process.env.REACT_APP_SOCKET_URL || apiBase).replace(/\/api\/?$/, '');
})();

const sevColor = s => ({ critical: '#ff3b5c', high: '#ff6b35', medium: '#ffb800', low: '#818cf8', info: '#64748b' }[s] || '#64748b');
const sevBg = s => ({ critical: 'rgba(255,59,92,0.1)', high: 'rgba(255,107,53,0.1)', medium: 'rgba(255,184,0,0.1)', low: 'rgba(129,140,248,0.1)', info: 'rgba(100,116,139,0.1)' }[s] || 'rgba(100,116,139,0.1)');

const ThinkingStep = ({ step, index, isLatest }) => {
  const [expanded, setExpanded] = useState(false);
  const statusIcon = step.action === 'generate_report'
    ? <CheckCircle2 size={12} />
    : isLatest ? <Loader2 size={12} className="spin" /> : <CheckCircle2 size={12} />;
  const statusClass = step.action === 'generate_report' ? 'done'
    : isLatest ? 'running' : 'done';

  return (
    <div className="ai-step">
      <div className={`ai-step-indicator ${statusClass}`}>{statusIcon}</div>
      <div className="ai-step-content">
        <div className="ai-step-title">
          Step {step.iteration}: {step.action === 'generate_report' ? 'Generating Report' : step.action}
          <span className={`sev-badge ${step.riskLevel}`} style={{ marginLeft: 8 }}>{step.riskLevel}</span>
        </div>
        <div className="ai-step-desc">{step.reasoning}</div>
        <div className="ai-step-time">Iteration {step.iteration} • {new Date(step.timestamp).toLocaleTimeString()}</div>
        {step.response && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', color: 'var(--indigo-l)', fontSize: 10, fontWeight: 700, cursor: 'pointer', marginTop: 4, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? 'Hide details' : 'View details'}
          </button>
        )}
        {expanded && step.response && (
          <div className="ai-step-detail">
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(step.response, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

const AIAgent = () => {
  const [targetInput, setTargetInput] = useState('');
  const [scope, setScope] = useState('full');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [scanId, setScanId] = useState('');
  const [decisions, setDecisions] = useState([]);
  const [history, setHistory] = useState([]);
  const [livePhase, setLivePhase] = useState('');
  const [liveIteration, setLiveIteration] = useState(0);
  const [expandedVuln, setExpandedVuln] = useState({});
  const [explainMode, setExplainMode] = useState(null);
  const [explainText, setExplainText] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);
  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const thinkingRef = useRef(null);

  const refreshHistory = async () => {
    try { setHistory(await getAIScanHistory()); } catch { /* */ }
  };

  useEffect(() => {
    refreshHistory();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [decisions]);

  const startPolling = (id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await getAIScanStatus(id);
        if (!s) return;
        setSession(s);
        setDecisions(s.aiDecisions || []);
        if (['completed', 'failed', 'stopped', 'partial'].includes(s.status)) {
          setLoading(false);
          clearInterval(pollRef.current);
          pollRef.current = null;
          refreshHistory();
        }
      } catch { /* */ }
    }, 3000);
  };

  const bindSocket = (id) => {
    if (socketRef.current) socketRef.current.disconnect();
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join_scan', id));
    socket.on('ai:started', (p) => { if (p.scanId) setLivePhase('Initializing AI Engine...'); });
    socket.on('ai:phase_update', (p) => { setLivePhase(`Phase: ${p.phase} — ${p.status}`); });
    socket.on('ai:thinking', (p) => { setLiveIteration(p.iteration); setLivePhase(`AI Reasoning... (iteration ${p.iteration}/${p.maxIterations})`); });
    socket.on('ai:decision', (p) => { setDecisions(prev => [...prev, p.decision]); });
    socket.on('ai:tool_running', (p) => { setLivePhase(`Executing: ${p.tool}`); });
    socket.on('ai:tool_complete', (p) => { setLivePhase(`Completed: ${p.tool}`); });
    socket.on('ai:completed', (p) => {
      setLoading(false);
      setLivePhase('✓ Scan Complete');
      toast.success(`AI Scan complete! Risk: ${p.riskScore}/100, Vulns: ${p.vulnerabilityCount}`);
      refreshHistory();
      getAIScanStatus(id).then(s => setSession(s)).catch(() => {});
    });
    socket.on('ai:failed', (p) => { setLoading(false); setLivePhase('✗ Failed'); toast.error(p.reason || 'AI scan failed'); });
  };

  const handleStart = async () => {
    const target = targetInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!target) { toast.error('Enter a target domain or IP'); return; }
    setLoading(true); setSession(null); setDecisions([]); setLivePhase('Queuing...'); setLiveIteration(0); setExplainMode(null); setExplainText('');
    try {
      const res = await startAIScan(target, scope);
      if (!res.scanId) throw new Error('No scanId received');
      setScanId(res.scanId);
      bindSocket(res.scanId);
      startPolling(res.scanId);
      toast.success('AI Agent initialized!');
    } catch (err) {
      setLoading(false); setLivePhase('Failed');
      toast.error(err?.response?.data?.message || err.message || 'Failed to start');
    }
  };

  const handleStop = async () => {
    if (!scanId) return;
    try { await stopAIScan(scanId); toast.success('Scan stopped'); setLoading(false); setLivePhase('Stopped'); }
    catch { toast.error('Failed to stop'); }
  };

  const handleDeleteHistory = async (id) => {
    if (!window.confirm('Delete this scan?')) return;
    try { await deleteAIScan(id); refreshHistory(); toast.success('Deleted'); } catch { toast.error('Failed to delete'); }
  };

  const downloadReport = () => {
    if (!session) return;
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `paia-report-${session.target}-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExplain = async (mode) => {
    if (!session) return;
    setExplainMode(mode); setExplainLoading(true); setExplainText('');
    // Simulated AI explanation — in production this calls backend
    const explanations = {
      hacker: `[TECHNICAL ANALYSIS]\n\nTarget: ${session.target}\nAttack Surface: ${session.vulnerabilities?.length || 0} vectors identified\n\n${session.vulnerabilities?.map((v, i) =>
        `${i + 1}. ${v.title} [${v.severity?.toUpperCase()}]\n   CVSS: ${v.cvss || 'N/A'}\n   Vector: ${v.tool || 'AI Analysis'}\n   Exploit: ${v.description || 'Manual verification needed'}\n   Remediation: ${v.remediation || 'Patch immediately'}`
      ).join('\n\n') || 'No vulnerabilities found.'}\n\n[EXPLOIT CHAIN]\n→ Recon → Port Discovery → Service Enumeration → Vulnerability Mapping → Exploitation Path`,
      manager: `EXECUTIVE SECURITY BRIEFING\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nTarget: ${session.target}\nRisk Level: ${session.report?.overallRiskLevel?.toUpperCase() || 'MODERATE'}\nRisk Score: ${session.report?.riskScore || 0}/100\n\nBusiness Impact:\n• ${session.vulnerabilities?.filter(v => v.severity === 'critical').length || 0} CRITICAL issues require immediate attention\n• Estimated remediation time: 2-5 business days\n• Potential data breach cost: $2.4M - $4.1M (industry average)\n\nRecommended Actions:\n1. Patch all critical vulnerabilities within 24 hours\n2. Implement WAF rules for detected attack vectors\n3. Schedule penetration re-test after remediation\n4. Update security policies for affected services`,
      exploit: `ATTACK CHAIN ANALYSIS\n━━━━━━━━━━━━━━━━━━━━\n\n[Phase 1: Reconnaissance]\n→ DNS enumeration reveals infrastructure layout\n→ Open ports provide attack surface mapping\n\n[Phase 2: Initial Access]\n→ ${session.vulnerabilities?.[0]?.title || 'Service vulnerability'} provides entry point\n→ CVSS: ${session.vulnerabilities?.[0]?.cvss || 'N/A'}\n\n[Phase 3: Privilege Escalation]\n→ Service misconfigurations enable lateral movement\n→ Database exposure allows data extraction\n\n[Phase 4: Impact]\n→ Full system compromise possible\n→ Data exfiltration risk: HIGH\n→ Persistence mechanism available via SSH`,
      fixes: `REMEDIATION PRIORITY LIST\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${session.vulnerabilities?.map((v, i) =>
        `[P${i + 1}] ${v.title}\n    Severity: ${v.severity?.toUpperCase()}\n    Fix: ${v.remediation || 'Apply security patch'}\n    Timeline: ${v.severity === 'critical' ? '24 hours' : v.severity === 'high' ? '72 hours' : '1 week'}`
      ).join('\n\n') || 'No vulnerabilities to remediate.'}\n\nGENERAL RECOMMENDATIONS:\n• Enable automated security scanning (weekly)\n• Implement Web Application Firewall (WAF)\n• Enforce TLS 1.3 across all endpoints\n• Regular dependency updates and patch management`,
    };

    // Simulate typing effect
    const fullText = explanations[mode] || 'No data available.';
    let index = 0;
    const typeInterval = setInterval(() => {
      index += Math.floor(Math.random() * 3) + 2;
      if (index >= fullText.length) {
        setExplainText(fullText);
        setExplainLoading(false);
        clearInterval(typeInterval);
      } else {
        setExplainText(fullText.slice(0, index));
      }
    }, 15);
  };

  const vulns = session?.vulnerabilities || [];
  const report = session?.report || {};

  return (
    <Layout>
      <div className="page-header">
        <h2><BrainCircuit size={22} /> AI Agent</h2>
        <p>Autonomous penetration testing with multi-layer AI reasoning engine</p>
      </div>

      {/* ── Scan Control Panel ── */}
      <div className="dark-card" style={{ marginBottom: 14 }}>
        <div className="card-title"><Zap size={13} /> Launch AI Scan</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="Enter target: example.com or 8.8.8.8"
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            style={{
              flex: 1, minWidth: 240, background: 'var(--field-bg)',
              border: '1px solid var(--border2)', color: 'var(--text)',
              padding: '11px 14px', borderRadius: 10, fontSize: 13,
              outline: 'none', fontFamily: 'Inter, sans-serif',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--indigo-l)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.boxShadow = 'none'; }}
          />
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            style={{
              minWidth: 130, background: 'var(--field-bg)', border: '1px solid var(--border2)',
              color: 'var(--text)', padding: '11px 12px', borderRadius: 10, fontSize: 12, outline: 'none',
            }}
          >
            <option value="full">🔥 Full Scan</option>
            <option value="recon-only">🔍 Recon Only</option>
            <option value="web">🌐 Web Only</option>
            <option value="network">📡 Network Only</option>
          </select>
          <button
            onClick={handleStart}
            disabled={loading}
            style={{
              border: 'none', borderRadius: 10, padding: '11px 20px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 12, fontWeight: 800, opacity: loading ? 0.6 : 1,
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
              transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
            }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
            {loading ? 'Running...' : 'Start AI Scan'}
          </button>
          {loading && (
            <button
              onClick={handleStop}
              style={{
                border: '1px solid var(--red)', borderRadius: 10, padding: '11px 14px',
                background: 'transparent', color: 'var(--red)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'Inter, sans-serif',
              }}
            >
              <Square size={12} /> Stop
            </button>
          )}
        </div>
        {livePhase && (
          <div style={{
            fontSize: 12, color: 'var(--indigo-l)', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.1)',
          }}>
            {loading ? <Loader2 size={12} className="spin" /> : <Activity size={12} />}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{livePhase}</span>
          </div>
        )}
      </div>

      {/* ── AI Thinking Panel ── */}
      {decisions.length > 0 && (
        <div className="ai-thinking-panel" style={{ marginBottom: 14 }}>
          <div className="ai-thinking-header">
            <div className="ai-thinking-title">
              <BrainCircuit size={14} />
              AI Reasoning Engine
              {loading && <Loader2 size={12} className="spin" style={{ marginLeft: 8 }} />}
            </div>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono'" }}>
              {decisions.length} decisions • iteration {liveIteration}
            </span>
          </div>
          <div className="ai-thinking-body" ref={thinkingRef}>
            {decisions.map((d, i) => (
              <ThinkingStep key={i} step={d} index={i} isLatest={i === decisions.length - 1 && loading} />
            ))}
          </div>
        </div>
      )}

      {/* ── AI Action Buttons ── */}
      {session && !loading && (
        <div className="dark-card" style={{ marginBottom: 14 }}>
          <div className="card-title"><Sparkles size={13} /> AI Intelligence Actions</div>
          <div className="ai-actions">
            <button className="ai-action-btn hacker" onClick={() => handleExplain('hacker')}>
              <Skull size={14} /> Explain like Hacker
            </button>
            <button className="ai-action-btn manager" onClick={() => handleExplain('manager')}>
              <Briefcase size={14} /> Explain like Manager
            </button>
            <button className="ai-action-btn exploit" onClick={() => handleExplain('exploit')}>
              <GitBranch size={14} /> Generate Exploit Chain
            </button>
            <button className="ai-action-btn fix" onClick={() => handleExplain('fixes')}>
              <Wrench size={14} /> Suggest Fixes
            </button>
          </div>

          {(explainMode || explainLoading) && (
            <div className="terminal" style={{ marginTop: 14 }}>
              <div className="terminal-header">
                <div className="terminal-dot red" /><div className="terminal-dot yellow" /><div className="terminal-dot green" />
                <span className="terminal-title">
                  paia-ai — {explainMode === 'hacker' ? 'Technical Analysis' : explainMode === 'manager' ? 'Executive Brief' : explainMode === 'exploit' ? 'Attack Chain' : 'Remediation Plan'}
                </span>
              </div>
              <div className="terminal-body" style={{ minHeight: 120 }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: explainMode === 'hacker' ? 'var(--green)' : explainMode === 'exploit' ? 'var(--red)' : explainMode === 'manager' ? 'var(--cyan)' : 'var(--purple)' }}>
                  {explainText}
                  {explainLoading && <span className="terminal-cursor" />}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Vulnerabilities ── */}
      {vulns.length > 0 && (
        <div className="dark-card" style={{ marginBottom: 14 }}>
          <div className="card-title"><AlertTriangle size={13} /> Vulnerabilities ({vulns.length})</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {vulns.map((v, i) => (
              <div key={v._id || i} style={{
                border: `1px solid ${sevColor(v.severity)}25`,
                borderRadius: 10, padding: 12, background: sevBg(v.severity),
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`sev-badge ${v.severity}`}>{v.severity}</span>
                    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{v.title}</span>
                    {v.cvss > 0 && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono'" }}>CVSS: {v.cvss}</span>}
                  </div>
                  <button onClick={() => setExpandedVuln(p => ({ ...p, [i]: !p[i] }))} style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer' }}>
                    {expandedVuln[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {expandedVuln[i] && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
                    {v.description && <div style={{ marginBottom: 4 }}><strong>Description:</strong> {v.description}</div>}
                    {v.evidence && <div style={{ marginBottom: 4 }}><strong>Evidence:</strong> {v.evidence}</div>}
                    {v.remediation && <div style={{ marginBottom: 4, color: 'var(--green)' }}><strong>Fix:</strong> {v.remediation}</div>}
                    {v.cveId && <div><strong>CVE:</strong> {v.cveId}</div>}
                    {v.tool && <div><strong>Found by:</strong> {v.tool}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Report Summary ── */}
      {report.executiveSummary && (
        <div className="dark-card" style={{ marginBottom: 14 }}>
          <div className="card-title"><Shield size={13} /> Report Summary</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', padding: '14px 22px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--indigo-l)' }}>{report.riskScore || 0}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Risk Score</div>
            </div>
            {['critical', 'high', 'medium', 'low'].map(sev => {
              const count = vulns.filter(v => v.severity === sev).length;
              if (count === 0) return null;
              return (
                <div key={sev} style={{ textAlign: 'center', padding: '14px 18px', borderRadius: 12, background: `${sevColor(sev)}10`, border: `1px solid ${sevColor(sev)}20` }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: sevColor(sev) }}>{count}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{sev}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 14 }}>{report.executiveSummary}</div>
          <button onClick={downloadReport} style={{
            border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 14px',
            background: 'transparent', color: 'var(--text2)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'inherit',
          }}>
            <Download size={13} /> Download Full Report
          </button>
        </div>
      )}

      {/* ── Scan History ── */}
      {history.length > 0 && (
        <div className="dark-card">
          <div className="card-title"><Clock size={13} /> Scan History ({history.length})</div>
          {history.map((h) => (
            <div key={h._id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Globe size={12} color="var(--text3)" />
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{h.target}</span>
                <span className={`sev-badge ${h.status === 'completed' ? 'low' : 'critical'}`}>{h.status}</span>
                {h.report?.riskScore > 0 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>Score: {h.report.riskScore}</span>}
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{h.vulnerabilities?.length || 0} vulns</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => {
                    getAIScanStatus(h._id).then(s => { setSession(s); setDecisions(s?.aiDecisions || []); setScanId(h._id); setExplainMode(null); setExplainText(''); }).catch(() => {});
                  }}
                  style={{
                    border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 10px',
                    background: 'transparent', color: 'var(--indigo-l)', cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  View
                </button>
                <button
                  onClick={() => handleDeleteHistory(h._id)}
                  style={{
                    border: '1px solid var(--border2)', borderRadius: 6, padding: 4,
                    background: 'transparent', color: 'var(--red)', cursor: 'pointer', display: 'inline-flex',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default AIAgent;
