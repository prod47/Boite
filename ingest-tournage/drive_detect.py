"""Détection des lecteurs de cartes (cartes SD/CFexpress) branchés sur le PC."""
from __future__ import annotations

import ctypes
import os
import string
import sys
from pathlib import Path

if sys.platform != "win32":
    raise RuntimeError("ingest-tournage ne fonctionne que sous Windows (accès disque via l'API Windows).")

DRIVE_REMOVABLE = 2
DRIVE_FIXED = 3


def _drive_type(letter: str) -> int:
    return ctypes.windll.kernel32.GetDriveTypeW(ctypes.c_wchar_p(f"{letter}:\\"))


def _system_drive_letter() -> str:
    return os.environ.get("SystemDrive", "C:").rstrip(":\\").upper()


def list_present_drive_letters() -> list[str]:
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    return [letter for i, letter in enumerate(string.ascii_uppercase) if (bitmask >> i) & 1]


def list_candidate_drives(include_fixed: bool = False) -> list[Path]:
    """Renvoie les lecteurs à traiter comme des cartes de tournage.

    Certains lecteurs CFexpress/USB-C sont vus par Windows comme des disques
    "fixes" et non "amovibles" : passe include_fixed=True (ou --include-fixed)
    si une carte n'est pas détectée automatiquement.
    """
    system_letter = _system_drive_letter()
    drives = []
    for letter in list_present_drive_letters():
        if letter == system_letter:
            continue
        dtype = _drive_type(letter)
        if dtype == DRIVE_REMOVABLE or (include_fixed and dtype == DRIVE_FIXED):
            drives.append(Path(f"{letter}:\\"))
    return drives


def get_volume_serial(drive: Path) -> str:
    """Identifiant unique du volume (change au formatage, pas au contenu) :
    sert à reconnaître une carte déjà traitée sans dépendre de la lettre de
    lecteur, qui peut changer d'un branchement à l'autre."""
    root = f"{str(drive)[0]}:\\"
    serial = ctypes.c_uint32(0)
    ok = ctypes.windll.kernel32.GetVolumeInformationW(
        ctypes.c_wchar_p(root), None, 0, ctypes.byref(serial), None, None, None, 0
    )
    if not ok:
        raise OSError(f"Volume illisible ou pas encore prêt : {root}")
    return str(serial.value)
