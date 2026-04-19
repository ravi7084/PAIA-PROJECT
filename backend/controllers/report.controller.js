/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Report Controller                   ║
 * ╚══════════════════════════════════════════════╝
 */

const Report = require('../models/report.model');
const { createReportFromSession, generatePDF } = require('../services/report.service');

const generateReport = async (req, res, next) => {
  try {
    const { scanSessionId } = req.body;
    if (!scanSessionId) return res.status(400).json({ success: false, message: 'scanSessionId is required' });

    const report = await createReportFromSession(scanSessionId, req.user.id);
    res.status(201).json({ success: true, data: { report } });
  } catch (err) { next(err); }
};

const listReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ user_id: req.user.id })
      .select('target title riskScore severityCounts format generatedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(30);
    res.json({ success: true, data: { reports, count: reports.length } });
  } catch (err) { next(err); }
};

const getReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: { report } });
  } catch (err) { next(err); }
};

const deleteReport = async (req, res, next) => {
  try {
    const deleted = await Report.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) { next(err); }
};

const downloadReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    
    // Call the generatePDF service which handles the response stream
    generatePDF(report, res);
  } catch (err) { next(err); }
};

module.exports = { generateReport, listReports, getReport, deleteReport, downloadReport };
