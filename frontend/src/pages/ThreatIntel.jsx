import { useState } from 'react';
import {
  Search, Globe, Shield, AlertTriangle, Loader2, ChevronDown, ChevronUp,
  BrainCircuit, Zap, Eye, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/layout';
import { lookupAll } from '../api/threatIntel.api';

const providerIcon = { shodan: '🔍', virustotal: '🛡️', whois: '📋', abuseipdb: '🚨', hunter: '📧', otx: '🌐', censys: '🔐' };
const providerLabel = { shodan: 'Shodan', virustotal: 'VirusTotal', whois: 'WHOIS', abuseipdb: 'AbuseIPDB', hunter: 'Hunter.io', otx: 'AlienVault OTX', censys: 'Censys' };

const ThreatIntel = () => {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [aiSummary, setAiSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const handleLookup = async () => {
    const clean = target.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!clean) { toast.error('Enter a target'); return; }
    setLoading(true); setResults(null); setAiSummary('');
    try {
      const data = await lookupAll(clean);
      setResults(data);
      generateAISummary(clean, data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Lookup failed');
    } finally { setLoading(false); }
  };

  const generateAISummary = (targetName, data) => {
    setSummaryLoading(true);
    const results = data?.results || [];

    // Build risk factors
    const factors = [];
    let riskLevel = 'LOW';
    let riskScore = 20;

    results.forEach(r => {
      if (r.provider === 'virustotal' && r.malicious > 0) {
        factors.push(`VirusTotal flagged by ${r.malicious} engines (${r.suspicious} suspicious)`);
        riskScore += r.malicious * 8;
        if (r.malicious > 3) riskLevel = 'HIGH';
        if (r.malicious > 8) riskLevel = 'CRITICAL';
      }
      if (r.provider === 'shodan' && r.ports?.length > 0) {
        factors.push(`Shodan detected ${r.ports.length} open ports: ${r.ports.slice(0, 6).join(', ')}`);
        riskScore += r.ports.length * 3;
        if (r.vulns?.length > 0) {
          factors.push(`Shodan found ${r.vulns.length} known vulnerabilities`);
          riskScore += r.vulns.length * 10;
          riskLevel = 'CRITICAL';
        }
      }
      if (r.provider === 'abuseipdb' && r.abuseConfidenceScore > 30) {
        factors.push(`AbuseIPDB confidence score: ${r.abuseConfidenceScore}% (${r.totalReports} reports)`);
        riskScore += r.abuseConfidenceScore;
        if (r.abuseConfidenceScore > 70) riskLevel = 'HIGH';
      }
      if (r.provider === 'otx' && r.pulseCount > 0) {
        factors.push(`AlienVault OTX: ${r.pulseCount} threat intelligence pulses`);
        riskScore += r.pulseCount * 5;
      }
      if (r.provider === 'hunter' && r.totalEmails > 0) {
        factors.push(`Hunter.io found ${r.totalEmails} exposed email addresses`);
        riskScore += 5;
      }
    });

    riskScore = Math.min(riskScore, 100);
    if (riskScore > 75) riskLevel = 'CRITICAL';
    else if (riskScore > 50) riskLevel = 'HIGH';
    else if (riskScore > 30) riskLevel = 'MEDIUM';

    const summary = `UNIFIED THREAT INTELLIGENCE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target: ${targetName}
Risk Level: ${riskLevel}
Risk Score: ${riskScore}/100

ASSESSMENT:
This ${riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'target presents SIGNIFICANT security concerns' : 'target shows moderate exposure'} based on cross-referencing ${results.filter(r => !r.skipped && !r.error).length} intelligence sources.

KEY RISK FACTORS:
${factors.length > 0 ? factors.map((f, i) => `  ${i + 1}. ${f}`).join('\n') : '  No significant risk factors identified.'}

RECOMMENDATION:
${riskLevel === 'CRITICAL' ? '⚠️ IMMEDIATE ACTION REQUIRED — Run full AI penetration test and implement defensive measures.' : riskLevel === 'HIGH' ? '🔴 HIGH PRIORITY — Schedule deep vulnerability scan within 24 hours.' : riskLevel === 'MEDIUM' ? '🟡 MODERATE — Monitor target and run periodic scans.' : '🟢 LOW RISK — Continue routine monitoring.'}`;

    // Animate typing
    let idx = 0;
    const interval = setInterval(() => {
      idx += Math.floor(Math.random() * 4) + 2;
      if (idx >= summary.length) {
        setAiSummary(summary);
        setSummaryLoading(false);
        clearInterval(interval);
      } else {
        setAiSummary(summary.slice(0, idx));
      }
    }, 12);
  };

  const renderValue = (val) => {
    if (val === null || val === undefined || val === '') return <span style={{ color: 'var(--text3)' }}>—</span>;
    if (typeof val === 'boolean') return <span style={{ color: val ? 'var(--green)' : 'var(--red)' }}>{val ? 'Yes' : 'No'}</span>;
    if (Array.isArray(val)) {
      if (val.length === 0) return <span style={{ color: 'var(--text3)' }}>None</span>;
      if (typeof val[0] === 'object') {
        return <pre style={{ fontSize: 10, color: 'var(--text2)', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6, overflow: 'auto', maxHeight: 160, margin: 0, border: '1px solid var(--border)' }}>{JSON.stringify(val, null, 2)}</pre>;
      }
      return <span style={{ color: 'var(--text2)' }}>{val.slice(0, 15).join(', ')}{val.length > 15 ? ` +${val.length - 15} more` : ''}</span>;
    }
    if (typeof val === 'object') {
      return <pre style={{ fontSize: 10, color: 'var(--text2)', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6, overflow: 'auto', maxHeight: 160, margin: 0, border: '1px solid var(--border)' }}>{JSON.stringify(val, null, 2)}</pre>;
    }
    return <span style={{ color: 'var(--text2)' }}>{String(val).slice(0, 300)}</span>;
  };

  return (
    <Layout>
      <div className="page-header">
        <h2><Globe size={22} /> Threat Intelligence</h2>
        <p>Unified intelligence engine — AI-powered analysis from 7 security data sources</p>
      </div>

      {/* ── Search ── */}
      <div className="dark-card" style={{ marginBottom: 14 }}>
        <div className="card-title"><Search size={13} /> Intelligence Lookup</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="example.com or 8.8.8.8"
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            style={{
              flex: 1, background: 'var(--field-bg)', border: '1px solid var(--border2)',
              color: 'var(--text)', padding: '11px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
              fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--green)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.boxShadow = 'none'; }}
          />
          <button
            onClick={handleLookup}
            disabled={loading}
            style={{
              border: 'none', borderRadius: 10, padding: '11px 20px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 12, fontWeight: 800, fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
            }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
            {loading ? 'Querying...' : 'Analyze Target'}
          </button>
        </div>
      </div>

      {/* ── AI Summary ── */}
      {(aiSummary || summaryLoading) && (
        <div className="dark-card" style={{ marginBottom: 14 }}>
          <div className="card-title"><BrainCircuit size={13} /> AI Threat Assessment</div>
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot red" /><div className="terminal-dot yellow" /><div className="terminal-dot green" />
              <span className="terminal-title">paia-threat-engine — unified analysis</span>
            </div>
            <div className="terminal-body" style={{ minHeight: 120 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--cyan)' }}>
                {aiSummary}
                {summaryLoading && <span className="terminal-cursor" />}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── Provider Results ── */}
      {results?.results && (
        <div style={{ display: 'grid', gap: 10 }}>
          {results.results.map((r, i) => {
            const provKey = r.provider || `result_${i}`;
            const isExpanded = expanded[i];
            const isSkipped = r.skipped;
            const isError = !!r.error;
            const entries = Object.entries(r).filter(([k]) => !['provider', 'cached', 'skipped', 'error', 'reason'].includes(k));

            return (
              <div key={i} className="dark-card" style={{ opacity: isSkipped ? 0.5 : 1, padding: 14 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{providerIcon[provKey] || '📡'}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{providerLabel[provKey] || provKey}</span>
                    {r.cached && <span className="sev-badge info" style={{ fontSize: 8 }}>cached</span>}
                    {isSkipped && <span className="sev-badge medium" style={{ fontSize: 8 }}>skipped: {r.reason}</span>}
                    {isError && <span className="sev-badge critical" style={{ fontSize: 8 }}>error</span>}
                    {!isSkipped && !isError && <span className="sev-badge low" style={{ fontSize: 8 }}>✓ success</span>}
                  </div>
                  {isExpanded ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
                </div>
                {isExpanded && !isSkipped && (
                  <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                    {entries.map(([key, val]) => (
                      <div key={key} style={{
                        display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, alignItems: 'start',
                        padding: '6px 0', borderBottom: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'capitalize' }}>
                          {key.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span style={{ fontSize: 11 }}>{renderValue(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
};

export default ThreatIntel;
