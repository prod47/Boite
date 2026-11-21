"""Transcription FR d'une vidéo en SRT avec Whisper large-v3.
Usage: python transcrire.py video.mp4 [sortie.srt] [--noms "Nom1, Nom2"]
Découpage proche de Premiere : 42 caractères max par ligne, 2 lignes max.
"""
import argparse, time
from faster_whisper import WhisperModel

MAX_LIGNE = 42
MAX_LIGNES = 2
MAX_DUREE = 7.0
PAUSE_COUPE = 0.7  # une pause plus longue force un nouveau sous-titre


def ts(s):
    ms = int(round(s * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    sec, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{sec:02},{ms:03}"


def texte_de(mots):
    return "".join(mots).strip()


def couper_lignes(mots):
    lignes, cur = [], ""
    for t in texte_de(mots).split():
        essai = (cur + " " + t).strip()
        if len(essai) > MAX_LIGNE and cur:
            lignes.append(cur)
            cur = t
        else:
            cur = essai
    if cur:
        lignes.append(cur)
    return lignes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("sortie", nargs="?")
    ap.add_argument("--noms", default="", help="noms propres à reconnaître")
    a = ap.parse_args()
    sortie = a.sortie or a.video.rsplit(".", 1)[0] + "_whisper.srt"

    t0 = time.time()
    model = WhisperModel("large-v3", device="cpu", compute_type="int8")
    prompt = "Bonjour, voici la transcription de l'interview. Elle est bien ponctuée, avec des majuscules."
    if a.noms:
        prompt += f" Noms : {a.noms}."
    segments, _ = model.transcribe(
        a.video, language="fr", word_timestamps=True, vad_filter=True,
        initial_prompt=prompt, condition_on_previous_text=True,
    )

    mots = [w for seg in segments for w in seg.words]
    cues, bloc = [], []
    for w in mots:
        if bloc:
            texte = texte_de([x.word for x in bloc + [w]])
            trop_long = len(couper_lignes([x.word for x in bloc + [w]])) > MAX_LIGNES
            pause = w.start - bloc[-1].end > PAUSE_COUPE
            duree = w.end - bloc[0].start > MAX_DUREE
            fin_phrase = bloc[-1].word.strip()[-1:] in ".?!"
            if trop_long or pause or duree or (fin_phrase and len(texte) > 20):
                cues.append(bloc)
                bloc = []
        bloc.append(w)
    if bloc:
        cues.append(bloc)

    with open(sortie, "w", encoding="utf-8") as f:
        for i, c in enumerate(cues, 1):
            lignes = couper_lignes([x.word for x in c])
            f.write(f"{i}\n{ts(c[0].start)} --> {ts(c[-1].end)}\n" + "\n".join(lignes) + "\n\n")
    print(f"OK : {sortie} ({len(cues)} sous-titres, {time.time()-t0:.0f}s)")


if __name__ == "__main__":
    main()
