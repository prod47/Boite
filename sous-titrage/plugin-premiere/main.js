// Plugin « Sous-titrage Happy Scribe » pour Premiere Pro 26.5+ (UXP)
// Pour chaque séquence du chutier choisi (EXPORT par défaut) :
//  1. timecode de début mis à 00:00:00:00
//  2. export MP4 avec le preset « Happy Scribe » dans <dossier client>\SRT\
//  3. transcription Premiere (français) du MP4
//  4. création du SRT (mêmes règles que « Créer des sous-titres ») à côté du MP4

const ppro = require("premierepro");
const uxp = require("uxp");
const fs = require("fs");
const { transcriptionVersSRT } = require("./srt.js");

const $ = (id) => document.getElementById(id);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Journal ----------
function log(msg, type = "") {
  const li = document.createElement("div");
  li.className = "ligne " + type;
  li.textContent = msg;
  $("journal").appendChild(li);
  $("journal").scrollTop = $("journal").scrollHeight;
}

// ---------- Réglages mémorisés ----------
const reglages = {
  get preset() { try { return localStorage.getItem("presetHS") || ""; } catch { return ""; } },
  set preset(v) { try { localStorage.setItem("presetHS", v); } catch {} },
  get chutier() { try { return localStorage.getItem("chutier") || "EXPORT"; } catch { return "EXPORT"; } },
  set chutier(v) { try { localStorage.setItem("chutier", v); } catch {} },
};

