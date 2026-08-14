"""Ingest automatique des cartes de tournage vers un dossier RUSHES,
puis import dans Premiere Pro.

Usage :
    python ingest.py [--base D:\\Tournages] [--include-fixed] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from copy_engine import copy_card
from drive_detect import list_candidate_drives
from premiere_import import launch_premiere_fallback, try_pymiere_import


def log(msg: str) -> None:
    print(msg)


def load_config(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copie les cartes de tournage détectées vers un dossier RUSHES, puis les importe dans Premiere Pro."
    )
    parser.add_argument("--base", help="Dossier de destination (par défaut : celui défini dans config.json)")
    parser.add_argument("--config", default=str(Path(__file__).with_name("config.json")))
    parser.add_argument(
        "--include-fixed",
        action="store_true",
        help="Inclure aussi les disques non 'amovibles' (utile si un lecteur CFexpress/USB-C n'est pas détecté)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Simuler sans copier ni ouvrir Premiere")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    base = Path(args.base or config.get("base_folder") or ".").resolve()

    include_fixed = args.include_fixed or bool(config.get("include_fixed_drives", False))
    drives = list_candidate_drives(include_fixed=include_fixed)

    if not drives:
        log("Aucune carte détectée. Vérifie que les lecteurs sont bien branchés,")
        log("ou relance avec --include-fixed si un lecteur apparaît comme disque fixe.")
        sys.exit(1)

    log(f"{len(drives)} carte(s) détectée(s) : " + ", ".join(str(d) for d in drives))

    session_name = f"RUSHES_{datetime.now():%Y%m%d_%H%M}"
    rushes_dir = base / session_name
    rushes_dir.mkdir(parents=True, exist_ok=True)
    log(f"Dossier de session : {rushes_dir}")

    card_dirs = []
    warnings = 0
    for i, drive in enumerate(drives, start=1):
        card_dir = rushes_dir / f"CARTE_{i}"
        log(f"[{i}/{len(drives)}] Copie de {drive} vers {card_dir} ...")
        if not args.dry_run:
            result = copy_card(drive, card_dir, log)
            if not result["ok"]:
                warnings += 1
        card_dirs.append(card_dir)

    if args.dry_run:
        log("Simulation terminée (--dry-run), aucune copie effectuée.")
        return

    log("Toutes les cartes ont été copiées." + (f" ({warnings} à vérifier)" if warnings else ""))

    premiere_config = config.get("premiere", {})
    imported = try_pymiere_import(rushes_dir, card_dirs, premiere_config.get("project_template"), log)
    if not imported:
        launch_premiere_fallback(rushes_dir, card_dirs, premiere_config.get("premiere_exe"), log)


if __name__ == "__main__":
    main()
