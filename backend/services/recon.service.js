const { spawn } = require('child_process');
const ReconScan = require('../models/reconScan.model');

const MAX_OUTPUT_CHARS = 20000;
const TOOL_API_KEYS = {
  theharvester: {
    SHODAN_API_KEY: process.env.SHODAN_API_KEY || '',
    CENSYS_API_ID: process.env.CENSYS_API_ID || '',
    CENSYS_API_SECRET: process.env.CENSYS_API_SECRET || '',
    HUNTER_API_KEY: process.env.HUNTER_API_KEY || ''
  },
  reconng: {
    RECONNG_SHODAN_API: process.env.RECONNG_SHODAN_API || '',
    RECONNG_SECURITYTRAILS_API: process.env.RECONNG_SECURITYTRAILS_API || '',
    RECONNG_HIBP_API: process.env.RECONNG_HIBP_API || ''
  },
  spiderfoot: {
    SPIDERFOOT_API_KEY: process.env.SPIDERFOOT_API_KEY || '',
    SPIDERFOOT_SHODAN_KEY: process.env.SPIDERFOOT_SHODAN_KEY || '',
    SPIDERFOOT_VIRUSTOTAL_KEY: process.env.SPIDERFOOT_VIRUSTOTAL_KEY || ''
  },
  maltego: {
    MALTEGO_API_KEY: process.env.MALTEGO_API_KEY || ''
  },
  subfinder: {
    SUBFINDER_API_KEY: process.env.SUBFINDER_API_KEY || ''
  },
  amass: {
    AMASS_API_KEY: process.env.AMASS_API_KEY || ''
  },
  nmap: {
    NMAP_API_KEY: process.env.NMAP_API_KEY || ''
  },
  nessus: {
    NESSUS_ACCESS_KEY: process.env.NESSUS_ACCESS_KEY || '',
    NESSUS_SECRET_KEY: process.env.NESSUS_SECRET_KEY || '',
    NESSUS_URL: process.env.NESSUS_URL || ''
  },
  nikto: {
    NIKTO_API_KEY: process.env.NIKTO_API_KEY || ''
  }
};

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const isValidDomain = (value) => {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(v);
};

const isValidIp = (value) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value || '');

const normalizeTarget = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
};

const targetToHttpUrl = (target) => {
  const cleaned = normalizeTarget(target);
  if (!cleaned) return '';
  return /^https?:\/\//i.test(target) ? target : `http://${cleaned}`;
};

