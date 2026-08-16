"""Mode surveillance : à lancer une fois (au démarrage de Windows, voir
README), il tourne en fond en permanence. Il suffit ensuite de brancher les
lecteurs de cartes — tout le reste (copie, ouverture de Premiere Pro, import)
se fait sans aucune autre action.
"""
from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path

from copy_engine import copy_card, folder_stats
from drive_detect import get_volume_serial, list_candidate_drives
from premiere_import import ensure_premiere_running, import_card, open_or_create_project, pymiere_app_or_none

POLL_SECONDS = 5


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def load_config(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def session_dir(base: Path) -> Path:
    d = base / f"RUSHES_{datetime.now():%Y%m%d}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_state(state_path: Path) -> dict:
    if state_path.exists():
        return json.loads(state_path.read_text(encoding="utf-8"))
    return {}


def save_state(state_path: Path, state: dict) -> None:
    state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    config = load_config(Path(__file__).with_name("config.json"))
    base = Path(config.get("base_folder", ".")).resolve()
    include_fixed = bool(config.get("include_fixed_drives", False))
    premiere_config = config.get("premiere", {})

    log(f"Surveillance démarrée. Dossier de destination : {base}")
    log("Branche tes lecteurs de cartes quand tu veux : tout se fait automatiquement.")

    last_sizes: dict[str, int] = {}
    project_ready = False

    while True:
        try:
            session = session_dir(base)
            state_path = session / ".etat_ingest.json"
            state = load_state(state_path)

            for drive in list_candidate_drives(include_fixed=include_fixed):
                try:
                    serial = get_volume_serial(drive)
                except OSError:
                    continue  # carte pas encore montée / lecteur vide

                if serial in state:
                    continue

                # on attend que la taille du contenu soit stable avant de copier
                # (le temps que Windows termine de monter la carte)
                size, _ = folder_stats(drive)
                key = f"{serial}:{drive}"
                previous = last_sizes.get(key)
                last_sizes[key] = size
                if size == 0 or previous != size:
                    continue

                index = len(state) + 1
                card_dir = session / f"CARTE_{index}"
                log(f"Nouvelle carte détectée sur {drive} -> {card_dir}")
                result = copy_card(drive, card_dir, log)
                state[serial] = {
                    "dossier": card_dir.name,
                    "importee": False,
                    "verifiee_ok": result["ok"],
                }
                save_state(state_path, state)
                log(f"Carte copiée : {card_dir.name}" + ("" if result["ok"] else " -- À VÉRIFIER MANUELLEMENT"))

            pending = [s for s, v in state.items() if not v["importee"]]
            if pending:
                had_to_launch = ensure_premiere_running(premiere_config.get("premiere_exe"), log)
                if had_to_launch:
                    project_ready = False  # Premiere vient de (re)démarrer, il faudra rouvrir le projet

                app = pymiere_app_or_none()
                if app is not None:
                    if not project_ready:
                        project_ready = open_or_create_project(
                            app, session, premiere_config.get("project_template"), log
                        )
                    if project_ready:
                        for serial in pending:
                            card_dir = session / state[serial]["dossier"]
                            if import_card(app, card_dir, log):
                                state[serial]["importee"] = True
                                save_state(state_path, state)

        except Exception as exc:  # la surveillance ne doit jamais s'arrêter
            log(f"Erreur inattendue, la surveillance continue : {exc}")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
