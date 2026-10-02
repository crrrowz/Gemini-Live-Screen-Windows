@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "JSON_FILE=%SCRIPT_DIR%native_host\com.gemini.live.screen.host.json"
set "BAT_FILE=%SCRIPT_DIR%native_host\companion.bat"

echo ==========================================================
echo   Registering Gemini Live Screen Native Messaging Host...
echo ==========================================================

:: Update JSON manifest with absolute Windows path using Node
node -e "const fs = require('fs'); const p = process.env.JSON_FILE; const json = JSON.parse(fs.readFileSync(p, 'utf8')); json.path = process.env.BAT_FILE; fs.writeFileSync(p, JSON.stringify(json, null, 2));"

:: Register in Windows Registry under Current User Chrome NativeMessagingHosts
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.gemini.live.screen.host" /ve /t REG_SZ /d "%JSON_FILE%" /f

echo.
if %ERRORLEVEL% EQU 0 (
  echo [Success] Native Messaging Host registered successfully in Chrome!
  echo Fixed Extension ID: gcihkgbnghadbaabjkpelkpimiljkblo
  echo You can now click the Chrome Extension icon and the server will launch automatically on-demand.
) else (
  echo [Error] Failed to register Native Host in registry.
)

echo.
pause
