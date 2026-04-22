/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — MCP (Model Context Protocol) Server   ║
 * ║   Exposes Kali API tools to AI Models          ║
 * ╚══════════════════════════════════════════════╝
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const axios = require('axios');
require('dotenv').config();

const KALI_API_URL = `http://${process.env.REMOTE_SCANNER_IP || '192.168.18.15'}:5000`;

/**
 * Initialize the MCP Server
 */
const server = new Server({
  name: "paia-security-orchestrator",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

/**
 * 1. Define Available Tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "nmap_scan",
      description: "Perform a network port and service discovery scan on a target IP or domain.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Target IP or hostname" }
        },
        required: ["target"],
      },
    },
    {
      name: "web_scan_nikto",
      description: "Scan a web application for vulnerabilities, server misconfigurations, and outdated software.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Target URL or domain" }
        },
        required: ["target"],
      },
    },
    {
      name: "subdomain_discovery",
      description: "Identify subdomains for a given domain using Subfinder.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Root domain (e.g., example.com)" }
        },
        required: ["target"],
      },
    },
    {
      name: "osint_recon",
      description: "Deep reconnaissance for emails, IPs, and hostnames using theHarvester.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Target domain" }
        },
        required: ["target"],
      },
    }
  ],
}));

/**
 * 2. Handle Tool Execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[PAIA-MCP] Executing tool: ${name} on ${args.target}`);

  try {
    let endpoint = "";
    switch (name) {
      case "nmap_scan": endpoint = "/nmap"; break;
      case "web_scan_nikto": endpoint = "/nikto"; break;
      case "subdomain_discovery": endpoint = "/subfinder"; break;
      case "osint_recon": endpoint = "/recon"; break;
      default:
        throw new Error(`Tool ${name} not found`);
    }

    const response = await axios.post(`${KALI_API_URL}${endpoint}`, { target: args.target }, { timeout: 300000 }); // 5 min timeout
    
    return {
      content: [
        {
          type: "text",
          text: `Scan Results from ${name}:\n\n${JSON.stringify(response.data, null, 2)}`
        }
      ],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Tool execution failed: ${error.message}` }],
      isError: true,
    };
  }
});

/**
 * 3. Start Transport
 */
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PAIA MCP Server running on Stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
