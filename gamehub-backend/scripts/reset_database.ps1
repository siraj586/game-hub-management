# Resets GameHub backend to a fresh empty database.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$python = Join-Path $Root "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Host "venv not found. Use: python -m venv venv; pip install -r requirements.txt"
    exit 1
}

$db = Join-Path $Root "db.sqlite3"
if (Test-Path $db) {
    Remove-Item $db -Force
    Write-Host "Removed db.sqlite3"
}

& $python manage.py migrate
Write-Host "Database is empty and ready. Open the app and use Shop Setup to create the owner account."
