/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Built-in Security Scanners          ║
 * ║   Pure Node.js — no external tools needed    ║
 * ║   Works on Windows/Linux/Mac                 ║
 * ╚══════════════════════════════════════════════╝
 */

const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');
const axios = require('axios');
const logger = require('../utils/logger');

/* ══════════════════════════════════════════════
   1. DNS RESOLUTION — Domain → IP + Records
   ══════════════════════════════════════════════ */
const resolveDNS = async (target) => {
  const results = {
    tool: 'dns_resolver',
    status: 'success',
    ip: null,
    ipv6: [],
    aRecords: [],
    aaaaRecords: [],
    mxRecords: [],
    nsRecords: [],
    txtRecords: [],
    cnameRecords: [],
    soaRecord: null,
  };

  try {
    // A records
    try {
      results.aRecords = await dns.resolve4(target);
      results.ip = results.aRecords[0] || null;
    } catch { /* no A records */ }

    // AAAA records
    try {
      results.aaaaRecords = await dns.resolve6(target);
      results.ipv6 = results.aaaaRecords;
    } catch { /* */ }

    // MX records
    try {
      const mx = await dns.resolveMx(target);
      results.mxRecords = mx.map(r => ({ priority: r.priority, exchange: r.exchange }));
    } catch { /* */ }

    // NS records
    try {
      results.nsRecords = await dns.resolveNs(target);
    } catch { /* */ }

    // TXT records
    try {
      const txt = await dns.resolveTxt(target);
      results.txtRecords = txt.map(r => r.join(' '));
    } catch { /* */ }

    // CNAME records
    try {
      results.cnameRecords = await dns.resolveCname(target);
    } catch { /* */ }

    // SOA record
    try {
      results.soaRecord = await dns.resolveSoa(target);
    } catch { /* */ }

    if (!results.ip && results.aRecords.length === 0) {
      // Fallback: try lookup
      try {
        const lookupResult = await dns.lookup(target);
        results.ip = lookupResult.address;
        results.aRecords = [lookupResult.address];
      } catch { /* */ }
    }

  } catch (err) {
    results.status = 'partial';
    results.error = err.message;
  }

  return results;
};

/* ══════════════════════════════════════════════
   2. HTTP SECURITY HEADERS CHECK
   ══════════════════════════════════════════════ */
