/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Network Routes                      ║
 * ║   API endpoints for Network Scanning Module   ║
 * ╚══════════════════════════════════════════════╝
 */

const express = require('express');
const router = express.Router();
const networkController = require('../controllers/networkController');

// All network scan routes
router.post('/network', networkController.performNetworkScan);
router.get('/network/recent', networkController.getRecentNetworkResults);

module.exports = router;
