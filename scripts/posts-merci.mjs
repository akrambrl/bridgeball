#!/usr/bin/env node
// LES POSTS DE REMERCIEMENT — format de fil Instagram, 1080 × 1350.
//
//     npm run merci              # va chercher les chiffres et rend les visuels
//     npm run merci -- --chiffres   # affiche seulement les chiffres, sans rendre
//
// Sortie : visuels/annonces/merci/1-les-chiffres.png … 3-les-champions.png
//
// ── LES CHIFFRES SONT LUS, JAMAIS ÉCRITS À LA MAIN ────────────────────────
//
// Ce script interroge Supabase à CHAQUE exécution, avec la clé publique, en
// lecture seule. Un chiffre recopié dans le code vieillit en silence : on le
// republie trois semaines plus tard et on remercie 276 joueurs alors qu'ils
// sont 340. Pire, on ne peut plus le vérifier — une affiche qui annonce
// « 1 679 parties » engage, et il faut pouvoir dire d'où vient le nombre.
//
// Si la lecture échoue, le script REFUSE de rendre. Il n'y a pas de valeurs de
// repli : un visuel de remerciement publié avec des zéros ou avec les chiffres
// du mois dernier est pire que pas de visuel du tout.
//
// ── CE QU'ON COMPTE, ET CE QU'ON NE MÉLANGE PAS ───────────────────────────
//
// Les trois tables ne se totalisent PAS en un seul « nombre de parties » :
// bb_scores porte les parties classées, bb_duels les défis, bb_gg_scores les
// grilles. On ne sait pas si un duel écrit aussi une ligne de score, donc les
// additionner reviendrait à publier un nombre qu'on ne saurait pas défendre.
// Ils sont donc annoncés SÉPARÉMENT — ce qui se lit mieux de toute façon :
// trois chiffres distincts disent plus qu'un total.
//
// Un duel n'est compté que s'il porte LES DEUX scores. La table en garde 377,
// dont des défis lancés jamais relevés et des salons abandonnés : annoncer 377
// « duels joués » serait faux. Il y en a 294 qui sont allés au bout.
//
// ── LE FORMAT ─────────────────────────────────────────────────────────────
//
// 1080 × 1350 (4:5), le plus haut que le fil accepte sans recadrer nulle part,
// et aucune zone réservée : dans le fil, le pseudo et la légende se posent SOUS
// l'image. Même raisonnement que scripts/posts-concours.mjs, dont ce fichier
// reprend la charpente et les contrôles de débordement.

import { chromium } from "playwright";
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const lancer = promisify(execFile);
const SEULEMENT_CHIFFRES = process.argv.includes("--chiffres");

// ── LES CHIFFRES ───────────────────────────────────────────────────────────

