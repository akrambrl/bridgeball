#!/usr/bin/env node
// CONVERTIT les images de contenu en WebP, et mesure ce que ça coûte en qualité.
//
//     node scripts/images-webp.mjs            # convertit ce qui doit l'être
//     node scripts/images-webp.mjs --verifie  # ne touche à rien, rapporte
//
// POURQUOI. Mesuré sur dist/, c'est-à-dire sur ce que Capacitor empaquette dans
// l'app : 24 Mo au total, dont 15,55 Mo de PNG — 65 % du poids pour des
// illustrations à aplats qui n'ont aucune raison d'être en PNG. Le projet utilise
// déjà le WebP partout ailleurs (69 fichiers) ; ces PNG-là sont un reste.
//
// L'enjeu n'est pas l'octet : c'est la CONVERSION À L'INSTALL. Sous la limite de
// téléchargement en données mobiles, quelqu'un qui clique sur un lien TikTok dans
// le métro installe sans attendre le Wi-Fi. Diviser le poids par deux se paie là.
//
// ── CE QUI NE DOIT PAS ÊTRE CONVERTI ───────────────────────────────────────
//
// Les ICÔNES D'APP (apple-touch-icon, icon-192, icon-512, icon-maskable, favicon)
// restent en PNG : Apple l'exige pour l'icône, et le manifeste PWA est lu par des
// agents qui ne gèrent pas tous le WebP.
//
// og-image.png reste en PNG : beaucoup de robots d'aperçu social ne lisent pas le
// WebP, et une vignette de partage cassée coûte plus cher que 400 ko.
//
// logo.png reste AUSSI, en plus de sa version WebP : il est cité dans le JSON-LD
// de index.html, que lisent les moteurs de recherche. L'app, elle, charge le WebP.
//
// ── LA QUALITÉ EST MESURÉE, PAS CHOISIE À L'ŒIL ────────────────────────────
//
// SSIM du fichier converti contre l'original, à quatre niveaux :
//
//            duel-card                win1
//   q=78     305 ko  SSIM 0,9704      80 ko  SSIM 0,9710
//   q=86     405 ko  SSIM 0,9814     107 ko  SSIM 0,9760
//   q=90     485 ko  SSIM 0,9867     132 ko  SSIM 0,9781
//
// q=86 est le genou : au-delà, on paie 20 % de poids pour 0,005 de SSIM. Le
// SANS-PERTE a été essayé et écarté — sur ces aplats il sort à 570 ko, soit plus
// lourd que le PNG d'origine.

import { readdir, stat, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const lancer = promisify(execFile);
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const PUBLIC = join(racine, "public");
const VERIFIE = process.argv.includes("--verifie");

const QUALITE = Number(process.env.QUALITE || 86);

/** Ce qui doit rester en PNG, et pourquoi — la liste est la documentation. */
const GARDER_PNG = new Set([
  "apple-touch-icon.png",   // icône iOS : Apple exige du PNG
  "favicon.png",
  "icon-192.png",           // manifeste PWA + badge des notifications
  "icon-512.png",
  "icon-maskable-512.png",
  "og-image.png",           // aperçus sociaux : le WebP y est mal supporté
  "logo.png",               // cité dans le JSON-LD de index.html
]);

const ko = (o) => Math.round(o / 1024) + " ko";

// Le résumé SSIM de ffmpeg sort au niveau INFO, sur stderr. Une première version
// lançait la mesure avec -loglevel error : la ligne était donc supprimée, la
// regex ne trouvait rien, et le script affichait « SSIM le plus bas : 1.0000 »
// — la valeur initiale du compteur. Un contrôle qui rassure sans avoir mesuré est
// pire que pas de contrôle, d'où le niveau info ici et le refus plus bas.
async function ssim(webp, png) {
  const { stderr } = await lancer("ffmpeg", ["-hide_banner", "-loglevel", "info",
    "-i", webp, "-i", png, "-lavfi", "ssim", "-f", "null", "-"]);
  const m = String(stderr).match(/All:\s*([0-9.]+)/);
  if (!m) throw new Error("SSIM illisible pour " + png);
  return Number(m[1]);
}

/** En dessous, on ne supprime pas l'original : la perte serait visible. */
const SSIM_PLANCHER = Number(process.env.SSIM_MIN || 0.95);

const fichiers = (await readdir(PUBLIC)).filter((f) => f.endsWith(".png")).sort();
const aConvertir = fichiers.filter((f) => !GARDER_PNG.has(f) || f === "logo.png");

console.log("qualité " + QUALITE + " · " + aConvertir.length + " fichier(s)\n");
let avant = 0, apres = 0, pire = 1;
for (const nom of aConvertir) {
  const png = join(PUBLIC, nom);
  const webp = png.replace(/\.png$/, ".webp");
  const a = (await stat(png)).size;
  if (VERIFIE) { console.log("  " + nom.padEnd(24) + ko(a)); avant += a; continue; }
  await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", png,
    "-c:v", "libwebp", "-quality", String(QUALITE), "-compression_level", "6", webp]);
  const b = (await stat(webp)).size;
  const q = await ssim(webp, png);
  if (q < pire) pire = q;
  avant += a; apres += b;
  console.log("  " + nom.padEnd(24) + ko(a).padStart(9) + " → " + ko(b).padStart(8)
    + "   −" + String(Math.round((a - b) / a * 100)).padStart(2) + " %"
    + "   SSIM " + q.toFixed(4) + (q < SSIM_PLANCHER ? "  ⚠ ORIGINAL CONSERVÉ" : ""));
  // L'original n'est supprimé QUE si la conversion a été mesurée et jugée bonne.
  // logo.png reste de toute façon : le JSON-LD le cite.
  if (!GARDER_PNG.has(nom) && q >= SSIM_PLANCHER) await unlink(png);
}

if (VERIFIE) { console.log("\n--verifie : rien n'a été touché. " + ko(avant) + " en jeu."); process.exit(0); }
console.log("\n  " + ko(avant) + " → " + ko(apres)
  + "   soit " + ko(avant - apres) + " économisés (−" + Math.round((avant - apres) / avant * 100) + " %)");
console.log("  SSIM le plus bas : " + pire.toFixed(4)
  + (pire >= SSIM_PLANCHER ? "   (plancher " + SSIM_PLANCHER + ")" : "   ⚠ SOUS LE PLANCHER"));
console.log("\n  Conservés en PNG : " + [...GARDER_PNG].join(", "));
