// Enregistre une VRAIE partie de l'app en 1080×1920 vertical, prête à poster.
//
//     npm run build && node scripts/tiktok.mjs
//     SECONDES=20 node scripts/tiktok.mjs        # borne la durée
//
// POURQUOI CE SCRIPT EXISTE. Les fichiers de l'app ne sont pas des vidéos de
// feed, et c'est mesurable : les cinématiques font 640×360 en PAYSAGE, durent
// 3 secondes et n'ont AUCUNE piste audio ; les affiches de mode sont en 1086×1448,
// soit du 3:4. Postés tels quels, ils cumulent tout ce qu'une plateforme verticale
// sanctionne — mauvais format, résolution minuscule, durée sous le plancher, pas de
// son. Ce sont des assets conçus pour jouer DANS l'app, derrière un score.
//
// Ce script filme donc l'app en train d'être jouée, au bon cadre.
//
// LE SON N'EST PAS AJOUTÉ ICI, et c'est volontaire : la piste qu'on met sur une
// vidéo décide d'une bonne partie de sa distribution, et elle doit venir de la
// bibliothèque de la plateforme — c'est là qu'elle est licenciée et c'est elle qui
// porte la découverte. On écrit une piste SILENCIEUSE pour que le fichier soit bien
// formé (un MP4 sans flux audio se fait parfois recompresser de travers), et le son
// se choisit à la publication.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, rm, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const dist = join(racine, "dist");
const sortie = join(racine, "tiktok");
const SECONDES = Number(process.env.SECONDES || 24);

// Le rendu se fait en 540×960 CSS avec un facteur 2, donc 1080×1920 réels. On ne
// peut PAS rendre directement en 1080 de large : la mise en page de l'app bascule
// sur son chemin ordinateur au-delà de 768 px CSS (window.innerWidth), et on
// filmerait la landing à trois colonnes au lieu du jeu.
const LARGEUR = 540, HAUTEUR = 960, ECHELLE = 2;

const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".webp":"image/webp", ".png":"image/png", ".svg":"image/svg+xml", ".mp4":"video/mp4",
  ".webm":"video/webm", ".json":"application/json", ".woff2":"font/woff2", ".ico":"image/x-icon" };

const serveur = createServer(async (req, res) => {
  const chemin = decodeURIComponent(req.url.split("?")[0]);
  for (const essai of [join(dist, chemin), join(dist, chemin, "index.html"), join(dist, "index.html")]) {
    try {
      const contenu = await readFile(essai);
      res.writeHead(200, { "Content-Type": TYPES[extname(essai)] || "application/octet-stream" });
      res.end(contenu); return;
    } catch { /* essai suivant */ }
  }
  res.writeHead(404); res.end();
});
await new Promise(ok => serveur.listen(4174, ok));

await rm(sortie, { recursive: true, force: true });
await mkdir(sortie, { recursive: true });

