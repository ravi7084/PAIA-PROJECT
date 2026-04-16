/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Web Scan Result Model               ║
 * ║   Stores Nikto and ZAP Analysis Results      ║
 * ╚══════════════════════════════════════════════╝
 */

const mongoose = require('mongoose');

const webScanResultSchema = new mongoose.Schema({
  target: {
    type: String,
    required: true,
    index: true,
  },
  niktoOutput: {
    type: String,
    default: '',
  },
  zapAlerts: {
    type: [Object],
    default: [],
  },
  status: {
    type: String,
    enum: ['completed', 'failed', 'running'],
    default: 'completed',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster lookups by target and recency
webScanResultSchema.index({ target: 1, timestamp: -1 });

module.exports = mongoose.model('WebScanResult', webScanResultSchema);
