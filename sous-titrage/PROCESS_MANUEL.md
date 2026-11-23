# Process manuel actuel (Premiere Pro, Windows) — relevé le 23/11/2026

Exemple : projet `E:\CFTC 30 JUILLET\CFTC v3.prproj`

## 0. Séquences à traiter
Séquences finales rangées dans le chutier `EXPORT`
(ex. CFTC PODCAST v4, CFTC VIDEO 01 v3, 02 v3, 03 v4, TEASER v4).
Séquences démarrant à 10:00:00:00, 25 i/s, audio sur A1–A3.

## 1. Transcription
Panneau Texte → onglet Transcription → menu ⋯ → **Générer une transcription statique…**
- Langue : **Français**
- Étiquetage des intervenants : **Oui, séparer les intervenants**
- Analyse audio : **Audio sur la piste → Mixage**
- Transcrire point d'entrée sur point de sortie : non
- Fusionner la sortie avec la transcription existante : non

Durée constatée : ~2 min pour une séquence de 16 min.

## 2. Création des sous-titres
Menu ⋯ → **Créer des sous-titres…** (« Création de légendes »)
- Paramètre prédéfini : Sous-titre par défaut
- Format : Sous-titre — Flux : Aucun — Style : Aucun
- Disposition : **Ligne double**
- Longueur maximale : **42 caractères**
- Durée minimale : **3,0 secondes**
- Écart entre les sous-titres : **0 image**
- Supprimer la ponctuation : non

Résultat : piste de sous-titres **C1** au-dessus de la vidéo (onglet Texte → Sous-titres).

## 2b. Calage du premier sous-titre (TOUJOURS)
Le **premier sous-titre est rallongé à gauche jusqu'au tout début de la séquence**
(ex. 10:00:10:16 → 10:00:00:00). Ainsi le SRT commence à 00:00:00,000 = début de la vidéo,
ce qui permet les imports/exports (HappyScribe, réimport Premiere) sans recaler à l'image.
Le texte du premier sous-titre n'est pas modifié.

## 3. Export SRT
(à compléter)
