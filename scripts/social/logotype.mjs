// Prépare le logotype lettré de l'en-tête depuis le fichier fourni.
//
//     node scripts/social/logotype.mjs
//
//   entrée  : scripts/social/logo-mot-maitre.png   (l'export tel qu'il arrive)
//   sortie  : public/logo-mot.webp                 (détouré, recadré, 640 px)
//
// WebP et non PNG : le halo est un dégradé doux, que PNG encode très mal —
// 296 Ko contre une trentaine en WebP, pour une image chargée à chaque
// ouverture de l'accueil. WebP porte la transparence aussi bien.
//
// Le recadrage n'est pas cosmétique. L'en-tête borne le logotype en hauteur ET
// en largeur, sinon un fichier plus haut que large creuse une bande d'or vide
// sous le lettrage. Un export avec de grandes marges transparentes se retrouve
// donc réduit par la contrainte de hauteur alors que ses marges, elles, ne
// portent rien : on les retire ici, et le lettrage reprend toute la place.
//
// Le fichier DOIT être détouré. Ce script refuse un fond opaque plutôt que de
// publier un rectangle sombre qui se découperait sur l'or de la bande — c'est
// exactement le défaut qui avait forcé l'écusson carré à l'origine.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const source = join(ici, "logo-mot-maitre.png");
const cible = join(ici, "..", "..", "public", "logo-mot.webp");

if (!existsSync(source)) {
  console.error("Fichier absent : " + source);
  console.error("Y déposer l'export du logotype (PNG à fond transparent).");
  process.exit(1);
}

// En data URI : charger un file:// depuis about:blank fait échouer le décodage,
// et surtout ça teinte le canvas, ce qui interdirait ensuite getImageData.
const uri = "data:image/png;base64," + readFileSync(source).toString("base64");

const navigateur = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await navigateur.newPage();

const resultat = await page.evaluate(async (uri) => {
  const img = new Image();
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = uri; });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;

  // Un pixel compte dès qu'il n'est pas quasi transparent : le seuil bas garde
  // le halo et l'ombre portée, qui font partie du dessin.
  //
  // Sur le logotype actuel ce recadrage ne gagne presque rien (1536×1024 →
  // 1473×891) : son halo est quasi opaque jusqu'aux bords, il n'y a pas de
  // marge à retirer. Monter le seuil n'y change rien — essayé jusqu'à 210, on
  // gagne deux pixels. L'étape reste utile pour un export qui, lui, aurait de
  // vraies marges transparentes ; la taille du lettrage se règle donc dans
  // l'en-tête, pas ici.
  const SEUIL = 12;
  let hg = c.width, hd = -1, hh = c.height, hb = -1;
  for (let y = 0; y < c.height; y++) {
    for (let px = 0; px < c.width; px++) {
      if (d[(y * c.width + px) * 4 + 3] > SEUIL) {
        if (px < hg) hg = px;
        if (px > hd) hd = px;
        if (y < hh) hh = y;
        if (y > hb) hb = y;
      }
    }
  }
  if (hd < 0) return { vide: true };

  // Les quatre coins opaques = le fichier n'est pas détouré.
  const coin = (px, y) => d[(y * c.width + px) * 4 + 3];
  const opaque = coin(0, 0) > 250 && coin(c.width - 1, 0) > 250 &&
                 coin(0, c.height - 1) > 250 && coin(c.width - 1, c.height - 1) > 250;

  const l = hd - hg + 1, h = hb - hh + 1;

  // Redimensionné à 640 px de large. L'en-tête l'affiche à 112 px de haut au
  // maximum, soit environ 185 px de large : 640 couvre encore un écran à 3x.
  // Sorti à sa taille d'origine, ce fichier pèse 1,4 Mo — pour une image
  // chargée à chaque ouverture de l'accueil, c'est indéfendable.
  const LARGEUR = Math.min(640, l);
  const hauteur = Math.round(h * (LARGEUR / l));
  const sortie = document.createElement("canvas");
  sortie.width = LARGEUR; sortie.height = hauteur;
  const sx = sortie.getContext("2d");
  sx.imageSmoothingQuality = "high";
  sx.drawImage(c, hg, hh, l, h, 0, 0, LARGEUR, hauteur);
  return { opaque, source: [c.width, c.height], recadre: [l, h],
           sortie: [LARGEUR, hauteur],
           webp: sortie.toDataURL("image/webp", 0.88).split(",")[1] };
}, uri);

await navigateur.close();

if (resultat.vide) { console.error("Image entièrement transparente."); process.exit(1); }
if (resultat.opaque) {
  console.error("Le fichier a un fond opaque — les quatre coins sont pleins.");
  console.error("Posé sur la bande d'or de l'en-tête, son rectangle se découpera.");
  console.error("Réexporter en PNG à fond transparent, puis relancer.");
  process.exit(1);
}

writeFileSync(cible, Buffer.from(resultat.webp, "base64"));
console.log("source  ", resultat.source.join("×"));
console.log("recadré ", resultat.recadre.join("×"));
console.log("sortie  ", resultat.sortie.join("×"), "→ public/logo-mot.webp");
