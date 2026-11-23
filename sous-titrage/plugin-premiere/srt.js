// Construction d'un SRT à partir du JSON de transcription Premiere
// (Transcript.exportToJSON), avec les mêmes règles que
// « Créer des sous-titres » : ligne double, 42 caractères max,
// durée minimale 3 s, écart 0 image, premier sous-titre calé à 0.

const REGLES = {
  maxCaracteres: 42,
  maxLignes: 2,
  dureeMin: 3.0,
  dureeMax: 7.0,
  pauseCoupe: 1.0, // un silence plus long force un nouveau sous-titre
  ecartColle: 1.0, // si l'écart avec le suivant est plus petit, on colle (écart 0 image)
};

// Premiere compte parfois le temps en « ticks » (254 016 000 000 par seconde)
const TICKS_PAR_SECONDE = 254016000000;
const nombre = (v) => {
  if (v && typeof v === "object") v = v.seconds ?? v.ticks ?? v.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// Transforme le JSON Premiere en liste de mots { texte, debut, fin, eos, locuteur }
function motsDepuisTranscription(json) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  const segments = data.segments || (data.transcript && data.transcript.segments) || [];
  const mots = [];
  for (const seg of segments) {
    for (const w of seg.words || []) {
      const texte = String(w.text ?? w.word ?? "").trim();
      if (!texte) continue;
      const debut = nombre(w.start ?? w.startTime ?? w.offset);
      let fin = nombre(w.end ?? w.endTime);
      if (!Number.isFinite(fin)) fin = debut + (nombre(w.duration) || 0);
      if (!Number.isFinite(debut)) continue;
      const ponctuation = w.type === "punctuation" || /^[.,;:!?…»)]+$/.test(texte);
      if (ponctuation && mots.length) {
        // ponctuation collée au mot précédent
        const prec = mots[mots.length - 1];
        prec.texte += texte;
        prec.fin = Math.max(prec.fin, fin);
        prec.eos = prec.eos || !!w.eos || /[.?!…]$/.test(texte);
        continue;
      }
      mots.push({
        texte,
        debut,
        fin,
        eos: !!w.eos || /[.?!…]$/.test(texte),
        locuteur: seg.speaker ?? w.speaker,
      });
    }
  }
  // Temps en ticks ? (une vidéo ne dure pas 10 millions de secondes)
  const maxi = mots.reduce((m, x) => Math.max(m, x.fin), 0);
  if (maxi > 1e7) {
    for (const m of mots) {
      m.debut /= TICKS_PAR_SECONDE;
      m.fin /= TICKS_PAR_SECONDE;
    }
  }
  return mots;
}

// Découpe un texte en lignes de maxCaracteres max (coupure aux espaces)
function couperLignes(texte, max) {
  const lignes = [];
  let cur = "";
  for (const t of texte.split(/\s+/).filter(Boolean)) {
    const essai = cur ? cur + " " + t : t;
    if (essai.length > max && cur) {
      lignes.push(cur);
      cur = t;
    } else {
      cur = essai;
    }
  }
  if (cur) lignes.push(cur);
  return lignes;
}

// Si 2 lignes, on équilibre (coupure la plus proche du milieu)
function equilibrer(texte, max) {
  const lignes = couperLignes(texte, max);
  if (lignes.length !== 2) return lignes;
  const mots = texte.split(/\s+/);
  let meilleur = lignes;
  let ecart = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const a = mots.slice(0, i).join(" ");
    const b = mots.slice(i).join(" ");
    if (a.length > max || b.length > max) continue;
    const d = Math.abs(a.length - b.length);
    // préférence légère pour couper après une virgule
    const bonus = /[,;:]$/.test(mots[i - 1]) ? 6 : 0;
    if (d - bonus < ecart) {
      ecart = d - bonus;
      meilleur = [a, b];
    }
  }
  return meilleur;
}

function construireSousTitres(mots, regles = REGLES) {
  const r = { ...REGLES, ...regles };
  const blocs = [];
  let bloc = [];
  const texteDe = (ms) => ms.map((m) => m.texte).join(" ");

  for (const m of mots) {
    if (bloc.length) {
      const dernier = bloc[bloc.length - 1];
      const tropLong =
        couperLignes(texteDe([...bloc, m]), r.maxCaracteres).length > r.maxLignes;
      const pause = m.debut - dernier.fin > r.pauseCoupe;
      const duree = m.fin - bloc[0].debut > r.dureeMax;
      const autreLocuteur = m.locuteur !== dernier.locuteur;
      const finPhrase = dernier.eos && texteDe(bloc).length > 15;
      if (tropLong || pause || duree || autreLocuteur || finPhrase) {
        blocs.push(bloc);
        bloc = [];
      }
    }
    bloc.push(m);
  }
  if (bloc.length) blocs.push(bloc);

  const st = blocs.map((b) => ({
    debut: b[0].debut,
    fin: b[b.length - 1].fin,
    lignes: equilibrer(texteDe(b), r.maxCaracteres),
  }));

  // Timing : durée min 3 s, écart 0 image, jamais de chevauchement
  for (let i = 0; i < st.length; i++) {
    const suivant = st[i + 1];
    if (suivant && suivant.debut - st[i].fin < r.ecartColle) st[i].fin = suivant.debut;
    if (st[i].fin - st[i].debut < r.dureeMin) {
      st[i].fin = st[i].debut + r.dureeMin;
    }
    if (suivant && st[i].fin > suivant.debut) st[i].fin = suivant.debut;
  }

  // Règle maison : le premier sous-titre commence au tout début (0)
  if (st.length) st[0].debut = 0;
  return st;
}

function tc(secondes) {
  let ms = Math.max(0, Math.round(secondes * 1000));
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const m = Math.floor(ms / 60000); ms -= m * 60000;
  const s = Math.floor(ms / 1000); ms -= s * 1000;
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}`;
}

function versSRT(sousTitres) {
  return sousTitres
    .map((s, i) => `${i + 1}\r\n${tc(s.debut)} --> ${tc(s.fin)}\r\n${s.lignes.join("\r\n")}\r\n`)
    .join("\r\n");
}

function transcriptionVersSRT(json, regles) {
  return versSRT(construireSousTitres(motsDepuisTranscription(json), regles));
}

module.exports = {
  REGLES,
  motsDepuisTranscription,
  construireSousTitres,
  versSRT,
  transcriptionVersSRT,
  couperLignes,
};
