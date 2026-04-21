const fs = require('fs');
const path = 'C:/Users/sm132/OneDrive/Desktop/AP/PAIA-PROJECT/backend/services/aiAgent.service.js';

let content = fs.readFileSync(path, 'utf8');

// Replace CRLF with LF to normalize
content = content.replace(/\r\n/g, '\n');

const lines = content.split('\n');

// Find end of Nikto (Phase 5)
let niktoErrorLine = lines.findIndex(l => l.includes("results: { error: err.message },"));
if (niktoErrorLine === -1) throw new Error("Nikto error line not found");

// Find start of Phase 9
let reportPhaseStart = lines.findIndex(l => l.includes("updateProgress(scanId, 'report_generation', 89,"));
if (reportPhaseStart === -1) throw new Error("Phase 9 start not found");

// Nikto ends at niktoErrorLine + 6
const cutStart = niktoErrorLine + 7; 
const cutEnd = reportPhaseStart - 3; // Keep the Phase 9 header box

const replacement = `
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
`;

lines.splice(cutStart, cutEnd - cutStart, replacement);

fs.writeFileSync(path, lines.join('\n'));
console.log('Successfully repaired file.');
