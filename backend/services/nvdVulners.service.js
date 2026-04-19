/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — NVD + Vulners Service               ║
 * ║   Real-world CVE lookup & exploit search     ║
 * ║   + Real risk score calculation              ║
 * ╚══════════════════════════════════════════════╝
 */

const axios = require('axios');
const logger = require('../utils/logger');

/* ── NVD API v2 ─────────────────────────────────── */

/**
 * Look up a specific CVE by ID from NVD
 */
const nvdLookupCVE = async (cveId) => {
  const apiKey = process.env.NVD_API_KEY;
  if (!apiKey || !cveId) return null;

  try {
    const { data } = await axios.get('https://services.nvd.nist.gov/rest/json/cves/2.0', {
      params: { cveId },
      headers: { apiKey },
      timeout: 15000,
    });

    const cve = data?.vulnerabilities?.[0]?.cve;
    if (!cve) return null;

    const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || {};
    const cvssData = metrics.cvssData || {};

    return {
      cveId: cve.id,
      description: (cve.descriptions || []).find(d => d.lang === 'en')?.value || '',
      cvssScore: cvssData.baseScore || 0,
      cvssVector: cvssData.vectorString || '',
      severity: cvssData.baseSeverity || metrics.baseSeverity || 'UNKNOWN',
      exploitabilityScore: metrics.exploitabilityScore || 0,
      impactScore: metrics.impactScore || 0,
      published: cve.published || '',
      lastModified: cve.lastModified || '',
      references: (cve.references || []).slice(0, 5).map(r => ({
        url: r.url,
        source: r.source,
        tags: r.tags || [],
      })),
      weaknesses: (cve.weaknesses || []).map(w => ({
        type: w.type,
        description: (w.description || []).map(d => d.value).join(', '),
      })),
    };
  } catch (err) {
    logger.warn('NVD CVE lookup failed for ' + cveId + ': ' + err.message);
    return null;
  }
};

/**
 * Search NVD by keyword (e.g., "Apache 2.4.49", "OpenSSH 7.6")
 */
const nvdKeywordSearch = async (keyword) => {
  const apiKey = process.env.NVD_API_KEY;
  if (!apiKey || !keyword) return [];

  try {
    const { data } = await axios.get('https://services.nvd.nist.gov/rest/json/cves/2.0', {
      params: { keywordSearch: keyword, resultsPerPage: 5 },
      headers: { apiKey },
      timeout: 20000,
    });

    return (data?.vulnerabilities || []).map(v => {
      const cve = v.cve;
      const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || {};
      const cvssData = metrics.cvssData || {};

      return {
        cveId: cve.id,
        description: (cve.descriptions || []).find(d => d.lang === 'en')?.value || '',
        cvssScore: cvssData.baseScore || 0,
        severity: cvssData.baseSeverity || 'UNKNOWN',
        exploitabilityScore: metrics.exploitabilityScore || 0,
        published: cve.published || '',
      };
    });
  } catch (err) {
    logger.warn('NVD keyword search failed for "' + keyword + '": ' + err.message);
    return [];
  }
};


/* ── Vulners API ────────────────────────────────── */

/**
 * Search Vulners for exploits, advisories, and threat data
 */
const vulnersSearch = async (query) => {
  const apiKey = process.env.VULNERS_API_KEY;
  if (!apiKey || !query) return [];

  try {
    const { data } = await axios.post('https://vulners.com/api/v3/search/lucene/', {
      query: query,
      skip: 0,
      size: 10,
      apiKey: apiKey,
    }, { timeout: 15000 });

    if (!data?.data?.search) return [];

    return (data.data.search || []).map(item => ({
      id: item._id || '',
      title: item._source?.title || '',
      type: item._source?.type || '',
      bulletinFamily: item._source?.bulletinFamily || '',
      cvss: item._source?.cvss?.score || 0,
      description: (item._source?.description || '').slice(0, 500),
      published: item._source?.published || '',
      href: item._source?.href || '',
      exploitAvailable: item._source?.type === 'exploit' || (item._source?.bulletinFamily || '').toLowerCase() === 'exploit',
    }));
  } catch (err) {
    logger.warn('Vulners search failed for "' + query + '": ' + err.message);
    return [];
  }
};

