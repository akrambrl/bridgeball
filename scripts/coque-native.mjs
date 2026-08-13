#!/usr/bin/env node
// FABRIQUE ET CONTRÔLE la coque native — icônes Android et conditions de dépôt.
//
//     npm run coque            # régénère les icônes, puis contrôle
//     npm run coque:verifie    # ne touche à rien, contrôle seulement
//
// ── POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────
//
// `capacitor-assets generate` produit des icônes Android FAUSSES pour ce logo, et
// ça ne se voit pas en lisant sa sortie — il annonce 100 fichiers générés.
//
// Deux défauts, mesurés :
//
//  1. Il écrit `ic_launcher_background` à #FFFFFF en ignorant
//     --iconBackgroundColor. L'icône adaptative composite le premier plan SUR
//     cette couleur : le logo se serait affiché sur un carré BLANC, sur l'écran
//     d'accueil comme dans la fiche Play.
//
//  2. Il pose l'affiche ENTIÈRE en premier plan, bord à bord. Or Android masque
//     l'icône adaptative et n'en montre qu'un cercle de 72dp sur 108, soit 66 %.
//     Vérifié en appliquant ce masque : le haut de la couronne était coupé, les
//     extrémités du « GOAT » aussi, et « FC » disparaissait presque entièrement.
//     L'icône aurait affiché un logo tronqué.
//
// La cause est dans l'affiche, pas dans l'outil : `public/logo.png` est un dessin
// CARRÉ dont la marque va bord à bord, avec son propre fond (rayon de soleil,
// coins sombres) et aucune transparence. C'est parfait pour une tuile iOS, et
// inutilisable tel quel comme premier plan adaptatif.
//
// ── CE QUE FAIT LA COMPOSITION ─────────────────────────────────────────────
//
// La marque est réduite à l'intérieur de la zone sûre, DÉCOUPÉE EN DISQUE et
// fondue sur ses bords, puis posée sur l'or de la charte. Deux options ont été
// rendues et comparées à l'image :
//
//   A. affiche en fond bord à bord + affiche réduite en premier plan → deux
//      rayons de soleil à deux échelles, et la marque du fond qui fantôme
//      derrière celle du premier plan. Écartée.
//   B. disque fondu sur l'or → marque complète, aucune arête droite, une seule
//      lecture. Retenue.
//
// iOS garde l'affiche ENTIÈRE : son masque n'arrondit que les coins, qui ne
// portent que du décor. Répondre à la contrainte de chaque plateforme n'est pas
// une incohérence — c'est la même marque, cadrée pour deux masques différents.
//
// ── ET LE CONTRÔLE, QUI COMPTE AUTANT ──────────────────────────────────────
//
// À partir du 31 août 2026, Google Play refuse toute NOUVELLE application qui ne
// cible pas l'API 36. Le lancement visé est le 1er octobre : la contrainte
// s'applique. Capacitor 8 cible 36 par défaut — mais « par défaut » n'est pas une
// garantie, et se le redécouvrir la veille du dépôt coûterait le lancement.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, access, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const VERIFIE = process.argv.includes("--verifie");

const OR = "#F5C22B";           // G.or de src/lib/charte.jsx — le fond de page
const SOURCE = join(racine, "assets", "logo.png");
const ANDROID = join(racine, "android", "app", "src", "main", "res");

/** Les cinq densités d'Android, et ce que vaut 1 dp dans chacune. */
const DENSITES = [
  { nom: "mdpi", x: 1 }, { nom: "hdpi", x: 1.5 }, { nom: "xhdpi", x: 2 },
  { nom: "xxhdpi", x: 3 }, { nom: "xxxhdpi", x: 4 },
];

// Proportions exprimées sur la toile, donc valables à toutes les densités.
//
// LA SOMME RAYON + FONDU VAUT EXACTEMENT 1/3, c'est-à-dire le rayon de la zone
// sûre (un cercle de 72dp sur 108). Ce n'est pas un réglage à l'œil : une
// première version s'arrêtait à 0,287 + 0,060 = 0,347, et le contrôle a mesuré
// 4 616 pixels de bande de fondu au-delà du cercle, à 23 % d'opacité. Le masque
// du lanceur les aurait coupés — une arête faible, mais une arête. Toute la
// composition a donc été réduite de 4 % pour que le fondu s'achève sur la limite
// au lieu de la franchir.
const PART_AFFICHE = 0.666;
const PART_RAYON = 0.2757;
const PART_FONDU = 0.0576;

