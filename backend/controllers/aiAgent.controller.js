/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — AI Agent Controller                 ║
 * ╚══════════════════════════════════════════════╝
 */

const { runAIAgent, stopAIAgent } = require('../services/aiAgent.service');
const ScanSession = require('../models/scanSession.model');
const logger = require('../utils/logger');

const startAIScan = async (req, res, next) => {
  try {
    const { target, targetId, scope } = req.body;
    if (!target) return res.status(400).json({ success: false, message: 'Target is required' });

    const io = req.app.get('io');

    // Return immediately with scanId, run agent in background
    const session = await ScanSession.create({
      user_id: req.user.id,
      target_id: targetId || null,
      target: target.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''),
      scope: scope || 'full',
      status: 'queued',
      startedAt: new Date(),
    });

    const scanId = session._id.toString();

    // Run AI agent asynchronously
    setImmediate(async () => {
      try {
        // Delete the queued placeholder and let runAIAgent create its own
        await ScanSession.findByIdAndDelete(scanId);
        await runAIAgent({
          targetId: targetId || null,
          userId: req.user.id,
          target: target.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''),
          scope: scope || 'full',
          io,
        });
      } catch (err) {
        logger.error(`AI Agent background error: ${err.message}`);
      }
    });

    logger.info(`AI scan queued: scanId=${scanId} target=${target} by user=${req.user.id}`);
    res.status(202).json({ success: true, data: { scanId, status: 'queued' } });
  } catch (err) { next(err); }
};

const getStatus = async (req, res, next) => {
  try {
    const session = await ScanSession.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Scan session not found' });
    res.json({ success: true, data: { session } });
  } catch (err) { next(err); }
};

const stopScan = async (req, res, next) => {
  try {
    const session = await stopAIAgent(req.params.id, req.user.id);
    if (!session) return res.status(404).json({ success: false, message: 'No running scan found' });
    res.json({ success: true, data: { status: 'stopped', scanId: session._id } });
  } catch (err) { next(err); }
};

const getHistory = async (req, res, next) => {
  try {
    const sessions = await ScanSession.find({ user_id: req.user.id })
      .select('target status scope report.riskScore vulnerabilities startedAt finishedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(30);
    res.json({ success: true, data: { sessions, count: sessions.length } });
  } catch (err) { next(err); }
};

const deleteScan = async (req, res, next) => {
  try {
    const deleted = await ScanSession.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Scan not found' });
    res.json({ success: true, data: { deletedId: deleted._id } });
  } catch (err) { next(err); }
};

module.exports = { startAIScan, getStatus, stopScan, getHistory, deleteScan };
