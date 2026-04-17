/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Web Scan Service                    ║
 * ║   Integrates Nikto and OWASP ZAP             ║
 * ╚══════════════════════════════════════════════╝
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const WebScanResult = require('../models/WebScanResult');
const { runExecutable, runCommand } = require('../utils/commandRunner');
const logger = require('../utils/logger');

// Paths
const NIKTO_BASE = path.join(__dirname, '../bin/nikto');
const NIKTO_PL = path.join(NIKTO_BASE, 'program', 'nikto.pl');
const WINDOWS_PERL = "C:\\Strawberry\\perl\\bin\\perl.exe";

// ZAP API Configuration (Default: Port 8080)
const ZAP_BASE_URL = process.env.ZAP_API_URL || 'http://127.0.0.1:8080';
const ZAP_API_KEY = process.env.ZAP_API_KEY || '';

/**
 * Executes a Nikto scan.
 */
const performNiktoScan = async (target, advanced = false) => {
  let perlBin = 'perl';
  try {
    // 1. Check for Perl (System or Windows Default)
    let isPerlInstalled = false;
    
    if (fs.existsSync(WINDOWS_PERL)) {
      perlBin = WINDOWS_PERL;
      isPerlInstalled = true;
      logger.info(`Using Windows default Perl: ${perlBin}`);
    } else {
      try {
        await runCommand('perl -v');
        isPerlInstalled = true;
      } catch (err) {
        // Not in system path
      }
    }

    if (!isPerlInstalled) {
      throw new Error('Perl is not installed. Nikto scan requires a Perl interpreter (e.g., Strawberry Perl).');
    }

    // 2. Check for Nikto
    if (!fs.existsSync(NIKTO_PL)) {
      throw new Error('Nikto not found. Please run the setup script to download Nikto.');
    }

    logger.info(`Starting Nikto scan for: ${target}`);
    
    // Command: perl nikto.pl -h <target>
    // -ssl: Force SSL mode for https targets
    // -nointeractive: Prevent hanging on prompts
    // -max-error 0: Keep scanning even if some SSL handshakes fail
    const args = ['-h', target, '-nointeractive', '-max-error', '0'];
    
    if (target.toLowerCase().startsWith('https')) {
      args.push('-ssl');
    }

    if (advanced) {
      args.push('-Tuning', '1,2,3,4,5,b,c'); // Better balanced tuning
    }

    const output = await runExecutable(perlBin, [NIKTO_PL, ...args], {
      timeout: 10 * 60 * 1000 // Increased to 10 minutes
    });

    return output;
  } catch (err) {
    logger.error(`Nikto scan error: ${err.message}`);
    return `[Nikto Error] ${err.message}`;
  }
};

/**
 * Triggers and fetches OWASP ZAP alerts.
 */
const performZapScan = async (target) => {
  try {
    logger.info(`Attempting OWASP ZAP scan for: ${target}`);
    
    // 1. Trigger Passive/Active Scan (ZAP usually does passive by default on access)
    // We'll try to trigger an active scan if ZAP is available
    try {
      await axios.get(`${ZAP_BASE_URL}/JSON/ascan/action/scan/`, {
        params: { 
          url: target, 
          recurse: 'true',
          apikey: ZAP_API_KEY
        },
        headers: {
          'X-ZAP-API-Key': ZAP_API_KEY
        }
      });
      logger.info(`ZAP scan triggered for ${target}`);
    } catch (err) {
      logger.warn(`Could not trigger active ZAP scan. Checking for existing alerts instead.`);
    }

    // 2. Fetch Alerts
    // Note: ZAP alerts are typically accessed via 'alert/view/alerts' or 'core/view/alerts'
    const response = await axios.get(`${ZAP_BASE_URL}/JSON/alert/view/alerts/`, {
      params: { 
        baseurl: target,
        apikey: ZAP_API_KEY
      },
      headers: {
        'X-ZAP-API-Key': ZAP_API_KEY
      }
    });

    return response.data?.alerts || [];
  } catch (err) {
    if (err.response) {
      logger.error(`ZAP API Error [${err.response.status}]: ${JSON.stringify(err.response.data)}`);
    } else {
      logger.error(`ZAP Connection Error: ${err.message}`);
    }
    return []; // Return empty array if ZAP is unreachable
  }
};

/**
 * Core Orchestrator for Web Scanning
 */
const runWebScan = async (target, options = {}) => {
  try {
    const { advanced = false, runZap = true } = options;

    // Run scans (Nikto is mandatory if Perl exists, ZAP is optional/fallback)
    const niktoPromise = performNiktoScan(target, advanced);
    const zapPromise = runZap ? performZapScan(target) : Promise.resolve([]);

    const [niktoOutput, zapAlerts] = await Promise.all([niktoPromise, zapPromise]);

    // Save to DB
    const scanResult = new WebScanResult({
      target,
      niktoOutput,
      zapAlerts,
      status: 'completed'
    });

    await scanResult.save();
    logger.info(`Web scan completed and saved for ${target}`);

    return {
      success: true,
      target,
      nikto_result: niktoOutput,
      zap_result: zapAlerts
    };
  } catch (err) {
    logger.error(`Web scan service error: ${err.message}`);
    throw err;
  }
};

/**
 * Fetches recent web scan results.
 */
const getRecentWebScans = async (target = '') => {
  const query = target ? { target } : {};
  return await WebScanResult.find(query).sort({ timestamp: -1 }).limit(20);
};

module.exports = {
  runWebScan,
  getRecentWebScans
};
