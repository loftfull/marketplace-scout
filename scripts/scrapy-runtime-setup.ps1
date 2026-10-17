$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$pin = '8026deeaac371a5d9a3edbe4886d58f61139d464'
$runtime = '.runtime/external/scrapy'
$source = Join-Path $runtime 'upstream'
$python = Join-Path $source '.venv/Scripts/python.exe'
$uv = '.runtime/uv-bootstrap/bin/uv.exe'

if (!(Test-Path $uv)) {
  New-Item -ItemType Directory -Force -Path '.runtime/uv-bootstrap' | Out-Null
  python -m pip install --target '.runtime/uv-bootstrap' 'uv==0.12.21'
  if ($LASTEXITCODE) { throw 'uv installation failed' }
}
if (!(Test-Path (Join-Path $source '.git'))) {
  if (Test-Path $source) { throw 'Scrapy target exists without Git metadata; refusing to replace it' }
  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  git clone https://github.com/scrapy/scrapy.git $source
  if ($LASTEXITCODE) { throw 'Scrapy clone failed' }
}
if (git -C $source status --porcelain) { throw 'Scrapy source has local changes; refusing to replace it' }
git -C $source checkout --detach $pin
if ($LASTEXITCODE) { throw 'Scrapy pin checkout failed' }
if ((git -C $source rev-parse HEAD).Trim() -ne $pin) { throw 'Scrapy commit verification failed' }

$env:UV_CACHE_DIR = Join-Path (Get-Location) '.runtime/uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path (Get-Location) '.runtime/python'
if (!(Test-Path $python)) {
  & $uv venv (Join-Path $source '.venv') --python 3.13
  if ($LASTEXITCODE) { throw 'Scrapy virtual environment creation failed' }
}
& $uv pip sync --python $python --require-hashes 'scripts/scrapy-runtime.txt'
if ($LASTEXITCODE) { throw 'Scrapy hash-locked dependencies failed' }
& $uv pip install --python $python --no-deps --editable $source
if ($LASTEXITCODE) { throw 'Pinned Scrapy source install failed' }
& $uv pip check --python $python
if ($LASTEXITCODE) { throw 'Scrapy dependency consistency failed' }
& $python -m scrapy version
if ($LASTEXITCODE) { throw 'Scrapy CLI verification failed' }
Write-Output "Scrapy runtime ready at pinned commit $pin"
