const router = require('express').Router();
const ctrl = require('../controllers/aiAgent.controller');
const { protect } = require('../models/middleware/auth.middleware');

router.use(protect);

router.post('/run', ctrl.startAIScan);         // POST /api/ai-agent/run
router.post('/quick-scan', ctrl.quickScan);    // POST /api/ai-agent/quick-scan
router.post('/explain', ctrl.explainScan);     // POST /api/ai-agent/explain
router.get('/status/:id', ctrl.getStatus);     // GET  /api/ai-agent/status/:id
router.post('/stop/:id', ctrl.stopScan);       // POST /api/ai-agent/stop/:id
router.get('/history', ctrl.getHistory);       // GET  /api/ai-agent/history
router.delete('/:id', ctrl.deleteScan);        // DELETE /api/ai-agent/:id

module.exports = router;
