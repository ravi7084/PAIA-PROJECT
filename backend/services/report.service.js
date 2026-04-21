/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Report Service (PROFESSIONAL PDF)   ║
 * ║   Enterprise-grade PDF report generation     ║
 * ║   + MITRE ATT&CK matrix + NVD enrichment    ║
 * ╚══════════════════════════════════════════════╝
 */

const Report = require('../models/report.model');
const ScanSession = require('../models/scanSession.model');
const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');

/**
 * Create report from a completed ScanSession
 */
const createReportFromSession = async (scanSessionId, userId) => {
  const session = await ScanSession.findOne({ _id: scanSessionId, user_id: userId });
  if (!session) throw new Error('Scan session not found');
  if (session.status !== 'completed') throw new Error('Scan not yet completed');

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  (session.vulnerabilities || []).forEach((v) => {
    if (severityCounts[v.severity] !== undefined) severityCounts[v.severity]++;
  });

  const report = await Report.create({
    user_id: userId,
    scanSession_id: scanSessionId,
    target: session.target,
    title: `Penetration Test Report — ${session.target}`,
    format: 'pdf',
    executiveSummary: session.report?.executiveSummary || '',
    scope: session.scope || 'full',
    methodology: session.report?.technicalDetails || 'Automated AI-driven penetration testing using PAIA with NVD/Vulners enrichment and MITRE ATT&CK mapping',
    findings: session.vulnerabilities.map((v) => ({
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
    conclusion: `Scan completed at ${session.finishedAt?.toISOString() || 'N/A'}. ${session.vulnerabilities.length} findings identified.`,
    mitreAttackSummary: session.report?.mitreAttackSummary || '',
    mitreAttackMapping: session.report?.mitreAttackMapping || null,
    riskBreakdown: session.report?.riskBreakdown || null,
  });

  logger.info(`Report created: ${report._id} for session ${scanSessionId}`);
  return report;
};

/**
 * Generate a PROFESSIONAL PDF
 */
const generatePDF = (report, res) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

  res.setHeader('Content-disposition', `attachment; filename="PAIA-Report-${report.target.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
  res.setHeader('Content-type', 'application/pdf');
  doc.pipe(res);

  // Auto-sanitize text to prevent pdfkit from crashing on unicode/emojis
  const originalText = doc.text;
  doc.text = function(text, ...args) {
    if (typeof text === 'string') {
      text = text.replace(/⚠/g, '[!] ')
                 .replace(/→/g, '->')
                 .replace(/↓/g, 'v')
                 .replace(/—/g, '-')
                 .replace(/[^\x00-\x7F]/g, "");
    }
    return originalText.call(this, text, ...args);
  };

  // ── Color Palette ──
  const C = {
    primary: '#4f46e5', primaryDark: '#3730a3', white: '#ffffff',
    bg: '#0f172a', bgLight: '#1e293b', bgCard: '#1a1f3a',
    text: '#1a1a2e', textSub: '#4a4a6a', textLight: '#6b7280',
    critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#6366f1', info: '#64748b',
    green: '#10b981', border: '#e2e8f0',
  };

  const sevColor = (s) => C[s] || C.info;

  const pageWidth = doc.page.width - 100; // margins

  // ═══════════════════════════════════════════
  //   COVER PAGE
  // ═══════════════════════════════════════════
  // Header bar
  doc.rect(0, 0, doc.page.width, 200).fill(C.primary);
  doc.rect(0, 200, doc.page.width, 4).fill('#818cf8');

  // PAIA Logo text
  doc.fillColor(C.white).fontSize(12).font('Helvetica').text('PAIA', 50, 30);
  doc.fontSize(8).text('SECURITY PLATFORM', 50, 45);

  // Report title
  doc.fontSize(32).font('Helvetica-Bold').text('Penetration Test', 50, 80);
  doc.fontSize(32).text('Security Report', 50, 118);

  // Subtitle
  doc.fontSize(12).font('Helvetica').text('Comprehensive Vulnerability Assessment & Risk Analysis', 50, 162);

  // Classification Badge
  doc.rect(doc.page.width - 190, 30, 140, 28).fill('rgba(255,255,255,0.2)');
  doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold').text('CONFIDENTIAL', doc.page.width - 180, 39);

  // Report metadata
  doc.fillColor(C.text).font('Helvetica-Bold').fontSize(11);
  doc.text('Target:', 50, 240); doc.font('Helvetica').text(report.target, 160, 240);
  doc.font('Helvetica-Bold').text('Scope:', 50, 260); doc.font('Helvetica').text(report.scope || 'Full', 160, 260);
  doc.font('Helvetica-Bold').text('Date:', 50, 280); doc.font('Helvetica').text(new Date(report.generatedAt || report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 160, 280);
  doc.font('Helvetica-Bold').text('Report ID:', 50, 300); doc.font('Helvetica').fontSize(9).text(report._id?.toString() || 'N/A', 160, 300);

  // Risk Score gauge
  const riskScore = report.riskScore || 0;
  const riskColor = riskScore >= 80 ? C.critical : riskScore >= 60 ? C.high : riskScore >= 35 ? C.medium : riskScore >= 15 ? C.low : C.green;

  doc.rect(50, 340, pageWidth, 80).lineWidth(1).stroke(C.border);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(C.text).text('OVERALL RISK SCORE', 70, 352);

  // Score circle
  doc.circle(140, 395, 25).lineWidth(3).stroke(riskColor);
  doc.fontSize(22).font('Helvetica-Bold').fillColor(riskColor).text(String(riskScore), 120, 383, { width: 40, align: 'center' });
  doc.fontSize(7).fillColor(C.textLight).text('/100', 145, 405);

  // Severity distribution
  const sc = report.severityCounts || {};
  let sx = 220;
  [
    { label: 'CRITICAL', count: sc.critical || 0, color: C.critical },
    { label: 'HIGH', count: sc.high || 0, color: C.high },
    { label: 'MEDIUM', count: sc.medium || 0, color: C.medium },
    { label: 'LOW', count: sc.low || 0, color: C.low },
    { label: 'INFO', count: sc.info || 0, color: C.info },
  ].forEach(item => {
    doc.rect(sx, 355, 60, 50).fillAndStroke(item.color + '10', item.color + '30');
    doc.fontSize(18).font('Helvetica-Bold').fillColor(item.color).text(String(item.count), sx, 360, { width: 60, align: 'center' });
    doc.fontSize(6).font('Helvetica-Bold').fillColor(C.textLight).text(item.label, sx, 385, { width: 60, align: 'center' });
    sx += 68;
  });

  // Risk breakdown
  if (report.riskBreakdown && report.riskBreakdown.breakdown) {
    const bd = report.riskBreakdown.breakdown;
    doc.moveDown(6);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.text).text('RISK SCORE BREAKDOWN:', 50);
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica').fillColor(C.textSub);
    doc.text(`Vulnerability Score: ${bd.vulnScore || 0}/40 | Exploit Availability: ${bd.exploitScore || 0}/30 | Internet Exposure: ${bd.exposureScore || 0}/30`);
    if (report.riskBreakdown.explanation) {
      doc.moveDown(0.3);
      doc.fontSize(8).text(report.riskBreakdown.explanation);
    }
  }

  // Footer text
  doc.fontSize(8).fillColor(C.textLight).text('Generated by PAIA — Penetration Testing AI Agent', 50, doc.page.height - 50);
  doc.text('This report is confidential and intended for authorized personnel only.', 50, doc.page.height - 38);


  // ═══════════════════════════════════════════
  //   TABLE OF CONTENTS
  // ═══════════════════════════════════════════
  doc.addPage();
  doc.rect(0, 0, doc.page.width, 50).fill(C.primary);
  doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold').text('Table of Contents', 50, 18);

  const tocItems = [
    { num: '1', title: 'Executive Summary', page: '3' },
    { num: '2', title: 'Risk Assessment', page: '3' },
    { num: '3', title: 'Detailed Findings', page: '4' },
    { num: '4', title: 'MITRE ATT&CK Analysis', page: '-' },
    { num: '5', title: 'Recommendations', page: '-' },
    { num: '6', title: 'Methodology', page: '-' },
  ];

  let tocY = 90;
  tocItems.forEach(item => {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(C.primary).text(item.num + '.', 60, tocY, { width: 25 });
    doc.font('Helvetica').fillColor(C.text).text(item.title, 90, tocY);
    tocY += 28;
  });


  // ═══════════════════════════════════════════
  //   EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════
  doc.addPage();
  doc.rect(0, 0, doc.page.width, 50).fill(C.primary);
  doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold').text('1. Executive Summary', 50, 18);

  doc.moveDown(3);
  doc.fillColor(C.text).fontSize(11).font('Helvetica');
  const summary = report.executiveSummary || 'No executive summary available.';
  doc.text(summary, 50, doc.y, { width: pageWidth, lineGap: 3 });

  // Risk Assessment section
  doc.moveDown(2);
  doc.fillColor(C.primary).fontSize(16).font('Helvetica-Bold').text('2. Risk Assessment');
  doc.moveDown(0.8);
  doc.fillColor(C.text).fontSize(10).font('Helvetica');
  doc.text(`Overall Risk Score: ${riskScore}/100 (${riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : riskScore >= 15 ? 'LOW' : 'INFORMATIONAL'})`);
  doc.text(`Total Vulnerabilities: ${(report.findings || []).length}`);
  if (sc.critical) doc.text(`Critical Findings: ${sc.critical}`);
  if (sc.high) doc.text(`High Findings: ${sc.high}`);
  if (sc.medium) doc.text(`Medium Findings: ${sc.medium}`);
  if (sc.low) doc.text(`Low Findings: ${sc.low}`);


  // ═══════════════════════════════════════════
  //   DETAILED FINDINGS
  // ═══════════════════════════════════════════
  doc.addPage();
  doc.rect(0, 0, doc.page.width, 50).fill(C.primary);
  doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold').text('3. Detailed Findings', 50, 18);

  doc.moveDown(3);

  if (report.findings && report.findings.length > 0) {
    const findingsPrint = report.findings.slice(0, 12);
    findingsPrint.forEach((v, i) => {
      if (doc.y > 680) doc.addPage();

      const sc2 = sevColor(v.severity);

      // Finding header with severity badge
      doc.rect(50, doc.y, pageWidth, 24).fill(sc2 + '15');
      doc.rect(50, doc.y, 4, 24).fill(sc2);

      doc.fillColor(sc2).fontSize(11).font('Helvetica-Bold');
      doc.text(`${i + 1}. ${v.title}`, 62, doc.y + 6, { width: pageWidth - 120 });

      // Severity + CVSS badge
      const badgeX = doc.page.width - 130;
      doc.rect(badgeX, doc.y - 18, 50, 16).fill(sc2);
      doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold').text((v.severity || 'INFO').toUpperCase(), badgeX + 2, doc.y - 15, { width: 46, align: 'center' });

      if (v.cvss > 0) {
        doc.rect(badgeX + 54, doc.y - 18, 36, 16).fill(C.bgLight);
        doc.fillColor(C.white).fontSize(7).text(`${v.cvss}`, badgeX + 54, doc.y - 15, { width: 36, align: 'center' });
      }

      doc.moveDown(1.5);

      // CVE ID
      if (v.cveId) {
        doc.fillColor(C.primary).fontSize(9).font('Helvetica-Bold').text(`CVE: ${v.cveId}`, 62);
        doc.moveDown(0.3);
      }

      // Exploit warning
      if (v.exploitAvailable) {
        doc.fillColor(C.critical).fontSize(9).font('Helvetica-Bold').text('⚠ PUBLIC EXPLOIT AVAILABLE — Immediate action required', 62);
        doc.moveDown(0.3);
      }

      // Description
      doc.fillColor(C.text).fontSize(9).font('Helvetica-Bold').text('Description:', 62);
      doc.font('Helvetica').fillColor(C.textSub).text(v.description || 'N/A', 62, doc.y, { width: pageWidth - 24 });
      doc.moveDown(0.5);

      // Evidence
      if (v.evidence) {
        doc.fillColor(C.text).fontSize(9).font('Helvetica-Bold').text('Evidence:', 62);
        doc.font('Helvetica').fillColor(C.textSub).text(v.evidence, 62, doc.y, { width: pageWidth - 24 });
        doc.moveDown(0.5);
      }

      // Remediation
      doc.fillColor(C.green).fontSize(9).font('Helvetica-Bold').text('Remediation:', 62);
      doc.font('Helvetica').fillColor(C.textSub).text(v.remediation || 'Review and patch', 62, doc.y, { width: pageWidth - 24 });
      doc.moveDown(0.5);

      // MITRE ATT&CK
      if (v.mitreMapping && v.mitreMapping.length > 0) {
        doc.fillColor(C.primary).fontSize(8).font('Helvetica-Bold').text('MITRE ATT&CK:', 62);
        v.mitreMapping.forEach(m => {
          doc.font('Helvetica').fillColor(C.textSub).fontSize(8);
          doc.text(`  → ${m.tacticName || '?'} (${m.tacticId || '?'}) / ${m.techniqueName || '?'} (${m.techniqueId || '?'})`, 62);
        });
        doc.moveDown(0.3);
      }

      // Tool
      if (v.tool) {
        doc.fillColor(C.textLight).fontSize(8).font('Helvetica').text(`Found by: ${v.tool}`, 62);
      }

      doc.moveDown(1.2);

      // Separator
      doc.rect(50, doc.y, pageWidth, 0.5).fill(C.border);
      doc.moveDown(0.8);
    });
    
    if (report.findings.length > 12) {
      doc.moveDown(1);
      doc.fillColor(C.primary).fontSize(10).font('Helvetica-Oblique').text(`...and ${report.findings.length - 12} additional findings. View the full list on the PAIA Dashboard.`, 50, doc.y, { align: 'center' });
    }
  } else {
    doc.fillColor(C.textSub).fontSize(11).font('Helvetica').text('No vulnerabilities were identified during this scan.');
  }


  // ═══════════════════════════════════════════
  //   MITRE ATT&CK ANALYSIS
  // ═══════════════════════════════════════════
  if (report.mitreAttackSummary || (report.mitreAttackMapping && report.mitreAttackMapping.chain)) {
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 50).fill(C.primary);
    doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold').text('4. MITRE ATT&CK Analysis', 50, 18);

    doc.moveDown(3);

    // Kill Chain visualization
    if (report.mitreAttackMapping && report.mitreAttackMapping.chain && report.mitreAttackMapping.chain.length > 0) {
      doc.fillColor(C.text).fontSize(12).font('Helvetica-Bold').text('Kill Chain Coverage');
      doc.moveDown(0.5);

      report.mitreAttackMapping.chain.forEach((tactic, idx) => {
        if (doc.y > 700) doc.addPage();

        // Tactic box
        doc.rect(60, doc.y, pageWidth - 20, 20).fill(C.primary + '15');
        doc.rect(60, doc.y, 3, 20).fill(C.primary);
        doc.fillColor(C.primary).fontSize(9).font('Helvetica-Bold');
        doc.text(`${tactic.name} [${tactic.id}]`, 72, doc.y + 5);
        doc.moveDown(1.2);

        // Techniques under this tactic
        if (tactic.techniques) {
          tactic.techniques.forEach(tech => {
            doc.fillColor(C.textSub).fontSize(8).font('Helvetica');
            doc.text(`  → ${tech.name} (${tech.id})`, 80);
          });
        }
        doc.moveDown(0.5);

        // Arrow connector
        if (idx < report.mitreAttackMapping.chain.length - 1) {
          doc.fillColor(C.textLight).fontSize(10).text('  ↓', 120);
          doc.moveDown(0.3);
        }
      });

      doc.moveDown(1);
      doc.fillColor(C.text).fontSize(9).font('Helvetica-Bold');
      doc.text(`Coverage: ${report.mitreAttackMapping.coveragePercent || 0}% of MITRE ATT&CK tactics`);
    }

    // Attack narrative
    if (report.mitreAttackSummary) {
      doc.moveDown(1.5);
      doc.fillColor(C.text).fontSize(12).font('Helvetica-Bold').text('Attack Narrative');
      doc.moveDown(0.5);
      doc.fillColor(C.textSub).fontSize(9).font('Helvetica');
      doc.text(report.mitreAttackSummary, 50, doc.y, { width: pageWidth });
    }
  }


  // ═══════════════════════════════════════════
  //   RECOMMENDATIONS
  // ═══════════════════════════════════════════
  if (report.recommendations && report.recommendations.length > 0) {
    if (doc.y > 600) doc.addPage();

    doc.addPage();
    doc.rect(0, 0, doc.page.width, 50).fill(C.primary);
    doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold').text('5. Recommendations', 50, 18);

    doc.moveDown(3);
    doc.fillColor(C.text).fontSize(11).font('Helvetica');

    report.recommendations.forEach((rec, i) => {
      if (doc.y > 700) doc.addPage();

      // Priority number badge
      const priorityColor = i < 2 ? C.critical : i < 4 ? C.high : C.medium;
      doc.circle(64, doc.y + 6, 8).fill(priorityColor);
      doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold').text(String(i + 1), 58, doc.y + 2, { width: 12, align: 'center' });

      doc.fillColor(C.text).fontSize(10).font('Helvetica').text(rec, 82, doc.y - 4, { width: pageWidth - 40 });
      doc.moveDown(1);
    });
  }


  // ═══════════════════════════════════════════
  //   METHODOLOGY
  // ═══════════════════════════════════════════
  if (doc.y > 550) doc.addPage();

  doc.moveDown(2);
  doc.fillColor(C.primary).fontSize(14).font('Helvetica-Bold').text('6. Methodology');
  doc.moveDown(0.8);
  doc.fillColor(C.text).fontSize(10).font('Helvetica');
  doc.text(report.methodology || 'Automated AI-driven penetration testing', 50, doc.y, { width: pageWidth });

  doc.moveDown(1);
  doc.text('Tools Used: Shodan, VirusTotal, WHOIS, AbuseIPDB, OTX, Censys, Nmap, Nikto, NVD, Vulners, Google Gemini AI');
  doc.moveDown(0.5);
  doc.text('Frameworks: OWASP Testing Guide, PTES, MITRE ATT&CK, CVSS v3.1');


  // ═══════════════════════════════════════════
  //   FOOTER ON EVERY PAGE
  // ═══════════════════════════════════════════
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    // Bottom line
    doc.rect(50, doc.page.height - 55, pageWidth, 0.5).fill(C.border);

    // Page number
    doc.fillColor(C.textLight).fontSize(8).font('Helvetica');
    doc.text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 42, { width: pageWidth, align: 'center' });

    // Confidential marking
    doc.text('CONFIDENTIAL — PAIA Security Platform', 50, doc.page.height - 30, { width: pageWidth, align: 'center' });
  }

  doc.end();
};

module.exports = { createReportFromSession, generatePDF };
