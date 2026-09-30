$ErrorActionPreference = 'SilentlyContinue'

# scripts/ lives one level inside the project root.
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$url = 'http://localhost:5173/'

function Test-ServerUp {
    try {
        return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-ServerUp)) {
    if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
        Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm install' -WorkingDirectory $projectRoot -Wait
    }

    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -WorkingDirectory $projectRoot -WindowStyle Hidden

    $tries = 0
    while (-not (Test-ServerUp) -and $tries -lt 60) {
        Start-Sleep -Milliseconds 500
        $tries++
    }
}

Start-Process $url
