#!/usr/bin/env node
// FABRIQUE ET CONTRÔLE les captures de la fiche App Store.
//
//     npm run ios:visuels             # rend les captures, puis contrôle
//     npm run ios:visuels -- --verifie # ne rend rien, contrôle seulement
//     npm run ios:visuels -- --ipad    # ne refait que la série iPad
//
// ── POURQUOI UN SCRIPT À PART DE visuels-store.mjs ─────────────────────────
//
// Les contraintes d'Apple ne sont pas celles de Play, et mélanger les deux dans
// un même contrôle donnerait un vert qui ne veut rien dire :
//
//   • Play accepte tout 16:9 ou 9:16 entre 320 et 3840 px. Apple veut des
//     dimensions EXACTES, prises dans une liste fermée.
//   • Play tolère un canal alpha sur les captures (seule la bannière le refuse).
//     Apple REFUSE l'alpha partout.
//   • Play demande téléphone + tablette 7" + tablette 10". Apple demande iPhone,
//     et iPad DÈS QUE l'app se déclare compatible iPad.
//   • Apple n'a pas d'image de présentation façon bannière 1024×500.
//
// ── LA CAPTURE iPad EST EXIGÉE OU NON SELON LE PROJET, ET ON LE LIT ───────
//
// Apple exige au moins une capture iPad DÈS QUE l'app se déclare compatible iPad,
// et ses testeurs vérifient alors le rendu sur iPad — une mise en page qui ne
// remplit pas y est un motif de refus.
//
// Ce script ne suppose donc rien : il LIT `TARGETED_DEVICE_FAMILY` dans
// ios/App/App.xcodeproj et en déduit ce qu'il exige. « 1 » = iPhone seul, « 1,2 »
// = iPhone et iPad. Remettre l'iPad dans le projet sans refaire les captures
// ferait échouer le téléversement chez Apple ; ici, ça fera échouer le contrôle,
// ce qui coûte deux minutes au lieu d'un aller-retour.
//
// ── L'ÉTAT ACTUEL : iPhone SEUL, et c'est une décision ────────────────────
//
// La famille est passée à « 1 » le 14 août 2026, pour le lancement d'octobre.
// Motif : la mise en page à trois colonnes ne remplit pas un iPad en PORTRAIT —
// mesuré, 60 % de fond vide — et ouvrir ce chantier de mise en page à six
// semaines du lancement n'était pas le bon échange. L'iPad reste jouable dans le
// navigateur, comme aujourd'hui.
//
// Pour le rétablir plus tard : remettre « 1,2 », adapter la mise en page large
// aux ratios hauts, puis `npm run ios:visuels -- --ipad`. Le code des captures
// iPad est gardé exprès, il n'est plus appelé par défaut.
//
// ── LES TAILLES, VÉRIFIÉES ET NON RECOPIÉES DE MÉMOIRE ────────────────────
//
// La documentation d'App Store Connect a été relue le 14 août 2026 :
//
//   iPhone 6.9" : 1290 × 2796  ← au moins une taille iPhone est obligatoire
//   iPad 13"    : 2752 × 2064  ← obligatoire si l'app supporte l'iPad
//   1 à 10 captures par famille, aucun canal alpha, .png ou .jpg
//
// Un premier relevé automatique annonçait « 1260 × 2736 » pour le 6.9 pouces.
// Ce format ne correspond à aucun iPhone existant : c'était une erreur de
// résumé, écartée en recroisant la source. D'où ce commentaire — le prochain
// qui lira ce fichier n'a pas à refaire la vérification.
//
// ── COMMENT ON OBTIENT CES PIXELS ─────────────────────────────────────────
//
// 430×932 en CSS est la fenêtre exacte d'un iPhone 15/16 Pro Max ; à l'échelle 3
// ça donne 1290×2796. On juge donc une mise en page réelle, et le format tombe
// juste sans redimensionnement.
//
// 1376×1032 à l'échelle 2 donne 2752×2064, soit l'iPad 13 pouces EN PAYSAGE.
// Au-delà de 900 px de large, l'app bascule sur sa mise en page à trois colonnes :
// c'est bien ce qu'un iPad affichera, et non un téléphone étiré.
//
// ── POURQUOI LE PAYSAGE ET NON LE PORTRAIT ────────────────────────────────
//
// La série a d'abord été rendue en portrait (2064×2752). Les dimensions étaient
// justes, le contrôle tout vert — et l'image inutilisable : le contenu tenait
// dans le haut du cadre et 60 % de la capture était du fond jaune vide. La mise
// en page à trois colonnes est dessinée pour un ratio paysage ; à 0,75 elle ne
// remplit pas.
//
// Ça ne s'est vu qu'en REGARDANT les captures. Un contrôle de dimensions ne dit
// rien de ce qu'il y a dans l'image.
//
// Le paysage est légitime : Info.plist déclare les quatre orientations pour iPad
// (UISupportedInterfaceOrientations~ipad). On montre donc l'app dans
// l'orientation où elle est à son avantage, sans rien inventer.
//
// C'est ce constat qui a fait passer la famille d'appareils à « 1 » : le vide en
// portrait n'était pas un défaut de capture mais un défaut de mise en page, et
// une capture flatteuse aurait masqué ce qu'un joueur aurait vraiment vu.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, stat, unlink, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const SORTIE = join(racine, "visuels", "store-ios");
const VERIFIE = process.argv.includes("--verifie");
// Les cinq écrans iPhone JOUENT deux parties entières : ~10 minutes. --ipad
// permet de refaire la seule série iPad sans repayer ce prix.
const IPAD_SEUL = process.argv.includes("--ipad");