const navigateur = await chromium.launch({
  args: ["--no-proxy-server", "--autoplay-policy=no-user-gesture-required"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const T0 = Date.now();   // l'enregistrement démarre à la création du contexte
const ctx = await navigateur.newContext({
  viewport: { width: LARGEUR, height: HAUTEUR },
  deviceScaleFactor: ECHELLE,
  recordVideo: { dir: sortie, size: { width: LARGEUR * ECHELLE, height: HAUTEUR * ECHELLE } },
});

// Supabase bouché : le classement et les scores ne servent pas à la démo, et une
// requête qui pend fait un blanc de deux secondes au milieu du plan.
// 6 s et non 30 : un locator absent coûtait une demi-minute, et comme la vidéo dure
// le temps du contexte, chaque échec silencieux l'allongeait d'autant. Le premier
// essai a rendu 342 secondes de film pour 4 secondes de jeu.
ctx.setDefaultTimeout(6000);

await ctx.route("**/rest/v1/**", route => route.fulfill({
  status: 200, contentType: "application/json",
  headers: { "access-control-allow-origin": "*" }, body: "[]" }));

const page = await ctx.newPage();
// Un pseudo posé d'avance : sans lui l'app ouvre sa modale de pseudo, et on filme
// un formulaire. Les invites du jour sont marquées comme vues pour la même raison.
await page.addInitScript(() => {
  localStorage.setItem("bb_welcome_seen", "1");
  localStorage.setItem("bb_tutorial_done", "1");
  localStorage.setItem("bb_name", "GOAT FC");
  localStorage.setItem("bb_lang", "fr");
  const d = new Date();
  const paris = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const jour = paris.getFullYear() + "-" + String(paris.getMonth() + 1).padStart(2, "0")
    + "-" + String(paris.getDate()).padStart(2, "0");
  localStorage.setItem("bb_devinette_popup_shown", jour);
});
await page.goto("http://localhost:4174/");
await page.waitForTimeout(2600);
// Ceinture et bretelles : la clé « pop-up déjà vu » suffit en principe, mais si une
// invite passe quand même, elle intercepte le premier clic et tout le reste échoue
// en cascade. On la referme si elle est là.
for (const libelle of [/plus tard/i, /^fermer$/i]) {
  const b = page.getByRole("button", { name: libelle }).first();
  if (await b.count() && await b.isVisible().catch(() => false)) {
    await b.click().catch(() => {}); await page.waitForTimeout(400);
  }
}

// ── Le plan : GOAT GRID qui se remplit ──────────────────────────────────────
// C'est le mode le plus lisible pour quelqu'un qui n'a jamais vu l'app : une
// grille se remplit case par case, chaque bonne réponse est un événement visible,
// et la fin porte une récompense. Et c'est le seul mode dont les réponses sont
// accessibles au script (le mode démo les liste), donc le seul qu'on peut jouer
// JUSTE — un plan où le joueur se trompe ne donne pas envie.
const pastilles = page.locator("div[style*='border-radius: 5px'][style*='cursor: pointer']");
const MODES = ["duel", "grid", "mercato", "plug", "guess", "goatgrid"];
await pastilles.nth(MODES.indexOf("goatgrid")).waitFor({ timeout: 9000 }).catch(() => {});
console.log("→ pastilles du carrousel :", await pastilles.count());
if (await pastilles.count() > MODES.indexOf("goatgrid")) {
  await pastilles.nth(MODES.indexOf("goatgrid")).click().catch(() => {});
  await page.waitForTimeout(700);
} else {
  console.error("carrousel introuvable — on filmerait le mauvais mode"); process.exit(1);
}
const carte = await page.locator("img[src*='-card']").first().boundingBox();
if (carte) await page.mouse.click(carte.x + carte.width / 2, carte.y + carte.height / 2);
await page.waitForTimeout(1500);
const solo = page.locator("div").filter({ hasText: /^Défi du jour/ }).first();
if (!(await solo.count())) { console.error("feuille de GOAT GRID non ouverte"); process.exit(1); }
await solo.click({ force: true }).catch(() => {});
await page.waitForTimeout(1600);
console.log("→ grille lancée");

// Mode démo : cinq tapes sur le titre. Il donne une réponse par case.
const titre = page.getByText(/^GOAT GRID$/).first();
for (let k = 0; k < 5; k++) { await titre.click({ force: true }).catch(() => {}); await page.waitForTimeout(90); }
await page.waitForTimeout(500);
const reponses = await page.evaluate(() => {
  const blocs = [...document.querySelectorAll("div")].filter(d =>
    /MODE DÉMO — réponses/.test(d.textContent || "") && d.children.length <= 3);
  const bloc = blocs[blocs.length - 1];
  if (!bloc) return [];
  return [...bloc.parentElement.querySelectorAll("div > div > span:last-child")]
    .map(s => (s.textContent || "").trim()).filter(Boolean);
});
console.log("→ réponses du mode démo :", reponses.length);
if (!reponses.length) { console.error("mode démo muet — sans réponses, le plan montre un joueur qui sèche"); process.exit(1); }
// ON NE COUPE PAS le mode démo. Le premier essai le refermait pour ne pas filmer sa
// feuille de réponses — sauf que le basculer REGÉNÈRE une autre grille : les réponses
// relevées ne correspondaient plus, les neuf étaient refusées, et le plan finissait
// sur « PARTIE TERMINÉE · 0 pt ». Le mode reste donc actif et on masque au CSS ce
// qu'il ajoute à l'écran : sa feuille (seul bloc en bordure pointillée de cet écran)
// et sa mention sous le titre.
await page.addStyleTag({ content:
  'div[style*="dashed"]{display:none!important}'
  + 'div[style*="font-size: 9px"]{visibility:hidden!important}' });
await page.waitForTimeout(400);

// Instant où le plan commence, compté depuis la création du contexte : c'est ce
// qu'on passe à ffmpeg en `-ss` pour couper toute la mise en place. Sans ça la vidéo
// s'ouvre sur l'accueil, le carrousel et une feuille de mode — trois écrans avant le
// jeu, là où un feed vertical se juge sur la première seconde.
const DEBUT_PLAN = Math.max(0, (Date.now() - T0) / 1000 - 0.6);
const debut = Date.now();
console.log("→ remplissage…");
for (const nom of reponses) {
  if ((Date.now() - debut) / 1000 > SECONDES) { console.log("durée atteinte, on coupe"); break; }
  const vides = page.locator("div").filter({ hasText: /^\+$/ });
  if (await vides.count() === 0) { console.log("   (plus de case vide)"); break; }
  await vides.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(420);
  const champ = page.locator("input[placeholder*='lettres'], input[placeholder*='letters']").first();
  if (!(await champ.count())) { console.log("   (champ de saisie absent)"); break; }
  await champ.click({ force: true }).catch(() => {});
  // VIDER le champ d'abord. Sans ça les réponses s'ACCUMULENT — la première version
  // filmait un champ où on lisait « CristianoPaul Pogba Ronaldo », parce que rien
  // n'était jamais validé et que la modale restait ouverte d'une case à l'autre.
  await champ.fill("").catch(() => {});
  // On FRAPPE les touches (un `fill` ne réveille pas l'autocomplétion, qui écoute la
  // saisie), assez vite pour rester regardable mais assez lentement pour qu'on VOIE
  // écrire : c'est ce qui rend le plan lisible.
  await champ.pressSequentially(nom, { delay: 26 });
  await page.waitForTimeout(320);
  // Toucher la suggestion, PUIS valider. C'est le clic sur VALIDER qui manquait, et
  // c'est pour ça qu'aucune case ne se remplissait.
  const sugg = page.getByRole("button", { name: new RegExp(nom.split(" ").pop(), "i") }).first();
  if (await sugg.count()) await sugg.click({ force: true }).catch(() => {});
  await page.waitForTimeout(260);
  const valider = page.getByRole("button", { name: /^VALIDER$/i }).first();
  if (await valider.count()) await valider.click({ force: true }).catch(() => {});
  // ATTENDRE que la modale se referme, au lieu de supposer un délai. Elle mettait
  // plus de 560 ms : à l'itération suivante on cliquait la case suivante DERRIÈRE
  // la modale encore ouverte, le clic n'atteignait rien, et la boucle calait après
  // une seule réponse.
  await page.getByText(/QUI MATCHE/).first()
    .waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(420);   // on laisse la case remplie se voir
  if (process.env.TRACE) {
    const etat = await page.evaluate(() => {
      const t = document.body.innerText;
      const m = t.match(/REMPLI\s*(\d\/9)/i);
      const vies = (t.match(/❤️/g) || []).length;
      const modale = /QUI MATCHE/.test(t);
      return (m ? m[1] : "?") + " · vies " + vies + (modale ? " · modale OUVERTE" : "");
    });
    console.log("   " + nom + " → " + etat);
  }
}
// L'écran de fin : la récompense du plan. On le laisse respirer, cinématique comprise.
await page.waitForTimeout(4200);

console.log("→ plan terminé en " + Math.round((Date.now() - debut) / 1000) + " s, écriture…");
await page.close();          // c'est la fermeture qui écrit la vidéo
await ctx.close();
await navigateur.close();
serveur.close();

// ── Transcodage ─────────────────────────────────────────────────────────────
const brutes = (await readdir(sortie)).filter(f => f.endsWith(".webm"));
if (!brutes.length) { console.error("aucune vidéo produite"); process.exit(1); }
const brute = join(sortie, brutes[0]);
console.log("→ brut : " + brutes[0] + ", transcodage…");
const finale = join(sortie, "goatfc-vertical.mp4");

// yuv420p et `+faststart` : sans le premier, certains lecteurs refusent le fichier ;
// sans le second, l'atome de métadonnées reste en fin de fichier et la lecture ne
// démarre qu'après téléchargement complet. 30 images/s parce que la source est à
// framerate variable — un VFR se fait recompresser n'importe comment à l'upload.
// La piste audio est un silence : voir l'en-tête du fichier.
// `-ss` AVANT `-i` : le décodeur saute directement, au lieu de décoder puis jeter.
// Pas de `-r` en ENTRÉE : il décalait le point de coupe, et la durée délirante du
// premier essai (342 s) venait du temps réel écoulé — des locators absents qui
// brûlaient 30 s chacun — pas d'horodatages irréguliers. Le framerate constant est
// imposé en SORTIE, par le filtre fps.
const args = ["-y", "-ss", DEBUT_PLAN.toFixed(2), "-i", brute,
  "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
  "-shortest",
  "-vf", `scale=${LARGEUR * ECHELLE}:${HAUTEUR * ECHELLE}:force_original_aspect_ratio=decrease,`
       + `pad=${LARGEUR * ECHELLE}:${HAUTEUR * ECHELLE}:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p`,
  "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "20",
  "-c:a", "aac", "-b:a", "128k",
  "-movflags", "+faststart", finale];
await new Promise((ok, ko) => {
  const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", d => { err += d; });
  p.on("close", code => code === 0 ? ok() : ko(new Error(err.slice(-1500))));
});

const infos = await new Promise(ok => {
  const p = spawn("ffprobe", ["-v", "error", "-show_entries",
    "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate",
    "-of", "default=noprint_wrappers=1", finale], { stdio: ["ignore", "pipe", "ignore"] });
  let out = ""; p.stdout.on("data", d => { out += d; }); p.on("close", () => ok(out));
});
// Le WebM brut pèse dix fois le MP4 final et ne sert plus à rien : on le retire,
// sinon le dossier grossit d'une trentaine de mégaoctets à chaque tournage.
await rm(brute, { force: true });
console.log("\nécrit " + finale + "\n" + infos.trim());
