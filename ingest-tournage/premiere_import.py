"""Import des rushes dans Premiere Pro : automatique via pymiere si possible,
sinon génération d'un script ExtendScript à lancer manuellement en un clic."""
from __future__ import annotations

import json
import subprocess
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


def try_pymiere_import(
    rushes_dir: Path,
    card_dirs: list[Path],
    project_template: str | None,
    log: Logger,
) -> bool:
    """Tente l'automatisation complète via pymiere (nécessite l'extension
    "Pymiere Link" installée dans Premiere Pro et Premiere Pro déjà ouvert)."""
    try:
        import pymiere
    except ImportError:
        return False

    try:
        app = pymiere.objects.app
        project_path = rushes_dir / f"{rushes_dir.name}.prproj"

        if project_template and Path(project_template).exists():
            app.openDocument(str(project_template))
            app.project.saveAs(str(project_path))
        else:
            app.newProject(str(project_path))

        proj = app.project
        for card_dir in card_dirs:
            bin_ = proj.rootItem.createBin(card_dir.name)
            files = _collect_files(card_dir)
            if files:
                proj.importFiles(files, True, bin_, False)
        proj.save()

        log(f"Projet Premiere créé et rushes importés automatiquement : {project_path}")
        return True
    except Exception as exc:  # pymiere/Premiere non disponibles ou en erreur
        log(f"pymiere était disponible mais l'automatisation a échoué ({exc}).")
        log("Bascule sur le mode 'script à lancer en un clic dans Premiere'.")
        return False


def launch_premiere_fallback(
    rushes_dir: Path,
    card_dirs: list[Path],
    premiere_exe: str | None,
    log: Logger,
) -> None:
    jsx_path = build_jsx(rushes_dir, card_dirs)
    log(f"Script d'import généré : {jsx_path}")

    if premiere_exe and Path(premiere_exe).exists():
        subprocess.Popen([premiere_exe])
        log("Lancement de Premiere Pro...")

    log("Dans Premiere Pro : ouvre ou crée ton projet, puis va dans")
    log("  Fichier > Scripts > Exécuter le fichier de script...")
    log(f"et sélectionne : {jsx_path}")


# --- Fonctions utilisées par watcher.py (mode surveillance / zéro clic) ----


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
