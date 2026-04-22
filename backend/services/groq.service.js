/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Groq AI Service (Ultra Fast)        ║
 * ║   Drop-in replacement for Gemini             ║
 * ║   Full API parity: 4 exported functions      ║
 * ╚══════════════════════════════════════════════╝
 */

const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* ── System Prompt (MCP-aware, same as Gemini) ── */
const SYSTEM_PROMPT = `You are PAIA (Penetration Testing AI Agent), an autonomous expert AI cybersecurity analyst and penetration tester.

Your role:
- Act as an autonomous agent orchestrating a multi-tool penetration testing pipeline.
- You have access to the Model Context Protocol (MCP) toolset to interact with the target.
- Analyze security scan results in real-time and decide the next logical step.
- Map findings to MITRE ATT&CK techniques and tactics.
- Follow OWASP Testing Guide, PTES, and MITRE ATT&CK methodologies.

AVAILABLE MCP TOOLS:
1. run_subfinder: Discovers subdomains (OSINT).
2. run_recon: Deep OSINT for emails and IPs (theHarvester).
3. nmap_scan: Network port and service discovery.
4. web_scan_nikto: Web application vulnerability scanning.
5. exploit_check: Safe exploitation checks (Metasploit).
6. traffic_analysis: Protocol and traffic risk assessment (Tshark).

Rules:
- ALWAYS respond in strict JSON format.
- Decide the NEXT ACTION based on current iteration results.
- If you have enough data, choose "generate_report" to finish.
- Focus on discovery first (Subfinder/Recon) before active scanning (Nmap/Nikto).
- Never send raw large outputs if a compact summary can be generated.
- Include MITRE ATT&CK tactic/technique IDs where applicable.`;

/* ── Trim large payloads to save tokens (safe — never breaks JSON) ── */
const trimPayload = (data, maxLen = 6000) => {
  const str = JSON.stringify(data);
  if (str.length <= maxLen) return data;

  // If array, slice items until it fits
  if (Array.isArray(data)) {
    let trimmed = [...data];
    while (JSON.stringify(trimmed).length > maxLen && trimmed.length > 1) {
      trimmed.pop();
    }
    return trimmed;
  }

  // If object, stringify and return truncated string (not parsed)
  return JSON.parse(JSON.stringify(data).substring(0, maxLen - 2) + '}}');
};

/* ═══════════════════════════════════════════
   Core Groq API Caller (with retry)
   ═══════════════════════════════════════════ */
