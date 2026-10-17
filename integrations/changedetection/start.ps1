$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$pythonPath = Join-Path $projectRoot '.runtime/external/changedetection/venv/Scripts/python.exe'
$runnerPath = Join-Path $PSScriptRoot 'runner.py'
$dataPath = Join-Path $projectRoot '.data/external/changedetection'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Run setup.ps1 first.' }
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8791)
try { $listener.Start() } finally { $listener.Stop() }
New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
$process = Start-Process -FilePath $pythonPath -ArgumentList @('-u', ('"' + $runnerPath + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $dataPath 'stdout.log') -RedirectStandardError (Join-Path $dataPath 'stderr.log')
Write-Output "changedetection pilot starting, PID $($process.Id), http://127.0.0.1:8791"
$ready = $false
for ($attempt = 0; $attempt -lt 90; $attempt++) {
    if ($process.HasExited) { throw 'Pilot exited. Inspect .data/external/changedetection/stderr.log.' }
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8791/api/v1/full-spec' -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw 'Pilot readiness timed out; inspect its log before retrying. Process was not terminated.' }
Write-Output 'Upstream API ready; no outbound checks have been scheduled.'
