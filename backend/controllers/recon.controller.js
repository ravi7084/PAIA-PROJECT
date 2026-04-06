const ReconScan = require('../models/reconScan.model');
const { runReconScanWorker, normalizeToolList, normalizeTarget } = require('../services/recon.service');
const logger = require('../utils/logger');

const startRecon = async (req, res, next) => {
  try {
    const { target, tools, mode, timeoutMs, authorized, phase: inputPhase } = req.body;
    const phase = ['recon', 'subdomain', 'network', 'webapp'].includes(inputPhase) ? inputPhase : 'recon';
    const cleanedTarget = normalizeTarget(target);

    if (!authorized) {
      return res.status(400).json({
        success: false,
        message: 'Authorization confirmation required (authorized: true).'
      });
    }
    if (!cleanedTarget) {
      return res.status(400).json({
        success: false,
        message: 'Target is required.'
      });
    }

    const queued = await ReconScan.create({
      user_id: req.user.id,
      target: cleanedTarget,
      phase,
      mode: mode || 'passive',
      status: 'queued',
      toolsRequested: normalizeToolList(tools, phase),
      toolsRun: [],
      toolResults: [],
      summary: {
        domains: [],
        subdomains: [],
        emails: [],
        ips: [],
        network: { openPorts: [], services: [], vulnerabilities: [] },
        webapp: { urls: [], vulnerabilities: [], owaspTop10: [] },
        dnsRecords: { ns: [], mx: [], txt: [], cname: [], a: [] }
      },
      findings: [],
      verdict: {
        level: 'none',
        score: 0,
        hasFindings: false,
        label: 'Scan queued'
      },
      startedAt: new Date(),
      finishedAt: null
    });

    const io = req.app.get('io');
    const scanId = queued._id.toString();

    setImmediate(async () => {
      try {
        await runReconScanWorker({
          scanId,
          userId: req.user.id,
          targetInput: target,
          tools,
          mode,
          phase,
          timeoutMs,
          io
        });
      } catch (workerErr) {
        logger.error(`Recon worker failed scanId=${scanId}: ${workerErr.message}`);
      }
    });

    logger.info(`Recon queued by user=${req.user.id} target=${queued.target} scanId=${scanId}`);

    return res.status(202).json({
      success: true,
      data: { scanId, status: 'queued' }
    });
  } catch (err) {
    next(err);
  }
};

const listReconScans = async (req, res, next) => {
  try {
    const query = { user_id: req.user.id };
    if (req.query.target) query.target = req.query.target;

    const scans = await ReconScan.find(query).sort({ createdAt: -1 }).limit(50);

    return res.json({
      success: true,
      data: { scans, count: scans.length }
    });
  } catch (err) {
    next(err);
  }
};

const getReconScan = async (req, res, next) => {
  try {
    const scan = await ReconScan.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Recon scan not found' });
    }

    return res.json({
      success: true,
      data: { scan }
    });
  } catch (err) {
    next(err);
  }
};

const deleteReconScan = async (req, res, next) => {
  try {
    const deleted = await ReconScan.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Recon scan not found' });
    }

    return res.json({
      success: true,
      data: { deletedId: deleted._id.toString() }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  startRecon,
  listReconScans,
  getReconScan,
  deleteReconScan
};
