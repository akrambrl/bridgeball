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

// Même échappatoire que pour icones.mjs : le binaire épinglé n'est pas toujours
// celui que Playwright cherche par défaut selon la machine.
const navigateur = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await navigateur.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1 });
await page.goto("file://" + join(ici, "visuels.html"));
await page.waitForLoadState("networkidle");
// Sans cette attente, Anton n'est pas encore chargé et les titres sortent
// dans la police de repli : le lettrage penché de la charte disparaît.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

// Garde-fou : une police absente ne casse rien, elle se remplace en silence
// par un repli — et le défaut ne se voit que sur le PNG fini. C'est
// exactement ce qui est arrivé ici (Anton repliait sur Impact, Bebas Neue sur
// le sans-serif générique) parce que l'@import Google ne pouvait pas aboutir.
// On refuse maintenant de rendre plutôt que de sortir neuf visuels faux.
const manquantes = await page.evaluate(() =>
  ["Anton", "Bebas Neue"].filter((f) => !document.fonts.check(`40px "${f}"`)));
if (manquantes.length) {
  await navigateur.close();
  throw new Error("polices non chargées : " + manquantes.join(", ") +
    " — relancer `node scripts/social/polices.mjs`");
}

// ── Déclinaison 9:16 ────────────────────────────────────────────────────
// Instagram pousse le vertical partout (reels, stories, et le feed qui
// accepte le 4:5 mais affiche le 9:16 en pleine hauteur). On sort donc les
// mêmes posts en 1080×1920.
//
// Le bloc n'est pas redupliqué dans le HTML : on le clone au rendu et on lui
// change sa classe de format. Six copies à maintenir en double, c'est six
// occasions de corriger un texte d'un côté et pas de l'autre.
//
// Les tailles de police posées en style inline (v2, v7, v8...) sont laissées
// telles quelles : la largeur ne change pas entre le carré et le 9:16, donc
// ce qui tenait sur une ligne y tient encore. Seule la hauteur grandit.
//
// v5 et v6 sont déjà en 9:16, v9 est une bannière de profil (1500×500) : ni
// l'un ni l'autre n'a de déclinaison à produire.
const VERTICAUX = {
  v1: "10-9x16-marque",  v2: "11-9x16-devinette", v3: "12-9x16-modes",
  v4: "13-9x16-grades",  v7: "14-9x16-grid",      v8: "15-9x16-duel",
};
await page.evaluate((ids) => {
  for (const id of ids) {
    const src = document.getElementById(id);
    if (!src) continue;
    const copie = src.cloneNode(true);
    copie.id = id + "-916";
    copie.classList.remove("carre", "portrait", "banniere");
    copie.classList.add("vertical");
    // Plusieurs titres portent leur taille en style inline, posée pour tenir
    // dans le carré. Un style inline bat la feuille : sans ce rattrapage ils
    // resteraient à la taille du carré au milieu d'une affiche deux fois plus
    // haute. On les grandit du même facteur, la largeur utile ne changeant pas.
    const titre = copie.querySelector(".titre");
    if (titre && titre.style.fontSize) {
      titre.style.fontSize = Math.round(parseFloat(titre.style.fontSize) * 1.3) + "px";
    }
    document.body.appendChild(copie);
  }
}, Object.keys(VERTICAUX));
await page.waitForTimeout(300);

const TOUT = { ...NOMS };
for (const [id, nom] of Object.entries(VERTICAUX)) TOUT[id + "-916"] = nom;

for (const [id, nom] of Object.entries(TOUT)) {
  const el = await page.$("#" + id);
  if (!el) { console.warn("bloc introuvable :", id); continue; }
  const b = await el.boundingBox();
  await el.screenshot({ path: join(sortie, nom + ".png") });
  console.log(nom.padEnd(24), Math.round(b.width) + "×" + Math.round(b.height));
}
await navigateur.close();
