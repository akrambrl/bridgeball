#!/usr/bin/env node
// Les SIX VISUELS DE MODE, redessinés à la charte.
//
//     node scripts/cartes-modes.mjs            # les six
//     node scripts/cartes-modes.mjs plug duel  # seulement ceux-là
//
// Pourquoi un script et non six fichiers dessinés à la main : les couleurs sont
// LUES dans src/lib/charte.jsx, donc elles ne peuvent pas dériver de l'app. Le
// jour où la charte bouge, on relance et les six visuels suivent. C'est déjà ce
// qui avait mal tourné ailleurs — trois lignes de CSS recopiées à la main sont
// restées vertes une version entière après le passage à l'or.
//
// ── Ce que les visuels d'avant faisaient de travers ────────────────────────
// Ils venaient de l'identité précédente : illustration façon manga sur fond
// BLEU ÉLECTRIQUE, lettrage chromé blanc et bleu. Posés sur l'accueil doré, ils
// n'avaient plus aucun rapport avec l'app. Ils pesaient aussi 5,2 Mo à eux six.
//
// ── Les décisions de dessin, et leurs raisons ──────────────────────────────
//  • FOND DE NUIT, pas d'or. La carte est POSÉE sur l'or : un fond doré
//    disparaîtrait dans le fond. La charte le dit — pour une surface principale
//    posée sur le fond, prendre `nuit`, l'écusson noir du logo.
//  • CONTOUR CLAIR, PAS D'ENCRE. Le trait d'encre de la charte n'existe que sur
//    un fond plus clair que lui. Sur la nuit il disparaît. On inverse donc,
//    exactement comme le logo : lettres claires, cerné d'encre, et un DÉCALAGE
//    D'OR derrière. C'est le traitement de `logo-mot.webp`, donc le plus
//    « même style que l'app » possible.
//  • TITRE AU CENTRE-BAS et non tout en bas. Ces visuels sont affichés en
//    `objectFit:cover` dans plusieurs boîtes, tantôt cadrées au centre, tantôt
//    en bas : un titre collé au bord se fait rogner dans le premier cas.
//  • UN ACCENT PAR MODE, mesuré sur le fond de nuit. Les six tiennent
//    au-dessus de 3,5 de contraste, seuil d'un très grand corps : crème 14,9 ·
//    or 11,0 · vert clair 9,3 · vert 5,1 · rouge 4,0 · ciel 3,6.
//  • L'EMBLÈME porte le sens, pas la couleur. Deux écussons reliés pour le
//    pont, une chaîne pour le mercato, un cercle fendu pour le duel : même si
//    deux accents se ressemblent, les emblèmes ne se confondent pas.

import { chromium } from "playwright";
import { readFile, writeFile, stat, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");

// La charte est lue COMME TEXTE : charte.jsx crée un élément JSX au niveau du
// module (areneCharte), donc l'importer depuis Node réclamerait React. Le même
// procédé qu'apercu.mjs emploie pour lire STATS_CODE.
const source = await readFile(join(racine, "src", "lib", "charte.jsx"), "utf8");
function jeton(nom) {
  const m = source.match(new RegExp(nom + ':\\s*"(#[0-9A-Fa-f]{3,8})"'));
  if (!m) throw new Error("jeton de charte introuvable : " + nom);
  return m[1];
}
const G = {
  encre: jeton("encre"), or: jeton("or"), orSombre: jeton("orSombre"),
  creme: jeton("creme"), pelouse: jeton("pelouse"), pelouseClaire: jeton("pelouseClaire"),
  maillot: jeton("maillot"), ciel: jeton("ciel"), nuit: jeton("nuit"),
};

// 1086 x 1448, comme les visuels d'avant : les composants qui les affichent
// posent `aspectRatio:"1086 / 1448"` en dur.
const L = 543, H = 724, ECHELLE = 2;

const anton = await readFile(join(ici, "polices", "anton-latin.woff2"));
const logo = await readFile(join(racine, "public", "logo-mot.webp"));
const b64 = (b, t) => "data:" + t + ";base64," + b.toString("base64");
const lancer = promisify(execFile);

/**
 * Réduit le PNG à une PALETTE de 256 teintes.
 *
 * Ces visuels sont des aplats : une quinzaine de couleurs, plus l'anticrénelage
 * des bords. Les stocker en couleurs vraies coûtait 390 Ko par carte pour rien —
 * la palette descend à 165 Ko, sans différence visible (vérifié à l'œil, sans
 * tramage : sur des aplats, un tramage ajouterait du bruit là où il n'y en a pas).
 *
 * Sans ffmpeg, on garde le PNG tel quel : mieux vaut un fichier lourd qu'un
 * script qui refuse de tourner.
 */
async function alleger(chemin) {
  const brut = chemin.replace(/\.png$/, ".brut.png");
  try {
    await writeFile(brut, await readFile(chemin));
    await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", brut,
      "-vf", "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none",
      chemin]);
    return true;
  } catch (e) {
    return false;
  } finally {
    await rm(brut, { force: true });
  }
}

