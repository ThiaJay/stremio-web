@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Deploy-StremioDtsFix.ps1"
if errorlevel 1 (
  echo.
  echo Deployment stopped safely. The existing Stremio app was not uninstalled.
  pause
  exit /b 1
)
echo.
echo Deployment completed.
pause
