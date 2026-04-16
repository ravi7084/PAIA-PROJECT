# PAIA — Amass Automated Setup Script
# Downloads and extracts Amass binary for Windows

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

$BinDir = Join-Path $PSScriptRoot "..\bin"
$ZipPath = Join-Path $BinDir "amass.zip"
$DownloadUrl = "https://github.com/owasp-amass/amass/releases/download/v4.2.0/amass_windows_amd64.zip"

Write-Host "--- PAIA Amass Setup ---" -ForegroundColor Cyan

# 1. Ensure bin directory exists
if (-not (Test-Path $BinDir)) {
    Write-Host "[*] Creating bin directory at $BinDir"
    New-Item -ItemType Directory -Path $BinDir | Out-Null
}

# 2. Download Amass
Write-Host "[*] Downloading Amass v4.2.0 from GitHub..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath
    Write-Host "[+] Download complete." -ForegroundColor Green
} catch {
    Write-Error "[-] Failed to download Amass: $_"
    exit 1
}

# 3. Extract Amass
Write-Host "[*] Extracting binary..."
try {
    Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
    
    # Amass zip usually contains a subfolder like amass_windows_amd64/amass.exe
    $ExtractedExe = Get-ChildItem -Path $BinDir -Filter "amass.exe" -Recurse | Select-Object -First 1
    
    if ($ExtractedExe) {
        $FinalPath = Join-Path $BinDir "amass.exe"
        Move-Item -Path $ExtractedExe.FullName -Destination $FinalPath -Force
        Write-Host "[+] Amass binary placed at: $FinalPath" -ForegroundColor Green
    } else {
        Write-Error "[-] Could not find amass.exe in the extracted archive."
        exit 1
    }
} catch {
    Write-Error "[-] Extraction failed: $_"
    exit 1
} finally {
    # 4. Cleanup
    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath
    }
    # Cleanup subfolders created by Expand-Archive
    Get-ChildItem -Path $BinDir -Directory | Remove-Item -Recurse -Force
}

Write-Host "--- Setup Complete ---" -ForegroundColor Cyan