// ── Les emblèmes ───────────────────────────────────────────────────────────
// Des aplats, un contour clair, un décalage d'or. Aucun dégradé : ce qui fait le
// manga ici, c'est le trait et l'aplat, pas la lumière.
const ECUSSON = "polygon(50% 0%, 100% 14%, 100% 60%, 50% 100%, 0% 60%, 0% 14%)";
const ECLAIR = "polygon(58% 0%, 20% 52%, 44% 52%, 34% 100%, 78% 42%, 52% 42%, 66% 0%)";
const MAILLOT_FORME = "polygon(30% 0%, 42% 8%, 58% 8%, 70% 0%, 100% 18%, 88% 40%, 82% 33%, 82% 100%, 18% 100%, 18% 33%, 12% 40%, 0% 18%)";

// Un contour clair NE PEUT PAS se faire au box-shadow sur une forme decoupee :
// le clip-path rogne l'ombre. On empile donc deux formes — une creme derriere,
// un peu plus grande grace au rembourrage, et l'aplat de couleur devant.
const OMBRE_OR = "drop-shadow(8px 8px 0 rgba(217,162,26,.34))";
function contour(forme, couleur, l, h, dedans) {
  return `<div style="width:${l}px;height:${h}px;background:${G.creme};clip-path:${forme};
    padding:6px;display:flex;flex-shrink:0">
      <div style="flex:1;background:${couleur};clip-path:${forme};display:flex;
        align-items:center;justify-content:center">${dedans || ""}</div>
    </div>`;
}
const ecusson = (couleur, taille) => contour(ECUSSON, couleur, taille, Math.round(taille * 1.18));

const EMBLEMES = {
  // Le pont entre DEUX clubs : deux écussons, et la barre qui les relie.
  plug: () => `
    <div style="display:flex;align-items:center;justify-content:center;filter:${OMBRE_OR}">
      ${ecusson(G.pelouse, 176)}
      <div style="width:136px;height:52px;background:${G.creme};padding:6px;margin:0 -26px;
        position:relative;z-index:2;display:flex;border-radius:8px">
        <div style="flex:1;background:${G.or};border-radius:4px;display:flex;align-items:center;
          justify-content:space-around;padding:0 16px">
          <div style="width:13px;height:26px;background:${G.encre};border-radius:3px"></div>
          <div style="width:13px;height:26px;background:${G.encre};border-radius:3px"></div>
        </div>
      </div>
      ${ecusson(G.ciel, 176)}
    </div>`,

  // La chaîne sans fin : trois maillons, dont un ouvert vers la droite.
  mercato: () => {
    // Un maillon = trois couches : contour crème, corps d'or, et un TROU de la
    // couleur du fond. Sans le trou, trois anneaux qui se chevauchent donnent
    // trois gélules — c'est ce que faisait la version d'avant.
    const maillon = (d, c, z) => `<div style="width:150px;height:104px;border-radius:52px;
      background:${G.creme};padding:6px;transform:rotate(${d}deg);margin:0 -20px;flex-shrink:0;
      position:relative;z-index:${z}">
        <div style="width:100%;height:100%;border-radius:46px;background:${c};padding:17px">
          <div style="width:100%;height:100%;border-radius:30px;background:${G.nuit};
            box-shadow:inset 0 0 0 5px ${G.creme}"></div>
        </div>
      </div>`;
    // z-index alterné : le maillon du milieu passe DERRIÈRE, ce qui donne
    // l'entrelacement sans avoir à découper les formes.
    return `<div style="display:flex;align-items:center;justify-content:center;filter:${OMBRE_OR}">
      ${maillon(-14, G.or, 2)}${maillon(12, G.orSombre, 1)}${maillon(-14, G.or, 2)}
    </div>`;
  },

  // Le 1v1 : un cercle FENDU en deux camps, et l'éclair dans la fente.
  duel: () => `
    <div style="position:relative;width:330px;height:330px;filter:${OMBRE_OR}">
      <div style="position:absolute;inset:0;border-radius:50%;background:${G.creme};padding:6px">
        <div style="position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden">
          <div style="position:absolute;inset:0;background:${G.maillot};clip-path:polygon(0 0,60% 0,40% 100%,0 100%)"></div>
          <div style="position:absolute;inset:0;background:${G.ciel};clip-path:polygon(60% 0,100% 0,100% 100%,40% 100%)"></div>
          <div style="position:absolute;inset:0;background:${G.creme};clip-path:polygon(57% 0,63% 0,43% 100%,37% 100%)"></div>
        </div>
      </div>
      <div style="position:absolute;left:50%;top:14%;transform:translateX(-50%);width:118px;height:216px;
        background:${G.creme};clip-path:${ECLAIR};display:flex">
        <div style="flex:1;background:${G.or};clip-path:${ECLAIR};transform:scale(.84)"></div>
      </div>
    </div>`,

  // La grille 3x3 : des cases remplies, des cases à remplir.
  grid: () => {
    const remplies = { 0: G.pelouse, 2: G.or, 4: G.maillot, 6: G.or, 8: G.pelouse };
    const cases = Array.from({ length: 9 }, (_, i) => {
      const c = remplies[i];
      return `<div style="background:${G.creme};border-radius:16px;padding:5px;display:flex">
        <div style="flex:1;background:${c || G.encre};border-radius:12px;display:flex;
          align-items:center;justify-content:center;color:${G.or};font-size:42px;line-height:1">
          ${c ? "" : "+"}</div></div>`;
    }).join("");
    return `<div style="display:grid;grid-template-columns:repeat(3,96px);grid-template-rows:repeat(3,96px);
      gap:13px;filter:${OMBRE_OR}">${cases}</div>`;
  },

  // Trouve le joueur : le maillot, et l'inconnue dessus.
  reveal: () => `
    <div style="filter:${OMBRE_OR}">${contour(MAILLOT_FORME, G.ciel, 320, 324,
      `<div style="font-size:150px;color:${G.creme};-webkit-text-stroke:8px ${G.encre};
        paint-order:stroke fill;transform:skewX(-7deg);line-height:1;margin-top:26px">?</div>`)}</div>`,

  // Le Devin : la boule, et son socle.
  guess: () => `
    <div style="display:flex;flex-direction:column;align-items:center;
      filter:drop-shadow(9px 9px 0 rgba(217,162,26,.45))">
      <div style="width:296px;height:296px;border-radius:50%;background:${G.creme};padding:6px">
        <div style="width:100%;height:100%;border-radius:50%;background:${G.pelouseClaire};
          display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
          <div style="position:absolute;top:26px;left:40px;width:66px;height:38px;border-radius:50%;
            background:rgba(242,231,206,.6);transform:rotate(-24deg)"></div>
          <div style="font-size:148px;color:${G.encre};line-height:1;transform:skewX(-7deg)">?</div>
        </div>
      </div>
      <div style="width:232px;height:56px;background:${G.creme};margin-top:-14px;
        clip-path:polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%);padding:6px;display:flex">
        <div style="flex:1;background:${G.encre};
          clip-path:polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)"></div></div>
    </div>`,
};

