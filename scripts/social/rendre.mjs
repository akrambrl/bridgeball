// Rend chaque bloc de visuels.html en PNG aux dimensions exactes d'Instagram.
//
//     node scripts/social/rendre.mjs
//
// La capture se fait sur l'ÉLÉMENT et non sur la fenêtre : c'est ce qui garantit
// un 1080×1080 exact sans dépendre de la taille du navigateur. Le facteur
// d'échelle reste à 1 pour la même raison — à 2, on sortirait du 2160.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const ici = dirname(fileURLToPath(import.meta.url));
const sortie = join(ici, "sortie");
mkdirSync(sortie, { recursive: true });

const NOMS = {
  v1: "01-carre-marque",    v2: "02-carre-devinette", v3: "03-portrait-modes",
  v4: "04-portrait-grades", v5: "05-story-devinette",  v6: "06-story-carte",
  v7: "07-carre-grid",      v8: "08-carre-duel",       v9: "09-banniere",
};

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1 });
await page.goto("file://" + join(ici, "visuels.html"));
await page.waitForLoadState("networkidle");
// Sans cette attente, Anton n'est pas encore chargé et les titres sortent
// dans la police de repli : le lettrage penché de la charte disparaît.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

for (const [id, nom] of Object.entries(NOMS)) {
  const el = await page.$("#" + id);
  if (!el) { console.warn("bloc introuvable :", id); continue; }
  const b = await el.boundingBox();
  await el.screenshot({ path: join(sortie, nom + ".png") });
  console.log(nom.padEnd(24), Math.round(b.width) + "×" + Math.round(b.height));
}
await navigateur.close();