const checkSecurityHeaders = async (target) => {
  const url = target.startsWith('http') ? target : `https://${target}`;
  const result = {
    tool: 'http_headers_check',
    status: 'success',
    url,
    headers: {},
    securityScore: 0,
    findings: [],
    grade: 'F',
  };

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': 'PAIA-SecurityScanner/1.0' },
    });

    result.statusCode = response.status;
    result.headers = response.headers;
    result.serverHeader = response.headers['server'] || 'Not disclosed';
    result.poweredBy = response.headers['x-powered-by'] || 'Not disclosed';

    let score = 0;
    const maxScore = 100;

    // Check critical security headers
    const headerChecks = [
      {
        header: 'strict-transport-security',
        name: 'HSTS (HTTP Strict Transport Security)',
        weight: 15,
        severity: 'high',
        remediation: 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains',
      },
      {
        header: 'content-security-policy',
        name: 'CSP (Content Security Policy)',
        weight: 15,
        severity: 'high',
        remediation: "Add header: Content-Security-Policy: default-src 'self'",
      },
      {
        header: 'x-frame-options',
        name: 'X-Frame-Options (Clickjacking Protection)',
        weight: 10,
        severity: 'medium',
        remediation: 'Add header: X-Frame-Options: DENY or SAMEORIGIN',
      },
      {
        header: 'x-content-type-options',
        name: 'X-Content-Type-Options (MIME Sniffing)',
        weight: 10,
        severity: 'medium',
        remediation: 'Add header: X-Content-Type-Options: nosniff',
      },
      {
        header: 'x-xss-protection',
        name: 'X-XSS-Protection',
        weight: 5,
        severity: 'low',
        remediation: 'Add header: X-XSS-Protection: 1; mode=block',
      },
      {
        header: 'referrer-policy',
        name: 'Referrer-Policy',
        weight: 10,
        severity: 'medium',
        remediation: 'Add header: Referrer-Policy: strict-origin-when-cross-origin',
      },
      {
        header: 'permissions-policy',
        name: 'Permissions-Policy (Feature Policy)',
        weight: 10,
        severity: 'medium',
        remediation: 'Add header: Permissions-Policy: camera=(), microphone=(), geolocation=()',
      },
      {
        header: 'x-permitted-cross-domain-policies',
        name: 'X-Permitted-Cross-Domain-Policies',
        weight: 5,
        severity: 'low',
        remediation: 'Add header: X-Permitted-Cross-Domain-Policies: none',
      },
      {
        header: 'cross-origin-embedder-policy',
        name: 'COEP (Cross-Origin Embedder Policy)',
        weight: 5,
        severity: 'low',
        remediation: 'Add header: Cross-Origin-Embedder-Policy: require-corp',
      },
      {
        header: 'cross-origin-opener-policy',
        name: 'COOP (Cross-Origin Opener Policy)',
        weight: 5,
        severity: 'low',
        remediation: 'Add header: Cross-Origin-Opener-Policy: same-origin',
      },
      {
        header: 'cross-origin-resource-policy',
        name: 'CORP (Cross-Origin Resource Policy)',
        weight: 5,
        severity: 'low',
        remediation: 'Add header: Cross-Origin-Resource-Policy: same-origin',
      },
    ];

    for (const check of headerChecks) {
      const value = response.headers[check.header];
      if (value) {
        score += check.weight;
      } else {
        result.findings.push({
          title: `Missing ${check.name}`,
          type: 'missing_header',
          severity: check.severity,
          description: `The ${check.name} header is not set. This may expose the application to ${check.name.toLowerCase()} attacks.`,
          evidence: `Header "${check.header}" not found in response`,
          remediation: check.remediation,
          tool: 'http_headers_check',
        });
      }
    }

    // Check for information disclosure
    if (response.headers['server'] && response.headers['server'] !== '') {
      const server = response.headers['server'];
      // Check if version is disclosed
      if (/\d+\.\d+/.test(server)) {
        result.findings.push({
          title: 'Server Version Disclosure',
          type: 'information_disclosure',
          severity: 'low',
          description: `Server header reveals version information: "${server}". Attackers can use this to find known vulnerabilities.`,
          evidence: `Server: ${server}`,
          remediation: 'Remove version information from Server header',
          tool: 'http_headers_check',
        });
      }
    }

    if (response.headers['x-powered-by']) {
      result.findings.push({
        title: 'X-Powered-By Header Disclosure',
        type: 'information_disclosure',
        severity: 'low',
        description: `X-Powered-By header reveals technology: "${response.headers['x-powered-by']}"`,
        evidence: `X-Powered-By: ${response.headers['x-powered-by']}`,
        remediation: 'Remove X-Powered-By header from responses',
        tool: 'http_headers_check',
      });
    }

    // Cookie security check
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const cookie of cookies) {
        if (!cookie.toLowerCase().includes('httponly')) {
          result.findings.push({
            title: 'Cookie Missing HttpOnly Flag',
            type: 'cookie_security',
            severity: 'medium',
            description: 'A cookie is set without the HttpOnly flag, making it accessible via JavaScript',
            evidence: `Set-Cookie: ${cookie.slice(0, 100)}...`,
            remediation: 'Add HttpOnly flag to all sensitive cookies',
            tool: 'http_headers_check',
          });
        }
        if (!cookie.toLowerCase().includes('secure')) {
          result.findings.push({
            title: 'Cookie Missing Secure Flag',
            type: 'cookie_security',
            severity: 'medium',
            description: 'A cookie is set without the Secure flag, allowing it to be sent over HTTP',
            evidence: `Set-Cookie: ${cookie.slice(0, 100)}...`,
            remediation: 'Add Secure flag to all cookies',
            tool: 'http_headers_check',
          });
        }
        if (!cookie.toLowerCase().includes('samesite')) {
          result.findings.push({
            title: 'Cookie Missing SameSite Attribute',
            type: 'cookie_security',
            severity: 'low',
            description: 'A cookie is set without SameSite attribute, potentially vulnerable to CSRF',
            evidence: `Set-Cookie: ${cookie.slice(0, 100)}...`,
            remediation: 'Add SameSite=Strict or SameSite=Lax to cookies',
            tool: 'http_headers_check',
          });
        }
      }
    }

    result.securityScore = Math.round((score / maxScore) * 100);
    result.grade =
      result.securityScore >= 90 ? 'A+' :
      result.securityScore >= 80 ? 'A' :
      result.securityScore >= 70 ? 'B' :
      result.securityScore >= 60 ? 'C' :
      result.securityScore >= 50 ? 'D' : 'F';

  } catch (err) {
    result.status = 'failed';
    result.error = err.message;

    // Try HTTP if HTTPS failed
    if (url.startsWith('https://')) {
      try {
        const httpUrl = url.replace('https://', 'http://');
        const httpRes = await axios.get(httpUrl, {
          timeout: 10000,
          maxRedirects: 5,
          validateStatus: () => true,
          headers: { 'User-Agent': 'PAIA-SecurityScanner/1.0' },
        });
        result.status = 'partial';
        result.note = 'HTTPS failed, fell back to HTTP — this itself is a vulnerability';
        result.statusCode = httpRes.status;
        result.headers = httpRes.headers;
        result.findings.push({
          title: 'HTTPS Not Available or Misconfigured',
          type: 'ssl_tls',
          severity: 'high',
          description: 'The target does not properly support HTTPS. All traffic is sent unencrypted.',
          evidence: `HTTPS connection to ${target} failed: ${err.message}`,
          remediation: 'Install a valid SSL/TLS certificate (e.g., free via Let\'s Encrypt)',
          tool: 'http_headers_check',
        });
      } catch { /* both failed */ }
    }
  }

  return result;
};

