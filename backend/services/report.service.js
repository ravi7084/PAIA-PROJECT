/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Report Service                      ║
 * ║   Report storage & PDF generation            ║
 * ╚══════════════════════════════════════════════╝
 */

const Report = require('../models/report.model');
const ScanSession = require('../models/scanSession.model');
const logger = require('../utils/logger');

/**
 * Create report from a completed ScanSession
 */
const createReportFromSession = async (scanSessionId, userId) => {
  const session = await ScanSession.findOne({ _id: scanSessionId, user_id: userId });
  if (!session) throw new Error('Scan session not found');
  if (session.status !== 'completed') throw new Error('Scan not yet completed');

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  (session.vulnerabilities || []).forEach((v) => {
    if (severityCounts[v.severity] !== undefined) severityCounts[v.severity]++;
  });

  const report = await Report.create({
    user_id: userId,
    scanSession_id: scanSessionId,
    target: session.target,
    title: `Penetration Test Report — ${session.target}`,
    format: 'json',
    executiveSummary: session.report?.executiveSummary || '',
    scope: session.scope || 'full',
    methodology: session.report?.technicalDetails || 'Automated AI-driven penetration testing using PAIA',
    findings: session.vulnerabilities.map((v) => ({
      title: v.title,
      severity: v.severity,
      cvss: v.cvss,
      description: v.description,
      evidence: v.evidence,
      remediation: v.remediation,
      cveId: v.cveId,
      tool: v.tool,
    })),
    riskScore: session.report?.riskScore || 0,
    severityCounts,
    recommendations: session.report?.recommendations || [],
    conclusion: `Scan completed at ${session.finishedAt?.toISOString() || 'N/A'}. ${session.vulnerabilities.length} findings identified.`,
  });

  logger.info(`Report created: ${report._id} for session ${scanSessionId}`);
  return report;
};

module.exports = { createReportFromSession };
