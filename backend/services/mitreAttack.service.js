/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — MITRE ATT&CK Mapping Service       ║
 * ║   Maps vulnerabilities to ATT&CK framework  ║
 * ║   Generates kill chain analysis              ║
 * ╚══════════════════════════════════════════════╝
 */

const logger = require('../utils/logger');

/* ── MITRE ATT&CK Tactics ─────────────────────── */
const TACTICS = {
  TA0043: { id: 'TA0043', name: 'Reconnaissance', phase: 'pre-attack' },
  TA0001: { id: 'TA0001', name: 'Initial Access', phase: 'attack' },
  TA0002: { id: 'TA0002', name: 'Execution', phase: 'attack' },
  TA0003: { id: 'TA0003', name: 'Persistence', phase: 'attack' },
  TA0004: { id: 'TA0004', name: 'Privilege Escalation', phase: 'attack' },
  TA0005: { id: 'TA0005', name: 'Defense Evasion', phase: 'attack' },
  TA0006: { id: 'TA0006', name: 'Credential Access', phase: 'attack' },
  TA0007: { id: 'TA0007', name: 'Discovery', phase: 'attack' },
  TA0008: { id: 'TA0008', name: 'Lateral Movement', phase: 'attack' },
  TA0009: { id: 'TA0009', name: 'Collection', phase: 'post-exploit' },
  TA0011: { id: 'TA0011', name: 'Command and Control', phase: 'post-exploit' },
  TA0010: { id: 'TA0010', name: 'Exfiltration', phase: 'post-exploit' },
  TA0040: { id: 'TA0040', name: 'Impact', phase: 'post-exploit' },
};

/* ── Technique → Tactic Mapping (common pen-test findings) ── */
const TECHNIQUE_MAP = {
  // Initial Access
  'T1190': { id: 'T1190', name: 'Exploit Public-Facing Application', tacticId: 'TA0001' },
  'T1133': { id: 'T1133', name: 'External Remote Services', tacticId: 'TA0001' },
  'T1078': { id: 'T1078', name: 'Valid Accounts', tacticId: 'TA0001' },
  'T1566': { id: 'T1566', name: 'Phishing', tacticId: 'TA0001' },
  'T1189': { id: 'T1189', name: 'Drive-by Compromise', tacticId: 'TA0001' },

  // Execution
  'T1059': { id: 'T1059', name: 'Command and Scripting Interpreter', tacticId: 'TA0002' },
  'T1203': { id: 'T1203', name: 'Exploitation for Client Execution', tacticId: 'TA0002' },
  'T1059.004': { id: 'T1059.004', name: 'Unix Shell', tacticId: 'TA0002' },

  // Persistence
  'T1505.003': { id: 'T1505.003', name: 'Web Shell', tacticId: 'TA0003' },
  'T1136': { id: 'T1136', name: 'Create Account', tacticId: 'TA0003' },
  'T1098': { id: 'T1098', name: 'Account Manipulation', tacticId: 'TA0003' },

  // Privilege Escalation
  'T1068': { id: 'T1068', name: 'Exploitation for Privilege Escalation', tacticId: 'TA0004' },
  'T1548': { id: 'T1548', name: 'Abuse Elevation Control Mechanism', tacticId: 'TA0004' },

  // Defense Evasion
  'T1070': { id: 'T1070', name: 'Indicator Removal', tacticId: 'TA0005' },
  'T1027': { id: 'T1027', name: 'Obfuscated Files or Information', tacticId: 'TA0005' },

  // Credential Access
  'T1110': { id: 'T1110', name: 'Brute Force', tacticId: 'TA0006' },
  'T1003': { id: 'T1003', name: 'OS Credential Dumping', tacticId: 'TA0006' },
  'T1552': { id: 'T1552', name: 'Unsecured Credentials', tacticId: 'TA0006' },
  'T1557': { id: 'T1557', name: 'Adversary-in-the-Middle', tacticId: 'TA0006' },
  'T1539': { id: 'T1539', name: 'Steal Web Session Cookie', tacticId: 'TA0006' },

  // Discovery
  'T1046': { id: 'T1046', name: 'Network Service Discovery', tacticId: 'TA0007' },
  'T1082': { id: 'T1082', name: 'System Information Discovery', tacticId: 'TA0007' },
  'T1018': { id: 'T1018', name: 'Remote System Discovery', tacticId: 'TA0007' },

  // Lateral Movement
  'T1021': { id: 'T1021', name: 'Remote Services', tacticId: 'TA0008' },
  'T1210': { id: 'T1210', name: 'Exploitation of Remote Services', tacticId: 'TA0008' },

  // Collection
  'T1005': { id: 'T1005', name: 'Data from Local System', tacticId: 'TA0009' },
  'T1213': { id: 'T1213', name: 'Data from Information Repositories', tacticId: 'TA0009' },

  // C2
  'T1071': { id: 'T1071', name: 'Application Layer Protocol', tacticId: 'TA0011' },
  'T1573': { id: 'T1573', name: 'Encrypted Channel', tacticId: 'TA0011' },

  // Exfiltration
  'T1041': { id: 'T1041', name: 'Exfiltration Over C2 Channel', tacticId: 'TA0010' },

  // Impact
  'T1499': { id: 'T1499', name: 'Endpoint Denial of Service', tacticId: 'TA0040' },
  'T1490': { id: 'T1490', name: 'Inhibit System Recovery', tacticId: 'TA0040' },
  'T1565': { id: 'T1565', name: 'Data Manipulation', tacticId: 'TA0040' },
};

