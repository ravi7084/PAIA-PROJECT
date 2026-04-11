/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — AI Agent Service (THE BRAIN)        ║
 * ║   Orchestrates Gemini + Tools + DB           ║
 * ║   This is the core autonomous scan loop      ║
 * ╚══════════════════════════════════════════════╝
 */

const ScanSession = require('../models/scanSession.model');
const gemini = require('./gemini.service');
const threatIntel = require('./threatIntel.service');
const { runReconScan } = require('./recon.service');
const logger = require('../utils/logger');

const MAX_ITERATIONS = parseInt(process.env.AI_AGENT_MAX_ITERATIONS || '10', 10);

/* ── Socket.io helper ── */
const emit = (io, scanId, event, payload) => {
  if (!io || !scanId) return;
  io.to(`scan_${scanId}`).emit(event, { scanId, ...payload });
};

/* ── Tool executor — maps Gemini's decision to actual functions ── */
const executeTool = async (toolName, params, target) => {
  const started = Date.now();

  try {
    switch (toolName) {
      /* ── API-based tools ── */
      case 'shodan_api':
        return { tool: 'shodan_api', status: 'success', data: await threatIntel.shodanLookup(params.target || target), durationMs: Date.now() - started };
      case 'virustotal_api':
        return { tool: 'virustotal_api', status: 'success', data: await threatIntel.virusTotalLookup(params.target || target), durationMs: Date.now() - started };
      case 'whois_api':
        return { tool: 'whois_api', status: 'success', data: await threatIntel.whoisLookup(params.target || target), durationMs: Date.now() - started };
      case 'abuseipdb_api':
        return { tool: 'abuseipdb_api', status: 'success', data: await threatIntel.abuseIPDBLookup(params.target || target), durationMs: Date.now() - started };
      case 'hunter_api':
        return { tool: 'hunter_api', status: 'success', data: await threatIntel.hunterLookup(params.target || target), durationMs: Date.now() - started };
      case 'otx_api':
        return { tool: 'otx_api', status: 'success', data: await threatIntel.otxLookup(params.target || target), durationMs: Date.now() - started };
      case 'censys_api':
        return { tool: 'censys_api', status: 'success', data: await threatIntel.censysLookup(params.target || target), durationMs: Date.now() - started };

      /* ── CLI-based tools (via recon.service) ── */
      case 'nmap_cli': {
        const r = await runReconScan({ targetInput: params.target || target, tools: ['nmap'], mode: 'active', phase: 'network', timeoutMs: 120000 });
        return { tool: 'nmap_cli', status: r.status, data: r, durationMs: Date.now() - started };
      }
      case 'nikto_cli': {
        const r = await runReconScan({ targetInput: params.target || target, tools: ['nikto'], mode: 'active', phase: 'webapp', timeoutMs: 120000 });
        return { tool: 'nikto_cli', status: r.status, data: r, durationMs: Date.now() - started };
      }
      case 'subfinder_cli': {
        const r = await runReconScan({ targetInput: params.target || target, tools: ['subfinder'], mode: 'passive', phase: 'subdomain', timeoutMs: 120000 });
        return { tool: 'subfinder_cli', status: r.status, data: r, durationMs: Date.now() - started };
      }
      case 'amass_cli': {
        const r = await runReconScan({ targetInput: params.target || target, tools: ['amass'], mode: 'passive', phase: 'subdomain', timeoutMs: 120000 });
        return { tool: 'amass_cli', status: r.status, data: r, durationMs: Date.now() - started };
      }

      default:
        return { tool: toolName, status: 'skipped', data: { reason: `Unknown tool: ${toolName}` }, durationMs: Date.now() - started };
    }
  } catch (err) {
    return { tool: toolName, status: 'failed', data: { error: err.message }, durationMs: Date.now() - started };
  }
};

/**
 * Main AI Agent loop — THE BRAIN
 */
