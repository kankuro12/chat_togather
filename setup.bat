@echo off
cd /d "%~dp0"
call npm install
if errorlevel 1 exit /b 1
echo Together dependencies installed. Run start.bat.
