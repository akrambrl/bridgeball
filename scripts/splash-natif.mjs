#!/usr/bin/env node
// FABRIQUE L'ÉCRAN DE LANCEMENT NATIF — iOS et Android, à la charte.
//
//     npm run splash
//
// ── POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────
//
// L'écran de lancement livré était le logotype d'AVANT la charte : « GOAT FC »
// blanc et vert acide sur un fond vert sombre (#0F1A0F). Or capacitor.config.ts
// déclare `backgroundColor: "#F5C22B"` et l'app peint un aplat d'or. Le lancement
// enchaînait donc trois états qui se contredisent — or, vert sombre, or — soit
// exactement le clignotement que la correction de cette couleur voulait éviter.
// La couleur avait été reprise, l'image jamais.
//
// ── ON NE PASSE PAS PAR `capacitor-assets generate` ────────────────────────
//
// Il produit des icônes Android fausses pour ce logo — deux défauts mesurés,
// consignés en tête de scripts/coque-native.mjs. Le lancer pour refaire le
// splash écraserait au passage un travail d'icônes qui a coûté cher. Ce script
// n'écrit donc QUE des fichiers de splash, et laisse les icônes tranquilles.
//
// ── LE DÉCOR EST CELUI DE L'APP, PAS UNE IMITATION ─────────────────────────
//
// Les lignes de vitesse, l'aplat d'or central et la trame sérigraphiée sont
// copiés de `areneCharte` (src/lib/charte.jsx), au CSS près. C'est ce qui rend
// le passage du splash au premier écran invisible : ce sont les mêmes pixels.
//
// D'où le rendu par Chromium plutôt que par sharp : un `repeating-conic-gradient`
// n'a pas d'équivalent en composition d'images, et le réécrire à la main
// garantirait une dérive entre les deux à la première retouche de la charte.
//
// ── L'ÉCHELLE DU MOTIF SE RÈGLE PAR LE VIEWPORT, PAS PAR LA TAILLE ────────
//
// La trame est définie en pixels CSS (7 px). Rendre directement une page de
// 2732 px de large donnerait 390 points sur la largeur, contre 56 sur un
// téléphone : une poussière grise au lieu d'une trame. On rend donc une page
// de 683 px agrandie 4 fois, ce qui garde les pixels CSS à une échelle de
// téléphone et laisse le moteur dessiner le motif à la bonne finesse.
//
// ── CE QUI DOIT TENIR DANS LES 46 % DU MILIEU ──────────────────────────────
//
// iOS et Android affichent ce carré en « aspect fill ». Sur un iPhone
// 1179 × 2556, le carré est mis à l'échelle de la HAUTEUR puis rogné sur les
// côtés : il n'en reste que 2556 / 1179, soit 46 % de la largeur. Tout ce qui
// dépasse cette bande centrale est coupé, et c'est le piège de ce format —
// une marque cadrée large disparaît par les bords sans qu'on l'ait vue en
// regardant le carré.
//
// Le lettrage est donc posé à 29 % de la largeur, ce qui laisse de la marge, et
// à 42 % de la hauteur — le point de convergence des lignes de vitesse, celui
// que l'aplat d'or central dégage déjà dans l'app.
//
// ── PAS DE VARIANTE SOMBRE, ET C'EST UN CHOIX ──────────────────────────────
//
// Les fichiers `-dark` (iOS) et `-night` (Android) reçoivent la MÊME image. Le
// jeu n'a pas de thème sombre : servir un splash sombre à qui a réglé son
// téléphone en sombre lui donnerait un fondu noir avant un écran d'or, c'est-à-
// dire le défaut qu'on est en train de corriger, réintroduit par une autre
// porte.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COTE = 2732;          // le carré que réclament les deux plateformes
const CSS = 683;            // pixels CSS de la page…
const ECHELLE = COTE / CSS; // …agrandis d'autant (4) pour arriver à 2732

