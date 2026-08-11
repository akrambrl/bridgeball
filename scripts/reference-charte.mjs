#!/usr/bin/env node
// Une PLANCHE DE RÉFÉRENCE de la charte, à donner à qui dessine.
//
//     node scripts/reference-charte.mjs
//
// À quoi ça sert : décrire une direction artistique par écrit ne suffit pas —
// « jaune et noir » se prête à trente interprétations. Cette planche montre les
// teintes exactes, leurs noms, et les deux règles qui ne se devinent pas : ce qui
// se lit sur l'or, et ce qui se lit sur la nuit.
//
// Les valeurs et les contrastes sont CALCULÉS depuis src/lib/charte.jsx, pas
// recopiés : une planche de référence qui a dérivé de l'app est pire que pas de
// planche du tout.

import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");

const source = await readFile(join(racine, "src", "lib", "charte.jsx"), "utf8");
const jeton = (nom) => {
  const m = source.match(new RegExp(nom + ':\\s*"(#[0-9A-Fa-f]{6})"'));
  if (!m) throw new Error("jeton de charte introuvable : " + nom);
  return m[1];
};

const NOMS = ["or", "orSombre", "encre", "nuit", "creme", "pelouse", "pelouseClaire", "maillot", "ciel"];
const G = Object.fromEntries(NOMS.map((n) => [n, jeton(n)]));

// Contraste WCAG, pour afficher la mesure et non une impression.
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (h) => { const n = parseInt(h.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05));
};

const ROLES = {
  or: "LE FOND. L'aplat d'or plein champ.",
  orSombre: "La trame de points, les aplats secondaires sur l'or.",
  encre: "LE TRAIT. Noir à biais vert, jamais noir pur.",
  nuit: "L'écusson noir : le fond des panneaux.",
  creme: "Le lettrage clair, sur la nuit uniquement.",
  pelouse: "Validation, positif. Aplat, pas texte.",
  pelouseClaire: "Le seul vert lisible en TEXTE, sur la nuit.",
  maillot: "Urgence, défaite, compte à rebours.",
  ciel: "L'adversaire, le second camp.",
};

const pastille = (nom) => `
  <div style="display:flex;align-items:center;gap:14px">
    <div style="width:96px;height:96px;background:${G[nom]};border:4px solid ${G.encre};
      box-shadow:6px 6px 0 ${G.encre};flex-shrink:0"></div>
    <div>
      <div style="font-size:19px;font-weight:800;letter-spacing:.5px">${nom}</div>
      <div style="font-size:19px;font-family:ui-monospace,Menlo,monospace">${G[nom].toUpperCase()}</div>
      <div style="font-size:14px;opacity:.72;max-width:280px;line-height:1.35;margin-top:3px">${ROLES[nom]}</div>
    </div>
  </div>`;

