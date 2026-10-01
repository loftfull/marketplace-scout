$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$pin = '92bb4dfbc3b87d0c0f77aa7ede09faed7e661aa7'
if (!(Test-Path '.runtime/uv-bootstrap/bin/uv.exe')) { throw 'Run npm run runtime:setup first' }
if (!(Test-Path '.runtime/yandex-market-mcp/.git')) {
  git clone https://github.com/SZhukovWork/yandex-market-mcp.git .runtime/yandex-market-mcp
  if ($LASTEXITCODE) { throw 'Market clone failed' }
}
if (git -C .runtime/yandex-market-mcp status --porcelain) { throw 'Market checkout modified; refusing replacement' }
git -C .runtime/yandex-market-mcp checkout --detach $pin
if ($LASTEXITCODE) { throw 'Market pin failed' }
$env:UV_CACHE_DIR = Join-Path (Get-Location) '.runtime/uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path (Get-Location) '.runtime/python'
if (!(Test-Path '.runtime/yandex-market-mcp/.venv/Scripts/python.exe')) {
  & .runtime/uv-bootstrap/bin/uv.exe venv .runtime/yandex-market-mcp/.venv --python 3.12
  if ($LASTEXITCODE) { throw 'Market environment failed' }
}
& .runtime/uv-bootstrap/bin/uv.exe pip sync --python .runtime/yandex-market-mcp/.venv/Scripts/python.exe --require-hashes scripts/yandex-runtime.txt
if ($LASTEXITCODE) { throw 'Market locked install failed' }
& .runtime/uv-bootstrap/bin/uv.exe pip check --python .runtime/yandex-market-mcp/.venv/Scripts/python.exe
if ($LASTEXITCODE) { throw 'Market dependency check failed' }
