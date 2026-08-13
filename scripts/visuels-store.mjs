#!/usr/bin/env node
// FABRIQUE les visuels de la fiche Play Store, et CONTRÔLE qu'ils sont acceptables.
//
//     npm run store              # captures + bannière, puis contrôle
//     npm run store -- --verifie # ne fabrique rien, contrôle ce qui est là
//
// ── CE QUE PLAY EXIGE, ET QUI N'EST PAS NÉGOCIABLE ─────────────────────────
//
//   captures d'écran   2 à 8, PNG ou JPEG, rapport 16:9 ou 9:16, chaque côté
//                      entre 320 et 3840 px. On sort en 1080×1920.
//   bannière           1024×500 EXACTEMENT, PNG ou JPEG, sans transparence.
//   icône              512×512 — déjà dans public/icon-512.png.
//
// Un dépôt refusé pour un pixel de travers coûte un aller-retour de revue, et la
// revue est le seul délai qu'on ne contrôle pas. D'où le contrôle en fin de course
// plutôt qu'un coup d'œil.
//
// ── LES CAPTURES SONT PRISES DANS LE VRAI JEU ──────────────────────────────
//
// Pas de maquette : on rejoue les écrans avec scripts/apercu.mjs, qui lance l'app
// pour de bon avec Supabase bouché. Une fiche qui montre autre chose que l'app
// est un motif de refus, et c'est aussi une promesse qu'on ne tient pas.
//
// LE CHOIX DES CINQ ÉCRANS EST MESURÉ, pas décidé à l'avance. Les feuilles de mode
// de The Plug et The Mercato ont d'abord été capturées : sur un écran 9:16, leur
// rangée de difficulté est coupée en bas — c'est le débordement qu'on a choisi
// d'accepter dans l'app, mais sur une capture de store ça fait inachevé. On montre
// donc le JEU pour ces deux modes, ce qui vend mieux de toute façon : « Inter Milan
// vs Real Madrid » dit le jeu en une image, une liste de difficultés non.
//
// GOAT GRID garde sa feuille, elle : depuis que l'affiche se plafonne sur la
// hauteur disponible, ses deux cartes tiennent à l'écran.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, stat, unlink, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const SORTIE = join(racine, "visuels", "store");
const VERIFIE = process.argv.includes("--verifie");
// Les captures relancent l'app cinq fois et prennent plusieurs minutes ; la
// bannière se rend en une seconde. Les séparer évite de tout refaire pour
// déplacer un mot — et c'est en la retouchant qu'on la corrige.
const BANNIERE_SEULE = process.argv.includes("--banniere");

const OR = "#F5C22B", ENCRE = "#081109", NUIT = "#12160F", CREME = "#F2E7CE";

/** Les cinq écrans, dans l'ordre où ils apparaîtront sur la fiche. */
const CAPTURES = [
  { n: "01-plug",     ecran: "partie-plug",  quoi: "The Plug — deux clubs, un joueur" },
  { n: "02-mercato",  ecran: "mercato-juste", quoi: "The Mercato — la chaîne de transferts" },
  { n: "03-goatgrid", ecran: "mode-goatgrid", quoi: "GOAT GRID — solo ou versus" },
  { n: "04-guess",    ecran: "mode-guess",    quoi: "GOAT Guess — le Devin" },
  { n: "05-reveal",   ecran: "mode-grid",     quoi: "Trouve le joueur — la déduction" },
];

const ko = (o) => Math.round(o / 1024) + " ko";

async function capturer() {
  for (const c of CAPTURES) {
    // 360×640 en CSS à l'échelle 3 = 1080×1920. Une largeur de téléphone réaliste,
    // donc une mise en page qu'on peut juger, et le format exact demandé.
    await lancer("node", [join(ici, "apercu.mjs"), c.ecran], {
      cwd: racine, timeout: 300000,
      env: { ...process.env, LARGEUR: "360", HAUTEUR: "640", ECHELLE: "3" },
    }).catch(() => {});
    const brut = join(racine, "apercu-" + c.ecran + ".png");
    await copyFile(brut, join(SORTIE, c.n + ".png"));
    await unlink(brut).catch(() => {});
    console.log("  " + c.n.padEnd(12) + c.quoi);
  }
}

