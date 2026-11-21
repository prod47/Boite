# Sous-titrage automatique

Projet séparé : automatiser le sous-titrage des vidéos clients (Premiere Pro → SRT → HappyScribe).

- `transcrire.py` : transcription FR en SRT avec Whisper large-v3 (faster-whisper).
  Découpage proche de Premiere : 42 caractères max par ligne, 2 lignes max.
  `python transcrire.py video.mp4 [sortie.srt] [--noms "Nom1, Nom2"]`
- `tests/` : résultats du comparatif Whisper vs Premiere.
