/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — AI Agent Service (THE BRAIN)        ║
 * ║   7-Phase Automated Penetration Test Engine  ║
 * ║   Orchestrates: ThreatIntel → crt.sh →       ║
 * ║   DNS → Nmap → Nikto → Gemini → Report      ║
 * ╚══════════════════════════════════════════════╝
 */

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
const spawnTool = async (bin, args, timeoutMs) => {
  try {
    const { runRemoteExecutable } = require('../utils/commandRunner');
    const stdout = await runRemoteExecutable(bin, args, { timeout: timeoutMs || 180000 });
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


    /* ═══════════════════════════════════════════
       PHASE 2 — Subdomain Enumeration via crt.sh (20% → 32%)
       ═══════════════════════════════════════════ */
    var subdomains = [];
    try {
      var skipSubdomains = isIP(cleanTarget);
      if (skipSubdomains) {
        logger.info('Phase 2: Skipping crt.sh — target is an IP address');
        await updateProgress(scanId, 'subdomain_enum', 32, 'Subdomain enum skipped (IP target)');
      } else {
        await updateProgress(scanId, 'subdomain_enum', 20, 'Enumerating subdomains via crt.sh...');
        emit(io, scanId, 'ai:phase_update', { phase: 'subdomain_enum', status: 'running' });

        logger.info('Phase 2: crt.sh subdomain enumeration — domain=' + cleanTarget);
        var crtUrl = 'https://crt.sh/?q=%25.' + encodeURIComponent(cleanTarget) + '&output=json';
        var crtBody = await httpGet(crtUrl, 30000);
        var crtData = JSON.parse(crtBody);

        // Deduplicate and filter wildcards
        var subdomainSet = {};
        if (Array.isArray(crtData)) {
          for (var ci = 0; ci < crtData.length; ci++) {
            var nameValue = crtData[ci].name_value || '';
            var names = nameValue.split('\n');
            for (var ni = 0; ni < names.length; ni++) {
              var sub = names[ni].trim().toLowerCase();
              // Filter out wildcards and empty
              if (sub && sub.indexOf('*') === -1 && sub.length > 0) {
                subdomainSet[sub] = true;
              }
            }
          }
        }
        subdomains = Object.keys(subdomainSet).sort();

        completedScans.push({
          tool: 'crt_sh',
          status: 'success',
          data: { subdomainCount: subdomains.length, subdomains: subdomains.slice(0, 100) },
        });
        usedTools.push('crt_sh');

        await ScanSession.findByIdAndUpdate(scanId, {
          $push: {
            phases: {
              name: 'subdomain',
              status: 'completed',
              tools: ['crt_sh'],
              results: { count: subdomains.length, sample: subdomains.slice(0, 20) },
              startedAt: new Date(),
              finishedAt: new Date(),
            },
          },
        });

        emit(io, scanId, 'ai:tool_complete', { tool: 'crt_sh', status: 'success' });
        await updateProgress(scanId, 'subdomain_enum', 32, 'Found ' + subdomains.length + ' subdomains');
        emit(io, scanId, 'ai:phase_update', { phase: 'subdomain_enum', status: 'completed' });

        logger.info('Phase 2 completed: ' + subdomains.length + ' subdomains found');
      }
    } catch (err) {
      logger.warn('Phase 2 (crt.sh) failed: ' + err.message);
      await updateProgress(scanId, 'subdomain_enum', 32, 'Subdomain enumeration failed, continuing...');
      emit(io, scanId, 'ai:phase_update', { phase: 'subdomain_enum', status: 'failed' });

      await ScanSession.findByIdAndUpdate(scanId, {
        $push: {
          phases: {
            name: 'subdomain',
            status: 'failed',
            tools: ['crt_sh'],
            results: { error: err.message },
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });
    }


    /* ═══════════════════════════════════════════
       PHASE 2.5 — Target Preparation
       ═══════════════════════════════════════════ */
    var scanTargets = [cleanTarget];
    if (subdomains && subdomains.length > 0) {
      var additional = subdomains.filter(s => s !== cleanTarget).slice(0, 3);
      for (var i = 0; i < additional.length; i++) scanTargets.push(additional[i]);
    }


    /* ═══════════════════════════════════════════
       PHASE 3 — DNS Records via Node.js dns.promises (34% → 42%)
       ═══════════════════════════════════════════ */
    var dnsResults = {};
    try {
      var skipDNS = isIP(cleanTarget);
      if (skipDNS) {
        // Reverse DNS for IP
        await updateProgress(scanId, 'dns_resolution', 34, 'Performing reverse DNS lookup...');
        emit(io, scanId, 'ai:phase_update', { phase: 'dns_resolution', status: 'running' });

        try {
          var reverseNames = await dns.reverse(cleanTarget);
          dnsResults = { reverse: reverseNames, ip: cleanTarget };
        } catch (e) {
          dnsResults = { reverse: [], ip: cleanTarget, error: e.message };
        }
      } else {
        await updateProgress(scanId, 'dns_resolution', 34, 'Resolving DNS records...');
        emit(io, scanId, 'ai:phase_update', { phase: 'dns_resolution', status: 'running' });

        logger.info('Phase 3: DNS resolution — domain=' + cleanTarget);

        var dnsQueries = [
          { type: 'A', fn: dns.resolve4(cleanTarget).catch(function () { return []; }) },
          { type: 'AAAA', fn: dns.resolve6(cleanTarget).catch(function () { return []; }) },
          { type: 'MX', fn: dns.resolveMx(cleanTarget).catch(function () { return []; }) },
          { type: 'NS', fn: dns.resolveNs(cleanTarget).catch(function () { return []; }) },
          { type: 'TXT', fn: dns.resolveTxt(cleanTarget).catch(function () { return []; }) },
          { type: 'CNAME', fn: dns.resolveCname(cleanTarget).catch(function () { return []; }) },
        ];

        var dnsSettled = await Promise.allSettled(dnsQueries.map(function (q) { return q.fn; }));

        for (var di = 0; di < dnsQueries.length; di++) {
          var result = dnsSettled[di];
          if (result.status === 'fulfilled') {
            dnsResults[dnsQueries[di].type] = result.value;
          } else {
            dnsResults[dnsQueries[di].type] = [];
          }
        }
      }

      completedScans.push({ tool: 'dns_resolver', status: 'success', data: dnsResults });
      usedTools.push('dns_resolver');

      await ScanSession.findByIdAndUpdate(scanId, {
        $push: {
          phases: {
            name: 'recon',
            status: 'completed',
            tools: ['dns_resolver'],
            results: dnsResults,
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });

      emit(io, scanId, 'ai:tool_complete', { tool: 'dns_resolver', status: 'success' });
      await updateProgress(scanId, 'dns_resolution', 42, 'DNS resolution complete');
      emit(io, scanId, 'ai:phase_update', { phase: 'dns_resolution', status: 'completed' });

      logger.info('Phase 3 completed: DNS records resolved');
    } catch (err) {
      logger.warn('Phase 3 (DNS) failed: ' + err.message);
      await updateProgress(scanId, 'dns_resolution', 42, 'DNS resolution failed, continuing...');
      emit(io, scanId, 'ai:phase_update', { phase: 'dns_resolution', status: 'failed' });

      await ScanSession.findByIdAndUpdate(scanId, {
        $push: {
          phases: {
            name: 'recon',
            status: 'failed',
            tools: ['dns_resolver'],
            results: { error: err.message },
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });
    }


    /* ═══════════════════════════════════════════
       PHASE 4 — Nmap Port Scan (44% → 55%)
       ═══════════════════════════════════════════ */
    var nmapResults = { openPorts: [], raw: '' };
    try {
      await updateProgress(scanId, 'nmap_scan', 44, 'Running Nmap port scan on ' + scanTargets.length + ' targets...');
      emit(io, scanId, 'ai:phase_update', { phase: 'nmap_scan', status: 'running' });
      emit(io, scanId, 'ai:tool_running', { tool: 'nmap' });

      var nmapBin = process.env.NMAP_BIN || 'nmap';
      var allOpenPorts = [];
      var nmapRawCombined = '';
      var nmapInstalled = true;

      for (var ti = 0; ti < scanTargets.length; ti++) {
        var currentTarget = scanTargets[ti];
        var nmapTarget = currentTarget;
        if (currentTarget === cleanTarget && !isIP(cleanTarget) && dnsResults.A && dnsResults.A.length > 0) {
          nmapTarget = dnsResults.A[0];
        }

        logger.info('Phase 4: Nmap scan — target=' + nmapTarget + ' bin=' + nmapBin);
        var nmapOutput = await spawnTool(nmapBin, ['-sV', '-Pn', '--top-ports', '1000', nmapTarget], 180000);

        if (!nmapOutput.installed) {
          nmapInstalled = false;
          logger.warn('Nmap not installed — fallback Built-in Port Scanner for: ' + nmapTarget);
          const portScanResult = await builtinScanner.scanPorts(nmapTarget);
          nmapRawCombined += `\n[${nmapTarget}] Built-in Scan: ` + JSON.stringify(portScanResult.openPorts || []);
          if (portScanResult.openPorts) {
             allOpenPorts.push(...portScanResult.openPorts);
          }
        } else {
          var nmapLines = nmapOutput.stdout.split('\n');
          var portRegex = /^(\d+)\/(tcp|udp)\s+open\s+(\S+)\s*(.*)?$/;
          for (var pi = 0; pi < nmapLines.length; pi++) {
            var match = nmapLines[pi].trim().match(portRegex);
            if (match) {
              allOpenPorts.push({
                target: nmapTarget,
                port: parseInt(match[1], 10),
                protocol: match[2],
                service: match[3],
                version: (match[4] || '').trim(),
              });
            }
          }
          nmapRawCombined += `\n[${nmapTarget}]:\n` + nmapOutput.stdout.slice(0, 1000);
        }
      }

      nmapResults = {
        installed: nmapInstalled,
        openPorts: allOpenPorts,
        portCount: allOpenPorts.length,
        raw: nmapRawCombined.slice(0, 3000),
      };

      var toolName = nmapInstalled ? 'nmap' : 'nmap_fallback';
      usedTools.push(nmapInstalled ? 'nmap' : 'builtin_port_scanner');
      completedScans.push({ tool: toolName, status: 'success', data: nmapResults });

      await ScanSession.findByIdAndUpdate(scanId, {
        $push: {
          phases: {
            name: 'network',
            status: 'completed',
            tools: [toolName],
            results: { openPorts: allOpenPorts.length, ports: allOpenPorts.slice(0, 20) },
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });

      logger.info('Phase 4 completed: ' + allOpenPorts.length + ' open ports found across targets');
      emit(io, scanId, 'ai:tool_complete', { tool: 'nmap', status: 'success' });
      await updateProgress(scanId, 'nmap_scan', 55, (nmapInstalled ? 'Nmap' : 'Built-in Port Scan') + ' complete — ' + allOpenPorts.length + ' ports open');
      emit(io, scanId, 'ai:phase_update', { phase: 'nmap_scan', status: 'completed' });
    } catch (err) {
      logger.warn('Phase 4 (Nmap) failed: ' + err.message);
      await updateProgress(scanId, 'nmap_scan', 55, 'Nmap scan failed, continuing...');
      emit(io, scanId, 'ai:phase_update', { phase: 'nmap_scan', status: 'failed' });

      await ScanSession.findByIdAndUpdate(scanId, {
        $push: {
          phases: {
            name: 'network',
            status: 'failed',
            tools: ['nmap'],
            results: { error: err.message },
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });
    }


    /* ═══════════════════════════════════════════
       PHASE 4.5 — Built-in Security Scan (55% → 60%)
       ═══════════════════════════════════════════ */
    try {
      await updateProgress(scanId, 'builtin_scan', 55, 'Running Built-in Security Scans...');
      emit(io, scanId, 'ai:phase_update', { phase: 'builtin_scan', status: 'running' });

      var builtinAllResults = [];
      for (var ti = 0; ti < scanTargets.length; ti++) {
        var currentTarget = scanTargets[ti];
        logger.info('Phase 4.5: Built-in scans — target=' + currentTarget);
        
        const techResult = await builtinScanner.detectTechnology(currentTarget);
        const robotsResult = await builtinScanner.checkRobotsSitemap(currentTarget);
        
        builtinAllResults.push({ target: currentTarget, technology: techResult, robotsSitemap: robotsResult });
        
        if (techResult && techResult.findings) allVulnerabilities.push(...techResult.findings);
        if (robotsResult && robotsResult.findings) allVulnerabilities.push(...robotsResult.findings);
      }
      
      completedScans.push({ tool: 'builtin_security', status: 'success', data: builtinAllResults });
      usedTools.push('builtin_security');

      await updateProgress(scanId, 'builtin_scan', 60, 'Built-in scans complete');
      emit(io, scanId, 'ai:phase_update', { phase: 'builtin_scan', status: 'completed' });
    } catch (err) {
      logger.warn('Phase 4.5 (Built-in) failed: ' + err.message);
    }


    /* ═══════════════════════════════════════════
       PHASE 5 — Nikto Web Scan (60% → 70%)
       ═══════════════════════════════════════════ */
    var niktoResults = { findings: [], raw: '' };
    try {
      var webPorts = [80, 443, 8080, 8443, 8000, 8888, 3000];
      var hasWebPort = false;
      var nmapOpenPorts = (nmapResults && nmapResults.openPorts) || [];
      for (var wp = 0; wp < nmapOpenPorts.length; wp++) {
        if (webPorts.indexOf(nmapOpenPorts[wp].port) !== -1) {
          hasWebPort = true;
          break;
        }
      }

      var shouldRunNikto = (scope !== 'network') && (hasWebPort || scope === 'web' || nmapResults.installed === false);

      if (!shouldRunNikto) {
        logger.info('Phase 5: Skipping Nikto — no web ports detected and scope is not web');
        await updateProgress(scanId, 'nikto_scan', 70, 'Nikto skipped (no web ports or network-only scope)');

        completedScans.push({ tool: 'nikto', status: 'skipped', data: { reason: 'No web ports detected' } });
        usedTools.push('nikto');

        await ScanSession.findByIdAndUpdate(scanId, {
          $push: {
            phases: {
              name: 'webapp',
              status: 'skipped',
              tools: ['nikto'],
              results: { reason: 'No web ports detected' },
              startedAt: new Date(),
              finishedAt: new Date(),
            },
          },
        });
      } else {
        await updateProgress(scanId, 'nikto_scan', 62, 'Running Nikto web vulnerability scan on ' + scanTargets.length + ' targets...');
        emit(io, scanId, 'ai:phase_update', { phase: 'nikto_scan', status: 'running' });
        emit(io, scanId, 'ai:tool_running', { tool: 'nikto' });

        var niktoBin = process.env.NIKTO_BIN || 'nikto';
        var allNiktoFindings = [];
        var niktoRawCombined = '';
        var niktoInstalled = true;

        for (var ti = 0; ti < scanTargets.length; ti++) {
          var currentTarget = scanTargets[ti];
          var niktoTarget = 'http://' + currentTarget;
          logger.info('Phase 5: Nikto scan — target=' + niktoTarget + ' bin=' + niktoBin);

          var niktoOutput = await spawnTool(niktoBin, ['-h', niktoTarget, '-nointeractive'], 180000);

          if (!niktoOutput.installed) {
            niktoInstalled = false;
            logger.warn('Nikto not installed — fallback Built-in Web Scanner for: ' + currentTarget);
            
            const headersResult = await builtinScanner.checkSecurityHeaders(currentTarget);
            const sslResult = await builtinScanner.checkSSL(currentTarget);
            
            if (headersResult && headersResult.findings) allVulnerabilities.push(...headersResult.findings);
            if (sslResult && sslResult.findings) allVulnerabilities.push(...sslResult.findings);
            
            const fw_findings = [...(headersResult.findings || []), ...(sslResult.findings || [])].map(f => `[${currentTarget}] ` + f.title + ': ' + f.description);
            allNiktoFindings.push(...fw_findings);
            niktoRawCombined += `\n[${currentTarget}] Built-in Web Scan completed.`;
          } else {
            var niktoLines = niktoOutput.stdout.split('\n');
            for (var nk = 0; nk < niktoLines.length; nk++) {
              var line = niktoLines[nk].trim();
              if (line.indexOf('+ ') === 0 && line.length > 10) {
                var finding = line.substring(2).trim();
                if (finding.indexOf('Target IP:') === -1 &&
                    finding.indexOf('Target Hostname:') === -1 &&
                    finding.indexOf('Target Port:') === -1 &&
                    finding.indexOf('Start Time:') === -1 &&
                    finding.indexOf('End Time:') === -1 &&
                    finding.indexOf('host(s) tested') === -1) {
                  allNiktoFindings.push(`[${currentTarget}] ` + finding);
                }
              }
            }
            niktoRawCombined += `\n[${currentTarget}]:\n` + niktoOutput.stdout.slice(0, 1000);
          }
        }

        niktoResults = {
          installed: niktoInstalled,
          findings: allNiktoFindings,
          findingCount: allNiktoFindings.length,
          raw: niktoRawCombined.slice(0, 3000)
        };

        var ntoolName = niktoInstalled ? 'nikto' : 'nikto_fallback';
        usedTools.push(niktoInstalled ? 'nikto' : 'builtin_web_scanner');
        completedScans.push({ tool: ntoolName, status: 'success', data: niktoResults });

        await ScanSession.findByIdAndUpdate(scanId, {
          $push: {
            phases: {
              name: 'webapp',
              status: 'completed',
              tools: [ntoolName],
              results: { findingCount: allNiktoFindings.length, findings: allNiktoFindings.slice(0, 20) },
              startedAt: new Date(),
              finishedAt: new Date(),
            },
          },
        });

        logger.info('Phase 5 completed: ' + allNiktoFindings.length + ' Nikto findings across targets');
        emit(io, scanId, 'ai:tool_complete', { tool: 'nikto', status: 'success' });
        await updateProgress(scanId, 'nikto_scan', 70, (niktoInstalled ? 'Nikto' : 'Built-in Web Scan') + ' complete — ' + allNiktoFindings.length + ' findings');
        emit(io, scanId, 'ai:phase_update', { phase: 'nikto_scan', status: 'completed' });
      }
    } catch (err) {
      logger.warn('Phase 5 (Nikto) failed: ' + err.message);
      await updateProgress(scanId, 'nikto_scan', 70, 'Nikto scan failed, continuing...');
      emit(io, scanId, 'ai:phase_update', { phase: 'nikto_scan', status: 'failed' });

      await ScanSession.findByIdAndUpdate(scanId, {
        $push: {
          phases: {
            name: 'webapp',
            status: 'failed',
            tools: ['nikto'],
            results: { error: err.message },
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        },
      });
    }

    /* ═══════════════════════════════════════════
       PHASE 6 — NVD + Vulners Enrichment (62% → 72%)
       ═══════════════════════════════════════════ */
    var nvdEnrichmentData = [];
    try {
      await updateProgress(scanId, 'nvd_enrichment', 62, 'Enriching findings with NVD + Vulners data...');
      emit(io, scanId, 'ai:phase_update', { phase: 'nvd_enrichment', status: 'running' });
      emit(io, scanId, 'ai:tool_running', { tool: 'nvd_vulners' });

      logger.info('Phase 6: NVD/Vulners enrichment — searching for real-world CVE data');

      // Search NVD for services found in scan results
      var serviceKeywords = [];
      var nmapOpenPorts2 = (nmapResults && nmapResults.openPorts) || [];
      for (var sk = 0; sk < nmapOpenPorts2.length; sk++) {
        var p2 = nmapOpenPorts2[sk];
        if (p2.service && p2.version) {
          serviceKeywords.push(p2.service + ' ' + p2.version);
        }
      }

      // Search NVD for each detected service
      for (var sw = 0; sw < Math.min(serviceKeywords.length, 3); sw++) {
        try {
          var nvdResults = await nvdVulners.nvdKeywordSearch(serviceKeywords[sw]);
          if (nvdResults.length > 0) {
            nvdEnrichmentData.push({ keyword: serviceKeywords[sw], cves: nvdResults });
          }
          await new Promise(function(r) { setTimeout(r, 700); }); // NVD rate limit
        } catch (e) { logger.warn('NVD search failed for ' + serviceKeywords[sw]); }
      }

      // Vulners search for the target
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

      // Extract AI-identified vulnerabilities
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
      await updateProgress(scanId, 'ai_analysis', 82, 'AI analysis failed, proceeding to report...');
      emit(io, scanId, 'ai:phase_update', { phase: 'ai_analysis', status: 'failed' });
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

      // Map all vulnerabilities to MITRE ATT&CK
      mitreMapping = mitreAttack.generateAttackChain(allVulnerabilities);

      // Add MITRE mapping to each vulnerability
      for (var mi = 0; mi < allVulnerabilities.length; mi++) {
        var vulnMitre = mitreAttack.mapVulnToAttack(allVulnerabilities[mi]);
        allVulnerabilities[mi].mitreMapping = vulnMitre;
      }

      // Enrich vulnerabilities with NVD data (CVSS, descriptions, exploit check)
      allVulnerabilities = await nvdVulners.enrichVulnerabilities(allVulnerabilities);

      // Calculate real risk score
      riskCalc = nvdVulners.calculateRealRiskScore(cleanTarget, allVulnerabilities, threatIntelResults);

      completedScans.push({ tool: 'mitre_mapping', status: 'success', data: { tacticsCount: mitreMapping.chain.length, coverage: mitreMapping.coveragePercent } });

      emit(io, scanId, 'ai:tool_complete', { tool: 'mitre_mapping', status: 'success' });
      await updateProgress(scanId, 'mitre_mapping', 88, 'MITRE mapping complete — ' + mitreMapping.chain.length + ' tactics, Risk: ' + riskCalc.score + '/100');
      emit(io, scanId, 'ai:phase_update', { phase: 'mitre_mapping', status: 'completed' });

      logger.info('Phase 8 completed: ' + mitreMapping.chain.length + ' ATT&CK tactics, risk=' + riskCalc.score);
    } catch (err) {
      logger.warn('Phase 8 (MITRE/Enrichment) failed: ' + err.message);
      await updateProgress(scanId, 'mitre_mapping', 88, 'MITRE mapping failed, continuing...');
      emit(io, scanId, 'ai:phase_update', { phase: 'mitre_mapping', status: 'failed' });
    }


    /* ═══════════════════════════════════════════
       PHASE 9 — Report Generation (89% → 100%)
       ═══════════════════════════════════════════ */
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
