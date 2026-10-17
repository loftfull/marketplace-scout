$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$python = '.runtime/external/scrapy/upstream/.venv/Scripts/python.exe'
if (!(Test-Path $python)) { throw 'Pinned Scrapy runtime is missing; run npm run runtime:scrapy-html' }
& $python tests/scrapy_html_test.py
if ($LASTEXITCODE) { exit $LASTEXITCODE }
