import api from './axios.config';

export const startAIScan = async (target, scope = 'full', targetId = null) => {
  const res = await api.post('/ai-agent/run', { target, scope, targetId });
  return res.data?.data || {};
};

export const getAIScanStatus = async (scanId) => {
  const res = await api.get(`/ai-agent/status/${scanId}`);
  return res.data?.data?.session || null;
};

export const stopAIScan = async (scanId) => {
  const res = await api.post(`/ai-agent/stop/${scanId}`);
  return res.data?.data || {};
};

export const getAIScanHistory = async () => {
  const res = await api.get('/ai-agent/history');
  return res.data?.data?.sessions || [];
};

export const deleteAIScan = async (scanId) => {
  const res = await api.delete(`/ai-agent/${scanId}`);
  return res.data?.data || {};
};

export const generateReport = async (scanSessionId) => {
  const res = await api.post('/reports/generate', { scanSessionId });
  return res.data?.data?.report || null;
};

export const listReports = async () => {
  const res = await api.get('/reports');
  return res.data?.data?.reports || [];
};

export const getReport = async (reportId) => {
  const res = await api.get(`/reports/${reportId}`);
  return res.data?.data?.report || null;
};

export const deleteReport = async (reportId) => {
  const res = await api.delete(`/reports/${reportId}`);
  return res.data;
};
