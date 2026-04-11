/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Threat Intel Controller             ║
 * ╚══════════════════════════════════════════════╝
 */

const threatIntel = require('../services/threatIntel.service');
const logger = require('../utils/logger');

const lookupAll = async (req, res, next) => {
  try {
    const { target } = req.params;
    if (!target) return res.status(400).json({ success: false, message: 'Target is required' });

    const results = await threatIntel.runAllThreatIntel(target);
    logger.info(`Threat intel lookup: target=${target} by user=${req.user.id}`);
    res.json({ success: true, data: { target, results } });
  } catch (err) { next(err); }
};

const lookupShodan = async (req, res, next) => {
  try {
    const data = await threatIntel.shodanLookup(req.params.target);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const lookupVirusTotal = async (req, res, next) => {
  try {
    const data = await threatIntel.virusTotalLookup(req.params.target);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const lookupWhois = async (req, res, next) => {
  try {
    const data = await threatIntel.whoisLookup(req.params.target);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const lookupAbuseIPDB = async (req, res, next) => {
  try {
    const data = await threatIntel.abuseIPDBLookup(req.params.ip);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const lookupHunter = async (req, res, next) => {
  try {
    const data = await threatIntel.hunterLookup(req.params.domain);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const lookupOTX = async (req, res, next) => {
  try {
    const data = await threatIntel.otxLookup(req.params.target);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const lookupCensys = async (req, res, next) => {
  try {
    const data = await threatIntel.censysLookup(req.params.target);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

module.exports = {
  lookupAll, lookupShodan, lookupVirusTotal, lookupWhois,
  lookupAbuseIPDB, lookupHunter, lookupOTX, lookupCensys,
};
