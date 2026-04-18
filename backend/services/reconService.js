/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Recon Service                       ║
 * ║   Subdomain Enumeration & DNS Analysis logic ║
 * ╚══════════════════════════════════════════════╝
 */

const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const ReconResult = require('../models/ReconResult');
const { runCommand, runExecutable, runRemoteExecutable } = require('../utils/commandRunner');
const logger = require('../utils/logger');

// Define binary paths
const LOCAL_SUBFINDER = path.join(__dirname, '../bin/subfinder.exe');
let SUBFINDER_BIN = process.env.SUBFINDER_BIN || 'subfinder'; // Default to system PATH

/**
 * Performs subdomain enumeration and DNS analysis.
 * @param {string} domain - The target domain.
 * @returns {Promise<Object>} - The structured recon data.
 * @param {boolean} isRemote - Force remote mode (optional)
 */
const runRecon = async (domain) => {
  try {
    const isRemote = process.env.REMOTE_SCANNER_ENABLED === 'true';
    
    // 1. Check if Subfinder is installed (System or Local)
    let isInstalled = false;
    
    if (isRemote) {
      isInstalled = true; // Remote scan handles its own dependencies
      SUBFINDER_BIN = process.env.SUBFINDER_BIN || 'subfinder';
    } else {
      // Check locally first
      if (fs.existsSync(LOCAL_SUBFINDER)) {
        SUBFINDER_BIN = LOCAL_SUBFINDER;
        isInstalled = true;
        logger.info(`Using local Subfinder: ${SUBFINDER_BIN}`);
      } else {
        // Fallback to system path
        try {
          // Check if subfinder is in path
          await runCommand(`${SUBFINDER_BIN} -version`);
          isInstalled = true;
        } catch (err) {
          // Try default name if custom one fails
          if (SUBFINDER_BIN !== 'subfinder') {
            try {
              await runCommand('subfinder -version');
              SUBFINDER_BIN = 'subfinder';
              isInstalled = true;
            } catch (e) {}
          }
        }
      }
    }

    if (!isInstalled) {
      throw new Error('Subfinder is not installed. Please install it to use this module.');
    }

    // 2. Run Subdomain Enumeration
    logger.info(`${isRemote ? '🚀 Remote' : 'Starting'} Subdomain Enumeration for: ${domain}`);
    
    // Use the appropriate runner
    const runner = isRemote ? runRemoteExecutable : runExecutable;
    
    // Subfinder syntax: -d domain -silent
    const subfinderOutput = await runner(SUBFINDER_BIN, ['-d', domain, '-silent'], {
      stopCondition: (out) => (out.match(/\n/g) || []).length >= 50
    });
    
    // 3. Parse and deduplicate subdomains
    let subdomains = (subfinderOutput || '')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s && s.includes(domain));
    
    subdomains = [...new Set(subdomains)].slice(0, 50); // Limit to top 50
    logger.info(`Found ${subdomains.length} subdomains for ${domain}. Starting batched DNS analysis...`);

    // 4. Perform DNS Analysis in batches (5 at a time) to prevent network congestion
    const reconData = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < subdomains.size || i < subdomains.length; i += BATCH_SIZE) {
      const batch = subdomains.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (sub) => {
          const result = {
            subdomain: sub,
            A: [],
            MX: [],
            TXT: []
          };

          try {
            // Internal parallel resolve for single subdomain
            const [aRecords, mxRecords, txtRecords] = await Promise.allSettled([
              dns.resolve4(sub),
              dns.resolveMx(sub),
              dns.resolveTxt(sub)
            ]);

            if (aRecords.status === 'fulfilled') result.A = aRecords.value;
            if (mxRecords.status === 'fulfilled') {
              result.MX = mxRecords.value.map(mx => `${mx.exchange} (Priority: ${mx.priority})`);
            }
            if (txtRecords.status === 'fulfilled') {
              result.TXT = txtRecords.value.flat();
            }
          } catch (dnsErr) {
            logger.warn(`DNS lookup failed for ${sub}: ${dnsErr.message}`);
          }
          return result;
        })
      );
      reconData.push(...batchResults);
      logger.info(`Processed DNS for ${reconData.length}/${subdomains.length} subdomains...`);
    }

    // 5. Save results to MongoDB
    if (reconData.length > 0) {
      const mongoDocs = reconData.map(res => ({
        domain,
        ...res
      }));
      await ReconResult.insertMany(mongoDocs);
      logger.info(`Saved ${mongoDocs.length} recon results for ${domain}`);
    } else {
      logger.warn(`No DNS data retrieved for ${domain}`);
    }

    return reconData;
  } catch (err) {
    logger.error(`Recon service error: ${err.message}`);
    throw err;
  }
};

module.exports = { runRecon };
