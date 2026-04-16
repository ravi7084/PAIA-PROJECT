# PAIA — Nikto Automated Setup Script
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

$BinDir = Join-Path $PSScriptRoot "..\bin"
$NiktoDir = Join-Path $BinDir "nikto"
$ZipPath = Join-Path $BinDir "nikto.zip"
$DownloadUrl = "https://github.com/sullo/nikto/archive/master.zip"

Write-Host "--- PAIA Nikto Setup ---" -ForegroundColor Cyan

# 1. Ensure directories exist
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir | Out-Null
}
if (-not (Test-Path $NiktoDir)) {
    New-Item -ItemType Directory -Path $NiktoDir | Out-Null
}

# 2. Download Nikto from GitHub
Write-Host "[*] Downloading Nikto source from GitHub..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath
    Write-Host "[+] Download complete." -ForegroundColor Green
} catch {
    Write-Error "[-] Failed to download Nikto: $_"
    exit 1
}

# 3. Extract Nikto
Write-Host "[*] Extracting Nikto..."
try {
    Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
    
    # GitHub zip usually extracts into a folder like nikto-master/
    $MasterFolder = Join-Path $BinDir "nikto-master"
    if (Test-Path $MasterFolder) {
        if (Test-Path $NiktoDir) { Remove-Item $NiktoDir -Recurse -Force }
        Move-Item -Path $MasterFolder -Destination $NiktoDir
        Write-Host "[+] Nikto placed at: $NiktoDir" -ForegroundColor Green
    }
} catch {
    Write-Error "[-] Extraction failed: $_"
    exit 1
} finally {
    if (Test-Path $ZipPath) { Remove-Item $ZipPath }
}

Write-Host "--- Setup Complete ---" -ForegroundColor Cyan
Write-Host "[!] Note: Nikto requires Perl. Please ensure you have Strawberry Perl installed." -ForegroundColor Yellow
