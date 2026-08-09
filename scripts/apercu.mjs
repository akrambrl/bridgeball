// Photographie un écran de l'app dans un navigateur, Supabase bouché.
//
//     npm run build && node scripts/apercu.mjs classement
//
// Pourquoi ce script existe : le navigateur de cette machine n'a pas d'accès
// réseau, donc tous les écrans qui lisent Supabase restaient invérifiables et
// la charte y était corrigée à l'aveugle. On intercepte /rest/v1/ et on
// répond des lignes fabriquées — ce qui suffit largement, puisqu'on regarde
// des couleurs et une mise en page, pas des données.
//
// Les lignes servies sont FAUSSES et le revendiquent (pseudos en clair) : ce
// fichier ne doit jamais servir à valider un comportement métier.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const dist = join(ici, "..", "dist");
const ecran = process.argv[2] || "classement";

const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".webp":"image/webp", ".png":"image/png", ".svg":"image/svg+xml",
  ".json":"application/json", ".woff2":"font/woff2", ".ico":"image/x-icon" };

// Serveur statique minimal : file:// casserait les modules ES et le service
// worker. Tout chemin inconnu retombe sur index.html, l'app étant une SPA.
const serveur = createServer(async (req, res) => {
  const chemin = decodeURIComponent(req.url.split("?")[0]);
  for (const essai of [join(dist, chemin), join(dist, chemin, "index.html"), join(dist, "index.html")]) {
    try {
      const contenu = await readFile(essai);
      res.writeHead(200, { "Content-Type": TYPES[extname(essai)] || "application/octet-stream" });
      res.end(contenu);
      return;
    } catch { /* essai suivant */ }
  }
  res.writeHead(404); res.end();
});
await new Promise((ok) => serveur.listen(4173, ok));

const JOUEURS = [
  { pid:"p1", nom:"jules",   score:41220, xp:120000, pays:"FR" },
  { pid:"p2", nom:"nadia",   score:33810, xp:64000,  pays:"BE" },
  { pid:"p3", nom:"james10", score:22165, xp:12000,  pays:"NL" },
  { pid:"p4", nom:"vice",    score:13070, xp:9000,   pays:"FR" },
  { pid:"p5", nom:"sjdrums", score:10230, xp:8000,   pays:"BE" },
  { pid:"p6", nom:"strudel", score:7055,  xp:6000,   pays:"FR" },
];

// --no-proxy-server : cette machine impose un proxy sortant qui coupe
// localhost (ERR_CONNECTION_RESET). Rien n'est perdu, Supabase étant bouché
// par ctx.route avant même d'atteindre le réseau.
const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const ctx = await navigateur.newContext({ viewport:{ width:430, height:932 }, deviceScaleFactor:2 });

await ctx.route("**/rest/v1/**", async (route) => {
  const url = route.request().url();
  let corps = [];
  if (url.includes("bb_scores")) {
    corps = JOUEURS.map((j) => ({ player_id:j.pid, player_name:j.nom, score:j.score, mode:"pont" }));
  } else if (url.includes("bb_duels")) {
    corps = JOUEURS.slice(0, 3).flatMap((j, i) => Array.from({ length:3 + i }, (_, k) => ({
      challenger_id:j.pid, opponent_id:JOUEURS[(JOUEURS.indexOf(j) + 1) % 6].pid,
      challenger_score: k % 3 === 0 ? 9 : 5, opponent_score: k % 3 === 0 ? 5 : 9, status:"complete" })));
  } else if (url.includes("bb_pseudos")) {
    corps = JOUEURS.map((j) => ({ player_id:j.pid, pseudo:j.nom, xp:j.xp,
      xp_season:j.score, xp_season_month:new Date().toISOString().slice(0, 7), country:j.pays }));
  }
  await route.fulfill({ status:200, contentType:"application/json",
    headers:{ "access-control-allow-origin":"*" }, body:JSON.stringify(corps) });
});

const page = await ctx.newPage();
await page.addInitScript(() => {
  // L'accueil est derrière l'accueil-tutoriel : sans ces clés, on photographie
  // le carrousel d'introduction quel que soit l'écran demandé.
  localStorage.setItem("bb_welcome_seen", "1");
  localStorage.setItem("bb_tutorial_done", "1");
  localStorage.setItem("bb_name", "jules");
  localStorage.setItem("bb_lang", "fr");
});
await page.goto("http://localhost:4173/");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1200);

// Les invites du jour (devinette, installation) se posent par-dessus l'accueil
// et masqueraient l'écran demandé.
for (const libelle of [/plus tard/i, /^fermer$/i]) {
  const b = page.getByRole("button", { name: libelle }).first();
  if (await b.count() && await b.isVisible().catch(() => false)) {
    await b.click().catch(() => {});
    await page.waitForTimeout(400);
  }
}

// Chaque écran est une suite de clics depuis l'accueil. Un écran atteint par
// un chemin plus tortueux n'a pas sa place ici : mieux vaut l'ajouter le jour
// où on en a besoin que maintenir une recette qui ne sert pas.
const CHEMINS = {
  accueil:    [],
  classement: [/classement/i],
  amis:       [/^👥 Amis$|^Amis$/i],
  devinette:  [/devinette du jour/i],
  profil:     [],   // l'avatar n'est pas un bouton : traité à part
  jeu:        [],   // la carte du carrousel non plus
};
if (!(ecran in CHEMINS)) {
  console.error("écran inconnu :", ecran, "— connus :", Object.keys(CHEMINS).join(", "));
  process.exit(1);
}
for (const libelle of CHEMINS[ecran]) {
  const b = page.getByRole("button", { name:libelle }).first();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.waitForTimeout(1600);
}
if (ecran === "jeu") {
  // La carte du carrousel lance le mode affiché. On clique aux coordonnées
  // plutôt que sur l'<img> : le gestionnaire est porté par un calque au-dessus
  // d'elle, qui intercepte le clic et fait échouer un click() ciblé.
  const carte = await page.locator("img[src*='-card']").first().boundingBox();
  if (!carte) { console.error("carte du carrousel introuvable"); process.exit(1); }
  await page.mouse.click(carte.x + carte.width / 2, carte.y + carte.height / 2);
  await page.waitForTimeout(2800);
}
if (ecran === "profil") {
  // L'avatar de l'en-tête ouvre le profil ; c'est une image cliquable, pas un
  // bouton, donc getByRole ne la voit pas.
  await page.locator("img[src*='/cards/']").first().click();
  await page.waitForTimeout(1600);
}

const chemin = join(ici, "..", "apercu-" + ecran + ".png");
await page.screenshot({ path:chemin, fullPage:false });
console.log("écrit", chemin);
await navigateur.close();
serveur.close();
