import subprocess
import json
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def run_tool(cmd):
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
        stdout, stderr = process.communicate()
        return stdout.decode('utf-8'), stderr.decode('utf-8')
    except Exception as e:
        return "", str(e)

@app.route('/nmap', methods=['POST'])
def nmap_scan():
    target = request.json.get('target')
    if not target:
        return jsonify({"error": "No target provided"}), 400
    
    # Run a basic service scan
    stdout, stderr = run_tool(f"nmap -sV -Pn --top-ports 100 {target}")
    
    # Simple Parser for Nmap
    ports = []
    # Match lines like: 80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
    matches = re.finditer(r"(\d+)/(tcp|udp)\s+(\w+)\s+(\w+)\s+(.*)", stdout)
    for m in matches:
        ports.append({
            "port": m.group(1),
            "protocol": m.group(2),
            "state": m.group(3),
            "service": m.group(4),
            "version": m.group(5).strip()
        })

    return jsonify({
        "tool": "nmap",
        "target": target,
        "ports": ports,
        "raw": stdout if not ports else "Parsed Successfully"
    })

@app.route('/subfinder', methods=['POST'])
def subfinder_scan():
    target = request.json.get('target')
    if not target:
        return jsonify({"error": "No target provided"}), 400
    
    stdout, stderr = run_tool(f"subfinder -d {target} -silent")
    
    subdomains = [s.strip() for s in stdout.split('\n') if s.strip()]
    
    return jsonify({
        "tool": "subfinder",
        "target": target,
        "subdomains": subdomains,
        "count": len(subdomains)
    })

@app.route('/nikto', methods=['POST'])
def nikto_scan():
    target = request.json.get('target')
    if not target:
        return jsonify({"error": "No target provided"}), 400
    
    # Nikto can take a while, maybe run with -nointeractive
    stdout, stderr = run_tool(f"nikto -h {target} -nointeractive")
    
    findings = []
    for line in stdout.split('\n'):
        if line.startswith('+'):
            findings.append(line[1:].strip())

    return jsonify({
        "tool": "nikto",
        "target": target,
        "findings": findings,
        "raw": stdout if not findings else "Parsed Successfully"
    })

