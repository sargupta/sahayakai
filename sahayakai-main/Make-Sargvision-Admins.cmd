@echo off
rem LOCAL demo only: every account that has signed in to http://localhost:3000 becomes an admin of
rem the Sargvision test class (and the local test schools). Needs the local stack running
rem (Start-Sahayak-RealCalls.cmd). Touches only the local Firestore emulator, never a real database.
cd /d "%~dp0"
node scripts\sampark\make-local-admins.mjs %*
echo.
echo Done. Reload the SamparkAI page in your browser.
pause
