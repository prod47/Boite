#!/usr/bin/env python3
"""
Telecharge en MP4 (meilleure qualite disponible) une liste de videos YouTube
listees dans un fichier Excel (.xlsx), Word (.docx), CSV ou texte brut.

Usage:
    python download_videos.py --input liens.xlsx --output "/chemin/vers/disque/dur/Videos"

Voir README.md pour l'installation et le guide complet.
"""

import argparse
import csv
import datetime
import re
import sys
from pathlib import Path

YOUTUBE_URL_RE = re.compile(
    r"https?://(?:www\.|m\.|music\.)?"
    r"(?:youtube\.com/(?:watch\?v=|shorts/|live/|embed/)[\w\-]+(?:[^\s\"'<>]*)?"
    r"|youtu\.be/[\w\-]+(?:[^\s\"'<>]*)?)"
)


def extract_urls_from_text(text: str) -> list[str]:
    return YOUTUBE_URL_RE.findall(text)


def extract_urls(input_path: Path) -> list[str]:
    suffix = input_path.suffix.lower()

    if suffix == ".xlsx":
        import openpyxl

        wb = openpyxl.load_workbook(input_path, data_only=True)
        chunks = []
        for ws in wb.worksheets:
            for row in ws.iter_rows():
                for cell in row:
                    if cell.value is not None:
                        chunks.append(str(cell.value))
        text = "\n".join(chunks)

    elif suffix == ".docx":
        import docx

        doc = docx.Document(input_path)
        chunks = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    chunks.append(cell.text)
        text = "\n".join(chunks)

    elif suffix == ".csv":
        with open(input_path, newline="", encoding="utf-8-sig") as f:
            text = "\n".join(",".join(row) for row in csv.reader(f))

    else:  # .txt ou autre : on lit tel quel
        text = input_path.read_text(encoding="utf-8", errors="ignore")

    urls = extract_urls_from_text(text)

    # dedoublonnage en gardant l'ordre d'apparition
    seen = set()
    ordered = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            ordered.append(u)
    return ordered


def build_ydl_opts(output_dir: Path, allow_playlist: bool):
    return {
        "format": "bv*+ba/b",
        "merge_output_format": "mp4",
        "outtmpl": str(output_dir / "%(title)s [%(id)s].%(ext)s"),
        "windowsfilenames": True,
        "noplaylist": not allow_playlist,
        "ignoreerrors": False,
        "quiet": False,
        "no_warnings": False,
    }


def download_all(urls: list[str], output_dir: Path, allow_playlist: bool) -> list[dict]:
    import yt_dlp

    output_dir.mkdir(parents=True, exist_ok=True)
    ydl_opts = build_ydl_opts(output_dir, allow_playlist)

    results = []
    total = len(urls)

    for i, url in enumerate(urls, start=1):
        print(f"\n=== [{i}/{total}] {url} ===")
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
            title = info.get("title", "?") if info else "?"
            results.append({"url": url, "status": "OK", "titre": title, "erreur": ""})
            print(f"OK : {title}")
        except Exception as exc:  # on continue sur l'erreur suivante
            results.append({"url": url, "status": "ECHEC", "titre": "", "erreur": str(exc)})
            print(f"ECHEC : {exc}", file=sys.stderr)

    return results


def write_log(results: list[dict], output_dir: Path) -> Path:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = output_dir / f"journal_telechargement_{timestamp}.csv"
    with open(log_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["url", "status", "titre", "erreur"])
        writer.writeheader()
        writer.writerows(results)
    return log_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input", "-i", required=True, type=Path,
        help="Fichier contenant les liens YouTube (.xlsx, .docx, .csv ou .txt)",
    )
    parser.add_argument(
        "--output", "-o", required=True, type=Path,
        help="Dossier de destination (ex: chemin vers le disque dur)",
    )
    parser.add_argument(
        "--playlist", action="store_true",
        help="Autoriser le telechargement de playlists entieres (par defaut : desactive, "
             "un seul lien = une seule video)",
    )
    args = parser.parse_args()

    if not args.input.exists():
        sys.exit(f"Fichier introuvable : {args.input}")

    urls = extract_urls(args.input)
    if not urls:
        sys.exit("Aucun lien YouTube trouve dans le fichier fourni.")

    print(f"{len(urls)} lien(s) YouTube trouve(s). Destination : {args.output}")

    results = download_all(urls, args.output, args.playlist)
    log_path = write_log(results, args.output)

    ok = sum(1 for r in results if r["status"] == "OK")
    echecs = len(results) - ok
    print(f"\nTermine : {ok} reussie(s), {echecs} echec(s).")
    print(f"Journal detaille : {log_path}")

    if echecs:
        sys.exit(1)


if __name__ == "__main__":
    main()
