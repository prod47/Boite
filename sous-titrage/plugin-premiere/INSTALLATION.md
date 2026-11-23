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

## Version de test (0.1)
Construit à partir des déclarations officielles de l'API Premiere 26.5.
Points à vérifier au premier essai : export immédiat, import du MP4, transcription
française, écriture du SRT. En cas d'erreur, envoyer une capture du journal.
