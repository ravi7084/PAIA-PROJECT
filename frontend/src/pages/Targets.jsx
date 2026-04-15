/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Targets Page                        ║
 * ║   Phase 2 — YE FILE ZIP MEIN NAHI THI        ║
 * ║   Seedha frontend/src/pages/ mein rakh do    ║
 * ╚══════════════════════════════════════════════╝
 */

import { useState, useEffect, useRef } from 'react';
import {
  Target, Plus, Pencil, Trash2, Globe,
  Network, Code2, X, Upload, StickyNote,
  Clock, ChevronDown, ChevronUp, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios.config';
import Layout from '../components/layout';

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_META = {
  web:     { label: 'Web',     color: 'var(--indigo-l)', Icon: Globe    },
  network: { label: 'Network', color: 'var(--amber)',    Icon: Network  },
  api:     { label: 'API',     color: '#fb923c',         Icon: Code2    },
};

const riskMeta = (score) => {
  if (score >= 71) return { label: `Risk ${score}`, color: 'var(--red)'   };
  if (score >= 31) return { label: `Risk ${score}`, color: 'var(--amber)' };
  if (score >  0)  return { label: `Risk ${score}`, color: 'var(--green)' };
  return               { label: 'No scan yet',  color: 'var(--text3)' };
};

const timeAgo = (date) => {
  if (!date) return null;
  const m = Math.floor((Date.now() - new Date(date)) / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  if (m < 1440)return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

const EMPTY_FORM = {
  name: '', domain: '', ip_address: '',
  scope: 'in-scope', target_type: 'web',
  description: '', tags: [], consentGiven: false,
};

// ── Shared Styles ──────────────────────────────────────────────────────────

const inputSt = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
  color: 'var(--text)', padding: '9px 12px', borderRadius: 8,
  fontSize: 13, boxSizing: 'border-box', outline: 'none',
};

const Badge = ({ color, label }) => (
  <span style={{
    fontSize: 10, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
    background: `${color}18`, color, border: `1px solid ${color}30`, fontWeight: 600,
  }}>
    {label}
  </span>
);

const FieldLabel = ({ text }) => (
  <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>
    {text}
  </label>
);

// ── Tag Input ──────────────────────────────────────────────────────────────

const TagInput = ({ tags, onChange }) => {
  const [val, setVal] = useState('');
  const add = () => {
    const t = val.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setVal('');
  };
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {tags.map(t => (
            <span key={t} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
              padding: '2px 8px', borderRadius: 20,
              background: 'rgba(79,70,229,.15)', color: 'var(--indigo-l)',
              border: '1px solid rgba(79,70,229,.3)',
            }}>
              {t}
              <button onClick={() => onChange(tags.filter(x => x !== t))} style={{
                background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0,
              }}><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder="Tag likhke Enter dabao"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          style={{ ...inputSt, flex: 1 }} />
        <button onClick={add} style={{
          background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)',
          padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
        }}>+</button>
      </div>
    </div>
  );
};

// ── Notes Panel ────────────────────────────────────────────────────────────

const NotesPanel = ({ targetId, initialNotes = [] }) => {
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText]   = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/targets/${targetId}/notes`, { text });
      setNotes(p => [...p, res.data.data.note]);
      setText('');
    } catch { toast.error('Note save nahi hua'); }
    finally { setSaving(false); }
  };

  const del = async (noteId) => {
    try {
      await api.delete(`/targets/${targetId}/notes/${noteId}`);
      setNotes(p => p.filter(n => n._id !== noteId));
    } catch { toast.error('Note delete nahi hua'); }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
        {[...notes].reverse().map(n => (
          <div key={n._id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 8,
            padding: '6px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4, marginRight: 6,
                background: n.source === 'system' ? 'rgba(79,70,229,.15)' : 'rgba(16,185,129,.12)',
                color: n.source === 'system' ? 'var(--indigo-l)' : 'var(--green)',
              }}>{n.source}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{n.text}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{timeAgo(n.createdAt)}</span>
              {n.source === 'user' && (
                <button onClick={() => del(n._id)} style={{
                  background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2,
                }}><X size={11} /></button>
              )}
            </div>
          </div>
        ))}
        {!notes.length && (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 0' }}>Koi note nahi</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Note likho..." style={{ ...inputSt, flex: 1 }} />
        <button onClick={save} disabled={saving} style={{
          background: 'var(--indigo)', color: '#fff', border: 'none',
          padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
        }}>{saving ? '...' : 'Add'}</button>
      </div>
    </div>
  );
};

// ── CSV Import ─────────────────────────────────────────────────────────────

const CsvImport = ({ onClose, onDone }) => {
  const [preview, setPreview]   = useState([]);
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [consent, setConsent]   = useState(false);
  const fileRef = useRef();

  const parseCSV = (text) => {
    const [header, ...lines] = text.trim().split('\n');
    const cols = header.split(',').map(h => h.trim().toLowerCase());
    return lines.map((line, i) => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      cols.forEach((c, j) => { obj[c] = vals[j] || ''; });
      return obj;
    }).filter(r => r.name || r.domain || r.ip_address);
  };

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setPreview(parseCSV(ev.target.result).slice(0, 5));
    r.readAsText(f);
  };

  const doImport = async () => {
    if (!consent) { toast.error('Pehle legal consent confirm karo'); return; }
    const f = fileRef.current.files[0];
    if (!f) { toast.error('CSV file select karo'); return; }
    setLoading(true);
    const r = new FileReader();
    r.onload = async (ev) => {
      try {
        const targets = parseCSV(ev.target.result);
        const res = await api.post('/targets/bulk', { targets });
        setResults(res.data.data);
        onDone();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Import fail hua');
      } finally { setLoading(false); }
    };
    r.readAsText(f);
  };

  return (
    <div className="dark-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>CSV Bulk Import</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>

      {!results ? (
        <>
          <div style={{
            fontSize: 11, color: 'var(--text3)', marginBottom: 12,
            padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
          }}>
            CSV Format: <code style={{ color: 'var(--indigo-l)' }}>name,domain,ip_address,scope,target_type</code>
          </div>

          <input ref={fileRef} type="file" accept=".csv" onChange={onFile}
            style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, width: '100%' }} />

          {preview.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
              <div style={{ color: 'var(--text3)', marginBottom: 4 }}>Preview ({preview.length} rows):</div>
              {preview.map((r, i) => (
                <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  {r.name} — {r.domain || r.ip_address}
                </div>
              ))}
            </div>
          )}

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
              style={{ marginTop: 3 }} />
            <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
              I confirm that I have legal authorization for all targets in this file.
            </span>
          </label>

          <button onClick={doImport} disabled={loading} style={{
            background: 'var(--indigo)', color: '#fff', border: 'none',
            padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>{loading ? 'Import ho raha hai...' : 'Import Karo'}</button>
        </>
      ) : (
        <div>
          <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 8 }}>
            ✓ {results.importedCount} Targets successfully import
          </div>
          {results.blockedCount > 0 && (
            <div style={{ color: 'var(--red)', fontSize: 13 }}>
              ✗ {results.blockedCount} blocked:
              {results.blocked.map(b => (
                <div key={b.row} style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 12, marginTop: 2 }}>
                  Row {b.row} ({b.name}): {b.reason}
                </div>
              ))}
            </div>
          )}
          <button onClick={onClose} style={{
            background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)',
            padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginTop: 12,
          }}>Band Karo</button>
        </div>
      )}
    </div>
  );
};

// ── Target Card ────────────────────────────────────────────────────────────

const TargetCard = ({ target, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const meta      = TYPE_META[target.target_type] || TYPE_META.web;
  const scopeClr  = target.scope === 'in-scope' ? 'var(--green)' : 'var(--red)';
  const risk      = riskMeta(target.riskScore);
  const Icon      = meta.Icon;
  const scanned   = timeAgo(target.lastScannedAt);

  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>

        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} color={meta.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{target.name}</span>
            <Badge color={scopeClr}   label={target.scope} />
            <Badge color={meta.color} label={meta.label}   />
            {target.riskScore > 0 && <Badge color={risk.color} label={risk.label} />}
            {(target.tags || []).map(t => (
              <Badge key={t} color="var(--indigo-l)" label={t} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {target.domain     && <span>🌐 {target.domain}</span>}
            {target.ip_address && <span>📡 {target.ip_address}</span>}
            {scanned && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} /> {scanned}
              </span>
            )}
          </div>
          {target.description && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, opacity: .7 }}>
              {target.description}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setExpanded(e => !e)} title="Notes" style={{
            background: 'rgba(100,100,120,.1)', color: 'var(--text3)',
            border: '1px solid var(--border)', padding: '5px 10px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <StickyNote size={11} />
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button onClick={() => onEdit(target)} style={{
            background: 'rgba(79,70,229,.12)', color: 'var(--indigo-l)',
            border: '1px solid rgba(79,70,229,.25)', padding: '5px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Pencil size={11} /> Edit
          </button>
          <button onClick={() => onDelete(target._id)} style={{
            background: 'rgba(239,68,68,.10)', color: 'var(--red)',
            border: '1px solid rgba(239,68,68,.2)', padding: '5px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Trash2 size={11} /> Remove
          </button>
        </div>
      </div>

      {/* Notes panel (expandable) */}
      {expanded && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            fontSize: 10, color: 'var(--text3)', margin: '12px 0 6px',
            textTransform: 'uppercase', letterSpacing: '.5px',
          }}>Activity Log</div>
          <NotesPanel targetId={target._id} initialNotes={target.notes || []} />
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

const Targets = () => {
  const [targets, setTargets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [showCsv, setShowCsv]       = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [activeTag, setActiveTag]   = useState(null);

  const fetchTargets = async (tag) => {
    setLoading(true);
    try {
      const url = tag ? `/targets?tag=${tag}` : '/targets';
      const res = await api.get(url);
      setTargets(res.data.data.targets);
    } catch { toast.error('Targets load nahi hue'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTargets(activeTag); }, [activeTag]);

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setShowForm(true); };

  const openEdit = (t) => {
    setEditTarget(t);
    setForm({
      name: t.name, domain: t.domain || '', ip_address: t.ip_address || '',
      scope: t.scope, target_type: t.target_type, description: t.description || '',
      tags: t.tags || [], consentGiven: t.consentGiven,
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditTarget(null); setForm(EMPTY_FORM); };

  const setF = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim())                          { toast.error('Target name chahiye'); return; }
    if (!form.domain.trim() && !form.ip_address.trim()) { toast.error('Domain ya IP chahiye'); return; }
    if (!form.consentGiven)                         { toast.error('Legal consent confirm karo'); return; }

    setSubmitting(true);
    try {
      if (editTarget) {
        await api.put(`/targets/${editTarget._id}`, form);
        toast.success('Target update ho gaya');
      } else {
        await api.post('/targets', form);
        toast.success('Target add ho gaya');
      }
      fetchTargets(activeTag);
      closeForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kuch galat hua');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Is target ko hata dein?')) return;
    try {
      await api.delete(`/targets/${id}`);
      toast.success('Target hata diya');
      setTargets(p => p.filter(t => t._id !== id));
    } catch { toast.error('Delete nahi hua'); }
  };

  // Saare unique tags
  const allTags = [...new Set(targets.flatMap(t => t.tags || []))];

  return (
    <Layout>

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Target Management</h2>
          <p>Define yourauthorized testing targets</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCsv(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)',
            padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13,
          }}>
            <Upload size={13} /> CSV Import
          </button>
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--indigo)', color: '#fff', border: 'none',
            padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>
            <Plus size={14} /> Add Target
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Targets', value: targets.length,                                   color: 'var(--amber)'   },
          { label: 'In Scope',      value: targets.filter(t => t.scope === 'in-scope').length, color: 'var(--green)'   },
          { label: 'High Risk',     value: targets.filter(t => t.riskScore >= 71).length,      color: 'var(--red)'     },
          { label: 'Tags Used',     value: allTags.length,                                    color: 'var(--indigo-l)'},
        ].map(s => (
          <div key={s.label} className="dark-card" style={{ cursor: 'default', padding: '14px 16px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tag Filter Bar */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={() => setActiveTag(null)} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
            background: !activeTag ? 'var(--indigo)' : 'transparent',
            color: !activeTag ? '#fff' : 'var(--text3)',
            border: `1px solid ${!activeTag ? 'var(--indigo)' : 'var(--border2)'}`,
          }}>Sab</button>
          {allTags.map(t => (
            <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              background: activeTag === t ? 'rgba(79,70,229,.2)' : 'transparent',
              color: activeTag === t ? 'var(--indigo-l)' : 'var(--text3)',
              border: `1px solid ${activeTag === t ? 'rgba(79,70,229,.4)' : 'var(--border2)'}`,
            }}>
              <Tag size={9} /> {t}
            </button>
          ))}
        </div>
      )}

      {/* CSV Import Panel */}
      {showCsv && (
        <CsvImport onClose={() => setShowCsv(false)} onDone={() => fetchTargets(activeTag)} />
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="dark-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}>
              <Target size={13} />
              {editTarget ? 'Target Edit Karo' : 'Naya Target Add Karo'}
            </div>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            <div>
              <FieldLabel text="Target Name *" />
              <input value={form.name} onChange={setF('name')} placeholder="e.g. Main Website" style={inputSt} />
            </div>

            <div>
              <FieldLabel text="Domain" />
              <input value={form.domain} onChange={setF('domain')} placeholder="e.g. example.com" style={inputSt} />
            </div>

            <div>
              <FieldLabel text="IP Address" />
              <input value={form.ip_address} onChange={setF('ip_address')} placeholder="e.g. 203.0.113.10" style={inputSt} />
            </div>

            <div>
              <FieldLabel text="Description" />
              <input value={form.description} onChange={setF('description')} placeholder="Optional notes" style={inputSt} />
            </div>

            <div>
              <FieldLabel text="Scope" />
              <select value={form.scope} onChange={setF('scope')} style={{ ...inputSt, cursor: 'pointer' }}>
                <option value="in-scope">In Scope</option>
                <option value="out-of-scope">Out of Scope</option>
              </select>
            </div>

            <div>
              <FieldLabel text="Target Type" />
              <select value={form.target_type} onChange={setF('target_type')} style={{ ...inputSt, cursor: 'pointer' }}>
                <option value="web">Web</option>
                <option value="network">Network</option>
                <option value="api">API</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <FieldLabel text="Tags" />
              <TagInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} />
            </div>

          </div>

          {/* Legal Consent */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16,
            padding: '10px 14px', cursor: 'pointer', borderRadius: 8,
            background: form.consentGiven ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)',
            border: `1px solid ${form.consentGiven ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}`,
          }}>
            <input type="checkbox" checked={form.consentGiven}
              onChange={e => setForm(f => ({ ...f, consentGiven: e.target.checked }))}
              style={{ marginTop: 3 }} />
            <div>
              <div style={{
                fontSize: 13, fontWeight: 600, marginBottom: 3,
                color: form.consentGiven ? 'var(--green)' : 'var(--red)',
              }}>
                Legal Authorization Required
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                I confirm that I have explicit written authorization to perform penetration testing on this target. Unauthorized scanning is illegal.
              </div>
            </div>
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={handleSubmit} disabled={submitting} style={{
              background: 'var(--indigo)', color: '#fff', border: 'none',
              padding: '9px 22px', borderRadius: 8, cursor: 'pointer',
              fontWeight: 600, fontSize: 13, opacity: submitting ? .7 : 1,
            }}>
              {submitting ? 'Save ho raha hai...' : editTarget ? 'Update Karo' : 'Add Karo'}
            </button>
            <button onClick={closeForm} style={{
              background: 'transparent', color: 'var(--text3)',
              border: '1px solid var(--border2)', padding: '9px 18px',
              borderRadius: 8, cursor: 'pointer', fontSize: 13,
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Target List */}
      {loading ? (
        <div className="dark-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          Targets load ho rahe hain...
        </div>
      ) : targets.length === 0 ? (
        <div className="dark-card">
          <div className="empty-state">
            <div className="empty-icon"><Target size={20} /></div>
            <div className="empty-title">
              {activeTag ? `"${activeTag}" No targets for the tag.` : 'No targets added yet'}
            </div>
            <div className="empty-sub">
              {activeTag
                ? 'Try a different tag, or click on "All".'
                : 'Add the target first then press the "Add Target" button.'}
            </div>
          </div>
        </div>
      ) : (
        targets.map(t => (
          <TargetCard key={t._id} target={t} onEdit={openEdit} onDelete={handleDelete} />
        ))
      )}

    </Layout>
  );
};

export default Targets;