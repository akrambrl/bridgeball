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

// Vingt-quatre joueurs et non six : avec une liste courte, le classement ne
// deborde pas assez pour que le defilement montre quoi que ce soit.
const NOMS_ESSAI = ["jules","nadia","james10","vice","sjdrums","strudel","kader","lila",
  "toto","mehdi","anna","bruno","chloe","dario","elias","fatou","gabin","hugo",
  "ines","jonas","kenza","lucas","maya","nino"];
const PAYS_ESSAI = ["FR","BE","NL","IT","ES","PT"];
const JOUEURS = NOMS_ESSAI.map((nom, i) => ({
  pid: "p" + (i + 1), nom,
  score: 41220 - i * 1600,
  xp: Math.max(500, 120000 - i * 5200),
  pays: PAYS_ESSAI[i % PAYS_ESSAI.length],
}));

// --no-proxy-server : cette machine impose un proxy sortant qui coupe
// localhost (ERR_CONNECTION_RESET). Rien n'est perdu, Supabase étant bouché
// par ctx.route avant même d'atteindre le réseau.
const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
// LARGEUR permet de basculer sur le chemin desktop, qui n'a pas le même modèle
// de défilement : là, c'est le document qui défile, pas un conteneur interne.
const LARGEUR = Number(process.env.LARGEUR || 430);
const ctx = await navigateur.newContext({
  viewport:{ width:LARGEUR, height:932 }, deviceScaleFactor:LARGEUR > 900 ? 1 : 2 });

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
// `bienvenue` veut le tout premier lancement ; `tutoriel` veut l'etape
// SUIVANTE, donc la banniere marquee comme vue mais pas le tutoriel. Passer
// par un clic sur « J'ai compris » ne marche pas : une modale plein ecran a
// zIndex 400, rendue directement sous #root, recouvre la banniere — laquelle
// vit dans le shell, dont `isolation:isolate` enferme son zIndex 9999.
const PREMIER_LANCEMENT = ecran === "bienvenue" ? "tout"
                        : ecran === "tutoriel"  ? "apres-banniere" : "non";
await page.addInitScript((premier) => {
  // L'accueil est derrière l'accueil-tutoriel : sans ces clés, on photographie
  // le carrousel d'introduction quel que soit l'écran demandé. On ne les pose
  // donc PAS quand c'est justement lui qu'on vient voir.
  if (premier !== "tout") localStorage.setItem("bb_welcome_seen", "1");
  if (premier === "non")   localStorage.setItem("bb_tutorial_done", "1");
  localStorage.setItem("bb_name", "jules");
  localStorage.setItem("bb_lang", "fr");
}, PREMIER_LANCEMENT);
await page.goto("http://localhost:4173/");
await page.waitForLoadState("networkidle");
// L'écran de démarrage dure 2,5 s et REMPLACE l'app pendant ce temps : tant
// qu'il est là, rien n'est cliquable et les modales du premier lancement ne
// sont même pas montées. Un clic tombé dans cette fenêtre ne fait rien, sans
// erreur — c'est ce qui rendait le tutoriel impossible à atteindre.
await page.waitForTimeout(3400);

// Le tutoriel vient APRÈS la bannière de bienvenue : il faut la passer.
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
  "classement-bas": [/classement/i],   // puis défilé jusqu'en bas
  bienvenue:  [],   // premier lancement : la bannière RGPD
  tutoriel:   [],   // premier lancement : le carrousel, après la bannière
  partie:     [],   // idem, puis « Jouer solo »
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
if (ecran === "jeu" || ecran === "partie") {
  // La carte du carrousel lance le mode affiché. On clique aux coordonnées
  // plutôt que sur l'<img> : le gestionnaire est porté par un calque au-dessus
  // d'elle, qui intercepte le clic et fait échouer un click() ciblé.
  const carte = await page.locator("img[src*='-card']").first().boundingBox();
  if (!carte) { console.error("carte du carrousel introuvable"); process.exit(1); }
  await page.mouse.click(carte.x + carte.width / 2, carte.y + carte.height / 2);
  await page.waitForTimeout(2800);
}
if (ecran === "partie") {
  const solo = page.getByRole("button", { name:/jouer solo/i }).first();
  await solo.click();
  await page.waitForTimeout(3000);
}
if (ecran === "profil") {
  // L'avatar de l'en-tête ouvre le profil ; c'est une image cliquable, pas un
  // bouton, donc getByRole ne la voit pas.
  await page.locator("img[src*='/cards/']").first().click();
  await page.waitForTimeout(1600);
}

// Le bas d'un écran ne se photographie pas tout seul : ces écrans bornent leur
// hauteur et défilent DANS un conteneur interne, pas dans le document. On
// cherche donc le conteneur qui déborde vraiment.
if (ecran.endsWith("-bas")) {
  const ou = await page.evaluate(() => {
    const d = [...document.querySelectorAll("div")].find(
      (e) => e.scrollHeight > e.clientHeight + 200 && getComputedStyle(e).overflowY === "auto");
    if (d) { d.scrollTop = d.scrollHeight; return "conteneur interne"; }
    window.scrollTo(0, document.body.scrollHeight);
    return "document";
  });
  console.log("défilé jusqu'en bas via :", ou);
  await page.waitForTimeout(900);
}

const chemin = join(ici, "..", "apercu-" + ecran + ".png");
await page.screenshot({ path:chemin, fullPage:false });
console.log("écrit", chemin);
await navigateur.close();
serveur.close();
