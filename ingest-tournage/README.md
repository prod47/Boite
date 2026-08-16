# ingest-tournage

Automatise la récupération des cartes après un tournage multicaméra (Sony
FX3, FS7, Blackmagic...) : tu branches tes lecteurs de cartes et tu pars —
le soir, tes rushes sont copiés et ton projet Premiere Pro est ouvert avec
tout importé.

Deux façons de l'utiliser :

- **`watcher.py`** (recommandé pour ton usage) : tourne en fond en
  permanence. Dès qu'une carte est branchée, il la copie et l'importe dans
  Premiere Pro tout seul — aucune action de ta part une fois que c'est
  installé.
- **`ingest.py`** : mode manuel, à lancer toi-même une fois que toutes les
  cartes sont branchées (utile pour tester, ou si tu préfères garder le
  contrôle sur le déclenchement).

## Installation (une seule fois)

### 1. Python et les dépendances

1. Installer [Python 3.10+](https://www.python.org/downloads/) (cocher "Add
   python.exe to PATH").
2. Dans ce dossier, ouvrir une invite de commandes et lancer :
   ```
   pip install -r requirements.txt
   ```
   Ce paquet (`pymiere`) est ce qui permet l'automatisation *complète* de
   Premiere (création de projet + import sans aucun clic). Sans lui, le
   script fonctionne quand même mais s'arrête à la copie des cartes.

### 2. Configurer `config.json`

- `base_folder` : le dossier où seront créés les dossiers `RUSHES_...`
- `premiere.premiere_exe` : le chemin exact vers `Adobe Premiere Pro.exe`
  chez toi
- `premiere.project_template` (optionnel) : un projet Premiere "modèle" à
  dupliquer à chaque nouvelle session (séquences déjà réglées, etc.)

### 3. Activer l'automatisation complète de Premiere (Pymiere Link)

Pour que Premiere Pro s'ouvre et importe les rushes **sans que tu aies à
cliquer sur quoi que ce soit** :

1. Installer l'extension [Pymiere Link](https://github.com/qmasingarbe/pymiere)
   dans Premiere Pro (voir son README pour l'installateur).
2. Ouvrir Premiere Pro une fois, et ouvrir le panneau `Fenêtre > Extensions
   > Pymiere Link` — ça démarre le petit serveur local dont `pymiere` a
   besoin.
3. **Important** : Premiere Pro rouvre normalement automatiquement les
   panneaux ouverts au dernier lancement. Ferme et relance Premiere pour
   vérifier que le panneau Pymiere Link se rouvre bien tout seul. Si ce
   n'est pas le cas, il faudra l'ouvrir manuellement à chaque lancement de
   Premiere — dans ce cas, garde Premiere Pro ouvert avec ce panneau plutôt
   que de compter sur `watcher.py` pour le relancer proprement.

Si tu sautes cette étape (pas de `pymiere`, ou Pymiere Link indisponible),
`watcher.py` copiera quand même tes cartes, mais n'ira pas plus loin — vois
la section "Que se passe-t-il si Premiere n'est pas automatisable" plus bas.

### 4. Lancer `watcher.py` automatiquement au démarrage de Windows

1. Appuie sur `Windows + R`, tape `shell:startup`, entrée. Ça ouvre ton
   dossier Démarrage.
2. Fais un raccourci de `lancer_watcher.bat` (clic droit sur le fichier >
   Créer un raccourci) et mets ce raccourci dans ce dossier Démarrage.
3. Redémarre le PC une fois pour vérifier qu'une fenêtre de terminal
   `watcher.py` s'ouvre bien toute seule à l'ouverture de session (tu peux
   la réduire, ne pas la fermer).

À partir de là, `watcher.py` tourne en permanence en tâche de fond dès que
tu es connecté à Windows : tu n'as plus jamais besoin de lancer quoi que ce
soit toi-même.

## Utilisation au quotidien

1. Tourne tes interviews.
2. Branche tous tes lecteurs de cartes sur le PC (dans n'importe quel
   ordre, en une fois ou au fur et à mesure).
3. Pars.
4. À ton retour : chaque carte a été copiée (une par une, jamais en
   parallèle, pour ne pas saturer les lecteurs USB) dans
   `RUSHES_<date>\CARTE_1`, `CARTE_2`, etc., et Premiere Pro est ouvert
   avec un projet `RUSHES_<date>.prproj` contenant un bin par carte, déjà
   importé.

Les cartes d'un même jour partagent le même projet/dossier de session :
tu peux brancher un deuxième lot de cartes plus tard dans la journée, elles
s'ajoutent au même projet sans écraser ce qui a déjà été importé. Le
lendemain, une nouvelle session (`RUSHES_<nouvelle date>`) démarre.

Une carte déjà traitée (identifiée par son numéro de série, pas sa lettre
de lecteur) n'est jamais recopiée, même si tu la laisses branchée ou si le
PC redémarre entre-temps.

### Que se passe-t-il si Premiere n'est pas automatisable

Si `pymiere`/Pymiere Link ne répondent pas (pas installés, Premiere pas
encore prêt, etc.), `watcher.py` continue de copier normalement toutes les
cartes détectées, et réessaie l'import à chaque passage (toutes les 5
secondes) jusqu'à ce que Premiere réponde — y compris si tu lances
Premiere toi-même en rentrant le soir. Rien n'est jamais perdu : les
cartes copiées mais pas encore importées sont mémorisées dans
`RUSHES_<date>\.etat_ingest.json`.

## Options de `ingest.py` (mode manuel)

- `--base "E:\Mon projet"` : dossier de destination pour cette session.
- `--include-fixed` : certains lecteurs CFexpress/USB-C sont vus par
  Windows comme des disques "fixes" et pas "amovibles", donc ignorés par
  défaut (ce réglage existe aussi dans `config.json` sous
  `include_fixed_drives`, utilisé aussi par `watcher.py`). Attention : ça
  inclut alors tous les disques fixes sauf le disque système, donc
  débranche les disques externes non concernés avant de lancer.
- `--dry-run` : simule sans rien copier ni toucher à Premiere.

## Sécurité

- Le script ne formate, ne supprime et ne modifie jamais le contenu des
  cartes : il ne fait que lire et copier.
- Chaque copie est vérifiée (taille totale + nombre de fichiers) ; toute
  carte suspecte est signalée dans les logs et dans `.etat_ingest.json`
  (`verifiee_ok: false`) — vérifie-la manuellement avant de reformater la
  carte source.
- Teste d'abord sur un tournage sans enjeu (ou avec des fichiers de test)
  pour valider que la détection des lecteurs, le chemin vers Premiere Pro
  et l'automatisation Pymiere Link fonctionnent bien chez toi, avant de
  compter dessus pour un vrai tournage.
- `pymiere`/Pymiere Link sont des outils communautaires non maintenus par
  Adobe : fiables aujourd'hui, mais susceptibles de casser à une future
  mise à jour de Premiere Pro. Si ça arrive, `ingest.py` (mode manuel)
  bascule automatiquement sur un script à lancer en un clic dans Premiere,
  qui lui repose sur l'API officielle et documentée d'Adobe.
