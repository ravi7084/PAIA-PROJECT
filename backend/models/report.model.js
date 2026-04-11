/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Report Model                        ║
 * ║   Generated penetration test reports         ║
 * ╚══════════════════════════════════════════════╝
 */

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scanSession_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ScanSession', required: true },
    target: { type: String, required: true, trim: true },
    title: { type: String, default: 'Penetration Test Report' },
    format: { type: String, enum: ['json', 'html', 'pdf'], default: 'json' },

    executiveSummary: { type: String, default: '' },
    scope: { type: String, default: '' },
    methodology: { type: String, default: '' },

    findings: [
      {
        title: String,
        severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'] },
        cvss: Number,
        description: String,
        evidence: String,
        remediation: String,
        cveId: String,
        tool: String,
      },
    ],

    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    severityCounts: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      info: { type: Number, default: 0 },
    },

    recommendations: { type: [String], default: [] },
    conclusion: { type: String, default: '' },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

reportSchema.index({ user_id: 1, createdAt: -1 });
reportSchema.index({ scanSession_id: 1 });

module.exports = mongoose.model('Report', reportSchema);
