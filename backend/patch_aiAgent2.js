const fs = require('fs');
const file = './services/aiAgent.service.js';
let content = fs.readFileSync(file, 'utf8');

const p4Start = content.indexOf('PHASE 4 — Nmap Port Scan');
const p6Start = content.indexOf('PHASE 6 — NVD + Vulners Enrichment');

if(p4Start === -1 || p6Start === -1) {
  console.log("Could not find phase 4 or 6", p4Start, p6Start);
  process.exit(1);
}

const startIndex = content.lastIndexOf('    /* ════════', p4Start);
const endIndex = content.lastIndexOf('    /* ════════', p6Start);

if(startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end index", startIndex, endIndex);
  process.exit(1);
}

const newPhase = `    /* ═══════════════════════════════════════════
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
          nmapRawCombined += \`\\n[\${nmapTarget}] Built-in Scan: \` + JSON.stringify(portScanResult.openPorts || []);
          if (portScanResult.openPorts) {
             allOpenPorts.push(...portScanResult.openPorts);
          }
        } else {
          var nmapLines = nmapOutput.stdout.split('\\n');
          var portRegex = /^(\\d+)\\/(tcp|udp)\\s+open\\s+(\\S+)\\s*(.*)?$/;
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
          nmapRawCombined += \`\\n[\${nmapTarget}]:\\n\` + nmapOutput.stdout.slice(0, 1000);
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
            
            const fw_findings = [...(headersResult.findings || []), ...(sslResult.findings || [])].map(f => \`[\${currentTarget}] \` + f.title + ': ' + f.description);
            allNiktoFindings.push(...fw_findings);
            niktoRawCombined += \`\\n[\${currentTarget}] Built-in Web Scan completed.\`;
          } else {
            var niktoLines = niktoOutput.stdout.split('\\n');
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
                  allNiktoFindings.push(\`[\${currentTarget}] \` + finding);
                }
              }
            }
            niktoRawCombined += \`\\n[\${currentTarget}]:\\n\` + niktoOutput.stdout.slice(0, 1000);
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

`;

content = content.substring(0, startIndex) + newPhase + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log("SUCCESS!");
