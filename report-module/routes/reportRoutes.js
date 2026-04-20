const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

/**
 * ╔══════════════════════════════════════════════╗
 * ║   REPORT GENERATION ROUTES                   ║
 * ╚══════════════════════════════════════════════╝
 */

// Generate Full Report: POST /api/report/generate
router.post('/generate', reportController.generateReport);

// Download PDF Report: GET /api/report/download/:id
router.get('/download/:id', reportController.downloadReport);

module.exports = router;
