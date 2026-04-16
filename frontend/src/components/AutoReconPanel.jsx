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
  deleteReconScanById,
  runSubdomainDNS,
  listRecentSubdomainDNS,
  runNetworkScan,
  listRecentNetworkScans
} from '../api/recon.api';
import { publishDashboardEvent } from '../utils/dashboardRealtime';

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
  const [recentSubdomainResults, setRecentSubdomainResults] = useState([]);
  const [recentNetworkResults, setRecentNetworkResults] = useState([]);
  const [latestNetworkResult, setLatestNetworkResult] = useState(null);
  const [scanId, setScanId] = useState('');
  const [liveToolStatus, setLiveToolStatus] = useState({});
  const [expanded, setExpanded] = useState({});
  const [deletingScanId, setDeletingScanId] = useState('');
  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const publishedScansRef = useRef(new Set());
  const toolEventStateRef = useRef({});
  const currentTargetRef = useRef('');
  const currentRiskRef = useRef(0);

  const refreshRecent = async () => {
    try {
      const scans = await listRecentRecon();
      setRecent(scans.slice(0, 20));

      // Also refresh Subdomain/DNS and Network history
      const [subResults, netResults] = await Promise.all([
        listRecentSubdomainDNS(),
        listRecentNetworkScans()
      ]);
      setRecentSubdomainResults(subResults);
      setRecentNetworkResults(netResults);
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
    toolEventStateRef.current = {};
  };

  const syncFromScan = (scan) => {
    if (!scan) return;
    currentTargetRef.current = scan.target || currentTargetRef.current;
    currentRiskRef.current = scan?.verdict?.score ?? currentRiskRef.current;
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

    if (
      scan?._id &&
      ['completed', 'partial', 'failed'].includes(scan.status) &&
      !publishedScansRef.current.has(scan._id)
    ) {
      publishedScansRef.current.add(scan._id);
      publishDashboardEvent({
        source: 'scan-center',
        title: `Scan ${scan.status}: ${scan.target}`,
        meta: `${(scan.phase || 'recon').toUpperCase()} | Score ${scan?.verdict?.score ?? 0}/100`,
        severity:
          scan?.verdict?.level === 'high'
            ? 'critical'
            : scan?.verdict?.level === 'medium'
              ? 'high'
              : scan?.verdict?.level === 'low'
                ? 'medium'
                : 'low',
        riskScore: scan?.verdict?.score ?? 0,
        target: scan.target,
      });
    }
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
      publishDashboardEvent({
        source: 'scan-center',
        title: `Scan started: ${payload?.target || targetInput.trim() || 'target'}`,
        meta: `${(payload?.phase || selectedPhase || 'recon').toUpperCase()} | Tools ${payload?.toolsRequested?.length || 0}`,
        severity: 'info',
        riskScore: currentRiskRef.current,
        target: payload?.target || targetInput.trim() || '',
      });
      resetLiveState(payload.toolsRequested || TOOL_SETS[payload?.phase || selectedPhase] || TOOL_SETS.recon);
    });

    socket.on('recon:tool_update', (payload) => {
      if (payload?.scanId !== id) return;
      setLiveToolStatus((prev) => ({ ...prev, [payload.tool]: payload.status }));
      const key = `${payload.tool}:${payload.status}`;
      if (!toolEventStateRef.current[key]) {
        toolEventStateRef.current[key] = true;
        const progressText =
          payload?.progress?.total
            ? `${payload.progress.completed || 0}/${payload.progress.total} tools`
            : 'tool update';
        publishDashboardEvent({
          source: 'scan-center',
          title: `${payload.tool} ${payload.status}`,
          meta: `${(selectedPhase || 'recon').toUpperCase()} | ${progressText}`,
          severity:
            payload.status === 'failed'
              ? 'high'
              : payload.status === 'success'
                ? 'low'
                : 'info',
          riskScore: currentRiskRef.current,
          target: currentTargetRef.current || targetInput.trim() || '',
        });
      }
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
      publishDashboardEvent({
        source: 'scan-center',
        title: `Scan failed: ${currentTargetRef.current || targetInput.trim() || 'target'}`,
        meta: payload?.reason || 'Recon failed',
        severity: 'critical',
        riskScore: currentRiskRef.current,
        target: currentTargetRef.current || targetInput.trim() || '',
      });
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

    if (selectedPhase === 'subdomain') {
      setLoading(true);
      setStage('Running Subdomain Enumeration & DNS Analysis...');
      try {
        const res = await runSubdomainDNS(v.target);
        if (res.success) {
          toast.success(`Found ${res.total} subdomains with DNS records`);
          const syntheticScan = {
            target: v.target,
            status: 'completed',
            phase: 'subdomain',
            toolResults: res.data.map(item => ({
              tool: 'amass/dns',
              status: 'success',
              indicators: {
                subdomains: [item.subdomain],
                dnsRecords: { A: item.A, MX: item.MX, TXT: item.TXT }
              }
            })),
            summary: {
              subdomains: res.data.map(i => i.subdomain),
              dnsRecords: {
                A: [...new Set(res.data.flatMap(i => i.A))],
                MX: [...new Set(res.data.flatMap(i => i.MX))],
                TXT: [...new Set(res.data.flatMap(i => i.TXT))]
              }
            },
            verdict: { level: 'low', score: Math.min(100, res.total * 2), label: 'Subdomain discovery complete' }
          };
          setLatest(syntheticScan);
          refreshRecent();
        } else {
          toast.error(res.message || 'Scan failed');
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Subdomain scan failed');
      } finally {
        setLoading(false);
        setStage('');
      }
      return;
    }

    if (selectedPhase === 'network') {
      setLoading(true);
      setStage('Running Network Scan (Nmap)...');
      try {
        const res = await runNetworkScan(v.target);
        if (res.success) {
          toast.success(`Network scan complete for ${v.target}`);
          const syntheticScan = {
            target: v.target,
            status: 'completed',
            phase: 'network',
            toolResults: [{
              tool: 'nmap',
              status: 'success',
              output: res.result
            }],
            verdict: { level: 'medium', score: 45, label: 'Network scan complete' }
          };
          setLatest(syntheticScan);
          setLatestNetworkResult(syntheticScan);
          refreshRecent();
        } else {
          toast.error(res.message || 'Scan failed');
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Network scan failed');
      } finally {
        setLoading(false);
        setStage('');
      }
      return;
    }

    const baseTools = TOOL_SETS[selectedPhase] || TOOL_SETS.recon;
    const toolsToRun = Array.isArray(specificTools) && specificTools.length ? specificTools : baseTools;

    setLoading(true);
    setStage('Creating target...');
    currentTargetRef.current = v.target;
    currentRiskRef.current = 0;
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

  const filteredSubdomainRecent = useMemo(() => {
    // If domain filter is needed, we could add a state for it
    return recentSubdomainResults.slice(0, 8);
  }, [recentSubdomainResults]);

  const handleSelectRecentSubdomain = (res) => {
    // Reconstruct a latest scan object from the historical result
    const syntheticScan = {
      target: res.domain,
      status: 'completed',
      phase: 'subdomain',
      toolResults: [{
        tool: 'amass/dns',
        status: 'success',
        indicators: {
          subdomains: [res.subdomain],
          dnsRecords: { A: res.A, MX: res.MX, TXT: res.TXT }
        }
      }],
      summary: {
        subdomains: [res.subdomain],
        dnsRecords: { A: res.A, MX: res.MX, TXT: res.TXT }
      },
      verdict: { level: 'low', score: 20, label: 'Historical DNS result' }
    };
    setLatest(syntheticScan);
  };

  const handleSelectRecentNetwork = (res) => {
    const syntheticScan = {
      target: res.domain,
      status: 'completed',
      phase: 'network',
      toolResults: [{
        tool: 'nmap',
        status: res.status,
        output: res.rawOutput
      }],
      verdict: { level: 'medium', score: 45, label: 'Historical Network scan' }
    };
    setLatest(syntheticScan);
    setLatestNetworkResult(syntheticScan);
  };

  return (
    <div style={box}>
      <div className="card-title" style={{ marginBottom: 10 }}>
        <Radar size={13} />
        Scan Center (Target Only)
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {Object.keys(PHASE_LABELS).map((phase) => (
          <button
            key={phase}
            onClick={() => setSelectedPhase(phase)}
            disabled={loading}
            style={{
              border: selectedPhase === phase ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border2)',
              borderRadius: 8,
              padding: '7px 12px',
              background: selectedPhase === phase ? 'rgba(99,102,241,0.16)' : 'transparent',
              color: selectedPhase === phase ? 'var(--indigo-l)' : 'var(--text2)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {phase === 'subdomain' ? 'Subdomain/DNS' : phase.charAt(0).toUpperCase() + phase.slice(1)}
          </button>
        ))}
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
          {loading ? <Loader2 size={14} className="spin" /> : <Play size={13} />}
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

      {selectedPhase !== 'subdomain' && (
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
      )}

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
                  >
                    {f.type}:{f.value}
                  </span>
                ))}
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
                      {/* Subdomain/DNS Results */}
                      {(t.indicators?.subdomains || []).length > 0 && (
                        <div style={{ marginTop: 4 }}>Subdomains: {(t.indicators?.subdomains || []).slice(0, 50).join(', ')}</div>
                      )}
                      {(t.indicators?.dnsRecords?.A || []).length > 0 && (
                        <div style={{ marginTop: 4 }}>A Records: {t.indicators.dnsRecords.A.join(', ')}</div>
                      )}
                      {(t.indicators?.dnsRecords?.MX || []).length > 0 && (
                        <div style={{ marginTop: 4 }}>MX Records: {t.indicators.dnsRecords.MX.slice(0, 3).join(', ')}</div>
                      )}
                      {(t.indicators?.dnsRecords?.TXT || []).length > 0 && (
                        <div style={{ marginTop: 4 }}>TXT Records: {t.indicators.dnsRecords.TXT.slice(0, 2).join(' | ')}</div>
                      )}

                      {/* Raw Output (Nmap/Nikto) */}
                      {t.output && (
                        <pre style={{
                          background: '#000',
                          color: '#0f0',
                          padding: 10,
                          borderRadius: 4,
                          fontSize: 9,
                          fontFamily: 'monospace',
                          overflowX: 'auto',
                          maxHeight: 200,
                          marginTop: 8
                        }}>
                          {t.output}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
          Recent Runs - {PHASE_LABELS[selectedPhase]}
        </div>
        
        {selectedPhase === 'subdomain' ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {recentSubdomainResults.length === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>No recent scans for this module</div>
            ) : (
              recentSubdomainResults.map((r, i) => (
                <div
                  key={`${r._id}-${i}`}
                  onClick={() => handleSelectRecentSubdomain(r)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <span style={{ color: 'var(--text2)' }}>{r.subdomain}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 9 }}>{new Date(r.timestamp).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        ) : selectedPhase === 'network' ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {recentNetworkResults.length === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>No recent scans for this module</div>
            ) : (
              recentNetworkResults.map((r, i) => (
                <div
                  key={`${r._id}-${i}`}
                  onClick={() => handleSelectRecentNetwork(r)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <span style={{ color: 'var(--text2)' }}>{r.domain}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 9 }}>{new Date(r.timestamp).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {filteredRecent.length === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>No recent scans for this module</div>
            ) : (
              filteredRecent.map((r) => (
                <div
                  key={r._id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)'
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
                      style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoReconPanel;
