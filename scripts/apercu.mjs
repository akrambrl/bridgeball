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

// Le tableau de bord de suivi lit bb_events et bb_presence, et compte les
// tables via l'en-tête content-range sans rapatrier de lignes (sbCount). Sans
// ces deux ajouts, il s'affichait « table bb_events absente » partout et tous
// les totaux restaient à «—» : la moitié des rubriques était invisible.
const MODES_ESSAI = ["pont", "chaine", "grid", "guess", "battle", "reveal", "devinette"];
const ilYaJours = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
const EVENEMENTS = JOUEURS.flatMap((j, i) => {
  const lignes = [
    { player_id:j.pid, created_at:ilYaJours(i % 14), type:"open_" + (i % 3 === 0 ? "ios" : i % 3 === 1 ? "android" : "other") },
    { player_id:j.pid, created_at:ilYaJours(i % 14), type:"dur_" + (120 + i * 47) },
  ];
  // Assez de parties pour que les barres se distinguent : les premiers joueurs
  // en jouent beaucoup, les derniers presque pas.
  for (let k = 0; k < 24 - i; k++) {
    const m = MODES_ESSAI[(i + k) % MODES_ESSAI.length];
    lignes.push({ player_id:j.pid, created_at:ilYaJours(k % 14),
                  type:"play_" + m + (k % 5 === 0 ? "_online" : "") });
  }
  return lignes;
});

await ctx.route("**/rest/v1/**", async (route) => {
  const url = route.request().url();
  let corps = [];
  if (url.includes("bb_scores")) {
    corps = JOUEURS.map((j, i) => ({ player_id:j.pid, player_name:j.nom, score:j.score,
      mode:i % 3 === 0 ? "chaine" : "pont", created_at:ilYaJours(i % 14) }));
  } else if (url.includes("bb_duels")) {
    corps = JOUEURS.slice(0, 3).flatMap((j, i) => Array.from({ length:3 + i }, (_, k) => ({
      id:j.pid + "-" + k, created_at:ilYaJours(k % 14),
      challenger_id:j.pid, opponent_id:JOUEURS[(JOUEURS.indexOf(j) + 1) % 6].pid,
      challenger_score: k % 3 === 0 ? 9 : 5, opponent_score: k % 3 === 0 ? 5 : 9, status:"complete" })));
  } else if (url.includes("bb_events")) {
    corps = EVENEMENTS;
  } else if (url.includes("bb_presence")) {
    corps = JOUEURS.slice(0, 4).map((j) => ({ player_id:j.pid }));
  } else if (url.includes("bb_pseudos")) {
    corps = JOUEURS.map((j, i) => ({ player_id:j.pid, pseudo:j.nom, xp:j.xp,
      xp_season:j.score, xp_season_month:new Date().toISOString().slice(0, 7), country:j.pays,
      created_at:ilYaJours(i % 14) }));
  }
  // content-range sur TOUTE réponse : c'est le seul canal par lequel sbCount
  // apprend un total, et il lui suffit de la partie après le « / ». Il faut
  // AUSSI l'exposer : sur une réponse d'une autre origine, le navigateur ne
  // laisse lire que les en-têtes listés là — sans quoi sbCount lisait null et
  // tout le bloc « depuis le début » restait à zéro.
  await route.fulfill({ status:200, contentType:"application/json",
    headers:{ "access-control-allow-origin":"*",
              "access-control-expose-headers":"content-range",
              "content-range":"0-" + Math.max(0, corps.length - 1) + "/" + corps.length },
    body:JSON.stringify(corps) });
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
// Le tableau de bord vit derrière un code dans l'URL, lu au montage : il faut
// donc le passer dès le chargement, pas après.
const CODE_STATS = (await readFile(join(ici, "..", "src", "components", "LePont.jsx"), "utf8"))
  .match(/const STATS_CODE = "([^"]+)"/)[1];
await page.goto("http://localhost:4173/" + (ecran.startsWith("tracking") ? "?stats=" + CODE_STATS : ""));
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
  "hall-of-fame": [/classement/i, /hall of fame/i],
  bienvenue:  [],   // premier lancement : la bannière RGPD
  tutoriel:   [],   // premier lancement : le carrousel, après la bannière
  partie:     [],   // idem, puis « Jouer solo »
  collection: [],   // via le profil, puis le bloc des cartes
  compte:     [],   // via le profil, puis « Mon compte »
  "partie-fin": [], // une partie solo, puis on passe jusqu'a la fin de manche
  "partie-faux": [], // une partie solo, puis une reponse fausse : le bandeau
  "mercato-faux": [], // The Mercato, puis une reponse fausse
  "mercato-juste": [], // The Mercato, puis une VRAIE bonne reponse : le bandeau
};
// Les six modes du carrousel de l'accueil, dans leur ordre de la table
// homeCards. On selectionne la pastille correspondante avant de taper la
// carte : c'est le seul moyen d'ouvrir un mode qui n'est pas celui affiche.
const MODES_CARROUSEL = ["duel", "grid", "mercato", "plug", "guess", "goatgrid"];
for (const m of MODES_CARROUSEL) CHEMINS["mode-" + m] = [];
// Le tableau de bord de suivi n'est pas dans l'app : il s'ouvre par ?stats=CODE,
// et ses rubriques sont des onglets. LARGEUR=1280 donne la version PC.
for (const r of ["resume", "audience", "modes", "joueurs", "comptes"]) CHEMINS["tracking-" + r] = [];
CHEMINS["tracking"] = [];
// `tracking-filtre` sert à vérifier le CÂBLAGE des filtres : les tests couvrent
// le calcul, pas le fait qu'un menu déroulant atteigne bien l'agrégation.
CHEMINS["tracking-filtre"] = [];
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
// Les ecrans qui vivent derriere le profil : on l'ouvre d'abord.
if (ecran === "collection" || ecran === "compte") {
  await page.locator("img[src*='/cards/']").first().click();
  await page.waitForTimeout(1500);
  const cible = ecran === "collection"
    ? page.locator("div").filter({ hasText: /^\d+\s*\/\s*\d+\s*cartes/ }).last()
    : page.getByRole("button", { name: /mon compte/i }).first();
  await cible.scrollIntoViewIfNeeded();
  await cible.click();
  await page.waitForTimeout(1600);
}

