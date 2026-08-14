@echo off
cd /d "%~dp0"
python ingest.py %*
if errorlevel 1 (
    echo.
    echo Une erreur est survenue, voir le message ci-dessus.
)
echo.
pause