const callGroq = async (messages, maxTokens = 4096, retries = 3) => {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'ENTER_YOUR_GROQ_KEY_HERE') {
    throw new Error('GROQ_API_KEY is missing in .env');
  }

  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        GROQ_API_URL,
        {
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages: messages,
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 90000,
        }
      );

      const content = response.data.choices[0].message.content;
      logger.info(`Groq response received (attempt ${attempt}, tokens: ${response.data.usage?.total_tokens || '?'})`);

      // Robust JSON extraction — handles malformed or wrapped responses
      try {
        return JSON.parse(content);
      } catch (parseErr) {
        logger.warn('Groq returned malformed JSON, attempting recovery...');
        // Try to extract JSON object from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (e) {
            logger.warn('JSON recovery also failed, cleaning response...');
            // Last resort: strip control characters and retry
            const cleaned = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            return JSON.parse(cleaned);
          }
        }
        throw new Error('Cannot parse Groq response as JSON');
      }
    } catch (err) {
      lastError = err;
      const errMsg = err.response?.data?.error?.message || err.message;
      logger.warn(`Groq attempt ${attempt}/${retries} failed: ${errMsg}`);

      if (attempt < retries) {
        const wait = attempt * 12000;
        logger.info(`Groq retry in ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError || new Error('Groq call failed after retries');
};

/* ═══════════════════════════════════════════
   1. analyzeAndDecide — MCP Tool Orchestration
   ═══════════════════════════════════════════ */
const analyzeAndDecide = async (context) => {
  const prompt = `TARGET: ${context.target}
SCOPE: ${context.scope || 'full'}
CURRENT ITERATION: ${context.iteration || 0}/${context.maxIterations || 5}

COMPLETED SCANS & RESULTS:
${JSON.stringify(trimPayload(context.completedScans || []), null, 1)}

ALREADY USED TOOLS: ${JSON.stringify(context.usedTools || [])}

Based on current results, decide:
1. What scan/tool should run NEXT? (Use ONLY from the AVAILABLE MCP TOOLS list)
2. WHY? (explain reasoning)
3. What vulnerabilities have you identified so far?
4. Map each vulnerability to MITRE ATT&CK tactics and techniques

Respond ONLY in this exact JSON format:
{
  "nextAction": "run_subfinder|run_recon|nmap_scan|web_scan_nikto|exploit_check|traffic_analysis|generate_report",
  "parameters": { "target": "...", "flags": "..." },
  "reasoning": "...",
  "riskLevel": "info|low|medium|high|critical",
  "shouldContinue": true,
  "currentFindings": [
    {
      "title": "Finding title",
      "type": "vulnerability type",
      "severity": "critical|high|medium|low|info",
      "cvss": 0.0,
      "description": "What was found",
      "evidence": "...",
      "remediation": "...",
      "cveId": "...",
      "mitreAttack": [{ "tacticId": "TA0001", "tacticName": "Initial Access", "techniqueId": "T1190", "techniqueName": "Exploit Public-Facing Application" }]
    }
  ]
}`;

  try {
    return await callGroq([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);
  } catch (err) {
    logger.error(`Groq analyzeAndDecide error: ${err.message}`);
    return {
      nextAction: 'generate_report',
      reasoning: 'AI analysis failed, generating report with available data.',
      riskLevel: 'info',
      shouldContinue: false,
      currentFindings: [],
    };
  }
};

/* ═══════════════════════════════════════════
   2. generateReport — Full Pentest Report
   ═══════════════════════════════════════════ */
const generateReport = async (context) => {
  const prompt = `Generate a COMPLETE and CONCISE penetration test report (max 4 pages worth of content) for:

TARGET: ${context.target}
SCOPE: ${context.scope || 'full'}

CRITICAL INSTRUCTION FOR SCOPE ENFORCEMENT:
If SCOPE is 'recon-only': ONLY report on Threat Intelligence and passive OSINT data. DO NOT report or invent web vulnerabilities, SQLi, XSS, or internal network port findings.
If SCOPE is 'network': ONLY report on open ports, services, operating systems, and network CVEs. DO NOT invent web application vulnerabilities.
If SCOPE is 'web': ONLY report on web application vulnerabilities (like XSS, SQLi, headers, SSL). DO NOT invent infrastructure or network port vulnerabilities.
If SCOPE is 'full': Consider all findings.

ALL SCAN RESULTS:
${JSON.stringify(trimPayload(context.completedScans || []), null, 1)}

ALL IDENTIFIED VULNERABILITIES:
${JSON.stringify(trimPayload(context.vulnerabilities || []), null, 1)}

NVD ENRICHMENT DATA:
${JSON.stringify(trimPayload(context.nvdEnrichment || []), null, 1)}

MITRE ATT&CK MAPPING:
${JSON.stringify(trimPayload(context.mitreMapping || {}), null, 1)}

AI DECISION LOG:
${JSON.stringify(trimPayload(context.aiDecisions || []), null, 1)}

Generate the report including MITRE ATT&CK analysis and real-world risk assessment.
IMPORTANT: Base findings ONLY on actual scan data provided above. Do NOT invent vulnerabilities.

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
  "mitreAttackSummary": "Brief summary of the MITRE ATT&CK kill chain coverage",
  "recommendations": ["Prioritized list of security improvements"],
  "methodology": "Brief description of testing methodology used",
  "conclusion": "Final assessment paragraph"
}`;

  try {
    return await callGroq(
      [
        { role: 'system', content: 'You are a senior penetration tester writing a professional security assessment report. Be thorough but concise. Base findings ONLY on actual scan data.' },
        { role: 'user', content: prompt },
      ],
      4096
    );
  } catch (err) {
    logger.error(`Groq generateReport error: ${err.message}`);
    return {
      executiveSummary: `Automated penetration test completed for ${context.target}. AI report generation encountered an error. Please review raw scan data.`,
      riskScore: 0,
      overallRiskLevel: 'info',
      findings: context.vulnerabilities || [],
      mitreAttackSummary: 'MITRE ATT&CK mapping available in raw findings.',
      recommendations: ['Review scan results manually', 'Re-run scan when AI service is available'],
      methodology: 'Automated OSINT + active scanning + NVD/Vulners enrichment + MITRE ATT&CK mapping',
      conclusion: 'Report generation incomplete due to AI service error. Review raw data.',
    };
  }
};

/* ═══════════════════════════════════════════
   3. assessCVSS — Single Vulnerability Scoring
   ═══════════════════════════════════════════ */
const assessCVSS = async (vulnerability) => {
  const prompt = `Assess the CVSS v3.1 base score for this vulnerability:
${JSON.stringify(vulnerability)}

Respond ONLY in this JSON format:
{
  "cvss": 0.0,
  "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  "severity": "critical|high|medium|low|info",
  "justification": "Brief explanation"
}`;

  try {
    return await callGroq(
      [
        { role: 'system', content: 'You are a vulnerability scoring expert.' },
        { role: 'user', content: prompt },
      ],
      512
    );
  } catch (err) {
    logger.error(`Groq assessCVSS error: ${err.message}`);
    return { cvss: 0, severity: 'info', vector: '', justification: err.message };
  }
};

/* ═══════════════════════════════════════════
   4. explainResults — 4 Analysis Modes
   ═══════════════════════════════════════════ */
const explainResults = async (session, mode = 'hacker') => {
  const modePrompts = {
    hacker: `You are a skilled penetration tester explaining findings to a technical red team.
Explain the scan results like a HACKER would:
- Use technical language, mention CVEs, CVSS scores, attack vectors
- Describe the exploitation path step by step
- Map each attack step to MITRE ATT&CK techniques (include IDs like T1190, TA0001)
- Rate the difficulty of exploitation
Format your response as a detailed technical analysis report.`,

    manager: `You are a cybersecurity consultant presenting to C-level executives.
Explain the scan results for MANAGEMENT:
- Use non-technical language
- Focus on BUSINESS IMPACT and RISK
- Mention potential financial losses
- Provide clear, prioritized action items
- Include compliance implications (GDPR, PCI-DSS, HIPAA)
- Give a risk rating with RAG status (Red/Amber/Green)
Format your response as an executive security briefing.`,

    exploit: `You are a senior penetration tester mapping attack chains.
Generate a detailed EXPLOIT CHAIN ANALYSIS:
- Map each vulnerability to MITRE ATT&CK tactics and techniques (include IDs)
- Show how vulnerabilities can be chained: Initial Access → Execution → Persistence → Privilege Escalation → Impact
- Reference real-world CVEs and known exploits
- Rate the overall exploitability
Format as an attack chain diagram with phases.`,

    fixes: `You are a security engineer providing remediation guidance.
Generate a prioritized REMEDIATION PLAN:
- List all fixes in priority order (CRITICAL first)
- Include specific commands, configurations, and code changes
- Estimate time and effort for each fix
- Group related fixes together
Format as a detailed remediation checklist.`,
  };

  const prompt = `${modePrompts[mode] || modePrompts.hacker}

TARGET: ${session.target}
RISK SCORE: ${session.report?.riskScore || 0}/100

VULNERABILITIES FOUND:
${JSON.stringify(trimPayload(session.vulnerabilities || []), null, 1)}

SCAN RESULTS SUMMARY:
${JSON.stringify(trimPayload({
    phases: (session.phases || []).map((p) => ({ name: p.name, status: p.status, tools: p.tools })),
    aiDecisions: (session.aiDecisions || []).map((d) => ({ action: d.action, reasoning: d.reasoning })),
    report: session.report ? { executiveSummary: session.report.executiveSummary, riskScore: session.report.riskScore } : null,
  }), null, 1)}

IMPORTANT: Respond ONLY in this JSON format:
{
  "title": "Analysis title based on mode",
  "content": "Full detailed analysis text with proper formatting using \\n for newlines",
  "highlights": ["Key point 1", "Key point 2", "Key point 3"],
  "riskVerdict": "Overall risk assessment in one line"
}`;

  try {
    return await callGroq(
      [
        { role: 'system', content: modePrompts[mode] || modePrompts.hacker },
        { role: 'user', content: prompt },
      ],
      4096
    );
  } catch (err) {
    logger.error(`Groq explainResults error: ${err.message}`);

    const vulns = session.vulnerabilities || [];
    const critCount = vulns.filter((v) => v.severity === 'critical').length;
    const highCount = vulns.filter((v) => v.severity === 'high').length;

    return {
      title: 'AI Analysis — Fallback (Groq Error)',
      content:
        `⚠️ Groq API error. Local fallback analysis:\n\n` +
        `TARGET: ${session.target}\n` +
        `RISK SCORE: ${session.report?.riskScore || 0}/100\n` +
        `TOTAL FINDINGS: ${vulns.length} (${critCount} critical, ${highCount} high)\n\n` +
        `FINDINGS:\n` +
        vulns
          .map(
            (v, i) =>
              `${i + 1}. [${(v.severity || 'info').toUpperCase()}] ${v.title}${v.cvss ? ' — CVSS: ' + v.cvss : ''}\n   ${v.description || 'No description'}\n   Fix: ${v.remediation || 'Review and patch'}`
          )
          .join('\n\n'),
      highlights: vulns.slice(0, 3).map((v) => `${v.severity?.toUpperCase()}: ${v.title}`),
      riskVerdict: `${vulns.length} findings detected. ${critCount > 0 ? 'CRITICAL vulnerabilities require immediate action.' : 'Review recommended.'}`,
    };
  }
};

/* ── Exports (Full parity with Gemini service) ── */
module.exports = {
  analyzeAndDecide,
  generateReport,
  assessCVSS,
  explainResults,
};
