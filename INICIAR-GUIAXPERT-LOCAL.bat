@echo off
REM GuiaXpert - liga o servidor local e abre o app em http://localhost:5500 (Windows)
REM Como usar: de dois cliques neste arquivo. Para desligar, feche a janela preta.
cd /d "%~dp0"
echo GuiaXpert - servindo esta pasta em http://localhost:5500
echo Na primeira vez pode aparecer "Ok to proceed? (y)": digite y e aperte Enter.
echo Para desligar, feche esta janela.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:5500'"
call npx.cmd serve . -l tcp://127.0.0.1:5500
if errorlevel 1 (
  echo.
  echo Nao consegui ligar o servidor. Confira se o Node.js esta instalado (manual, Sessao 1).
  pause
)