// Un mode precis du carrousel : pastille, puis carte.
if (ecran.startsWith("mode-") || ecran.startsWith("mercato-")) {
  const i = ecran.startsWith("mercato-") ? MODES_CARROUSEL.indexOf("mercato")
                                         : MODES_CARROUSEL.indexOf(ecran.slice(5));
  // Les pastilles sont les seuls petits blocs cliquables sous la carte.
  const pastilles = page.locator("div[style*='border-radius: 5px'][style*='cursor: pointer']");
  if (await pastilles.count() > i) {
    await pastilles.nth(i).click();
    await page.waitForTimeout(900);
  } else {
    console.warn("pastilles du carrousel introuvables — on ouvre la carte affichée");
  }
  const carte = await page.locator("img[src*='-card']").first().boundingBox();
  if (!carte) { console.error("carte du carrousel introuvable"); process.exit(1); }
  await page.mouse.click(carte.x + carte.width / 2, carte.y + carte.height / 2);
  await page.waitForTimeout(2800);
}

if (ecran === "jeu" || ecran === "partie" || ecran === "partie-fin" || ecran === "partie-faux") {
  // La carte du carrousel lance le mode affiché. On clique aux coordonnées
  // plutôt que sur l'<img> : le gestionnaire est porté par un calque au-dessus
  // d'elle, qui intercepte le clic et fait échouer un click() ciblé.
  const carte = await page.locator("img[src*='-card']").first().boundingBox();
  if (!carte) { console.error("carte du carrousel introuvable"); process.exit(1); }
  await page.mouse.click(carte.x + carte.width / 2, carte.y + carte.height / 2);
  await page.waitForTimeout(2800);
}
if (ecran === "partie" || ecran === "partie-fin" || ecran === "partie-faux" || ecran.startsWith("mercato-")) {
  const solo = page.getByRole("button", { name:/jouer se?ul|jouer solo/i }).first();
  await solo.click();
  await page.waitForTimeout(3000);
}

