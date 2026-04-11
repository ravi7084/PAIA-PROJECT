const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { protect } = require('../models/middleware/auth.middleware');

router.use(protect);

router.post('/generate', ctrl.generateReport);   // POST /api/reports/generate
router.get('/', ctrl.listReports);                // GET  /api/reports
router.get('/:id', ctrl.getReport);               // GET  /api/reports/:id
router.delete('/:id', ctrl.deleteReport);          // DELETE /api/reports/:id

module.exports = router;
