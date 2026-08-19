@echo off
REM Double-cliquez sur ce fichier pour lancer le telechargement.
REM Modifiez les deux lignes ci-dessous une bonne fois pour toutes :

set FICHIER_LIENS=liens.xlsx
set DOSSIER_DESTINATION=D:\Videos
REM Si tu as des erreurs "confirme que tu n'es pas un robot", remplace la
REM ligne du dessous par : set NAVIGATEUR=edge  (ou chrome, firefox...)
set NAVIGATEUR=

cd /d "%~dp0"
if "%NAVIGATEUR%"=="" (
    python download_videos.py --input "%FICHIER_LIENS%" --output "%DOSSIER_DESTINATION%"
) else (
    python download_videos.py --input "%FICHIER_LIENS%" --output "%DOSSIER_DESTINATION%" --cookies-from-browser %NAVIGATEUR%
)

pause
