@echo off
title Gemini Live Screen Server Launcher
cd /d "%~dp0"

echo ========================================================
echo   Starting Gemini Live Screen Local Companion Server...
echo ========================================================

node server.js
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [Error] Node.js is required to run the local server.
  echo Please install Node.js from https://nodejs.org/
  pause
)
