@echo off
REM One click: Firestore + Storage emulators -> seed demo data -> VIDYA voice sidecar
REM -> Sahayak (next dev) -> health checks -> opens http://localhost:3000/
REM Stop with Stop-Sahayak-Demo.cmd. Logs: %TEMP%\riya-local\
REM
REM REAL VOICE CALLS ARE ON BY DEFAULT: when the Vobiz and ElevenLabs credential files are present
REM (E:\sargvision\VOBIZCRED.txt and E:\sargvision\Sampark_details.txt), this starts
REM Start-Sahayak-RealCalls.ps1: the Sargvision class can be called for real through BOTH
REM ElevenLabs and Vobiz (only the 9 roster numbers; caps, consent and calling hours still apply).
REM Without those files it falls back to Practice mode (no phone rings) and says so.
REM To force Practice mode: set SAHAYAK_PRACTICE_ONLY=1 before running.
setlocal
cd /d "%~dp0"
set "NODE_EXE=node"
where node >nul 2>nul || set "NODE_EXE=E:\NodeJS\node.exe"
set "VOBIZ_FILE=%VOBIZ_CRED_FILE%"
if "%VOBIZ_FILE%"=="" set "VOBIZ_FILE=E:\sargvision\VOBIZCRED.txt"
if not "%SAHAYAK_PRACTICE_ONLY%"=="1" if exist "%VOBIZ_FILE%" if exist "E:\sargvision\Sampark_details.txt" (
  title Sahayak AI - REAL CALLS on - Sargvision class, ElevenLabs + Vobiz - keep this window open
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Sahayak-RealCalls.ps1"
  if errorlevel 1 (
    echo.
    echo Real-call startup failed - see the STOPPED message above and the logs in %TEMP%\riya-local\
    pause
  )
  goto :done
)
echo.
echo Real-call credential files not found (or SAHAYAK_PRACTICE_ONLY=1): starting in PRACTICE mode - no phone rings.
title Sahayak AI local demo - PRACTICE (keep this window open)
"%NODE_EXE%" scripts\sampark\riya-local.mjs --persist --no-menu --ticker --admin dev-user-123 --demo-family --open-home --port 3000
if errorlevel 1 (
  echo.
  echo Startup failed - see the STOPPED message above and the logs in %TEMP%\riya-local\
  pause
)
:done
endlocal
