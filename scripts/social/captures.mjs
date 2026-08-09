// Prépare les captures d'écran qui servent d'illustration aux visuels sociaux.
//
//     npm run build && node scripts/social/captures.mjs
//
// Les affiches montrent le VRAI jeu, pas une reconstitution. Une maquette
// redessinée à la main se périme dès que l'écran bouge, et elle ment sur ce
// que l'utilisateur va trouver en installant — c'est précisément le reproche
// qu'on faisait aux affiches montrant des modes qui n'existent pas.
//
// Les captures viennent de scripts/apercu.mjs, qui rend l'app pour de vrai
// avec Supabase bouché. Elles sont converties en WebP : cinq PNG de 430×932
// en 2x pèsent près de 5 Mo, et ce dépôt n'a pas à les porter.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..", "..");
const sortie = join(ici, "captures");
mkdirSync(sortie, { recursive: true });

// Les cinq écrans que l'aperçu sait atteindre et qui donnent envie de jouer.
// Le classement et le profil ne sont pas là : un tableau de scores inconnus
// ne vend rien à quelqu'un qui n'a pas encore joué.
const ECRANS = ["accueil", "partie", "devinette", "jeu"];

for (const ecran of ECRANS) {
  console.log("capture", ecran, "…");
  execFileSync("node", [join(ici, "..", "apercu.mjs"), ecran],
    { cwd: racine, stdio: "inherit", env: process.env });
}

const navigateur = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await navigateur.newPage();

for (const ecran of ECRANS) {
  const source = join(racine, "apercu-" + ecran + ".png");
  if (!existsSync(source)) { console.warn("capture manquante :", source); continue; }
  const uri = "data:image/png;base64," + readFileSync(source).toString("base64");
  const b64 = await page.evaluate(async (uri) => {
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = uri; });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return c.toDataURL("image/webp", 0.9).split(",")[1];
  }, uri);
  const cible = join(sortie, ecran + ".webp");
  writeFileSync(cible, Buffer.from(b64, "base64"));
  console.log("  →", "captures/" + ecran + ".webp",
    Math.round(Buffer.from(b64, "base64").length / 1024) + " Ko");
}
await navigateur.close();
