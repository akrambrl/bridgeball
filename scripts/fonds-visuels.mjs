#!/usr/bin/env node
// Les FONDS des visuels de mode — jaune et noir, sans aucun dessin.
//
//     node scripts/fonds-visuels.mjs
//
// À quoi ça sert : fournir la matière de base sur laquelle poser une
// illustration à la main. Ce script ne dessine donc NI emblème NI titre : que le
// décor. C'est demandé, et c'est aussi la bonne division du travail — un dessin
// se juge à l'œil, un décor se construit.
//
// Les valeurs viennent de src/lib/charte.jsx, lues comme texte : recopiées à la
// main, elles auraient dérivé de l'app à la première retouche de la charte.
// C'est exactement le décor de l'accueil — `fondCharte` pour l'aplat d'or et
// `areneCharte` pour les lignes de vitesse et la trame — donc les fonds sont la
// même matière que l'écran sur lequel les cartes sont posées.

import { chromium } from "playwright";
import { readFile, writeFile, stat, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const lancer = promisify(execFile);

const source = await readFile(join(racine, "src", "lib", "charte.jsx"), "utf8");
function jeton(nom) {
  const m = source.match(new RegExp(nom + ':\\s*"(#[0-9A-Fa-f]{3,8})"'));
  if (!m) throw new Error("jeton de charte introuvable : " + nom);
  return m[1];
}
const G = {
  encre: jeton("encre"), or: jeton("or"), orSombre: jeton("orSombre"),
  creme: jeton("creme"), nuit: jeton("nuit"),
};

// 1086 x 1448, le format des visuels de mode : les composants qui les affichent
// posent `aspectRatio:"1086 / 1448"` en dur.
const L = 543, H = 724, ECHELLE = 2;

// ── Les deux couches du décor de l'app ─────────────────────────────────────
//
// Les LIGNES DE VITESSE sont un dégradé conique répété : un dégradé conique
// dessine des coins qui rayonnent depuis un point, ce qui est exactement une
// ligne de vitesse. Le centre est ensuite RECOUVERT d'un aplat, plutôt que
// masqué — sinon les lignes se rejoignent en une tache au milieu.
//
// La TRAME sérigraphiée ferme la couche. Sur l'or elle est en or sombre : une
// trame noire grise le fond au lieu de le texturer. Sur la nuit, l'inverse.
const lignes = (couleur, ep, pas) => `repeating-conic-gradient(from 0deg at 50% 42%,
  ${couleur} 0deg ${ep}deg, transparent ${ep}deg ${pas}deg)`;

const FONDS = {
  // Le fond de l'accueil, à l'identique : aplat d'or, lignes d'encre, trame d'or
  // sombre. C'est le plus proche de « le jaune et le noir de l'app ».
  or: () => `
    <div style="position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 38%,
      rgba(245,194,43,.96) 0 34%, rgba(217,162,26,.55) 100%), ${G.or}"></div>
    <div style="position:absolute;inset:-25%;background:${lignes("rgba(8,17,9,.42)", .55, 2.7)}"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,
      ${G.or} 0 20%, rgba(245,194,43,.92) 32%, rgba(245,194,43,0) 62%)"></div>
    <div style="position:absolute;inset:0;opacity:.5;background-size:7px 7px;
      background-image:radial-gradient(circle, ${G.orSombre} 1.4px, transparent 1.7px)"></div>
    <div style="position:absolute;inset:0;box-shadow:inset 0 0 0 11px ${G.encre}"></div>`,

  // Or, avec un BANDEAU d'encre en bas : de quoi poser un titre clair sans
  // qu'il ait à lutter contre le jaune. Sur l'or, seule l'encre se lit — un
  // lettrage crème y tombe à 1,4 de contraste, un blanc à 1,7.
  "or-bandeau": () => FONDS.or() + `
    <div style="position:absolute;left:0;right:0;bottom:0;height:34%;background:${G.nuit};
      box-shadow:inset 0 11px 0 ${G.encre}, inset 0 0 0 11px ${G.encre}"></div>
    <div style="position:absolute;left:0;right:0;bottom:34%;height:7px;background:${G.encre}"></div>`,

  // L'inverse : aplat de nuit, lignes et trame d'or. Utile si l'illustration est
  // claire — elle se détacherait mal sur du jaune.
  nuit: () => `
    <div style="position:absolute;inset:0;background:${G.nuit}"></div>
    <div style="position:absolute;inset:-30%;background:${lignes("rgba(245,194,43,.16)", .9, 4.4)}"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,
      ${G.nuit} 0 16%, rgba(18,22,15,.86) 30%, rgba(18,22,15,0) 62%)"></div>
    <div style="position:absolute;inset:0;opacity:.16;background-size:13px 13px;
      background-image:radial-gradient(circle, ${G.orSombre} 1.1px, transparent 1.4px)"></div>
    <div style="position:absolute;inset:0;box-shadow:inset 0 0 0 11px ${G.encre}, inset 0 0 0 15px rgba(245,194,43,.5)"></div>`,

  // Jaune ET noir, coupés en diagonale : les deux couleurs à parts égales, et une
  // moitié sombre où poser un lettrage clair.
  diagonale: () => `
    ${FONDS.or()}
    <div style="position:absolute;inset:0;background:${G.nuit};
      clip-path:polygon(0 62%, 100% 38%, 100% 100%, 0 100%)"></div>
    <div style="position:absolute;inset:0;background:${G.or};
      clip-path:polygon(0 62%, 100% 38%, 100% 41.5%, 0 65.5%)"></div>
    <div style="position:absolute;inset:0;box-shadow:inset 0 0 0 11px ${G.encre}"></div>`,
};

const page = (cle) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${L}px;height:${H}px;overflow:hidden;position:relative;background:${G.or}}
  </style></head><body>${FONDS[cle]()}</body></html>`;

/**
 * Réduit le PNG à une palette de 256 teintes.
 *
 * Ces fonds sont des aplats et des trames : une poignée de couleurs. Les stocker
 * en couleurs vraies coûte trois fois plus pour rien. Sans tramage — sur un
 * aplat, un tramage ajoute du bruit là où il n'y en a pas.
 *
 * Sans ffmpeg on garde le fichier tel quel : mieux vaut un fichier lourd qu'un
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

const dossier = join(racine, "visuels");
await mkdir(dossier, { recursive: true });

const demandes = process.argv.slice(2);
const cles = Object.keys(FONDS).filter((c) => !demandes.length || demandes.includes(c));
if (!cles.length) {
  console.error("fonds connus : " + Object.keys(FONDS).join(", "));
  process.exit(1);
}

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const ctx = await navigateur.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE });
const onglet = await ctx.newPage();

for (const cle of cles) {
  const chemin = join(dossier, "fond-" + cle + ".png");
  await onglet.setContent(page(cle), { waitUntil: "load" });
  await writeFile(chemin, await onglet.screenshot({ type: "png" }));
  const palette = await alleger(chemin);
  console.log("  fond-" + (cle + ".png").padEnd(18) + ((await stat(chemin)).size / 1024).toFixed(0) + " Ko"
    + (palette ? "" : "   (ffmpeg absent : pas de réduction de palette)"));
}

await navigateur.close();
console.log(cles.length + " fond(s) en " + (L * ECHELLE) + "x" + (H * ECHELLE) + " dans visuels/");
