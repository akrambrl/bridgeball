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
// ── Le bandeau, et pourquoi il n'est pas décoratif ─────────────────────────
// Les illustrations occupent leur cadre en entier — le tiers bas est pris sur
// les six (jambes, table, plateau de jeu). Un titre posé par-dessus se battrait
// avec le dessin. D'où un aplat en bas, qui ne recouvre que la zone déjà la
// moins lisible de chaque dessin.
//
// ── Aplat d'OR, lettrage d'ENCRE ───────────────────────────────────────────
// C'est la règle de la charte prise au mot : sur l'or, seule l'encre se lit —
// 11,5 de contraste, quand le crème tombe à 1,4 et le blanc à 1,7. Le lettrage
// n'a donc besoin ni de cerne ni d'ombre : la charte prescrit `posterLight` sur
// un aplat clair, c'est-à-dire l'italique seule. Un cerne d'encre sur des
// lettres d'encre boucherait les contre-formes pour rien.
//
// La ligne d'encre entre le dessin et le bandeau est ÉPAISSE, et il le faut :
// l'illustration est elle aussi dorée, c'est ce trait seul qui fait lire le
// bandeau comme un panneau et non comme la suite du fond.
//
// Uniforme sur les six, parce que ce sont les ILLUSTRATIONS qui distinguent les
// modes — un titre d'une couleur par carte ferait six objets au lieu d'une
// famille.

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
const G = { encre: jeton("encre"), or: jeton("or"), orSombre: jeton("orSombre") };

// 1086 x 1448 : le format des illustrations, et celui que les composants posent
// en dur (`aspectRatio:"1086 / 1448"`).
const L = 543, H = 724, ECHELLE = 2;
const BANDEAU = 208;          // hauteur de l'aplat d'or, en CSS
const LARGEUR_TITRE = L - 76; // marge de sécurité de part et d'autre

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
  /* L'aplat d'or, et sa ligne d'encre : une transition franche se lit comme un
     panneau voulu, un dégradé comme une bavure. */
  .bandeau{position:absolute;left:0;right:0;bottom:0;height:${BANDEAU}px;background:${G.or};
    border-top:10px solid ${G.encre};display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:8px;padding:14px 34px}
  /* Le cadre d'encre de la charte, sur les quatre bords. */
  .cadre{position:absolute;inset:0;box-shadow:inset 0 0 0 9px ${G.encre};pointer-events:none}
  /* Ni cerne ni ombre : la charte prescrit l'italique seule sur un aplat clair.
     Le décalage d'or sombre du grand mot est la seule concession au relief
     d'affiche — il reste dans la famille de l'or, il n'ajoute pas de couleur. */
  .goat{font-size:56px;line-height:1;letter-spacing:2.5px;color:${G.encre};
    transform:skewX(-7deg)}
  .mot{font-size:132px;line-height:1;letter-spacing:1px;color:${G.encre};
    transform:skewX(-7deg);text-shadow:6px 6px 0 ${G.orSombre}}
  </style></head><body>
    <img class="dessin" src="${b64(dessin, "image/png")}" alt="">
    <div class="bandeau">
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
    const bandeau = document.querySelector(".bandeau");
    const mot = document.querySelector(".mot");
    const goat = document.querySelector(".goat");
    const place = bandeau.clientHeight - 28;   // le rembourrage du bandeau
    let corps = parseFloat(getComputedStyle(mot).fontSize);
    const deborde = () => mot.getBoundingClientRect().width > max
      || goat.getBoundingClientRect().height + mot.getBoundingClientRect().height + 10 > place;
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