const essaiTexte = (fond, teintes) => `
  <div style="background:${fond};border:4px solid ${G.encre};box-shadow:8px 8px 0 ${G.encre};
    padding:18px 20px;display:flex;flex-direction:column;gap:9px">
    ${teintes.map((t) => {
      const c = contraste(G[t], fond);
      const ok = c >= 4.5 ? "lisible" : c >= 3 ? "grand corps seulement" : "ILLISIBLE";
      return `<div style="display:flex;align-items:baseline;gap:12px">
        <div style="color:${G[t]};font-size:27px;font-weight:800;width:210px">Aa ${t}</div>
        <div style="font-size:15px;font-family:ui-monospace,Menlo,monospace;
          color:${contraste(G.encre, fond) > 6 ? G.encre : G.creme};width:56px">${c.toFixed(1)}</div>
        <div style="font-size:14px;color:${contraste(G.encre, fond) > 6 ? G.encre : G.creme};
          opacity:.8">${ok}</div>
      </div>`;
    }).join("")}
  </div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1400px;background:${G.creme};color:${G.encre};padding:44px 48px;
    font-family:Inter,Helvetica,Arial,sans-serif}
  h1{font-size:38px;letter-spacing:-.5px}
  h2{font-size:15px;letter-spacing:2.4px;text-transform:uppercase;opacity:.6;margin-bottom:16px}
  .grille{display:grid;grid-template-columns:1fr 1fr 1fr;gap:26px 34px}
  .deux{display:grid;grid-template-columns:1fr 1fr;gap:30px}
  .regle{border-left:6px solid ${G.encre};padding-left:16px;font-size:17px;line-height:1.5}
  .motif{height:180px;border:4px solid ${G.encre};box-shadow:8px 8px 0 ${G.encre};position:relative;overflow:hidden}
  </style></head><body>
  <h1>GOAT FC — charte graphique</h1>
  <div style="font-size:17px;opacity:.72;margin:8px 0 34px;max-width:900px;line-height:1.5">
    Style « Olive et Tom » : ce qui fait le manga, c'est le TRAIT et l'OMBRE DURE, pas la lumière.
    Aplats francs, contour d'encre, ombre portée nette et décalée. Aucun dégradé, aucun néon, aucun rendu 3D.
  </div>

  <h2>Les teintes</h2>
  <div class="grille" style="margin-bottom:42px">${NOMS.map(pastille).join("")}</div>

  <h2>Ce qui se lit — contrastes mesurés</h2>
  <div class="deux" style="margin-bottom:16px">
    <div>
      <div style="font-size:16px;font-weight:800;margin-bottom:10px">Sur l'or (le fond)</div>
      ${essaiTexte(G.or, ["encre", "nuit", "maillot", "pelouse", "creme"])}
    </div>
    <div>
      <div style="font-size:16px;font-weight:800;margin-bottom:10px">Sur la nuit (les panneaux)</div>
      ${essaiTexte(G.nuit, ["creme", "or", "pelouseClaire", "maillot", "ciel"])}
    </div>
  </div>
  <div class="regle" style="margin-bottom:42px">
    <b>SUR L'OR, SEULE L'ENCRE SE LIT.</b> Toute autre couleur doit vivre à l'intérieur d'une forme
    cerclée d'encre, jamais en texte posé sur le fond. Dans un panneau de nuit, à l'inverse, tout se lit.
  </div>

  <h2>Les deux motifs du décor</h2>
  <div class="deux">
    <div>
      <div class="motif">
        <div style="position:absolute;inset:0;background:${G.or}"></div>
        <div style="position:absolute;inset:-60%;background:repeating-conic-gradient(from 0deg at 50% 50%,
          rgba(8,17,9,.42) 0deg .55deg, transparent .55deg 2.7deg)"></div>
        <div style="position:absolute;inset:0;opacity:.5;background-size:7px 7px;
          background-image:radial-gradient(circle, ${G.orSombre} 1.4px, transparent 1.7px)"></div>
      </div>
      <div style="font-size:15px;margin-top:10px;line-height:1.45">
        <b>Lignes de vitesse</b> convergentes, en encre, + <b>trame sérigraphiée</b> de points d'or sombre.
        C'est le fond de tous les écrans.
      </div>
    </div>
    <div>
      <div class="motif" style="background:${G.nuit};display:flex;align-items:center;justify-content:center;gap:22px">
        <div style="width:104px;height:104px;background:${G.pelouse};border:5px solid ${G.creme};
          box-shadow:9px 9px 0 rgba(217,162,26,.5)"></div>
        <div style="width:104px;height:104px;border-radius:50%;background:${G.maillot};
          border:5px solid ${G.creme};box-shadow:9px 9px 0 rgba(217,162,26,.5)"></div>
      </div>
      <div style="font-size:15px;margin-top:10px;line-height:1.45">
        <b>Sur la nuit, le contour s'inverse</b> : il passe en crème, avec un décalage d'or derrière.
        Un contour d'encre sur un fond de nuit disparaît.
      </div>
    </div>
  </div>
  </body></html>`;

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const onglet = await (await navigateur.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })).newPage();
await onglet.setContent(html, { waitUntil: "load" });
await mkdir(join(racine, "visuels"), { recursive: true });
const chemin = join(racine, "visuels", "reference-charte.png");
await writeFile(chemin, await onglet.screenshot({ fullPage: true }));
await navigateur.close();
console.log("écrit " + chemin);
