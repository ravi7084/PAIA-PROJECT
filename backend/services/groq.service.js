/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Groq AI Service (Ultra Fast)        ║
 * ║   Uses LPU technology for near-instant results║
 * ╚══════════════════════════════════════════════╝
 */

const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Common System Prompt (Same as Gemini for consistency)
 */
const SYSTEM_PROMPT = `You are PAIA (Penetration Testing AI Agent), an autonomous expert AI cybersecurity analyst and penetration tester.
Act as an autonomous agent orchestrating a multi-tool penetration testing pipeline.
You have access to MCP tools: run_subfinder, run_recon, nmap_scan, web_scan_nikto, exploit_check, traffic_analysis.

Rules:
- ALWAYS respond in strict JSON format.
- Decide the NEXT ACTION based on current results.
- If you have enough data, choose "generate_report".
- Map findings to MITRE ATT&CK tactic/technique IDs.`;

/**
 * Call Groq API with Llama-3 or Mixtral
 */
const callGroq = async (messages, responseFormat = "json_object") => {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'ENTER_YOUR_GROQ_KEY_HERE') {
    throw new Error("GROQ_API_KEY is missing in .env");
  }

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: process.env.GROQ_MODEL || "llama3-70b-8192",
        messages: messages,
        temperature: 0.2,
        response_format: { type: responseFormat }
      },
      {
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    const content = response.data.choices[0].message.content;
    return responseFormat === "json_object" ? JSON.parse(content) : content;
  } catch (err) {
    logger.error(`Groq API Error: ${err.response?.data?.error?.message || err.message}`);
    throw err;
  }
};

/**
 * Analyze scan results and decide next action
 */
const analyzeAndDecide = async (context) => {
  const prompt = `TARGET: ${context.target}
SCOPE: ${context.scope || 'full'}
CURRENT ITERATION: ${context.iteration || 0}/${context.maxIterations || 5}

COMPLETED SCANS: ${JSON.stringify(context.completedScans, null, 1)}
ALREADY USED TOOLS: ${JSON.stringify(context.usedTools || [])}

Respond in JSON:
{
  "nextAction": "tool_name|generate_report",
  "reasoning": "...",
  "currentFindings": [...]
}`;

  return await callGroq([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt }
  ]);
};

/**
 * Generate Final Security Report
 */
const generateReport = async (context) => {
  const prompt = `Generate a comprehensive security report for ${context.target}.
Data: ${JSON.stringify(context.completedScans, null, 1)}
Vulnerabilities: ${JSON.stringify(context.vulnerabilities, null, 1)}

Format: { "executiveSummary": "...", "findings": [...], "riskScore": 0-100 }`;

  return await callGroq([
    { role: "system", content: "You are a senior penetration tester writing a report." },
    { role: "user", content: prompt }
  ]);
};

module.exports = {
  analyzeAndDecide,
  generateReport
};