/* ── Vulnerability Type → Technique Rules ─────── */
const VULN_TYPE_RULES = [
  // SQL Injection
  { keywords: ['sql injection', 'sqli', 'sql error', 'database error', 'mysql error'], techniques: ['T1190', 'T1059', 'T1005', 'T1565'] },
  // XSS
  { keywords: ['xss', 'cross-site scripting', 'script injection'], techniques: ['T1189', 'T1059', 'T1539'] },
  // RCE
  { keywords: ['remote code execution', 'rce', 'command injection', 'os command', 'code execution'], techniques: ['T1190', 'T1059', 'T1059.004', 'T1068'] },
  // Authentication
  { keywords: ['brute force', 'weak password', 'default credential', 'authentication bypass', 'login'], techniques: ['T1110', 'T1078', 'T1136'] },
  // Information Disclosure
  { keywords: ['information disclosure', 'sensitive data', 'directory listing', 'server header', 'version disclosure', 'banner'], techniques: ['T1082', 'T1046', 'T1213'] },
  // SSL/TLS
  { keywords: ['ssl', 'tls', 'certificate', 'https', 'weak cipher', 'ssl certificate'], techniques: ['T1557', 'T1573'] },
  // File Inclusion / Path Traversal
  { keywords: ['file inclusion', 'lfi', 'rfi', 'path traversal', 'directory traversal'], techniques: ['T1190', 'T1005', 'T1083'] },
  // Web Shell / Backdoor
  { keywords: ['web shell', 'backdoor', 'reverse shell'], techniques: ['T1505.003', 'T1059', 'T1071'] },
  // SSH
  { keywords: ['ssh', 'openssh', 'ssh brute', 'sftp'], techniques: ['T1021', 'T1133', 'T1110'] },
  // Open Ports
  { keywords: ['open port', 'exposed service', 'port scan', 'nmap'], techniques: ['T1046', 'T1018', 'T1133'] },
  // Outdated Software
  { keywords: ['outdated', 'obsolete', 'eol', 'end of life', 'unpatched', 'vulnerable version', 'cve-'], techniques: ['T1190', 'T1068', 'T1210'] },
  // CSRF
  { keywords: ['csrf', 'cross-site request forgery'], techniques: ['T1189', 'T1098'] },
  // DoS
  { keywords: ['denial of service', 'dos', 'ddos', 'resource exhaustion'], techniques: ['T1499'] },
  // CORS / Headers
  { keywords: ['cors', 'missing header', 'security header', 'x-frame-options', 'content-security-policy'], techniques: ['T1189', 'T1027'] },
  // Credential Exposure
  { keywords: ['credential', 'password', 'api key', 'secret', 'token leak'], techniques: ['T1552', 'T1078'] },
];


/**
 * Map a single vulnerability to MITRE ATT&CK techniques
 */
