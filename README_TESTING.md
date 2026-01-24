# POS Test Guide (One-Click)

This is the easiest way to run the POS for testing.

## 1) Install prerequisites (one time)
- Node.js (LTS)
- Docker Desktop

## 2) Setup (one time)
Open PowerShell in the project folder and run:

  powershell -ExecutionPolicy Bypass -File .\setup_pos.ps1

## 3) Run (every time)

  powershell -ExecutionPolicy Bypass -File .\run_pos.ps1

## 4) Create the first admin (one time)
Open a new PowerShell and run:

  curl -X POST http://localhost:4000/auth/setup-admin -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"

## 5) Open the app
When frontend starts, open the URL it prints (usually http://localhost:3000).
Log in with the admin user.

## Troubleshooting
- If Docker is not running, start Docker Desktop.
- If ports 3000/4000/5432 are used, stop the other apps.