/* ══════════════════════════════════════════════
   3. SSL/TLS CERTIFICATE ANALYSIS
   ══════════════════════════════════════════════ */
const checkSSL = async (target) => {
  const hostname = target.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const result = {
    tool: 'ssl_check',
    status: 'success',
    hostname,
    certificate: null,
    findings: [],
  };

  return new Promise((resolve) => {
    const options = {
      hostname,
      port: 443,
      method: 'GET',
      path: '/',
      rejectUnauthorized: false,
      timeout: 10000,
      headers: { 'User-Agent': 'PAIA-SecurityScanner/1.0' },
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate(true);

      if (cert && Object.keys(cert).length > 0) {
        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
        const isExpired = now > validTo;
        const isNotYetValid = now < validFrom;

        result.certificate = {
          subject: cert.subject || {},
          issuer: cert.issuer || {},
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysUntilExpiry,
          isExpired,
          isNotYetValid,
          serialNumber: cert.serialNumber || '',
          fingerprint: cert.fingerprint || '',
          fingerprint256: cert.fingerprint256 || '',
          subjectAltNames: cert.subjectaltname || '',
          protocol: res.socket.getProtocol ? res.socket.getProtocol() : 'unknown',
          cipher: res.socket.getCipher ? res.socket.getCipher() : {},
          authorized: res.socket.authorized,
          authorizationError: res.socket.authorizationError || '',
        };

        // Check for vulnerabilities
        if (isExpired) {
          result.findings.push({
            title: 'SSL Certificate Expired',
            type: 'ssl_tls',
            severity: 'critical',
            cvss: 7.5,
            description: `SSL certificate expired on ${cert.valid_to}. Browsers will show security warnings.`,
            evidence: `Valid To: ${cert.valid_to}, Days past expiry: ${Math.abs(daysUntilExpiry)}`,
            remediation: 'Renew the SSL certificate immediately',
            tool: 'ssl_check',
          });
        } else if (daysUntilExpiry < 30) {
          result.findings.push({
            title: 'SSL Certificate Expiring Soon',
            type: 'ssl_tls',
            severity: 'medium',
            cvss: 4.0,
            description: `SSL certificate expires in ${daysUntilExpiry} days (${cert.valid_to})`,
            evidence: `Valid To: ${cert.valid_to}, Days remaining: ${daysUntilExpiry}`,
            remediation: 'Renew the SSL certificate before expiry',
            tool: 'ssl_check',
          });
        }

        if (!res.socket.authorized) {
          result.findings.push({
            title: 'SSL Certificate Not Trusted',
            type: 'ssl_tls',
            severity: 'high',
            cvss: 5.9,
            description: `SSL certificate is not trusted: ${res.socket.authorizationError || 'Unknown reason'}`,
            evidence: `Authorization Error: ${res.socket.authorizationError || 'Certificate chain validation failed'}`,
            remediation: 'Use a certificate from a trusted Certificate Authority',
            tool: 'ssl_check',
          });
        }

        // Check for self-signed
        const issuerCN = cert.issuer?.CN || '';
        const subjectCN = cert.subject?.CN || '';
        if (issuerCN === subjectCN && !issuerCN.includes('Let\'s Encrypt') && !issuerCN.includes('DigiCert')) {
          result.findings.push({
            title: 'Self-Signed SSL Certificate Detected',
            type: 'ssl_tls',
            severity: 'medium',
            cvss: 4.3,
            description: 'The SSL certificate appears to be self-signed, not from a trusted CA',
            evidence: `Issuer CN: ${issuerCN}, Subject CN: ${subjectCN}`,
            remediation: 'Use a certificate from a trusted CA like Let\'s Encrypt (free)',
            tool: 'ssl_check',
          });
        }

        // Check weak protocol
        const protocol = res.socket.getProtocol ? res.socket.getProtocol() : '';
        if (protocol && (protocol === 'TLSv1' || protocol === 'TLSv1.1' || protocol === 'SSLv3')) {
          result.findings.push({
            title: `Weak TLS Protocol: ${protocol}`,
            type: 'ssl_tls',
            severity: 'high',
            cvss: 5.9,
            description: `Server supports deprecated protocol ${protocol} which has known vulnerabilities`,
            evidence: `Protocol: ${protocol}`,
            remediation: 'Disable TLSv1.0, TLSv1.1, and SSLv3. Use TLSv1.2 or TLSv1.3 only',
            tool: 'ssl_check',
          });
        }

      } else {
        result.status = 'partial';
        result.findings.push({
          title: 'No SSL Certificate Found',
          type: 'ssl_tls',
          severity: 'high',
          cvss: 5.9,
          description: 'No SSL/TLS certificate was returned by the server',
          evidence: 'Empty certificate object',
          remediation: 'Install a valid SSL/TLS certificate',
          tool: 'ssl_check',
        });
      }

      resolve(result);
    });

    req.on('error', (err) => {
      result.status = 'failed';
      result.error = err.message;
      result.findings.push({
        title: 'SSL/TLS Connection Failed',
        type: 'ssl_tls',
        severity: 'high',
        cvss: 5.9,
        description: `Could not establish SSL/TLS connection: ${err.message}`,
        evidence: `Error: ${err.message}`,
        remediation: 'Ensure SSL/TLS is properly configured on port 443',
        tool: 'ssl_check',
      });
      resolve(result);
    });

    req.on('timeout', () => {
      req.destroy();
      result.status = 'failed';
      result.error = 'Connection timed out';
      resolve(result);
    });

    req.end();
  });
};

