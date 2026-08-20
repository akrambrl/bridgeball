#!/usr/bin/env node
// LE SINGE — clique TOUT, dans trois formats, et note ce qui casse.
//
//     npm run singe            # les trois formats
//     FORMAT=ios npm run singe # un seul
//
// CE QU'IL FAIT. À chaque format, il charge l'app, énumère tous les éléments
// cliquables VISIBLES, les clique un par un, et après chaque clic :
//
//   • ramasse les erreurs de console et les exceptions non rattrapées ;
//   • vérifie que la page n'est pas devenue VIDE (le symptôme d'un rendu React
//     qui a levé : l'écran devient noir sans un mot) ;
//   • vérifie que le corps ne déborde pas horizontalement — le défaut de mise en
//     page le plus fréquent de ce dépôt, et invisible sur un écran large ;
//   • revient à un état connu avant le clic suivant, sinon on explore un seul
//     chemin au hasard au lieu de la surface.
//
// CE QU'IL NE FAIT PAS, ET IL FAUT LE DIRE. Ce n'est pas iOS ni Android : c'est
// Chromium à leurs dimensions. Les coques natives (WebView Android, WKWebView
// iOS) ont leurs propres écarts — zone sûre, clavier, retour matériel — que ce
// banc ne voit pas. Il attrape les défauts de logique et de mise en page, pas
// ceux de la coque.
//
// Supabase est bouché et répond des lignes fabriquées : on éprouve les CHEMINS,
// pas les données. Un écran qui plante parce qu'une liste est vide est
// justement ce qu'on cherche.

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const dist = join(ici, "..", "dist");
const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".webp":"image/webp", ".png":"image/png", ".svg":"image/svg+xml",
  ".json":"application/json", ".woff2":"font/woff2", ".ico":"image/x-icon" };

const serveur = createServer(async (req, res) => {
  const chemin = decodeURIComponent(req.url.split("?")[0]);
  for (const e of [join(dist, chemin), join(dist, chemin, "index.html"), join(dist, "index.html")]) {
    try {
      const c = await readFile(e);
      res.writeHead(200, { "Content-Type": TYPES[extname(e)] || "application/octet-stream" });
      res.end(c); return;
    } catch { /* suivant */ }
  }
  res.writeHead(404); res.end();
});
const PORT = 4176;
await new Promise((ok) => serveur.listen(PORT, ok));

// Les trois formats. iPhone 14/15 et un Android courant ; 1280×900 pour le PC.
const FORMATS = {
  pc:      { nom: "PC 1280×900",        width: 1280, height: 900 },
  ios:     { nom: "iPhone 393×852",     width: 393,  height: 852 },
  android: { nom: "Android 360×800",    width: 360,  height: 800 },
};

// Des lignes plausibles pour tout ce que l'app lit. On ne cherche pas à simuler
// la base : on veut que les écrans aient de quoi s'afficher, y compris des
// listes NON vides (une liste vide cache les défauts de rendu des éléments).
const JOUEURS = ["jules","nadia","james10","vice","kader","lila","toto","mehdi"]
  .map((nom, i) => ({ pid:"p"+(i+1), nom, score:41220-i*1600, xp:120000-i*9000,
                      pays:["FR","BE","NL","IT","ES","PT"][i%6] }));
const ilYa = (n) => new Date(Date.now() - n*86400000).toISOString();

