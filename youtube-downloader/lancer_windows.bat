@echo off
REM Double-cliquez sur ce fichier pour lancer le telechargement.
REM Modifiez les deux lignes ci-dessous une bonne fois pour toutes :

set FICHIER_LIENS=liens.xlsx
set DOSSIER_DESTINATION=D:\Videos

cd /d "%~dp0"
python download_videos.py --input "%FICHIER_LIENS%" --output "%DOSSIER_DESTINATION%"

pause