// ── Les six cartes ─────────────────────────────────────────────────────────
const CARTES = [
  { cle: "plug",    mot: "PLUG",    accent: G.pelouse },
  { cle: "mercato", mot: "MERCATO", accent: G.or },
  { cle: "duel",    mot: "BATTLE",  accent: G.maillot },
  { cle: "grid",    mot: "GRID",    accent: G.creme },
  { cle: "reveal",  mot: "REVEAL",  accent: G.ciel },
  { cle: "guess",   mot: "GUESS",   accent: G.pelouseClaire },
];

// Largeur utile du bloc de titre. Le corps de départ est volontairement TROP
// GRAND : c'est la mesure dans la page qui le ramène à la bonne taille (voir
// `ajuster`). Compter les caractères ne marchait pas — la largeur dépend du
// dessin des lettres, de l'épaisseur du cerne et de l'italique.
const LARGEUR_TITRE = L - 100;

function page(carte) {
  const { mot, accent } = carte;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Anton';src:url(${b64(anton, "font/woff2")}) format('woff2');font-display:block}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${L}px;height:${H}px;overflow:hidden;background:${G.nuit};
    font-family:'Anton',Impact,sans-serif;-webkit-font-smoothing:antialiased}
  /* Les LIGNES DE VITESSE de l'arène, transposées sur la nuit : en or à faible
     opacité au lieu d'encre, sinon elles ne se verraient pas. */
  .lignes{position:absolute;inset:-30%;
    background:repeating-conic-gradient(from 0deg at 50% 40%,
      rgba(245,194,43,.13) 0deg .9deg, rgba(245,194,43,0) .9deg 4.4deg)}
  .coeur{position:absolute;inset:0;
    background:radial-gradient(circle at 50% 40%, ${G.nuit} 0 16%, rgba(18,22,15,.86) 30%, rgba(18,22,15,0) 62%)}
  /* La trame sérigraphiée ferme la couche, comme sur l'accueil. */
  .trame{position:absolute;inset:0;opacity:.14;
    background-image:radial-gradient(circle, ${G.orSombre} 1.1px, transparent 1.4px);background-size:13px 13px}
  .bord{position:absolute;inset:0;box-shadow:inset 0 0 0 7px ${G.encre}, inset 0 0 0 11px rgba(245,194,43,.5)}
  .col{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
    padding:38px 34px 58px}
  .marque{width:186px;display:block}
  /* flex:1 1 0 et min-height:0 : en base auto, un emblème trop grand POUSSAIT le
     titre hors de la carte au lieu de céder. Ici la zone est bornée, et c'est
     l'emblème qu'on met à l'échelle, plus bas. */
  .emb{flex:1 1 0;min-height:0;display:flex;align-items:center;justify-content:center;width:100%}
  .titre{flex:0 0 244px}
  /* Le lettrage du logo : lettres claires, cerné d'encre, décalage d'or. Sur la
     nuit, une ombre d'encre serait invisible — c'est l'or qui donne le relief. */
  /* Bande de titre à HAUTEUR FIXE : sans elle, le titre se posait plus ou moins
     bas selon la hauteur de l'emblème, et les six cartes ne s'alignaient pas
     quand on les voit côte à côte — dans le carrousel, justement. */
  .titre{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px}
  
  .goat{font-size:76px;line-height:1;letter-spacing:2px;color:${G.creme};
    transform:skewX(-7deg);-webkit-text-stroke:7px ${G.encre};paint-order:stroke fill;
    text-shadow:8px 8px 0 ${G.or}}
  .mot{font-size:150px;line-height:1;letter-spacing:1px;color:${accent};
    transform:skewX(-7deg);-webkit-text-stroke:9px ${G.creme};paint-order:stroke fill;
    text-shadow:10px 10px 0 ${G.encre}}
  </style></head><body>
    <div class="lignes"></div><div class="coeur"></div><div class="trame"></div><div class="bord"></div>
    <div class="col">
      <img class="marque" src="${b64(logo, "image/webp")}" alt="">
      <div class="emb">${EMBLEMES[carte.cle]()}</div>
      <div class="titre">
        <div class="goat">GOAT</div>
        <div class="mot">${mot}</div>
      </div>
    </div>
  </body></html>`;
}

const demandes = process.argv.slice(2);
const aFaire = demandes.length ? CARTES.filter((c) => demandes.includes(c.cle)) : CARTES;
if (!aFaire.length) {
  console.error("aucune carte connue : " + CARTES.map((c) => c.cle).join(", "));
  process.exit(1);
}

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const ctx = await navigateur.newContext({
  viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE,
});
const onglet = await ctx.newPage();

for (const carte of aFaire) {
  const chemin = join(racine, "public", carte.cle + "-card.png");
  let avant = 0;
  try { avant = (await stat(chemin)).size; } catch { /* nouveau fichier */ }

  await onglet.setContent(page(carte), { waitUntil: "load" });
  // La police est en `font-display:block` et embarquée : elle est là, mais il
  // faut attendre qu'elle soit posée, sinon le titre part en police système.
  await onglet.evaluate(() => document.fonts.ready);
  // On RÉDUIT chaque ligne jusqu'à ce qu'elle tienne, police posée. Sans ça
  // « MERCATO » débordait des bords pendant que « GRID » flottait au milieu.
  await onglet.evaluate((max) => {
    // D'ABORD le titre : sa hauteur définitive détermine la place qui reste à
    // l'emblème.
    for (const sel of [".goat", ".mot"]) {
      const el = document.querySelector(sel);
      let corps = parseFloat(getComputedStyle(el).fontSize);
      // getBoundingClientRect tient compte de l'italique et du cerne, pas
      // scrollWidth : c'est bien la boîte peinte qu'on veut faire tenir.
      while (el.getBoundingClientRect().width > max && corps > 28) {
        corps -= 2; el.style.fontSize = corps + "px";
      }
    }
    // ENSUITE l'emblème, mis à l'échelle pour tenir dans ce qui reste. Chaque
    // emblème a ses dimensions propres ; les régler un par un à la main aurait
    // lâché au premier réglage de la mise en page.
    const zone = document.querySelector(".emb");
    const dedans = zone.firstElementChild;
    const z = zone.getBoundingClientRect(), d = dedans.getBoundingClientRect();
    const f = Math.min(1, (z.width - 8) / d.width, (z.height - 8) / d.height);
    if (f < 1) dedans.style.transform = "scale(" + f.toFixed(3) + ")";
  }, LARGEUR_TITRE);
  await writeFile(chemin, await onglet.screenshot({ type: "png" }));
  const palette = await alleger(chemin);

  const apres = (await stat(chemin)).size;
  console.log("  " + (carte.cle + "-card.png").padEnd(18)
    + (avant ? (avant / 1024).toFixed(0) + " Ko → " : "") + (apres / 1024).toFixed(0) + " Ko"
    + (palette ? "" : "   (ffmpeg absent : pas de réduction de palette)"));
}

await navigateur.close();
console.log(aFaire.length + " visuel(s) écrit(s) dans public/");