/* ══════════════════════════════════════════════
   4. PORT SCANNER (Top 20 Common Ports)
   ══════════════════════════════════════════════ */
const scanPorts = async (target) => {
  const ip = target.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const commonPorts = [
    { port: 21, service: 'FTP' },
    { port: 22, service: 'SSH' },
    { port: 23, service: 'Telnet' },
    { port: 25, service: 'SMTP' },
    { port: 53, service: 'DNS' },
    { port: 80, service: 'HTTP' },
    { port: 110, service: 'POP3' },
    { port: 143, service: 'IMAP' },
    { port: 443, service: 'HTTPS' },
    { port: 445, service: 'SMB' },
    { port: 993, service: 'IMAPS' },
    { port: 995, service: 'POP3S' },
    { port: 1433, service: 'MSSQL' },
    { port: 3306, service: 'MySQL' },
    { port: 3389, service: 'RDP' },
    { port: 5432, service: 'PostgreSQL' },
    { port: 5900, service: 'VNC' },
    { port: 6379, service: 'Redis' },
    { port: 8080, service: 'HTTP-Alt' },
    { port: 8443, service: 'HTTPS-Alt' },
    { port: 27017, service: 'MongoDB' },
  ];

  const result = {
    tool: 'port_scanner',
    status: 'success',
    target: ip,
    openPorts: [],
    closedPorts: [],
    findings: [],
    totalScanned: commonPorts.length,
  };

  // Resolve domain to IP first
  let resolvedIp = ip;
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    try {
      const lookup = await dns.lookup(ip);
      resolvedIp = lookup.address;
      result.resolvedIp = resolvedIp;
    } catch {
      result.status = 'failed';
      result.error = `Could not resolve ${ip}`;
      return result;
    }
  }

  const checkPort = (host, port, timeout = 3000) =>
    new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        resolved = true;
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        if (!resolved) { resolved = true; socket.destroy(); resolve(false); }
      });

      socket.on('error', () => {
        if (!resolved) { resolved = true; socket.destroy(); resolve(false); }
      });

      socket.connect(port, host);
    });

  // Scan ports in parallel (batches of 5 to avoid overwhelming)
  const batchSize = 5;
  for (let i = 0; i < commonPorts.length; i += batchSize) {
    const batch = commonPorts.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async ({ port, service }) => {
        const isOpen = await checkPort(resolvedIp, port, 3000);
        return { port, service, isOpen };
      })
    );

    for (const r of results) {
      if (r.isOpen) {
        result.openPorts.push({ port: r.port, service: r.service });
      } else {
        result.closedPorts.push(r.port);
      }
    }
  }

  // Generate findings for concerning open ports
  const dangerousPorts = {
    21: { severity: 'medium', desc: 'FTP service exposed — often has weak authentication' },
    23: { severity: 'high', desc: 'Telnet exposed — sends credentials in plaintext' },
    445: { severity: 'high', desc: 'SMB exposed — vulnerable to EternalBlue and similar exploits' },
    3306: { severity: 'high', desc: 'MySQL directly exposed — database should not be publicly accessible' },
    3389: { severity: 'high', desc: 'RDP exposed — target for brute-force and BlueKeep attacks' },
    5432: { severity: 'high', desc: 'PostgreSQL directly exposed — database should not be publicly accessible' },
    5900: { severity: 'high', desc: 'VNC exposed — often has weak authentication' },
    6379: { severity: 'critical', desc: 'Redis exposed — typically has no authentication by default' },
    27017: { severity: 'critical', desc: 'MongoDB directly exposed — often has no authentication' },
    1433: { severity: 'high', desc: 'MSSQL directly exposed — database should not be publicly accessible' },
  };

  for (const openPort of result.openPorts) {
    const danger = dangerousPorts[openPort.port];
    if (danger) {
      result.findings.push({
        title: `${openPort.service} (Port ${openPort.port}) Exposed`,
        type: 'network_exposure',
        severity: danger.severity,
        cvss: danger.severity === 'critical' ? 9.1 : danger.severity === 'high' ? 7.5 : 5.3,
        description: danger.desc,
        evidence: `Port ${openPort.port} (${openPort.service}) is open on ${resolvedIp}`,
        remediation: `Restrict access to port ${openPort.port} using firewall rules. Only allow trusted IPs.`,
        tool: 'port_scanner',
      });
    }
  }

  return result;
};

