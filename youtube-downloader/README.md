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

### Fonctionnement en "dossier a deposer" (recommande)

Le projet contient deux dossiers :
- **`Document Excel Avec Lien/`** : depose ici ton fichier Excel (ou Word/CSV/txt)
  contenant les liens. Le nom du fichier n'a pas d'importance et peut changer
  a chaque fois - le script prend tout ce qu'il trouve dans ce dossier.
- **`Videos/`** : c'est ici que les videos telechargees atterrissent.

A chaque nouveau lot de liens :
1. Supprime l'ancien fichier Excel dans `Document Excel Avec Lien/` (ou laisse-le,
   le script lit tous les fichiers presents et fusionne les liens - a toi de voir).
2. Depose le nouveau fichier Excel dans `Document Excel Avec Lien/`.
3. Double-clique sur `lancer_windows.bat` (Windows) ou `lancer_mac.command` (Mac).
   (Sur Mac, la premiere fois : clic droit > Ouvrir, pour autoriser l'execution.)

Les videos se telechargent **une par une** dans `Videos/`, sous le nom
`Titre de la video [identifiant].mp4`.

> Plus tard, si tu veux telecharger directement sur un disque dur externe
> (qui change selon les jours), il suffira de changer la ligne
> `DOSSIER_DESTINATION` dans `lancer_windows.bat` par le chemin du disque
> (ex: `E:\Videos`) - on ajustera ca ensemble le moment venu.

### Option ligne de commande (plus flexible)

```bash
python download_videos.py --input-folder "Document Excel Avec Lien" --output "Videos"
```

ou, pour viser un seul fichier precis :

```bash
python download_videos.py --input liens.xlsx --output "/chemin/vers/le/disque/dur/Videos"
```

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
- `--cookies-from-browser edge` (ou `chrome`, `firefox`...) : reutilise la
  session YouTube connectee de ton navigateur. A utiliser si tu obtiens une
  erreur du type "Sign in to confirm you're not a bot" (de plus en plus
  frequent sur YouTube en cas de telechargements repetes), ou pour recuperer
  une video avec restriction d'age / non repertoriee. Ferme bien le
  navigateur avant de lancer le script pour que yt-dlp puisse lire les
  cookies. Dans `lancer_windows.bat`, renseigne simplement la ligne
  `NAVIGATEUR=edge` pour l'activer automatiquement.

## 6. Cas particulier : extraits de concerts/clips pour montage

Pour un usage editorial (extraits diffuses dans une emission), deux points
a garder en tete, independants du fonctionnement technique du script :
- Le telechargement en lui-meme n'a aucune contrainte technique
  particuliere pour des clips ou concerts (meme qualite, meme fiabilite
  que n'importe quelle autre video).
- En revanche, la diffusion d'extraits dans une emission releve du droit
  d'auteur/droits voisins (SACEM, labels, ayants droit) - un sujet
  independant de l'outil de telechargement. Si ce n'est pas deja cadre
  avec les artistes/labels interviewes, ca vaut le coup de vérifier ce
  point separement.

## Depannage

| Probleme | Solution |
|---|---|
| `ModuleNotFoundError: No module named 'yt_dlp'` | Relance `pip install -r requirements.txt` |
| Erreur ffmpeg / pas de fusion video+audio | Verifie que ffmpeg est installe et dans le PATH (`ffmpeg -version` dans un terminal) |
| Une video precise refuse de se telecharger | Mets a jour yt-dlp (`pip install -U yt-dlp`), regarde le message d'erreur dans le journal CSV |
| "Aucun lien YouTube trouve" | Verifie que le fichier contient bien des liens `youtube.com` ou `youtu.be` |
| Premiere Pro refuse d'importer le MP4 ("unsupported compression type") alors que la video se lit normalement ailleurs | Le fichier est en VP9/AV1 (frequent au-dela de 1080p sur YouTube), pas toujours lu par Premiere. Le script telecharge desormais en priorite du H.264, compatible partout - remplace juste `download_videos.py` par la derniere version puis retelecharge la video concernee. |
