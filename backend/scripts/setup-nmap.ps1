# PAIA — Nmap Automated Setup Script
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

$BinDir = Join-Path $PSScriptRoot "..\bin"
$NmapDir = Join-Path $BinDir "nmap"
$ZipPath = Join-Path $BinDir "nmap.zip"
$DownloadUrl = "https://nmap.org/dist/nmap-7.95-win32.zip"

Write-Host "--- PAIA Nmap Setup ---" -ForegroundColor Cyan

# 1. Ensure directories exist
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir | Out-Null
}
if (-not (Test-Path $NmapDir)) {
    New-Item -ItemType Directory -Path $NmapDir | Out-Null
}

# 2. Download Nmap
Write-Host "[*] Downloading Nmap v7.95 from Nmap.org..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath
    Write-Host "[+] Download complete." -ForegroundColor Green
} catch {
    Write-Error "[-] Failed to download Nmap: $_"
    exit 1
}

# 3. Extract Nmap
Write-Host "[*] Extracting Nmap..."
try {
    Expand-Archive -Path $ZipPath -DestinationPath $NmapDir -Force
    
    # Nmap zip contains a subfolder like nmap-7.95/
    $SubFolder = Get-ChildItem -Path $NmapDir -Directory | Select-Object -First 1
    if ($SubFolder) {
        Write-Host "[*] Organizing files from $($SubFolder.Name)..."
        Move-Item -Path "$($SubFolder.FullName)\*" -Destination $NmapDir -Force
        Remove-Item -Path $SubFolder.FullName -Recurse -Force
    }
    
    Write-Host "[+] Nmap binary placed at: $(Join-Path $NmapDir "nmap.exe")" -ForegroundColor Green
} catch {
    Write-Error "[-] Extraction failed: $_"
    exit 1
} finally {
    if (Test-Path $ZipPath) { Remove-Item $ZipPath }
}

Write-Host "--- Setup Complete ---" -ForegroundColor Cyan
Write-Host "[!] Note: Npcap is required for advanced scans. If Nmap fails to run later, please install Npcap from: https://npcap.com/#download" -ForegroundColor Yellow