/* ══════════════════════════════════════════════
   5. SUBDOMAIN ENUMERATION (via crt.sh API)
   ══════════════════════════════════════════════ */
const enumerateSubdomains = async (target) => {
  const domain = target.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const result = {
    tool: 'subdomain_enum',
    status: 'success',
    domain,
    subdomains: [],
    totalFound: 0,
    sources: [],
  };

  // Source 1: crt.sh (Certificate Transparency)
  try {
    const crtRes = await axios.get(`https://crt.sh/?q=%.${domain}&output=json`, {
      timeout: 15000,
      headers: { 'User-Agent': 'PAIA-SecurityScanner/1.0' },
    });

    if (Array.isArray(crtRes.data)) {
      const subs = new Set();
      for (const entry of crtRes.data) {
        const name = (entry.name_value || '').toLowerCase();
        name.split('\n').forEach(n => {
          const cleaned = n.trim().replace(/^\*\./, '');
          if (cleaned.endsWith(`.${domain}`) && cleaned !== domain) {
            subs.add(cleaned);
          }
        });
      }
      result.subdomains = [...subs];
      result.sources.push('crt.sh');
    }
  } catch (err) {
    logger.warn(`crt.sh subdomain enum failed: ${err.message}`);
  }

  // Source 2: HackerTarget
  try {
    const htRes = await axios.get(`https://api.hackertarget.com/hostsearch/?q=${domain}`, {
      timeout: 10000,
    });

    if (htRes.data && typeof htRes.data === 'string' && !htRes.data.includes('error')) {
      const lines = htRes.data.split('\n');
      for (const line of lines) {
        const sub = line.split(',')[0]?.trim().toLowerCase();
        if (sub && sub.endsWith(`.${domain}`) && sub !== domain && !result.subdomains.includes(sub)) {
          result.subdomains.push(sub);
        }
      }
      result.sources.push('hackertarget');
    }
  } catch (err) {
    logger.warn(`HackerTarget subdomain enum failed: ${err.message}`);
  }

  result.totalFound = result.subdomains.length;
  return result;
};