// La fin de manche ne s'atteint qu'en jouant, et la manche est au CHRONOMETRE
// (90 s) : passer les questions ne l'epuise pas, ca ne fait qu'enchainer les
// paires. Il faut donc laisser le temps s'ecouler. C'est long, mais c'est le
// seul moyen de voir cet ecran — et le voir vaut mieux que le corriger a
// l'aveugle.
// Le bandeau de reponse est le meme composant qu'on ait juste ou faux : une
// reponse volontairement fausse suffit a le faire apparaitre, et c'est le seul
// moyen de le voir sans connaitre la reponse attendue.
// C'est The Mercato qui porte le bandeau de reponse ; GOAT DUEL, lui, se
// contente de secouer le champ en rouge. Chercher le bandeau dans le mauvais
// mode ne donne donc rien.
// Le bandeau de bonne reponse ne se declenche que sur une VRAIE bonne
// reponse : une reponse fausse, dans ce mode, se contente de passer au joueur
// suivant. On lit donc le nom affiche et on lui donne un de ses clubs, pris
// dans players.jsx — la meme source que le jeu.
if (ecran === "mercato-juste") {
  const nom = (await page.locator("text=/DONNE UN CLUB DE/i").first()
    .locator("xpath=..").innerText()).split("\n").pop().trim();
  const base = await readFile(join(ici, "..", "src", "players.jsx"), "utf8");
  const ligne = base.split("\n").find((l) => l.includes('name:"' + nom + '"'));
  const clubs = ligne ? [...ligne.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  const club = clubs.find((c) => c !== nom && !["facile", "moyen", "expert"].includes(c));
  if (!club) { console.error("aucun club trouve pour", nom); process.exit(1); }
  console.log("joueur affiche :", nom, "→ on repond", club);
  await page.locator("input[type='text'], input:not([type])").first().fill(club);
  const bv = await page.getByRole("button", { name: /^\s*valider\s*$/i }).first().boundingBox();
  if (bv) await page.mouse.click(bv.x + bv.width / 2, bv.y + bv.height / 2);
  await page.locator("text=/\\+\\d+ pts/").first()
    .waitFor({ state: "visible", timeout: 4000 })
    .catch(() => console.warn("bandeau non attrape"));
}

if (ecran === "partie-faux" || ecran === "mercato-faux") {
  const champ = page.locator("input[type='text'], input:not([type])").first();
  await champ.fill("zzzz");
  // Clic aux coordonnees : le bouton est sous un calque qui intercepte, comme
  // la carte du carrousel. Un click() cible echouait en silence, et le champ
  // restait rempli sans que rien ne soit soumis.
  const bValider = await page.getByRole("button", { name: /^\s*valider\s*$/i }).first().boundingBox();
  if (bValider) await page.mouse.click(bValider.x + bValider.width / 2, bValider.y + bValider.height / 2);
  // Le bandeau ne vit qu'une poignee de dixiemes : toute attente fixe le rate,
  // trop tot ou trop tard. On le guette.
  const bandeau = page.locator("text=/MAUVAISE R|CLUB DEJA|CLUB DÉJÀ/i").first();
  await bandeau.waitFor({ state: "visible", timeout: 4000 })
    .catch(() => console.warn("bandeau non attrape — la capture montrera la question suivante"));
}

if (ecran === "partie-fin") {
  const limite = 110000, pas = 5000;
  let attendu = 0;
  while (attendu < limite) {
    await page.waitForTimeout(pas);
    attendu += pas;
    const fini = await page.getByRole("button", { name:/rejouer|retour|↩/i }).first()
      .isVisible().catch(() => false);
    if (fini) { console.log("fin de manche atteinte apres", attendu / 1000, "s"); break; }
  }
  await page.waitForTimeout(1500);
}
if (ecran === "profil") {
  // L'avatar de l'en-tête ouvre le profil ; c'est une image cliquable, pas un
  // bouton, donc getByRole ne la voit pas.
  await page.locator("img[src*='/cards/']").first().click();
  await page.waitForTimeout(1600);
}

if (ecran === "tracking-filtre") {
  // Deux menus, pour voir que les filtres se cumulent et que le bouton de remise
  // à zéro apparaît avec le bon compte.
  const menus = page.locator("select");
  await menus.nth(1).selectOption("grid");     // Mode
  await menus.nth(2).selectOption("inscrits"); // Public
  await page.waitForTimeout(600);
  await page.getByRole("button", { name:/modes de jeu/i }).first().click();
  await page.waitForTimeout(600);
}
// Une rubrique du tableau de bord : les onglets portent leur libellé.
else if (ecran.startsWith("tracking-")) {
  const LIBELLES = { resume:/vue d'ensemble/i, audience:/audience/i, modes:/modes de jeu/i,
                     joueurs:/^\s*👤 Joueurs\s*$|^Joueurs$/i, comptes:/comptes/i };
  const cible = LIBELLES[ecran.slice(9)];
  const b = page.getByRole("button", { name:cible }).first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(700); }
  else console.warn("onglet introuvable :", ecran);
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

const suffixe = LARGEUR > 900 ? "-pc" : "";
const chemin = join(ici, "..", "apercu-" + ecran + suffixe + ".png");
await page.screenshot({ path:chemin, fullPage:false });
console.log("écrit", chemin);
await navigateur.close();
serveur.close();