/** iPhone 6.9 pouces — 1290×2796. Les cinq modes, dans l'ordre de la fiche. */
const IPHONE = [
  { n: "iphone-1-plug",     ecran: "partie-plug",   quoi: "The Plug — deux clubs, un joueur" },
  { n: "iphone-2-mercato",  ecran: "mercato-juste", quoi: "The Mercato — la chaîne de transferts" },
  { n: "iphone-3-goatgrid", ecran: "grille-partie", quoi: "GOAT GRID — une grille entamée" },
  { n: "iphone-4-guess",    ecran: "mode-guess",    quoi: "GOAT Guess — le Devin" },
  { n: "iphone-5-reveal",   ecran: "mode-grid",     quoi: "Trouve le joueur — la déduction" },
];

/** iPad 13 pouces EN PAYSAGE — 2752×2064, la mise en page à trois colonnes. */
const IPAD = [
  { n: "ipad-1-accueil",    ecran: "accueil",    quoi: "l'accueil trois colonnes" },
  { n: "ipad-2-classement", ecran: "classement", quoi: "le classement" },
  { n: "ipad-3-grille",     ecran: "grille",     quoi: "GOAT GRID en jeu" },
  { n: "ipad-4-devinette",  ecran: "devinette",  quoi: "la devinette du jour" },
];

const ko = (o) => Math.round(o / 1024) + " ko";
let bon = true;
const dire = (ok, t) => { if (!ok) bon = false; console.log((ok ? "✅ " : "❌ ") + t); };

/**
 * Capture une série à une taille donnée.
 *
 * Le suffixe « -pc » n'est pas décoratif : au-delà de 900 px de large, apercu.mjs
 * écrit `apercu-<ecran>-pc.png`. L'oublier fait copier une image PÉRIMÉE d'une
 * exécution précédente sans que rien ne le signale — c'est déjà arrivé côté Play,
 * où la capture 10 pouces sortait en 860×1864 au lieu de 1920×1080.
 */
async function capturerSerie(liste, largeur, hauteur, echelle) {
  const suffixe = largeur > 900 ? "-pc" : "";
  for (const c of liste) {
    const brut = join(racine, "apercu-" + c.ecran + suffixe + ".png");
    await unlink(brut).catch(() => {});
    await lancer("node", [join(ici, "apercu.mjs"), c.ecran], {
      cwd: racine, timeout: 300000,
      env: { ...process.env, LARGEUR: String(largeur), HAUTEUR: String(hauteur),
             ECHELLE: String(echelle) },
    }).catch(() => {});
    // ON CONTINUE SI UNE CAPTURE MANQUE. Un écran qui ne se photographie pas est
    // une information, pas une raison de perdre les précédentes — la version
    // Play a déjà perdu douze captures déjà rendues sur un copyFile sec.
    try {
      await copyFile(brut, join(SORTIE, c.n + ".png"));
      console.log("  " + c.n.padEnd(18) + c.quoi);
    } catch {
      console.log("  ⚠ " + c.n.padEnd(16) + "introuvable — l'écran « " + c.ecran
        + " » n'a pas de chemin à cette largeur");
    }
    await unlink(brut).catch(() => {});
  }
}

async function dimensions(chemin) {
  const { stdout } = await lancer("ffprobe", ["-v", "error", "-select_streams", "v",
    "-show_entries", "stream=width,height,pix_fmt", "-of", "csv=p=0", chemin]);
  const [l, h, pix] = stdout.trim().split(",");
  return { l: Number(l), h: Number(h), pix };
}

/**
 * L'iPad est-il ciblé par le projet Xcode ?
 *
 * On le LIT au lieu de le supposer : c'est cette valeur qui décide si Apple
 * exigera des captures iPad. Les deux configurations (Debug et Release) doivent
 * dire la même chose — si elles divergent, c'est la Release qui compte, mais on
 * le signale plutôt que de choisir en silence.
 */
