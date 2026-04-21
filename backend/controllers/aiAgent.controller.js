/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — AI Agent Controller                 ║
 * ║   FIXED: proper scanId flow, explain, quick  ║
 * ╚══════════════════════════════════════════════╝
 */

const { runAIAgent, runQuickScan, stopAIAgent } = require('../services/aiAgent.service');
const { explainResults } = require('../services/gemini.service');
const ScanSession = require('../models/scanSession.model');
const logger = require('../utils/logger');

/**
 * POST /api/ai-agent/run
 * Start a full AI-driven penetration test
 */
const startAIScan = async (req, res, next) => {
  try {
    const { target, targetId, scope } = req.body;
    if (!target) return res.status(400).json({ success: false, message: 'Target is required' });

    const cleanTarget = target.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const io = req.app.get('io');
    const userId = req.user.id;

    // Create session NOW so we have the real scanId to return
    const session = await ScanSession.create({
      user_id: userId,
      target_id: targetId || null,
      target: cleanTarget,
      scope: scope || 'full',
      status: 'queued',
      startedAt: new Date(),
      maxIterations: parseInt(process.env.AI_AGENT_MAX_ITERATIONS || '10', 10),
    });

    const scanId = session._id.toString();

    logger.info(`AI scan queued: scanId=${scanId} target=${cleanTarget} by user=${userId}`);

    // Return the REAL scanId immediately
    res.status(202).json({ success: true, data: { scanId, status: 'queued' } });

    // Run AI agent in background — pass the existing scanId so it uses the same session
    setImmediate(async () => {
      try {
        await runAIAgent({
          scanId,
          targetId: targetId || null,
          userId,
          target: cleanTarget,
          scope: scope || 'full',
          io,
        });
      } catch (err) {
        logger.error(`AI Agent background error: ${err.message}`);
        // Mark session as failed
        await ScanSession.findByIdAndUpdate(scanId, {
          status: 'failed',
          finishedAt: new Date(),
        }).catch(() => {});
      }
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/ai-agent/quick-scan
 * Fast scan using only built-in + API tools (no CLI)
 */
const quickScan = async (req, res, next) => {
  try {
    const { target } = req.body;
    if (!target) return res.status(400).json({ success: false, message: 'Target is required' });

    const cleanTarget = target.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const io = req.app.get('io');
    const userId = req.user.id;

    // Create session first
    const session = await ScanSession.create({
      user_id: userId,
      target: cleanTarget,
      scope: 'recon-only',
      status: 'queued',
      startedAt: new Date(),
      maxIterations: 3,
    });

    const scanId = session._id.toString();

    res.status(202).json({ success: true, data: { scanId, status: 'queued' } });

    setImmediate(async () => {
      try {
        await runQuickScan({ scanId, userId, target: cleanTarget, io });
      } catch (err) {
        logger.error(`Quick scan background error: ${err.message}`);
        await ScanSession.findByIdAndUpdate(scanId, {
          status: 'failed',
          finishedAt: new Date(),
        }).catch(() => {});
      }
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/ai-agent/explain
 * AI-powered explanation of scan results in different modes
 */
const explainScan = async (req, res, next) => {
  try {
    const { scanId, mode } = req.body;
    if (!scanId) return res.status(400).json({ success: false, message: 'scanId is required' });

    const validModes = ['hacker', 'manager', 'exploit', 'fixes'];
    const selectedMode = validModes.includes(mode) ? mode : 'hacker';

    const session = await ScanSession.findOne({ _id: scanId, user_id: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Scan session not found' });

    logger.info(`AI Explain: scanId=${scanId} mode=${selectedMode} user=${req.user.id}`);

    const explanation = await explainResults(session, selectedMode);

    res.json({
      success: true,
      data: {
        mode: selectedMode,
        explanation,
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/ai-agent/status/:id
 */
const getStatus = async (req, res, next) => {
  try {
    const session = await ScanSession.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Scan session not found' });
    res.json({ success: true, data: { session } });
  } catch (err) { next(err); }
};

/**
 * POST /api/ai-agent/stop/:id
 */
const stopScan = async (req, res, next) => {
  try {
    const session = await stopAIAgent(req.params.id, req.user.id);
    if (!session) return res.status(404).json({ success: false, message: 'No running scan found' });
    res.json({ success: true, data: { status: 'stopped', scanId: session._id } });
  } catch (err) { next(err); }
};

/**
 * GET /api/ai-agent/history
 */
const getHistory = async (req, res, next) => {
  try {
    const sessions = await ScanSession.find({ user_id: req.user.id })
      .select('target status scope report.riskScore vulnerabilities startedAt finishedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(30);
    res.json({ success: true, data: { sessions, count: sessions.length } });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/ai-agent/:id
 */
const deleteScan = async (req, res, next) => {
  try {
    const deleted = await ScanSession.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Scan not found' });
    res.json({ success: true, data: { deletedId: deleted._id } });
  } catch (err) { next(err); }
};

/**
 * GET /api/ai-agent/:id/pdf
 * Download scan results as a professional PDF directly from ScanSession
 */
const downloadScanPdf = async (req, res, next) => {
  try {
    const session = await ScanSession.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Scan session not found' });
    if (session.status !== 'completed') return res.status(400).json({ success: false, message: 'Scan not yet completed' });

    // Build a report-like object from session data for the PDF generator
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    (session.vulnerabilities || []).forEach((v) => {
      if (severityCounts[v.severity] !== undefined) severityCounts[v.severity]++;
    });

    const reportData = {
      _id: session._id,
      target: session.target,
      scope: session.scope || 'full',
      generatedAt: session.finishedAt || session.createdAt,
      executiveSummary: session.report?.executiveSummary || `Automated penetration test completed for ${session.target}. ${session.vulnerabilities?.length || 0} findings identified.`,
      methodology: session.report?.technicalDetails || 'Automated AI-driven penetration testing using PAIA with NVD/Vulners enrichment and MITRE ATT&CK mapping',
      findings: (session.vulnerabilities || []).map((v) => ({
        title: v.title,
        severity: v.severity,
        cvss: v.cvss,
        description: v.description,
        evidence: v.evidence,
        remediation: v.remediation,
        cveId: v.cveId,
        tool: v.tool,
        mitreMapping: v.mitreMapping || [],
        exploitAvailable: v.exploitAvailable || false,
      })),
      riskScore: session.report?.riskScore || 0,
      severityCounts,
      recommendations: session.report?.recommendations || [],
      conclusion: `Scan completed at ${session.finishedAt?.toISOString() || 'N/A'}. ${(session.vulnerabilities || []).length} findings identified.`,
      mitreAttackSummary: session.report?.mitreAttackSummary || '',
      mitreAttackMapping: session.report?.mitreAttackMapping || null,
      riskBreakdown: session.report?.riskBreakdown || null,
    };

    const { generatePDF } = require('../services/report.service');
    generatePDF(reportData, res);
  } catch (err) { next(err); }
};

module.exports = { startAIScan, quickScan, explainScan, getStatus, stopScan, getHistory, deleteScan, downloadScanPdf };
