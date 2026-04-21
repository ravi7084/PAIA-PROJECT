/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Threat Intelligence Service         ║
 * ║   API-based lookups: VirusTotal, WHOIS,      ║
 * ║   AbuseIPDB, OTX                             ║
 * ╚══════════════════════════════════════════════╝
 */

const axios = require('axios');
const dns = require('dns').promises;
const ThreatIntel = require('../models/threatIntel.model');
const logger = require('../utils/logger');

const resolveToIP = async (target) => {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(target)) return target;
  try {
    const recs = await dns.lookup(target);
    return recs.address;
  } catch (err) { return null; }
};

const safe = (fn, label) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    logger.error(`ThreatIntel [${label}] error: ${err.message}`);
    return { error: err.message, provider: label };
  }
};

/* ───────── Cache helper ───────── */
const getCached = async (target, provider) => {
  const hit = await ThreatIntel.findOne({ target, provider, expiresAt: { $gt: new Date() } });
  return hit ? hit.data : null;
};

const saveCache = async (target, provider, data) => {
  await ThreatIntel.findOneAndUpdate(
    { target, provider },
    { data, queriedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), error: null },
    { upsert: true, new: true }
  );
};


/* ───────────────────────────────────────────────
   3. WHOIS (WhoisXMLAPI)
   Docs: https://whoisxmlapi.com/documentation
   ─────────────────────────────────────────────── */
const whoisLookup = safe(async (target) => {
  const key = process.env.WHOISXML_API_KEY;
  if (!key) return { provider: 'whois', skipped: true, reason: 'No API key' };

  const cached = await getCached(target, 'whois');
  if (cached) return { provider: 'whois', cached: true, ...cached };

  const { data } = await axios.get('https://www.whoisxmlapi.com/whoisserver/WhoisService', {
    params: { apiKey: key, domainName: target, outputFormat: 'JSON' },
    timeout: 15000,
  });

  const rec = data?.WhoisRecord || {};
  const result = {
    provider: 'whois',
    domainName: rec.domainName || target,
    registrar: rec.registrarName || '',
    createdDate: rec.createdDate || '',
    expiresDate: rec.expiresDate || '',
    updatedDate: rec.updatedDate || '',
    nameServers: rec.nameServers?.hostNames || [],
    registrant: {
      organization: rec.registrant?.organization || '',
      country: rec.registrant?.country || '',
      state: rec.registrant?.state || '',
    },
    status: rec.status || '',
    contactEmail: rec.contactEmail || '',
  };

  await saveCache(target, 'whois', result);
  return result;
}, 'whois');

/* ───────────────────────────────────────────────
   4. VIRUSTOTAL
   Docs: https://docs.virustotal.com/reference
   ─────────────────────────────────────────────── */
const virusTotalLookup = safe(async (target) => {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) return { provider: 'virustotal', skipped: true, reason: 'No API key' };

  const cached = await getCached(target, 'virustotal');
  if (cached) return { provider: 'virustotal', cached: true, ...cached };

  const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(target);
  const endpoint = isIp
    ? `https://www.virustotal.com/api/v3/ip_addresses/${target}`
    : `https://www.virustotal.com/api/v3/domains/${target}`;

  const { data } = await axios.get(endpoint, {
    headers: { 'x-apikey': key },
    timeout: 15000,
  });

  const attr = data?.data?.attributes || {};
  const stats = attr.last_analysis_stats || {};
  const result = {
    provider: 'virustotal',
    target,
    reputation: attr.reputation ?? 0,
    malicious: stats.malicious || 0,
    suspicious: stats.suspicious || 0,
    harmless: stats.harmless || 0,
    undetected: stats.undetected || 0,
    totalEngines: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0),
    categories: attr.categories || {},
    lastAnalysisDate: attr.last_analysis_date ? new Date(attr.last_analysis_date * 1000).toISOString() : '',
    whois: (attr.whois || '').slice(0, 1000),
    tags: attr.tags || [],
  };

  await saveCache(target, 'virustotal', result);
  return result;
}, 'virustotal');

/* ───────────────────────────────────────────────
   5. ABUSEIPDB
   Docs: https://docs.abuseipdb.com
   ─────────────────────────────────────────────── */
const abuseIPDBLookup = safe(async (ip) => {
  const key = process.env.ABUSEIPDB_API_KEY;
  if (!key) return { provider: 'abuseipdb', skipped: true, reason: 'No API key' };
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) return { provider: 'abuseipdb', skipped: true, reason: 'Not an IP address' };

  const cached = await getCached(ip, 'abuseipdb');
  if (cached) return { provider: 'abuseipdb', cached: true, ...cached };

  const { data } = await axios.get('https://api.abuseipdb.com/api/v2/check', {
    params: { ipAddress: ip, maxAgeInDays: 90, verbose: '' },
    headers: { Key: key, Accept: 'application/json' },
    timeout: 15000,
  });

  const d = data?.data || {};
  const result = {
    provider: 'abuseipdb',
    ipAddress: d.ipAddress || ip,
    isPublic: d.isPublic,
    abuseConfidenceScore: d.abuseConfidenceScore || 0,
    totalReports: d.totalReports || 0,
    lastReportedAt: d.lastReportedAt || '',
    isp: d.isp || '',
    domain: d.domain || '',
    countryCode: d.countryCode || '',
    usageType: d.usageType || '',
    isTor: d.isTor || false,
    isWhitelisted: d.isWhitelisted || false,
  };

  await saveCache(ip, 'abuseipdb', result);
  return result;
}, 'abuseipdb');


/* ───────────────────────────────────────────────
   7. ALIENVAULT OTX
   Docs: https://otx.alienvault.com/api
   ─────────────────────────────────────────────── */
const otxLookup = safe(async (target) => {
  const key = process.env.OTX_API_KEY;
  if (!key) return { provider: 'otx', skipped: true, reason: 'No API key' };

  const cached = await getCached(target, 'otx');
  if (cached) return { provider: 'otx', cached: true, ...cached };

  const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(target);
  const section = isIp ? 'IPv4' : 'domain';
  const endpoint = `https://otx.alienvault.com/api/v1/indicators/${section}/${target}/general`;

  const { data } = await axios.get(endpoint, {
    headers: { 'X-OTX-API-KEY': key },
    timeout: 15000,
  });

  const result = {
    provider: 'otx',
    target,
    pulseCount: data.pulse_info?.count || 0,
    pulses: (data.pulse_info?.pulses || []).slice(0, 10).map((p) => ({
      name: p.name,
      description: (p.description || '').slice(0, 200),
      tags: p.tags || [],
      created: p.created,
      modified: p.modified,
      adversary: p.adversary || '',
      targetedCountries: p.targeted_countries || [],
    })),
    reputation: data.reputation || 0,
    country: data.country_name || '',
    asn: data.asn || '',
    sections: data.sections || [],
  };

  await saveCache(target, 'otx', result);
  return result;
}, 'otx');

/* ───────────────────────────────────────────────
   RUN ALL — parallel execution
   ─────────────────────────────────────────────── */
const runAllThreatIntel = async (target) => {
  const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(target);

  const tasks = [
    virusTotalLookup(target),
    otxLookup(target),
  ];

  if (isIp) {
    tasks.push(abuseIPDBLookup(target));
  } else {
    tasks.push(whoisLookup(target));
  }

  const results = await Promise.allSettled(tasks);

  return results.map((r) =>
    r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Unknown error' }
  );
};

module.exports = {
  whoisLookup,
  virusTotalLookup,
  abuseIPDBLookup,
  otxLookup,
  runAllThreatIntel,
};
