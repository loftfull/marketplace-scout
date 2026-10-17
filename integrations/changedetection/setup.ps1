$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location -LiteralPath $projectRoot
$revision = '09881f8b26aa01a2be66c5f63daf54a79a42b6bd'
$sourcePath = Join-Path $projectRoot '.runtime/external/changedetection/upstream'
$uvPath = Join-Path $projectRoot '.runtime/uv-bootstrap/bin/uv.exe'
$basePython = Join-Path $projectRoot '.runtime/python/cpython-3.12.14-windows-x86_64-none/python.exe'
$pythonPath = Join-Path $projectRoot '.runtime/external/changedetection/venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $uvPath) -or -not (Test-Path -LiteralPath $basePython)) { throw 'Install the existing Scout runtime prerequisites first.' }
if (-not (Test-Path -LiteralPath $sourcePath)) {
    git clone --depth 1 --branch 0.60.8 https://github.com/dgtlmoon/changedetection.io.git $sourcePath
    if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
}
$head = git -C $sourcePath rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -ne $revision) { throw 'Unexpected upstream revision' }
$dirty = git -C $sourcePath status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Upstream files modified; inspect before reinstalling' }
if (-not (Test-Path -LiteralPath $pythonPath)) {
    & $uvPath venv (Split-Path (Split-Path $pythonPath)) --python $basePython
    if ($LASTEXITCODE -ne 0) { throw 'Venv creation failed' }
}
& $uvPath pip sync (Join-Path $PSScriptRoot 'requirements.lock') --require-hashes --python $pythonPath
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
& $uvPath pip check --python $pythonPath
if ($LASTEXITCODE -ne 0) { throw 'Dependency consistency failed' }
Write-Output 'Installed pinned upstream plus separate security override. Run dependency audit before start.ps1.'
