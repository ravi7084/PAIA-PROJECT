/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Recon Result Model                  ║
 * ║   Stores Subdomain and DNS Analysis          ║
 * ╚══════════════════════════════════════════════╝
 */

const mongoose = require('mongoose');

const reconResultSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    index: true,
  },
  subdomain: {
    type: String,
    required: true,
  },
  A: {
    type: [String],
    default: [],
  },
  MX: {
    type: [String],
    default: [],
  },
  TXT: {
    type: [String],
    default: [],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster lookups by domain
reconResultSchema.index({ domain: 1, timestamp: -1 });

module.exports = mongoose.model('ReconResult', reconResultSchema);
