$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$pin = 'c17bd360de60780a9e8d3690288b70181bd07355'
$runtime = Join-Path (Get-Location) '.runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
if (!(Test-Path '.runtime/uv-bootstrap/bin/uv.exe')) {
  python -m pip install --target .runtime/uv-bootstrap 'uv==0.12.21'
  if ($LASTEXITCODE) { throw 'uv installation failed' }
}
if (!(Test-Path '.runtime/ru-marketplace-mcp/.git')) {
  git clone https://github.com/Vladimir-Human/ru-marketplace-mcp.git .runtime/ru-marketplace-mcp
  if ($LASTEXITCODE) { throw 'clone failed' }
}
$changes = git -C .runtime/ru-marketplace-mcp status --porcelain
if ($changes) { throw 'Runtime checkout is modified; refusing to replace it' }
git -C .runtime/ru-marketplace-mcp checkout --detach $pin
if ($LASTEXITCODE) { throw 'pin checkout failed' }
$env:UV_CACHE_DIR = Join-Path $runtime 'uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $runtime 'python'
& .runtime/uv-bootstrap/bin/uv.exe sync --directory .runtime/ru-marketplace-mcp --frozen --all-packages --no-dev --python 3.12
if ($LASTEXITCODE) { throw 'locked runtime installation failed' }
& .runtime/uv-bootstrap/bin/uv.exe pip install --python .runtime/ru-marketplace-mcp/.venv/Scripts/python.exe --require-hashes -r scripts/runtime-security.txt
if ($LASTEXITCODE) { throw 'security overlay installation failed' }
Write-Output 'Runtime ready. npm start creates the isolated Chrome profile on the first search.'
