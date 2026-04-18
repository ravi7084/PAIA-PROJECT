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

if __name__ == '__main__':
    # Listen on all interfaces so Windows can connect
    app.run(host='0.0.0.0', port=5000)