const existe = (p) => access(p).then(() => true, () => false);

/** Le premier plan adaptatif : disque fondu, transparent autour. */
async function premierPlan(taille, sortie) {
  const a = Math.round(taille * PART_AFFICHE);
  const c = a / 2;
  const r = taille * PART_RAYON;
  const f = taille * PART_FONDU;
  await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", SOURCE,
    "-vf", `scale=${a}:${a},format=rgba,`
      + `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':`
      // Alpha = 1 dans le disque, décroissant linéairement sur la bande de
      // fondu, 0 au-delà. C'est ce fondu qui supprime l'arête droite.
      + `a='255*(1-min(1,max(0,(sqrt((X-${c})*(X-${c})+(Y-${c})*(Y-${c}))-${r.toFixed(1)})/${f.toFixed(1)})))',`
      + `pad=${taille}:${taille}:(${taille}-${a})/2:(${taille}-${a})/2:color=0x00000000`,
    "-frames:v", "1", sortie]);
}

/** L'icône héritée (avant Android 8) : la même composition, mais aplatie sur l'or. */
async function iconeHeritee(taille, sortie, ronde) {
  const a = Math.round(taille * PART_AFFICHE);
  const c = a / 2;
  const r = taille * PART_RAYON;
  const f = taille * PART_FONDU;
  const m = taille / 2;
  // `ronde` applique en plus le masque circulaire : Android l'utilise tel quel
  // sur les lanceurs qui demandent une icône ronde, sans rien découper lui-même.
  const rond = ronde
    ? `,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte((X-${m})*(X-${m})+(Y-${m})*(Y-${m}),${m * m}),255,0)'`
    : "";
  await lancer("ffmpeg", ["-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `color=c=0x${OR.slice(1)}:s=${taille}x${taille}`,
    "-i", SOURCE,
    "-filter_complex",
    `[1]scale=${a}:${a},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':`
      + `a='255*(1-min(1,max(0,(sqrt((X-${c})*(X-${c})+(Y-${c})*(Y-${c}))-${r.toFixed(1)})/${f.toFixed(1)})))'[fg];`
      + `[0][fg]overlay=(W-w)/2:(H-h)/2${rond}`,
    "-frames:v", "1", sortie]);
}

async function generer() {
  if (!(await existe(SOURCE))) {
    console.error("source absente : " + SOURCE.replace(racine + "/", "")
      + "\n  Fabrique-la depuis public/logo.png :"
      + "\n  ffmpeg -i public/logo.png -vf scale=1024:1024:flags=neighbor assets/logo.png");
    process.exit(2);
  }
  for (const d of DENSITES) {
    const dossier = join(ANDROID, "mipmap-" + d.nom);
    if (!(await existe(dossier))) continue;
    await premierPlan(Math.round(108 * d.x), join(dossier, "ic_launcher_foreground.png"));
    await iconeHeritee(Math.round(48 * d.x), join(dossier, "ic_launcher.png"), false);
    await iconeHeritee(Math.round(48 * d.x), join(dossier, "ic_launcher_round.png"), true);
    console.log("  mipmap-" + d.nom.padEnd(9) + "premier plan " + Math.round(108 * d.x)
      + " px · icône " + Math.round(48 * d.x) + " px");
  }
  await writeFile(join(ANDROID, "values", "ic_launcher_background.xml"),
// Pas de tiret double dans ce commentaire : XML l'interdit à l'intérieur d'un
// <!-- -->, et aapt2 casse le build sur « The string is not permitted within
// comments ». L'option de capacitor-assets s'écrit donc sans ses deux tirets.
`<?xml version="1.0" encoding="utf-8"?>
<!-- L'OR DE LA CHARTE, et non le blanc. capacitor-assets ignore l'option
     iconBackgroundColor et écrit #FFFFFF : l'icône adaptative composite le
     premier plan SUR cette couleur, donc le logo se serait affiché sur un carré
     blanc, sur l'écran d'accueil comme dans la fiche Play. Écrit par
     scripts/coque-native.mjs — ne pas modifier à la main. -->
<resources>
    <color name="ic_launcher_background">${OR}</color>
</resources>
`);
  console.log("  fond adaptatif → " + OR);
}