const extractDnsRecords = (text) => {
  const safe = String(text || '');
  const collect = (regex, normalizeFn = (v) => v.trim().toLowerCase()) =>
    uniq((safe.match(regex) || []).map((line) => {
      const parts = line.split(/\s+/);
      const raw = parts[parts.length - 1] || '';
      return normalizeFn(raw.replace(/["']/g, '').trim());
    }).filter(Boolean));

  return {
    ns: collect(/\bNS\s+[A-Za-z0-9._-]+\b/g),
    mx: collect(/\bMX\s+[A-Za-z0-9._-]+\b/g),
    txt: collect(/\bTXT\s+["']?[^"'\n\r]+["']?/g, (v) => v.trim()),
    cname: collect(/\bCNAME\s+[A-Za-z0-9._-]+\b/g),
    a: collect(/\bA\s+(?:\d{1,3}\.){3}\d{1,3}\b/g)
  };
};

const extractNetworkIndicators = (text) => {
  const safe = String(text || '');
  const ports = uniq((safe.match(/\b\d{1,5}\/(?:tcp|udp)\b/gi) || []).map((x) => parseInt(x.split('/')[0], 10)).filter((p) => p > 0 && p <= 65535));
  const serviceMatches = safe.match(/\b(?:open|filtered)\s+[a-z0-9._-]+\b/gi) || [];
  const services = uniq(serviceMatches.map((line) => {
    const parts = line.trim().split(/\s+/);
    return parts[1] || '';
  }).filter(Boolean));
  const vulnSignals = uniq([
    ...(safe.match(/CVE-\d{4}-\d{4,7}/gi) || []),
    ...(safe.match(/\b(?:critical|high|medium|low)\s+vulnerab(?:ility|ilities)\b/gi) || [])
  ].map((v) => v.toLowerCase()));

  return {
    openPorts: ports,
    services,
    vulnerabilities: vulnSignals
  };
};

const extractWebIndicators = (text) => {
  const safe = String(text || '');
  const urls = uniq((safe.match(/https?:\/\/[^\s"'<>]+/gi) || []).map((u) => u.trim()));
  const cves = uniq((safe.match(/CVE-\d{4}-\d{4,7}/gi) || []).map((v) => v.toLowerCase()));
  const niktoVulnHints = uniq([
    ...(safe.match(/OSVDB-\d+/gi) || []),
    ...(safe.match(/\b(?:xss|sql injection|sqli|csrf|xxe|open redirect|rce|directory indexing|clickjacking)\b/gi) || [])
  ].map((v) => v.toLowerCase()));

  const owaspMap = [
    { label: 'A01: Broken Access Control', hits: [/broken access control/i] },
    { label: 'A02: Cryptographic Failures', hits: [/cryptographic failures/i, /sensitive data exposure/i] },
    { label: 'A03: Injection', hits: [/\binjection\b/i, /\bsqli?\b/i, /sql injection/i] },
    { label: 'A04: Insecure Design', hits: [/insecure design/i] },
    { label: 'A05: Security Misconfiguration', hits: [/security misconfiguration/i] },
    { label: 'A06: Vulnerable and Outdated Components', hits: [/vulnerable and outdated components/i] },
    { label: 'A07: Identification and Authentication Failures', hits: [/identification and authentication failures/i, /broken authentication/i] },
    { label: 'A08: Software and Data Integrity Failures', hits: [/software and data integrity failures/i] },
    { label: 'A09: Security Logging and Monitoring Failures', hits: [/security logging and monitoring failures/i] },
    { label: 'A10: SSRF', hits: [/server-side request forgery/i, /\bssrf\b/i] }
  ];

  const owaspTop10 = owaspMap
    .filter((entry) => entry.hits.some((re) => re.test(safe)))
    .map((entry) => entry.label);

  return {
    urls,
    vulnerabilities: uniq([...cves, ...niktoVulnHints, ...owaspTop10.map((x) => x.toLowerCase())]),
    owaspTop10
  };
};

const extractIndicators = (text, target = '', phase = 'recon') => {
  const safe = String(text || '');
  const domains = safe.match(/\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,63}\b/g) || [];
  const emails = safe.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi) || [];
  const ips = safe.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
  const allDomains = uniq(domains.map((d) => d.toLowerCase()));
  const base = String(target || '').toLowerCase();
  const subdomains = base
    ? allDomains.filter((d) => d.endsWith(`.${base}`) && d !== base)
    : [];
  const dnsRecords = extractDnsRecords(safe);
  const network = extractNetworkIndicators(safe);
  const webapp = extractWebIndicators(safe);

  return {
    domains: allDomains,
    subdomains,
    emails: uniq(emails.map((e) => e.toLowerCase())),
    ips: uniq(ips),
    openPorts: phase === 'network' ? network.openPorts : [],
    services: phase === 'network' ? network.services : [],
    vulnerabilities: phase === 'network' || phase === 'webapp' ? uniq([...network.vulnerabilities, ...webapp.vulnerabilities]) : [],
    dnsRecords,
    urls: phase === 'webapp' ? webapp.urls : [],
    owaspTop10: phase === 'webapp' ? webapp.owaspTop10 : []
  };
};

const path = require('path');
const logger = require('../utils/logger'); // Assuming logger is available or needs import

const runProcess = (command, args, timeoutMs, envOverrides = {}) =>
  new Promise((resolve) => {
    const isRemote = process.env.REMOTE_SCANNER_ENABLED === 'true';
    const remoteIp = process.env.REMOTE_SCANNER_IP;
    const remoteUser = process.env.REMOTE_SCANNER_USER || 'kali';

    let finalCommand = command;
    let finalArgs = args;

    if (isRemote && remoteIp) {
      // Wrap IPv6 addresses in brackets
      let formattedIp = remoteIp;
      if (remoteIp.includes(':') && !remoteIp.startsWith('[') && !remoteIp.endsWith(']')) {
        formattedIp = `[${remoteIp}]`;
      }

      // Extract binary name for Linux if it's a Windows path
      let cleanCmd = command;
      if (command.includes('\\') || command.includes('/')) {
        cleanCmd = path.basename(command).replace('.exe', '').replace('.pl', '');
      }

      const remoteCmdStr = `${cleanCmd} ${args.join(' ')}`;
      
      // Use the logger if available, otherwise fallback
      const logMsg = `⚡ [Remote Phase] Routing to Kali [${remoteUser}@${remoteIp}]: ${remoteCmdStr}`;
      if (typeof logger !== 'undefined' && logger.info) {
        logger.info(logMsg);
      } else {
        console.log(logMsg);
      }

      finalCommand = 'ssh';
      finalArgs = [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        `${remoteUser}@${formattedIp}`,
        remoteCmdStr
      ];
    }

    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(finalCommand, finalArgs, {
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        ...envOverrides
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > MAX_OUTPUT_CHARS) stdout = stdout.slice(-MAX_OUTPUT_CHARS);
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > MAX_OUTPUT_CHARS) stderr = stderr.slice(-MAX_OUTPUT_CHARS);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        command: `${finalCommand} ${finalArgs.join(' ')}`.trim(),
        exitCode: null,
        stdout,
        stderr: stderr || err.message,
        reason: err.code === 'ENOENT' ? 'tool_not_found' : err.message,
        durationMs: Date.now() - started
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        command: `${finalCommand} ${finalArgs.join(' ')}`.trim(),
        exitCode: code,
        stdout,
        stderr,
        reason: timedOut ? 'timeout' : code === 0 ? '' : 'non_zero_exit',
        durationMs: Date.now() - started
      });
    });
  });

const buildReconNgScript = (target) => {
  const lines = [
    `options set SOURCE ${target}`
  ];

  if (TOOL_API_KEYS.reconng.RECONNG_SHODAN_API) {
    lines.push(`keys add shodan_api ${TOOL_API_KEYS.reconng.RECONNG_SHODAN_API}`);
  }
  if (TOOL_API_KEYS.reconng.RECONNG_SECURITYTRAILS_API) {
    lines.push(`keys add securitytrails_api ${TOOL_API_KEYS.reconng.RECONNG_SECURITYTRAILS_API}`);
  }
  if (TOOL_API_KEYS.reconng.RECONNG_HIBP_API) {
    lines.push(`keys add haveibeenpwned_api ${TOOL_API_KEYS.reconng.RECONNG_HIBP_API}`);
  }

  lines.push('run');
  return `${lines.join('; ')};`;
};

const buildToolSpec = (target, mode, timeoutMs, phase = 'recon') => ({
  theharvester: {
    tool: 'theharvester',
    enabled: process.env.ENABLE_THEHARVESTER !== 'false',
    command: process.env.THEHARVESTER_BIN || 'theHarvester',
    args: ['-d', target, '-b', 'all'],
    timeoutMs,
    env: TOOL_API_KEYS.theharvester
  },
  reconng: {
    tool: 'reconng',
    enabled: process.env.ENABLE_RECONNG !== 'false',
    command: process.env.RECONNG_BIN || 'recon-ng',
    args: [
      '-m',
      process.env.RECONNG_MODULE || 'recon/domains-hosts/hackertarget',
      '-x',
      buildReconNgScript(target)
    ],
    timeoutMs,
    env: TOOL_API_KEYS.reconng
  },
  spiderfoot: {
    tool: 'spiderfoot',
    enabled: process.env.ENABLE_SPIDERFOOT !== 'false',
    command: process.env.SPIDERFOOT_BIN || 'spiderfoot',
    args: mode === 'passive' ? ['-s', target, '-m', 'sfp_dnsresolve,sfp_whois'] : ['-s', target],
    timeoutMs,
    env: TOOL_API_KEYS.spiderfoot
  },
  maltego: {
    tool: 'maltego',
    enabled: process.env.ENABLE_MALTEGO === 'true', // keep false by default unless you configure CLI
    command: process.env.MALTEGO_BIN || 'maltego',
    args: process.env.MALTEGO_ARGS ? process.env.MALTEGO_ARGS.replace('{target}', target).split(' ') : [],
    timeoutMs,
    env: TOOL_API_KEYS.maltego
  },
  subfinder: {
    tool: 'subfinder',
    enabled: process.env.ENABLE_SUBFINDER !== 'false',
    command: process.env.SUBFINDER_BIN || 'subfinder',
    args: ['-d', target, '-silent', '-all'],
    timeoutMs,
    env: TOOL_API_KEYS.subfinder
  },
  amass: {
    tool: 'amass',
    enabled: process.env.ENABLE_AMASS !== 'false',
    command: process.env.AMASS_BIN || 'amass',
    args: ['enum', '-passive', '-d', target, '-nocolor'],
    timeoutMs,
    env: TOOL_API_KEYS.amass
  },
  nmap: {
    tool: 'nmap',
    enabled: process.env.ENABLE_NMAP !== 'false',
    command: process.env.NMAP_BIN || 'nmap',
    args: ['-sV', '-Pn', target],
    timeoutMs,
    env: TOOL_API_KEYS.nmap
  },
  nessus: {
    tool: 'nessus',
    enabled: process.env.ENABLE_NESSUS === 'true',
    command: process.env.NESSUS_BIN || 'nessus',
    args: process.env.NESSUS_ARGS ? process.env.NESSUS_ARGS.replace('{target}', target).split(' ') : ['scan', target],
    timeoutMs,
    env: TOOL_API_KEYS.nessus
  },
  nikto: {
    tool: 'nikto',
    enabled: process.env.ENABLE_NIKTO !== 'false',
    command: process.env.NIKTO_BIN || 'nikto',
    args: ['-h', targetToHttpUrl(target)],
    timeoutMs,
    env: TOOL_API_KEYS.nikto
  }
});

const normalizeToolList = (tools, phase = 'recon') => {
  const allowed = phase === 'network'
    ? ['nmap', 'nessus']
    : phase === 'webapp'
      ? ['nikto']
    : phase === 'subdomain'
      ? ['subfinder', 'amass']
      : ['theharvester', 'reconng', 'spiderfoot', 'maltego'];
  if (!Array.isArray(tools) || tools.length === 0) {
    return phase === 'network'
      ? ['nmap', 'nessus']
      : phase === 'webapp'
        ? ['nikto']
      : phase === 'subdomain'
        ? ['subfinder', 'amass']
        : ['theharvester', 'reconng', 'spiderfoot', 'maltego'];
  }
  return uniq(tools.map((t) => String(t).toLowerCase())).filter((t) => allowed.includes(t));
};

const severityWeight = { low: 1, medium: 3, high: 6 };

const mapIndicatorTypeToSeverity = (type) => {
  if (type === 'email') return 'high';
  if (type === 'vulnerability') return 'high';
  if (type === 'web_vulnerability') return 'high';
  if (type === 'url') return 'low';
  if (type === 'service') return 'medium';
  if (type === 'port') return 'medium';
  if (type === 'dns_record') return 'medium';
  if (type === 'ip') return 'medium';
  return 'low';
};

const normalizeFindings = (results, target) => {
  const map = new Map();

  for (const row of results) {
    const source = row.tool || 'unknown';
    const addFinding = (type, value) => {
      const cleanValue = String(value || '').trim().toLowerCase();
      if (!cleanValue) return;
      const key = `${type}:${cleanValue}:${source}`;
      if (map.has(key)) return;
      map.set(key, {
        type,
        value: cleanValue,
        source,
        severity: mapIndicatorTypeToSeverity(type),
        confidence: row.status === 'success' ? 0.9 : row.status === 'skipped' ? 0.4 : 0.6
      });
    };

    (row.indicators?.domains || []).forEach((v) => addFinding('domain', v));
    (row.indicators?.subdomains || []).forEach((v) => addFinding('subdomain', v));
    (row.indicators?.emails || []).forEach((v) => addFinding('email', v));
    (row.indicators?.ips || []).forEach((v) => addFinding('ip', v));
    (row.indicators?.openPorts || []).forEach((v) => addFinding('port', String(v)));
    (row.indicators?.services || []).forEach((v) => addFinding('service', v));
    (row.indicators?.vulnerabilities || []).forEach((v) => addFinding('vulnerability', v));
    (row.indicators?.urls || []).forEach((v) => addFinding('url', v));
    (row.indicators?.owaspTop10 || []).forEach((v) => addFinding('web_vulnerability', v));
    ['ns', 'mx', 'txt', 'cname', 'a'].forEach((k) => {
      (row.indicators?.dnsRecords?.[k] || []).forEach((v) => addFinding('dns_record', `${k}:${v}`));
    });

    if (row.status === 'failed') {
      addFinding('signal', `tool_failed:${source}`);
    }
  }

  const findings = [...map.values()].filter((f) => f.value !== target);
  return findings;
};

const computeVerdict = (findings, results) => {
  if (!Array.isArray(findings) || findings.length === 0) {
    const failedCount = (results || []).filter((r) => r.status === 'failed').length;
    if (failedCount > 0) {
      return {
        level: 'low',
        score: Math.min(25, failedCount * 10),
        hasFindings: true,
        label: 'Partial visibility: some tools failed'
      };
    }
    return {
      level: 'none',
      score: 0,
      hasFindings: false,
      label: 'No actionable findings'
    };
  }

  const weighted = findings.reduce((acc, f) => acc + (severityWeight[f.severity] || 1), 0);
  const score = Math.min(100, weighted * 4);
  const hasHigh = findings.some((f) => f.severity === 'high');

  let level = 'low';
  let label = 'Low exposure signals detected';
  if (score >= 70 || hasHigh) {
    level = 'high';
    label = 'High exposure signals detected';
  } else if (score >= 35) {
    level = 'medium';
    label = 'Moderate exposure signals detected';
  }

  return {
    level,
    score,
    hasFindings: true,
    label
  };
};

const summarizeResults = (results) => {
  const allDomains = uniq(results.flatMap((r) => (r.indicators?.domains || [])));
  const allSubdomains = uniq(results.flatMap((r) => (r.indicators?.subdomains || [])));
  const allEmails = uniq(results.flatMap((r) => (r.indicators?.emails || [])));
  const allIps = uniq(results.flatMap((r) => (r.indicators?.ips || [])));
  const allOpenPorts = uniq(results.flatMap((r) => (r.indicators?.openPorts || [])));
  const allServices = uniq(results.flatMap((r) => (r.indicators?.services || [])));
  const allVulns = uniq(results.flatMap((r) => (r.indicators?.vulnerabilities || [])));
  const allUrls = uniq(results.flatMap((r) => (r.indicators?.urls || [])));
  const allOwasp = uniq(results.flatMap((r) => (r.indicators?.owaspTop10 || [])));
  const dnsNs = uniq(results.flatMap((r) => (r.indicators?.dnsRecords?.ns || [])));
  const dnsMx = uniq(results.flatMap((r) => (r.indicators?.dnsRecords?.mx || [])));
  const dnsTxt = uniq(results.flatMap((r) => (r.indicators?.dnsRecords?.txt || [])));
  const dnsCname = uniq(results.flatMap((r) => (r.indicators?.dnsRecords?.cname || [])));
  const dnsA = uniq(results.flatMap((r) => (r.indicators?.dnsRecords?.a || [])));

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const status = successCount > 0 && failedCount === 0 ? 'completed' : successCount > 0 ? 'partial' : 'failed';

  return {
    status,
    summary: {
      domains: allDomains,
      subdomains: allSubdomains,
      emails: allEmails,
      ips: allIps,
      network: {
        openPorts: allOpenPorts,
        services: allServices,
        vulnerabilities: allVulns
      },
      webapp: {
        urls: allUrls,
        vulnerabilities: allVulns,
        owaspTop10: allOwasp
      },
      dnsRecords: {
        ns: dnsNs,
        mx: dnsMx,
        txt: dnsTxt,
        cname: dnsCname,
        a: dnsA
      }
    }
  };
};

const emitToScanRoom = (io, scanId, event, payload) => {
  if (!io || !scanId) return;
  io.to(`scan_${scanId}`).emit(event, payload);
};

const runReconScan = async ({ targetInput, tools, mode = 'passive', timeoutMs = 120000, phase = 'recon' }) => {
  const target = normalizeTarget(targetInput);

  if (!isValidDomain(target) && !isValidIp(target)) {
    throw new Error('Invalid target. Use public domain or IP (without protocol/path).');
  }

  const toolList = normalizeToolList(tools, phase);
  const specs = buildToolSpec(target, mode, timeoutMs, phase);

  const results = [];
  for (const toolName of toolList) {
    const spec = specs[toolName];
    if (!spec || !spec.enabled) {
      results.push({
        tool: toolName,
        status: 'skipped',
        command: '',
        exitCode: null,
        durationMs: 0,
        reason: 'disabled_or_not_configured',
        stdout: '',
        stderr: '',
        indicators: {
          domains: [],
          subdomains: [],
          emails: [],
          ips: [],
          openPorts: [],
          services: [],
          vulnerabilities: [],
          dnsRecords: { ns: [], mx: [], txt: [], cname: [], a: [] },
          urls: [],
          owaspTop10: []
        }
      });
      continue;
    }

    const exec = await runProcess(spec.command, spec.args, spec.timeoutMs, spec.env);
    const combined = `${exec.stdout}\n${exec.stderr}`;
    results.push({
      tool: toolName,
      status: exec.ok ? 'success' : 'failed',
      command: exec.command,
      exitCode: exec.exitCode,
      durationMs: exec.durationMs,
      reason: exec.reason || '',
      stdout: exec.stdout,
      stderr: exec.stderr,
      indicators: extractIndicators(combined, target, phase)
    });
  }

  const summaryPack = summarizeResults(results);
  const findings = normalizeFindings(results, target);
  const verdict = computeVerdict(findings, results);

  return {
    target,
    phase,
    mode,
    status: summaryPack.status,
    toolsRequested: toolList,
    toolsRun: results.filter((r) => r.status !== 'skipped').map((r) => r.tool),
    toolResults: results,
    summary: summaryPack.summary,
    findings,
    verdict
  };
};

const runReconScanWorker = async ({
  scanId,
  userId,
  targetInput,
  tools,
  mode = 'passive',
  phase = 'recon',
  timeoutMs = 120000,
  io
}) => {
  try {
    const startedAt = new Date();
    const target = normalizeTarget(targetInput);

    if (!isValidDomain(target) && !isValidIp(target)) {
      const reason = 'Invalid target. Use public domain or IP (without protocol/path).';
      await ReconScan.findOneAndUpdate(
        { _id: scanId, user_id: userId },
        { status: 'failed', finishedAt: new Date() },
        { new: true }
      );
      throw new Error(reason);
    }

    const toolList = normalizeToolList(tools, phase);
    const specs = buildToolSpec(target, mode, timeoutMs, phase);
    const results = [];

    await ReconScan.findOneAndUpdate(
      { _id: scanId, user_id: userId },
      { status: 'running', target, phase, mode, toolsRequested: toolList, startedAt },
      { new: true }
    );

    emitToScanRoom(io, scanId, 'recon:started', {
      scanId,
      target,
      phase,
      mode,
      toolsRequested: toolList,
      startedAt
    });

    for (let i = 0; i < toolList.length; i += 1) {
      const toolName = toolList[i];
      const spec = specs[toolName];

      emitToScanRoom(io, scanId, 'recon:tool_update', {
        scanId,
        tool: toolName,
        status: 'running',
        progress: { completed: i, total: toolList.length }
      });

      if (!spec || !spec.enabled) {
        const skippedResult = {
          tool: toolName,
          status: 'skipped',
          command: '',
          exitCode: null,
          durationMs: 0,
          reason: 'disabled_or_not_configured',
          stdout: '',
          stderr: '',
          indicators: {
            domains: [],
            subdomains: [],
            emails: [],
            ips: [],
            openPorts: [],
            services: [],
            vulnerabilities: [],
            dnsRecords: { ns: [], mx: [], txt: [], cname: [], a: [] },
            urls: [],
            owaspTop10: []
          }
        };

        results.push(skippedResult);

        await ReconScan.findOneAndUpdate(
          { _id: scanId, user_id: userId },
          { toolResults: results, toolsRun: results.filter((r) => r.status !== 'skipped').map((r) => r.tool) },
          { new: true }
        );

        emitToScanRoom(io, scanId, 'recon:tool_update', {
          scanId,
          tool: toolName,
          status: 'skipped',
          result: skippedResult,
          progress: { completed: i + 1, total: toolList.length }
        });
        continue;
      }

      const exec = await runProcess(spec.command, spec.args, spec.timeoutMs, spec.env);
      const combined = `${exec.stdout}\n${exec.stderr}`;
      const toolResult = {
        tool: toolName,
        status: exec.ok ? 'success' : 'failed',
        command: exec.command,
        exitCode: exec.exitCode,
        durationMs: exec.durationMs,
        reason: exec.reason || '',
        stdout: exec.stdout,
        stderr: exec.stderr,
        indicators: extractIndicators(combined, target, phase)
      };

      results.push(toolResult);

      const interimPack = summarizeResults(results);
      const interimFindings = normalizeFindings(results, target);
      const interimVerdict = computeVerdict(interimFindings, results);
      await ReconScan.findOneAndUpdate(
        { _id: scanId, user_id: userId },
        {
          toolResults: results,
          toolsRun: results.filter((r) => r.status !== 'skipped').map((r) => r.tool),
          summary: interimPack.summary,
          findings: interimFindings,
          verdict: interimVerdict
        },
        { new: true }
      );

      emitToScanRoom(io, scanId, 'recon:tool_update', {
        scanId,
        tool: toolName,
        status: toolResult.status,
        result: toolResult,
        progress: { completed: i + 1, total: toolList.length }
      });
    }

    const finalPack = summarizeResults(results);
    const finalFindings = normalizeFindings(results, target);
    const finalVerdict = computeVerdict(finalFindings, results);
    const finishedAt = new Date();

    const saved = await ReconScan.findOneAndUpdate(
      { _id: scanId, user_id: userId },
      {
        status: finalPack.status,
        toolResults: results,
        toolsRun: results.filter((r) => r.status !== 'skipped').map((r) => r.tool),
        summary: finalPack.summary,
        findings: finalFindings,
        verdict: finalVerdict,
        finishedAt
      },
      { new: true }
    );

    emitToScanRoom(io, scanId, 'recon:completed', {
      scanId,
      status: finalPack.status,
      finishedAt,
      scan: saved
    });

    return saved;
  } catch (err) {
    await ReconScan.findOneAndUpdate(
      { _id: scanId, user_id: userId },
      { status: 'failed', finishedAt: new Date() },
      { new: true }
    );
    emitToScanRoom(io, scanId, 'recon:failed', { scanId, reason: err.message || 'Unknown worker error' });
    throw err;
  }
};

module.exports = {
  runReconScan,
  runReconScanWorker,
  normalizeToolList,
  normalizeTarget
};
