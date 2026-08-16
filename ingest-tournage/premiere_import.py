"""Import des rushes dans Premiere Pro : automatique via pymiere si possible,
sinon génération d'un script ExtendScript à lancer manuellement en un clic."""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Callable

Logger = Callable[[str], None]

JSX_TEMPLATE = """// Généré automatiquement par ingest-tournage — ne pas éditer à la main
(function () {{
    var cardFolders = {card_folders_json};

    var proj = app.project;
    if (!proj) {{
        alert("Ouvre ou crée d'abord un projet Premiere Pro, puis relance ce script.");
        return;
    }}

    for (var i = 0; i < cardFolders.length; i++) {{
        var folder = cardFolders[i];
        var bin = proj.rootItem.createBin(folder.name);
        if (folder.files.length > 0) {{
            proj.importFiles(folder.files, true, bin, false);
        }}
    }}

    if (typeof proj.save === "function") {{
        proj.save();
    }}

    alert("Import terminé : " + cardFolders.length + " carte(s) importée(s).");
}})();
"""


def _collect_files(card_dir: Path) -> list[str]:
    return [str(p) for p in card_dir.rglob("*") if p.is_file()]


def build_jsx(rushes_dir: Path, card_dirs: list[Path]) -> Path:
    folders = [{"name": c.name, "files": _collect_files(c)} for c in card_dirs]
    jsx = JSX_TEMPLATE.format(card_folders_json=json.dumps(folders))
    jsx_path = rushes_dir / "import_rushes.jsx"
    jsx_path.write_text(jsx, encoding="utf-8")
    return jsx_path


def import_via_pymiere_with_wait(
    rushes_dir: Path,
    card_dirs: list[Path],
    premiere_config: dict,
    log: Logger,
    timeout_seconds: int = 180,
) -> bool:
    """Automatisation complète en un seul clic de départ : lance Premiere Pro
    si besoin, attend qu'il soit prêt (jusqu'à `timeout_seconds`), puis crée
    le projet et importe toutes les cartes. Nécessite `pymiere` installé et
    l'extension Pymiere Link ouverte dans Premiere (voir README)."""
    try:
        import pymiere  # noqa: F401  (juste pour vérifier que le paquet est installé)
    except ImportError:
        log("pymiere n'est pas installé (pip install -r requirements.txt) : import Premiere automatique désactivé.")
        return False

    ensure_premiere_running(premiere_config.get("premiere_exe"), log)

    log(f"Attente que Premiere Pro (+ panneau Pymiere Link) soit prêt (jusqu'à {timeout_seconds}s)...")
    deadline = time.time() + timeout_seconds
    app = None
    while time.time() < deadline:
        app = pymiere_app_or_none()
        if app is not None:
            break
        time.sleep(3)

    if app is None:
        log(f"Premiere Pro n'a pas répondu après {timeout_seconds}s.")
        log("Vérifie que le panneau Fenêtre > Extensions > Pymiere Link est bien ouvert dans Premiere.")
        return False

    if not open_or_create_project(app, rushes_dir, premiere_config.get("project_template"), log):
        return False

    ok = True
    for card_dir in card_dirs:
        if not import_card(app, card_dir, log):
            ok = False

    if ok:
        log("Tous les rushes ont été importés automatiquement dans Premiere Pro.")
    return ok


def launch_premiere_fallback(
    rushes_dir: Path,
    card_dirs: list[Path],
    premiere_exe: str | None,
    log: Logger,
) -> None:
    jsx_path = build_jsx(rushes_dir, card_dirs)
    log(f"Script d'import généré : {jsx_path}")

    ensure_premiere_running(premiere_exe, log)

    log("Dans Premiere Pro : ouvre ou crée ton projet, puis va dans")
    log("  Fichier > Scripts > Exécuter le fichier de script...")
    log(f"et sélectionne : {jsx_path}")


# --- Fonctions communes (utilisées par ingest.py et watcher.py) -----------


def is_premiere_running(exe_name: str) -> bool:
    try:
        out = subprocess.check_output(
            ["tasklist", "/FI", f"IMAGENAME eq {exe_name}"],
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    except Exception:
        return False
    return exe_name.lower() in out.lower()


def ensure_premiere_running(premiere_exe: str | None, log: Logger) -> bool:
    """Lance Premiere Pro s'il n'est pas déjà ouvert. Renvoie True si Premiere
    a dû être lancé (donc pas encore prêt à recevoir des commandes)."""
    if not premiere_exe:
        return False
    exe_name = Path(premiere_exe).name
    if is_premiere_running(exe_name):
        return False
    log("Premiere Pro n'est pas ouvert : lancement...")
    subprocess.Popen([premiere_exe])
    return True


def pymiere_app_or_none():
    """Renvoie l'objet app pymiere si Premiere Pro + le panneau Pymiere Link
    répondent bien, sinon None (pas d'exception levée)."""
    try:
        import pymiere

        app = pymiere.objects.app
        _ = app.project  # force une vraie requête pour vérifier la connexion
        return app
    except Exception:
        return None


def open_or_create_project(app, session_dir: Path, project_template: str | None, log: Logger) -> bool:
    """Ouvre le projet de la session s'il existe déjà (créé par un précédent
    passage du watcher aujourd'hui), sinon le crée. Ne fait rien si un projet
    correspondant semble déjà ouvert."""
    project_path = session_dir / f"{session_dir.name}.prproj"
    try:
        if project_path.exists():
            app.openDocument(str(project_path))
            log(f"Projet Premiere de la session rouvert : {project_path}")
        elif project_template and Path(project_template).exists():
            app.openDocument(str(project_template))
            app.project.saveAs(str(project_path))
            log(f"Projet Premiere créé depuis le modèle : {project_path}")
        else:
            app.newProject(str(project_path))
            log(f"Nouveau projet Premiere créé : {project_path}")
        return True
    except Exception as exc:
        log(f"Impossible d'ouvrir/créer le projet Premiere ({exc}).")
        return False


def import_card(app, card_dir: Path, log: Logger) -> bool:
    try:
        proj = app.project
        bin_ = proj.rootItem.createBin(card_dir.name)
        files = _collect_files(card_dir)
        if files:
            proj.importFiles(files, True, bin_, False)
        proj.save()
        log(f"  Importée dans Premiere : {card_dir.name}")
        return True
    except Exception as exc:
        log(f"  Import Premiere de {card_dir.name} en échec ({exc}), nouvelle tentative plus tard.")
        return False