// ─── CONTRÔLES ──────────────────────────────────────────────────────────────
let bon = true;
const dire = (ok, t) => { if (!ok) bon = false; console.log((ok ? "✅ " : "❌ ") + t); };

async function controler() {
  // 1. Le niveau d'API, condition de publication à partir du 31 août 2026.
  const vars = await readFile(join(racine, "android", "variables.gradle"), "utf8").catch(() => "");
  const cible = Number((/targetSdkVersion\s*=\s*(\d+)/.exec(vars) || [])[1] || 0);
  const compile = Number((/compileSdkVersion\s*=\s*(\d+)/.exec(vars) || [])[1] || 0);
  dire(cible >= 36 && compile >= 36,
    "API cible " + cible + " / compilation " + compile
    + (cible >= 36 ? "  (Play exige 36 pour toute nouvelle app depuis le 31 août 2026)"
                   : "  ← REFUSÉ PAR PLAY, il faut 36"));

  // 2. La couleur de la coque = celle du manifeste = celle du premier écran peint.
  const manifeste = JSON.parse(await readFile(join(racine, "public", "manifest.json"), "utf8"));
  const conf = await readFile(join(racine, "capacitor.config.ts"), "utf8");
  const couleurs = [...conf.matchAll(/backgroundColor:\s*"(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]);
  const memeCouleur = couleurs.length > 0
    && couleurs.every((c) => c.toUpperCase() === manifeste.background_color.toUpperCase());
  dire(memeCouleur, "couleur de coque : " + [...new Set(couleurs)].join(", ")
    + " · manifeste " + manifeste.background_color
    + (memeCouleur ? "" : "  ← l'app clignoterait d'une couleur à l'autre au lancement"));

  const fond = await readFile(join(ANDROID, "values", "ic_launcher_background.xml"), "utf8").catch(() => "");
  dire(fond.toUpperCase().includes(OR.toUpperCase()),
    "fond de l'icône adaptative : " + ((/>(#[0-9A-Fa-f]{6})</.exec(fond) || [])[1] || "illisible")
    + (fond.toUpperCase().includes(OR.toUpperCase()) ? "" : "  ← le logo s'afficherait sur du blanc"));

  // 3. L'identifiant, qui ne doit JAMAIS changer une fois publié.
  const gradle = await readFile(join(racine, "android", "app", "build.gradle"), "utf8").catch(() => "");
  const appId = (/applicationId\s+"([^"]+)"/.exec(gradle) || [])[1];
  dire(appId === "fr.goatfc.app", "applicationId : " + appId
    + (appId === "fr.goatfc.app" ? "" : "  ← doit rester fr.goatfc.app"));

  // 4. LA MARQUE TIENT-ELLE DANS LA ZONE SÛRE ? Le contrôle qui manquait, et le
  //    seul qui aurait attrapé l'icône tronquée. On mesure l'alpha du premier
  //    plan : tout pixel opaque HORS du cercle de 66,7 % serait rogné par le
  //    masque du lanceur.
  const fg = join(ANDROID, "mipmap-xxxhdpi", "ic_launcher_foreground.png");
  // ffmpeg ne sert qu'ICI, à décoder l'image en pixels bruts. S'il manque, on le
  // DIT au lieu de planter : un contrôle qui casse le build pour un outil absent
  // fait perdre plus qu'il ne protège, et un contrôle silencieusement sauté est
  // pire encore. Le workflow AAB l'installe, donc là il tourne vraiment.
  let ffmpegLa = true;
  try { await lancer("ffmpeg", ["-version"]); } catch { ffmpegLa = false; }
  if (await existe(fg) && !ffmpegLa) {
    console.log("◦  marque dans la zone sûre : NON VÉRIFIÉE — ffmpeg absent de cette"
      + " machine.\n   Le workflow AAB l'installe ; en local : apt install ffmpeg.");
  }
  if (await existe(fg) && ffmpegLa) {
    // ON LIT LES PIXELS, sans acrobatie de filtre. Une première version enchaînait
    // deux `geq` et `signalstats` pour lire l'alpha : la métadonnée ne sortait
    // pas, la mesure valait −1, et le contrôle annonçait tout de même « rien à
    // rogner » à côté de son propre échec. Un contrôle qui se contredit est pire
    // qu'un contrôle absent. ffmpeg ne sert donc plus qu'à décoder en RGBA brut.
    const { stdout } = await lancer("ffmpeg", ["-hide_banner", "-loglevel", "error",
      "-i", fg, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
      { encoding: "buffer", maxBuffer: 1 << 26 });
    const px = Buffer.from(stdout);
    const cote = Math.round(Math.sqrt(px.length / 4));
    const c = cote / 2;
    // La zone sûre d'une icône adaptative : un cercle de 72dp sur 108, soit 2/3
    // du côté — donc un rayon de 1/3. Tout pixel opaque au-delà est rogné par le
    // masque du lanceur, et c'est exactement ce qui coupait la couronne et « FC ».
    const rayon = cote / 3;
    let pire = 0, combien = 0;
    for (let y = 0; y < cote; y++) {
      for (let x = 0; x < cote; x++) {
        const dx = x - c, dy = y - c;
        if (dx * dx + dy * dy <= rayon * rayon) continue;
        const a = px[(y * cote + x) * 4 + 3];
        if (a > 8) { combien++; if (a > pire) pire = a; }
      }
    }
    dire(combien === 0, "marque dans la zone sûre (" + cote + " px) : "
      + (combien === 0 ? "rien hors du cercle"
         : combien + " pixel(s) hors du cercle, opacité jusqu'à " + pire
           + "/255 ← LE MASQUE DU LANCEUR COUPERA LA MARQUE"));
  }

  // 5. Les deux plateformes sont-elles là ?
  for (const p of ["android", "ios"]) {
    dire(await existe(join(racine, p)), "plateforme " + p + " présente");
  }

  // 6. LES COMMENTAIRES XML DES RESSOURCES. Éprouvé au premier vrai build : aapt2
  //    a refusé ic_launcher_background.xml sur « The string "--" is not permitted
  //    within comments » — un tiret double écrit par ce script lui-même, en citant
  //    une option en ligne de commande. XML l'interdit à l'intérieur d'un
  //    <!-- -->, et aucun éditeur ne le signale.
  //
  //    Le contrôle est ici et pas dans les tests parce qu'il garde un dossier que
  //    `cap sync` réécrit : il doit tourner juste avant le build, sur l'état réel
  //    du disque. Il coûte quelques millisecondes et remplace 40 secondes de
  //    Gradle pour découvrir la même chose.
  const fautifs = [];
  const parcourir = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "build") await parcourir(p); continue; }
      if (!e.name.endsWith(".xml")) continue;
      const t = await readFile(p, "utf8");
      const ouverts = (t.match(/<!--/g) || []).length;
      const fermes = (t.match(/-->/g) || []).length;
      if (ouverts !== fermes) { fautifs.push(p + " : commentaire non fermé"); continue; }
      for (const m of t.matchAll(/<!--([\s\S]*?)-->/g)) {
        if (!m[1].includes("--")) continue;
        const ligne = t.slice(0, m.index).split("\n").length;
        fautifs.push(p + ":" + ligne + " : tiret double dans un commentaire");
      }
    }
  };
  const res = join(racine, "android", "app", "src", "main", "res");
  if (await existe(res)) await parcourir(res);
  dire(fautifs.length === 0, "commentaires XML des ressources : "
    + (fautifs.length === 0 ? "aucun tiret double"
       : fautifs.length + " à corriger ← AAPT2 REFUSERA DE COMPILER\n   "
         + fautifs.join("\n   ")));
}

if (!VERIFIE) { console.log("── icônes Android"); await generer(); console.log(); }
await controler();
console.log("\n" + (bon ? "✅ la coque est prête au dépôt." : "❌ à corriger avant de déposer."));
process.exit(bon ? 0 : 1);
