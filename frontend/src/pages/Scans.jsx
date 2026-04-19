import { useState, useEffect } from 'react';
import {
  ScanLine, Search, Wifi, Globe, Shield, Play, 
  Loader2, CheckCircle2, AlertTriangle, List, 
  ExternalLink, Trash2, Timer, Clock, Mail, Users
} from 'lucide-react';
import Layout from '../components/layout';
import api from '../api/axios.config';

const Scans = () => {
  const [target, setTarget] = useState('');
  const [activeTab, setActiveTab] = useState('subdomain');
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);

  // Fetch History on Load
  useEffect(() => {
    fetchScans();
  }, []);

  // Polling logic
  useEffect(() => {
    let interval;
    if (currentScanId) {
      interval = setInterval(async () => {
        try {
          // Note: using 'api' instance which uses baseURL: /api
          const res = await api.get(`/scan/${currentScanId}`);
          const scanData = res.data.data;
          
          if (scanData.status !== 'running') {
            setCurrentScanId(null);
            fetchScans();
          }
        } catch (err) {
          console.error("Polling error:", err);
          setCurrentScanId(null);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [currentScanId]);

  const fetchScans = async () => {
    try {
      const res = await api.get('/scans');
      setScans(res.data.data);
    } catch (err) {
      console.error("Failed to fetch scans:", err);
    }
  };

  const handleStartScan = async (type) => {
    if (!target) return alert('Please enter a target domain/IP');
    
    setLoading(true);
    try {
      const res = await api.post('/start-scan', { target, type });
      if (res.data.success) {
        setCurrentScanId(res.data.scanId);
        fetchScans();
      }
    } catch (err) {
      alert(`Error starting scan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this scan?")) return;
    
    try {
      await api.delete(`/scan/${id}`);
      // Instant UI update
      setScans(prev => prev.filter(scan => scan._id !== id));
    } catch (err) {
      console.error("Delete failed", err);
      alert(`Failed to delete scan: ${err.message}`);
    }
  };

  const filteredScans = scans.filter(s => s.type === activeTab);

  return (
    <Layout>
      <div className="page-header mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <ScanLine className="text-indigo-500" /> PAIA Scan Orchestrator
        </h2>
        <p className="text-gray-400">Execute and manage multi-module security scans via Kali Linux API</p>
      </div>

      {/* ── Scan Configuration ── */}
      <div className="dark-card p-6 mb-6 bg-[var(--bg2)] border border-[var(--border)] rounded-xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Target Domain or IP</label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type="text" 
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="example.com or 192.168.1.1"
                className="w-full bg-[var(--bg-d)] border border-[var(--border)] text-white pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-end gap-3 font-bold">
            <button 
              onClick={() => handleStartScan('subdomain')}
              disabled={loading || currentScanId}
              className="px-4 py-2.5 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading && activeTab === 'subdomain' ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              Subdomain
            </button>
            <button 
              onClick={() => handleStartScan('network')}
              disabled={loading || currentScanId}
              className="px-4 py-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading && activeTab === 'network' ? <Loader2 className="animate-spin" size={18} /> : <Wifi size={18} />}
              Network
            </button>
            <button 
              onClick={() => handleStartScan('webapp')}
              disabled={loading || currentScanId}
              className="px-4 py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading && activeTab === 'webapp' ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
              Web App
            </button>
            <button 
              onClick={() => handleStartScan('recon')}
              disabled={loading || currentScanId}
              className="px-4 py-2.5 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading && activeTab === 'recon' ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              Recon
            </button>
          </div>
        </div>
        {currentScanId && (
          <div className="mt-4 flex items-center gap-3 text-cyan-400 text-sm bg-cyan-500/10 p-3 rounded-lg border border-cyan-500/20">
            <Loader2 className="animate-spin" size={16} />
            Scan in progress... Polling Kali Linux API for results.
          </div>
        )}
      </div>

      {/* ── Results Navigation ── */}
      <div className="flex gap-2 mb-6 p-1 bg-[var(--bg-d)] border border-[var(--border)] rounded-xl inline-flex overflow-x-auto max-w-full">
        {['subdomain', 'network', 'webapp', 'recon'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all whitespace-nowrap ${
              activeTab === tab 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
              : 'text-gray-500 hover:text-white'
            }`}
          >
            {tab} Results
          </button>
        ))}
      </div>

      {/* ── Results List ── */}
      <div className="grid grid-cols-1 gap-4">
        {filteredScans.length === 0 ? (
          <div className="dark-card p-12 text-center text-gray-500 border-dashed border-2 border-[var(--border)]">
            <List size={40} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">No {activeTab} scans found. Start a scan above.</p>
          </div>
        ) : (
          filteredScans.map(scan => (
            <ScanResultCard key={scan._id} scan={scan} onDelete={handleDelete} />
          ))
        )}
      </div>
    </Layout>
  );
};

const ScanResultCard = ({ scan, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const statusColors = {
    running: 'text-cyan-400 bg-cyan-400/10 border-cyan-500/20',
    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20',
    failed: 'text-rose-400 bg-rose-400/10 border-rose-500/20'
  };

  return (
    <div className="dark-card overflow-hidden bg-[var(--bg2)] border border-[var(--border)] rounded-xl transition-all hover:border-indigo-500/30">
      <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-lg bg-[var(--bg-d)] border border-[var(--border)]`}>
            {scan.type === 'subdomain' && <Search size={20} className="text-cyan-400" />}
            {scan.type === 'network' && <Wifi size={20} className="text-indigo-400" />}
            {scan.type === 'webapp' && <Shield size={20} className="text-emerald-400" />}
            {scan.type === 'recon' && <Users size={20} className="text-rose-400" />}
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">{scan.target}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-bold uppercase tracking-widest">
              <span className={`px-2 py-0.5 rounded border ${statusColors[scan.status]}`}>
                {scan.status}
              </span>
              <span className="flex items-center gap-1"><Clock size={12} /> {new Date(scan.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Trash2 
            size={18} 
            className="text-gray-600 hover:text-rose-500 transition-colors cursor-pointer" 
            onClick={(e) => {
              e.stopPropagation(); // Don't expand the card when clicking delete
              onDelete(scan._id);
            }} 
          />
          <div className="text-gray-500 hover:text-white transition-colors">
            {expanded ? <ExternalLink size={20} /> : <div className="p-2 rounded-full hover:bg-gray-800"><List size={20} /></div>}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-d)] text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          {scan.status === 'completed' && scan.result ? (
            <ResultRenderer type={scan.type} result={scan.result} />
          ) : (
            <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-3">
              {scan.status === 'running' ? (
                <>
                  <Loader2 className="animate-spin text-cyan-400" size={32} />
                  <p className="font-bold">Gathering intel from Kali Linux...</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="text-rose-400" size={32} />
                  <p className="font-bold">Scan failed: {scan.result?.error || 'Unknown error'}</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ResultRenderer = ({ type, result }) => {
  if (type === 'network') {
    return (
      <div className="space-y-4">
        <h4 className="text-indigo-400 font-bold flex items-center gap-2"><Wifi size={16} /> Open Ports & Services</h4>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-left text-xs bg-[var(--bg2)]">
            <thead className="bg-[#1a1b2e] text-gray-400 uppercase tracking-wider font-bold">
              <tr>
                <th className="p-3 border-b border-[var(--border)]">Port</th>
                <th className="p-3 border-b border-[var(--border)]">Protocol</th>
                <th className="p-3 border-b border-[var(--border)]">Service</th>
                <th className="p-3 border-b border-[var(--border)]">Version</th>
              </tr>
            </thead>
            <tbody>
              {result.ports && result.ports.length > 0 ? result.ports.map((p, i) => (
                <tr key={i} className="hover:bg-indigo-500/5 transition-colors border-b border-[var(--border)]/50">
                  <td className="p-3 text-white font-bold">{p.port}</td>
                  <td className="p-3 text-gray-400">{p.protocol}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20">{p.service}</span></td>
                  <td className="p-3 text-gray-300 font-mono">{p.version || 'unknown'}</td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="p-10 text-center text-gray-600">No open ports identified.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === 'subdomain') {
    return (
      <div>
        <h4 className="text-cyan-400 font-bold mb-4 flex items-center gap-2"><Search size={16} /> Discovered Subdomains ({result.count})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {result.subdomains && result.subdomains.map((sub, i) => (
            <div key={i} className="p-2 px-3 bg-[#1a1b2e] border border-[var(--border)] rounded-lg text-white font-mono text-xs flex items-center justify-between group hover:border-cyan-500/40 transition-all">
              {sub}
              <ExternalLink size={12} className="text-gray-700 group-hover:text-cyan-400 cursor-pointer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'webapp') {
    return (
      <div>
        <h4 className="text-emerald-400 font-bold mb-4 flex items-center gap-2"><Shield size={16} /> Web Vulnerability Findings</h4>
        <div className="space-y-2">
          {result.findings && result.findings.map((f, i) => (
            <div key={i} className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex items-start gap-3">
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 mt-0.5 flex-shrink-0" />
              <p className="text-gray-300 leading-relaxed text-xs">{f}</p>
            </div>
          ))}
          {(!result.findings || result.findings.length === 0) && (
            <p className="text-gray-500 italic p-4 text-center">No high-risk vulnerabilities flagged in initial sweep.</p>
          )}
        </div>
      </div>
    );
  }

  if (type === 'recon') {
    return (
      <div className="space-y-6">
        {/* Counts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="text-rose-400" size={18} />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Emails Found</span>
            </div>
            <div className="text-2xl font-black text-white">{result.summary?.totalEmails || 0}</div>
          </div>
          <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Globe className="text-cyan-400" size={18} />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subdomains</span>
            </div>
            <div className="text-2xl font-black text-white">{result.summary?.totalSubdomains || 0}</div>
          </div>
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Wifi className="text-indigo-400" size={18} />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">IPs Linked</span>
            </div>
            <div className="text-2xl font-black text-white">{result.summary?.totalIPs || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email List */}
          <div>
            <h4 className="text-rose-400 font-bold mb-3 flex items-center gap-2 text-sm"><Mail size={16} /> Discovered Emails</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {result.emails && result.emails.map((email, i) => (
                <div key={i} className="p-2.5 px-3 bg-[#1a1b2e] border border-[var(--border)] rounded-lg text-gray-300 text-xs truncate">
                  {email}
                </div>
              ))}
              {(!result.emails || result.emails.length === 0) && <p className="text-gray-600 text-xs p-4 border border-dashed border-[var(--border)] rounded-lg text-center">No emails found.</p>}
            </div>
          </div>

          {/* IP List */}
          <div>
            <h4 className="text-indigo-400 font-bold mb-3 flex items-center gap-2 text-sm"><Wifi size={16} /> Related IP Addresses</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {result.ips && result.ips.map((ip, i) => (
                <div key={i} className="p-2.5 px-3 bg-[#1a1b2e] border border-[var(--border)] rounded-lg text-gray-300 font-mono text-xs">
                  {ip}
                </div>
              ))}
              {(!result.ips || result.ips.length === 0) && <p className="text-gray-600 text-xs p-4 border border-dashed border-[var(--border)] rounded-lg text-center">No IPs found.</p>}
            </div>
          </div>
        </div>

        {/* Subdomains Table */}
        <div>
          <h4 className="text-cyan-400 font-bold mb-3 flex items-center gap-2 text-sm"><Globe size={16} /> Infrastructure Discovery</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {result.subdomains && result.subdomains.map((sub, i) => (
              <div key={i} className="p-2 px-3 bg-[#1a1b2e] border border-[var(--border)] rounded-lg text-white font-mono text-[10px] flex items-center justify-between group hover:border-cyan-500/40 transition-all">
                {sub}
                <ExternalLink size={10} className="text-gray-700 group-hover:text-cyan-400 cursor-pointer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <pre className="text-xs text-gray-500 break-all bg-[#0d0e1b] p-4 rounded-lg">{JSON.stringify(result, null, 2)}</pre>;
};

export default Scans;
