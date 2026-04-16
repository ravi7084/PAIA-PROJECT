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
const ZAP_BASE_URL = process.env.ZAP_API_URL || 'http://localhost:8080';

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
    // -Tuning: 123456789abc (Advanced modes)
    const args = ['-h', target];
    if (advanced) {
      args.push('-Tuning', '1,2,3,4,b,c,x'); // Advanced checks
    }

    const output = await runExecutable(perlBin, [NIKTO_PL, ...args], {
      timeout: 5 * 60 * 1000 // 5 minute timeout
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
        params: { url: target, recurse: 'true' }
      });
      logger.info(`ZAP scan triggered for ${target}`);
    } catch (err) {
      logger.warn(`Could not trigger active ZAP scan. Checking for existing alerts instead.`);
    }

    // 2. Fetch Alerts
    const response = await axios.get(`${ZAP_BASE_URL}/JSON/ascan/view/alerts/`, {
      params: { baseurl: target }
    });

    return response.data?.alerts || [];
  } catch (err) {
    logger.error(`ZAP API error: ${err.message}`);
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
