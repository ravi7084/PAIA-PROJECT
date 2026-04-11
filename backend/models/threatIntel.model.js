/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Threat Intel Cache Model            ║
 * ║   Caches external API results to avoid       ║
 * ║   duplicate calls & respect rate-limits      ║
 * ╚══════════════════════════════════════════════╝
 */

const mongoose = require('mongoose');

const threatIntelSchema = new mongoose.Schema(
  {
    target: { type: String, required: true, trim: true, index: true },
    provider: {
      type: String,
      required: true,
      enum: ['shodan', 'censys', 'whois', 'virustotal', 'abuseipdb', 'hunter', 'otx'],
    },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    queriedAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h cache
    },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

threatIntelSchema.index({ target: 1, provider: 1 });
threatIntelSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-delete

module.exports = mongoose.model('ThreatIntel', threatIntelSchema);
