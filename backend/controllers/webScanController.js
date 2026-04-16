/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Web Scan Controller                ║
 * ║   Handles Webapp Vulnerability endpoints     ║
 * ╚══════════════════════════════════════════════╝
 */

const webScanService = require('../services/webScanService');
const logger = require('../utils/logger');

/**
 * POST /api/scan/web
 * Starts a web vulnerability scan
 */
const performWebScan = async (req, res) => {
  try {
    const { target, advanced, runZap } = req.body;

    if (!target) {
      return res.status(400).json({ success: false, message: 'Target URL is required' });
    }

    // Validation update: must start with http:// or https://
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid target. Web scans require a full URL (e.g., http://example.com)' 
      });
    }

    logger.info(`Web scan requested for target: ${target}`);
    const result = await webScanService.runWebScan(target, { advanced, runZap });

    return res.status(200).json(result);
  } catch (err) {
    logger.error(`Controller Error [performWebScan]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform web vulnerability scan',
      error: err.message
    });
  }
};

/**
 * GET /api/scan/web/recent
 * Fetches recent web scan results
 */
const getRecentWebScans = async (req, res) => {
  try {
    const { target } = req.query;
    const results = await webScanService.getRecentWebScans(target);
    return res.status(200).json({ success: true, results });
  } catch (err) {
    logger.error(`Controller Error [getRecentWebScans]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent web scans'
    });
  }
};

module.exports = {
  performWebScan,
  getRecentWebScans
};
