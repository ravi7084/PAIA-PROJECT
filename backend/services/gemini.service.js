/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Gemini AI Service (UPGRADED)        ║
 * ║   Smart rate limiting, MITRE ATT&CK prompts ║
 * ║   Fallback mode when Gemini unavailable      ║
 * ╚══════════════════════════════════════════════╝
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

let genAI = null;
let model = null;

const getModel = () => {
  if (!model) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set in .env');
    genAI = new GoogleGenerativeAI(key);
    model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    });
  }
  return model;
};

/* ── Smart Rate Limiter — max 12 RPM to stay within 15 RPM limit ── */
let limiterPromise = Promise.resolve();

const rateLimiter = {
  timestamps: [],
  maxPerMinute: 14,
  minDelayMs: 4500,

  async waitForSlot() {
    const p = limiterPromise.then(async () => {
      const now = Date.now();
      this.timestamps = this.timestamps.filter(t => now - t < 60000);

      if (this.timestamps.length >= this.maxPerMinute) {
        const oldestInWindow = this.timestamps[0];
        const waitMs = 60000 - (now - oldestInWindow) + 1000;
        logger.info(`Gemini rate limiter: waiting ${Math.round(waitMs / 1000)}s`);
        await new Promise(r => setTimeout(r, waitMs));
      }

      const actualNow = Date.now();
      const timeSinceLastCall = actualNow - (this.timestamps[this.timestamps.length - 1] || 0);
      if (timeSinceLastCall < this.minDelayMs) {
        await new Promise(r => setTimeout(r, this.minDelayMs - timeSinceLastCall));
      }

      this.timestamps.push(Date.now());
    });
    limiterPromise = p;
    return p;
  },
};

/* ── Trim scan data to avoid token limits ── */
const trimScanData = (data, maxChars = 2000) => {
  const str = JSON.stringify(data, null, 2);
  if (str.length <= maxChars) return data;

  const trimmed = JSON.parse(str);
  const trimObj = (obj) => {
    if (typeof obj === 'string' && obj.length > 200) return obj.slice(0, 200) + '...[T]';
    if (Array.isArray(obj) && obj.length > 5) return [...obj.slice(0, 5), `...and ${obj.length - 5} more`];
    if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        obj[key] = trimObj(obj[key]);
      }
    }
    return obj;
  };
  return trimObj(trimmed);
};

/* ── Extract JSON from Gemini response ── */
const extractJSON = (text) => {
  try { return JSON.parse(text); } catch { /* */ }
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1]); } catch { /* */ } }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) { try { return JSON.parse(jsonMatch[0]); } catch { /* */ } }
  return null;
};

