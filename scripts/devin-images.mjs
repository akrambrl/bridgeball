#!/usr/bin/env node
// PRÉPARE les quatre illustrations du devin pour le web.
//
//     node scripts/devin-images.mjs <fichier1> <fichier2> <fichier3> <fichier4>
//     node scripts/devin-images.mjs            # reprend visuels/devin/*.png
//
// Sortie : public/devin-1.webp … devin-4.webp
//
// POURQUOI CE SCRIPT EXISTE. Les fichiers arrivent tels que le générateur les
// crache : 1024 x 1536 en PNG, entre 2,5 et 3 Mo pièce. Onze mégaoctets pour
// quatre images de mascotte, sur une app qu'on installe sur téléphone et qui doit
// s'ouvrir en 4G, ce n'est pas une option. Et elles sont posées dans un cadre qui
// fait AU PLUS 270 px de large : on servait 1024 px pour en afficher 270.
//
// Deux gestes, donc :
//   • réduire à 832 px de large — 270 x 3 = 810, donc encore net sur un écran à
//     trois fois la densité, le plus dense qui existe aujourd'hui ;
//   • encoder en WebP. Ces images ont un dégradé doré en fond : une palette
//     indexée (le traitement des cartes de mode) y ferait des bandes visibles,
//     là où WebP garde le dégradé lisse pour un dixième du poids.
//
// L'ORDRE N'EST PAS ARBITRAIRE. Les quatre poses racontent une progression, et
// le jeu s'en sert : voir DEVIN_IMAGES dans GoatGuess.tsx.
//   1. mains ouvertes    → il invite (accueil, premières questions)
//   2. capuche tenue     → il se concentre (questions)
//   3. doigt sur la bouche, sourire, oeil doré → il sait (il annonce sa réponse)
//   4. poings et éclairs → il a trouvé (victoire)

import { readdir, stat, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const LARGEUR = 832;
const QUALITE = 74;

let entrees = process.argv.slice(2);
if (!entrees.length) {
  const dossier = join(racine, "visuels", "devin");
  try {
    entrees = (await readdir(dossier)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort().map((f) => join(dossier, f));
  } catch {
    console.error("Aucun fichier donné, et visuels/devin/ est absent.");
    console.error("Usage : node scripts/devin-images.mjs pose1.png pose2.png pose3.png pose4.png");
    process.exit(1);
  }
}
if (entrees.length !== 4) {
  console.error("Il faut EXACTEMENT quatre poses, dans l'ordre du récit "
    + "(mains ouvertes, capuche, doigt sur la bouche, éclairs). Reçu : " + entrees.length);
  process.exit(1);
}

await mkdir(join(racine, "public"), { recursive: true });
let avant = 0, apres = 0;
for (let i = 0; i < entrees.length; i++) {
  const source = entrees[i];
  const sortie = join(racine, "public", "devin-" + (i + 1) + ".webp");
  const poidsAvant = (await stat(source)).size;
  // `lanczos` et non le rééchantillonnage par défaut : sur un trait d'encre net,
  // c'est ce qui garde le contour franc au lieu de le rendre laiteux.
  await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", source,
    "-vf", "scale=" + LARGEUR + ":-2:flags=lanczos",
    "-c:v", "libwebp", "-quality", String(QUALITE), "-compression_level", "6",
    sortie]);
  const poidsApres = (await stat(sortie)).size;
  avant += poidsAvant; apres += poidsApres;
  console.log("  devin-" + (i + 1) + ".webp  "
    + (poidsAvant / 1024 / 1024).toFixed(2) + " Mo → " + (poidsApres / 1024).toFixed(0) + " Ko"
    + "   (" + source.split("/").pop() + ")");
}
console.log("total " + (avant / 1024 / 1024).toFixed(1) + " Mo → " + (apres / 1024).toFixed(0) + " Ko"
  + "  soit " + Math.round(100 - (apres / avant) * 100) + " % de moins");