async function ipadCible() {
  const pbx = await readFile(join(racine, "ios", "App", "App.xcodeproj", "project.pbxproj"), "utf8");
  const trouvees = [...pbx.matchAll(/TARGETED_DEVICE_FAMILY = "([^"]+)"/g)].map((m) => m[1]);
  if (!trouvees.length) return { cible: null, familles: [] };
  const familles = [...new Set(trouvees)];
  return { cible: familles.some((f) => f.split(",").includes("2")), familles };
}

async function controler() {
  const fichiers = (await readdir(SORTIE).catch(() => [])).filter((f) => f.endsWith(".png")).sort();
  if (!fichiers.length) { dire(false, "aucune capture dans " + SORTIE); return; }

  const { cible: ipad, familles } = await ipadCible();
  if (ipad === null) {
    dire(false, "TARGETED_DEVICE_FAMILY introuvable dans project.pbxproj");
    return;
  }
  dire(familles.length === 1,
    "famille d'appareils déclarée : " + familles.join(" et ") + "  → "
    + (ipad ? "iPhone ET iPad" : "iPhone seul")
    + (familles.length === 1 ? "" : "  ← les configurations divergent, à aligner"));

  // Dimensions EXACTES, contrairement à Play qui accepte une plage. Une capture
  // hors liste est refusée au téléversement, pas à la revue : l'erreur se paie
  // tout de suite, mais elle se paie.
  //
  // `requis` est DÉDUIT du projet : une capture iPad n'est obligatoire que si le
  // projet se déclare compatible iPad. Remettre l'iPad sans refaire les captures
  // échoue donc ici, et non chez Apple.
  const FAMILLES = [
    { nom: "iPhone 6.9\"", motif: /^iphone-/, l: 1290, h: 2796, requis: true },
    { nom: "iPad 13\"",    motif: /^ipad-/,   l: 2752, h: 2064, requis: ipad },
  ];

  for (const f of FAMILLES) {
    const lot = fichiers.filter((x) => f.motif.test(x));
    if (!f.requis && !lot.length) {
      console.log("◦  " + f.nom + " : aucune capture, et aucune n'est exigée"
        + " — le projet ne cible pas l'iPad");
      continue;
    }
    dire(lot.length >= 1 && lot.length <= 10,
      f.nom + " : " + lot.length + " capture(s) — Apple en accepte 1 à 10"
      + (lot.length ? "" : "  ← il en faut AU MOINS UNE"));
    for (const x of lot) {
      const d = await dimensions(join(SORTIE, x));
      const { size } = await stat(join(SORTIE, x));
      const taille = d.l === f.l && d.h === f.h;
      // `rgba`, `argb`, ou tout format finissant par « a » porte un canal alpha.
      const alpha = /a$|argb|rgba/i.test(d.pix);
      dire(taille && !alpha,
        "   " + x.padEnd(22) + d.l + "×" + d.h + "  " + ko(size) + "  " + d.pix
        + (taille ? "" : "  ← Apple exige " + f.l + "×" + f.h + " EXACTEMENT")
        + (alpha ? "  ← canal alpha, Apple la refuse" : ""));
    }
  }

  // L'icône de l'App Store est un fichier À PART, en 1024×1024, sans alpha et
  // sans coins arrondis — Apple les ajoute lui-même. Elle vit dans la coque iOS,
  // pas dans la fiche, et c'est le genre d'oubli qui bloque un téléversement.
  const icone = join(racine, "ios", "App", "App", "Assets.xcassets",
    "AppIcon.appiconset", "AppIcon-512@2x.png");
  const di = await dimensions(icone).catch(() => null);
  if (!di) {
    dire(false, "icône App Store 1024×1024 introuvable — lance `npx capacitor-assets generate --ios`");
  } else {
    const alpha = /a$|argb|rgba/i.test(di.pix);
    dire(di.l === 1024 && di.h === 1024 && !alpha,
      "icône App Store  " + di.l + "×" + di.h + "  " + di.pix
      + (di.l === 1024 && di.h === 1024 ? "" : "  ← il faut 1024×1024")
      + (alpha ? "  ← canal alpha, Apple refuse l'icône" : ""));
  }
}

await mkdir(SORTIE, { recursive: true });
if (!VERIFIE) {
  if (!IPAD_SEUL) {
    console.log("── iPhone 6.9 pouces — 1290×2796");
    await capturerSerie(IPHONE, 430, 932, 3);
  }
  // La série iPad est DORMANTE : elle ne se rend qu'avec --ipad, le projet ne
  // ciblant plus l'iPad. Le code reste là pour le jour où la mise en page large
  // saura remplir un ratio haut — voir l'en-tête.
  if (IPAD_SEUL) {
    console.log("── iPad 13 pouces en PAYSAGE — 2752×2064, la mise en page large");
    await capturerSerie(IPAD, 1376, 1032, 2);
  }
  console.log();
}
await controler();
console.log("\n" + (bon ? "✅ les visuels iOS sont conformes. Dossier : visuels/store-ios/"
                        : "❌ à corriger avant de téléverser."));
process.exit(bon ? 0 : 1);
