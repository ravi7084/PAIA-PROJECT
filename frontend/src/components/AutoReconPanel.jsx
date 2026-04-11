import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Radar,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  validateTargetInput,
  createTargetAuto,
  runReconAuto,
  listRecentRecon,
  getReconScanById,
  deleteReconScanById
} from '../api/recon.api';

const box = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 12,
  padding: 16
};

const inputSt = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border2)',
  color: 'var(--text)',
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none'
};

const toolColor = (status) => {
  if (status === 'success') return 'var(--green)';
  if (status === 'running') return 'var(--indigo-l)';
  if (status === 'failed') return 'var(--red)';
  if (status === 'queued') return 'var(--text2)';
  return 'var(--amber)';
};

const chipStyles = (status) => {
  if (status === 'success') return { color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.12)' };
  if (status === 'running') return { color: 'var(--indigo-l)', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.12)' };
  if (status === 'failed') return { color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.12)' };
  if (status === 'queued') return { color: 'var(--text2)', border: '1px solid rgba(148,144,181,0.3)', background: 'rgba(148,144,181,0.12)' };
  return { color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.12)' };
};

const verdictColor = (level) => {
  if (level === 'high') return 'var(--red)';
  if (level === 'medium') return 'var(--amber)';
  if (level === 'low') return 'var(--indigo-l)';
  return 'var(--green)';
};

const SOCKET_URL = (() => {
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  return (process.env.REACT_APP_SOCKET_URL || apiBase).replace(/\/api\/?$/, '');
})();

const TOOL_SETS = {
  recon: ['theharvester', 'reconng', 'spiderfoot', 'maltego'],
  subdomain: ['subfinder', 'amass'],
  network: ['nmap', 'nessus'],
  webapp: ['nikto', 'zap']
};

const PHASE_LABELS = {
  recon: 'Reconnaissance (OSINT)',
  subdomain: 'Subdomain & DNS',
  network: 'Network Scanning',
  webapp: 'Web App Vulnerability'
};

