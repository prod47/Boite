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

// SRT, puis SRT_V2, SRT_V3…
async function creerDossierSRT(dossierClient) {
  let nom = "SRT";
  let n = 1;
  while (await existe(dossierClient + sep + nom)) {
    n += 1;
    nom = "SRT_V" + n;
  }
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
function transaction(projet, action, libelle) {
  let ok = false;
  projet.lockedAccess(() => {
    ok = projet.executeTransaction((ca) => ca.addAction(action), libelle);
  });
  return ok;
}

async function enClip(item) {
  try {
    const clip = ppro.ClipProjectItem.cast(item);
    if (clip && typeof clip.isSequence === "function") return clip;
  } catch {}
  return null;
}

async function enDossier(item) {
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
    transaction(projet, racine.createBinAction("_SOUS-TITRAGE", false), "Chutier sous-titrage");
    f = await trouverChutier(racine, "_SOUS-TITRAGE");
  }
  return f;
}

async function importerEtTrouver(projet, chutier, chemin, nom) {
  const ok = await projet.importFiles([chemin], true, ppro.ProjectItem.cast(chutier), false);
  if (!ok) throw new Error("import impossible : " + chemin);
  for (let i = 0; i < 20; i++) {
    for (const item of await chutier.getItems()) {
      if (item.name === nom || item.name === nom.replace(/\.mp4$/i, "")) {
        const clip = await enClip(item);
        if (clip) return clip;
      }
    }
    await pause(500);
  }
  throw new Error("clip importé introuvable : " + nom);
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

async function transcrire(clip, langue, timeoutMin = 60) {
  if (!ppro.Transcript.hasTranscript(clip)) {
    const ok = await ppro.Transcript.transcribeClipProjectItem(clip, { languageCode: langue });
    if (!ok) throw new Error("la transcription a échoué");
    const fin = Date.now() + timeoutMin * 60000;
    while (!ppro.Transcript.hasTranscript(clip)) {
      if (Date.now() > fin) throw new Error("transcription trop longue (délai dépassé)");
      await pause(3000);
    }
  }
  const json = await ppro.Transcript.exportToJSON(clip);
  if (!json) throw new Error("transcription vide");
  return json;
}

// ---------- Traitement ----------
async function traiterSequence(projet, ctx, { nom, sequence }) {
  const base = nomPropre(nom);
  const mp4 = ctx.dossierSRT + sep + base + ".mp4";
  const srt = ctx.dossierSRT + sep + base + ".srt";

  // 1. Timecode de début à 0
  const zero = await sequence.getZeroPoint();
  if (zero && zero.ticksNumber !== 0) {
    transaction(projet, sequence.createSetZeroPointAction(ppro.TickTime.createWithSeconds(0)), "Timecode 00:00:00:00");
    log("  timecode de début remis à 00:00:00:00");
  }

  // 2. Export MP4 (preset Happy Scribe)
  log("  export MP4…");
  const encodeur = ppro.EncoderManager.getManager();
  const okExport = await encodeur.exportSequence(sequence, ppro.Constants.ExportType.IMMEDIATELY, mp4, ctx.preset, true);
  if (!okExport) throw new Error("l'export a été refusé par Premiere");
  if (!(await attendreFichier(mp4))) throw new Error("export MP4 non terminé");
  log("  MP4 exporté ✓");

  // 3. Transcription Premiere du MP4
  log("  transcription Premiere (français)…");
  const clip = await importerEtTrouver(projet, ctx.chutierTravail, mp4, base + ".mp4");
  const json = await transcrire(clip, ctx.langue);

  // 4. SRT
  await fs.writeFile(srt, transcriptionVersSRT(json), { encoding: "utf-8" });
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

    const dossierClient = dossierDe(projet.path);
    const dossierSRT = await creerDossierSRT(dossierClient);
    log(`Dossier : ${dossierSRT}`, "titre");
    log(`${liste.length} séquence(s) à traiter`, "titre");

    const ctx = {
      preset,
      dossierSRT,
      langue: codeFrancais(),
      chutierTravail: await chutierDeTravail(projet),
    };

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
