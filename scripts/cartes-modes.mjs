#!/usr/bin/env node
// POSE LE LETTRAGE sur les illustrations de mode.
//
//     node scripts/cartes-modes.mjs            # les six
//     node scripts/cartes-modes.mjs plug duel  # seulement ceux-là
//
// Entrée  : visuels/bruts/<mode>.png   — l'illustration, 1086 x 1448, sans texte
// Sortie  : public/<mode>-card.png     — la même, avec le titre
//
// Pourquoi le titre est posé ICI et non demandé au générateur d'images : ces
// modèles écrivent de travers — lettres inventées, accents baladeurs, mots
// coupés. Le lettrage est donc composé avec la vraie police du logo, et lui seul
// est reproductible : on peut le déplacer, le recolorer ou corriger un nom sans
// toucher au dessin.
//
// ── Le titre est posé À MÊME LE DESSIN, en relief ──────────────────────────
// Pas de bandeau : le titre vit sur l'illustration, comme sur une affiche.
//
// Ce qui le rend lisible n'est PAS la couleur des lettres mais leur CONTOUR.
// Le fond est doré, chargé de lignes de vitesse et de trame : un lettrage crème
// posé nu y tomberait à 1,4 de contraste et disparaîtrait. Cerné d'encre, c'est
// le contour qui porte le contraste — 11,5 contre l'or — et le crème ne sert
// plus qu'à remplir. D'où la recette de la charte pour un grand titre : contour
// d'encre, puis ombre dure d'encre décalée. Les deux ensemble donnent le relief.
//
// Le piège à connaître : cette même recette appliquée à des lettres d'ENCRE sur
// l'or double le mot d'un fantôme noir — l'ombre a la couleur de la lettre. Elle
// ne marche que sur un lettrage clair, ce qui est le cas ici.
//
// En BAS, sur les six. C'est là que se trouvent les jambes, la table, le plateau
// — la zone la moins porteuse de chaque dessin — et c'est là que les visuels
// d'avant mettaient déjà leur titre. Uniforme, parce que ce sont les
// ILLUSTRATIONS qui distinguent les modes.