@app.route('/recon', methods=['POST'])
def recon_scan():
    target = request.json.get('target')
    if not target:
        return jsonify({"error": "No target provided"}), 400
    
    results = {
        "emails": set(),
        "subdomains": set(),
        "ips": set()
    }

    # 1. Run theHarvester
    # -b all: Use all search engines
    logger_msg = f"Running theHarvester for {target}..."
    print(logger_msg)
    h_stdout, h_stderr = run_tool(f"theHarvester -d {target} -b all")
    
    # Simple regex parsing for theharvester
    # Emails
    emails = re.findall(r"[a-z0-9\.\-+_]+@[a-z0-9\.\-+_]+\.[a-z]+", h_stdout, re.I)
    results["emails"].update(emails)
    
    # Subdomains (look for lines that look like domains)
    # TheHarvester usually lists hosts under a specific section
    hosts = re.findall(r"([a-z0-9]+[\-a-z0-9]*\." + re.escape(target) + ")", h_stdout, re.I)
    results["subdomains"].update(hosts)

    # 2. Run SpiderFoot (No limit, wait for completion)
    print(f"Running SpiderFoot for {target}...")
    # Using spiderfoot CLI directly. -o json outputs to file or stdout depending on version.
    # We'll use -m (modules) to focus on common OSINT if possible, 
    # but user said "no limit", so we'll run a standard full scan if CLI supports it.
    sf_stdout, sf_stderr = run_tool(f"spiderfoot -s {target} -q") 
    
    # SpiderFoot output in CLI is often verbose text. 
    # Attempting to extract IPs and subdomains from SpiderFoot output as well
    sf_ips = re.findall(r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", sf_stdout)
    results["ips"].update(sf_ips)
    
    sf_subs = re.findall(r"([a-z0-9]+[\-a-z0-9]*\." + re.escape(target) + ")", sf_stdout, re.I)
    results["subdomains"].update(sf_subs)

    # Convert sets to sorted lists for JSON
    final_emails = sorted(list(results["emails"]))[:150] # Limit as requested
    final_subs = sorted(list(results["subdomains"]))[:150]
    final_ips = sorted(list(results["ips"]))[:150]

    return jsonify({
        "tool": "recon",
        "target": target,
        "emails": final_emails,
        "subdomains": final_subs,
        "ips": final_ips,
        "summary": {
            "totalEmails": len(final_emails),
            "totalSubdomains": len(final_subs),
            "totalIPs": len(final_ips)
        }
    })

@app.route('/exploit', methods=['POST'])
def exploit_scan():
    target = request.json.get('target')
    if not target:
        return jsonify({"error": "No target provided"}), 400
    
    # Define safe modules for check (No destructive payloads)
    modules = [
        {"name": "MS17-010 (EternalBlue)", "path": "exploit/windows/smb/ms17_010_eternalblue"},
        {"name": "vsftpd 2.3.4 Backdoor", "path": "exploit/unix/ftp/vsftpd_234_backdoor"},
        {"name": "Shellshock (Apache CGI)", "path": "exploit/linux/http/apache_mod_cgi_bash_env_exec"},
        {"name": "ProFTPD 1.3.5 Mod_Copy", "path": "exploit/unix/ftp/proftpd_modcopy_exec"}
    ]

    results = []
    attempted = []
    success_count = 0
    
    print(f"Starting Metasploit safe check for {target}...")

    for mod in modules:
        attempted.append(mod['path'])
        # Run msfconsole check command
        # -q: quiet, -x: execute command
        cmd = f"msfconsole -q -x 'use {mod['path']}; set RHOSTS {target}; check; exit'"
        print(f"Checking {mod['name']}...")
        stdout, stderr = run_tool(cmd)
        
        is_vuln = False
        access = "None"
        
        # Check for vulnerability indicators in msf output
        if "The target is vulnerable" in stdout or "VULNERABLE" in stdout:
            is_vuln = True
            success_count += 1
            access = "Check Only (Safe)"
        
        results.append({
            "name": mod['name'],
            "status": "Success (Vulnerable)" if is_vuln else "Failed (Not Vulnerable)",
            "access": access
        })

    return jsonify({
        "tool": "exploit",
        "target": target,
        "exploits_attempted": attempted,
        "successful_exploits": [r for r in results if "Success" in r['status']],
        "failed_exploits": [r for r in results if "Failed" in r['status']],
        "summary": {
            "attempted": len(modules),
            "success": success_count,
            "failed": len(modules) - success_count
        }
    })

@app.route('/traffic', methods=['POST'])
def traffic_analysis():
    target = request.json.get('target') # target might be used for filtering but tshark -i any captures all
    if not target:
        return jsonify({"error": "No target provided"}), 400
    
    print(f"Starting Traffic Analysis (Capture 100 packets)...")
    
    # Capture 100 packets, output as JSON
    # -c 100: packet count
    # -T json: machine readable
    # -e ip.src -e ip.dst -e _ws.col.Protocol: fields to extract
    cmd = "tshark -i any -c 100 -T json -e ip.src -e ip.dst -e _ws.col.Protocol"
    stdout, stderr = run_tool(cmd)
    
    try:
        data = json.loads(stdout)
    except:
        return jsonify({"error": "Failed to parse tshark output", "details": stderr}), 500

    packets = []
    protocol_counts = {}
    insecure_count = 0
    unique_conns = {}

    for frame in data:
        sources = frame.get("_source", {}).get("layers", {})
        src_ip = sources.get("ip.src", ["unknown"])[0]
        dest_ip = sources.get("ip.dst", ["unknown"])[0]
        protocol = sources.get("_ws.col.Protocol", ["unknown"])[0]

        # Update protocol counts
        protocol_counts[protocol] = protocol_counts.get(protocol, 0) + 1
        
        # Check risk
        risk = "low"
        if protocol in ["HTTP", "FTP", "Telnet"]:
            risk = "high"
            insecure_count += 1
        
        # Track unique connections for the table
        conn_key = f"{src_ip}-{dest_ip}-{protocol}"
        if conn_key not in unique_conns:
            unique_conns[conn_key] = {
                "src_ip": src_ip,
                "dest_ip": dest_ip,
                "protocol": protocol,
                "risk": risk
            }

    return jsonify({
        "tool": "traffic",
        "target": target,
        "total_packets": len(data),
        "insecure_packets": insecure_count,
        "protocols": protocol_counts,
        "connections": list(unique_conns.values())[:50], # Limit table size
        "summary": {
            "risk": "high" if insecure_count > 0 else "low"
        }
    })

if __name__ == '__main__':
    # Listen on all interfaces so Windows can connect
    app.run(host='0.0.0.0', port=5000)
