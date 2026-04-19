/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Dashboard Controller                ║
 * ║   Historical events & feed hydration         ║
 * ╚══════════════════════════════════════════════╝
 */

const ReconScan = require('../models/reconScan.model');
const NetworkResult = require('../models/NetworkResult');
const WebScanResult = require('../models/WebScanResult');
const ScanSession = require('../models/scanSession.model');
const logger = require('../utils/logger');

/**
 * GET /api/user/dashboard-events
 * Aggregates findings from all intelligence sources
 */
const getDashboardEvents = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const events = [];

    // 1. Fetch AI Agent Scan Sessions (The highest fidelity data)
    const aiSessions = await ScanSession.find({ user_id: userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('vulnerabilities target updatedAt report status');

    aiSessions.forEach(session => {
      // Add a 'session summary' event
      events.push({
        id: `ai-session-${session._id}`,
        timestamp: session.updatedAt,
        source: 'ai-pentester',
        target: session.target,
        title: `AI Penetration Test ${session.status === 'completed' ? 'Finalized' : 'Updated'}`,
        severity: session.report?.riskScore >= 70 ? 'critical' : session.report?.riskScore >= 40 ? 'high' : 'medium',
        meta: `${session.vulnerabilities?.length || 0} vulnerabilities identified`,
        riskScore: session.report?.riskScore || 0,
      });

      // Add individual findings if they are high severity
      (session.vulnerabilities || []).forEach(v => {
        if (v.severity === 'critical' || v.severity === 'high') {
          events.push({
            id: `ai-vuln-${v._id || Math.random()}`,
            timestamp: session.updatedAt,
            source: 'ai-pentester',
            target: session.target,
            title: v.title,
            severity: v.severity,
            meta: v.type,
            riskScore: v.cvss * 10 || 70,
          });
        }
      });
    });

    // 2. Fetch Traditional Recon Scans
    const reconScans = await ReconScan.find({ user_id: userId })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('findings target updatedAt');

    reconScans.forEach(scan => {
      (scan.findings || []).forEach(finding => {
        events.push({
          id: `recon-${scan._id}-${finding.type}-${finding.value}`,
          timestamp: scan.updatedAt,
          source: 'recon-agent',
          target: scan.target,
          title: formatFindingTitle(finding),
          severity: finding.severity,
          meta: finding.value,
          riskScore: finding.severity === 'high' ? 80 : finding.severity === 'medium' ? 50 : 20,
        });
      });
    });

    // 3. Fetch Network Scans (Nmap)
    const networkScans = await NetworkResult.find({}) // Note: Add user_id to NetworkResult model later if needed
      .sort({ timestamp: -1 })
      .limit(5);

    networkScans.forEach(scan => {
      events.push({
        id: `network-${scan._id}`,
        timestamp: scan.timestamp,
        source: 'network-scanner',
        target: scan.domain,
        title: 'Infrastructure Scan Completed',
        severity: 'info',
        meta: 'Port scan results analyzed',
        riskScore: 30,
      });
    });

    // 4. Fetch Web Scans
    const webScans = await WebScanResult.find({})
      .sort({ timestamp: -1 })
      .limit(5);

    webScans.forEach(scan => {
      events.push({
        id: `web-${scan._id}`,
        timestamp: scan.timestamp,
        source: 'web-analyzer',
        target: scan.domain || scan.target,
        title: 'Web Surface Analysis',
        severity: 'medium',
        meta: 'Application security headers check',
        riskScore: 45,
      });
    });

    // Sort all events by timestamp and take the top 50
    const sortedEvents = events
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);

    res.json({
      success: true,
      data: { events: sortedEvents },
    });
  } catch (err) {
    logger.error(`Error fetching dashboard events: ${err.message}`);
    next(err);
  }
};

/**
 * Helper to format finding title for dashboard
 */
function formatFindingTitle(finding) {
  const typeLabels = {
    vulnerability: 'Vulnerability Detected',
    web_vulnerability: 'Web Security Alert',
    port: 'Open Port Discovered',
    service: 'Service Identified',
    email: 'Email Disclosure',
    subdomain: 'New Subdomain Found',
    dns_record: 'DNS Record identified',
    ip: 'Associated IP Found',
  };

  return typeLabels[finding.type] || `Security Finding: ${finding.type}`;
}

module.exports = {
  getDashboardEvents,
};