// ---------- Fichiers ----------
const sep = "\\";
const dossierDe = (chemin) => chemin.substring(0, Math.max(chemin.lastIndexOf("\\"), chemin.lastIndexOf("/")));
const nomPropre = (n) => n.replace(/[<>:"/\\|?*]/g, "_").trim();

async function existe(chemin) {
  try { await fs.lstat(chemin); return true; } catch { return false; }
}

async function taille(chemin) {
  try { return (await fs.lstat(chemin)).size; } catch { return -1; }
}

async function estVide(chemin) {
  try { return (await fs.readdir(chemin)).length === 0; } catch { return false; }
}

// SRT, puis SRT_V2, SRT_V3… (un dernier dossier resté vide après un essai raté est réutilisé)
async function creerDossierSRT(dossierClient) {
  let nom = "SRT";
  let n = 1;
  let dernier = null;
  while (await existe(dossierClient + sep + nom)) {
    dernier = dossierClient + sep + nom;
    n += 1;
    nom = "SRT_V" + n;
  }
  if (dernier && (await estVide(dernier))) return dernier;
  const chemin = dossierClient + sep + nom;
  await fs.mkdir(chemin);
  return chemin;
}

// Attend que le fichier existe et que sa taille ne bouge plus
async function attendreFichier(chemin, timeoutMin = 60) {
  const fin = Date.now() + timeoutMin * 60000;
  let prec = -2;
  let stable = 0;
  while (Date.now() < fin) {
    const t = await taille(chemin);
    if (t > 0 && t === prec) {
      stable += 1;
      if (stable >= 3) return true;
    } else {
      stable = 0;
    }
    prec = t;
    await pause(2000);
  }
  return false;
}

// ---------- Projet ----------
// Les actions doivent être CRÉÉES et exécutées sous lockedAccess
// (sinon Premiere renvoie « Requires locked access »).
function transaction(projet, fabrique, libelle) {
  let ok = false;
  let erreur = null;
  projet.lockedAccess(() => {
    try {
      ok = projet.executeTransaction((ca) => ca.addAction(fabrique()), libelle);
    } catch (e) {
      erreur = e;
    }
  });
  if (erreur) throw erreur;
  return ok;
}

const estChutier = (item) => item.type === ppro.ProjectItem.TYPE_BIN;

async function enClip(item) {
  if (estChutier(item)) return null;
  try {
    const clip = ppro.ClipProjectItem.cast(item);
    if (clip && typeof clip.isSequence === "function") return clip;
  } catch {}
  return null;
}

async function enDossier(item) {
  if (!estChutier(item)) return null;
  try {
    const f = ppro.FolderItem.cast(item);
    if (f && typeof f.getItems === "function") {
      await f.getItems();
      return f;
    }
  } catch {}
  return null;
}

// Cherche un chutier par nom (récursif)
async function trouverChutier(dossier, nom) {
  for (const item of await dossier.getItems()) {
    const f = await enDossier(item);
    if (!f) continue;
    if (item.name.trim().toLowerCase() === nom.trim().toLowerCase()) return f;
    const sous = await trouverChutier(f, nom);
    if (sous) return sous;
  }
  return null;
}

async function sequencesDuChutier(chutier) {
  const res = [];
  for (const item of await chutier.getItems()) {
    const clip = await enClip(item);
    if (clip && (await clip.isSequence())) {
      res.push({ nom: item.name, sequence: await clip.getSequence() });
    }
  }
  return res;
}

async function chutierDeTravail(projet) {
  const racine = await projet.getRootItem();
  let f = await trouverChutier(racine, "_SOUS-TITRAGE");
  if (!f) {
    transaction(projet, () => racine.createBinAction("_SOUS-TITRAGE", false), "Chutier sous-titrage");
    f = await trouverChutier(racine, "_SOUS-TITRAGE");
  }
  return f;
}

async function importerEtTrouver(projet, chutier, chemin, nom) {
  const ok = await projet.importFiles([chemin], true, ppro.ProjectItem.cast(chutier), false);
  if (!ok) throw new Error("import impossible : " + chemin);
  // On retrouve le clip par son chemin (un essai précédent peut avoir laissé un clip du même nom)
  const cible = chemin.replace(/\//g, "\\").toLowerCase();
  for (let i = 0; i < 40; i++) {
    for (const item of await chutier.getItems()) {
      if (item.name !== nom && item.name !== nom.replace(/\.mp4$/i, "")) continue;
      const clip = await enClip(item);
      if (!clip) continue;
      let p = "";
      try { p = (await clip.getMediaFilePath()) || ""; } catch {}
      if (p.replace(/\//g, "\\").replace(/^\\\\\?\\/, "").toLowerCase() === cible) return clip;
    }
    await pause(500);
  }
  throw new Error("clip importé introuvable : " + chemin);
}

// ---------- Transcription ----------
function codeFrancais() {
  const langues = ppro.Transcript.querySupportedLanguages() || [];
  const fr = langues.find((l) => /^fr/i.test(l.languageCode) || /^fr/i.test(l.locale));
  if (!fr) throw new Error("Français non disponible pour la transcription");
  if (ppro.Transcript.isLanguagePackAvailable && !ppro.Transcript.isLanguagePackAvailable(fr.languageCode)) {
    log("⚠ Pack de langue français peut-être non installé (" + fr.languageCode + ")", "warn");
  }
  return fr.languageCode;
}

// Nombre de mots dans le JSON (0 si pas encore prêt)
function nbMots(json) {
  try {
    const d = JSON.parse(json);
    return (d.segments || []).reduce((n, s) => n + ((s.words && s.words.length) || 0), 0);
  } catch { return 0; }
}

// transcribeClipProjectItem rend la main avant la fin : hasTranscript() passe à true
// tout de suite avec un JSON vide (language "und-zz", words: []). On attend donc que
// des mots apparaissent et que leur nombre ne bouge plus.
async function transcrire(clip, langue, timeoutMin = 60) {
  let json = ppro.Transcript.hasTranscript(clip) ? await ppro.Transcript.exportToJSON(clip) : "";
  if (nbMots(json) > 0) return json;

  const ok = await ppro.Transcript.transcribeClipProjectItem(clip, { language: langue });
  if (!ok) throw new Error("la transcription a été refusée par Premiere");
  const debut = Date.now();
  const fin = debut + timeoutMin * 60000;
  let prec = -1;
  let stable = 0;
  while (Date.now() < fin) {
    await pause(5000);
    json = ppro.Transcript.hasTranscript(clip) ? await ppro.Transcript.exportToJSON(clip) : "";
    const n = nbMots(json);
    if (n > 0 && n === prec) {
      stable += 1;
      if (stable >= 2) return json;
    } else {
      stable = 0;
    }
    prec = n;
  }
  throw new Error("transcription vide ou trop longue (" + Math.round((Date.now() - debut) / 60000) + " min)");
}

// ---------- Traitement ----------
async function traiterSequence(projet, ctx, { nom, sequence }) {
  const base = nomPropre(nom);
  const mp4 = ctx.dossierSRT + sep + base + ".mp4";
  const srt = ctx.dossierSRT + sep + base + ".srt";

  // 1. Timecode de début à 0
  const zero = await sequence.getZeroPoint();
  if (zero && zero.ticksNumber !== 0) {
    const zeroOk = transaction(projet, () => sequence.createSetZeroPointAction(ppro.TickTime.createWithSeconds(0)), "Timecode 00:00:00:00");
    if (!zeroOk) throw new Error("impossible de remettre le timecode à 00:00:00:00");
    log("  timecode de début remis à 00:00:00:00");
  }

  // 2. Export MP4 (preset Happy Scribe)
  log("  export MP4…");
  const encodeur = ppro.EncoderManager.getManager();
  const erreurs = [];
  const surErreur = (e) => erreurs.push(e);
  try { ppro.EventManager.addEventListener(encodeur, ppro.EncoderManager.EVENT_RENDER_ERROR, surErreur); } catch {}
  const okExport = await encodeur.exportSequence(sequence, ppro.Constants.ExportType.IMMEDIATELY, mp4, ctx.preset, true);
  if (!okExport) throw new Error("l'export a été refusé par Premiere");
  const fini = await attendreFichier(mp4);
  try { ppro.EventManager.removeEventListener(encodeur, ppro.EncoderManager.EVENT_RENDER_ERROR, surErreur); } catch {}
  if (erreurs.length) log("  ⚠ Premiere signale une erreur d'export : " + JSON.stringify(erreurs[0]), "warn");
  if (!fini) throw new Error("export MP4 non terminé");
  log("  MP4 exporté ✓");

  // Le preset (légendes activées) écrit aussi <nom>.mp4.srt si la séquence a une piste
  // de sous-titres : on le supprime pour ne garder que notre <nom>.srt.
  const srtPreset = mp4 + ".srt";
  for (let i = 0; i < 5; i++) {
    if (await existe(srtPreset)) {
      await pause(1000);
      try {
        await fs.unlink(srtPreset);
        log("  SRT du preset (" + base + ".mp4.srt) supprimé");
      } catch (e) {
        log("  ⚠ impossible de supprimer " + base + ".mp4.srt : " + (e.message || e), "warn");
      }
      break;
    }
    await pause(1000);
  }

  // 3. Transcription Premiere du MP4
  log("  transcription Premiere (français)…");
  const clip = await importerEtTrouver(projet, ctx.chutierTravail, mp4, base + ".mp4");
  const json = await transcrire(clip, ctx.langue);

  if ($("debug").checked) {
    await fs.writeFile(ctx.dossierSRT + sep + base + ".transcription.json", json, { encoding: "utf-8" });
    log("  JSON de transcription gardé (débogage)", "warn");
  }

  // 4. SRT
  const contenu = transcriptionVersSRT(json);
  if (!contenu.trim()) throw new Error("SRT vide : la transcription ne contient aucun mot");
  await fs.writeFile(srt, contenu, { encoding: "utf-8" });
  log("  SRT créé ✓");
}

async function lancer() {
  $("go").disabled = true;
  $("journal").innerHTML = "";
  try {
    const preset = await presetActif();
    if (!preset) throw new Error("Preset « Happy Scribe » introuvable : choisis le fichier .epr.");

    const projet = await ppro.Project.getActiveProject();
    if (!projet) throw new Error("Aucun projet ouvert.");

    const nomChutier = $("chutier").value.trim() || "EXPORT";
    reglages.chutier = nomChutier;
    let liste;
    if ($("mode").value === "active") {
      const seq = await projet.getActiveSequence();
      if (!seq) throw new Error("Aucune séquence active.");
      liste = [{ nom: seq.name, sequence: seq }];
    } else {
      const chutier = await trouverChutier(await projet.getRootItem(), nomChutier);
      if (!chutier) throw new Error(`Chutier « ${nomChutier} » introuvable.`);
      liste = await sequencesDuChutier(chutier);
    }
    if (!liste.length) throw new Error("Aucune séquence à traiter.");

    // Préparatifs avant de créer le dossier (pas de dossier vide si ça échoue)
    const langue = codeFrancais();
    const chutierTravail = await chutierDeTravail(projet);
    if (!chutierTravail) throw new Error("chutier _SOUS-TITRAGE impossible à créer");

    const dossierClient = dossierDe(projet.path).replace(/^\\\\\?\\/, ""); // retire le préfixe \\?\
    const dossierSRT = await creerDossierSRT(dossierClient);
    log(`Dossier : ${dossierSRT}`, "titre");
    log(`${liste.length} séquence(s) à traiter`, "titre");

    const ctx = { preset, dossierSRT, langue, chutierTravail };

    let ok = 0;
    for (let i = 0; i < liste.length; i++) {
      log(`[${i + 1}/${liste.length}] ${liste[i].nom}`, "titre");
      try {
        await traiterSequence(projet, ctx, liste[i]);
        ok += 1;
      } catch (e) {
        log("  ✗ " + (e.message || e), "err");
      }
    }
    log(`Terminé : ${ok}/${liste.length} séquence(s) OK.`, ok === liste.length ? "ok" : "warn");
  } catch (e) {
    log("✗ " + (e.message || e), "err");
  } finally {
    $("go").disabled = false;
  }
}

// Preset choisi à la main, sinon celui livré avec le plugin (presets/Happy Scribe.epr)
async function presetInclus() {
  try {
    const dossier = await uxp.storage.localFileSystem.getPluginFolder();
    return dossier.nativePath.replace(/[\\/]$/, "") + sep + "presets" + sep + "Happy Scribe.epr";
  } catch { return ""; }
}

async function presetActif() {
  if (reglages.preset && (await existe(reglages.preset))) return reglages.preset;
  const inclus = await presetInclus();
  return inclus && (await existe(inclus)) ? inclus : "";
}

async function choisirPreset() {
  const f = await uxp.storage.localFileSystem.getFileForOpening({ types: ["epr"] });
  if (f) {
    reglages.preset = f.nativePath;
    $("preset").textContent = f.nativePath;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("preset").textContent = reglages.preset || "Happy Scribe (inclus)";
  $("chutier").value = reglages.chutier;
  $("choisir").addEventListener("click", choisirPreset);
  $("go").addEventListener("click", lancer);
});
