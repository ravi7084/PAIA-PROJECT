/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Web Scan Routes                     ║
 * ║   Endpoints for Web Vulnerability Module     ║
 * ╚══════════════════════════════════════════════╝
 */

const express = require('express');
const router = express.Router();
const webScanController = require('../controllers/webScanController');

router.post('/web', webScanController.performWebScan);
router.get('/web/recent', webScanController.getRecentWebScans);

module.exports = router;
