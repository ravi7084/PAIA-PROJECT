const router = require('express').Router();
const ctrl = require('../controllers/recon.controller');
const { protect } = require('../models/middleware/auth.middleware');

router.use(protect);

router.post('/run', ctrl.startRecon);   // POST /api/recon/run
router.get('/', ctrl.listReconScans);   // GET  /api/recon
router.get('/:id', ctrl.getReconScan);  // GET  /api/recon/:id
router.delete('/:id', ctrl.deleteReconScan); // DELETE /api/recon/:id

module.exports = router;
