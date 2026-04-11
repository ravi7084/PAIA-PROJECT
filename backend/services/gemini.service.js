/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Gemini AI Service                   ║
 * ║   Google Gemini API wrapper for AI agent     ║
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

const SYSTEM_PROMPT = `You are PAIA (Penetration Testing AI Agent), an expert AI cybersecurity analyst and penetration tester.

Your role:
- Analyze security scan results from various tools (Shodan, VirusTotal, WHOIS, Nmap, Nikto, etc.)
- Identify vulnerabilities, misconfigurations, and security risks
- Decide the next optimal testing step based on current findings (contextual pivoting)
- Follow OWASP Testing Guide, PTES, and MITRE ATT&CK methodologies
- Calculate CVSS scores for discovered vulnerabilities
- Provide professional remediation recommendations

Rules:
- ALWAYS respond in strict JSON format (no markdown, no extra text)
- NEVER recommend scanning unauthorized targets
- NEVER attempt destructive attacks
- Focus on detection and assessment, not exploitation
- Be thorough but respect the scope boundaries
- When in doubt, recommend passive/safe scans first`;

/**
 * Analyze scan results and decide what to do next
 */
const analyzeAndDecide = async (context) => {
  const m = getModel();

  const prompt = `${SYSTEM_PROMPT}

TARGET: ${context.target}
SCOPE: ${context.scope || 'full'}
CURRENT ITERATION: ${context.iteration || 0}/${context.maxIterations || 10}

COMPLETED SCANS & RESULTS:
${JSON.stringify(context.completedScans || [], null, 2)}

AVAILABLE TOOLS: ["shodan_api", "virustotal_api", "whois_api", "abuseipdb_api", "hunter_api", "otx_api", "censys_api", "nmap_cli", "nikto_cli", "subfinder_cli", "amass_cli"]

ALREADY USED TOOLS: ${JSON.stringify(context.usedTools || [])}

Based on current results, decide:
1. What scan/tool should run NEXT?
2. WHY? (explain your reasoning)
3. What specific parameters?
4. What vulnerabilities have you identified so far?

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
      "cveId": "CVE-XXXX-XXXX or empty"
    }
  ]
}`;

  try {
    const result = await m.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response (handle markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Gemini returned non-JSON response');
      return {
        nextAction: 'generate_report',
        parameters: {},
        reasoning: 'Could not parse AI response, generating report with current findings',
        riskLevel: 'info',
        shouldContinue: false,
        currentFindings: [],
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    logger.error(`Gemini analyzeAndDecide error: ${err.message}`);
    return {
      nextAction: 'generate_report',
      parameters: {},
      reasoning: `AI analysis failed: ${err.message}. Generating report with available data.`,
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
  const m = getModel();

  const prompt = `${SYSTEM_PROMPT}

Generate a COMPLETE penetration test report for:

TARGET: ${context.target}
SCOPE: ${context.scope || 'full'}

ALL SCAN RESULTS:
${JSON.stringify(context.completedScans || [], null, 2)}

ALL IDENTIFIED VULNERABILITIES:
${JSON.stringify(context.vulnerabilities || [], null, 2)}

AI DECISION LOG:
${JSON.stringify(context.aiDecisions || [], null, 2)}

Generate the report in this exact JSON format:
{
  "executiveSummary": "2-3 paragraph non-technical summary for management",
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
      "tool": "Which tool found this"
    }
  ],
  "recommendations": ["Prioritized list of security improvements"],
  "methodology": "Brief description of testing methodology used",
  "conclusion": "Final assessment paragraph"
}`;

  try {
    const result = await m.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in report response');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    logger.error(`Gemini generateReport error: ${err.message}`);
    return {
      executiveSummary: `Automated penetration test completed for ${context.target}. AI report generation encountered an error. Please review raw scan data.`,
      riskScore: 0,
      overallRiskLevel: 'info',
      findings: context.vulnerabilities || [],
      recommendations: ['Review scan results manually', 'Re-run scan with valid Gemini API key'],
      methodology: 'Automated OSINT + active scanning',
      conclusion: 'Report generation incomplete. Review raw data.',
    };
  }
};

/**
 * Quick CVSS assessment for a single vulnerability
 */
const assessCVSS = async (vulnerability) => {
  const m = getModel();

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
    const result = await m.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { cvss: 0, severity: 'info', vector: '', justification: 'Could not assess' };
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    logger.error(`Gemini assessCVSS error: ${err.message}`);
    return { cvss: 0, severity: 'info', vector: '', justification: err.message };
  }
};

module.exports = {
  analyzeAndDecide,
  generateReport,
  assessCVSS,
};
