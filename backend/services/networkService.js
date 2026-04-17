/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Network Service                     ║
 * ║   Infrastructure for Nmap Scanning           ║
 * ╚══════════════════════════════════════════════╝
 */

const path = require('path');
const fs = require('fs');
const NetworkResult = require('../models/NetworkResult');
const { runCommand, runExecutable, runRemoteExecutable } = require('../utils/commandRunner');
const logger = require('../utils/logger');

// Define binary paths
const LOCAL_NMAP = path.join(__dirname, '../bin/nmap/nmap.exe');
const WINDOWS_NMAP = "C:\\Program Files (x86)\\Nmap\\nmap.exe";
let NMAP_BIN = 'nmap'; // Default to system PATH

/**
 * Performs a network scan using Nmap.
 * @param {string} target - The target domain or IP.
 * @returns {Promise<Object>} - The scan result.
 */
const runNetworkScan = async (target) => {
  try {
    if (process.env.REMOTE_SCANNER_ENABLED !== 'true') {
      if (fs.existsSync(LOCAL_NMAP)) {
        NMAP_BIN = LOCAL_NMAP;
        isInstalled = true;
        logger.info(`Using local Nmap ZIP: ${NMAP_BIN}`);
      } else if (fs.existsSync(WINDOWS_NMAP)) {
        NMAP_BIN = WINDOWS_NMAP;
        isInstalled = true;
        logger.info(`Using Windows default Nmap: ${NMAP_BIN}`);
      } else {
        try {
          await runCommand('nmap --version');
          NMAP_BIN = 'nmap';
          isInstalled = true;
        } catch (err) {
          // Not in system path
        }
      }

      if (!isInstalled) {
        throw new Error('Nmap is not installed. Please install Nmap from https://nmap.org/download.html to use this module.');
      }
    } else {
      isInstalled = true; // Remote scan handles its own dependencies
    }

    // 2. Run Nmap scan
    // Arguments: -A (OS detection, version, etc.), -v (Verbose)
    // Scanning top 1000 ports is the default when -p- is omitted.
    logger.info(`Starting Network Scan for: ${target}`);
    
    // Using runRemoteExecutable to support Kali VM scanning
    const nmapOutput = await runRemoteExecutable(NMAP_BIN, ['-A', '-v', target], {
        timeout: 10 * 60 * 1000 // 10 minute timeout for Nmap
    });

    // 3. Save results to MongoDB
    const scanResult = new NetworkResult({
      domain: target,
      rawOutput: nmapOutput,
      status: 'success'
    });

    await scanResult.save();
    logger.info(`Saved network scan result for ${target}`);

    return {
      success: true,
      target,
      result: nmapOutput
    };
  } catch (err) {
    logger.error(`Network scan service error: ${err.message}`);
    throw err;
  }
};

/**
 * Fetches recent network scan results.
 * @param {string} domain - Optional domain filter.
 * @returns {Promise<Array>}
 */
const getRecentNetworkResults = async (domain = '') => {
  const query = domain ? { domain } : {};
  return await NetworkResult.find(query).sort({ timestamp: -1 }).limit(20);
};

module.exports = { runNetworkScan, getRecentNetworkResults };
