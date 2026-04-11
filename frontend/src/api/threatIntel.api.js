import api from './axios.config';

export const lookupAll = async (target) => {
  const res = await api.get(`/threat-intel/all/${encodeURIComponent(target)}`);
  return res.data?.data || {};
};

export const lookupShodan = async (target) => {
  const res = await api.get(`/threat-intel/shodan/${encodeURIComponent(target)}`);
  return res.data?.data || {};
};

export const lookupVirusTotal = async (target) => {
  const res = await api.get(`/threat-intel/virustotal/${encodeURIComponent(target)}`);
  return res.data?.data || {};
};

export const lookupWhois = async (target) => {
  const res = await api.get(`/threat-intel/whois/${encodeURIComponent(target)}`);
  return res.data?.data || {};
};

export const lookupAbuseIPDB = async (ip) => {
  const res = await api.get(`/threat-intel/abuseipdb/${encodeURIComponent(ip)}`);
  return res.data?.data || {};
};

export const lookupHunter = async (domain) => {
  const res = await api.get(`/threat-intel/hunter/${encodeURIComponent(domain)}`);
  return res.data?.data || {};
};

export const lookupOTX = async (target) => {
  const res = await api.get(`/threat-intel/otx/${encodeURIComponent(target)}`);
  return res.data?.data || {};
};

export const lookupCensys = async (target) => {
  const res = await api.get(`/threat-intel/censys/${encodeURIComponent(target)}`);
  return res.data?.data || {};
};
