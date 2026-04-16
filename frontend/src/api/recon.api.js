import api from './axios.config';

const normalizeTarget = (raw) => String(raw || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

const isIp = (v) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(v);
const isDomain = (v) => /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i.test(v);

export const validateTargetInput = (raw) => {
  const target = normalizeTarget(raw);
  if (!target) return { ok: false, message: 'Target required' };
  if (!isIp(target) && !isDomain(target)) {
    return { ok: false, message: 'Enter valid domain/IP (example.com or 8.8.8.8)' };
  }
  return { ok: true, target };
};

export const createTargetAuto = async (target) => {
  const payload = {
    name: `Auto-${target}`,
    domain: isIp(target) ? '' : target,
    ip_address: isIp(target) ? target : '',
    scope: 'in-scope',
    target_type: 'web',
    description: 'Auto-created from dashboard quick recon',
    tags: ['auto-recon'],
    consentGiven: true
  };

  try {
    const res = await api.post('/targets', payload);
    return { success: true, target: res.data?.data?.target || null };
  } catch (err) {
    return {
      success: false,
      message: err?.response?.data?.message || 'Target create failed'
    };
  }
};

export const runReconAuto = async (target, tools, phase = 'recon') => {
  const defaultTools = phase === 'network'
    ? ['nmap', 'nessus']
    : phase === 'webapp'
      ? ['nikto', 'zap']
    : phase === 'subdomain'
      ? ['subfinder', 'amass']
      : ['theharvester', 'reconng', 'spiderfoot', 'maltego'];

  const res = await api.post('/recon/run', {
    target,
    phase,
    tools: Array.isArray(tools) && tools.length ? tools : defaultTools,
    mode: 'passive',
    timeoutMs: 120000,
    authorized: true
  });
  return res.data?.data;
};

export const listRecentRecon = async () => {
  const res = await api.get('/recon');
  return res.data?.data?.scans || [];
};

export const getReconScanById = async (scanId) => {
  const res = await api.get(`/recon/${scanId}`);
  return res.data?.data?.scan || null;
};

export const runSubdomainDNS = async (target) => {
  const res = await api.post('/recon', { domain: target });
  return res.data;
};

export const listRecentSubdomainDNS = async (domain = '') => {
  // Note: We'll need a backend route for this. I'll add one if needed.
  // For now, we hit the discovery endpoint and let it return data.
  // Actually, I'll create a GET route for recent results in the backend.
  const res = await api.get('/recon/subdomain/recent', { params: { domain } });
  return res.data?.data || [];
};

export const deleteReconScanById = async (scanId) => {
  const res = await api.delete(`/recon/${scanId}`);
  return res.data?.data || null;
};
