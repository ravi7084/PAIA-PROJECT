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
const gemini = require('./gemini.service');
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
       PHASE 2 — Subdomain Discovery (18% → 25%)
       ═══════════════════════════════════════════ */
    var subfinderResults = null;
    if (scope === 'network' || scope === 'web') {
      logger.info(`Phase 2: Skipping Subfinder — scope is ${scope}`);
      await updateProgress(scanId, 'subdomain_scan', 25, `Subfinder skipped (Scope: ${scope})`);
    } else {
      try {
        await updateProgress(scanId, 'subdomain_scan', 18, 'Running Subdomain Discovery (Subfinder)...');
        emit(io, scanId, 'ai:phase_update', { phase: 'subdomain_scan', status: 'running' });
        emit(io, scanId, 'ai:tool_running', { tool: 'subfinder' });
        
        const res = await axios.post(`http://${KALI_IP}:5000/subfinder`, { target: cleanTarget });
        subfinderResults = res.data;
        completedScans.push({ tool: 'subfinder', status: 'success', data: subfinderResults });
        usedTools.push('subfinder');
        
        emit(io, scanId, 'ai:tool_complete', { tool: 'subfinder', status: 'success' });
        await updateProgress(scanId, 'subdomain_scan', 25, 'Subdomain scan complete');
        emit(io, scanId, 'ai:phase_update', { phase: 'subdomain_scan', status: 'completed' });
      } catch (err) {
        logger.warn('Phase 2 (Subfinder) failed: ' + err.message);
        await updateProgress(scanId, 'subdomain_scan', 25, 'Subdomain scan failed, continuing');
        emit(io, scanId, 'ai:phase_update', { phase: 'subdomain_scan', status: 'failed' });
      }
    }

    /* ═══════════════════════════════════════════
       PHASE 3 — Deep Recon (25% → 32%)
       ═══════════════════════════════════════════ */
    var reconResults = null;
    if (scope === 'network' || scope === 'web') {
      logger.info(`Phase 3: Skipping Deep Recon — scope is ${scope}`);
      await updateProgress(scanId, 'deep_recon', 32, `Deep Recon skipped (Scope: ${scope})`);
    } else {
      try {
        await updateProgress(scanId, 'deep_recon', 25, 'Running Deep Recon (theHarvester, SpiderFoot)...');
        emit(io, scanId, 'ai:phase_update', { phase: 'deep_recon', status: 'running' });
        emit(io, scanId, 'ai:tool_running', { tool: 'recon' });
        
        const res = await axios.post(`http://${KALI_IP}:5000/recon`, { target: cleanTarget });
        reconResults = res.data;
        completedScans.push({ tool: 'recon', status: 'success', data: reconResults });
        usedTools.push('recon');
        
        emit(io, scanId, 'ai:tool_complete', { tool: 'recon', status: 'success' });
        await updateProgress(scanId, 'deep_recon', 32, 'Deep Recon complete');
        emit(io, scanId, 'ai:phase_update', { phase: 'deep_recon', status: 'completed' });
      } catch (err) {
        logger.warn('Phase 3 (Recon) failed: ' + err.message);
        await updateProgress(scanId, 'deep_recon', 32, 'Deep Recon failed, continuing');
        emit(io, scanId, 'ai:phase_update', { phase: 'deep_recon', status: 'failed' });
      }
    }

    /* ═══════════════════════════════════════════
       PHASE 4 — Network Recon (NMAP) (32% → 40%)
       ═══════════════════════════════════════════ */
    var nmapResults = { openPorts: [] };
    if (scope === 'recon-only' || scope === 'web') {
      logger.info(`Phase 4: Skipping Nmap — scope is ${scope}`);
      await updateProgress(scanId, 'network_scan', 40, `Nmap skipped (Scope: ${scope})`);
    } else {
      try {
        await updateProgress(scanId, 'network_scan', 32, 'Running Network Scan (Nmap)...');
        emit(io, scanId, 'ai:phase_update', { phase: 'network_scan', status: 'running' });
        emit(io, scanId, 'ai:tool_running', { tool: 'nmap' });
        
        const res = await axios.post(`http://${KALI_IP}:5000/nmap`, { target: cleanTarget });
        nmapResults.openPorts = res.data.ports || [];
        completedScans.push({ tool: 'nmap', status: 'success', data: { openPorts: nmapResults.openPorts } });
        usedTools.push('nmap');
        
        emit(io, scanId, 'ai:terminal_log', { tool: 'nmap', text: res.data.raw || 'Nmap scan completed successfully via API.\n' });
        emit(io, scanId, 'ai:tool_complete', { tool: 'nmap', status: 'success' });
        await updateProgress(scanId, 'network_scan', 40, 'Nmap scan complete');
        emit(io, scanId, 'ai:phase_update', { phase: 'network_scan', status: 'completed' });
      } catch (err) {
        logger.warn('Phase 4 (Nmap) failed: ' + err.message);
        await updateProgress(scanId, 'network_scan', 40, 'Nmap failed, continuing');
        emit(io, scanId, 'ai:phase_update', { phase: 'network_scan', status: 'failed' });
      }
    }

    /* ═══════════════════════════════════════════
       PHASE 5 — Web Vulnerability (Nikto) (40% → 48%)
       ═══════════════════════════════════════════ */
    var niktoResults = null;
    if (scope === 'recon-only' || scope === 'network') {
      logger.info(`Phase 5: Skipping Nikto — scope is ${scope}`);
      await updateProgress(scanId, 'nikto_scan', 48, `Nikto skipped (Scope: ${scope})`);
    } else {
      try {
        await updateProgress(scanId, 'nikto_scan', 40, 'Running Web Vulnerability Scan (Nikto)...');
        emit(io, scanId, 'ai:phase_update', { phase: 'nikto_scan', status: 'running' });
        emit(io, scanId, 'ai:tool_running', { tool: 'nikto' });
        
        const res = await axios.post(`http://${KALI_IP}:5000/nikto`, { target: cleanTarget });
        niktoResults = res.data;
        completedScans.push({ tool: 'nikto', status: 'success', data: { findingCount: (res.data.findings || []).length, findings: (res.data.findings || []).slice(0, 15) } });
        usedTools.push('nikto');
        
        emit(io, scanId, 'ai:terminal_log', { tool: 'nikto', text: res.data.raw || 'Nikto scan completed successfully via API.\n' });
        emit(io, scanId, 'ai:tool_complete', { tool: 'nikto', status: 'success' });
        await updateProgress(scanId, 'nikto_scan', 48, 'Nikto scan complete');
        emit(io, scanId, 'ai:phase_update', { phase: 'nikto_scan', status: 'completed' });
      } catch (err) {
        logger.warn('Phase 5 (Nikto) failed: ' + err.message);
        await updateProgress(scanId, 'nikto_scan', 48, 'Nikto failed, continuing');
        emit(io, scanId, 'ai:phase_update', { phase: 'nikto_scan', status: 'failed' });
      }
    }

    /* ═══════════════════════════════════════════
       PHASE 5.5 — Safe Exploitation (Metasploit) (48% → 55%)
       ═══════════════════════════════════════════ */
    var exploitResults = null;
    if (scope === 'recon-only') {
      logger.info(`Phase 5.5: Skipping Exploit Checks — scope is ${scope}`);
      await updateProgress(scanId, 'exploit_scan', 55, `Exploits skipped (Scope: ${scope})`);
    } else {
      try {
        await updateProgress(scanId, 'exploit_scan', 48, 'Running Safe Exploitation Checks (Metasploit)...');
        emit(io, scanId, 'ai:phase_update', { phase: 'exploit_scan', status: 'running' });
        emit(io, scanId, 'ai:tool_running', { tool: 'exploit' });
        
        const res = await axios.post(`http://${KALI_IP}:5000/exploit`, { target: cleanTarget });
        exploitResults = res.data;
        completedScans.push({ tool: 'exploit', status: 'success', data: exploitResults });
        usedTools.push('exploit');
        
        emit(io, scanId, 'ai:tool_complete', { tool: 'exploit', status: 'success' });
        await updateProgress(scanId, 'exploit_scan', 55, 'Safe Exploit checks complete');
        emit(io, scanId, 'ai:phase_update', { phase: 'exploit_scan', status: 'completed' });
      } catch (err) {
        logger.warn('Phase 5.5 (Exploit) failed: ' + err.message);
        await updateProgress(scanId, 'exploit_scan', 55, 'Exploit checks failed, continuing');
        emit(io, scanId, 'ai:phase_update', { phase: 'exploit_scan', status: 'failed' });
      }
    }

    /* ═══════════════════════════════════════════
       PHASE 5.6 — Traffic Analysis (Tshark) (55% → 62%)
       ═══════════════════════════════════════════ */
    var trafficResults = null;
    try {
      await updateProgress(scanId, 'traffic_scan', 55, 'Running Traffic Analysis (Tshark)...');
      emit(io, scanId, 'ai:phase_update', { phase: 'traffic_scan', status: 'running' });
      emit(io, scanId, 'ai:tool_running', { tool: 'traffic' });
      
      const res = await axios.post(`http://${KALI_IP}:5000/traffic`, { target: cleanTarget });
      trafficResults = res.data;
      completedScans.push({ tool: 'traffic', status: 'success', data: trafficResults });
      usedTools.push('traffic');
      
      emit(io, scanId, 'ai:tool_complete', { tool: 'traffic', status: 'success' });
      await updateProgress(scanId, 'traffic_scan', 62, 'Traffic Analysis complete');
      emit(io, scanId, 'ai:phase_update', { phase: 'traffic_scan', status: 'completed' });
    } catch (err) {
      logger.warn('Phase 5.6 (Traffic) failed: ' + err.message);
      await updateProgress(scanId, 'traffic_scan', 62, 'Traffic Analysis failed, continuing');
      emit(io, scanId, 'ai:phase_update', { phase: 'traffic_scan', status: 'failed' });
    }

    /* ═══════════════════════════════════════════
       PHASE 6 — NVD + Vulners Enrichment (62% → 72%)
       ═══════════════════════════════════════════ */
    var nvdEnrichmentData = [];
    if (scope === 'recon-only') {
      logger.info('Phase 6: Skipping NVD Enrichment — scope is recon-only');
      await updateProgress(scanId, 'nvd_enrichment', 72, 'NVD enrichment skipped (Recon Only)');
    } else {
      try {
        await updateProgress(scanId, 'nvd_enrichment', 62, 'Enriching findings with NVD + Vulners data...');
        emit(io, scanId, 'ai:phase_update', { phase: 'nvd_enrichment', status: 'running' });
        emit(io, scanId, 'ai:tool_running', { tool: 'nvd_vulners' });

        logger.info('Phase 6: NVD/Vulners enrichment — searching for real-world CVE data');

        var serviceKeywords = [];
        var nmapOpenPorts2 = (nmapResults && nmapResults.openPorts) || [];
        for (var sk = 0; sk < nmapOpenPorts2.length; sk++) {
          var p2 = nmapOpenPorts2[sk];
          if (p2.service && p2.version) {
            serviceKeywords.push(p2.service + ' ' + p2.version);
          }
        }

        for (var sw = 0; sw < Math.min(serviceKeywords.length, 3); sw++) {
          try {
            var nvdResults = await nvdVulners.nvdKeywordSearch(serviceKeywords[sw]);
            if (nvdResults.length > 0) {
              nvdEnrichmentData.push({ keyword: serviceKeywords[sw], cves: nvdResults });
            }
            await new Promise(function(r) { setTimeout(r, 700); });
          } catch (e) { logger.warn('NVD search failed for ' + serviceKeywords[sw]); }
        }

        try {
          var vulnersResults = await nvdVulners.vulnersSearch(cleanTarget);
          if (vulnersResults.length > 0) {
            nvdEnrichmentData.push({ source: 'vulners_target', data: vulnersResults });
          }
        } catch (e) { logger.warn('Vulners search failed: ' + e.message); }

        completedScans.push({ tool: 'nvd_vulners', status: 'success', data: { enrichmentCount: nvdEnrichmentData.length } });
        usedTools.push('nvd_vulners');

        emit(io, scanId, 'ai:tool_complete', { tool: 'nvd_vulners', status: 'success' });
        await updateProgress(scanId, 'nvd_enrichment', 72, 'NVD/Vulners enrichment complete — ' + nvdEnrichmentData.length + ' enrichments');
        emit(io, scanId, 'ai:phase_update', { phase: 'nvd_enrichment', status: 'completed' });
        logger.info('Phase 6 completed: ' + nvdEnrichmentData.length + ' NVD/Vulners enrichments');
      } catch (err) {
        logger.warn('Phase 6 (NVD/Vulners) failed: ' + err.message);
        await updateProgress(scanId, 'nvd_enrichment', 72, 'NVD/Vulners enrichment failed, continuing...');
        emit(io, scanId, 'ai:phase_update', { phase: 'nvd_enrichment', status: 'failed' });
      }
    }


    /* ═══════════════════════════════════════════
       PHASE 7 — Gemini AI Analysis (74% → 82%)
       ═══════════════════════════════════════════ */
    try {
      await updateProgress(scanId, 'ai_analysis', 74, 'AI analyzing scan results...');
      emit(io, scanId, 'ai:phase_update', { phase: 'ai_analysis', status: 'running' });
      emit(io, scanId, 'ai:thinking', { iteration: 1, maxIterations: 1 });

      logger.info('Phase 7: Gemini AI analysis — ' + completedScans.length + ' scan results to analyze');

      var aiDecision = await gemini.analyzeAndDecide({
        target: cleanTarget,
        scope: scope,
        iteration: 1,
        maxIterations: 1,
        completedScans: completedScans,
        usedTools: usedTools,
      });

      if (aiDecision && Array.isArray(aiDecision.currentFindings)) {
        for (var fi = 0; fi < aiDecision.currentFindings.length; fi++) {
          allVulnerabilities.push(aiDecision.currentFindings[fi]);
        }
      }

      var decisionRecord = {
        iteration: 1,
        promptSummary: 'Analyzed ' + completedScans.length + ' scan results across ' + usedTools.length + ' tools',
        response: aiDecision,
        reasoning: (aiDecision && aiDecision.reasoning) || '',
        action: (aiDecision && aiDecision.nextAction) || 'generate_report',
        riskLevel: (aiDecision && aiDecision.riskLevel) || 'info',
        timestamp: new Date(),
      };
      allDecisions.push(decisionRecord);

      await ScanSession.findByIdAndUpdate(scanId, {
        currentIteration: 1,
        $push: { aiDecisions: decisionRecord },
      });

      emit(io, scanId, 'ai:decision', { iteration: 1, decision: decisionRecord });
      emit(io, scanId, 'ai:tool_complete', { tool: 'gemini_analysis', status: 'success' });
      await updateProgress(scanId, 'ai_analysis', 82, 'AI analysis complete — ' + allVulnerabilities.length + ' vulnerabilities identified');
      emit(io, scanId, 'ai:phase_update', { phase: 'ai_analysis', status: 'completed' });

      logger.info('Phase 7 completed: ' + allVulnerabilities.length + ' vulns, risk=' + ((aiDecision && aiDecision.riskLevel) || 'info'));
    } catch (err) {
      logger.warn('Phase 7 (Gemini Analysis) failed: ' + err.message);
      await updateProgress(scanId, 'ai_analysis', 82, 'AI analysis failed, using heuristic fallback...');
      emit(io, scanId, 'ai:phase_update', { phase: 'ai_analysis', status: 'failed' });

      // --- HEURISTIC FALLBACK LOGIC ---
      if (allVulnerabilities.length === 0) {
        logger.info('Running heuristic fallback for findings extraction');
        
        // 1. Extract from Nmap
        if (nmapResults && nmapResults.openPorts && nmapResults.openPorts.length > 0) {
          nmapResults.openPorts.forEach(p => {
            allVulnerabilities.push({
              title: `Open Service: ${p.service || 'unknown'} on Port ${p.port}`,
              type: 'Network Service',
              severity: (p.port === 21 || p.port === 23 || p.port === 445) ? 'high' : 'medium',
              description: `A network port (${p.port}/${p.protocol}) was found open running ${p.service} ${p.version || ''}.`,
              evidence: `Port: ${p.port}, Service: ${p.service}, Version: ${p.version}`,
              remediation: 'Verify if this service is necessary and ensure it is updated to the latest version. Close the port if it is not required.',
              tool: 'nmap'
            });
          });
        }

        // 2. Extract from Nikto (Phase 5 was stored in completedScans)
        const niktoScan = completedScans.find(s => s.tool === 'nikto' && s.status === 'success');
        if (niktoScan && niktoScan.data && niktoScan.data.findings) {
          niktoScan.data.findings.forEach(f => {
            allVulnerabilities.push({
              title: 'Web finding: ' + (f.slice(0, 50) + '...'),
              type: 'Web Security',
              severity: f.toLowerCase().includes('vulnerable') ? 'high' : 'medium',
              description: f,
              evidence: f,
              remediation: 'Investigate the specific Nikto finding and patch the web server configuration or application code.',
              tool: 'nikto'
            });
          });
        }

        // 3. Extract from Subfinder
        const subScan = completedScans.find(s => s.tool === 'subfinder' && s.status === 'success');
        if (subScan && subScan.data && subScan.data.subdomains && subScan.data.subdomains.length > 0) {
          allVulnerabilities.push({
            title: `Information Disclosure: ${subScan.data.subdomains.length} Subdomains discovered`,
            type: 'Reconnaissance',
            severity: 'info',
            description: `A total of ${subScan.data.subdomains.length} subdomains were identified, increasing the attack surface.`,
            evidence: subScan.data.subdomains.slice(0, 10).join(', ') + (subScan.data.subdomains.length > 10 ? '...' : ''),
            remediation: 'Ensure all subdomains are authorized and do not expose sensitive development or staging environments.',
            tool: 'subfinder'
          });
        }
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

      completedScans.push({ tool: 'mitre_mapping', status: 'success', data: { tacticsCount: mitreMapping.chain.length, coverage: mitreMapping.coveragePercent } });

      
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