// ─── LA BANNIÈRE ────────────────────────────────────────────────────────────
// Composée avec les propres éléments de l'app : le fond et l'arène de
// src/lib/charte.jsx copiés à l'identique, l'écusson de public/logo.png, et Anton,
// la police du lettrage. Rien n'est dessiné ici — on assemble.
//
// L'AFFICHE EST ENCADRÉE, PAS DÉCOUPÉE, et le nom n'est écrit qu'une fois.
//
// Premier essai : l'écusson masqué en disque fondu, plus « GOAT FC » en gros à
// côté. Deux défauts d'un coup, vus à l'image. Le disque coupait le lettrage de
// l'affiche elle-même — on lisait un « GOAT » tronqué et un « FC » à moitié —
// parce que cette affiche est un carré dont le contenu va bord à bord, le même
// piège que pour l'icône adaptative. Et le nom apparaissait DEUX FOIS, une fois
// dans l'écusson, une fois en lettres.
//
// La sortie est celle que le code de l'app avait déjà trouvée pour les feuilles de
// mode : « l'affiche porte déjà le nom en toutes lettres », donc on ne le répète
// pas. L'affiche est posée entière dans un cadre d'encre à ombre dure — le panneau
// de la charte — et le lettrage à côté sert l'ACCROCHE, pas le nom.
//
// Le texte est à L'ENCRE. Sur l'or, seule l'encre se lit : le projecteur y vaut
// 1,0 de contraste — c'est la même teinte — et le blanc 1,66. L'encre donne 11,5.
function pageBanniere(logo64, anton64) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Anton";src:url(data:font/woff2;base64,${anton64}) format("woff2");font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1024px;height:500px;overflow:hidden}
body{position:relative;background:radial-gradient(120% 80% at 30% 46%, rgba(245,194,43,.96) 0 34%, rgba(217,162,26,.55) 100%),${OR};
  font-family:"Anton",Impact,sans-serif}
/* L'arène de la charte, centrée sur l'écusson et non sur la page : les rayons
   doivent partir de la marque, sinon le centre dégagé tombe dans le vide. */
.rayons{position:absolute;inset:-25%;
  background:repeating-conic-gradient(from 0deg at 27% 50%, rgba(8,17,9,.42) 0deg .55deg, rgba(8,17,9,0) .55deg 2.7deg)}
.coeur{position:absolute;inset:0;
  background:radial-gradient(circle at 27% 50%, ${OR} 0 12%, rgba(245,194,43,.92) 22%, rgba(245,194,43,0) 52%)}