/* ══════════════════════════════════════════════
   6. ROBOTS.TXT & SITEMAP ANALYSIS
   ══════════════════════════════════════════════ */
const checkRobotsSitemap = async (target) => {
  const baseUrl = target.startsWith('http') ? target : `https://${target}`;
  const result = {
    tool: 'robots_sitemap',
    status: 'success',
    robotsTxt: null,
    sitemapXml: null,
    findings: [],
    disallowedPaths: [],
    sitemapUrls: [],
  };

  // Check robots.txt
  try {
    const robotsRes = await axios.get(`${baseUrl}/robots.txt`, {
      timeout: 10000,
      validateStatus: () => true,
      headers: { 'User-Agent': 'PAIA-SecurityScanner/1.0' },
    });

    if (robotsRes.status === 200 && robotsRes.data) {
      result.robotsTxt = typeof robotsRes.data === 'string' ? robotsRes.data.slice(0, 5000) : '';
      // Extract disallowed paths
      const lines = result.robotsTxt.split('\n');
      for (const line of lines) {
        const match = line.match(/^Disallow:\s*(.+)/i);
        if (match && match[1].trim()) {
          result.disallowedPaths.push(match[1].trim());
        }
        const sitemapMatch = line.match(/^Sitemap:\s*(.+)/i);
        if (sitemapMatch) {
          result.sitemapUrls.push(sitemapMatch[1].trim());
        }
      }

      // Check for sensitive paths in disallow
      const sensitivePaths = ['/admin', '/wp-admin', '/api', '/private', '/backup',
        '/db', '/database', '/config', '/debug', '/test', '/staging', '/dev',
        '/.env', '/.git', '/phpinfo', '/phpmyadmin', '/wp-login', '/server-status'];

      for (const path of result.disallowedPaths) {
        const lower = path.toLowerCase();
        if (sensitivePaths.some(s => lower.includes(s))) {
          result.findings.push({
            title: `Sensitive Path Revealed in robots.txt: ${path}`,
            type: 'information_disclosure',
            severity: 'medium',
            description: `The robots.txt file reveals a potentially sensitive path: ${path}. Attackers can use this information.`,
            evidence: `Disallow: ${path}`,
            remediation: 'Consider removing sensitive paths from robots.txt. Use authentication instead of obscurity.',
            tool: 'robots_sitemap',
          });
        }
      }
    }
  } catch { /* robots.txt not accessible */ }

  // Check sitemap.xml
  try {
    const sitemapUrl = result.sitemapUrls[0] || `${baseUrl}/sitemap.xml`;
    const sitemapRes = await axios.get(sitemapUrl, {
      timeout: 10000,
      validateStatus: () => true,
      headers: { 'User-Agent': 'PAIA-SecurityScanner/1.0' },
    });

    if (sitemapRes.status === 200) {
      result.sitemapXml = 'Found';
      // Count URLs (rough)
      const urlMatches = (typeof sitemapRes.data === 'string' ? sitemapRes.data : '').match(/<loc>/gi);
      if (urlMatches) {
        result.sitemapUrlCount = urlMatches.length;
      }
    }
  } catch { /* */ }

  return result;
};

/* ══════════════════════════════════════════════
   7. TECHNOLOGY DETECTION
   ══════════════════════════════════════════════ */
