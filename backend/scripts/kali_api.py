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

if __name__ == '__main__':
    # Listen on all interfaces so Windows can connect
    app.run(host='0.0.0.0', port=5000)
