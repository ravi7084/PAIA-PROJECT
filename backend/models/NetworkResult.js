/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Network Result Model                ║
 * ║   Stores Nmap scan outputs per domain        ║
 * ╚══════════════════════════════════════════════╝
 */

const mongoose = require('mongoose');

const networkResultSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    index: true,
  },
  rawOutput: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster lookups by domain and recency
networkResultSchema.index({ domain: 1, timestamp: -1 });

module.exports = mongoose.model('NetworkResult', networkResultSchema);
