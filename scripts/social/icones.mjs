// Fabrique le jeu d'icônes de l'app à partir d'un visuel maître carré.
//
//     node scripts/social/icones.mjs <visuel-carre.png> [affiche-portrait.png]
//
// Le premier argument donne les icônes, le second (facultatif) l'écran de
// démarrage. L'affiche est convertie en WebP : le PNG d'origine pèse 2,6 Mo,
// soit ce que chaque visiteur téléchargerait avant même de voir l'app.
//
// Pas de dépendance d'image : le redimensionnement passe par un canvas dans
// Chromium, déjà présent pour les captures. C'est aussi ce qui garantit le même
// rééchantillonnage que celui qu'on voit à l'écran.
//
// TROIS RÈGLES qui expliquent les recadrages ci-dessous :
//
// 1. Une icône d'app se livre en CARRÉ PLEIN. iOS et Android arrondissent
//    eux-mêmes. Un visuel qui arrive déjà avec ses coins arrondis se retrouve
//    arrondi deux fois, et les coins sombres du fichier apparaissent en croissants
//    noirs autour de l'icône. On rogne donc la bordure du maître.
//
// 2. L'icône « maskable » d'Android peut être rognée jusqu'à un cercle inscrit :
//    tout ce qui compte doit tenir dans les 80 % centraux. Le blason est donc
//    réduit et le pourtour complété à l'or de la charte.
//
// 3. À 32 px, les lignes de vitesse et la trame sérigraphiée deviennent une
//    bouillie grise. Le favicon est donc un recadrage SERRÉ sur le blason, pas
//    une réduction de l'affiche entière.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const maitre = resolve(process.argv[2] || join(racine, "public/logo-maitre.png"));
if (!existsSync(maitre)) { console.error("visuel maître introuvable :", maitre); process.exit(1); }

const OR = "#F5C22B";
// Fractions du maître, mesurées sur le visuel : la bordure sombre fait ~2 %,
// et le blason occupe la zone centrale.
const SANS_BORDURE = { x: .028, y: .028, w: .944, h: .944 };
// Deux serrages : le favicon veut le blason au plus près pour rester lisible à
// 32 px, l'en-tête veut la couronne et les flancs de l'écusson au complet.
const BLASON       = { x: .155, y: .120, w: .690, h: .760 };
const BLASON_LARGE = { x: .075, y: .045, w: .850, h: .900 };

const SORTIES = [
  { nom: "apple-touch-icon.png",   taille: 180, coupe: SANS_BORDURE, echelle: 1 },
  { nom: "icon-192.png",           taille: 192, coupe: SANS_BORDURE, echelle: 1 },
  { nom: "icon-512.png",           taille: 512, coupe: SANS_BORDURE, echelle: 1 },
  { nom: "icon-maskable-512.png",  taille: 512, coupe: SANS_BORDURE, echelle: .80 },
  { nom: "favicon.png",            taille: 64,  coupe: BLASON,       echelle: 1 },
  { nom: "logo.png",               taille: 640, coupe: BLASON_LARGE, echelle: 1, fond: "transparent" },
];

// Le binaire épinglé par le projet n'est pas toujours celui que Playwright
// cherche par défaut dans cet environnement : on laisse PLAYWRIGHT_CHROMIUM
// pointer dessus au besoin.
const navigateur = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await navigateur.newPage();
await page.goto("about:blank");
// Le maître est passé en data URI plutôt qu'en file:// : une page about:blank
// n'a pas le droit de lire le disque, et une image d'une autre origine
// « teinterait » le canvas, ce qui ferait échouer toDataURL au moment d'écrire.
const srcMaitre = "data:image/png;base64," + readFileSync(maitre).toString("base64");

for (const s of SORTIES) {
  const data = await page.evaluate(async ({ src, s, OR }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = s.taille;
    const x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    if (s.fond !== "transparent") { x.fillStyle = OR; x.fillRect(0, 0, s.taille, s.taille); }
    const d = s.taille * s.echelle;
    const o = (s.taille - d) / 2;
    x.drawImage(img,
      img.naturalWidth * s.coupe.x, img.naturalHeight * s.coupe.y,
      img.naturalWidth * s.coupe.w, img.naturalHeight * s.coupe.h,
      o, o, d, d);
    return c.toDataURL("image/png");
  }, { src: srcMaitre, s, OR });
  const fichier = join(racine, "public", s.nom);
  writeFileSync(fichier, Buffer.from(data.split(",")[1], "base64"));
  console.log(String(s.taille).padStart(4) + "px  " + s.nom);
}
// L'affiche de démarrage 1080×1920 était produite ici, depuis un second argument
// facultatif. Elle alimentait l'écran de lancement INTERNE de l'app, retiré
// depuis : il s'ajoutait au splash natif d'iOS pour faire ~3 s d'attente à
// chaque ouverture. Le splash natif, lui, ne vient pas d'ici mais de
// assets/splash.png, via `npx capacitor-assets generate`.

await navigateur.close();