const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co/rest/v1/";
// La clé PUBLIQUE, celle du bundle, en lecture seule. La clé de service n'a
// rien à faire ici : on lit ce que n'importe quel joueur peut déjà lire.
const SB_KEY = (await readFile(join(racine, "src", "lib", "leaderboard.ts"), "utf8"))
  .match(/const SB_KEY\s*=\s*([\s\S]*?);/)[1].replace(/[\s"+`]/g, "");

const enTetes = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };

/** Lit une table entière : PostgREST plafonne à 1 000 lignes par appel. */
async function toutes(requete) {
  const out = [];
  for (let saut = 0; ; saut += 1000) {
    const r = await fetch(SB_URL + requete + "&limit=1000&offset=" + saut, { headers: enTetes });
    if (!r.ok) throw new Error("HTTP " + r.status + " sur " + requete.split("?")[0]);
    const lot = await r.json();
    if (!Array.isArray(lot) || !lot.length) break;
    out.push(...lot);
    if (lot.length < 1000) break;
  }
  return out;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// « du mois de avril » : trois mois de l'année commencent par une voyelle et
// veulent l'élision. Le « h » d'aucun mois n'est en jeu, la règle tient en une
// classe de caractères.
const deMois = (m) => (/^[aeiouâéèêîôû]/i.test(m) ? "d'" : "de ") + m;
// Espace INSÉCABLE entre les milliers, et NON l'espace fine : à 44 px en
// Anton la fine ne se voit pas et « 1 679 » se lit « 1679 ». Insécable quand
// même — une coupure de ligne au milieu ferait lire « 1 » puis « 679 ».
const nombre = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

async function mesurer() {
  const [scores, joueurs, duels, grilles, saisons] = await Promise.all([
    toutes("bb_scores?select=mode,player_id,created_at&order=created_at.asc"),
    toutes("bb_pseudos?select=player_id,country"),
    toutes("bb_duels?select=challenger_score,opponent_score"),
    toutes("bb_gg_scores?select=id"),
    toutes("bb_seasons?select=season_number,champion_name,season_month,ended_at&order=season_number.asc"),
  ]);
  if (!scores.length || !joueurs.length) throw new Error("tables vides — lecture suspecte");

  const parJour = {};
  for (const s of scores) {
    const j = s.created_at.slice(0, 10);
    parJour[j] = (parJour[j] || 0) + 1;
  }
  const [jourRecord, partiesRecord] = Object.entries(parJour).sort((a, b) => b[1] - a[1])[0];
  const debut = new Date(scores[0].created_at);

  // bb_seasons porte des doublons (la saison 4 y figure deux fois) : dédoublonner
  // par NUMÉRO, sinon le même champion serait félicité deux fois sur l'affiche.
  const parNumero = new Map();
  for (const s of saisons) if (!parNumero.has(s.season_number)) parNumero.set(s.season_number, s);

  return {
    inscrits: joueurs.length,
    // Ceux qui ont VRAIMENT joué. C'est ce nombre-là qu'on remercie ; l'écart
    // avec les inscrits, ce sont les comptes créés puis abandonnés.
    actifs: new Set(scores.map((s) => s.player_id)).size,
    parties: scores.length,
    duels: duels.filter((d) => d.challenger_score != null && d.opponent_score != null).length,
    grilles: grilles.length,
    pays: new Set(joueurs.map((j) => j.country).filter(Boolean)).size,
    journees: Object.keys(parJour).length,
    joursEcoules: Math.round((Date.now() - debut.getTime()) / 86400000) + 1,
    partiesRecord, jourRecord,
    depuis: MOIS[debut.getMonth()] + " " + debut.getFullYear(),
    champions: [...parNumero.values()].filter((s) => s.champion_name).map((s) => ({
      nom: s.champion_name,
      mois: s.season_month
        ? MOIS[Number(s.season_month.slice(5, 7)) - 1]
        // Les deux premières saisons n'ont pas de season_month : leur mois se
        // déduit de la date de clôture, qui tombe le 1er du mois SUIVANT pour
        // la saison 2 — d'où le recul d'un jour avant de lire le mois.
        : MOIS[new Date(new Date(s.ended_at).getTime() - 86400000).getMonth()],
    })),
  };
}

let S;
try {
  S = await mesurer();
} catch (e) {
  console.error("❌ chiffres illisibles : " + e.message);
  console.error("   Aucun visuel n'est rendu — mieux vaut rien que de faux chiffres.");
  process.exit(1);
}

const jourLisible = (() => {
  const d = new Date(S.jourRecord);
  return d.getDate() + " " + MOIS[d.getMonth()];
})();

console.log("chiffres lus sur Supabase (clé publique, lecture seule) :");
console.log("  inscrits ................ " + S.inscrits);
console.log("  dont ayant joué ......... " + S.actifs);
console.log("  parties classées ........ " + S.parties);
console.log("  duels menés au bout ..... " + S.duels);
console.log("  grilles GOAT GRID ....... " + S.grilles);
console.log("  pays .................... " + S.pays);
console.log("  journées avec du jeu .... " + S.journees);
console.log("  record sur une journée .. " + S.partiesRecord + " le " + S.jourRecord);
console.log("  première partie ......... " + S.depuis);
console.log("  champions couronnés ..... " + S.champions.map((c) => c.nom + " (" + c.mois + ")").join(", "));
if (SEULEMENT_CHIFFRES) process.exit(0);

// ── LA CHARTE ──────────────────────────────────────────────────────────────

const source = await readFile(join(racine, "src", "lib", "charte.jsx"), "utf8");
function jeton(nom) {
  const m = source.match(new RegExp(nom + ':\\s*"(#[0-9A-Fa-f]{3,8})"'));
  if (!m) throw new Error("jeton de charte introuvable : " + nom);
  return m[1];
}
const G = {
  encre: jeton("encre"), or: jeton("or"), orSombre: jeton("orSombre"),
  creme: jeton("creme"), nuit: jeton("nuit"), maillot: jeton("maillot"),
};

const b64 = (buf, type) => "data:" + type + ";base64," + buf.toString("base64");
const anton = b64(await readFile(join(ici, "polices", "anton-latin.woff2")), "font/woff2");
const bebas = b64(await readFile(join(ici, "polices", "bebas-neue-latin.woff2")), "font/woff2");
const motSymbole = b64(await readFile(join(racine, "public", "logo-mot.webp")), "image/webp");

const peutEtreLu = async (chemin, type) => {
  try { return b64(await readFile(chemin), type); } catch { return null; }
};
const artDuel = await peutEtreLu(join(racine, "visuels", "bruts", "duel.png"), "image/png");

const COMPTE_IG = "@goatfc_app";
const ECHELLE = 2;
const L = 540, H = 675;   // → 1080 × 1350

const lignes = (couleur, ep, pas) => `repeating-conic-gradient(from 0deg at 50% 30%,
  ${couleur} 0deg ${ep}deg, transparent ${ep}deg ${pas}deg)`;

const decorOr = `
  <div class="c" style="background:radial-gradient(120% 80% at 50% 26%,
    rgba(245,194,43,.96) 0 34%, rgba(217,162,26,.55) 100%), ${G.or}"></div>
  <div class="c" style="inset:-25%;background:${lignes("rgba(8,17,9,.42)", .55, 2.7)}"></div>
  <div class="c" style="background:radial-gradient(circle at 50% 30%,
    ${G.or} 0 18%, rgba(245,194,43,.92) 30%, rgba(245,194,43,0) 60%)"></div>
  <div class="c" style="opacity:.5;background-size:7px 7px;
    background-image:radial-gradient(circle, ${G.orSombre} 1.4px, transparent 1.7px)"></div>`;

// ── LES TROIS POSTS ────────────────────────────────────────────────────────
//
// L'ordre est celui d'une conversation : voilà ce que vous avez fait → voilà le
// détail → bravo à ceux qui sont montés le plus haut. Le troisième nomme des
// joueurs, donc il vient en dernier : on remercie tout le monde avant de
// féliciter quelques-uns.
const POSTS = [
  {
    fichier: "1-les-chiffres",
    bandeau: 50,
    surligne: "DEPUIS " + S.depuis.toUpperCase(),
    titre: ["MERCI", "À VOUS " + nombre(S.inscrits)],
    chiffres: [
      [nombre(S.parties), "parties jouées"],
      [nombre(S.actifs), "joueurs sur le terrain"],
      [nombre(S.pays), S.pays > 1 ? "pays" : "pays"],
    ],
    pied: "GOAT FC n'a ni pub, ni budget, ni équipe. Il tourne parce que "
        + "<b>vous revenez</b>. Merci.",
  },
  {
    fichier: "2-vos-records",
    fond: "duel",
    surligne: "LES RECORDS DE LA COMMUNAUTÉ",
    titre: ["CE QUE VOUS", "AVEZ FAIT"],
    liste: [
      [nombre(S.partiesRecord) + " parties en une journée", "le " + jourLisible + ", record absolu"],
      [nombre(S.duels) + " duels menés au bout", "deux joueurs, un score, un gagnant"],
      // « pas un jour sans personne » serait FAUX : 70 journées actives sur les
      // 128 écoulées depuis la première partie, il y a bien eu des jours vides.
      // Un chiffre juste sous une phrase fausse reste un visuel qui ment.
      [nombre(S.journees) + " journées avec du jeu", "sur les " + S.joursEcoules + " depuis la première partie"],
      [nombre(S.grilles) + " grilles GOAT GRID", "neuf cases, trois vies"],
    ],
    pied: "Chacun de ces chiffres, c'est quelqu'un qui a ouvert l'app "
        + "<b>sans qu'on le lui demande</b>.",
  },
  {
    fichier: "3-les-champions",
    bandeau: 58,
    surligne: "HALL OF FAME",
    titre: ["BRAVO", "AUX CHAMPIONS"],
    // Ce n'est PAS un podium : chacun de ces trois-là est PREMIER, dans son
    // mois à lui. Les décorer or/argent/bronze les classerait les uns par
    // rapport aux autres, ce qui n'a aucun sens — et reléguerait deux champions
    // au rang de dauphins sur une affiche censée les féliciter.
    palmares: S.champions.map((c) => [c.nom, "champion du mois " + deMois(c.mois)]),
    pied: "Le 1ᵉʳ septembre, le compteur repart à zéro pour tout le monde — "
        + "et cette fois, <b>le podium repart avec quelque chose</b>.",
  },
];

function page(p) {
  // La bande sombre prend la hauteur de CE qu'elle porte. Fixée à 64 % pour
  // tout le monde, le post 1 — un seul panneau de trois chiffres — laissait
  // 230 px de vide au-dessus et autant en dessous, et le titre s'en trouvait
  // écrasé en haut de l'affiche.
  const bandeau = p.bandeau ?? 62;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Anton';src:url(${anton}) format('woff2');font-display:block}
  @font-face{font-family:'Bebas Neue';src:url(${bebas}) format('woff2');font-display:block}
  *{margin:0;padding:0;box-sizing:border-box}
  .c{position:absolute;inset:0}
  body{width:${L}px;height:${H}px;overflow:hidden;position:relative;background:${G.or};
    font-family:'Anton',Impact,sans-serif;-webkit-font-smoothing:antialiased}
  .haut{position:absolute;left:0;right:0;top:0;height:${100 - bandeau}%;overflow:hidden}
  .contenuHaut{position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:8px;padding:22px 30px 16px}
  .mot{width:132px;height:auto;display:block}
  .surligne{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:16px;letter-spacing:3.2px;color:${G.encre};text-transform:uppercase;
    text-align:center}
  /* paint-order : sans lui le contour est peint PAR-DESSUS la lettre et bouche
     les contre-formes du A et du O à cette épaisseur. */
  .titre span{display:block}
  .titre{font-size:52px;line-height:.95;letter-spacing:.5px;color:${G.creme};
    transform:skewX(-7deg);-webkit-text-stroke:6px ${G.encre};
    paint-order:stroke fill;text-shadow:6px 6px 0 ${G.encre};
    text-align:center;text-wrap:balance}
  .bas{position:absolute;left:0;right:0;bottom:0;height:${bandeau}%;background:${G.nuit};
    box-shadow:inset 0 9px 0 ${G.encre};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:14px;padding:22px 30px 16px}
  .fondArt{position:absolute;inset:0;overflow:hidden}
  .fondArt img{width:100%;height:100%;object-fit:cover;object-position:center 30%;
    display:block;opacity:.9}
  .fondArt::after{content:"";position:absolute;inset:0;
    background:linear-gradient(to bottom, rgba(245,194,43,.12) 0%,
      rgba(245,194,43,.44) 55%, rgba(18,22,15,.85) 100%)}

  /* ── LES CHIFFRES : UN PANNEAU, TROIS COLONNES ────────────────────────
     Trois encadrés côte à côte feraient une grille de vignettes — vocabulaire
     du verre, pas de l'affiche, et c'est précisément ce que la charte a retiré
     de l'app. Un seul panneau creusé, cerclé d'encre, et deux filets d'encre
     pour séparer : la même forme qu'une liste, couchée. */
  .cadre-liste{flex:0 0 auto;width:100%;max-width:460px;background:rgba(8,17,9,.5);
    border:3px solid ${G.encre};border-radius:16px;overflow:hidden;
    box-shadow:inset 3px 3px 0 rgba(8,17,9,.35)}
  .chiffres{display:flex;align-items:stretch}
  .chiffre{flex:1 1 0;min-width:0;padding:16px 8px 14px;text-align:center;
    border-right:2px solid ${G.encre}}
  .chiffre:last-child{border-right:none}
  .chiffre .n{font-family:'Anton',Impact,sans-serif;font-size:44px;line-height:1;
    color:${G.or};transform:skewX(-7deg);display:block}
  .chiffre .l{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:15px;
    letter-spacing:.5px;line-height:1.15;color:rgba(242,231,206,.85);
    margin-top:8px;display:block}

  .listePad{padding:0 14px}
  .ligne{display:flex;align-items:flex-start;gap:11px;padding:10px 0;
    border-bottom:2px solid ${G.encre};
    font-family:'Bebas Neue',Impact,sans-serif;text-align:left}
  .ligne:last-child{border-bottom:none}
  /* Aplat d'or à rayon franc, cerclé d'encre : le cercle sans contour appartient
     à l'ancien vocabulaire, il a été retiré de l'app. */
  .num{flex:0 0 auto;min-width:26px;height:26px;border-radius:8px;background:${G.or};
    color:${G.encre};font-family:'Anton',Impact,sans-serif;font-size:17px;
    display:flex;align-items:center;justify-content:center;
    border:2px solid ${G.encre};margin-top:1px}
  .titreLigne{font-weight:400;font-size:19.5px;letter-spacing:.4px;color:${G.or};line-height:1.24}
  .sousLigne{font-weight:400;font-size:15.5px;letter-spacing:.3px;
    color:rgba(242,231,206,.82);line-height:1.3;margin-top:1px}
  /* Le premier champion sur aplat d'or : la hiérarchie se voit sans lire. */
  .ligne.or{background:${G.or};padding-left:14px;padding-right:14px;margin:0 -14px}
  .ligne.or .titreLigne{color:${G.encre}}
  .ligne.or .sousLigne{color:rgba(8,17,9,.72)}
  .medaille{flex:0 0 auto;font-size:24px;line-height:1}

  .pied{flex:0 0 auto;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:19px;
    letter-spacing:.4px;line-height:1.35;color:${G.creme};text-align:center;max-width:460px}
  .pied b{color:${G.or}}
  .signature{flex:0 0 auto;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:14px;letter-spacing:1.4px;color:rgba(240,233,214,.62);text-align:center}
  .cadre{position:absolute;inset:0;box-shadow:inset 0 0 0 10px ${G.encre};
    pointer-events:none}
  </style></head><body>
    <div class="haut">
      ${p.fond === "duel" && artDuel
        ? `<div class="fondArt"><img src="${artDuel}" alt=""></div>` : decorOr}
      <div class="contenuHaut">
        <img class="mot" src="${motSymbole}" alt="GOAT FC">
        <div class="surligne">${p.surligne}</div>
        <div class="titre">${p.titre.map((l) => `<span>${l}</span>`).join("")}</div>
      </div>
    </div>
    <div class="bas">
      ${p.chiffres ? `<div class="cadre-liste"><div class="chiffres">${p.chiffres.map(
        ([n, l]) => `<div class="chiffre"><span class="n">${n}</span><span class="l">${l}</span></div>`
      ).join("")}</div></div>` : ""}
      ${p.liste ? `<div class="cadre-liste listePad">${p.liste.map(([t, sous], i) =>
        `<div class="ligne"><div class="num">${i + 1}</div>
          <div><div class="titreLigne">${t}</div>
          <div class="sousLigne">${sous}</div></div></div>`).join("")}</div>` : ""}
      ${p.palmares ? `<div class="cadre-liste listePad">${p.palmares.map(([nom, sous]) =>
        `<div class="ligne">
          <div class="medaille">🏆</div>
          <div><div class="titreLigne">${nom}</div>
          <div class="sousLigne">${sous}</div></div></div>`).join("")}</div>` : ""}
      ${p.pied ? `<div class="pied">${p.pied}</div>` : ""}
      <div class="signature">GOATFC.FR · ${COMPTE_IG}</div>
    </div>
    <div class="cadre"></div>
  </body></html>`;
}

/** Réduit le PNG à une palette : ce sont des aplats et des trames, pas des photos. */
async function alleger(chemin, couleurs) {
  const brut = chemin.replace(/\.png$/, ".brut.png");
  try {
    await writeFile(brut, await readFile(chemin));
    await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", brut,
      "-vf", `split[a][b];[a]palettegen=max_colors=${couleurs}:stats_mode=full[p];`
           + "[b][p]paletteuse=dither=none", chemin]);
    return true;
  } catch { return false; } finally { await rm(brut, { force: true }); }
}

const sortie = join(racine, "visuels", "annonces", "merci");
await mkdir(sortie, { recursive: true });
// Sans ce ménage, renuméroter laisse les anciens fichiers derrière et on publie
// des doublons dans le désordre.
for (const vieux of await readdir(sortie)) {
  if (vieux.endsWith(".png")) await rm(join(sortie, vieux));
}
if (!artDuel) console.warn("⚠️  illustration duel absente — le post 2 se rendra sans.");

// ── LES LÉGENDES ───────────────────────────────────────────────────────────
//
// Les chiffres y sont RÉPÉTÉS : une image se partage seule, mais c'est la
// légende qui est lue et indexée. Ils viennent des mêmes variables que le
// visuel, donc les deux ne peuvent pas diverger.
const LEGENDES = {
  "1-les-chiffres": `🙏 MERCI.

Depuis ${S.depuis}, vous êtes ${nombre(S.inscrits)} à avoir créé un compte sur GOAT FC. ${nombre(S.actifs)} d'entre vous ont joué au moins une partie, et ensemble vous en avez enchaîné ${nombre(S.parties)}, depuis ${nombre(S.pays)} pays.

Aucune pub. Aucun budget. Aucune équipe. GOAT FC tourne parce que vous revenez — et ça, ça ne s'achète pas.

👉 goatfc.fr — gratuit, rien à installer.

#football #foot #quizfoot #culturefoot #communaute #merci #ligue1 #premierleague #footballfrance #goatfc`,

  "2-vos-records": `📊 CE QUE VOUS AVEZ FAIT, EN DÉTAIL.

⚡ ${nombre(S.partiesRecord)} parties en une seule journée, le ${jourLisible} — le record absolu
⚔️ ${nombre(S.duels)} duels menés jusqu'au bout, deux joueurs face à face
📅 ${nombre(S.journees)} journées avec au moins une partie, sur les ${S.joursEcoules} écoulées
🟨 ${nombre(S.grilles)} grilles GOAT GRID remplies

Chacun de ces chiffres, c'est quelqu'un qui a ouvert l'app sans qu'on le lui demande. Merci.

👉 goatfc.fr

#football #foot #quizfoot #culturefoot #mercato #stats #communaute #ligue1 #premierleague #goatfc`,

  "3-les-champions": `🏆 BRAVO AUX CHAMPIONS.

${S.champions.map((c) => `🏆 ${c.nom} — champion du mois ${deMois(c.mois)}`).join("\n")}

Monter en haut du classement mensuel de GOAT FC, ce n'est pas une soirée de chance : le classement retient ton meilleur score du jour dans chaque mode, et additionne sur tout le mois. C'est la régularité qui gagne.

Le 1ᵉʳ septembre, le compteur repart à zéro pour tout le monde — et cette fois, le podium repart avec quelque chose. Les détails arrivent.

👉 goatfc.fr

#football #foot #quizfoot #culturefoot #classement #champion #ligue1 #premierleague #goatfc`,
};

async function ecrireLegendes() {
  const bouts = ["# Légendes des posts de remerciement", "",
    "Chiffres relevés le " + new Date().toISOString().slice(0, 10) + " sur Supabase,",
    "en lecture seule avec la clé publique. `npm run merci -- --chiffres` les",
    "réaffiche sans rien rendre.", "",
    "Les chiffres du visuel et ceux de la légende viennent des MÊMES variables :",
    "ils ne peuvent pas diverger. Si tu republies ces posts plus tard, relance le",
    "script — les nombres auront bougé.", ""];
  for (const p of POSTS) bouts.push("## " + p.fichier, "", "```", LEGENDES[p.fichier] || "", "```", "");
  await writeFile(join(sortie, "legendes.md"), bouts.join("\n"));
}

// ── RENDU ──────────────────────────────────────────────────────────────────

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});

