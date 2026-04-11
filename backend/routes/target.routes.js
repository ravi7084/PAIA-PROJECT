/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Target Routes                       ║
 * ║   Phase 2 — YE FILE ZIP MEIN NAHI THI        ║
 * ║   Seedha backend/routes/ mein rakh do        ║
 * ╚══════════════════════════════════════════════╝
 *
 * IMPORTANT: /bulk route /:id se PEHLE honi chahiye.
 * Agar /:id pehle ho toh Express "bulk" ko ek ID
 * samjh leta hai aur findById("bulk") crash karta hai.
 */

const router = require('express').Router();
const ctrl = require('../controllers/target.controller');
const { protect } = require('../models/middleware/auth.middleware');

// Sabhi routes ke liye JWT auth required
router.use(protect);

// ── Core CRUD ──────────────────────────────────
router.get('/', ctrl.getTargets); // GET    /api/targets
router.post('/', ctrl.createTarget); // POST   /api/targets

// ── Bulk import — /bulk MUST be before /:id ──
router.post('/bulk', ctrl.bulkCreate); // POST   /api/targets/bulk

// ── Single target ──────────────────────────────
router.get('/:id', ctrl.getTarget); // GET    /api/targets/:id
router.put('/:id', ctrl.updateTarget); // PUT    /api/targets/:id
router.delete('/:id', ctrl.deleteTarget); // DELETE /api/targets/:id

// ── Nested routes ──────────────────────────────
router.get('/:id/scans', ctrl.getTargetScans); // GET    /api/targets/:id/scans
router.post('/:id/notes', ctrl.addNote); // POST   /api/targets/:id/notes
router.delete('/:id/notes/:noteId', ctrl.deleteNote); // DELETE /api/targets/:id/notes/:noteId
router.patch('/:id/risk', ctrl.updateRiskScore); // PATCH  /api/targets/:id/risk

module.exports = router;
