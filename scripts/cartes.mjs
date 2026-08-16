// Fabrique les visuels de la collection à partir des illustrations d'origine.
//
//   node scripts/cartes.mjs [dossier-source]
//
// ── POURQUOI DEUX RECADRAGES PAR CARTE ───────────────────────────────────────
//
// La CARTE (600×800) garde la composition : on ne retire que le surplus imposé
// par le passage du 2:3 des sources au 3:4 de la carte, et `biais` dit d'où on
// prend cette coupe — 0 tout en bas, 1 tout en haut. Aucun réglage global ne
// convient : rogner le bas d'un plan en pied fait sortir le ballon, rogner le
// haut du « Sacre » fait sortir le trophée.
//
// La VIGNETTE (48×64) recadre SUR LE VISAGE, et c'est indispensable. Elle
// s'affiche en badge à côté du pseudo ; réduire l'image entière à cette taille
// donnerait une tache. Sur « Le Maestro », plan en pied, la tête occupe 10 % de
// la hauteur : réduite, elle ferait six pixels. Recadrée, elle en fait
// soixante. `visage` donne le centre et la hauteur de la boîte, en fractions de
// l'image source.
//
// ── LES FRACTIONS SONT RELEVÉES À L'ŒIL ──────────────────────────────────────
//
// Il n'y a pas de détection de visage ici : chaque valeur a été lue sur son
// illustration, puis vérifiée sur une planche de vignettes agrandies — c'est le
// seul contrôle qui montre qu'un cadre a manqué le visage, un premier jet en
// avait raté douze. Si un visuel est remplacé, SES fractions sont à refaire ;
// celles des autres ne bougent pas.
//
// ── LES SOURCES NE SONT PAS DANS LE DÉPÔT ────────────────────────────────────
//
// Les vingt-neuf PNG d'origine pèsent 65 Mo. Les committer dans un dépôt public
// serait un poids définitif, que le WebP rend inutile : les sorties, elles, y
// sont, et tiennent en 2,2 Mo. Ce script sert donc à documenter la
// transformation et à la rejouer si les sources reviennent — pas à tourner à
// chaque build.
import sharp from "sharp";
import { readdir, mkdir, rm, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] || "visuels/cartes-source");
const OUT = resolve("public/cards");

