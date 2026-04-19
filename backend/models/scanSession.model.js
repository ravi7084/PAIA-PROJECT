/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Scan Session Model                  ║
 * ║   Full AI-driven scan lifecycle record       ║
 * ║   + Progress tracking fields                 ║
 * ╚══════════════════════════════════════════════╝
 */

const mongoose = require('mongoose');

const phaseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['recon', 'subdomain', 'network', 'webapp', 'api_security', 'exploit', 'report'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'skipped'],
      default: 'queued',
    },
    tools: { type: [String], default: [] },
    results: { type: mongoose.Schema.Types.Mixed, default: {} },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { _id: false }
);

const aiDecisionSchema = new mongoose.Schema(
  {
    iteration: { type: Number, required: true },
    promptSummary: { type: String, default: '' },
    response: { type: mongoose.Schema.Types.Mixed, default: {} },
    reasoning: { type: String, default: '' },
    action: { type: String, default: '' },
    riskLevel: { type: String, enum: ['info', 'low', 'medium', 'high', 'critical'], default: 'info' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const vulnerabilitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: { type: String, default: 'unknown' },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
      default: 'info',
    },
    cvss: { type: Number, min: 0, max: 10, default: 0 },
    description: { type: String, default: '' },
    evidence: { type: String, default: '' },
    remediation: { type: String, default: '' },
    cveId: { type: String, default: '' },
    tool: { type: String, default: '' },
    // MITRE ATT&CK mapping
    mitreMapping: { type: [{ tacticId: String, tacticName: String, techniqueId: String, techniqueName: String, phase: String }], default: [] },
    // NVD enrichment data
    nvdData: { type: mongoose.Schema.Types.Mixed, default: null },
    // Exploit availability (from Vulners)
    exploitAvailable: { type: Boolean, default: false },
    exploitData: { type: mongoose.Schema.Types.Mixed, default: null },
    // Related CVEs from NVD keyword search
    relatedCVEs: { type: [{ cveId: String, cvssScore: Number, severity: String, description: String }], default: [] },
  },
  { _id: true }
);

const scanSessionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Target', default: null },
    target: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'partial', 'failed', 'stopped'],
      default: 'queued',
    },
    scope: {
      type: String,
      enum: ['full', 'recon-only', 'web', 'network'],
      default: 'full',
    },
    phases: { type: [phaseSchema], default: [] },
    aiDecisions: { type: [aiDecisionSchema], default: [] },
    vulnerabilities: { type: [vulnerabilitySchema], default: [] },
    threatIntelResults: { type: mongoose.Schema.Types.Mixed, default: {} },
    report: {
      executiveSummary: { type: String, default: '' },
      technicalDetails: { type: String, default: '' },
      riskScore: { type: Number, min: 0, max: 100, default: 0 },
      recommendations: { type: [String], default: [] },
      generatedAt: { type: Date, default: null },
      mitreAttackSummary: { type: String, default: '' },
      mitreAttackMapping: { type: mongoose.Schema.Types.Mixed, default: null },
      riskBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    currentIteration: { type: Number, default: 0 },
    maxIterations: { type: Number, default: 10 },

    // ── Progress tracking (NEW) ──────────────────
    currentPhase: { type: String, default: 'initializing' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    currentMessage: { type: String, default: 'Initializing...' },

    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

scanSessionSchema.index({ user_id: 1, createdAt: -1 });
scanSessionSchema.index({ target: 1, createdAt: -1 });
scanSessionSchema.index({ status: 1 });

module.exports = mongoose.model('ScanSession', scanSessionSchema);
