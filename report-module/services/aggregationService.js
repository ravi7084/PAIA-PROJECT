const { getSeverityInfo, getRiskPriority } = require('../utils/riskLevel');

/**
 * Service to aggregate data from multiple modules into a unified vulnerability structure.
 */
class AggregationService {
  /**
   * Merges scanner results, CVE data, and logs.
   * @param {Object} input - Raw input containing multiple data streams.
   */
  async aggregate(input) {
    const { scanResults, cveData, logs, target } = input;
    
    // Normalize vulnerabilities
    const vulnerabilities = (cveData || []).map(cve => {
      const severity = getSeverityInfo(cve.cvssScore);
      return {
        title: cve.description ? cve.description.split('.')[0] : 'Security Vulnerability',
        cveId: cve.cveId,
        cvssScore: cve.cvssScore,
        severity: severity.label,
        severityColor: severity.color,
        priority: getRiskPriority(cve.cvssScore),
        description: cve.description,
        vector: cve.vector,
        published: cve.publishedDate,
        impact: this._determineImpact(cve.cvssScore),
        recommendation: this._generateRecommendation(cve.cveId, severity.label),
        affectedAssets: [target || 'Unknown Host'],
        evidence: logs ? 'See technical logs section' : 'Not Provided'
      };
    });

    // Create Summary
    const summary = {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter(v => v.severity === 'Critical').length,
      high: vulnerabilities.filter(v => v.severity === 'High').length,
      medium: vulnerabilities.filter(v => v.severity === 'Medium').length,
      low: vulnerabilities.filter(v => v.severity === 'Low').length,
      overallRisk: this._calculateOverallRisk(vulnerabilities),
      topIssues: vulnerabilities
        .sort((a, b) => b.cvssScore - a.cvssScore)
        .slice(0, 3)
        .map(v => v.cveId)
    };

    return {
      reportId: `REPORT-${Date.now()}`,
      target: target || 'All Systems',
      timestamp: new Date().toISOString(),
      summary,
      vulnerabilities,
      rawLogs: logs || scanResults || 'No logs provided'
    };
  }

  _determineImpact(score) {
    if (score >= 9) return 'Full system compromise, data exfiltration, or total service disruption.';
    if (score >= 7) return 'Unauthorized access to sensitive data or partial service interruption.';
    return 'Information disclosure or limited unauthorized activity.';
  }

  _generateRecommendation(cveId, severity) {
    if (severity === 'Critical' || severity === 'High') {
      return `Patch immediately and restrict network access to affected services. Verify fix with follow-up scan.`;
    }
    return `Schedule patch during next maintenance window. Monitor for exploit attempts.`;
  }

  _calculateOverallRisk(vulns) {
    if (vulns.some(v => v.severity === 'Critical')) return 'CRITICAL';
    if (vulns.some(v => v.severity === 'High')) return 'HIGH';
    if (vulns.some(v => v.severity === 'Medium')) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = new AggregationService();
