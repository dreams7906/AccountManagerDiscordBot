@echo off
rem Starts the bot. Keep this window open; closing it stops the bot.
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist .env (
  echo Copy .env.example to .env and fill it in first.
  pause
  exit /b 1
)
call npm run deploy
call npm start
pause
