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

/** Compte sans rapatrier : PostgREST rend le total dans content-range.
 *
 *  La COLONNE compte. Sur ce projet, le SELECT de bb_pseudos est accordé
 *  colonne par colonne : `select=*` y part en 42501 « permission denied », la
 *  réponse n'a pas de content-range, et le total sort à null sans rien dire.
 *  On nomme donc une colonne qu'on sait lisible. */
async function compte(table, filtre, colonne) {
  const r = await fetch(SB_URL + table + "?select=" + (colonne || "*") + (filtre ? "&" + filtre : ""),
    { headers: { ...enTetes, Prefer: "count=exact", Range: "0-0" } });
  const cr = r.headers.get("content-range");
  if (!r.ok || !cr) throw new Error("comptage refusé sur " + table + " (HTTP " + r.status + ")");
  return Number(cr.split("/")[1]);
}

// Les sept modes suivis, lus dans src/lib/tracking.js — la MÊME liste que le
// tableau de bord privé. Recopiée ici, elle divergerait au premier mode ajouté
// et l'affiche annoncerait moins de parties que la console. tracking.js importe
// charte.jsx, qui est du JSX : on lit donc le fichier, on ne l'importe pas.
const MODES = [...(await readFile(join(racine, "src", "lib", "tracking.js"), "utf8"))
  .matchAll(/\{\s*key:\s*"(\w+)"/g)].map((m) => m[1]);
if (MODES.length < 7) throw new Error("liste des modes illisible dans tracking.js");

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// « du mois de avril » : trois mois commencent par une voyelle et veulent
// l'élision. Aucun mois ne pose de « h » aspiré, la règle tient en une classe.
const deMois = (m) => (/^[aeiouâéèêîôû]/i.test(m) ? "d'" : "de ") + m;
// Espace INSÉCABLE entre les milliers, et NON l'espace fine : à 44 px en Anton
// la fine ne se voit pas et « 2 505 » se lit « 2505 ». Insécable quand même —
// une coupure de ligne au milieu ferait lire « 2 » puis « 505 ».
const nombre = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
const leJour = (iso) => { const d = new Date(iso); return d.getDate() + " " + MOIS[d.getMonth()]; };

// ── DEUX HORLOGES, ET C'EST LE PIÈGE DE CE FICHIER ────────────────────────
//
// bb_scores court depuis la PREMIÈRE PARTIE (avril). bb_events, lui, n'existe
// que depuis la mise en place du suivi par mode — trois semaines. Les deux ne
// couvrent donc pas la même période, et « 2 505 parties depuis avril » serait
// faux de quatre mois.
//
// C'est aussi ce qui explique l'écart qu'on croit voir : 1 680 « parties » lues
// dans bb_scores contre 2 505 au tableau de bord. Aucun des deux n'a tort — le
// premier ne compte que les modes qui CLASSENT un score, le second compte les
// sept modes, y compris la devinette et Trouve-le-joueur qui n'en écrivent
// aucun. Chaque nombre part donc sur l'affiche AVEC sa période et sa portée.
async function mesurer() {
  const [scores, joueurs, evenements, duels, salons, inscrits, saisons] = await Promise.all([
    toutes("bb_scores?select=player_id,created_at&order=created_at.asc"),
    toutes("bb_pseudos?select=player_id,country"),
    toutes("bb_events?select=player_id,created_at&type=like.play_*&order=created_at.asc"),
    compte("bb_duels", null, "id"), compte("bb_rooms", null, "id"),
    compte("bb_pseudos", null, "player_id"),
    toutes("bb_seasons?select=season_number,champion_name,season_month,ended_at&order=season_number.asc"),
  ]);
  if (!scores.length || !joueurs.length) throw new Error("tables vides — lecture suspecte");

  // Le total du tableau de bord, refait à l'identique : la somme des sept modes,
  // solo et en ligne. Compté par type plutôt que sur les lignes rapatriées, pour
  // que le nombre reste juste même si un type d'événement s'ajoute plus tard.
  let partiesToutesModes = 0;
  for (const m of MODES) {
    partiesToutesModes += await compte("bb_events", "type=eq.play_" + m, "id");
    partiesToutesModes += await compte("bb_events", "type=eq.play_" + m + "_online", "id");
  }

  const parJour = {};
  for (const e of evenements) {
    const j = e.created_at.slice(0, 10);
    parJour[j] = (parJour[j] || 0) + 1;
  }
  const [jourRecord, partiesRecord] = Object.entries(parJour).sort((a, b) => b[1] - a[1])[0];

  const parNumero = new Map();
  // bb_seasons a porté la saison 4 EN DOUBLE — deux clients l'ont écrite à 43 ms
  // d'écart le 31 juillet. docs/supabase-nettoyage-saisons.sql l'enlève et pose
  // la contrainte UNIQUE qui l'empêche de revenir ; ce dédoublonnage reste, il
  // coûte une Map et évite de féliciter deux fois le même champion si l'affiche
  // est rendue sur une base où le nettoyage n'a pas encore été passé.
  for (const s of saisons) if (!parNumero.has(s.season_number)) parNumero.set(s.season_number, s);

  const debutScores = new Date(scores[0].created_at);
  return {
    inscrits,
    parties: partiesToutesModes,
    scores: scores.length,
    enLigne: duels + salons, duels, salons,
    pays: new Set(joueurs.map((j) => j.country).filter(Boolean)).size,
    // Les joueurs VUS dans les événements, pas seulement ceux qui ont classé un
    // score : c'est le nombre de gens qui ont vraiment ouvert un mode.
    vus: new Set(evenements.map((e) => e.player_id).filter(Boolean)).size,
    partiesRecord, jourRecord: leJour(jourRecord),
    joursSuivis: Object.keys(parJour).length,
    depuisScores: MOIS[debutScores.getMonth()] + " " + debutScores.getFullYear(),
    depuisSuivi: leJour(evenements[0].created_at),
    champions: [...parNumero.values()].filter((s) => s.champion_name).map((s) => ({
      nom: s.champion_name,
      mois: s.season_month
        ? MOIS[Number(s.season_month.slice(5, 7)) - 1]
        // Les deux premières saisons n'ont pas de season_month : leur mois se
        // déduit de la clôture, qui tombe le 1er du mois SUIVANT pour la
        // saison 2 — d'où le recul d'un jour avant de lire le mois.
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

console.log("chiffres lus sur Supabase (clé publique, lecture seule) :");
console.log("  parties, les 7 modes ..... " + S.parties + "   (suivi depuis le " + S.depuisSuivi + ", " + S.joursSuivis + " jours)");
console.log("  scores classés ........... " + S.scores + "   (depuis " + S.depuisScores + ")");
console.log("  parties en ligne ......... " + S.enLigne + "   (" + S.duels + " duels + " + S.salons + " salons)");
console.log("  comptes créés ............ " + S.inscrits);
console.log("  joueurs vus jouer ........ " + S.vus);
console.log("  pays ..................... " + S.pays);
console.log("  record sur une journée ... " + S.partiesRecord + " le " + S.jourRecord);
console.log("  champions couronnés ...... " + S.champions.map((c) => c.nom + " (" + c.mois + ")").join(", "));
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
    // PAS de période dans la surligne : les trois chiffres de ce panneau n'ont
    // pas la même horloge (les parties datent du suivi, les inscrits et les pays
    // du lancement). Une seule date au-dessus des trois en rendrait deux fausses.
    surligne: "LES SEPT MODES · TOUS CONFONDUS",
    titre: ["MERCI", "À VOUS " + nombre(S.inscrits)],
    chiffres: [
      [nombre(S.parties), "parties jouées"],
      [nombre(S.inscrits), "comptes créés"],
      [nombre(S.pays), "pays"],
    ],
    pied: "<b>" + nombre(S.parties) + " parties en " + S.joursSuivis + " jours.</b> "
        + "GOAT FC n'a ni pub, ni budget, ni équipe — il tourne parce que vous revenez. Merci.",
  },
  {
    fichier: "2-vos-records",
    fond: "duel",
    surligne: "LES RECORDS DE LA COMMUNAUTÉ",
    titre: ["CE QUE VOUS", "AVEZ FAIT"],
    // Chaque ligne porte SA période dans son sous-titre. C'est la seule façon
    // honnête de faire tenir sur la même affiche un chiffre de trois semaines et
    // un chiffre de quatre mois.
    liste: [
      [nombre(S.partiesRecord) + " parties en une journée", "le " + S.jourRecord + ", record absolu"],
      [nombre(S.enLigne) + " parties en ligne", nombre(S.duels) + " duels et " + nombre(S.salons) + " salons"],
      [nombre(S.scores) + " scores au classement", "depuis la toute première partie, en " + S.depuisScores.split(" ")[0]],
      [nombre(S.vus) + " joueurs sur le terrain", "en " + S.joursSuivis + " jours de suivi"],
    ],
    pied: "Chacun de ces chiffres, c'est quelqu'un qui a ouvert l'app "
        + "<b>sans qu'on le lui demande</b>.",
  },
  {
    fichier: "3-les-champions",
    bandeau: 58,
    surligne: "HALL OF FAME",
    titre: ["BRAVO", "AUX CHAMPIONS"],
    // Ce n'est PAS un podium : chacun de ces trois-là est PREMIER, dans son mois
    // à lui. Les décorer or/argent/bronze les classerait les uns par rapport aux
    // autres et reléguerait deux champions au rang de dauphins, sur une affiche
    // censée les féliciter.
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

Vous êtes ${nombre(S.inscrits)} à avoir créé un compte sur GOAT FC, depuis ${nombre(S.pays)} pays.

Et en ${S.joursSuivis} jours de suivi, tous modes confondus, vous avez joué ${nombre(S.parties)} parties. ${nombre(S.vus)} d'entre vous sont entrés sur le terrain sur cette seule période.

Aucune pub. Aucun budget. Aucune équipe. GOAT FC tourne parce que vous revenez — et ça, ça ne s'achète pas.

👉 goatfc.fr — gratuit, rien à installer.

#football #foot #quizfoot #culturefoot #communaute #merci #ligue1 #premierleague #footballfrance #goatfc`,

  "2-vos-records": `📊 CE QUE VOUS AVEZ FAIT, EN DÉTAIL.

⚡ ${nombre(S.partiesRecord)} parties en une seule journée, le ${S.jourRecord} — le record absolu
⚔️ ${nombre(S.enLigne)} parties en ligne : ${nombre(S.duels)} duels et ${nombre(S.salons)} salons
🏅 ${nombre(S.scores)} scores enregistrés au classement depuis la toute première partie, en ${S.depuisScores}
👥 ${nombre(S.vus)} joueurs vus sur le terrain en ${S.joursSuivis} jours

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

// Un gabarit qui interpole une variable disparue n'échoue pas : il écrit
// « undefined » et le fichier part tel quel. C'est arrivé — trois fois dans les
// légendes après avoir renommé les chiffres. Le rendu ne pouvait pas le voir,
// les légendes ne passent pas par le navigateur.
for (const [nom, texte] of Object.entries(LEGENDES)) {
  const trou = texte.match(/undefined|NaN/);
  if (trou) throw new Error("légende « " + nom + " » : « " + trou[0] + " » interpolé — une variable a changé de nom.");
}

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
