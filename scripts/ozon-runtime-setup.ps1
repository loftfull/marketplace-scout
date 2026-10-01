$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$pin = '414b3470ee6dd6f3197598b2c3c640d5d1601ef3'
if (!(Test-Path '.runtime/uv-bootstrap/bin/uv.exe')) { throw 'Run npm run runtime:setup first' }
if (!(Test-Path '.runtime/ozon-mcp/.git')) {
  git clone https://github.com/SZhukovWork/ozon-mcp.git .runtime/ozon-mcp
  if ($LASTEXITCODE) { throw 'Ozon clone failed' }
}
if (git -C .runtime/ozon-mcp status --porcelain) { throw 'Ozon runtime is modified; refusing replacement' }
git -C .runtime/ozon-mcp checkout --detach $pin
if ($LASTEXITCODE) { throw 'Ozon pin failed' }
$env:UV_CACHE_DIR = Join-Path (Get-Location) '.runtime/uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path (Get-Location) '.runtime/python'
if (!(Test-Path '.runtime/ozon-mcp/.venv/Scripts/python.exe')) {
  & .runtime/uv-bootstrap/bin/uv.exe venv .runtime/ozon-mcp/.venv --python 3.12
  if ($LASTEXITCODE) { throw 'Ozon environment failed' }
}
& .runtime/uv-bootstrap/bin/uv.exe pip sync --python .runtime/ozon-mcp/.venv/Scripts/python.exe --require-hashes scripts/ozon-runtime.txt
if ($LASTEXITCODE) { throw 'Ozon locked install failed' }
& .runtime/uv-bootstrap/bin/uv.exe pip check --python .runtime/ozon-mcp/.venv/Scripts/python.exe
if ($LASTEXITCODE) { throw 'Ozon dependency check failed' }
