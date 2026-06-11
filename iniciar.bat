@echo off
cd /d "%~dp0"
title Iniciar CRM Futura Peru
echo ====================================================
echo    INICIANDO SERVIDORES - DASHBOARD CRM FUTURA PERU
echo ====================================================
echo.

echo [+] Iniciando Backend FastAPI en el puerto 8000...
start "CRM Backend FastAPI" cmd /k "cd backend && ..\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo [+] Iniciando Frontend Next.js en el puerto 3000...
start "CRM Frontend Next.js" cmd /k "cd frontend && npm run dev"

echo.
echo ====================================================
echo   Procesos lanzados. Abre en tu navegador:
echo   -> http://localhost:3000
echo ====================================================
echo.
pause