const AutoReconPanel = () => {
  const [targetInput, setTargetInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState('recon');
  const [stage, setStage] = useState('');
  const [latest, setLatest] = useState(null);
  const [recent, setRecent] = useState([]);
  const [scanId, setScanId] = useState('');
  const [liveToolStatus, setLiveToolStatus] = useState({});
  const [expanded, setExpanded] = useState({});
  const [deletingScanId, setDeletingScanId] = useState('');
  const socketRef = useRef(null);
  const pollRef = useRef(null);

  const refreshRecent = async () => {
    try {
      const scans = await listRecentRecon();
      setRecent(scans.slice(0, 20));
    } catch {
      setRecent([]);
    }
  };

  const stopPolling = () => {
    if (!pollRef.current) return;
    clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const disconnectSocket = () => {
    if (!socketRef.current) return;
    socketRef.current.disconnect();
    socketRef.current = null;
  };

  const resetLiveState = (tools) => {
    const mapped = {};
    tools.forEach((t) => {
      mapped[t] = 'queued';
    });
    setLiveToolStatus(mapped);
  };

  const syncFromScan = (scan) => {
    if (!scan) return;
    if (scan.phase) setSelectedPhase(scan.phase);
    const mapped = {};
    (scan.toolsRequested || []).forEach((tool) => {
      mapped[tool] = 'queued';
    });
    (scan.toolResults || []).forEach((r) => {
      mapped[r.tool] = r.status;
    });
    setLiveToolStatus(mapped);
    setLatest(scan);
  };

  const startPolling = (id) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const scan = await getReconScanById(id);
        if (!scan) return;
        syncFromScan(scan);
        if (['completed', 'partial', 'failed'].includes(scan.status)) {
          setLoading(false);
          setStage(`Completed (${scan.status})`);
          stopPolling();
        }
      } catch {
        // keep polling as fallback
      }
    }, 4000);
  };

  const bindSocket = (id) => {
    disconnectSocket();
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_scan', id);
    });

    socket.on('recon:started', (payload) => {
      if (payload?.scanId !== id) return;
      setStage(
        payload?.phase === 'network'
          ? 'Running network scan...'
          : payload?.phase === 'subdomain'
            ? 'Running subdomain and DNS scan...'
            : payload?.phase === 'webapp'
              ? 'Running web application vulnerability scan...'
              : 'Running reconnaissance...'
      );
      resetLiveState(payload.toolsRequested || TOOL_SETS[payload?.phase || selectedPhase] || TOOL_SETS.recon);
    });

    socket.on('recon:tool_update', (payload) => {
      if (payload?.scanId !== id) return;
      setLiveToolStatus((prev) => ({ ...prev, [payload.tool]: payload.status }));
      if (payload?.result) {
        setLatest((prev) => {
          if (!prev) return prev;
          const existing = Array.isArray(prev.toolResults) ? [...prev.toolResults] : [];
          const idx = existing.findIndex((t) => t.tool === payload.tool);
          if (idx >= 0) existing[idx] = payload.result;
          else existing.push(payload.result);
          return { ...prev, toolResults: existing };
        });
      }
    });

    socket.on('recon:completed', (payload) => {
      if (payload?.scanId !== id) return;
      if (payload?.scan) syncFromScan(payload.scan);
      setStage(`Completed (${payload?.status || 'completed'})`);
      setLoading(false);
      toast.success('Recon completed');
      refreshRecent();
      stopPolling();
    });

    socket.on('recon:failed', (payload) => {
      if (payload?.scanId !== id) return;
      setLoading(false);
      setStage('Failed');
      toast.error(payload?.reason || 'Recon failed');
      stopPolling();
    });
  };

  useEffect(() => {
    refreshRecent();
    return () => {
      stopPolling();
      disconnectSocket();
    };
  }, []);

  const startAutoRecon = async (specificTools) => {
    const v = validateTargetInput(targetInput);
    if (!v.ok) {
      toast.error(v.message);
      return;
    }

    const baseTools = TOOL_SETS[selectedPhase] || TOOL_SETS.recon;
    const toolsToRun = Array.isArray(specificTools) && specificTools.length ? specificTools : baseTools;

    setLoading(true);
    setStage('Creating target...');
    setLatest({
      target: v.target,
      phase: selectedPhase,
      status: 'queued',
      toolResults: [],
      toolsRequested: toolsToRun
    });
    resetLiveState(toolsToRun);

    try {
      const created = await createTargetAuto(v.target);
      if (!created.success) {
        toast.error(created.message);
      }

      setStage('Queued...');
      const queued = await runReconAuto(v.target, toolsToRun, selectedPhase);
      if (!queued?.scanId) throw new Error('No scanId received');

      setScanId(queued.scanId);
      bindSocket(queued.scanId);
      startPolling(queued.scanId);
    } catch (err) {
      setLoading(false);
      setStage('Failed');
      toast.error(err?.response?.data?.message || err.message || 'Recon failed');
    }
  };

  const retryFailed = async () => {
    const failedTools = (latest?.toolResults || [])
      .filter((t) => t.status === 'failed')
      .map((t) => t.tool);
    if (!failedTools.length) {
      toast('No failed tools to retry');
      return;
    }
    await startAutoRecon(failedTools);
  };

  const downloadJson = () => {
    if (!latest) return;
    const dataStr = JSON.stringify(latest, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recon-${latest.target || 'scan'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteRecent = async (id) => {
    if (!id) return;
    if (!window.confirm('Delete this scan from recent runs?')) return;

    try {
      setDeletingScanId(id);
      await deleteReconScanById(id);
      if (latest?._id === id) {
        setLatest(null);
        setLiveToolStatus({});
      }
      await refreshRecent();
      toast.success('Scan deleted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete scan');
    } finally {
      setDeletingScanId('');
    }
  };

  const failedCount = useMemo(
    () => (latest?.toolResults || []).filter((t) => t.status === 'failed').length,
    [latest]
  );

  const filteredRecent = useMemo(() => {
    return recent
      .filter((scan) => (scan?.phase || 'recon') === selectedPhase)
      .slice(0, 8);
  }, [recent, selectedPhase]);

  return (
    <div style={box}>
      <div className="card-title" style={{ marginBottom: 10 }}>
        <Radar size={13} />
        Scan Center (Target Only)
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedPhase('recon')}
          disabled={loading}
          style={{
            border: selectedPhase === 'recon' ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border2)',
            borderRadius: 8,
            padding: '7px 12px',
            background: selectedPhase === 'recon' ? 'rgba(99,102,241,0.16)' : 'transparent',
            color: selectedPhase === 'recon' ? 'var(--indigo-l)' : 'var(--text2)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          Recon
        </button>
        <button
          onClick={() => setSelectedPhase('subdomain')}
          disabled={loading}
          style={{
            border: selectedPhase === 'subdomain' ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border2)',
            borderRadius: 8,
            padding: '7px 12px',
            background: selectedPhase === 'subdomain' ? 'rgba(99,102,241,0.16)' : 'transparent',
            color: selectedPhase === 'subdomain' ? 'var(--indigo-l)' : 'var(--text2)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          Subdomain/DNS
        </button>
        <button
          onClick={() => setSelectedPhase('network')}
          disabled={loading}
          style={{
            border: selectedPhase === 'network' ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border2)',
            borderRadius: 8,
            padding: '7px 12px',
            background: selectedPhase === 'network' ? 'rgba(99,102,241,0.16)' : 'transparent',
            color: selectedPhase === 'network' ? 'var(--indigo-l)' : 'var(--text2)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          Network Scan
        </button>
        <button
          onClick={() => setSelectedPhase('webapp')}
          disabled={loading}
          style={{
            border: selectedPhase === 'webapp' ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border2)',
            borderRadius: 8,
            padding: '7px 12px',
            background: selectedPhase === 'webapp' ? 'rgba(99,102,241,0.16)' : 'transparent',
            color: selectedPhase === 'webapp' ? 'var(--indigo-l)' : 'var(--text2)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          Web App Vuln
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          placeholder="Enter target: example.com"
          style={{ ...inputSt, flex: 1, minWidth: 220 }}
          onKeyDown={(e) => e.key === 'Enter' && startAutoRecon()}
        />
        <button
          onClick={() => startAutoRecon()}
          disabled={loading}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            background: 'var(--indigo)',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? <Loader2 size={14} /> : <Play size={13} />}
          {loading ? 'Running...' : selectedPhase === 'network' ? 'Start Network Scan' : selectedPhase === 'subdomain' ? 'Start Subdomain Scan' : selectedPhase === 'webapp' ? 'Start Web Scan' : 'Start Recon'}
        </button>
        <button
          onClick={retryFailed}
          disabled={loading || failedCount === 0}
          style={{
            border: '1px solid var(--border2)',
            borderRadius: 8,
            padding: '10px 12px',
            background: 'transparent',
            color: 'var(--text2)',
            cursor: loading || failedCount === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12
          }}
        >
          <RefreshCw size={13} />
          Retry Failed
        </button>
        <button
          onClick={downloadJson}
          disabled={!latest}
          style={{
            border: '1px solid var(--border2)',
            borderRadius: 8,
            padding: '10px 12px',
            background: 'transparent',
            color: 'var(--text2)',
            cursor: latest ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12
          }}
        >
          <Download size={13} />
          Download JSON
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
        Enter target only. Current phase: {selectedPhase === 'network' ? 'Network Scan (Nmap/Nessus)' : selectedPhase === 'subdomain' ? 'Subdomain Enumeration & DNS Analysis' : selectedPhase === 'webapp' ? 'Web Application Vulnerability Scanning (Nikto/ZAP)' : 'Recon (OSINT tools)'}.
      </div>

      {stage && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
          Status: {stage} {scanId ? `(scanId: ${scanId})` : ''}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {Object.keys(liveToolStatus).map((tool) => {
          const chip = chipStyles(liveToolStatus[tool]);
          return (
          <span
            key={tool}
            style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 999,
              border: chip.border,
              color: chip.color,
              background: chip.background
            }}
          >
            {tool}: {liveToolStatus[tool]}
          </span>
          );
        })}
      </div>

      {latest && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
            Latest: <strong style={{ color: 'var(--text)' }}>{latest.target}</strong> ({latest.status}) [{latest.phase || selectedPhase}]
          </div>
          <div
            style={{
              marginBottom: 10,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${verdictColor(latest?.verdict?.level)}40`,
              background: `${verdictColor(latest?.verdict?.level)}12`
            }}
          >
            <div style={{ fontSize: 11, color: verdictColor(latest?.verdict?.level), fontWeight: 700 }}>
              Verdict: {(latest?.verdict?.level || 'none').toUpperCase()} ({latest?.verdict?.score || 0}/100)
            </div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
              {latest?.verdict?.label || 'No actionable findings'}
            </div>
          </div>

          {(latest?.findings || []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Normalized Findings</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {latest.findings.slice(0, 10).map((f, idx) => (
                  <span
                    key={`${f.type}-${f.value}-${f.source}-${idx}`}
                    style={{
                      fontSize: 10,
                      padding: '3px 7px',
                      borderRadius: 999,
                      border: '1px solid var(--border2)',
                      color: 'var(--text2)',
                      background: 'rgba(255,255,255,0.03)'
                    }}
                    title={`source=${f.source}, severity=${f.severity}, confidence=${f.confidence}`}
                  >
                    {f.type}:{f.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(latest?.summary?.network?.openPorts?.length > 0 || latest?.summary?.network?.services?.length > 0 || latest?.summary?.network?.vulnerabilities?.length > 0) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Network Summary</div>
              <div style={{ fontSize: 10, color: 'var(--text2)' }}>
                <div>Open Ports: {(latest.summary.network.openPorts || []).slice(0, 15).join(', ') || '-'}</div>
                <div style={{ marginTop: 4 }}>Services: {(latest.summary.network.services || []).slice(0, 15).join(', ') || '-'}</div>
                <div style={{ marginTop: 4 }}>Vulnerabilities: {(latest.summary.network.vulnerabilities || []).slice(0, 10).join(', ') || '-'}</div>
              </div>
            </div>
          )}

          {(latest?.summary?.webapp?.urls?.length > 0 || latest?.summary?.webapp?.vulnerabilities?.length > 0 || latest?.summary?.webapp?.owaspTop10?.length > 0) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Web App Summary</div>
              <div style={{ fontSize: 10, color: 'var(--text2)' }}>
                <div>URLs: {(latest.summary.webapp.urls || []).slice(0, 10).join(', ') || '-'}</div>
                <div style={{ marginTop: 4 }}>OWASP: {(latest.summary.webapp.owaspTop10 || []).slice(0, 6).join(', ') || '-'}</div>
                <div style={{ marginTop: 4 }}>Vulnerabilities: {(latest.summary.webapp.vulnerabilities || []).slice(0, 10).join(', ') || '-'}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(latest.toolResults || []).map((t) => {
              const open = !!expanded[t.tool];
              return (
                <div
                  key={t.tool}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 8,
                    background: 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text)' }}>{t.tool}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: toolColor(t.status), fontWeight: 700 }}>{t.status}</span>
                      <button
                        onClick={() => setExpanded((prev) => ({ ...prev, [t.tool]: !prev[t.tool] }))}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer' }}
                      >
                        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                    {t.reason || 'ok'}
                  </div>
                  {open && (
                    <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text2)' }}>
                      <div>Domains: {(t.indicators?.domains || []).slice(0, 8).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>Subdomains: {(t.indicators?.subdomains || []).slice(0, 8).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>Emails: {(t.indicators?.emails || []).slice(0, 8).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>IPs: {(t.indicators?.ips || []).slice(0, 8).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>Open Ports: {(t.indicators?.openPorts || []).slice(0, 15).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>Services: {(t.indicators?.services || []).slice(0, 10).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>Vulns: {(t.indicators?.vulnerabilities || []).slice(0, 6).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>URLs: {(t.indicators?.urls || []).slice(0, 6).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>OWASP: {(t.indicators?.owaspTop10 || []).slice(0, 5).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>NS: {(t.indicators?.dnsRecords?.ns || []).slice(0, 6).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>MX: {(t.indicators?.dnsRecords?.mx || []).slice(0, 6).join(', ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>TXT: {(t.indicators?.dnsRecords?.txt || []).slice(0, 3).join(' | ') || '-'}</div>
                      <div style={{ marginTop: 4 }}>CNAME: {(t.indicators?.dnsRecords?.cname || []).slice(0, 6).join(', ') || '-'}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
            Recent Runs - {PHASE_LABELS[selectedPhase]} ({filteredRecent.length})
          </div>
          {filteredRecent.length === 0 && (
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>No recent scans for this module</div>
          )}
          {filteredRecent.map((r) => (
            <div
              key={r._id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)'
              }}
            >
              <span style={{ color: 'var(--text2)' }}>{r.target}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: toolColor(r.status), display: 'inline-flex', alignItems: 'center' }}>
                  {r.status === 'completed' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                </span>
                <button
                  onClick={() => handleDeleteRecent(r._id)}
                  disabled={deletingScanId === r._id}
                  title="Delete scan"
                  style={{
                    border: '1px solid var(--border2)',
                    background: 'transparent',
                    color: deletingScanId === r._id ? 'var(--text3)' : 'var(--red)',
                    borderRadius: 6,
                    padding: 3,
                    cursor: deletingScanId === r._id ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoReconPanel;
