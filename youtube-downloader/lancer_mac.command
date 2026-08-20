#!/bin/bash
# Double-cliquez sur ce fichier pour lancer le telechargement.
# Modifiez les lignes ci-dessous une bonne fois pour toutes :

DOSSIER_LIENS="Document Excel Avec Lien"
DOSSIER_DESTINATION="Videos"

cd "$(dirname "$0")"
python3 download_videos.py --input-folder "$DOSSIER_LIENS" --output "$DOSSIER_DESTINATION"

echo ""
read -p "Appuyez sur Entree pour fermer..."