/* ── Retry wrapper with rate limiting ── */
const callGeminiWithRetry = async (prompt, maxRetries = 2) => {
  const m = getModel();
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait for rate limiter before each call
      await rateLimiter.waitForSlot();

      if (attempt > 0) {
        const backoff = 2000 * Math.pow(2, attempt);
        logger.info(`Gemini retry attempt ${attempt}/${maxRetries}, backoff ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
      }

      const result = await m.generateContent(prompt);
      const text = result.response.text();
      const json = extractJSON(text);
      if (json) return json;

      if (attempt < maxRetries) {
        logger.warn('Gemini returned non-JSON, retrying');
        continue;
      }
      throw new Error('Gemini returned non-JSON response after retries');
    } catch (err) {
      lastError = err;
      if (err.message?.includes('API key') || err.message?.includes('PERMISSION_DENIED')) throw err;
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        logger.warn('Gemini rate limited, waiting 30s...');
        await new Promise(r => setTimeout(r, 30000));
      }
    }
  }
  throw lastError || new Error('Gemini call failed after retries');
};

const SYSTEM_PROMPT = `You are PAIA (Penetration Testing AI Agent), an expert AI cybersecurity analyst and penetration tester.

Your role:
- Analyze security scan results from various tools (Shodan, VirusTotal, WHOIS, Nmap, Nikto, NVD, Vulners)
- Identify vulnerabilities, misconfigurations, and security risks
- Map findings to MITRE ATT&CK techniques and tactics
- Decide the next optimal testing step based on current findings
- Follow OWASP Testing Guide, PTES, and MITRE ATT&CK methodologies
- Calculate CVSS scores and provide real-world risk context
- Provide professional remediation recommendations

Rules:
- ALWAYS respond in strict JSON format (no markdown, no extra text)
- NEVER recommend scanning unauthorized targets
- NEVER attempt destructive attacks
- Focus on detection and assessment, not exploitation
- Be thorough but respect the scope boundaries
- Include MITRE ATT&CK tactic/technique IDs where applicable
- When in doubt, recommend passive/safe scans first`;

/**
 * Analyze scan results and decide what to do next
 */
const analyzeAndDecide = async (context) => {
  const trimmedScans = trimScanData(context.completedScans || []);

  const prompt = `${SYSTEM_PROMPT}

TARGET: ${context.target}
SCOPE: ${context.scope || 'full'}
CURRENT ITERATION: ${context.iteration || 0}/${context.maxIterations || 10}

COMPLETED SCANS & RESULTS:
${JSON.stringify(trimmedScans, null, 2)}

AVAILABLE TOOLS: ["shodan_api", "virustotal_api", "whois_api", "abuseipdb_api", "hunter_api", "otx_api", "censys_api", "nmap_cli", "nikto_cli", "subfinder_cli", "amass_cli", "builtin_scan", "nvd_lookup", "vulners_search"]

ALREADY USED TOOLS: ${JSON.stringify(context.usedTools || [])}

Based on current results, decide:
1. What scan/tool should run NEXT?
2. WHY? (explain reasoning)
3. What vulnerabilities have you identified so far?
4. Map each vulnerability to MITRE ATT&CK tactics and techniques

Respond ONLY in this exact JSON format:
{
  "nextAction": "tool_name or 'generate_report' if done",
  "parameters": { "target": "...", "flags": "..." },
  "reasoning": "Why this is the next best step",
  "riskLevel": "info|low|medium|high|critical",
  "shouldContinue": true,
  "currentFindings": [
    {
      "title": "Finding title",
      "type": "vulnerability type",
      "severity": "critical|high|medium|low|info",
      "cvss": 0.0,
      "description": "What was found",
      "evidence": "Raw data supporting this",
      "remediation": "How to fix",
      "cveId": "CVE-XXXX-XXXX or empty",
      "mitreAttack": [{ "tacticId": "TA0001", "tacticName": "Initial Access", "techniqueId": "T1190", "techniqueName": "Exploit Public-Facing Application" }]
    }
  ]
}`;

  try {
    return await callGeminiWithRetry(prompt);
  } catch (err) {
    logger.error(`Gemini analyzeAndDecide error: ${err.message}`);
    const isRateLimit = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
    return {
      nextAction: 'generate_report',
      parameters: {},
      reasoning: isRateLimit
        ? 'API Rate Limit reached. Moving to report generation with available data.'
        : 'AI analysis interrupted. Compiling report with available data.',
      riskLevel: 'info',
      shouldContinue: false,
      currentFindings: [],
    };
  }
};

/**
 * Generate a complete penetration test report
 */
const generateReport = async (context) => {
  const trimmedScans = trimScanData(context.completedScans || []);
  const trimmedVulns = trimScanData(context.vulnerabilities || []);

  const prompt = `${SYSTEM_PROMPT}

Generate a COMPLETE penetration test report for:

TARGET: ${context.target}
SCOPE: ${context.scope || 'full'}

ALL SCAN RESULTS:
${JSON.stringify(trimmedScans, null, 2)}

ALL IDENTIFIED VULNERABILITIES:
${JSON.stringify(trimmedVulns, null, 2)}

NVD ENRICHMENT DATA:
${JSON.stringify(trimScanData(context.nvdEnrichment || []), null, 2)}

MITRE ATT&CK MAPPING:
${JSON.stringify(trimScanData(context.mitreMapping || {}), null, 2)}

AI DECISION LOG:
${JSON.stringify(trimScanData(context.aiDecisions || []), null, 2)}

Generate the report including MITRE ATT&CK analysis and real-world risk assessment.
Respond ONLY in this exact JSON format:
{
  "executiveSummary": "2-3 paragraph non-technical summary for management, including business risk implications",
  "riskScore": 0-100,
  "overallRiskLevel": "critical|high|medium|low|info",
  "findings": [
    {
      "title": "...",
      "type": "...",
      "severity": "critical|high|medium|low|info",
      "cvss": 0.0,
      "description": "Detailed technical description",
      "evidence": "What data proves this vulnerability",
      "remediation": "Step-by-step fix instructions",
      "cveId": "CVE if applicable",
      "tool": "Which tool found this",
      "mitreAttack": [{ "tacticId": "...", "tacticName": "...", "techniqueId": "...", "techniqueName": "..." }]
    }
  ],
  "mitreAttackSummary": "Brief summary of the MITRE ATT&CK kill chain coverage — how a hacker would chain these vulnerabilities",
  "recommendations": ["Prioritized list of security improvements"],
  "methodology": "Brief description of testing methodology used",
  "conclusion": "Final assessment paragraph"
}`;

  try {
    return await callGeminiWithRetry(prompt);
  } catch (err) {
    logger.error(`Gemini generateReport error: ${err.message}`);
    return {
      executiveSummary: `Automated penetration test completed for ${context.target}. AI report generation encountered an error. Please review raw scan data.`,
      riskScore: 0,
      overallRiskLevel: 'info',
      findings: context.vulnerabilities || [],
      mitreAttackSummary: 'MITRE ATT&CK mapping available in raw findings.',
      recommendations: ['Review scan results manually', 'Re-run scan with valid Gemini API key'],
      methodology: 'Automated OSINT + active scanning + NVD/Vulners enrichment',
      conclusion: 'Report generation incomplete. Review raw data.',
    };
  }
};

/**
 * Quick CVSS assessment for a single vulnerability
 */
const assessCVSS = async (vulnerability) => {
  const prompt = `${SYSTEM_PROMPT}

Assess the CVSS v3.1 base score for this vulnerability:
${JSON.stringify(vulnerability)}

Respond ONLY in this JSON format:
{
  "cvss": 0.0,
  "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  "severity": "critical|high|medium|low|info",
  "justification": "Brief explanation"
}`;

  try {
    return await callGeminiWithRetry(prompt, 1);
  } catch (err) {
    logger.error(`Gemini assessCVSS error: ${err.message}`);
    return { cvss: 0, severity: 'info', vector: '', justification: err.message };
  }
};

/**
 * AI Explain — 4 modes: hacker, manager, exploit, fixes
 * UPGRADED: includes MITRE ATT&CK references + better error handling
 */
const explainResults = async (session, mode = 'hacker') => {
  const modePrompts = {
    hacker: `You are a skilled penetration tester explaining findings to a technical red team.

Explain the scan results like a HACKER would:
- Use technical language, mention CVEs, CVSS scores, attack vectors
- Describe the exploitation path step by step
- Map each attack step to MITRE ATT&CK techniques (include IDs like T1190, TA0001)
- Explain how a real attacker would chain vulnerabilities together
- Mention whether public exploits exist (Vulners data)
- Rate the difficulty of exploitation
- Be thorough and detailed

Format your response as a detailed technical analysis report.`,

    manager: `You are a cybersecurity consultant presenting to C-level executives.

Explain the scan results like a MANAGER/EXECUTIVE would understand:
- Use non-technical language
- Focus on BUSINESS IMPACT and RISK
- Mention potential financial losses
- Explain what MITRE ATT&CK means for the organization (attacker capabilities)
- Provide clear, prioritized action items
- Include compliance implications (GDPR, PCI-DSS, HIPAA, SOC2)
- Give a risk rating with RAG status (Red/Amber/Green)

Format your response as an executive security briefing.`,

    exploit: `You are a senior penetration tester mapping attack chains.

Generate a detailed EXPLOIT CHAIN ANALYSIS:
- Map each vulnerability to MITRE ATT&CK tactics and techniques (include IDs)
- Show how vulnerabilities can be chained together in a kill chain
- Describe the full attack path: Initial Access → Execution → Persistence → Privilege Escalation → Impact
- Reference real-world CVEs and known exploits where applicable
- Rate the overall exploitability and likelihood of successful attack
- Include lateral movement possibilities

Format as an attack chain diagram with phases.`,

    fixes: `You are a security engineer providing remediation guidance.

Generate a prioritized REMEDIATION PLAN:
- List all fixes in priority order (CRITICAL first)
- Include specific commands, configurations, and code changes
- Reference the MITRE ATT&CK techniques each fix addresses
- Estimate time and effort for each fix (hours/days)
- Group related fixes together
- Include preventive measures and security hardening recommendations
- Mention relevant security frameworks and standards

Format as a detailed remediation checklist.`,
  };

  const prompt = `${modePrompts[mode] || modePrompts.hacker}

TARGET: ${session.target}
RISK SCORE: ${session.report?.riskScore || 0}/100

VULNERABILITIES FOUND:
${JSON.stringify(trimScanData(session.vulnerabilities || []), null, 2)}

SCAN RESULTS SUMMARY:
${JSON.stringify(trimScanData({
    phases: (session.phases || []).map(p => ({ name: p.name, status: p.status, tools: p.tools })),
    aiDecisions: (session.aiDecisions || []).map(d => ({ action: d.action, reasoning: d.reasoning, riskLevel: d.riskLevel })),
    report: session.report ? { executiveSummary: session.report.executiveSummary, riskScore: session.report.riskScore } : null,
  }), null, 2)}

IMPORTANT: Respond ONLY in this JSON format:
{
  "title": "Analysis title based on mode",
  "content": "Full detailed analysis text with proper formatting using \\n for newlines",
  "highlights": ["Key point 1", "Key point 2", "Key point 3"],
  "riskVerdict": "Overall risk assessment in one line"
}`;

  try {
    const result = await callGeminiWithRetry(prompt);
    return result;
  } catch (err) {
    logger.error(`Gemini explainResults error: ${err.message}`);

    // Return a useful local fallback instead of just an error
    const isRateLimit = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
    const vulns = session.vulnerabilities || [];
    const critCount = vulns.filter(v => v.severity === 'critical').length;
    const highCount = vulns.filter(v => v.severity === 'high').length;

    if (isRateLimit) {
      return {
        title: 'AI Analysis — Rate Limit (Local Fallback)',
        content: `⚠️ Gemini API quota temporarily exceeded. Here is a local analysis based on scan data:\n\n`
          + `TARGET: ${session.target}\n`
          + `RISK SCORE: ${session.report?.riskScore || 0}/100\n`
          + `TOTAL FINDINGS: ${vulns.length} (${critCount} critical, ${highCount} high)\n\n`
          + `FINDINGS SUMMARY:\n`
          + vulns.map((v, i) => `${i + 1}. [${(v.severity || 'info').toUpperCase()}] ${v.title}${v.cveId ? ' (' + v.cveId + ')' : ''}${v.cvss ? ' — CVSS: ' + v.cvss : ''}\n   ${v.description || 'No description'}\n   Fix: ${v.remediation || 'Review and patch'}`).join('\n\n')
          + `\n\n💡 Tip: Wait 60 seconds and retry, or generate a new Gemini API key at https://aistudio.google.com/apikey`,
        highlights: vulns.slice(0, 3).map(v => `${v.severity?.toUpperCase()}: ${v.title}`),
        riskVerdict: `${vulns.length} findings detected. ${critCount > 0 ? 'CRITICAL vulnerabilities require immediate action.' : 'Review recommended.'}`,
      };
    }

    return {
      title: 'AI Analysis Error',
      content: `Unable to generate ${mode} analysis: ${err.message}\n\nPlease try again or check the Gemini API key.`,
      highlights: ['AI analysis failed'],
      riskVerdict: 'Cannot assess — AI error',
    };
  }
};

module.exports = {
  analyzeAndDecide,
  generateReport,
  assessCVSS,
  explainResults,
};
