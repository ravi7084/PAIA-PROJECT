/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Dashboard Controller                ║
 * ║   Historical events & feed hydration         ║
 * ╚══════════════════════════════════════════════╝
 */

const ReconScan = require('../models/reconScan.model');
const logger = require('../utils/logger');

/**
 * GET /api/user/dashboard-events
 * Fetches the most recent scan findings to hydrate the dashboard feed
 */
const getDashboardEvents = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch the 50 most recent completed/partial scans to extract findings
    // Alternatively, we can aggregate the most recent findings directly
    const scans = await ReconScan.find({ user_id: userId })
      .sort({ updatedAt: -1 })
      .limit(10) // Get last 10 scans
      .select('findings target updatedAt');

    const events = [];

    scans.forEach(scan => {
      scan.findings.forEach(finding => {
        events.push({
          id: `${scan._id}-${finding.type}-${finding.value}`, // Synthetic ID
          timestamp: scan.updatedAt,
          source: 'scan-center',
          target: scan.target,
          title: formatFindingTitle(finding),
          severity: finding.severity,
          meta: finding.value,
          riskScore: finding.severity === 'high' ? 80 : finding.severity === 'medium' ? 50 : 20,
        });
      });
    });

    // Sort events by timestamp and take the top 50
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
