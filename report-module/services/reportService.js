const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const PDFDocument = require('pdfkit');

/**
 * Service to generate reports in multiple formats.
 */
class ReportService {
  /**
   * Generates an HTML report string using EJS.
   */
  async generateHTML(reportData) {
    const templatePath = path.join(__dirname, '../templates/reportTemplate.html');
    return await ejs.renderFile(templatePath, { data: reportData });
  }

  /**
   * Generates a professional PDF report.
   */
  async generatePDF(reportData, outputPath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // --- Header ---
      doc.fontSize(25).text('Security Assessment Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Report ID: ${reportData.reportId}`, { align: 'center' });
      doc.text(`Generated: ${new Date(reportData.timestamp).toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // --- Executive Summary ---
      doc.fontSize(18).text('1. Executive Summary', { underline: true });
      doc.fontSize(12).moveDown();
      doc.text(`Target Asset: ${reportData.target}`);
      doc.text(`Risk Posture: ${reportData.summary.overallRisk}`);
      doc.moveDown();
      doc.text(`Total Vulnerabilities: ${reportData.summary.total}`);
      doc.text(`- Critical: ${reportData.summary.critical}`, { indent: 20 });
      doc.text(`- High: ${reportData.summary.high}`, { indent: 20 });
      doc.text(`- Medium: ${reportData.summary.medium}`, { indent: 20 });
      doc.text(`- Low: ${reportData.summary.low}`, { indent: 20 });
      doc.moveDown(2);

      // --- Findings ---
      doc.fontSize(18).text('2. Vulnerability Findings', { underline: true });
      doc.moveDown();

      reportData.vulnerabilities.forEach((vuln, index) => {
        doc.fontSize(14).fillColor(vuln.severityColor).text(`${index + 1}. ${vuln.cveId} - ${vuln.title}`);
        doc.fillColor('black').fontSize(10);
        doc.text(`Severity: ${vuln.severity} | CVSS: ${vuln.cvssScore}`);
        doc.text(`Priority: ${vuln.priority}`);
        doc.moveDown(0.5);
        doc.text('Description:', { bold: true });
        doc.text(vuln.description);
        doc.moveDown(0.5);
        doc.text('Impact:');
        doc.text(vuln.impact);
        doc.moveDown(0.5);
        doc.text('Recommendation:');
        doc.text(vuln.recommendation);
        doc.moveDown(1.5);
      });

      // --- Logs ---
      doc.addPage();
      doc.fontSize(18).text('3. Technical Logs', { underline: true });
      doc.moveDown();
      doc.fontSize(8).font('Courier').text(reportData.rawLogs);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }
}

module.exports = new ReportService();