const mapVulnToAttack = (vulnerability) => {
  if (!vulnerability) return [];

  const searchText = [
    vulnerability.title || '',
    vulnerability.type || '',
    vulnerability.description || '',
    vulnerability.cveId || '',
  ].join(' ').toLowerCase();

  const matchedTechniques = new Map(); // Use Map to deduplicate by technique ID

  for (const rule of VULN_TYPE_RULES) {
    const matched = rule.keywords.some(kw => searchText.includes(kw));
    if (matched) {
      for (const techId of rule.techniques) {
        const technique = TECHNIQUE_MAP[techId];
        if (technique && !matchedTechniques.has(techId)) {
          const tactic = TACTICS[technique.tacticId] || {};
          matchedTechniques.set(techId, {
            techniqueId: technique.id,
            techniqueName: technique.name,
            tacticId: tactic.id || technique.tacticId,
            tacticName: tactic.name || 'Unknown',
            phase: tactic.phase || 'unknown',
          });
        }
      }
    }
  }

  return Array.from(matchedTechniques.values());
};

/**
 * Map all vulnerabilities and generate a complete ATT&CK kill chain
 */
const generateAttackChain = (vulnerabilities) => {
  if (!Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
    return { chain: [], mappedVulns: [], tactics: [] };
  }

  // Map each vulnerability
  const mappedVulns = vulnerabilities.map(v => ({
    title: v.title,
    severity: v.severity,
    cveId: v.cveId || '',
    mitreMapping: mapVulnToAttack(v),
  }));

  // Aggregate all tactics across all vulnerabilities
  const tacticCounts = {};
  const allTechniques = new Set();

  for (const mv of mappedVulns) {
    for (const mapping of mv.mitreMapping) {
      if (!tacticCounts[mapping.tacticId]) {
        tacticCounts[mapping.tacticId] = {
          ...TACTICS[mapping.tacticId],
          techniques: [],
          count: 0,
        };
      }
      tacticCounts[mapping.tacticId].count++;
      if (!allTechniques.has(mapping.techniqueId)) {
        allTechniques.add(mapping.techniqueId);
        tacticCounts[mapping.tacticId].techniques.push({
          id: mapping.techniqueId,
          name: mapping.techniqueName,
        });
      }
    }
  }

  // Build ordered kill chain
  const tacticOrder = ['TA0043', 'TA0001', 'TA0002', 'TA0003', 'TA0004', 'TA0005', 'TA0006', 'TA0007', 'TA0008', 'TA0009', 'TA0011', 'TA0010', 'TA0040'];
  const chain = tacticOrder
    .filter(tid => tacticCounts[tid])
    .map(tid => tacticCounts[tid]);

  return {
    chain,
    mappedVulns,
    tactics: Object.values(tacticCounts),
    coveragePercent: Math.round((chain.length / tacticOrder.length) * 100),
  };
};

/**
 * Generate a narrative: how a hacker would exploit these vulnerabilities
 */
const getAttackNarrative = (vulnerabilities) => {
  const { chain, mappedVulns } = generateAttackChain(vulnerabilities);
  if (chain.length === 0) return 'No attack vectors identified from current findings.';

  let narrative = '🎯 ATTACK CHAIN ANALYSIS\n\n';

  for (let i = 0; i < chain.length; i++) {
    const tactic = chain[i];
    narrative += `PHASE ${i + 1}: ${tactic.name.toUpperCase()} [${tactic.id}]\n`;
    for (const tech of tactic.techniques) {
      // Find which vulnerability triggered this technique
      const triggeredBy = mappedVulns.find(mv =>
        mv.mitreMapping.some(m => m.techniqueId === tech.id)
      );
      narrative += `  → ${tech.name} (${tech.id})`;
      if (triggeredBy) narrative += ` — via: "${triggeredBy.title}"`;
      narrative += '\n';
    }
    if (i < chain.length - 1) narrative += '  ↓\n';
  }

  narrative += `\nKill Chain Coverage: ${Math.round((chain.length / 13) * 100)}% of MITRE ATT&CK tactics covered.\n`;
  narrative += `Techniques Used: ${chain.reduce((sum, t) => sum + t.techniques.length, 0)} unique techniques identified.`;

  return narrative;
};

module.exports = {
  TACTICS,
  TECHNIQUE_MAP,
  mapVulnToAttack,
  generateAttackChain,
  getAttackNarrative,
};
