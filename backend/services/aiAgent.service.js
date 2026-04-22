/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — AI Agent Service (THE BRAIN)        ║
 * ║   7-Phase Automated Penetration Test Engine  ║
 * ║   Orchestrates: ThreatIntel → crt.sh →       ║
 * ║   DNS → Nmap → Nikto → Gemini → Report      ║
 * ╚══════════════════════════════════════════════╝
 */

const axios = require('axios');
const dns = require('dns').promises;
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const ScanSession = require('../models/scanSession.model');
const provider = process.env.AI_PROVIDER || 'gemini';
const gemini = provider === 'groq' ? require('./groq.service') : require('./gemini.service');
const threatIntel = require('./threatIntel.service');
const nvdVulners = require('./nvdVulners.service');
const mitreAttack = require('./mitreAttack.service');
const builtinScanner = require('./builtinScanner.service');
const logger = require('../utils/logger');

/* ── Socket.io helper ── */
const emit = (io, scanId, event, payload) => {
  if (!io || !scanId) return;
  io.to('scan_' + scanId).emit(event, { scanId: scanId, ...payload });
};

/* ── Update MongoDB progress tracker ── */
const updateProgress = async (scanId, currentPhase, progress, currentMessage) => {
  try {
    await ScanSession.findByIdAndUpdate(scanId, {
      currentPhase: currentPhase,
      progress: Math.min(100, Math.max(0, progress)),
      currentMessage: currentMessage,
    });
  } catch (err) {
    logger.warn('Progress update failed: ' + err.message);
  }
};

/* ── HTTP GET helper for crt.sh (returns raw body) ── */
const httpGet = (url, timeoutMs) => {
  return new Promise((resolve, reject) => {
    var timeout = null;
    var proto = url.indexOf('https') === 0 ? https : http;

    var req = proto.get(url, { timeout: timeoutMs || 30000 }, (res) => {
      var chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        if (timeout) clearTimeout(timeout);
        var body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error('HTTP ' + res.statusCode + ': ' + body.slice(0, 200)));
        }
      });
      res.on('error', (err) => {
        if (timeout) clearTimeout(timeout);
        reject(err);
      });
    });

    req.on('error', (err) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });

    timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('HTTP request timeout after ' + (timeoutMs || 30000) + 'ms'));
    }, timeoutMs || 30000);
  });
};

/* ── Spawn CLI tool with timeout (modified for Kali integration) ── */
const spawnTool = async (bin, args, timeoutMs, onData) => {
  try {
    const { runRemoteExecutable } = require('../utils/commandRunner');
    const stdout = await runRemoteExecutable(bin, args, { timeout: timeoutMs || 180000, onData });
    return { installed: true, stdout: stdout, stderr: '', exitCode: 0, timedOut: false };
  } catch (err) {
    const errorMsg = err.message || '';
    if (errorMsg.includes('ENOENT') || errorMsg.includes('not found') || errorMsg.includes('not recognized') || errorMsg.includes('command not found')) {
      return { installed: false, stdout: '', stderr: errorMsg, exitCode: -1, timedOut: false };
    }
    if (errorMsg.includes('timed out')) {
      return { installed: true, stdout: '', stderr: errorMsg, exitCode: -1, timedOut: true };
    }
    return { installed: true, stdout: errorMsg, stderr: errorMsg, exitCode: -1, timedOut: false };
  }
};

/* ── Extract domain from target (strip www. prefix) ── */
const extractDomain = (target) => {
  var clean = target.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  return clean;
};

/* ── Check if target is an IP address ── */
const isIP = (target) => {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(target);
};


/**
 * ═══════════════════════════════════════════════════
 *   MAIN AI AGENT — 7-PHASE PIPELINE
 * ═══════════════════════════════════════════════════
 */
