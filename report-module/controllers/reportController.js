const path = require('path');
const fs = require('fs');
const aggregationService = require('../services/aggregationService');
const reportService = require('../services/reportService');
const { v4: uuidv4 } = require('uuid');

/**
 * Controller for managing report generation and retrieval.
 */
class ReportController {
  /**
   * Generates a complete report in JSON, HTML, and PDF.
   */
  async generateReport(req, res, next) {
    try {
      const inputData = req.body;
      
      // 1. Aggregate Data
      const aggregatedData = await aggregationService.aggregate(inputData);
      
      // 2. Generate HTML (for dashboard view)
      const htmlReport = await reportService.generateHTML(aggregatedData);
      
      // 3. Generate PDF (for download)
      const reportId = aggregatedData.reportId;
      const reportsDir = path.join(__dirname, '../reports');
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);
      
      const pdfPath = path.join(reportsDir, `${reportId}.pdf`);
      await reportService.generatePDF(aggregatedData, pdfPath);
      
      // 4. Send Response
      res.status(200).json({
        status: 'success',
        message: 'Report generated successfully',
        reportId: reportId,
        downloadUrl: `/api/report/download/${reportId}`,
        summary: aggregatedData.summary,
        htmlView: htmlReport,
        jsonResults: aggregatedData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Downloads a previously generated PDF report.
   */
  async downloadReport(req, res, next) {
    try {
      const { id } = req.params;
      const pdfPath = path.join(__dirname, `../reports/${id}.pdf`);
      
      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ status: 'error', message: 'Report not found' });
      }
      
      res.download(pdfPath, `Security_Report_${id}.pdf`);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportController();