function corpsPour(url) {
  if (url.includes("bb_pseudos")) {
    return JOUEURS.map((j) => ({ player_id:j.pid, pseudo:j.nom, xp:j.xp, xp_season:j.score,
      xp_season_month:new Date().toISOString().slice(0,7), country:j.pays,
      badge:"patron", created_at:ilYa(3), streak_count:4, streak_best:9,
      streak_last_date:new Date().toISOString().slice(0,10), recovery_code:null }));
  }
  if (url.includes("bb_scores")) {
    return JOUEURS.map((j, i) => ({ player_id:j.pid, player_name:j.nom, score:j.score,
      mode:["pont","chaine","findscore"][i%3], diff:"moyen", created_at:ilYa(i%7) }));
  }
  if (url.includes("bb_duels")) {
    return JOUEURS.slice(0,4).map((j, i) => ({ id:"d"+i, challenger_id:i%2?j.pid:"local",
      opponent_id:i%2?"local":j.pid, challenger_name:j.nom, opponent_name:"moi",
      challenger_score:300-i*20, opponent_score:250+i*10, mode:"pont", diff:"moyen",
      status:["open","sent","complete","open_done"][i%4], created_at:ilYa(i) }));
  }
  if (url.includes("bb_rooms")) {
    return [{ id:"salle-1", code:"2DE22N", host_id:"local", host_name:"jules",
      mode:"chaine", diff:"facile", rounds:1, status:"waiting",
      players:JSON.stringify([{ id:"local", name:"jules", score:null, status:"waiting" }]),
      created_at:ilYa(0) }];
  }
  if (url.includes("bb_gg_scores")) {
    return JOUEURS.map((j, i) => ({ player_id:j.pid, score:600-i*40, max_score:900,
      vie_rachetee:false, created_at:ilYa(i%5) }));
  }
  if (url.includes("bb_seasons")) {
    return [{ season_number:5, month_key:"2026-08", champion_id:"p1",
      champion_name:"jules", champion_score:41220 }];
  }
  if (url.includes("bb_lots")) {
    return [{ season_number:6, rang:1, intitule:"Maillot officiel" }];
  }
  if (url.includes("bb_friend_requests")) {
    return JOUEURS.slice(0,3).map((j, i) => ({ id:"fr"+i, from_id:j.pid, from_name:j.nom,
      to_id:"local", to_name:"moi", status:["pending","accepted","accepted"][i],
      created_at:ilYa(i) }));
  }
  return [];
}

const rapport = [];

