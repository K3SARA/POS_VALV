# POS one-click run
# Run in PowerShell: powershell -ExecutionPolicy Bypass -File .\run_pos.ps1

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "Starting database..." -ForegroundColor Cyan
docker compose up -d

Write-Host "Starting backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PSScriptRoot\backend`"; npm run dev"

Write-Host "Starting frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PSScriptRoot\frontend`"; npm start"

Write-Host "If this is the first run, create admin once:" -ForegroundColor Yellow
Write-Host "curl -X POST http://localhost:4000/auth/setup-admin -H \"Content-Type: application/json\" -d '{\"username\":\"admin\",\"password\":\"admin123\"}'" -ForegroundColor Yellow
