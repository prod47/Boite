# ingest-tournage

Automatise la récupération des cartes après un tournage multicaméra (Sony
FX3, FS7, Blackmagic...) : tu branches tes lecteurs de cartes, tu double-
cliques sur un seul fichier, et tout le reste se fait tout seul — copie des
cartes, ouverture de Premiere Pro, création du projet, import de chaque
carte comme bin.

## Installation (une seule fois)

### 1. Python et les dépendances

1. Installer [Python 3.10+](https://www.python.org/downloads/) (cocher "Add
   python.exe to PATH").
2. Dans ce dossier, ouvrir une invite de commandes et lancer :
   ```
   pip install -r requirements.txt
   ```
   Ce paquet (`pymiere`) est ce qui permet à Premiere de créer le projet et
   d'importer les rushes tout seul. Sans lui, le script copie quand même les
   cartes, mais l'import Premiere demandera un clic de plus (voir plus bas).

### 2. Configurer `config.json`

- `base_folder` : le dossier où seront créés les dossiers `RUSHES_...`
- `premiere.premiere_exe` : le chemin exact vers `Adobe Premiere Pro.exe`
  chez toi
- `premiere.project_template` (optionnel) : un projet Premiere "modèle" à
  dupliquer à chaque session (séquences déjà réglées, etc.)

### 3. Activer l'automatisation complète de Premiere (Pymiere Link)

1. Installer l'extension [Pymiere Link](https://github.com/qmasingarbe/pymiere)
   dans Premiere Pro (voir son README pour l'installateur).
2. Ouvrir Premiere Pro une fois, et ouvrir le panneau `Fenêtre > Extensions
   > Pymiere Link` — ça démarre le petit serveur local dont `pymiere` a
   besoin pour piloter Premiere.
3. **Important** : Premiere Pro rouvre normalement automatiquement les
   panneaux ouverts au dernier lancement. Ferme et relance Premiere pour
   vérifier que le panneau Pymiere Link se rouvre bien tout seul — c'est ce
   qui permet au script de lancer Premiere lui-même et de le retrouver prêt
   sans que tu aies à rouvrir ce panneau à chaque fois.

Si tu sautes cette étape (pas de `pymiere`, ou Pymiere Link indisponible),
le script copiera quand même tes cartes, puis affichera comment finir
l'import en un clic dans Premiere — voir "Si Premiere n'est pas
automatisable" plus bas.

## Utilisation au quotidien

1. Tourne tes interviews.
2. Branche tous tes lecteurs de cartes sur le PC.
3. Double-clique sur `lancer_ingest.bat`. C'est le seul clic nécessaire.
4. Le script :
   - détecte toutes les cartes branchées,
   - copie chacune séquentiellement (une par une, jamais en parallèle, pour
     ne pas saturer les lecteurs USB) dans `RUSHES_<date_heure>\CARTE_1`,
     `CARTE_2`, etc., en vérifiant que la copie est complète,
   - lance Premiere Pro s'il n'est pas déjà ouvert, et attend qu'il soit
     prêt (jusqu'à 3 minutes),
   - crée le projet `RUSHES_<date_heure>.prproj` et importe chaque carte
     comme un bin séparé.
5. Tu peux partir dès que tu as double-cliqué : à ton retour, le terminal
   affiche "Tous les rushes ont été importés automatiquement dans Premiere
   Pro" et le projet est ouvert avec tout dedans.

### Options

- `--base "E:\Mon projet"` : dossier de destination pour cette session, sans
  modifier `config.json`.
- `--include-fixed` : certains lecteurs CFexpress/USB-C sont vus par
  Windows comme des disques "fixes" et pas "amovibles", donc ignorés par
  défaut. Attention : ça inclut alors tous les disques fixes sauf le disque
  système, donc débranche les disques externes non concernés avant de
  lancer.
- `--dry-run` : simule sans rien copier ni toucher à Premiere, pour vérifier
  quelles cartes seraient détectées.

### Si Premiere n'est pas automatisable

Si `pymiere`/Pymiere Link ne répondent toujours pas après 3 minutes d'attente
(pas installés, panneau pas ouvert, etc.), le script :

- a quand même copié toutes tes cartes normalement,
- génère un fichier `import_rushes.jsx` dans le dossier de session et lance
  Premiere Pro,
- affiche l'unique action manuelle qu'il reste : dans Premiere,
  `Fichier > Scripts > Exécuter le fichier de script...`, puis sélectionner
  ce fichier `.jsx`.

## Sécurité

- Le script ne formate, ne supprime et ne modifie jamais le contenu des
  cartes : il ne fait que lire et copier.
- Chaque copie est vérifiée (taille totale + nombre de fichiers) ; toute
  carte suspecte est signalée dans le terminal — vérifie-la manuellement
  avant de reformater la carte source.
- Teste d'abord sur un tournage sans enjeu (ou avec des fichiers de test)
  pour valider que la détection des lecteurs, le chemin vers Premiere Pro
  et l'automatisation Pymiere Link fonctionnent bien chez toi, avant de
  compter dessus pour un vrai tournage.
- `pymiere`/Pymiere Link sont des outils communautaires non maintenus par
  Adobe : fiables aujourd'hui, mais susceptibles de casser à une future
  mise à jour de Premiere Pro. Le mode de secours (script `.jsx` à lancer
  en un clic) repose lui sur l'API officielle et documentée d'Adobe, donc
  continuera de fonctionner même si `pymiere` casse un jour.