const runAIAgent = async ({ scanId, targetId, userId, target, scope, io }) => {
  scope = scope || 'full';
  var cleanTarget = extractDomain(target);

  // Update existing session to 'running'
  await ScanSession.findByIdAndUpdate(scanId, {
    status: 'running',
    target_id: targetId || null,
    target: cleanTarget,
    scope: scope,
    maxIterations: 1,
    currentPhase: 'initializing',
    progress: 0,
    currentMessage: 'Initializing AI Agent...',
  });

  logger.info('AI Agent started: scanId=' + scanId + ' target=' + cleanTarget + ' scope=' + scope);
  emit(io, scanId, 'ai:started', { target: cleanTarget, scope: scope, startedAt: new Date() });

  // Accumulate all data across phases
  var completedScans = [];
  var usedTools = [];
  var allVulnerabilities = [];
  var allDecisions = [];
  var nvdEnrichmentData = [];

  try {
    /* ═══════════════════════════════════════════
       PHASE 1 — Threat Intelligence (5% → 18%)
       ═══════════════════════════════════════════ */
    var threatIntelResults = [];
    try {
      await updateProgress(scanId, 'threat_intel', 5, 'Running Threat Intelligence APIs...');
      emit(io, scanId, 'ai:phase_update', { phase: 'threat_intel', status: 'running' });

      logger.info('Phase 1: Threat Intelligence — target=' + cleanTarget);
      threatIntelResults = await threatIntel.runAllThreatIntel(cleanTarget);

      await ScanSession.findByIdAndUpdate(scanId, {
        threatIntelResults: threatIntelResults,
        $push: {
          phases: {
            name: 'recon',
            status: 'completed',
            tools: ['threat_intel_apis'],
            results: { providersRun: Array.isArray(threatIntelResults) ? threatIntelResults.length : 0 },
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });

      completedScans.push({ tool: 'threat_intel_apis', status: 'success', data: threatIntelResults });
      usedTools.push('threat_intel_apis');

      emit(io, scanId, 'ai:tool_complete', { tool: 'threat_intel_apis', status: 'success' });
      await updateProgress(scanId, 'threat_intel', 18, 'Threat Intelligence complete');
      emit(io, scanId, 'ai:phase_update', { phase: 'threat_intel', status: 'completed' });

      logger.info('Phase 1 completed: ' + (Array.isArray(threatIntelResults) ? threatIntelResults.length : 0) + ' providers returned');
    } catch (err) {
      logger.warn('Phase 1 (Threat Intel) failed: ' + err.message);
      await updateProgress(scanId, 'threat_intel', 18, 'Threat Intelligence failed, continuing...');
      emit(io, scanId, 'ai:phase_update', { phase: 'threat_intel', status: 'failed' });

      await ScanSession.findByIdAndUpdate(scanId, {
        $push: {
          phases: {
            name: 'recon',
            status: 'failed',
            tools: ['threat_intel_apis'],
            results: { error: err.message },
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });
    }

    const KALI_IP = process.env.REMOTE_SCANNER_IP || '127.0.0.1';

    /* ═══════════════════════════════════════════
       DYNAMIC ORCHESTRATION LOOP (MCP-Style)
       Iterations 1 to 5: Discovery, Recon, Scanning
       ═══════════════════════════════════════════ */
    let iteration = 1;
    const maxIterations = 5;
    let shouldContinue = true;

    while (iteration <= maxIterations && shouldContinue) {
      logger.info(`Starting AI Agent Iteration ${iteration}/${maxIterations}`);
      
      // --- STRICT THROTTLE: Wait 6s to stay under 15 RPM limit ---
      if (iteration > 1) {
        logger.info('Throttling: Waiting 6s to prevent Gemini rate limits...');
        emit(io, scanId, 'ai:phase_update', { phase: 'ai_analysis', status: 'Thinking (RPM limit protection)...' });
        await new Promise(r => setTimeout(r, 6000));
      }

      emit(io, scanId, 'ai:thinking', { iteration, maxIterations });

      // Analyze current state and decide next tool
      const aiDecision = await gemini.analyzeAndDecide({
        target: cleanTarget,
        scope: scope,
        iteration: iteration,
        maxIterations: maxIterations,
        completedScans: completedScans,
        usedTools: usedTools,
      });

      if (!aiDecision || aiDecision.nextAction === 'generate_report') {
        logger.info(`AI decided to finish at iteration ${iteration}: ${aiDecision?.reasoning || 'No further actions'}`);
        shouldContinue = false;
        break;
      }

      const toolToRun = aiDecision.nextAction;
      const reasoning = aiDecision.reasoning;
      logger.info(`AI Decision: Run ${toolToRun} because ${reasoning}`);

      // Add findings if any were identified in the thought process
      if (Array.isArray(aiDecision.currentFindings)) {
        aiDecision.currentFindings.forEach(f => {
          if (!allVulnerabilities.some(v => v.title === f.title)) allVulnerabilities.push(f);
        });
      }

      // Record decision
      const decisionRecord = {
        iteration,
        action: toolToRun,
        reasoning,
        timestamp: new Date(),
      };
      allDecisions.push(decisionRecord);
      await ScanSession.findByIdAndUpdate(scanId, { $push: { aiDecisions: decisionRecord } });
      emit(io, scanId, 'ai:decision', { iteration, decision: decisionRecord });

      // Execute the chosen tool
      try {
        let toolResult = null;
        let phaseName = 'scanning'; // fallback

        // Map Tool to Progress Phase & Endpoint
        if (toolToRun === 'run_subfinder' && !usedTools.includes('subfinder')) {
          phaseName = 'subdomain_scan';
          await updateProgress(scanId, phaseName, 20 + iteration * 5, 'Running Subdomain Discovery...');
          const res = await axios.post(`http://${KALI_IP}:5000/subfinder`, { target: cleanTarget });
          toolResult = { tool: 'subfinder', data: res.data };
        } else if (toolToRun === 'run_recon' && !usedTools.includes('recon')) {
          phaseName = 'deep_recon';
          await updateProgress(scanId, phaseName, 20 + iteration * 5, 'Running Deep Reconnaissance...');
          const res = await axios.post(`http://${KALI_IP}:5000/recon`, { target: cleanTarget });
          toolResult = { tool: 'recon', data: res.data };
        } else if (toolToRun === 'nmap_scan' && !usedTools.includes('nmap')) {
          phaseName = 'network_scan';
          await updateProgress(scanId, phaseName, 20 + iteration * 5, 'Running Network Port Scan...');
          const res = await axios.post(`http://${KALI_IP}:5000/nmap`, { target: cleanTarget });
          toolResult = { tool: 'nmap', data: res.data };
          emit(io, scanId, 'ai:terminal_log', { tool: 'nmap', text: res.data.raw || 'Nmap scan complete' });
        } else if (toolToRun === 'web_scan_nikto' && !usedTools.includes('nikto')) {
          phaseName = 'nikto_scan';
          await updateProgress(scanId, phaseName, 20 + iteration * 5, 'Running Web Vulnerability Scan...');
          const res = await axios.post(`http://${KALI_IP}:5000/nikto`, { target: cleanTarget });
          toolResult = { tool: 'nikto', data: res.data };
          emit(io, scanId, 'ai:terminal_log', { tool: 'nikto', text: res.data.raw || 'Nikto scan complete' });
        } else if (toolToRun === 'exploit_check' && !usedTools.includes('exploit')) {
          phaseName = 'exploit_scan';
          await updateProgress(scanId, phaseName, 20 + iteration * 5, 'Running Exploitation Checks...');
          const res = await axios.post(`http://${KALI_IP}:5000/exploit`, { target: cleanTarget });
          toolResult = { tool: 'exploit', data: res.data };
        } else if (toolToRun === 'traffic_analysis' && !usedTools.includes('traffic')) {
          phaseName = 'traffic_scan';
          await updateProgress(scanId, phaseName, 20 + iteration * 5, 'Analyzing Network Traffic...');
          const res = await axios.post(`http://${KALI_IP}:5000/traffic`, { target: cleanTarget });
          toolResult = { tool: 'traffic', data: res.data };
        }

        if (toolResult) {
          completedScans.push({ tool: toolResult.tool, status: 'success', data: toolResult.data });
          usedTools.push(toolResult.tool);
          emit(io, scanId, 'ai:tool_complete', { tool: toolResult.tool, status: 'success' });
          emit(io, scanId, 'ai:phase_update', { phase: phaseName, status: 'completed' });
        } else {
          // If tool already used or invalid, skip
          logger.info(`Tool ${toolToRun} already used or skipped.`);
        }

      } catch (err) {
        logger.error(`Error executing tool ${toolToRun}: ${err.message}`);
        emit(io, scanId, 'ai:tool_complete', { tool: toolToRun, status: 'failed', error: err.message });
      }

      iteration++;
    }

    logger.info('Dynamic Orchestration Loop complete. Finalizing report...');

    /* ═══════════════════════════════════════════
       HEURISTIC FALLBACK LOGIC
       Extract findings manually if AI missed them
       ═══════════════════════════════════════════ */
    if (allVulnerabilities.length === 0) {
      logger.info('Running heuristic fallback for findings extraction');

      // 1. Extract from Nmap
      const nmapScan = completedScans.find(s => s.tool === 'nmap' && s.status === 'success');
      if (nmapScan && nmapScan.data && nmapScan.data.ports) {
        nmapScan.data.ports.forEach(p => {
          allVulnerabilities.push({
            title: `Open Service: ${p.service || 'unknown'} on Port ${p.port}`,
            type: 'Network Service',
            severity: (p.port === 21 || p.port === 23 || p.port === 445) ? 'high' : 'medium',
            description: `A network port (${p.port}/${p.protocol}) was found open running ${p.service} ${p.version || ''}.`,
            evidence: `Port: ${p.port}, Service: ${p.service}, Version: ${p.version}`,
            remediation: 'Verify if this service is necessary and ensure it is updated to the latest version.',
            tool: 'nmap'
          });
        });
      }

      // 2. Extract from Nikto
      const niktoScan = completedScans.find(s => s.tool === 'nikto' && s.status === 'success');
      if (niktoScan && niktoScan.data && niktoScan.data.findings) {
        niktoScan.data.findings.forEach(f => {
          allVulnerabilities.push({
            title: 'Web finding: ' + (typeof f === 'string' ? f.slice(0, 50) : 'Finding') + '...',
            type: 'Web Security',
            severity: 'medium',
            description: typeof f === 'string' ? f : JSON.stringify(f),
            evidence: typeof f === 'string' ? f : 'Finding detected',
            remediation: 'Investigate the specific Nikto finding and patch server configuration.',
            tool: 'nikto'
          });
        });
      }

      // 3. Extract from Subfinder
      const subScan = completedScans.find(s => s.tool === 'subfinder' && s.status === 'success');
      if (subScan && subScan.data && subScan.data.subdomains) {
        allVulnerabilities.push({
          title: `Info: ${subScan.data.subdomains.length} Subdomains discovered`,
          type: 'Reconnaissance',
          severity: 'info',
          description: `Identified ${subScan.data.subdomains.length} subdomains.`,
          evidence: subScan.data.subdomains.slice(0, 5).join(', '),
          remediation: 'Audit discovered subdomains.',
          tool: 'subfinder'
        });
      }
    }


    /* ═══════════════════════════════════════════
       PHASE 8 — MITRE ATT&CK Mapping + NVD Enrichment (83% → 88%)
       ═══════════════════════════════════════════ */
    var mitreMapping = { chain: [], mappedVulns: [], tactics: [] };
    var riskCalc = { score: 0, level: 'info', breakdown: {}, explanation: '' };
    try {
      await updateProgress(scanId, 'mitre_mapping', 83, 'Mapping to MITRE ATT&CK framework...');
      emit(io, scanId, 'ai:phase_update', { phase: 'mitre_mapping', status: 'running' });

      logger.info('Phase 8: MITRE ATT&CK mapping + risk calculation — ' + allVulnerabilities.length + ' vulns');

      mitreMapping = mitreAttack.generateAttackChain(allVulnerabilities);

      for (var mi = 0; mi < allVulnerabilities.length; mi++) {
        var vulnMitre = mitreAttack.mapVulnToAttack(allVulnerabilities[mi]);
        allVulnerabilities[mi].mitreMapping = vulnMitre;
      }

      allVulnerabilities = await nvdVulners.enrichVulnerabilities(allVulnerabilities);
      riskCalc = nvdVulners.calculateRealRiskScore(cleanTarget, allVulnerabilities, threatIntelResults);

      completedScans.push({ tool: 'mitre_mapping', status: 'success', data: { tacticsCount: mitreMapping.chain.length, coverage: mitreMapping.coveragePercent } });

      emit(io, scanId, 'ai:tool_complete', { tool: 'mitre_mapping', status: 'success' });
      await updateProgress(scanId, 'mitre_mapping', 88, 'MITRE mapping complete — ' + mitreMapping.chain.length + ' tactics, Risk: ' + riskCalc.score + '/100');
      emit(io, scanId, 'ai:phase_update', { phase: 'mitre_mapping', status: 'completed' });

      logger.info('Phase 8 completed: ' + mitreMapping.chain.length + ' ATT&CK tactics, risk=' + riskCalc.score);
    } catch (err) {
      logger.warn('Phase 8 (MITRE/Enrichment) failed: ' + err.message);
      try {
        riskCalc = nvdVulners.calculateRealRiskScore(cleanTarget, allVulnerabilities, threatIntelResults);
        logger.info('Phase 8 fallback risk score: ' + riskCalc.score);
      } catch (e) { logger.warn('Fallback risk calc also failed: ' + e.message); }
      await updateProgress(scanId, 'mitre_mapping', 88, 'MITRE mapping failed, continuing...');
      emit(io, scanId, 'ai:phase_update', { phase: 'mitre_mapping', status: 'failed' });
    }

    await updateProgress(scanId, 'report_generation', 89, 'Generating penetration test report...');
    emit(io, scanId, 'ai:phase_update', { phase: 'report', status: 'running' });

    logger.info('Phase 9: Report generation — vulns=' + allVulnerabilities.length + ' scans=' + completedScans.length);

    var report = {};
    try {
      report = await gemini.generateReport({
        target: cleanTarget,
        scope: scope,
        completedScans: completedScans,
        vulnerabilities: allVulnerabilities,
        aiDecisions: allDecisions,
        nvdEnrichment: nvdEnrichmentData,
        mitreMapping: mitreMapping,
      });
    } catch (err) {
      logger.warn('Report generation failed: ' + err.message);
      report = {
        executiveSummary: 'Automated penetration test completed for ' + cleanTarget + '. AI report generation encountered an error. Please review raw scan data.',
        riskScore: riskCalc.score || 0,
        overallRiskLevel: riskCalc.level || 'info',
        findings: allVulnerabilities,
        mitreAttackSummary: mitreAttack.getAttackNarrative(allVulnerabilities),
        recommendations: ['Review scan results manually', 'Re-run scan with valid Gemini API key'],
        methodology: 'Automated OSINT + active scanning + NVD/Vulners enrichment + MITRE ATT&CK mapping',
        conclusion: 'Report generation incomplete. Review raw data.',
      };
    }

    // Use real risk score from NVD/Vulners calculation if Gemini score is 0
    var finalRiskScore = (report && report.riskScore && report.riskScore > 0) ? report.riskScore : riskCalc.score;

    // Calculate severity counts from report findings
    var severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    var reportFindings = (report && report.findings) || [];
    for (var si = 0; si < reportFindings.length; si++) {
      var sev = reportFindings[si].severity;
      if (severityCounts[sev] !== undefined) {
        severityCounts[sev]++;
      }
    }

    // Merge: prefer report findings (richer), fall back to raw vulns
    var finalFindings = (reportFindings.length > 0) ? reportFindings : allVulnerabilities;

    // Final session update
    var finalSession = await ScanSession.findByIdAndUpdate(
      scanId,
      {
        status: 'completed',
        currentPhase: 'completed',
        progress: 100,
        currentMessage: 'Scan complete',
        report: {
          executiveSummary: (report && report.executiveSummary) || '',
          technicalDetails: (report && report.methodology) || '',
          riskScore: finalRiskScore,
          recommendations: (report && report.recommendations) || [],
          generatedAt: new Date(),
          mitreAttackSummary: (report && report.mitreAttackSummary) || mitreAttack.getAttackNarrative(allVulnerabilities),
          mitreAttackMapping: mitreMapping,
          riskBreakdown: riskCalc,
        },
        vulnerabilities: finalFindings.map(function (f) {
          return {
            title: (f && f.title) || 'Untitled',
            type: (f && f.type) || 'unknown',
            severity: (f && f.severity) || 'info',
            cvss: (f && f.cvss) || 0,
            description: (f && f.description) || '',
            evidence: (f && f.evidence) || '',
            remediation: (f && f.remediation) || '',
            cveId: (f && f.cveId) || '',
            tool: (f && f.tool) || '',
            mitreMapping: (f && f.mitreMapping) || [],
            nvdData: (f && f.nvdData) || null,
            exploitAvailable: (f && f.exploitAvailable) || false,
            exploitData: (f && f.exploitData) || null,
            relatedCVEs: (f && f.relatedCVEs) || [],
          };
        }),
        finishedAt: new Date(),
      },
      { new: true }
    );

    emit(io, scanId, 'ai:completed', {
      report: report,
      severityCounts: severityCounts,
      riskScore: finalRiskScore,
      vulnerabilityCount: finalFindings.length,
      mitreMapping: mitreMapping,
      riskBreakdown: riskCalc,
    });

    await updateProgress(scanId, 'completed', 100, 'Scan complete — Risk Score: ' + finalRiskScore + '/100');
    emit(io, scanId, 'ai:phase_update', { phase: 'report', status: 'completed' });

    logger.info('AI Agent completed: scanId=' + scanId + ' vulns=' + finalFindings.length + ' score=' + finalRiskScore);
    return finalSession;

  } catch (err) {
    logger.error('AI Agent failed: scanId=' + scanId + ' error=' + err.message);
    await ScanSession.findByIdAndUpdate(scanId, {
      status: 'failed',
      currentPhase: 'failed',
      progress: 0,
      currentMessage: 'Scan failed: ' + err.message,
      finishedAt: new Date(),
    });
    emit(io, scanId, 'ai:failed', { reason: err.message });
    throw err;
  }
};


/**
 * Quick scan — only uses built-in API tools (no CLI), fast results
 */
const runQuickScan = async ({ scanId, userId, target, io }) => {
  var cleanTarget = extractDomain(target);

  await ScanSession.findByIdAndUpdate(scanId, {
    status: 'running',
    currentPhase: 'quick_scan',
    progress: 10,
    currentMessage: 'Running quick scan...',
  });

  logger.info('Quick scan started: scanId=' + scanId + ' target=' + cleanTarget);
  emit(io, scanId, 'ai:started', { target: cleanTarget, scope: 'recon-only', startedAt: new Date() });

  try {
    emit(io, scanId, 'ai:phase_update', { phase: 'quick_scan', status: 'running' });
    await updateProgress(scanId, 'quick_scan', 20, 'Running threat intelligence APIs...');

    var threatIntelResults = await threatIntel.runAllThreatIntel(cleanTarget);

    await updateProgress(scanId, 'quick_scan', 50, 'Threat intel complete, generating report...');
    emit(io, scanId, 'ai:phase_update', { phase: 'quick_scan', status: 'completed' });
    emit(io, scanId, 'ai:phase_update', { phase: 'report', status: 'running' });

    var report = await gemini.generateReport({
      target: cleanTarget,
      scope: 'recon-only',
      completedScans: [
        { tool: 'threat_intel_apis', status: 'success', data: threatIntelResults },
      ],
      vulnerabilities: [],
      aiDecisions: [],
    });

    var finalFindings = (report && report.findings && report.findings.length > 0) ? report.findings : [];

    var finalSession = await ScanSession.findByIdAndUpdate(
      scanId,
      {
        status: 'completed',
        currentPhase: 'completed',
        progress: 100,
        currentMessage: 'Quick scan complete',
        threatIntelResults: threatIntelResults,
        report: {
          executiveSummary: (report && report.executiveSummary) || '',
          technicalDetails: (report && report.methodology) || '',
          riskScore: (report && report.riskScore) || 0,
          recommendations: (report && report.recommendations) || [],
          generatedAt: new Date(),
        },
        vulnerabilities: finalFindings.map(function (f) {
          return {
            title: (f && f.title) || 'Untitled',
            type: (f && f.type) || 'unknown',
            severity: (f && f.severity) || 'info',
            cvss: (f && f.cvss) || 0,
            description: (f && f.description) || '',
            evidence: (f && f.evidence) || '',
            remediation: (f && f.remediation) || '',
            cveId: (f && f.cveId) || '',
            tool: (f && f.tool) || '',
          };
        }),
        phases: [
          { name: 'recon', status: 'completed', tools: ['threat_intel_apis'], results: {}, startedAt: new Date(), finishedAt: new Date() },
          { name: 'report', status: 'completed', tools: ['gemini'], results: {}, startedAt: new Date(), finishedAt: new Date() },
        ],
        finishedAt: new Date(),
      },
      { new: true }
    );

    emit(io, scanId, 'ai:completed', {
      report: report,
      riskScore: (report && report.riskScore) || 0,
      vulnerabilityCount: finalFindings.length,
    });

    logger.info('Quick scan completed: scanId=' + scanId);
    return finalSession;
  } catch (err) {
    logger.error('Quick scan failed: scanId=' + scanId + ' error=' + err.message);
    await ScanSession.findByIdAndUpdate(scanId, {
      status: 'failed',
      currentPhase: 'failed',
      progress: 0,
      currentMessage: 'Quick scan failed: ' + err.message,
      finishedAt: new Date(),
    });
    emit(io, scanId, 'ai:failed', { reason: err.message });
    throw err;
  }
};


/**
 * Stop a running scan
 */
const stopAIAgent = async (scanId, userId) => {
  var session = await ScanSession.findOneAndUpdate(
    { _id: scanId, user_id: userId, status: { $in: ['running', 'queued'] } },
    {
      status: 'stopped',
      currentPhase: 'stopped',
      currentMessage: 'Scan stopped by user',
      finishedAt: new Date(),
    },
    { new: true }
  );
  return session;
};


module.exports = {
  runAIAgent: runAIAgent,
  runQuickScan: runQuickScan,
  stopAIAgent: stopAIAgent,
};