// L'ordre est celui de la collection : il ne sert qu'à la lisibilité, le script
// travaille carte par carte.
const CARTES = [
  { id: "recrue",          biais: 0.2, visage: { x: 0.42, y: 0.175, h: 0.30 } },
  { id: "premier-but",     biais: 0.3, visage: { x: 0.50, y: 0.19,  h: 0.45 } },
  { id: "premier-contrat", biais: 0.2, visage: { x: 0.52, y: 0.20,  h: 0.36 } },
  { id: "banc",            biais: 0.2, visage: { x: 0.45, y: 0.16,  h: 0.34 } },
  { id: "entrant",         biais: 0.5, visage: { x: 0.53, y: 0.16,  h: 0.28 } },
  { id: "premier-onze",    biais: 0.2, visage: { x: 0.42, y: 0.15,  h: 0.34 } },
  { id: "regulier",        biais: 0.3, visage: { x: 0.50, y: 0.18,  h: 0.42 } },
  { id: "revelation",      biais: 1.0, visage: { x: 0.71, y: 0.11,  h: 0.26 } },
  { id: "titulaire",       biais: 0.2, visage: { x: 0.47, y: 0.155, h: 0.30 } },
  { id: "cadre",           biais: 0.2, visage: { x: 0.42, y: 0.17,  h: 0.32 } },
  { id: "numero-10",       biais: 0.2, visage: { x: 0.55, y: 0.125, h: 0.27 } },
  { id: "brassard",        biais: 0.3, visage: { x: 0.45, y: 0.18,  h: 0.40 } },
  { id: "meneur",          biais: 1.0, visage: { x: 0.50, y: 0.135, h: 0.17 } },
  { id: "patron",          biais: 0.2, visage: { x: 0.50, y: 0.17,  h: 0.32 } },
  { id: "buteur",          biais: 0.6, visage: { x: 0.23, y: 0.185, h: 0.24 } },
  { id: "international",   biais: 0.3, visage: { x: 0.48, y: 0.175, h: 0.42 } },
  { id: "recordman",       biais: 0.3, visage: { x: 0.50, y: 0.22,  h: 0.30 } },
  { id: "maestro",         biais: 1.0, visage: { x: 0.53, y: 0.105, h: 0.18 } },
  { id: "finisseur",       biais: 0.4, visage: { x: 0.20, y: 0.38,  h: 0.22 } },
  { id: "ballon-or",       biais: 0.2, visage: { x: 0.50, y: 0.18,  h: 0.34 } },
  { id: "palmares",        biais: 0.2, visage: { x: 0.36, y: 0.17,  h: 0.34 } },
  { id: "intouchable",     biais: 0.3, visage: { x: 0.48, y: 0.165, h: 0.28 } },
  { id: "phenomene",       biais: 0.4, visage: { x: 0.50, y: 0.26,  h: 0.44 } },
  { id: "sorcier",         biais: 1.0, visage: { x: 0.53, y: 0.235, h: 0.20 } },
  { id: "legende",         biais: 0.2, visage: { x: 0.50, y: 0.135, h: 0.24 } },
  { id: "hall-of-fame",    biais: 1.0, visage: { x: 0.13, y: 0.17,  h: 0.24 } },
  // Le trophée occupe tout le haut du cadre : la coupe se prend en bas, sinon
  // il sort de l'image. C'est la seule carte à biais nul.
  { id: "sacre",           biais: 0.0, visage: { x: 0.48, y: 0.50,  h: 0.22 } },
  { id: "immortel",        biais: 1.0, visage: { x: 0.50, y: 0.145, h: 0.20 } },
  { id: "goat",            biais: 0.3, visage: { x: 0.50, y: 0.30,  h: 0.62 } },
];

const L = 600, H = 800;   // carte
const LV = 48, HV = 64;   // vignette
const borne = (v, min, max) => Math.max(min, Math.min(max, v));

try {
  await access(SRC);
} catch {
  console.error("Sources introuvables : " + SRC);
  console.error("Les PNG d'origine ne sont pas versionnés — voir l'en-tête de ce fichier.");
  process.exit(1);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const c of CARTES) {
  const chemin = join(SRC, c.id + ".png");
  const { width: W0, height: H0 } = await sharp(chemin).metadata();

  // ── la carte : on ne retire que le surplus imposé par le 3:4 ──
  let cw = W0, ch = Math.round((W0 * H) / L);
  if (ch > H0) { ch = H0; cw = Math.round((H0 * L) / H); }
  await sharp(chemin)
    .extract({
      left: Math.round((W0 - cw) / 2),
      top: borne(Math.round((H0 - ch) * c.biais), 0, H0 - ch),
      width: cw, height: ch,
    })
    .resize(L, H).webp({ quality: 82 }).toFile(join(OUT, c.id + ".webp"));

  // ── la vignette : on recadre sur le visage ──
  let vh = Math.round(c.visage.h * H0);
  let vw = Math.round((vh * LV) / HV);
  if (vw > W0) { vw = W0; vh = Math.round((vw * HV) / LV); }
  await sharp(chemin)
    .extract({
      left: borne(Math.round(c.visage.x * W0 - vw / 2), 0, W0 - vw),
      top: borne(Math.round(c.visage.y * H0 - vh / 2), 0, H0 - vh),
      width: vw, height: vh,
    })
    .resize(LV, HV).webp({ quality: 88 }).toFile(join(OUT, c.id + "-64.webp"));
}

const fichiers = await readdir(OUT);
if (fichiers.length !== CARTES.length * 2) {
  throw new Error(`${fichiers.length} fichiers écrits, ${CARTES.length * 2} attendus`);
}
console.log(`${CARTES.length} cartes + ${CARTES.length} vignettes → public/cards/`);
