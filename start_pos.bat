@echo off
setlocal

cd /d %~dp0

echo Starting POS Desktop...
for %%F in (".\\dist\\POS Desktop*.exe") do (
  start "" "%%~fF"
  exit /b 0
)

echo Portable EXE not found. If you installed the app, launch it from Start Menu.
pause
