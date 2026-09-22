@echo off
title Stremio Final AV Sync Acceptance
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0FINAL_ACCEPTANCE.ps1"
if errorlevel 1 (
  echo.
  echo Final acceptance stopped with an error. Nothing was uninstalled.
  pause
  exit /b 1
)
echo.
pause
