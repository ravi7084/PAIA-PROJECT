/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Network Service                     ║
 * ║   Infrastructure for Nmap Scanning           ║
 * ╚══════════════════════════════════════════════╝
 */

const path = require('path');
const fs = require('fs');
const NetworkResult = require('../models/NetworkResult');
const { runCommand, runExecutable } = require('../utils/commandRunner');
const logger = require('../utils/logger');

// Define binary paths
const LOCAL_NMAP = path.join(__dirname, '../bin/nmap/nmap.exe');
let NMAP_BIN = 'nmap'; // Default to system PATH

/**
 * Performs a network scan using Nmap.
 * @param {string} target - The target domain or IP.
 * @returns {Promise<Object>} - The scan result.
 */
const runNetworkScan = async (target) => {
  try {
    // 1. Check if Nmap is installed (System or Local)
    let isInstalled = false;
    
    if (fs.existsSync(LOCAL_NMAP)) {
      NMAP_BIN = LOCAL_NMAP;
      isInstalled = true;
      logger.info(`Using local Nmap: ${NMAP_BIN}`);
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

    // 2. Run Nmap scan
    // Arguments: -A (OS detection, version, etc.), -v (Verbose)
    // Scanning top 1000 ports is the default when -p- is omitted.
    logger.info(`Starting Network Scan for: ${target}`);
    
    // Using runExecutable to handle possible spaces in path and provide a timeout
    const nmapOutput = await runExecutable(NMAP_BIN, ['-A', '-v', target], {
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
