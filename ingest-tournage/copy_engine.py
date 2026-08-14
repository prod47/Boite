"""Copie séquentielle et vérifiée du contenu d'une carte vers un dossier CARTE_N."""
from __future__ import annotations

import shutil
import time
from pathlib import Path
from typing import Callable

Logger = Callable[[str], None]


def folder_stats(path: Path) -> tuple[int, int]:
    total_size = 0
    file_count = 0
    for p in path.rglob("*"):
        if p.is_file():
            total_size += p.stat().st_size
            file_count += 1
    return total_size, file_count


def copy_card(source: Path, dest: Path, log: Logger) -> dict:
    """Copie tout le contenu de `source` dans `dest` et vérifie taille + nombre de fichiers."""
    dest.mkdir(parents=True, exist_ok=True)

    src_size, src_count = folder_stats(source)
    log(f"  Source : {src_count} fichiers, {src_size / 1e9:.2f} Go")

    start = time.time()
    for item in source.iterdir():
        target = dest / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)
    duration = time.time() - start

    dst_size, dst_count = folder_stats(dest)
    ok = dst_size == src_size and dst_count == src_count

    log(f"  Copié  : {dst_count} fichiers, {dst_size / 1e9:.2f} Go en {duration:.0f} s")
    if not ok:
        log(
            "  ATTENTION : la copie ne correspond pas exactement à la source "
            f"(source: {src_count} fichiers / {src_size} o, copie: {dst_count} fichiers / {dst_size} o). "
            "Vérifie ce dossier avant de formater la carte."
        )

    return {
        "ok": ok,
        "src_size": src_size,
        "dst_size": dst_size,
        "src_count": src_count,
        "dst_count": dst_count,
        "duration": duration,
    }
