# Telechargement automatique de videos YouTube (MP4, meilleure qualite)

Workflow simple : tu colles tes liens YouTube dans un fichier (Excel, Word,
CSV ou texte), tu lances un script, et les videos se telechargent une par
une en MP4 (meilleure qualite disponible) directement sur le disque dur de
ton choix.

Pas d'abonnement necessaire. L'outil utilise **yt-dlp**, un logiciel libre
et gratuit, maintenu tres activement (mises a jour quasi quotidiennes),
qui est aujourd'hui la reference pour ce genre de telechargement - bien
plus fiable que les sites web type "Yout" (qui d'ailleurs a ferme suite a
un litige juridique avec l'industrie musicale). Le seul "entretien" a
prevoir est de mettre l'outil a jour de temps en temps (voir plus bas),
car YouTube change regulierement son fonctionnement.

> Note : tu restes responsable de l'usage que tu fais des videos
> telechargees (droits d'auteur). Cet outil est prevu pour un usage
> personnel/archivage a partir de liens que l'on te transmet.

## 1. Installation (a faire une seule fois)

### a) Python
- Verifie que Python 3.10+ est installe : ouvre un terminal et tape
  `python3 --version` (Windows : `python --version`).
- Si ce n'est pas installe : https://www.python.org/downloads/ (coche
  "Add Python to PATH" pendant l'installation sur Windows).

### b) ffmpeg (necessaire pour assembler la meilleure video + le meilleur son en un seul MP4)
- **Windows** : https://www.gyan.dev/ffmpeg/builds/ (telecharge le build
  "essentials", decompresse, ajoute le dossier `bin` au PATH).
- **Mac** : `brew install ffmpeg` (avec [Homebrew](https://brew.sh)).

### c) Les dependances Python du projet
Dans un terminal, place-toi dans le dossier `youtube-downloader/` puis :

```bash
pip install -r requirements.txt
```

## 2. Preparer la liste de liens

Mets tes liens YouTube dans un fichier, au choix :

- **Excel (.xlsx)** : une colonne avec un lien par ligne (voir
  `exemple_liens.csv` pour le format, ouvrable et convertible en .xlsx
  dans Excel).
- **Word (.docx)** : colle simplement les liens dans le document, un par
  ligne ou dans un tableau.
- **CSV ou texte brut (.txt)** : un lien par ligne.

Le script repere automatiquement tous les liens YouTube presents dans le
fichier (peu importe la mise en forme, les colonnes ou le texte autour) -
pas besoin de "nettoyer" le fichier.

## 3. Lancer le telechargement

### Option simple : fichier a double-cliquer
1. Ouvre `lancer_windows.bat` (Windows) ou `lancer_mac.command` (Mac) avec
   un editeur de texte.
2. Modifie les deux lignes en haut du fichier :
   - `FICHIER_LIENS` : le chemin vers ton fichier de liens (ex :
     `liens.xlsx`, ou un chemin complet comme `C:\Users\toi\Bureau\liens.xlsx`).
   - `DOSSIER_DESTINATION` : le chemin vers le disque dur ou tu veux
     stocker les videos (ex : `D:\Videos` sur Windows, ou
     `/Volumes/MonDisqueDur/Videos` sur Mac).
3. Enregistre, puis double-clique sur le fichier a chaque fois que tu veux
   lancer un telechargement. (Sur Mac, la premiere fois : clic droit >
   Ouvrir, pour autoriser l'execution.)

### Option ligne de commande (plus flexible)

```bash
python download_videos.py --input liens.xlsx --output "/chemin/vers/le/disque/dur/Videos"
```

Les videos se telechargent **une par une**, dans l'ordre du fichier.
Chaque video est enregistree sous le nom
`Titre de la video [identifiant].mp4`.

A la fin, un fichier `journal_telechargement_AAAAMMJJ_HHMMSS.csv` est cree
dans le dossier de destination : il liste, pour chaque lien, si le
telechargement a reussi ou echoue (et pourquoi). Si une video echoue
(ex : lien prive, supprime...), le script continue avec les suivantes au
lieu de s'arreter.

## 4. Mettre a jour l'outil (recommande de temps en temps)

YouTube modifie regulierement son site, ce qui peut casser temporairement
le telechargement. La communaute yt-dlp publie des correctifs tres
rapidement. Pour mettre a jour :

```bash
pip install -U yt-dlp
```

Si un telechargement echoue avec une erreur du type "Unable to extract"
ou similaire, commence toujours par faire cette mise a jour.

## 5. Options utiles

- `--playlist` : si un lien pointe vers une playlist et que tu veux
  telecharger *toute* la playlist plutot que la seule video (par defaut,
  le script ne telecharge que la video precise du lien, meme si elle fait
  partie d'une playlist).

## Depannage

| Probleme | Solution |
|---|---|
| `ModuleNotFoundError: No module named 'yt_dlp'` | Relance `pip install -r requirements.txt` |
| Erreur ffmpeg / pas de fusion video+audio | Verifie que ffmpeg est installe et dans le PATH (`ffmpeg -version` dans un terminal) |
| Une video precise refuse de se telecharger | Mets a jour yt-dlp (`pip install -U yt-dlp`), regarde le message d'erreur dans le journal CSV |
| "Aucun lien YouTube trouve" | Verifie que le fichier contient bien des liens `youtube.com` ou `youtu.be` |