for (const [cle, f] of Object.entries(FORMATS)) {
  if (process.env.FORMAT && process.env.FORMAT !== cle) continue;

  const nav = await chromium.launch({ args:["--no-proxy-server"],
    ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath:process.env.PLAYWRIGHT_CHROMIUM } : {}) });
  const ctx = await nav.newContext({ viewport:{ width:f.width, height:f.height } });
  await ctx.route("**/rest/v1/**", async (route) => {
    const corps = corpsPour(route.request().url());
    await route.fulfill({ status:200, contentType:"application/json",
      headers:{ "access-control-allow-origin":"*",
                "access-control-expose-headers":"content-range",
                "content-range":"0-" + Math.max(0, corps.length-1) + "/" + corps.length },
      body:JSON.stringify(corps) });
  });
  // Tout le reste du réseau est coupé : la machine n'a pas d'accès sortant
  // depuis le navigateur, et une requête pendante ralentirait chaque clic.
  await ctx.route("**", (route) =>
    route.request().url().startsWith("http://localhost:" + PORT)
      ? route.continue() : route.abort());

  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => {
    // Même filtre que la console, pour la même raison : /_vercel/insights n'a
    // pas d'équivalent local, et sa SyntaxError n'apprend rien sur l'app.
    if (/Unexpected token '<'/.test(e.message)) return;
    erreurs.push({ type:"exception", txt:e.message.slice(0,200) });
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Le bruit du HARNAIS, et il faut savoir lequel :
    //
    //   • net::ERR / Failed to load — les ressources qu'on coupe exprès ;
    //   • Unexpected token '<' — /_vercel/insights/script.js. Ce chemin n'existe
    //     que sur Vercel ; en local le serveur de secours rend index.html, que le
    //     navigateur essaie d'exécuter comme du JS. TRACÉ, pas supposé : la
    //     première lecture du banc a compté 23 fois cette exception avant qu'un
    //     window.onerror n'en donne le fichier et la ligne.
    if (/net::ERR|Failed to load resource|Unexpected token '<'|favicon|_vercel/i.test(t)) return;
    erreurs.push({ type:"console", txt:t.slice(0,200) });
  });

  await page.addInitScript(() => {
    localStorage.setItem("bb_lang", "fr");
    localStorage.setItem("bb_name", "jules");
    localStorage.setItem("bb_player_id", "local");
    localStorage.setItem("bb_welcome_seen", "1");
    localStorage.setItem("bb_tutorial_done", "1");
    localStorage.setItem("bb_friends", JSON.stringify(["p2","p3","p4"]));
    localStorage.setItem("bb_friend_names", JSON.stringify({ p2:"nadia", p3:"james10", p4:"vice" }));
  });

  const observer = async (etiquette) => {
    const etat = await page.evaluate(() => ({
      texte: (document.body.innerText || "").trim().length,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      racineVide: !document.getElementById("root") || document.getElementById("root").children.length === 0,
    }));
    const soucis = [];
    if (etat.racineVide) soucis.push("écran VIDE (rendu React tombé)");
    else if (etat.texte < 20) soucis.push("écran quasi vide (" + etat.texte + " car.)");
    if (etat.scrollW > etat.clientW + 2)
      soucis.push("débordement horizontal " + (etat.scrollW - etat.clientW) + " px");
    for (const e of erreurs.splice(0)) soucis.push(e.type + " : " + e.txt);
    for (const s of soucis) rapport.push({ format:f.nom, ou:etiquette, souci:s });
    return soucis;
  };

  const revenir = async () => {
    await page.goto("http://localhost:" + PORT + "/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(900);
    // Le pop-up de la devinette du jour s'ouvre 1,4 s après le montage et
    // couvrirait tous les clics suivants.
    try { await page.getByRole("button", { name:/plus tard|later|später|più tardi|mais tarde|más tarde/i })
      .first().click({ timeout:1200 }); } catch { /* pas ouvert */ }
    await page.waitForTimeout(200);
  };

  process.stdout.write("\n── " + f.nom + "\n");
  await revenir();
  await observer("chargement");

  // Un tour de reconnaissance : la liste des cliquables de l'accueil. On la fige
  // AVANT de cliquer, sinon on suit l'arbre au fur et à mesure qu'il change.
  const cibles = await page.evaluate(() => {
    const vus = [];
    const els = document.querySelectorAll("button, [role='button'], a[href]");
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none" || Number(st.opacity) < .1) continue;
      const nom = (el.getAttribute("aria-label") || el.innerText || el.title || "").trim()
        .replace(/\s+/g, " ").slice(0, 46);
      vus.push(nom || "(sans nom)");
    }
    return vus;
  });
  process.stdout.write("   " + cibles.length + " cliquables sur l'accueil\n");

  // On clique par POSITION, en repartant de l'accueil avant chaque clic et en
  // ré-énumérant à ce moment-là. Le nom accessible ne suffisait pas : sur
  // téléphone, les cartes du carrousel sont des blocs sans libellé propre, et
  // seuls 2 des 10 cliquables se retrouvaient — on croyait balayer l'accueil
  // mobile alors qu'on n'en touchait qu'un cinquième.
  //
  // Repartir de l'accueil à chaque fois est indispensable : l'arbre change dès le
  // premier clic, donc un index pris une fois pour toutes désignerait autre chose.
  let teste = 0, ignores = 0;
  for (let i = 0; i < cibles.length; i++) {
    await revenir();
    const tous = page.locator("button, [role='button'], a[href]");
    let cible;
    try {
      if (await tous.count() <= i) { ignores++; continue; }
      cible = tous.nth(i);
      if (!(await cible.isVisible())) { ignores++; continue; }
      await cible.click({ timeout:2500 });
    } catch { ignores++; continue; }
    teste++;
    await page.waitForTimeout(1100);
    const soucis = await observer("clic n°" + (i + 1) + " « " + cibles[i] + " »");
    if (soucis.length)
      process.stdout.write("   ✗ n°" + (i + 1) + " « " + cibles[i] + " » → " + soucis[0] + "\n");
  }
  process.stdout.write("   " + teste + " cliqués, " + ignores + " hors d'atteinte\n");

  // Les chemins d'URL, qui n'ont pas de bouton sur tous les formats.
  for (const req of ["play=pont","play=chaine","play=goatgrid","play=duel","play=guess",
                     "play=grid","play=devinette","duels=1","friends=1","profil=1","room=2DE22N"]) {
    await page.goto("http://localhost:" + PORT + "/?" + req);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2200);
    const soucis = await observer("?" + req);
    process.stdout.write((soucis.length ? "   ✗ " : "   ✓ ") + "?" + req
      + (soucis.length ? " → " + soucis[0] : "") + "\n");
  }

  await nav.close();
}

serveur.close();

console.log("\n═══ RÉSUMÉ ══════════════════════════════════════════════════════════");
if (rapport.length === 0) {
  console.log("Aucun souci relevé.\n");
} else {
  // Regroupé par souci : le même défaut de mise en page revient sur beaucoup
  // d'écrans, et une liste plate le noierait.
  const par = new Map();
  for (const r of rapport) {
    const cle = r.format + " │ " + r.souci;
    if (!par.has(cle)) par.set(cle, []);
    par.get(cle).push(r.ou);
  }
  for (const [cle, ou] of [...par].sort((a, b) => b[1].length - a[1].length)) {
    console.log("\n" + cle + "   (" + ou.length + "×)");
    console.log("   " + ou.slice(0, 6).join(" · ") + (ou.length > 6 ? " …" : ""));
  }
  console.log("\n" + rapport.length + " observation(s), " + par.size + " souci(s) distinct(s).\n");
}
process.exit(0);
