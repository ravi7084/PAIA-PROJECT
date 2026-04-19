import { useState, useEffect } from 'react';
import {
  FileText, Download, Trash2, Shield, AlertTriangle, ChevronDown, ChevronUp,
  Briefcase, Wrench, GitBranch, Eye, BarChart3, ArrowRight, Crosshair,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/layout';
import * as aiApi from '../api/aiAgent.api';
import { listReports, getReport, deleteReport } from '../api/aiAgent.api';

const sevColor = s => ({ critical: '#ff3b5c', high: '#ff6b35', medium: '#ffb800', low: '#818cf8', info: '#64748b' }[s] || '#64748b');

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedFinding, setExpandedFinding] = useState({});
  const [activeTab, setActiveTab] = useState('executive');

  const refresh = async () => {
    try { setReports(await listReports()); } catch { toast.error('Failed to load reports'); } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const handleView = async (id) => {
    try {
      const r = await getReport(id);
      setSelected(r);
      setActiveTab('executive');
      setExpandedFinding({});
    } catch { toast.error('Failed to load report'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await deleteReport(id);
      if (selected?._id === id) setSelected(null);
      refresh();
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  const downloadPdf = async () => {
    if (!selected) return;
    try {
      toast.success('Preparing PDF Document...', { icon: '📄' });
      await aiApi.downloadReportPdf(selected._id);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const findings = selected?.findings || [];
  const recs = selected?.recommendations || [];

  return (
    <Layout>
      <div className="page-header">
        <h2><FileText size={22} /> Reports</h2>
        <p>Enterprise-grade penetration test reports with executive summaries and technical deep dives</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, alignItems: 'start' }}>
        {/* ── Report List ── */}
        <div className="dark-card">
          <div className="card-title">All Reports ({reports.length})</div>
          {loading && <div style={{ fontSize: 12, color: 'var(--text3)', padding: 16, textAlign: 'center' }}>Loading...</div>}
          {!loading && reports.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <FileText size={28} color="var(--text3)" />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>No reports yet</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Run an AI Scan to generate reports</div>
            </div>
          )}
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {reports.map((r) => (
              <div
                key={r._id}
                onClick={() => handleView(r._id)}
                style={{
                  padding: '12px 10px', cursor: 'pointer', borderRadius: 8,
                  borderBottom: '1px solid var(--border)',
                  background: selected?._id === r._id ? 'rgba(99,102,241,0.08)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{r.target}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>Score: {r.riskScore}</span>
                  <span>•</span>
                  <span>{new Date(r.generatedAt || r.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {Object.entries(r.severityCounts || {}).filter(([, v]) => v > 0).map(([k, v]) => (
                    <span key={k} className={`sev-badge ${k}`} style={{ fontSize: 8 }}>{v} {k}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Report Detail ── */}
        <div>
          {!selected ? (
            <div className="dark-card" style={{ textAlign: 'center', padding: 60 }}>
              <Shield size={36} color="var(--text3)" />
              <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12, fontWeight: 600 }}>Select a report to view</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Choose from the list on the left</div>
            </div>
          ) : (
            <>
              {/* Report Header */}
              <div className="dark-card" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.03em' }}>{selected.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {selected.target} • {selected.scope} • {new Date(selected.generatedAt || selected.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={downloadPdf} style={{
                      border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 12px',
                      background: 'transparent', color: 'var(--text2)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'inherit',
                    }}>
                      <Download size={12} /> Download PDF
                    </button>
                    <button onClick={() => handleDelete(selected._id)} style={{
                      border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 12px',
                      background: 'transparent', color: 'var(--red)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'inherit',
                    }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Risk Score + Severity Counts */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{
                    textAlign: 'center', padding: '16px 24px', borderRadius: 14,
                    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                    minWidth: 80,
                  }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--indigo-l)', lineHeight: 1 }}>{selected.riskScore}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>Risk Score</div>
                  </div>
                  {Object.entries(selected.severityCounts || {}).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} style={{
                      textAlign: 'center', padding: '16px 20px', borderRadius: 14,
                      background: `${sevColor(k)}08`, border: `1px solid ${sevColor(k)}20`,
                      minWidth: 70,
                    }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: sevColor(k), lineHeight: 1 }}>{v}</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>{k}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="report-tabs">
                  <button className={`report-tab ${activeTab === 'executive' ? 'active' : ''}`} onClick={() => setActiveTab('executive')}>
                    <Briefcase size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Executive Summary
                  </button>
                  <button className={`report-tab ${activeTab === 'technical' ? 'active' : ''}`} onClick={() => setActiveTab('technical')}>
                    <Eye size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Technical Deep Dive
                  </button>
                  <button className={`report-tab ${activeTab === 'mitre' ? 'active' : ''}`} onClick={() => setActiveTab('mitre')}>
                    <Crosshair size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} /> MITRE ATT&CK
                  </button>
                  <button className={`report-tab ${activeTab === 'fixes' ? 'active' : ''}`} onClick={() => setActiveTab('fixes')}>
                    <Wrench size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Recommendations
                  </button>
                </div>
              </div>

              {/* TAB: Executive Summary */}
              {activeTab === 'executive' && (
                <div className="dark-card" style={{ marginBottom: 14 }}>
                  <div className="card-title"><Briefcase size={13} /> Executive Summary</div>
                  {selected.executiveSummary ? (
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
                      {selected.executiveSummary}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>No executive summary available.</div>
                  )}

                  {/* CVSS Score Table */}
                  {findings.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        CVSS Scoring Overview
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text3)', fontWeight: 700 }}>Finding</th>
                              <th style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--text3)', fontWeight: 700, width: 80 }}>Severity</th>
                              <th style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--text3)', fontWeight: 700, width: 60 }}>CVSS</th>
                              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text3)', fontWeight: 700 }}>Tool</th>
                            </tr>
                          </thead>
                          <tbody>
                            {findings.map((f, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{f.title}</td>
                                <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                  <span className={`sev-badge ${f.severity}`}>{f.severity}</span>
                                </td>
                                <td style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--text2)', fontFamily: "'JetBrains Mono'" }}>
                                  {f.cvss || '—'}
                                </td>
                                <td style={{ padding: '8px 10px', color: 'var(--text3)' }}>{f.tool || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Technical Deep Dive */}
              {activeTab === 'technical' && (
                <div className="dark-card" style={{ marginBottom: 14 }}>
                  <div className="card-title"><AlertTriangle size={13} /> Findings ({findings.length})</div>
                  {findings.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>No findings.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {findings.map((f, i) => (
                        <div key={i} style={{
                          border: `1px solid ${sevColor(f.severity)}20`,
                          borderRadius: 10, padding: 12, background: `${sevColor(f.severity)}06`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span className={`sev-badge ${f.severity}`}>{f.severity}</span>
                              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{f.title}</span>
                              {f.cvss > 0 && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono'" }}>CVSS: {f.cvss}</span>}
                            </div>
                            <button onClick={() => setExpandedFinding(p => ({ ...p, [i]: !p[i] }))} style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer' }}>
                              {expandedFinding[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                          {expandedFinding[i] && (
                            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
                              {f.description && <div style={{ marginBottom: 6 }}><strong style={{ color: 'var(--text3)' }}>DESCRIPTION:</strong><br />{f.description}</div>}
                              {f.evidence && <div style={{ marginBottom: 6 }}><strong style={{ color: 'var(--text3)' }}>EVIDENCE:</strong><br />{f.evidence}</div>}
                              {f.remediation && <div style={{ marginBottom: 6, color: 'var(--green)' }}><strong style={{ color: 'var(--text3)' }}>REMEDIATION:</strong><br />{f.remediation}</div>}
                              {f.cveId && <div style={{ marginBottom: 4 }}><strong style={{ color: 'var(--text3)' }}>CVE:</strong> {f.cveId}</div>}
                              {f.tool && <div style={{ marginBottom: 4 }}><strong style={{ color: 'var(--text3)' }}>TOOL:</strong> {f.tool}</div>}
                              {f.exploitAvailable && (
                                <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 10, color: '#ef4444', fontWeight: 700 }}>
                                  ⚠ PUBLIC EXPLOIT AVAILABLE
                                </div>
                              )}
                              {f.mitreMapping && f.mitreMapping.length > 0 && (
                                <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)' }}>
                                  <strong style={{ color: 'var(--indigo-l)', fontSize: 10 }}>MITRE ATT&CK:</strong>
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                    {f.mitreMapping.map((m, mi) => (
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
                  )}

                  {/* Attack Chain Visualization */}
                  {findings.length > 0 && (
                    <div style={{ marginTop: 18, padding: 16, borderRadius: 10, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <GitBranch size={12} /> Attack Chain Visualization
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
                        {['Recon', ...findings.slice(0, 4).map(f => f.title?.split(' ').slice(0, 3).join(' ')), 'Impact'].map((step, i, arr) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{
                              padding: '8px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                              background: i === 0 ? 'rgba(99,102,241,0.1)' : i === arr.length - 1 ? 'rgba(239,68,68,0.15)' : 'rgba(255,107,53,0.1)',
                              color: i === 0 ? 'var(--indigo-l)' : i === arr.length - 1 ? 'var(--red)' : 'var(--amber)',
                              border: `1px solid ${i === 0 ? 'rgba(99,102,241,0.2)' : i === arr.length - 1 ? 'rgba(239,68,68,0.2)' : 'rgba(255,107,53,0.2)'}`,
                              whiteSpace: 'nowrap',
                            }}>
                              {step}
                            </div>
                            {i < arr.length - 1 && <ArrowRight size={14} color="var(--text3)" style={{ margin: '0 4px', flexShrink: 0 }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: MITRE ATT&CK */}
              {activeTab === 'mitre' && (
                <div className="dark-card" style={{ marginBottom: 14 }}>
                  <div className="card-title"><Crosshair size={13} /> MITRE ATT&CK Kill Chain</div>

                  {selected.mitreAttackMapping?.chain?.length > 0 ? (
                    <>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12 }}>
                        Coverage: {selected.mitreAttackMapping.coveragePercent || 0}% of MITRE ATT&CK tactics
                      </div>
                      {/* Kill chain visualization */}
                      <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                        {selected.mitreAttackMapping.chain.map((tactic, ti) => (
                          <div key={ti} style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{
                              padding: '8px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                              background: ti === 0 ? 'rgba(99,102,241,0.12)' : ti === selected.mitreAttackMapping.chain.length - 1 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
                              color: ti === 0 ? 'var(--indigo-l)' : ti === selected.mitreAttackMapping.chain.length - 1 ? 'var(--red)' : 'var(--amber)',
                              border: `1px solid ${ti === 0 ? 'rgba(99,102,241,0.2)' : ti === selected.mitreAttackMapping.chain.length - 1 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                              whiteSpace: 'nowrap',
                            }}>
                              {tactic.name}
                              <span style={{ opacity: 0.6, marginLeft: 4, fontSize: 8 }}>[{tactic.id}]</span>
                            </div>
                            {ti < selected.mitreAttackMapping.chain.length - 1 && (
                              <ArrowRight size={14} color="var(--text3)" style={{ margin: '0 3px', flexShrink: 0 }} />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Tactic detail cards */}
                      <div style={{ display: 'grid', gap: 10 }}>
                        {selected.mitreAttackMapping.chain.map((tactic, ti) => (
                          <div key={ti} style={{
                            padding: '12px 14px', borderRadius: 10,
                            background: 'rgba(99,102,241,0.03)',
                            border: '1px solid rgba(99,102,241,0.08)',
                            borderLeft: '3px solid var(--indigo-l)',
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--indigo-l)', marginBottom: 6 }}>
                              {tactic.name} <span style={{ fontWeight: 500, color: 'var(--text3)' }}>[{tactic.id}]</span>
                            </div>
                            {tactic.techniques?.map((tech, tei) => (
                              <div key={tei} style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3, paddingLeft: 12 }}>
                                → {tech.name} <span style={{ color: 'var(--text3)', fontFamily: "'JetBrains Mono'" }}>({tech.id})</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>No MITRE ATT&CK data available for this report.</div>
                  )}

                  {selected.mitreAttackSummary && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Attack Narrative</div>
                      <pre style={{
                        fontSize: 10, color: 'var(--text2)', lineHeight: 1.7,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        padding: '12px 14px', borderRadius: 8,
                        background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.08)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {selected.mitreAttackSummary}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Recommendations */}
              {activeTab === 'fixes' && (
                <div className="dark-card" style={{ marginBottom: 14 }}>
                  <div className="card-title"><Wrench size={13} /> Prioritized Recommendations</div>
                  {recs.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>No recommendations.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {recs.map((r, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '12px 14px', borderRadius: 10,
                          background: 'rgba(168,85,247,0.04)',
                          border: '1px solid rgba(168,85,247,0.1)',
                        }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                            background: 'rgba(168,85,247,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 900, color: 'var(--purple)',
                          }}>
                            {i + 1}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{r}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Reports;
