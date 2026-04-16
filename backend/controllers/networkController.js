/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Network Controller                  ║
 * ║   Handles network scanning API requests      ║
 * ╚══════════════════════════════════════════════╝
 */

const networkService = require('../services/networkService');
const logger = require('../utils/logger');

/**
 * POST /api/scan/network
 * Initiates a network scan using Nmap
 */
const performNetworkScan = async (req, res) => {
  try {
    const { target } = req.body;

    if (!target) {
      return res.status(400).json({ success: false, message: 'Target is required' });
    }

    // Basic target validation (allow domain or IP)
    const targetRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}|(\d{1,3}\.){3}\d{1,3}$/i;
    if (!targetRegex.test(target) && target !== 'localhost') {
        return res.status(400).json({ success: false, message: 'Invalid target format. Please provide a domain or IP.' });
    }

    logger.info(`Network scan requested for: ${target}`);
    const result = await networkService.runNetworkScan(target);

    return res.status(200).json(result);
  } catch (err) {
    logger.error(`Controller Error [performNetworkScan]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform network scan',
      error: err.message
    });
  }
};

/**
 * GET /api/scan/network/recent
 * Fetches recent scan results
 */
const getRecentNetworkResults = async (req, res) => {
  try {
    const { domain } = req.query;
    const results = await networkService.getRecentNetworkResults(domain);
    return res.status(200).json({ success: true, results });
  } catch (err) {
    logger.error(`Controller Error [getRecentNetworkResults]: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent network results'
    });
  }
};

module.exports = {
  performNetworkScan,
  getRecentNetworkResults
};