const OR = "#F5C22B";
const ENCRE = "#081109";

const lettrage = join(racine, "public/logo-mot.webp");
if (!existsSync(lettrage)) { console.error("lettrage introuvable :", lettrage); process.exit(1); }
const srcLettrage = "data:image/webp;base64," + readFileSync(lettrage).toString("base64");

// Le décor, au CSS de `areneCharte`. Seule différence : `position:absolute` dans
// un conteneur de la taille de la page, là où l'app utilise `position:fixed`
// pour couvrir le viewport d'un écran qui défile.
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${CSS}px;height:${CSS}px;overflow:hidden;background:${OR}}
  .arene{position:absolute;inset:0;overflow:hidden}
  .lignes{position:absolute;inset:-25%;
    background:repeating-conic-gradient(from 0deg at 50% 42%, rgba(8,17,9,.42) 0deg .55deg, rgba(8,17,9,0) .55deg 2.7deg)}
  .coeur{position:absolute;inset:0;
    background:radial-gradient(circle at 50% 42%, ${OR} 0 20%, rgba(245,194,43,.92) 32%, rgba(245,194,43,0) 62%)}
  .trame{position:absolute;inset:0;opacity:.5;
    background-image:radial-gradient(circle,#D9A21A 1.4px,transparent 1.7px);background-size:7px 7px}
  /* 42 % de la hauteur : le centre du lettrage tombe sur le point de fuite des
     lignes, pas au milieu géométrique du carré. */
  .mot{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);
    width:${Math.round(CSS * 0.29)}px;display:block}
</style></head><body>
  <div class="arene"><div class="lignes"></div><div class="coeur"></div><div class="trame"></div></div>
  <img class="mot" src="${srcLettrage}" alt="">
</body></html>`;

const navigateur = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await navigateur.newPage({
  viewport: { width: CSS, height: CSS }, deviceScaleFactor: ECHELLE });
await page.setContent(PAGE);
// Le lettrage est en data URI, donc déjà en mémoire — mais `setContent` rend la
// main avant son décodage. Sans cette attente, la capture partirait sur un carré
// d'or nu, et ça ne se verrait qu'en ouvrant le fichier.
await page.waitForFunction(() => {
  const i = document.querySelector("img.mot");
  return i && i.complete && i.naturalWidth > 0;
});
const capture = await page.screenshot({ type: "png" });
await navigateur.close();

// ── LE PNG EST PASSÉ EN PALETTE, ET CE N'EST PAS UN DÉTAIL ─────────────────
//
// La capture brute pèse 1,78 Mo. Les six fichiers iOS étant six copies du même
// visuel, ça faisait 10,7 Mo ajoutés à l'IPA — plus de la moitié de son poids
// actuel, pour un écran qu'on voit une demi-seconde.
//
// Le visuel ne contient pourtant qu'une poignée de teintes : l'or, l'or sombre
// de la trame, l'encre des lignes, le crème du lettrage. Ce qui gonflait le
// fichier, c'est le bruit d'anti-aliasing sur 9 000 points de trame et 130
// lignes de vitesse, que la couleur vraie encode pixel par pixel.
//
// 16 couleurs SANS tramage : 326 Ko, et l'image est indiscernable de l'original
// à l'œil, dégradé radial compris — vérifié en comparant les deux rendus au
// cadrage d'un iPhone. Le tramage, lui, est explicitement coupé : il
// réintroduirait exactement le bruit qu'on vient d'enlever.
const maitre = await sharp(capture).png({ palette: true, colours: 16, dither: 0 }).toBuffer();

const info = await sharp(maitre).metadata();
if (info.width !== COTE || info.height !== COTE) {
  console.error(`carré attendu ${COTE}×${COTE}, obtenu ${info.width}×${info.height}`);
  process.exit(1);
}

// ── LES SOURCES ────────────────────────────────────────────────────────────
// Écrites pour qu'un futur `capacitor-assets generate` reparte du bon visuel.
const sources = ["assets/splash.png", "assets/splash-dark.png"];
for (const rel of sources) {
  writeFileSync(join(racine, rel), maitre);
  console.log(rel.padEnd(46), COTE + "×" + COTE);
}

// ── iOS ────────────────────────────────────────────────────────────────────
// Les six fichiers déclarés par Contents.json font tous 2732×2732, y compris
// @2x et @3x : un « launch image » d'asset catalog est servi tel quel et mis à
// l'échelle par le système, l'échelle nominale ne change pas ses dimensions.
const imageset = "ios/App/App/Assets.xcassets/Splash.imageset";
for (const echelle of ["1x", "2x", "3x"]) {
  for (const suffixe of ["", "-dark"]) {
    const rel = `${imageset}/Default@${echelle}~universal~anyany${suffixe}.png`;
    writeFileSync(join(racine, rel), maitre);
    console.log(rel.replace(imageset + "/", "ios  ").padEnd(46), COTE + "×" + COTE);
  }
}

// ── Android ────────────────────────────────────────────────────────────────
// Chaque densité a son fichier, et chaque orientation son cadrage. On ne
// redimensionne donc pas : on ROGNE au centre, ce qui reproduit exactement ce
// que le système ferait d'un carré, mais avec le rééchantillonnage de sharp
// plutôt que celui du téléphone.
const resAndroid = join(racine, "android/app/src/main/res");
let compteur = 0;
if (existsSync(resAndroid)) {
  for (const dossier of readdirSync(resAndroid).filter((d) => d.startsWith("drawable"))) {
    const cible = join(resAndroid, dossier, "splash.png");
    if (!existsSync(cible)) continue;
    // On reprend les dimensions du fichier en place : elles viennent de
    // Capacitor et encodent la densité ET l'orientation du dossier. Les
    // redécouvrir d'après le nom du dossier serait une table à maintenir.
    const { width, height } = await sharp(cible).metadata();
    const png = await sharp(maitre)
      .resize(width, height, { fit: "cover", position: "center" })
      .png({ palette: true, colours: 16, dither: 0 })
      .toBuffer();
    writeFileSync(cible, png);
    compteur++;
  }
  console.log(`and  ${compteur} drawables (port, land, night comprises)`);
} else {
  console.log("and  plateforme absente — rien à écrire");
}

const poids = (rel) => (statSync(join(racine, rel)).size / 1024).toFixed(0) + " Ko";
console.log("maître :", poids("assets/splash.png"));

// ── ET LES ÉCRANS DE LANCEMENT DE LA PWA iOS ───────────────────────────────
//
// Une PWA ajoutée à l'écran d'accueil depuis Safari n'a PAS accès au splash
// natif ci-dessus : celui-là vit dans le paquet de l'app, qu'elle n'est pas.
// Son seul mécanisme est `apple-touch-startup-image`, un <link> par taille
// d'écran — et ce projet n'en déclarait aucun.
//
// Ça ne se voyait pas, parce que l'affiche interne de 2 500 ms tenait le rôle.
// En la retirant, la PWA s'est retrouvée à démarrer sur un aplat d'or nu : le
// jeu s'ouvre bien, mais sans un instant de marque.
//
// ── POURQUOI 8 COULEURS ET PAS 16 ──────────────────────────────────────────
//
// Ces images partent dans le SITE, donc dans dist/, donc — sans précaution —
// dans le paquet des deux apps natives, qui n'en ont aucun usage. À 16 couleurs
// un écran d'iPhone pèse 218 Ko, soit près de 4 Mo pour la série. À 8, il tombe
// à 41 Ko : la trame sérigraphiée disparaît, les lignes de vitesse et le
// lettrage restent, et l'image est plus propre qu'autre chose.
//
// La sécurité ne s'arrête pas là : les deux workflows suppriment ce dossier de
// dist/ AVANT `cap sync`. Voir .github/workflows/ipa-ios.yml.
//
// ── PORTRAIT SEULEMENT, ET C'EST COHÉRENT ──────────────────────────────────
//
// Le manifeste déclare `"orientation": "portrait"`. Fournir des variantes
// paysage serait fournir des écrans de lancement pour une orientation que l'app
// n'adopte jamais. Un appareil lancé en paysage ne trouve aucune image et
// retombe sur `background_color`, qui est déjà l'or de la charte.
//
// Les tailles sont en pixels CSS × densité. Elles ne se devinent pas : une
// erreur d'un pixel sur device-width fait échouer la media query en silence,
// et l'appareil retombe sur l'aplat sans que rien ne le signale.
const APPAREILS = [
  // iPhone
  { l: 375, h: 667, d: 2, nom: "SE 2/3, 8" },
  { l: 414, h: 736, d: 3, nom: "8 Plus" },
  { l: 375, h: 812, d: 3, nom: "X, XS, 11 Pro, 12/13 mini" },
  { l: 414, h: 896, d: 2, nom: "XR, 11" },
  { l: 414, h: 896, d: 3, nom: "XS Max, 11 Pro Max" },
  { l: 390, h: 844, d: 3, nom: "12, 13, 14, 16e" },
  { l: 428, h: 926, d: 3, nom: "12/13 Pro Max, 14 Plus" },
  { l: 393, h: 852, d: 3, nom: "14 Pro, 15, 15 Pro, 16" },
  { l: 402, h: 874, d: 3, nom: "16 Pro" },
  { l: 430, h: 932, d: 3, nom: "14 Pro Max, 15 Plus/Pro Max, 16 Plus" },
  { l: 440, h: 956, d: 3, nom: "16 Pro Max" },
  // iPad
  { l: 768, h: 1024, d: 2, nom: "iPad 9.7\", mini" },
  { l: 810, h: 1080, d: 2, nom: "iPad 10.2\"" },
  { l: 820, h: 1180, d: 2, nom: "iPad Air 10.9\"" },
  { l: 834, h: 1112, d: 2, nom: "iPad Pro 10.5\"" },
  { l: 834, h: 1194, d: 2, nom: "iPad Pro 11\"" },
  { l: 1024, h: 1366, d: 2, nom: "iPad Pro 12.9\"" },
];

const dossierPwa = join(racine, "public/splash-ios");
mkdirSync(dossierPwa, { recursive: true });
let poidsTotal = 0;
const balises = [];
for (const a of APPAREILS) {
  const w = a.l * a.d, h = a.h * a.d;
  const fichier = `splash-${w}x${h}.png`;
  const png = await sharp(maitre)
    .resize(w, h, { fit: "cover", position: "center" })
    .png({ palette: true, colours: 8, dither: 0 })
    .toBuffer();
  writeFileSync(join(dossierPwa, fichier), png);
  poidsTotal += png.length;
  balises.push(
    `<link rel="apple-touch-startup-image" href="/splash-ios/${fichier}"`
    + ` media="(device-width: ${a.l}px) and (device-height: ${a.h}px)`
    + ` and (-webkit-device-pixel-ratio: ${a.d}) and (orientation: portrait)">`);
}
console.log(`pwa  ${APPAREILS.length} écrans de lancement · ${(poidsTotal / 1024).toFixed(0)} Ko au total`);

// Les balises sont IMPRIMÉES et non écrites dans index.html : ce fichier est
// tenu à la main, et un script qui le réécrit finirait par y perdre un
// commentaire. À recoller si la liste ci-dessus change.
console.log("\n── à recoller dans index.html si APPAREILS change ──");
for (let i = 0; i < balises.length; i++) {
  console.log("    " + balises[i] + (APPAREILS[i].nom ? `<!-- ${APPAREILS[i].nom} -->` : ""));
}
