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
   de sous-titres, Premiere écrit aussi un `.srt` ; le plugin le remplace ensuite par le sien.
