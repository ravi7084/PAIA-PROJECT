const router = require('express').Router();
const ctrl = require('../controllers/threatIntel.controller');
const { protect } = require('../models/middleware/auth.middleware');

router.use(protect);

router.get('/all/:target', ctrl.lookupAll);
router.get('/shodan/:target', ctrl.lookupShodan);
router.get('/virustotal/:target', ctrl.lookupVirusTotal);
router.get('/whois/:target', ctrl.lookupWhois);
router.get('/abuseipdb/:ip', ctrl.lookupAbuseIPDB);
router.get('/hunter/:domain', ctrl.lookupHunter);
router.get('/otx/:target', ctrl.lookupOTX);
router.get('/censys/:target', ctrl.lookupCensys);

module.exports = router;
