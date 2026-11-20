@echo off
REM Stops only the processes the Sahayak launchers started (recorded in %TEMP%\riya-local\):
REM the app stack (pids.json, data saved first) and, for real-call runs, the Vobiz bridge,
REM webhook gateway and tunnels (realcall-pids.json).
setlocal
cd /d "%~dp0"
set "NODE_EXE=node"
where node >nul 2>nul || set "NODE_EXE=E:\NodeJS\node.exe"
"%NODE_EXE%" scripts\sampark\riya-local.mjs --stop
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f=Join-Path $env:TEMP 'riya-local\realcall-pids.json'; if(Test-Path $f){ foreach($x in (Get-Content $f | ConvertFrom-Json)){ try{ Stop-Process -Id $x.pid -Force -ErrorAction Stop; Write-Host ('stopped ' + $x.name + ' (pid ' + $x.pid + ')') }catch{} }; Remove-Item $f -Force }"
ping -n 4 127.0.0.1 >nul
endlocal
