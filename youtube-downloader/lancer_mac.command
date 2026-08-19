#!/bin/bash
# Double-cliquez sur ce fichier pour lancer le telechargement.
# Modifiez les deux lignes ci-dessous une bonne fois pour toutes :

FICHIER_LIENS="liens.xlsx"
DOSSIER_DESTINATION="/Volumes/MonDisqueDur/Videos"

cd "$(dirname "$0")"
python3 download_videos.py --input "$FICHIER_LIENS" --output "$DOSSIER_DESTINATION"

echo ""
read -p "Appuyez sur Entree pour fermer..."