.trame{position:absolute;inset:0;opacity:.5;
  background-image:radial-gradient(circle,#D9A21A 1.4px,transparent 1.7px);background-size:7px 7px}
.cadre{position:absolute;inset:0;border:6px solid ${ENCRE}}
.scene{position:absolute;inset:0;display:flex;align-items:center;gap:34px;padding:0 46px 0 40px}
/* Le panneau de la charte : cadre d'encre, angle arrondi, ombre dure. L'affiche
   y tient ENTIÈRE — c'est tout l'objet du cadre, qui remplace le masque. */
.ecusson{width:372px;height:372px;flex:0 0 auto;border:5px solid ${ENCRE};
  border-radius:20px;overflow:hidden;box-shadow:9px 9px 0 ${ENCRE};background:${OR}}
.ecusson img{width:100%;height:100%;object-fit:cover;display:block}
.mots{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:18px}
.titre{font-size:96px;line-height:.86;color:${ENCRE};letter-spacing:.004em;
  transform:skewX(-7deg);transform-origin:left center}
/* width:max-content, et pas seulement display:block — PAS DE GUILLEMET OBLIQUE
   dans ce commentaire, il fermerait le gabarit JS qui contient toute cette
   feuille de style. Un span en bloc prend TOUTE la largeur de son conteneur,
   donc getBoundingClientRect renvoyait 532 px quelle que soit la taille de
   police, et la boucle de mesure descendait jusqu'au plancher de 40 px sans
   jamais mesurer le texte. */
.titre span{display:block;width:max-content;white-space:nowrap}
.modes{display:flex;gap:10px;flex-wrap:wrap;max-width:520px}
.mode{background:${NUIT};color:${CREME};border:3px solid ${ENCRE};border-radius:11px;
  padding:9px 14px;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:800;
  font-size:16.5px;letter-spacing:.1em;white-space:nowrap;box-shadow:3px 3px 0 ${ENCRE}}
</style></head><body>
<div class="rayons"></div><div class="coeur"></div><div class="trame"></div>
<div class="scene">
  <div class="ecusson"><img src="data:image/png;base64,${logo64}" alt=""></div>
  <div class="mots">
    <div class="titre"><span>LE QUIZ</span><span>FOOTBALL QUI</span><span>REND ACCRO</span></div>
    <div class="modes">
      <span class="mode">THE PLUG</span><span class="mode">THE MERCATO</span>
      <span class="mode">GOAT GRID</span><span class="mode">GOAT GUESS</span>
    </div>
  </div>
</div>
<div class="cadre"></div>
</body></html>`;
}

async function banniere() {
  const logo64 = readFileSync(join(racine, "public", "logo.png")).toString("base64");
  const anton64 = readFileSync(join(racine, "scripts", "polices", "anton-latin.woff2")).toString("base64");
  const navigateur = await chromium.launch({
    args: ["--no-proxy-server"],
    ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  });
  const ctx = await navigateur.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const onglet = await ctx.newPage();
  await onglet.setContent(pageBanniere(logo64, anton64), { waitUntil: "load" });
  // Sans cette attente, la capture part parfois sur la police de repli et le
  // lettrage n'est plus celui du logo. Le défaut est sournois : l'image paraît
  // « un peu différente », pas cassée.
  await onglet.evaluate(() => document.fonts.ready);

  // LE TITRE EST MESURÉ. Compter les caractères ne marche pas — la largeur dépend
  // du dessin des lettres — et l'inclinaison de 7° élargit le tracé d'environ
  // tan(7°) × hauteur de ligne, ce que scrollWidth ne voit pas.
  const mesure = await onglet.evaluate(() => {
    const titre = document.querySelector(".titre");
    const mots = document.querySelector(".mots");
    const dispo = mots.clientWidth;
    const lignes = [...titre.querySelectorAll("span")];
    // La PLUS LARGE des trois lignes, et non la première : c'est elle qui décide.
    const large = () => Math.max(...lignes.map((l) => l.getBoundingClientRect().width));
    let px = parseFloat(getComputedStyle(titre).fontSize);
    for (let i = 0; i < 120 && px > 40; i++) {
      const marge = Math.tan(7 * Math.PI / 180) * px * 0.9;
      if (large() + marge <= dispo) break;
      px -= 2;
      titre.style.fontSize = px + "px";
    }
    return { px, dispo: Math.round(dispo), large: Math.round(large()) };
  });
  await onglet.waitForTimeout(120);
  const chemin = join(SORTIE, "banniere-1024x500.png");
  await onglet.screenshot({ path: chemin });
  await ctx.close();
  await navigateur.close();
  console.log("  bannière     titre à " + mesure.px + " px · "
    + mesure.large + " px sur " + mesure.dispo + " disponibles");
  // PLAY REFUSE LA TRANSPARENCE sur la bannière. La capture n'en a pas, mais
  // l'aplatir sur l'or coûte une seconde et retire le doute.
  const plat = chemin.replace(".png", "-plat.png");
  await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", chemin,
    "-vf", "format=rgb24", plat]);
  await unlink(chemin);
  await copyFile(plat, chemin);
  await unlink(plat);
}

// ─── CONTRÔLES ──────────────────────────────────────────────────────────────
let bon = true;
const dire = (ok, t) => { if (!ok) bon = false; console.log((ok ? "✅ " : "❌ ") + t); };

async function dimensions(chemin) {
  const { stdout } = await lancer("ffprobe", ["-v", "error", "-select_streams", "v",
    "-show_entries", "stream=width,height,pix_fmt", "-of", "csv=p=0", chemin]);
  const [l, h, pix] = stdout.trim().split(",");
  return { l: Number(l), h: Number(h), pix };
}

async function controler() {
  const fichiers = (await readdir(SORTIE)).filter((f) => f.endsWith(".png")).sort();
  const captures = fichiers.filter((f) => /^\d\d-/.test(f));

  dire(captures.length >= 2 && captures.length <= 8,
    captures.length + " capture(s) — Play en veut entre 2 et 8");

  for (const f of captures) {
    const d = await dimensions(join(SORTIE, f));
    const { size } = await stat(join(SORTIE, f));
    // 9:16 à 0,5 % près. Play refuse tout autre rapport que 16:9 ou 9:16.
    const rapport = d.l / d.h;
    const bonRapport = Math.abs(rapport - 9 / 16) < 0.005 || Math.abs(rapport - 16 / 9) < 0.005;
    const bornes = [d.l, d.h].every((c) => c >= 320 && c <= 3840);
    dire(bonRapport && bornes && size <= 8 * 1024 * 1024,
      f.padEnd(16) + d.l + "×" + d.h + "  " + ko(size)
      + (bonRapport ? "" : "  ← rapport " + rapport.toFixed(3) + ", il faut 9:16 ou 16:9")
      + (bornes ? "" : "  ← chaque côté doit tenir entre 320 et 3840"));
  }

  const ban = join(SORTIE, "banniere-1024x500.png");
  const d = await dimensions(ban).catch(() => null);
  if (!d) dire(false, "bannière absente");
  else {
    const { size } = await stat(ban);
    dire(d.l === 1024 && d.h === 500,
      "bannière        " + d.l + "×" + d.h + "  " + ko(size)
      + (d.l === 1024 && d.h === 500 ? "" : "  ← Play exige 1024×500 EXACTEMENT"));
    dire(!/a$|argb|rgba/i.test(d.pix),
      "bannière sans transparence (" + d.pix + ")"
      + (/a$|argb|rgba/i.test(d.pix) ? "  ← Play la refuse avec un canal alpha" : ""));
  }

  const icone = join(racine, "public", "icon-512.png");
  const di = await dimensions(icone).catch(() => null);
  dire(di && di.l === 512 && di.h === 512,
    "icône           " + (di ? di.l + "×" + di.h : "absente") + "  (public/icon-512.png)");
}

await mkdir(SORTIE, { recursive: true });
if (!VERIFIE) {
  if (!BANNIERE_SEULE) {
    console.log("── captures, prises dans le vrai jeu");
    await capturer();
  }
  console.log("\n── bannière");
  await banniere();
  console.log();
}
await controler();
console.log("\n" + (bon
  ? "✅ les visuels sont conformes. Dossier : visuels/store/"
  : "❌ à corriger avant de remplir la fiche."));
process.exit(bon ? 0 : 1);
