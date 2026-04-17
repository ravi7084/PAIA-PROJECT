/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Web Scan Service                    ║
 * ║   Integrates Nikto                           ║
 * ╚══════════════════════════════════════════════╝
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const WebScanResult = require('../models/WebScanResult');
const { runExecutable, runCommand, runRemoteExecutable } = require('../utils/commandRunner');
const logger = require('../utils/logger');

// Paths
const NIKTO_BASE = path.join(__dirname, '../bin/nikto');
const NIKTO_PL = path.join(NIKTO_BASE, 'program', 'nikto.pl');
const WINDOWS_PERL = "C:\\Strawberry\\perl\\bin\\perl.exe";

/**
 * Executes a Nikto scan.
 */
const performNiktoScan = async (target, advanced = false) => {
  let perlBin = 'perl';
  try {
    // 1. Check for Perl (System or Windows Default)
    let isPerlInstalled = false;
    
    if (process.env.REMOTE_SCANNER_ENABLED !== 'true') {
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
    } else {
      isPerlInstalled = true; // Remote scan handles its own dependencies
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

    const output = await runRemoteExecutable(perlBin === 'perl' ? 'nikto' : NIKTO_PL, args, {
      timeout: 10 * 60 * 1000 // Increased to 10 minutes
    });

    return output;
  } catch (err) {
    logger.error(`Nikto scan error: ${err.message}`);
    return `[Nikto Error] ${err.message}`;
  }
};

/**
 * Core Orchestrator for Web Scanning
 */
const runWebScan = async (target, options = {}) => {
  try {
    const { advanced = false } = options;

    // Run Nikto scan
    const niktoOutput = await performNiktoScan(target, advanced);

    // Save to DB
    const scanResult = new WebScanResult({
      target,
      niktoOutput,
      status: 'completed'
    });

    await scanResult.save();
    logger.info(`Web scan completed and saved for ${target}`);

    return {
      success: true,
      target,
      nikto_result: niktoOutput,
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