/**
 * Check if exploits exist for a given CVE via Vulners
 */
const vulnersCheckExploit = async (cveId) => {
  const apiKey = process.env.VULNERS_API_KEY;
  if (!apiKey || !cveId) return { hasExploit: false, exploits: [] };

  try {
    const { data } = await axios.post('https://vulners.com/api/v3/search/lucene/', {
      query: 'type:exploit AND ' + cveId,
      skip: 0,
      size: 5,
      apiKey: apiKey,
    }, { timeout: 15000 });

    const results = data?.data?.search || [];
    return {
      hasExploit: results.length > 0,
      exploitCount: results.length,
      exploits: results.map(item => ({
        id: item._id || '',
        title: item._source?.title || '',
        href: item._source?.href || '',
        published: item._source?.published || '',
      })),
    };
  } catch (err) {
    logger.warn('Vulners exploit check failed for ' + cveId + ': ' + err.message);
    return { hasExploit: false, exploits: [] };
  }
};


/* ── Enrichment: Add real NVD/Vulners data to vulnerabilities ── */

/**
 * Enrich an array of vulnerability findings with real NVD data
 * + check for exploit availability via Vulners
 */
const enrichVulnerabilities = async (vulnerabilities) => {
  if (!Array.isArray(vulnerabilities) || vulnerabilities.length === 0) return vulnerabilities;

  const enriched = [];
  // Rate-limit NVD requests (6 second delay between calls with API key)
  for (let i = 0; i < vulnerabilities.length; i++) {
    const vuln = { ...vulnerabilities[i] };

    try {
      // 1. If CVE ID exists, look up real data from NVD
      if (vuln.cveId && vuln.cveId.match(/^CVE-\d{4}-\d+$/i)) {
        if (i > 0) await new Promise(r => setTimeout(r, 700)); // NVD rate limit

        const nvdData = await nvdLookupCVE(vuln.cveId);
        if (nvdData) {
          vuln.nvdData = nvdData;
          vuln.cvss = nvdData.cvssScore || vuln.cvss;
          vuln.description = nvdData.description || vuln.description;
          vuln.severity = mapCvssSeverity(nvdData.cvssScore) || vuln.severity;
        }

        // 2. Check Vulners for exploit availability
        const exploitData = await vulnersCheckExploit(vuln.cveId);
        vuln.exploitAvailable = exploitData.hasExploit;
        vuln.exploitData = exploitData;
      }

      // 3. If we have a service/version string, search NVD by keyword
      if (!vuln.cveId && vuln.evidence && vuln.evidence.length > 5) {
        const keyword = extractServiceKeyword(vuln.evidence || vuln.title);
        if (keyword) {
          const nvdResults = await nvdKeywordSearch(keyword);
          if (nvdResults.length > 0) {
            vuln.relatedCVEs = nvdResults.slice(0, 3);
            // Use highest CVSS from related CVEs if our score is 0
            if (vuln.cvss === 0) {
              const highest = nvdResults.reduce((max, r) => r.cvssScore > max ? r.cvssScore : max, 0);
              if (highest > 0) vuln.cvss = highest;
            }
          }
        }
      }
    } catch (err) {
      logger.warn('Enrichment failed for vuln: ' + (vuln.title || 'unknown') + ' — ' + err.message);
    }

    enriched.push(vuln);
  }

  return enriched;
};


/* ── Real Risk Score Calculator ─────────────────── */

/**
 * Calculate real-world risk score based on:
 * - CVE severity scores (from NVD)
 * - Exploit availability (from Vulners)
 * - Exposure level (from Shodan/scan data)
 * - Number and criticality of findings
 */
