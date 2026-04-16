/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Recon Controller                    ║
 * ║   Handles Subdomain/DNS discovery requests   ║
 * ╚══════════════════════════════════════════════╝
 */

const reconService = require('../services/reconService');
const ReconResult = require('../models/ReconResult');
const logger = require('../utils/logger');

/**
 * POST /api/recon
 * Initiates subdomain enumeration and DNS analysis
 */
const performRecon = async (req, res) => {
  try {
    const { domain } = req.body;

    // 1. Basic Validation
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required in request body.'
      });
    }

    // Advanced Regex for Domain validation
    const domainRegex = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
    if (!domainRegex.test(domain.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format. Example: example.com'
      });
    }

    logger.info(`Received recon request for domain: ${domain}`);

    // 2. Call Service
    const data = await reconService.runRecon(domain.trim());

    // 3. Return Success Output
    res.status(200).json({
      success: true,
      total: data.length,
      data: data
    });

  } catch (err) {
    logger.error(`Controller Error [performRecon]: ${err.message}`);

    // Error handling based on type
    if (err.message.includes('Amass is not installed')) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to perform subdomain reconnaissance and DNS analysis.',
      error: err.message
    });
  }
};

/**
 * GET /api/recon/subdomain/recent
 * Fetches recent subdomain/DNS results
 */
const getRecentReconResults = async (req, res) => {
  try {
    const { domain } = req.query;
    const query = domain ? { domain: domain.trim() } : {};
    
    // Get latest entries, grouping by domain might be better but for now let's just get the last 50
    const results = await ReconResult.find(query)
      .sort({ timestamp: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (err) {
    logger.error(`Controller Error [getRecentReconResults]: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent results.'
    });
  }
};

module.exports = { performRecon, getRecentReconResults };
