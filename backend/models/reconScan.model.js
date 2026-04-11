const mongoose = require('mongoose');

const toolResultSchema = new mongoose.Schema(
  {
    tool: { type: String, required: true },
    status: { type: String, enum: ['success', 'failed', 'skipped'], required: true },
    command: { type: String, default: '' },
    exitCode: { type: Number, default: null },
    durationMs: { type: Number, default: 0 },
    reason: { type: String, default: '' },
    stdout: { type: String, default: '' },
    stderr: { type: String, default: '' },
    indicators: {
      domains: { type: [String], default: [] },
      subdomains: { type: [String], default: [] },
      emails: { type: [String], default: [] },
      ips: { type: [String], default: [] },
      openPorts: { type: [Number], default: [] },
      services: { type: [String], default: [] },
      vulnerabilities: { type: [String], default: [] },
      urls: { type: [String], default: [] },
      owaspTop10: { type: [String], default: [] },
      dnsRecords: {
        ns: { type: [String], default: [] },
        mx: { type: [String], default: [] },
        txt: { type: [String], default: [] },
        cname: { type: [String], default: [] },
        a: { type: [String], default: [] }
      }
    }
  },
  { _id: false }
);

const findingSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['domain', 'subdomain', 'email', 'ip', 'dns_record', 'port', 'service', 'vulnerability', 'web_vulnerability', 'url', 'signal'], required: true },
    value: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    confidence: { type: Number, min: 0, max: 1, default: 0.6 }
  },
  { _id: false }
);

const reconScanSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: String, required: true, trim: true },
    phase: { type: String, enum: ['recon', 'subdomain', 'network', 'webapp'], default: 'recon' },
    mode: { type: String, enum: ['passive', 'active', 'mixed'], default: 'passive' },
    status: { type: String, enum: ['queued', 'running', 'completed', 'partial', 'failed'], default: 'queued' },
    toolsRequested: { type: [String], default: [] },
    toolsRun: { type: [String], default: [] },
    toolResults: { type: [toolResultSchema], default: [] },
    summary: {
      domains: { type: [String], default: [] },
      subdomains: { type: [String], default: [] },
      emails: { type: [String], default: [] },
      ips: { type: [String], default: [] },
      network: {
        openPorts: { type: [Number], default: [] },
        services: { type: [String], default: [] },
        vulnerabilities: { type: [String], default: [] }
      },
      webapp: {
        urls: { type: [String], default: [] },
        vulnerabilities: { type: [String], default: [] },
        owaspTop10: { type: [String], default: [] }
      },
      dnsRecords: {
        ns: { type: [String], default: [] },
        mx: { type: [String], default: [] },
        txt: { type: [String], default: [] },
        cname: { type: [String], default: [] },
        a: { type: [String], default: [] }
      }
    },
    findings: { type: [findingSchema], default: [] },
    verdict: {
      level: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
      score: { type: Number, min: 0, max: 100, default: 0 },
      hasFindings: { type: Boolean, default: false },
      label: { type: String, default: 'No actionable findings' }
    },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

reconScanSchema.index({ user_id: 1, createdAt: -1 });
reconScanSchema.index({ target: 1, createdAt: -1 });

module.exports = mongoose.model('ReconScan', reconScanSchema);