const calculateRealRiskScore = (target, vulnerabilities, threatIntelData) => {
  if (!Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
    return {
      score: 5,
      level: 'info',
      breakdown: {
        vulnScore: 0,
        exploitScore: 0,
        exposureScore: 5,
        combinedScore: 5,
      },
      explanation: 'No vulnerabilities detected. Minimal risk from basic exposure.',
    };
  }

  // 1. Vulnerability severity score (0-40 points)
  let vulnScore = 0;
  const severityWeights = { critical: 10, high: 7, medium: 4, low: 1.5, info: 0.3 };
  for (const v of vulnerabilities) {
    const weight = severityWeights[v.severity] || 0.3;
    vulnScore += weight;
    // Bonus for high CVSS
    if (v.cvss >= 9.0) vulnScore += 5;
    else if (v.cvss >= 7.0) vulnScore += 3;
  }
  vulnScore = Math.min(40, vulnScore);

  // 2. Exploit availability score (0-30 points)
  let exploitScore = 0;
  for (const v of vulnerabilities) {
    if (v.exploitAvailable) exploitScore += 10;
    if (v.exploitData && v.exploitData.exploitCount > 1) exploitScore += 5;
  }
  exploitScore = Math.min(30, exploitScore);

  // 3. Exposure score — based on threat intel (0-30 points)
  let exposureScore = 5; // base exposure — it's on the internet
  if (Array.isArray(threatIntelData)) {
    for (const ti of threatIntelData) {
      if (!ti || ti.error) continue;
      // Shodan: open ports = more exposure
      if (ti.provider === 'shodan' && Array.isArray(ti.ports)) {
        exposureScore += Math.min(10, ti.ports.length * 1.5);
        if (ti.vulns && ti.vulns.length > 0) exposureScore += 5;
      }
      // VirusTotal: malicious detections
      if (ti.provider === 'virustotal') {
        if (ti.malicious > 0) exposureScore += Math.min(8, ti.malicious * 2);
        if (ti.suspicious > 0) exposureScore += ti.suspicious;
      }
      // AbuseIPDB: abuse history
      if (ti.provider === 'abuseipdb') {
        if (ti.abuseConfidenceScore > 50) exposureScore += 8;
        else if (ti.abuseConfidenceScore > 20) exposureScore += 4;
      }
    }
  }
  exposureScore = Math.min(30, exposureScore);

  // Combined score
  const combinedScore = Math.min(100, Math.round(vulnScore + exploitScore + exposureScore));

  // Risk level
  let level = 'info';
  if (combinedScore >= 80) level = 'critical';
  else if (combinedScore >= 60) level = 'high';
  else if (combinedScore >= 35) level = 'medium';
  else if (combinedScore >= 15) level = 'low';

  // Explanation
  const exploitCount = vulnerabilities.filter(v => v.exploitAvailable).length;
  const critCount = vulnerabilities.filter(v => v.severity === 'critical').length;
  const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

  let explanation = `Risk score ${combinedScore}/100 for ${target}. `;
  explanation += `Found ${vulnerabilities.length} vulnerabilities (${critCount} critical, ${highCount} high). `;
  if (exploitCount > 0) explanation += `⚠️ ${exploitCount} vulnerabilities have known public exploits. `;
  if (exposureScore > 15) explanation += `High internet exposure detected. `;

  return {
    score: combinedScore,
    level,
    breakdown: { vulnScore: Math.round(vulnScore), exploitScore, exposureScore, combinedScore },
    explanation,
  };
};

/* ── Helpers ── */
const mapCvssSeverity = (score) => {
  if (!score) return null;
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  if (score >= 0.1) return 'low';
  return 'info';
};

const extractServiceKeyword = (text) => {
  if (!text) return null;
  // Try to extract service name + version like "Apache/2.4.49" or "OpenSSH 7.6"
  const match = text.match(/(?:Apache|Nginx|OpenSSH|IIS|Tomcat|MySQL|PostgreSQL|PHP|Node\.js|Express|WordPress|jQuery|Bootstrap)[\s\/]*[\d.]+/i);
  return match ? match[0] : null;
};


module.exports = {
  nvdLookupCVE,
  nvdKeywordSearch,
  vulnersSearch,
  vulnersCheckExploit,
  enrichVulnerabilities,
  calculateRealRiskScore,
};
