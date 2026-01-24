# POS one-click setup
# Run in PowerShell: powershell -ExecutionPolicy Bypass -File .\setup_pos.ps1

$ErrorActionPreference = "Stop"

Write-Host "[1/5] Checking required tools..." -ForegroundColor Cyan

function Assert-Command($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host "Missing: $name" -ForegroundColor Red
    exit 1
  }
}

Assert-Command docker
Assert-Command node
Assert-Command npm

Write-Host "[2/5] Starting database (Docker)..." -ForegroundColor Cyan
Set-Location $PSScriptRoot

docker compose up -d

Write-Host "[3/5] Installing backend deps..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\backend"
npm install

Write-Host "[4/5] Prisma generate + migrate..." -ForegroundColor Cyan
npx prisma generate
npx prisma migrate dev --name init

Write-Host "[5/5] Installing frontend deps..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend"
npm install

Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Next: run .\\run_pos.ps1" -ForegroundColor Yellow
