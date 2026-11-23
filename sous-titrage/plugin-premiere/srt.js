// Construction d'un SRT à partir du JSON de transcription Premiere
// (Transcript.exportToJSON), avec les mêmes règles que
// « Créer des sous-titres » : ligne double, 42 caractères max,
// durée minimale 3 s, écart 0 image, premier sous-titre calé à 0.

const REGLES = {
  maxCaracteres: 42,
  maxLignes: 2,
  dureeMin: 3.0,
  dureeMax: 5.5, // Premiere dépasse rarement ~5 s
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

// Petits mots sur lesquels une ligne ou un sous-titre ne doit pas finir
const MOTS_FAIBLES = new Set(
  ("le la les l' un une des du de d' à au aux en et ou mais donc que qu' qui pour par sur " +
   "dans avec sans ce cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs " +
   "je tu il elle on nous vous ils elles ne n' se s' y très plus").split(" ")
);
const estFaible = (mot) => {
  const m = mot.toLowerCase().replace(/[«»"]/g, "");
  return MOTS_FAIBLES.has(m) || /^(l|d|qu|n|s|j|c)'$/.test(m);
};

// Si 2 lignes, on équilibre (coupure proche du milieu, de préférence après
// une ponctuation, jamais juste après un petit mot)
function equilibrer(texte, max) {
  const lignes = couperLignes(texte, max);
  if (lignes.length !== 2) return lignes;
  const mots = texte.split(/\s+/);
  let meilleur = lignes;
  let score = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const a = mots.slice(0, i).join(" ");
    const b = mots.slice(i).join(" ");
    if (a.length > max || b.length > max) continue;
    let sc = Math.abs(a.length - b.length);
    if (/[.?!…]$/.test(mots[i - 1])) sc -= 14;
    else if (/[,;:]$/.test(mots[i - 1])) sc -= 10;
    if (estFaible(mots[i - 1])) sc += 12;
    if (sc < score) {
      score = sc;
      meilleur = [a, b];
    }
  }
  return meilleur;
}

// Coût d'un sous-titre formé des mots m[i..j-1] d'une phrase de n mots
function coutMorceau(ms, i, j, n) {
  const texte = ms.slice(i, j).map((m) => m.texte).join(" ");
  const fin = ms[j - 1].texte;
  let c = 1;
  if (j < n) {
    // coupe au milieu de la phrase
    if (/[.?!…]$/.test(fin)) c += 0;
    else if (/[,;:]$/.test(fin)) c += 0.1;
    else if (/^(et|mais|donc|ou|car|que|qui|pour|parce)$/i.test(ms[j].texte)) c += 0.3; // avant une conjonction
    else c += 0.6;
    if (estFaible(fin)) c += 1.5;
  }
  // morceau trop court (sauf phrase complète)
  if (texte.length < 22 && !(i === 0 && j === n) && !/[.?!…]$/.test(fin)) c += 0.8;
  c += (0.3 * Math.max(0, 35 - texte.length)) / 35; // léger avantage aux morceaux équilibrés
  return c;
}

// Découpe optimale d'une phrase en sous-titres qui tiennent (programmation dynamique)
function decouperPhrase(ms, tient) {
  const n = ms.length;
  const best = new Array(n + 1).fill(Infinity);
  const prev = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = j - 1; i >= 0; i--) {
      if (!tient(ms.slice(i, j))) {
        if (j - i > 1) break; // plus long ne tiendra pas non plus
      }
      const c = best[i] + coutMorceau(ms, i, j, n);
      if (c < best[j]) {
        best[j] = c;
        prev[j] = i;
      }
    }
  }
  const morceaux = [];
  for (let j = n; j > 0; j = prev[j]) morceaux.unshift(ms.slice(prev[j], j));
  return morceaux;
}

function construireSousTitres(mots, regles = REGLES) {
  const r = { ...REGLES, ...regles };
  const texteDe = (ms) => ms.map((m) => m.texte).join(" ");
  const tient = (b) =>
    couperLignes(texteDe(b), r.maxCaracteres).length <= r.maxLignes &&
    b[b.length - 1].fin - b[0].debut <= r.dureeMax;

  // 1. Phrases : coupure en fin de phrase, sur un silence ou un changement de locuteur
  const phrases = [];
  let phrase = [];
  for (const m of mots) {
    if (phrase.length) {
      const dernier = phrase[phrase.length - 1];
      const pause = m.debut - dernier.fin > r.pauseCoupe;
      const autreLocuteur = m.locuteur !== dernier.locuteur;
      const finPhrase = dernier.eos && texteDe(phrase).length > 15;
      if (pause || autreLocuteur || finPhrase) {
        phrases.push(phrase);
        phrase = [];
      }
    }
    phrase.push(m);
  }
  if (phrase.length) phrases.push(phrase);

  // 2. Chaque phrase découpée en sous-titres
  const blocs = [];
  for (const p of phrases) blocs.push(...decouperPhrase(p, tient));

  // Fusion des tout petits sous-titres (1-2 mots, < 1,2 s) avec le précédent si ça tient
  for (let i = blocs.length - 1; i > 0; i--) {
    const b = blocs[i];
    const court = b.length <= 2 && b[b.length - 1].fin - b[0].debut < 1.2;
    const prec = blocs[i - 1];
    if (!court || b[0].locuteur !== prec[prec.length - 1].locuteur) continue;
    if (b[0].debut - prec[prec.length - 1].fin > r.pauseCoupe) continue;
    const fusion = [...prec, ...b];
    if (couperLignes(texteDe(fusion), r.maxCaracteres).length <= r.maxLignes &&
        fusion[fusion.length - 1].fin - fusion[0].debut <= r.dureeMax + 1) {
      blocs.splice(i - 1, 2, fusion);
    }
  }

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
