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
const { runCommand, runExecutable } = require('../utils/commandRunner');
const logger = require('../utils/logger');

// Define binary paths
const LOCAL_AMASS = path.join(__dirname, '../bin/amass.exe');
let AMASS_BIN = 'amass'; // Default to system PATH

/**
 * Performs subdomain enumeration and DNS analysis.
 * @param {string} domain - The target domain.
 * @returns {Promise<Object>} - The structured recon data.
 */
const runRecon = async (domain) => {
  try {
    // 1. Check if Amass is installed (System or Local)
    let isInstalled = false;
    
    // Check locally first (since we just installed it)
    if (fs.existsSync(LOCAL_AMASS)) {
      AMASS_BIN = LOCAL_AMASS;
      isInstalled = true;
      logger.info(`Using local Amass: ${AMASS_BIN}`);
    } else {
      // Fallback to system path
      try {
        await runCommand('amass -version');
        AMASS_BIN = 'amass';
        isInstalled = true;
      } catch (err) {}
    }

    if (!isInstalled) {
      throw new Error('Amass is not installed. Please run "npm run setup:amass" in the backend.');
    }

    // 2. Run Subdomain Enumeration
    logger.info(`Starting Subdomain Enumeration for: ${domain}`);
    // Use runExecutable with array to handle spaces in path safely
    // Optimization: Stop once we have 50 subdomains to save time
    const amassOutput = await runExecutable(AMASS_BIN, ['enum', '-passive', '-d', domain], {
      stopCondition: (out) => (out.match(/\n/g) || []).length >= 50
    });
    
    // 3. Parse and deduplicate subdomains
    let subdomains = (amassOutput || '')
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
