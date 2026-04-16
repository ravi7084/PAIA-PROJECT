# PAIA — Nikto Automated Setup (v2.5.0 Stable)
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

$BinDir = Join-Path $PSScriptRoot "..\bin"
$NiktoDir = Join-Path $BinDir "nikto"
$ZipPath = Join-Path $BinDir "nikto-2.5.0.zip"
$DownloadUrl = "https://github.com/sullo/nikto/archive/refs/tags/2.5.0.zip"

Write-Host "--- PAIA Nikto Stable Setup ---" -ForegroundColor Cyan

if (-not (Test-Path $BinDir)) { New-Item -ItemType Directory -Path $BinDir | Out-Null }

Write-Host "[*] Downloading Nikto v2.5.0..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath
    Write-Host "[+] Download complete." -ForegroundColor Green
} catch {
    Write-Error "[-] Failed to download: $_"
    exit 1
}

Write-Host "[*] Extracting..."
try {
    Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
    $ExtractedFolder = Join-Path $BinDir "nikto-2.5.0"
    if (Test-Path $ExtractedFolder) {
        if (Test-Path $NiktoDir) { Remove-Item $NiktoDir -Recurse -Force }
        Move-Item -Path $ExtractedFolder -Destination $NiktoDir
        Write-Host "[+] Nikto installed at: $NiktoDir" -ForegroundColor Green
        $PlPath = Join-Path $NiktoDir "program\nikto.pl"
        if (Test-Path $PlPath) {
            Write-Host "[+] nikto.pl verified!" -ForegroundColor Green
        } else {
            Write-Host "[-] Warning: nikto.pl not found." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Error "[-] Extraction failed: $_"
    exit 1
} finally {
    if (Test-Path $ZipPath) { Remove-Item $ZipPath }
}

Write-Host "--- Setup Complete ---" -ForegroundColor Cyan
