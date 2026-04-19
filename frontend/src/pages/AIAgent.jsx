import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  BrainCircuit, Play, Loader2, Square, Download, Trash2,
  CheckCircle2, AlertTriangle, Shield, ChevronDown, ChevronUp,
  Zap, Globe, Clock, Activity,
  Skull, Briefcase, Wrench, GitBranch, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../components/layout';
import {
  startAIScan, getAIScanStatus, stopAIScan,
  getAIScanHistory, deleteAIScan, explainAIScan, downloadReportPdf
} from '../api/aiAgent.api';

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
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="ai-step"
    >
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
    </motion.div>
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
  const [explainData, setExplainData] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainText, setExplainText] = useState('');
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
    setLoading(true); setSession(null); setDecisions([]); setLivePhase('Queuing...'); setLiveIteration(0); setExplainMode(null); setExplainData(null); setExplainText('');
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

  const downloadReport = async () => {
    if (!session?._id) return;
    try {
      toast.success('Preparing PDF Document...', { icon: '📄' });
      await downloadReportPdf(session._id);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  /* ── REAL AI EXPLAIN via Gemini ── */
  const handleExplain = async (mode) => {
    if (!session || !session._id) {
      toast.error('No scan session to explain');
      return;
    }

    setExplainMode(mode);
    setExplainLoading(true);
    setExplainData(null);
    setExplainText('');

    try {
      const result = await explainAIScan(session._id, mode);
      const explanation = result.explanation;

      if (!explanation || !explanation.content) {
        throw new Error('Empty response from AI');
      }

      setExplainData(explanation);

      // Typing effect for the content
      const fullText = explanation.content || '';
      let index = 0;
      const typeInterval = setInterval(() => {
        index += Math.floor(Math.random() * 4) + 3;
        if (index >= fullText.length) {
          setExplainText(fullText);
          setExplainLoading(false);
          clearInterval(typeInterval);
        } else {
          setExplainText(fullText.slice(0, index));
        }
      }, 12);
    } catch (err) {
      setExplainLoading(false);
      setExplainText(`Error: ${err?.response?.data?.message || err.message || 'Failed to get AI explanation'}`);
      toast.error('AI explain failed — check Gemini API key');
    }
  };

  const vulns = session?.vulnerabilities || [];
  const report = session?.report || {};

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="page-header">
        <h2><BrainCircuit size={22} /> <span className="holographic-text">AI Agent</span></h2>
        <p>Autonomous penetration testing with multi-layer AI reasoning engine</p>
      </motion.div>

      {/* ── Scan Control Panel ── */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="dark-card" style={{ marginBottom: 14 }}
      >
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
      </motion.div>

      {/* ── AI Thinking Panel ── */}
      <AnimatePresence>
        {decisions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ai-thinking-panel" style={{ marginBottom: 14, overflow: 'hidden' }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Intelligence Actions (REAL Gemini calls) ── */}
      <AnimatePresence>
        {session && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="dark-card" style={{ marginBottom: 14 }}
          >
            <div className="card-title"><Sparkles size={13} /> AI Intelligence Actions</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>
            Powered by Google Gemini — Real-time AI analysis of your scan results
          </div>
          <div className="ai-actions">
            <button className="ai-action-btn hacker" onClick={() => handleExplain('hacker')} disabled={explainLoading}>
              <Skull size={14} /> Explain like Hacker
            </button>
            <button className="ai-action-btn manager" onClick={() => handleExplain('manager')} disabled={explainLoading}>
              <Briefcase size={14} /> Explain like Manager
            </button>
            <button className="ai-action-btn exploit" onClick={() => handleExplain('exploit')} disabled={explainLoading}>
              <GitBranch size={14} /> Generate Exploit Chain
            </button>
            <button className="ai-action-btn fix" onClick={() => handleExplain('fixes')} disabled={explainLoading}>
              <Wrench size={14} /> Suggest Fixes
            </button>
          </div>

          {(explainMode || explainLoading) && (
            <div className="terminal" style={{ marginTop: 14 }}>
              <div className="terminal-header">
                <div className="terminal-dot red" /><div className="terminal-dot yellow" /><div className="terminal-dot green" />
                <span className="terminal-title">
                  paia-ai ({explainLoading ? 'analyzing...' : 'complete'}) — {explainMode === 'hacker' ? 'Technical Analysis' : explainMode === 'manager' ? 'Executive Brief' : explainMode === 'exploit' ? 'Attack Chain' : 'Remediation Plan'}
                </span>
                {explainLoading && <Loader2 size={10} className="spin" style={{ marginLeft: 'auto', color: '#10b981' }} />}
              </div>
              <div className="terminal-body" style={{ minHeight: 120, maxHeight: 400, overflowY: 'auto' }}>
                {/* Highlights bar */}
                {explainData?.highlights && !explainLoading && (
                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12,
                    padding: '8px 10px', background: 'rgba(99,102,241,0.06)', borderRadius: 6,
                    border: '1px solid rgba(99,102,241,0.1)',
                  }}>
                    {explainData.highlights.map((h, i) => (
                      <span key={i} style={{
                        fontSize: 10, color: 'var(--indigo-l)', fontWeight: 600,
                        padding: '3px 8px', background: 'rgba(99,102,241,0.1)',
                        borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                {/* Risk verdict */}
                {explainData?.riskVerdict && !explainLoading && (
                  <div style={{
                    fontSize: 11, color: 'var(--red)', fontWeight: 700, marginBottom: 10,
                    padding: '6px 10px', background: 'rgba(255,59,92,0.06)', borderRadius: 6,
                    border: '1px solid rgba(255,59,92,0.12)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    ⚡ {explainData.riskVerdict}
                  </div>
                )}

                {/* Analysis content */}
                <pre style={{
                  margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  color: explainMode === 'hacker' ? 'var(--green)' : explainMode === 'exploit' ? 'var(--red)' : explainMode === 'manager' ? 'var(--cyan)' : 'var(--purple)',
                  fontSize: 11, lineHeight: 1.7,
                }}>
                  {explainText}
                  {explainLoading && <span className="terminal-cursor" />}
                </pre>
              </div>
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Vulnerabilities ── */}
      {vulns.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="dark-card" style={{ marginBottom: 14 }}
        >
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
                    {v.exploitAvailable && (
                      <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        ⚠ EXPLOIT AVAILABLE
                      </span>
                    )}
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
                    {v.cveId && <div style={{ marginBottom: 4 }}><strong>CVE:</strong> {v.cveId}</div>}
                    {v.tool && <div style={{ marginBottom: 4 }}><strong>Found by:</strong> {v.tool}</div>}
                    {v.mitreMapping && v.mitreMapping.length > 0 && (
                      <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)' }}>
                        <strong style={{ color: 'var(--indigo-l)', fontSize: 10 }}>MITRE ATT&CK:</strong>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {v.mitreMapping.map((m, mi) => (
                            <span key={mi} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--indigo-l)', fontWeight: 600, fontFamily: "'JetBrains Mono'" }}>
                              {m.tacticName} / {m.techniqueId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Report Summary with MITRE + Risk Breakdown ── */}
      {report.executiveSummary && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="dark-card" style={{ marginBottom: 14 }}
        >
          <div className="card-title"><Shield size={13} /> Report Summary</div>

          {/* Risk Score + Severity Cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{
              textAlign: 'center', padding: '14px 22px', borderRadius: 12,
              background: (report.riskScore || 0) >= 60 ? 'rgba(239,68,68,0.08)' : (report.riskScore || 0) >= 35 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
              border: `1px solid ${(report.riskScore || 0) >= 60 ? 'rgba(239,68,68,0.2)' : (report.riskScore || 0) >= 35 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
            }}>
              <div style={{
                fontSize: 28, fontWeight: 900, lineHeight: 1,
                color: (report.riskScore || 0) >= 60 ? '#ef4444' : (report.riskScore || 0) >= 35 ? '#f59e0b' : '#10b981',
              }}>{report.riskScore || 0}</div>
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

          {/* Risk Breakdown (NVD/Vulners based) */}
          {session?.report?.riskBreakdown?.breakdown && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Risk Score Breakdown (NVD + Vulners)</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Vuln Severity', value: session.report.riskBreakdown.breakdown.vulnScore || 0, max: 40, color: '#ef4444' },
                  { label: 'Exploit Avail.', value: session.report.riskBreakdown.breakdown.exploitScore || 0, max: 30, color: '#f59e0b' },
                  { label: 'Exposure', value: session.report.riskBreakdown.breakdown.exposureScore || 0, max: 30, color: '#6366f1' },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>
                      <span>{item.label}</span>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 700 }}>{item.value}/{item.max}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: item.color, width: `${(item.value / item.max) * 100}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
              {session.report.riskBreakdown.explanation && (
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5 }}>
                  {session.report.riskBreakdown.explanation}
                </div>
              )}
            </div>
          )}

          {/* Executive Summary */}
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 14 }}>{report.executiveSummary}</div>

          {/* MITRE ATT&CK Kill Chain */}
          {session?.report?.mitreAttackMapping?.chain?.length > 0 && (
            <div style={{
              padding: '12px 14px', borderRadius: 10, marginBottom: 14,
              background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎯 MITRE ATT&CK Kill Chain ({session.report.mitreAttackMapping.coveragePercent || 0}% coverage)
              </div>
              <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                {session.report.mitreAttackMapping.chain.map((tactic, ti) => (
                  <div key={ti} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      padding: '6px 10px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                      background: ti === 0 ? 'rgba(99,102,241,0.12)' : ti === session.report.mitreAttackMapping.chain.length - 1 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
                      color: ti === 0 ? 'var(--indigo-l)' : ti === session.report.mitreAttackMapping.chain.length - 1 ? 'var(--red)' : 'var(--amber)',
                      border: `1px solid ${ti === 0 ? 'rgba(99,102,241,0.2)' : ti === session.report.mitreAttackMapping.chain.length - 1 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {tactic.name}
                      <span style={{ opacity: 0.6, marginLeft: 4 }}>({tactic.techniques?.length || 0})</span>
                    </div>
                    {ti < session.report.mitreAttackMapping.chain.length - 1 && (
                      <span style={{ color: 'var(--text3)', margin: '0 2px', fontSize: 12 }}>→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Recommendations:</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {report.recommendations.map((r, i) => (
                  <li key={i} style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3, lineHeight: 1.5 }}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={downloadReport} style={{
            border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 14px',
            background: 'transparent', color: 'var(--text2)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'inherit',
          }}>
            <Download size={13} /> Download Full Report (PDF)
          </button>
        </motion.div>
      )}

      {/* ── Scan History ── */}
      {history.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="dark-card"
        >
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
                    getAIScanStatus(h._id).then(s => { setSession(s); setDecisions(s?.aiDecisions || []); setScanId(h._id); setExplainMode(null); setExplainData(null); setExplainText(''); }).catch(() => {});
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
        </motion.div>
      )}
    </Layout>
  );
};

export default AIAgent;