const runAIAgent = async ({ targetId, userId, target, scope = 'full', io }) => {
  const scanId = (
    await ScanSession.create({
      user_id: userId,
      target_id: targetId || null,
      target,
      scope,
      status: 'running',
      startedAt: new Date(),
      maxIterations: MAX_ITERATIONS,
    })
  )._id.toString();

  logger.info(`AI Agent started: scanId=${scanId} target=${target} scope=${scope}`);
  emit(io, scanId, 'ai:started', { target, scope, startedAt: new Date() });

  try {
    /* ─────────────────────────────────────────
       PHASE 1: Passive Recon (Threat Intel APIs)
       ───────────────────────────────────────── */
    emit(io, scanId, 'ai:phase_update', { phase: 'recon', status: 'running' });

    const threatIntelResults = await threatIntel.runAllThreatIntel(target);

    await ScanSession.findByIdAndUpdate(scanId, {
      threatIntelResults,
      $push: {
        phases: { name: 'recon', status: 'completed', tools: ['threat_intel_apis'], results: threatIntelResults, startedAt: new Date(), finishedAt: new Date() },
      },
    });

    emit(io, scanId, 'ai:phase_update', { phase: 'recon', status: 'completed', data: threatIntelResults });

    /* ─────────────────────────────────────────
       PHASE 2: AI Decision Loop
       ───────────────────────────────────────── */
    const completedScans = [{ tool: 'threat_intel_apis', status: 'success', data: threatIntelResults }];
    const usedTools = ['threat_intel_apis'];
    let allVulnerabilities = [];
    let allDecisions = [];
    let iteration = 0;
    let shouldContinue = true;

    while (shouldContinue && iteration < MAX_ITERATIONS) {
      iteration++;
      emit(io, scanId, 'ai:thinking', { iteration, maxIterations: MAX_ITERATIONS });

      // Ask Gemini what to do next
      const decision = await gemini.analyzeAndDecide({
        target,
        scope,
        iteration,
        maxIterations: MAX_ITERATIONS,
        completedScans,
        usedTools,
      });

      // Collect findings from this decision
      if (Array.isArray(decision.currentFindings)) {
        allVulnerabilities = allVulnerabilities.concat(decision.currentFindings);
      }

      const decisionRecord = {
        iteration,
        promptSummary: `Iteration ${iteration}: analyzed ${completedScans.length} scan results`,
        response: decision,
        reasoning: decision.reasoning || '',
        action: decision.nextAction || 'generate_report',
        riskLevel: decision.riskLevel || 'info',
        timestamp: new Date(),
      };
      allDecisions.push(decisionRecord);

      // Save decision to DB
      await ScanSession.findByIdAndUpdate(scanId, {
        currentIteration: iteration,
        $push: { aiDecisions: decisionRecord },
        vulnerabilities: allVulnerabilities.map((v) => ({
          title: v.title || 'Untitled',
          type: v.type || 'unknown',
          severity: v.severity || 'info',
          cvss: v.cvss || 0,
          description: v.description || '',
          evidence: v.evidence || '',
          remediation: v.remediation || '',
          cveId: v.cveId || '',
          tool: v.tool || '',
        })),
      });

      emit(io, scanId, 'ai:decision', { iteration, decision: decisionRecord });

      // Check if agent wants to stop
      if (!decision.shouldContinue || decision.nextAction === 'generate_report') {
        shouldContinue = false;
        break;
      }

      // Execute the recommended tool
      const toolName = decision.nextAction;
      if (usedTools.includes(toolName)) {
        // Avoid running same tool twice
        logger.info(`AI Agent skipping duplicate tool: ${toolName}`);
        continue;
      }

      emit(io, scanId, 'ai:tool_running', { tool: toolName, iteration });

      const toolResult = await executeTool(toolName, decision.parameters || {}, target);
      completedScans.push(toolResult);
      usedTools.push(toolName);

      // Determine which phase this belongs to
      const phaseMap = {
        shodan_api: 'recon', virustotal_api: 'recon', whois_api: 'recon',
        abuseipdb_api: 'recon', hunter_api: 'recon', otx_api: 'recon', censys_api: 'recon',
        nmap_cli: 'network', nikto_cli: 'webapp',
        subfinder_cli: 'subdomain', amass_cli: 'subdomain',
      };

      await ScanSession.findByIdAndUpdate(scanId, {
        $push: {
          phases: {
            name: phaseMap[toolName] || 'recon',
            status: toolResult.status === 'success' ? 'completed' : 'failed',
            tools: [toolName],
            results: toolResult.data,
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });

      emit(io, scanId, 'ai:tool_complete', { tool: toolName, status: toolResult.status, iteration });
    }

    /* ─────────────────────────────────────────
       PHASE 3: Report Generation
       ───────────────────────────────────────── */
    emit(io, scanId, 'ai:phase_update', { phase: 'report', status: 'running' });

    const report = await gemini.generateReport({
      target,
      scope,
      completedScans,
      vulnerabilities: allVulnerabilities,
      aiDecisions: allDecisions,
    });

    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    (report.findings || []).forEach((f) => {
      if (severityCounts[f.severity] !== undefined) severityCounts[f.severity]++;
    });

    const finalSession = await ScanSession.findByIdAndUpdate(
      scanId,
      {
        status: 'completed',
        report: {
          executiveSummary: report.executiveSummary || '',
          technicalDetails: report.methodology || '',
          riskScore: report.riskScore || 0,
          recommendations: report.recommendations || [],
          generatedAt: new Date(),
        },
        vulnerabilities: (report.findings || []).map((f) => ({
          title: f.title || 'Untitled',
          type: f.type || 'unknown',
          severity: f.severity || 'info',
          cvss: f.cvss || 0,
          description: f.description || '',
          evidence: f.evidence || '',
          remediation: f.remediation || '',
          cveId: f.cveId || '',
          tool: f.tool || '',
        })),
        finishedAt: new Date(),
      },
      { new: true }
    );

    emit(io, scanId, 'ai:completed', {
      report,
      severityCounts,
      riskScore: report.riskScore || 0,
      vulnerabilityCount: (report.findings || []).length,
    });

    logger.info(`AI Agent completed: scanId=${scanId} vulns=${(report.findings || []).length} score=${report.riskScore}`);
    return finalSession;
  } catch (err) {
    logger.error(`AI Agent failed: scanId=${scanId} error=${err.message}`);
    await ScanSession.findByIdAndUpdate(scanId, { status: 'failed', finishedAt: new Date() });
    emit(io, scanId, 'ai:failed', { reason: err.message });
    throw err;
  }
};

/**
 * Stop a running scan
 */
const stopAIAgent = async (scanId, userId) => {
  const session = await ScanSession.findOneAndUpdate(
    { _id: scanId, user_id: userId, status: 'running' },
    { status: 'stopped', finishedAt: new Date() },
    { new: true }
  );
  return session;
};

module.exports = {
  runAIAgent,
  stopAIAgent,
};
