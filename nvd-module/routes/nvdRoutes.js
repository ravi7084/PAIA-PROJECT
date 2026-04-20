const express = require('express');
const router = express.Router();
const nvdController = require('../controllers/nvdController');

/**
 * ╔══════════════════════════════════════════════╗
 * ║   NVD INTELLIGENCE ROUTES                    ║
 * ╚══════════════════════════════════════════════╝
 */

// Direct CVE Lookup: GET /api/nvd/CVE-XXXX-XXXX
router.get('/:cveId', nvdController.getCVE);

// Scanner Output Parsing: POST /api/nvd/scan
router.post('/scan', nvdController.processScan);

// Bulk CVE Lookup: POST /api/nvd/bulk
router.post('/bulk', nvdController.bulkLookup);

module.exports = router;