console.log("");
let deborde = 0;
for (const p of POSTS) {
  const ctx = await navigateur.newContext({
    viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE });
  const onglet = await ctx.newPage();
  await onglet.setContent(page(p), { waitUntil: "load" });
  // Sans cette attente la capture part parfois sur la police de repli : le
  // lettrage n'est plus celui du logo, et le défaut passe pour un détail.
  await onglet.evaluate(() => document.fonts.ready);

  // ── LE TITRE EST MESURÉ, PAS DEVINÉ ────────────────────────────────────
  // Deux dépassements que scrollWidth ne voit pas : l'INCLINAISON, qui élargit
  // le tracé d'environ tan(7°) × la hauteur de ligne, et l'OMBRE DURE, décalée
  // vers la droite. Ici le titre porte un nombre qui grandira avec la
  // communauté — « À VOUS 276 » puis « À VOUS 1 240 » — donc la mesure n'est
  // pas une précaution : c'est ce qui permet au visuel de survivre au succès.
  const titre = await onglet.evaluate(() => {
    const t = document.querySelector(".titre");
    const zone = document.querySelector(".contenuHaut");
    const st = getComputedStyle(zone);
    const dispo = zone.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
    let taille = parseFloat(getComputedStyle(t).fontSize);
    const marge = () => {
      const h = parseFloat(getComputedStyle(t).lineHeight) || taille;
      return Math.tan(7 * Math.PI / 180) * h + 7;
    };
    let garde = 60;
    while (t.scrollWidth + marge() > dispo && taille > 24 && garde-- > 0) {
      taille -= 1.5; t.style.fontSize = taille + "px";
    }
    return Math.round(taille);
  });

  // ── LE BANDEAU BAS DÉBORDE-T-IL ? ──────────────────────────────────────
  // `.bas` est en hauteur fixe : si son contenu est plus grand, il déborde VERS
  // LE HAUT et recouvre le titre. Les panneaux portent flex:0 0 auto pour ne pas
  // se laisser écraser — écrasés, ils rogneraient leur contenu en silence et ce
  // contrôle ne verrait rien.
  const bas = await onglet.evaluate(() => {
    const b = document.querySelector(".bas");
    const haut = document.querySelector(".haut").getBoundingClientRect();
    let plusHaut = Infinity;
    for (const e of b.children) plusHaut = Math.min(plusHaut, e.getBoundingClientRect().top);
    return { trop: Math.round(Math.max(0, haut.bottom - plusHaut)),
             interne: b.scrollHeight > b.clientHeight + 1 };
  });
  if (bas.trop > 0 || bas.interne) deborde++;

  const chemin = join(sortie, p.fichier + ".png");
  await onglet.screenshot({ path: chemin });
  await ctx.close();
  await alleger(chemin, p.fond === "duel" ? 256 : 128);
  const ko = Math.round((await readFile(chemin)).length / 1024);
  console.log("  1080×1350  " + p.fichier + ".png  " + ko + " ko  titre " + titre + "px"
    + "  bas " + (bas.trop > 0 || bas.interne
        ? "❌ DÉBORDE de " + bas.trop + "px sur le titre" : "✅"));
}

await navigateur.close();
await ecrireLegendes();
console.log("\n" + (deborde
  ? "❌ " + deborde + " post(s) débordent — raccourcis le texte."
  : "✅ les " + POSTS.length + " posts tiennent dans leur cadre."));
console.log("   " + sortie);
console.log("   légendes prêtes à coller : " + join(sortie, "legendes.md"));
process.exit(deborde ? 1 : 0);
