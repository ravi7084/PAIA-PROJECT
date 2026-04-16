/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Recon Routes (New Module)           ║
 * ║   Subdomain Discovery & DNS Analysis         ║
 * ╚══════════════════════════════════════════════╝
 */

const express = require('express');
const router = express.Router();
const reconController = require('../controllers/reconController');
const { protect } = require('../models/middleware/auth.middleware');

// POST /api/recon
// Description: Perform subdomain enumeration and DNS record analysis
router.post('/', protect, reconController.performRecon);

// GET /api/recon/subdomain/recent
// Description: Fetch historical subdomain/DNS results
router.get('/subdomain/recent', protect, reconController.getRecentReconResults);

module.exports = router;
