# ingest-tournage

Script Windows pour automatiser la récupération des cartes après un tournage
multicaméra (Sony FX3, FS7, Blackmagic...) :

1. Détecte tous les lecteurs de cartes branchés.
2. Crée un dossier `RUSHES_<date>_<heure>` avec un sous-dossier `CARTE_1`,
   `CARTE_2`, etc. (un par carte détectée).
3. Copie le contenu de chaque carte **une par une** (pas en parallèle, pour
   éviter les erreurs de lecture/écriture sur plusieurs lecteurs USB en même
   temps) et vérifie que la copie correspond bien à la source (nombre de
   fichiers + taille totale).
4. Une fois toutes les cartes copiées, ouvre Premiere Pro et importe chaque
   dossier `CARTE_N` comme un bin séparé dans le projet.

## Installation (une seule fois)

1. Installer [Python 3.10+](https://www.python.org/downloads/) (cocher "Add
   python.exe to PATH" pendant l'installation).
2. Ouvrir une invite de commandes dans ce dossier et lancer :
   ```
   pip install -r requirements.txt
   ```
   (cette étape est optionnelle — voir "Les deux modes d'import" ci-dessous)
3. Ouvrir `config.json` et adapter :
   - `base_folder` : le dossier où seront créés tes dossiers `RUSHES_...`
   - `premiere.premiere_exe` : le chemin exact vers `Adobe Premiere Pro.exe`
     chez toi (vérifie la version dans le nom du dossier `Program Files`)
   - `premiere.project_template` (optionnel) : chemin vers un projet Premiere
     "modèle" à dupliquer à chaque session (séquences déjà réglées, etc.)

## Utilisation

1. Tourne tes interviews, puis branche tous tes lecteurs de cartes sur le PC.
2. Double-clique sur `lancer_ingest.bat` (ou lance `python ingest.py` dans un
   terminal).
3. Le script détecte les cartes, copie chacune séquentiellement en affichant
   la progression, puis lance l'import dans Premiere Pro.
4. Une fois que tu vois "Import terminé" dans Premiere (ou dans le terminal),
   vérifie le contenu de `RUSHES_.../CARTE_N` avant de formater tes cartes.

### Options utiles

- `--base "E:\Mon projet"` : choisir le dossier de destination pour cette
  session sans modifier `config.json`.
- `--include-fixed` : certains lecteurs CFexpress/USB-C sont vus par Windows
  comme des disques "fixes" et pas "amovibles", donc ignorés par défaut.
  Utilise cette option s'il manque une carte à l'appel (attention : ça inclut
  alors tous les disques fixes sauf le disque système, donc débranche les
  disques externes non concernés avant de lancer).
- `--dry-run` : simule sans rien copier ni toucher à Premiere, pour vérifier
  quelles cartes seraient détectées.

## Les deux modes d'import Premiere

- **Sans rien installer de plus** : le script génère un fichier
  `import_rushes.jsx` dans le dossier `RUSHES_...` et ouvre Premiere Pro.
  Il ne reste qu'un clic à faire : dans Premiere,
  `Fichier > Scripts > Exécuter le fichier de script...` puis sélectionner ce
  fichier `.jsx`. Fiable, officiellement supporté par Adobe.
- **Automatisation complète (0 clic)** : installe le paquet `pymiere`
  (`pip install -r requirements.txt`) et l'extension
  [Pymiere Link](https://github.com/qmasingarbe/pymiere) dans Premiere Pro.
  Une fois configuré, le script crée le projet et importe les rushes tout
  seul. C'est un outil communautaire non maintenu par Adobe : ça fonctionne
  bien aujourd'hui, mais peut casser à une future mise à jour de Premiere. Si
  ça échoue, le script bascule automatiquement sur le mode "un clic"
  ci-dessus.

## Sécurité

- Le script ne formate, ne supprime et ne modifie jamais le contenu des
  cartes : il ne fait que lire et copier.
- La vérification (taille + nombre de fichiers) affiche une alerte si une
  copie semble incomplète — vérifie manuellement le dossier concerné avant de
  reformater la carte source.
- Teste d'abord sur un tournage sans enjeu (ou avec des fichiers de test)
  pour valider que la détection des lecteurs et le chemin vers Premiere Pro
  sont corrects chez toi.
