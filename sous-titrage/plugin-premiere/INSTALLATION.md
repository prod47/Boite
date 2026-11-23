# Plugin « Sous-titrage Happy Scribe » — installation (Premiere 26.5, Windows)

## Ce que fait le plugin
Pour chaque séquence du chutier `EXPORT` (ou seulement la séquence active) :
1. remet le timecode de début à **00:00:00:00** si besoin ;
2. exporte le **MP4** avec le preset **Happy Scribe** (inclus dans `presets/`) ;
3. lance la **transcription Premiere en français** sur ce MP4 ;
4. crée le **SRT** avec tes règles : ligne double, 42 caractères, 3 s minimum,
   écart 0 image, **premier sous-titre calé à 00:00:00:00**.

Tout est rangé dans `<dossier du .prproj>\SRT\` (ou `SRT_V2`, `SRT_V3`… s'il existe déjà),
avec le même nom que la séquence : `TEASER v4.mp4` + `TEASER v4.srt`.
Les MP4 importés pour la transcription sont rangés dans un chutier `_SOUS-TITRAGE`.

Aucun token Claude : tout tourne dans Premiere, sur ton PC.

## Installation (une seule fois)
1. Télécharger le dossier `sous-titrage/plugin-premiere` sur le PC
   (ex. `C:\Plugins\plugin-premiere`).
2. Premiere → **Paramètres (Préférences) → Plugins → cocher « Activer le mode développeur »**,
   puis redémarrer Premiere.
3. Installer **UXP Developer Tool** depuis l'application Creative Cloud
   (onglet Applications → Toutes les applications → UXP Developer Tools).
4. Dans UXP Developer Tool : **Add Plugin** → choisir `manifest.json` du dossier → **Load**.
5. Dans Premiere : **Fenêtre → Extensions UXP (UXP Plugins) → Sous-titrage Happy Scribe**.

## Utilisation
1. Ouvrir le projet, vérifier que les séquences finales sont dans le chutier `EXPORT`.
2. Dans le panneau : cliquer **Lancer : MP4 + SRT**.
3. Suivre le journal. À la fin, le dossier `SRT` contient les MP4 + SRT pour HappyScribe.

## Version de test (0.2)
Vérifiée contre les déclarations officielles de l'API Premiere 26.5 (`@adobe/premierepro` 26.5.1).
Corrections par rapport à la 0.1 :
- transcription : l'option de langue s'appelle `language` (la 0.1 envoyait `languageCode`,
  ignoré → Premiere aurait transcrit dans la langue par défaut des préférences) ;
- chutiers et séquences distingués par leur type (`ProjectItem.TYPE_BIN`) ;
- erreurs d'export Premiere affichées dans le journal ;
- lecture du JSON de transcription plus tolérante (noms de champs, temps en ticks) ;
- case « Garder le JSON de transcription (test) » : écrit `<nom>.transcription.json`
  dans le dossier SRT pour comparer avec le SRT de l'export manuel.

### Premier test
1. Ouvrir `E:\CFTC 30 JUILLET\CFTC v3.prproj`, ouvrir une seule séquence (ex. TEASER v4).
2. Panneau : « Seulement la séquence active » + cocher « Garder le JSON… » → Lancer.
3. En cas d'erreur : capture du journal du panneau + onglet Logs/Console de
   UXP Developer Tools (bouton ⋯ → Debug), et le fichier `.transcription.json`.
4. Si la préférence « Détection automatique de la langue » est activée dans Premiere,
   elle prend le pas sur le français demandé par le plugin.
5. Le preset Happy Scribe a « Légendes activées » : si la séquence a déjà une piste
   de sous-titres, Premiere écrit aussi `<nom>.mp4.srt` (nom différent : il n'est pas remplacé).

## Version 0.3 — testée le 23/11/2026 (Premiere 26.5.3, TEASER v4 de CFTC v3)
Résultat : `TEASER v4.mp4` + `TEASER v4.srt` (34 sous-titres, contre 36 dans l'export
manuel de Premiere ; la plupart des coupes sont identiques, lignes ≤ 42 caractères,
premier sous-titre à 00:00:00,000). Transcription d'un teaser de 1 min 54 : ~1 min.

Corrections par rapport à la 0.2 :
- **« Requires locked access »** : les actions Premiere (chutier `_SOUS-TITRAGE`,
  timecode de début) sont maintenant *créées* dans `project.lockedAccess()`, pas seulement exécutées ;
- **transcription vide** : `transcribeClipProjectItem` rend la main tout de suite et
  `hasTranscript()` passe à vrai avec un JSON vide (`"language":"und-zz"`, `words: []`).
  Le plugin attend maintenant que des mots apparaissent et que leur nombre ne bouge plus ;
  un SRT vide n'est plus jamais écrit (erreur dans le journal à la place) ;
- le MP4 importé est retrouvé par son **chemin** (un essai précédent laisse un clip du même nom
  dans `_SOUS-TITRAGE`) ;
- le dossier `SRT_Vx` n'est créé qu'après les vérifications ; un dernier dossier resté
  **vide** après un essai raté est réutilisé au lieu d'en créer un nouveau ;
- préfixe `\\?\` retiré du chemin du projet dans le journal ;
- **découpage des sous-titres** refait : phrase par phrase, coupes choisies ensemble
  (après une ponctuation, avant « et / que / pour… », jamais après un petit mot comme
  « le, de, pour », pas de fin de phrase orpheline), 5,5 s max par sous-titre.

Format réel du JSON (`Transcript.exportToJSON`), confirmé :
```
{ "language": "fr-fr", "speakers": [...],
  "segments": [ { "start": 4.8, "duration": 23.8, "speaker": "<uuid>", "language": "fr-fr",
                  "words": [ { "text": "Je", "start": 4.8, "duration": 0.16,
                               "eos": false, "type": "word", "confidence": 1, "tags": [] } ] } ] }
```
Temps en secondes ; la ponctuation est collée au mot ; `eos` = fin de phrase.

Limite connue : la durée minimale de 3 s ne peut pas être respectée quand la parole est
dense (le sous-titre suivant commence avant) ; l'export manuel de Premiere fait pareil.

### 0.3.1
- le `<nom>.mp4.srt` écrit par le preset (légendes activées, séquence avec piste C1) est
  **supprimé** après l'export : le dossier ne garde que `<nom>.mp4` + `<nom>.srt`.

En production : laisser **décochée** la case « Garder le JSON de transcription (test) »,
pour que le dossier SRT envoyé à HappyScribe ne contienne que les MP4 et les SRT.