const detectTechnology = async (target) => {
  const url = target.startsWith('http') ? target : `https://${target}`;
  const result = {
    tool: 'tech_detector',
    status: 'success',
    technologies: [],
    findings: [],
  };

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': 'PAIA-SecurityScanner/1.0' },
    });

    const headers = response.headers;
    const body = typeof response.data === 'string' ? response.data.slice(0, 50000) : '';

    // Server detection
    if (headers['server']) {
      result.technologies.push({ category: 'Web Server', name: headers['server'] });
    }

    // Framework/CMS detection from headers
    if (headers['x-powered-by']) {
      result.technologies.push({ category: 'Framework', name: headers['x-powered-by'] });
    }

    // Body-based detection
    const bodyChecks = [
      { pattern: /wp-content|wp-includes|wordpress/i, name: 'WordPress', category: 'CMS' },
      { pattern: /joomla/i, name: 'Joomla', category: 'CMS' },
      { pattern: /drupal/i, name: 'Drupal', category: 'CMS' },
      { pattern: /shopify/i, name: 'Shopify', category: 'E-Commerce' },
      { pattern: /next\.js|__next/i, name: 'Next.js', category: 'Framework' },
      { pattern: /react|_reactRoot/i, name: 'React', category: 'Framework' },
      { pattern: /angular|ng-app|ng-controller/i, name: 'Angular', category: 'Framework' },
      { pattern: /vue\.js|v-bind|v-model/i, name: 'Vue.js', category: 'Framework' },
      { pattern: /jquery/i, name: 'jQuery', category: 'Library' },
      { pattern: /bootstrap/i, name: 'Bootstrap', category: 'CSS Framework' },
      { pattern: /tailwindcss|tailwind/i, name: 'Tailwind CSS', category: 'CSS Framework' },
      { pattern: /cloudflare/i, name: 'Cloudflare', category: 'CDN' },
      { pattern: /google-analytics|gtag|ga\.js/i, name: 'Google Analytics', category: 'Analytics' },
      { pattern: /laravel/i, name: 'Laravel', category: 'Framework' },
      { pattern: /django/i, name: 'Django', category: 'Framework' },
      { pattern: /express/i, name: 'Express.js', category: 'Framework' },
      { pattern: /php/i, name: 'PHP', category: 'Language' },
      { pattern: /asp\.net|__viewstate/i, name: 'ASP.NET', category: 'Framework' },
    ];

    for (const check of bodyChecks) {
      if (check.pattern.test(body) || check.pattern.test(JSON.stringify(headers))) {
        if (!result.technologies.find(t => t.name === check.name)) {
          result.technologies.push({ category: check.category, name: check.name });
        }
      }
    }

    // Check for outdated libraries in HTML
    const versionPatches = body.match(/(?:jquery|bootstrap|angular|react|vue)[\/\-](\d+\.\d+\.\d+)/gi);
    if (versionPatches) {
      for (const match of versionPatches.slice(0, 5)) {
        result.technologies.push({ category: 'Versioned Library', name: match });
      }
    }

  } catch (err) {
    result.status = 'failed';
    result.error = err.message;
  }

  return result;
};

/* ══════════════════════════════════════════════
   RUN ALL BUILT-IN SCANS
   ══════════════════════════════════════════════ */
const runAllBuiltinScans = async (target) => {
  logger.info(`Built-in scanner: starting all scans for ${target}`);

  const [dnsResult, headersResult, sslResult, portResult, subdomainResult, robotsResult, techResult] =
    await Promise.allSettled([
      resolveDNS(target),
      checkSecurityHeaders(target),
      checkSSL(target),
      scanPorts(target),
      enumerateSubdomains(target),
      checkRobotsSitemap(target),
      detectTechnology(target),
    ]);

  const extractResult = (settled) =>
    settled.status === 'fulfilled' ? settled.value : { status: 'failed', error: settled.reason?.message || 'Unknown' };

  const results = {
    dns: extractResult(dnsResult),
    httpHeaders: extractResult(headersResult),
    ssl: extractResult(sslResult),
    ports: extractResult(portResult),
    subdomains: extractResult(subdomainResult),
    robotsSitemap: extractResult(robotsResult),
    technology: extractResult(techResult),
  };

  // Collect all findings
  const allFindings = [];
  for (const key of Object.keys(results)) {
    if (results[key].findings) {
      allFindings.push(...results[key].findings);
    }
  }

  logger.info(`Built-in scanner: completed for ${target}, ${allFindings.length} findings`);

  return {
    tool: 'builtin_scanner',
    status: 'success',
    results,
    findings: allFindings,
    resolvedIp: results.dns?.ip || null,
  };
};

module.exports = {
  resolveDNS,
  checkSecurityHeaders,
  checkSSL,
  scanPorts,
  enumerateSubdomains,
  checkRobotsSitemap,
  detectTechnology,
  runAllBuiltinScans,
};
