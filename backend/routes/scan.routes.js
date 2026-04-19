const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scan.controller');

// POST /api/orchestration/start
router.post('/start-scan', scanController.startScan);

// GET /api/orchestration/scan/:id
router.get('/scan/:id', scanController.getScanById);

// GET /api/orchestration/scans
router.get('/scans', scanController.getAllScans);

// DELETE /api/orchestration/scan/:id
router.delete('/scan/:id', scanController.deleteScan);

module.exports = router;