import { chromium } from "playwright";
import { readFile, writeFile, stat, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const lancer = promisify(execFile);

// La charte est lue COMME TEXTE : charte.jsx crée un élément JSX au niveau du
// module (areneCharte), donc l'importer depuis Node réclamerait React.
const source = await readFile(join(racine, "src", "lib", "charte.jsx"), "utf8");
const jeton = (nom) => {
  const m = source.match(new RegExp(nom + ':\\s*"(#[0-9A-Fa-f]{6})"'));
  if (!m) throw new Error("jeton de charte introuvable : " + nom);
  return m[1];
};
const G = { encre: jeton("encre"), or: jeton("or"), creme: jeton("creme") };

// 1086 x 1448 : le format des illustrations, et celui que les composants posent
// en dur (`aspectRatio:"1086 / 1448"`).
const L = 543, H = 724, ECHELLE = 2;
const BAS = 34;               // distance du titre au bord bas, en CSS
const HAUTEUR_TITRE = 250;    // la bande où le titre a le droit de vivre
const LARGEUR_TITRE = L - 74; // marge de sécurité de part et d'autre

const anton = await readFile(join(ici, "polices", "anton-latin.woff2"));
const b64 = (b, t) => "data:" + t + ";base64," + b.toString("base64");

// « GOAT » + le mot gravé sur la carte. Ce sont les noms déjà utilisés par les
// visuels d'avant : on restyle, on ne renomme pas.
const CARTES = [
  { cle: "plug", mot: "PLUG" },
  { cle: "mercato", mot: "MERCATO" },
  { cle: "duel", mot: "BATTLE" },
  { cle: "grid", mot: "GRID" },
  { cle: "reveal", mot: "REVEAL" },
  { cle: "guess", mot: "GUESS" },
];

function page(dessin, mot) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Anton';src:url(${b64(anton, "font/woff2")}) format('woff2');font-display:block}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${L}px;height:${H}px;overflow:hidden;position:relative;background:${G.or};
    font-family:'Anton',Impact,sans-serif;-webkit-font-smoothing:antialiased}
  .dessin{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
  .titre{position:absolute;left:0;right:0;bottom:${BAS}px;height:${HAUTEUR_TITRE}px;
    display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}
  /* Le cadre d'encre de la charte, sur les quatre bords. */
  .cadre{position:absolute;inset:0;box-shadow:inset 0 0 0 9px ${G.encre};pointer-events:none}
  /* L'ordre de peinture (stroke puis fill) est indispensable : par défaut le
     contour est peint PAR-DESSUS la lettre et lui ronge l'intérieur — à 9 px,
     les contre-formes du A et du O se bouchent complètement. */
  .goat{font-size:62px;line-height:1;letter-spacing:2px;color:${G.creme};
    transform:skewX(-7deg);-webkit-text-stroke:6px ${G.encre};paint-order:stroke fill;
    text-shadow:6px 6px 0 ${G.encre}}
  .mot{font-size:132px;line-height:1;letter-spacing:1px;color:${G.creme};
    transform:skewX(-7deg);-webkit-text-stroke:9px ${G.encre};paint-order:stroke fill;
    text-shadow:11px 11px 0 ${G.encre}}
  </style></head><body>
    <img class="dessin" src="${b64(dessin, "image/png")}" alt="">
    <div class="titre">
      <div class="goat">GOAT</div>
      <div class="mot">${mot}</div>
    </div>
    <div class="cadre"></div>
  </body></html>`;
}

/**
 * Réduit le PNG à une palette de 256 teintes.
 *
 * Ces illustrations sont des aplats tramés : peu de couleurs, mais 2,5 Mo par
 * fichier en sortie de générateur. Sans tramage — sur un aplat, un tramage
 * ajoute du bruit là où il n'y en a pas.
 *
 * Sans ffmpeg on garde le fichier tel quel : mieux vaut un fichier lourd qu'un
 * script qui refuse de tourner.
 */
async function alleger(chemin) {
  const brut = chemin.replace(/\.png$/, ".brut.png");
  try {
    await writeFile(brut, await readFile(chemin));
    await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", brut,
      "-vf", "split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=none",
      chemin]);
    return true;
  } catch (e) {
    return false;
  } finally {
    await rm(brut, { force: true });
  }
}

const demandes = process.argv.slice(2);
const aFaire = demandes.length ? CARTES.filter((c) => demandes.includes(c.cle)) : CARTES;
if (!aFaire.length) {
  console.error("cartes connues : " + CARTES.map((c) => c.cle).join(", "));
  process.exit(1);
}

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const ctx = await navigateur.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE });
const onglet = await ctx.newPage();

for (const carte of aFaire) {
  const entree = join(racine, "visuels", "bruts", carte.cle + ".png");
  let dessin;
  try {
    dessin = await readFile(entree);
  } catch {
    console.error("  " + carte.cle + " : illustration absente — " + entree);
    process.exitCode = 1;
    continue;
  }

  const sortie = join(racine, "public", carte.cle + "-card.png");
  let avant = 0;
  try { avant = (await stat(sortie)).size; } catch { /* nouveau fichier */ }

  await onglet.setContent(page(dessin, carte.mot), { waitUntil: "load" });
  // La police est embarquée et en `font-display:block` : elle est là, mais il
  // faut attendre qu'elle soit posée, sinon le titre part en police système.
  await onglet.evaluate(() => document.fonts.ready);
  // Le mot est RÉDUIT jusqu'à tenir, police posée. En LARGEUR et en HAUTEUR :
  // compter les caractères ne marche pas — la largeur dépend du dessin des
  // lettres, du cerne et de l'italique — et régler la largeur seule laissait
  // « BATTLE » déborder du bandeau par le bas.
  await onglet.evaluate((max) => {
    const zone = document.querySelector(".titre");
    const mot = document.querySelector(".mot");
    const goat = document.querySelector(".goat");
    let corps = parseFloat(getComputedStyle(mot).fontSize);
    // L'ombre dure sort de la boîte de la lettre : on garde de la marge pour
    // qu'elle ne soit pas rognée par le bord de la carte.
    const deborde = () => mot.getBoundingClientRect().width + 14 > max
      || goat.getBoundingClientRect().height + mot.getBoundingClientRect().height + 18 > zone.clientHeight;
    while (deborde() && corps > 30) { corps -= 2; mot.style.fontSize = corps + "px"; }
  }, LARGEUR_TITRE);

  await writeFile(sortie, await onglet.screenshot({ type: "png" }));
  const palette = await alleger(sortie);
  const apres = (await stat(sortie)).size;
  console.log("  " + (carte.cle + "-card.png").padEnd(18)
    + (avant ? (avant / 1024).toFixed(0) + " Ko → " : "") + (apres / 1024).toFixed(0) + " Ko"
    + (palette ? "" : "   (ffmpeg absent : pas de réduction de palette)"));
}

await navigateur.close();
console.log(aFaire.length + " visuel(s) écrit(s) dans public/");
