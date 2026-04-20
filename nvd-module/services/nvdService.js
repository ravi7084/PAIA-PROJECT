const axios = require('axios');
const config = require('../config/config');
const { getRiskPriority } = require('../utils/riskLevel');

/**
 * Service to interact with the NIST NVD API.
 */
class NVDService {
  /**
   * Fetches data for a single CVE ID from the NVD API.
   * @param {string} cveId - The CVE ID (e.g., CVE-2021-41773).
   * @returns {Object|null} - Structured vulnerability intelligence.
   */
  async fetchCVEData(cveId) {
    try {
      const headers = {};
      if (config.nvdApiKey) {
        headers['apiKey'] = config.nvdApiKey;
      }

      const response = await axios.get(config.nvdBaseUrl, {
        params: { cveId },
        headers: headers
      });

      const vulnerabilities = response.data.vulnerabilities;
      if (!vulnerabilities || vulnerabilities.length === 0) {
        return null;
      }

      const vuln = vulnerabilities[0].cve;
      return this._parseNVDResponse(vuln);
    } catch (error) {
      console.error(`Error fetching data for ${cveId}:`, error.message);
      throw new Error(`Failed to fetch NVD data for ${cveId}`);
    }
  }

  /**
   * Parses the raw NVD JSON response into a dashboard-ready format.
   * @param {Object} vuln - Raw CVE object from NVD.
   * @returns {Object} - Cleaned intelligence object.
   * @private
   */
  _parseNVDResponse(vuln) {
    const cveId = vuln.id;
    const description = vuln.descriptions.find(d => d.lang === 'en')?.value || 'No description available';
    const publishedDate = vuln.published;
    const lastModified = vuln.lastModified;

    // CVSS Selection Logic: V3.1 > V3.0 > V2.0
    let metrics = null;
    let cvssData = null;

    if (vuln.metrics.cvssMetricV31) {
      metrics = vuln.metrics.cvssMetricV31[0];
    } else if (vuln.metrics.cvssMetricV30) {
      metrics = vuln.metrics.cvssMetricV30[0];
    } else if (vuln.metrics.cvssMetricV2) {
      metrics = vuln.metrics.cvssMetricV2[0];
    }

    cvssData = metrics?.cvssData;

    const score = cvssData?.baseScore || 0;
    
    return {
      cveId,
      description,
      cvssScore: score,
      severity: cvssData?.baseSeverity || metrics?.baseSeverity || 'UNKNOWN',
      vector: cvssData?.vectorString || 'N/A',
      priority: getRiskPriority(score),
      publishedDate,
      lastModified
    };
  }
}

module.exports = new NVDService();
