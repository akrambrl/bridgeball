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
// HAUTEUR : certains écrans bornent leur hauteur et défilent dans un conteneur
// interne que le repli « -bas » n'attrape pas toujours. Agrandir la fenêtre est
// plus sûr que deviner quel div défile.
const HAUTEUR = Number(process.env.HAUTEUR || 932);
const ctx = await navigateur.newContext({
  viewport:{ width:LARGEUR, height:HAUTEUR }, deviceScaleFactor:LARGEUR > 900 ? 1 : 2 });

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
    // DEFI=1 : un défi OUVERT relevable, avec un score à battre. C'est le seul
    // chemin vers l'écran de résultat de duel (`duelResult`) : on relève le défi,
    // on joue, et à la fin du chrono submitDuelScore pose le résultat. Sans ça
    // l'écran n'était pas photographiable, donc sa charte était corrigée à
    // l'aveugle — c'est exactement le fond sombre qu'on vient d'y trouver.
    if (process.env.DEFI) {
      // Un SEUL défi ouvert, et rien d'autre : « mes défis », les tentatives et
      // l'historique restent vides pour que le salon n'ait qu'une carte à cliquer.
      // On laisse la réponse partir par le fulfill commun en bas — lui seul pose
      // les en-têtes CORS et content-range dont l'app a besoin.
      corps = url.includes("status=eq.open&")
        ? [{ id:"defi-1", challenger_id:"p6", challenger_name:"sjdrums",
             // DEFI_SCORE règle le score à battre, donc la BRANCHE affichée :
             // au-dessus on photographie DÉFAITE, en dessous VICTOIRE. Les deux
             // titres n'ont pas la même teinte et c'est justement ce qu'on vérifie.
             mode:"pont", diff:"facile", rounds:1,
             challenger_score:Number(process.env.DEFI_SCORE || 290),
             created_at:ilYaJours(0) }]
        : [];
    } else
    corps = JOUEURS.slice(0, 3).flatMap((j, i) => Array.from({ length:3 + i }, (_, k) => ({
      id:j.pid + "-" + k, created_at:ilYaJours(k % 14),
      challenger_id:j.pid, opponent_id:JOUEURS[(JOUEURS.indexOf(j) + 1) % 6].pid,
      challenger_score: k % 3 === 0 ? 9 : 5, opponent_score: k % 3 === 0 ? 5 : 9, status:"complete" })));
  } else if (url.includes("bb_events")) {
    corps = EVENEMENTS;
  } else if (url.includes("bb_friend_requests")) {
    // VIDE=1 : aucune relation, pour photographier les états vides — ils portent
    // leurs propres textes et leurs propres sorties de secours.
    if (process.env.VIDE) { corps = []; }
    else {
    // La liste d'amis est RELUE depuis les demandes acceptées, qui écrasent
    // localStorage : seeder bb_friends ne suffisait pas, l'écran retombait sur
    // son état vide. On répond selon le sens demandé par la requête.
    // Trois requêtes distinctes selon le sens et le statut : les amis viennent
    // des demandes ACCEPTÉES dans les deux sens, les demandes reçues et les
    // demandes envoyées encore en attente ont chacune la leur.
    const recues = url.includes("to_id=eq.");
    const acceptees = url.includes("status=eq.accepted");
    if (acceptees && recues)  corps = [{ from_id:"p4", from_name:"vice", status:"accepted" }];
    else if (acceptees)       corps = [{ to_id:"p2", to_name:"nadia", status:"accepted" },
                                       { to_id:"p3", to_name:"james10", status:"accepted" }];
    else if (recues)          corps = [{ id:"r1", from_id:"p5", from_name:"sjdrums", status:"pending" }];
    // Plusieurs demandes en attente, d'âges différents : c'est le cas réel — sur
    // un compte de production, quinze traînaient dont deux vieilles de trois mois.
    else                      corps = [{ to_id:"p2", to_name:"nadia", status:"accepted" },
                                       { to_id:"p3", to_name:"james10", status:"accepted" },
                                       { id:"s1", to_id:"p6", to_name:"strudel", status:"pending", created_at:ilYaJours(0) },
                                       { id:"s2", to_id:"p7", to_name:"kader",   status:"pending", created_at:ilYaJours(4) },
                                       { id:"s3", to_id:"p8", to_name:"lila",    status:"pending", created_at:ilYaJours(96) }];
    }
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
// LANGUE=de photographie l'écran dans une autre des six langues. Sans ça, une
// chaîne restée en français sous une interface allemande ne se voyait que sur
// le téléphone de quelqu'un — c'est comme ça que les critères de GOAT GRID
// sont restés « MILIEU » et « PAYS-BAS » en allemand.
const LANGUE = process.env.LANGUE || "fr";
const PREMIER_LANCEMENT_OBJ = { etape: PREMIER_LANCEMENT, vide: !!process.env.VIDE, langue: LANGUE };
await page.addInitScript((premier) => {
  // L'accueil est derrière l'accueil-tutoriel : sans ces clés, on photographie
  // le carrousel d'introduction quel que soit l'écran demandé. On ne les pose
  // donc PAS quand c'est justement lui qu'on vient voir.
  if (premier.etape !== "tout") localStorage.setItem("bb_welcome_seen", "1");
  if (premier.etape === "non")   localStorage.setItem("bb_tutorial_done", "1");
  localStorage.setItem("bb_name", "jules");
  localStorage.setItem("bb_lang", premier.langue || "fr");
  // La liste d'amis vit en localStorage, pas dans une table : sans ces clés,
  // l'écran Amis ne montrait QUE son état vide, et tout ce qui s'y passe une
  // fois qu'on a des amis restait invisible.
  if (!premier.vide) {
    localStorage.setItem("bb_friends", JSON.stringify(["p2", "p3", "p4"]));
    localStorage.setItem("bb_friend_names", JSON.stringify({ p2:"nadia", p3:"james10", p4:"vice" }));
  }
}, { ...PREMIER_LANCEMENT_OBJ });
// Le tableau de bord vit derrière un code dans l'URL, lu au montage : il faut
// donc le passer dès le chargement, pas après.
const CODE_STATS = (await readFile(join(ici, "..", "src", "components", "LePont.jsx"), "utf8"))
  .match(/const STATS_CODE = "([^"]+)"/)[1];
// REQUETE=play=devinette permet de photographier une arrivée par URL — c'est le
// chemin des notifications push et des boutons des pages SEO. Sans ça, un mode
// qui ne s'ouvre QUE par l'URL n'était vérifiable qu'à la main sur un téléphone :
// c'est précisément là que « la notif mène à l'accueil » est passé inaperçu.
const REQUETE = process.env.REQUETE || "";
await page.goto("http://localhost:4173/"
  + (ecran.startsWith("tracking") ? "?stats=" + CODE_STATS : REQUETE ? "?" + REQUETE : ""));
await page.waitForLoadState("networkidle");
// L'écran de démarrage dure 2,5 s et REMPLACE l'app pendant ce temps : tant
// qu'il est là, rien n'est cliquable et les modales du premier lancement ne
// sont même pas montées. Un clic tombé dans cette fenêtre ne fait rien, sans
// erreur — c'est ce qui rendait le tutoriel impossible à atteindre.
await page.waitForTimeout(3400);

// Le tutoriel vient APRÈS la bannière de bienvenue : il faut la passer.
// Les invites du jour (devinette, installation) se posent par-dessus l'accueil
// et masqueraient l'écran demandé.
// SAUF sur le tableau de bord : là, l'invite ne doit pas s'ouvrir du tout, et
// l'écarter ici masquerait précisément ce qu'on veut vérifier. C'est ce qui s'est
// passé au premier essai — le contrôle passait au vert sans rien prouver.
if (!ecran.startsWith("tracking")) {
  // Les six langues : sous LANGUE=de, « Plus tard » n'existe plus et le bouton
  // « Später » restait devant l'écran, interceptant tous les clics suivants.
  for (const libelle of [/plus tard|maybe later|later|später|più tardi|depois|más tarde/i,
                         /^(fermer|close|schließen|chiudi|fechar|cerrar)$/i]) {
    const b = page.getByRole("button", { name: libelle }).first();
    if (await b.count() && await b.isVisible().catch(() => false)) {
      await b.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

// L'écran Amis n'a pas la même porte selon la largeur : sur téléphone c'est le
// bouton de l'accueil, sur un écran large c'est la carte « Mes amis » de la
// landing desktop, qui monte LePont avec ?friends=1. Passer directement par ce
// paramètre ne marche pas sur téléphone : il attend la confirmation du pseudo,
// qui n'est pas encore arrivée au chargement, et on photographiait l'accueil.
if (ecran.startsWith("amis")) {
  const porte = LARGEUR >= 768
    ? page.getByText(/^MES AMIS$/i).first()
    // Le compteur de demandes reçues s'ajoute au nom accessible du bouton
    // (« 👥 Amis 1 ») : un libellé ancré à la fin ne le trouve plus.
    : page.getByRole("button", { name:/^(👥 )?Amis\b/i }).first();
  if (await porte.count()) {
    // scrollIntoViewIfNeeded d'abord : le bouton de l'accueil est sous la ligne
    // de flottaison, et un clic direct attend qu'il soit « stable » sans jamais
    // l'amener dans la vue.
    await porte.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await porte.click({ force:true });
    await page.waitForTimeout(2600);
  } else console.warn("porte de l'écran Amis introuvable");
  if (ecran === "amis-defis") {
    await page.getByRole("button", { name:/historique des d/i }).first().click();
    await page.waitForTimeout(1600);
  }
}

// Chaque écran est une suite de clics depuis l'accueil. Un écran atteint par
// un chemin plus tortueux n'a pas sa place ici : mieux vaut l'ajouter le jour
// où on en a besoin que maintenir une recette qui ne sert pas.
const CHEMINS = {
  accueil:    [],
  classement: [/classement|leaderboard|rangliste|classifica|ranking|clasificación/i],
  amis:       [],   // porte propre à la largeur, cf. plus bas
  // L'écran voisin, atteint depuis la liste d'amis.
  "amis-defis":  [],   // « Historique des défis »
  "amis-bas":    [],   // le bas de la liste, où vivent les demandes envoyées
  devinette:  [/devinette du jour|daily riddle|rätsel des tages|indovinello del giorno|adivinha do dia|adivinanza del día/i],
  profil:     [],   // l'avatar n'est pas un bouton : traité à part
  jeu:        [],   // la carte du carrousel non plus
  "classement-bas": [/classement|leaderboard|rangliste|classifica|ranking|clasificación/i],   // puis défilé jusqu'en bas
  "hall-of-fame": [/classement|leaderboard|rangliste|classifica|ranking|clasificación/i, /hall of fame/i],
  bienvenue:  [],   // premier lancement : la bannière RGPD
  tutoriel:   [],   // premier lancement : le carrousel, après la bannière
  partie:     [],   // idem, puis « Jouer solo »
  collection: [],   // via le profil, puis le bloc des cartes
  compte:     [],   // via le profil, puis « Mon compte »
  "partie-fin": [], // une partie solo, puis on passe jusqu'a la fin de manche
  "partie-faux": [], // une partie solo, puis une reponse fausse : le bandeau
  "mercato-faux": [], // The Mercato, puis une reponse fausse
  "mercato-juste": [], // The Mercato, puis une VRAIE bonne reponse : le bandeau
  // `mercato-fin` : The Mercato joue POUR DE VRAI (bonnes reponses), puis on
  // laisse le chronometre s'epuiser. C'est le seul moyen d'atteindre l'ecran de
  // fin avec un score > 0 — celui qui porte le bouton « defier les autres ».
  "mercato-fin": [],
};
// Les six modes du carrousel de l'accueil, dans leur ordre de la table
// homeCards. On selectionne la pastille correspondante avant de taper la
// carte : c'est le seul moyen d'ouvrir un mode qui n'est pas celui affiche.
const MODES_CARROUSEL = ["duel", "grid", "mercato", "plug", "guess", "goatgrid"];
for (const m of MODES_CARROUSEL) CHEMINS["mode-" + m] = [];
// `partie-plug` couvre le démarrage de The Plug en solo : c'est le chemin qui
// passait à côté de startCompetition(), donc à côté du comptage.
CHEMINS["partie-plug"] = [];
// Le tableau de bord de suivi n'est pas dans l'app : il s'ouvre par ?stats=CODE,
// et ses rubriques sont des onglets. LARGEUR=1280 donne la version PC.
for (const r of ["resume", "audience", "modes", "joueurs", "comptes"]) CHEMINS["tracking-" + r] = [];
CHEMINS["tracking"] = [];
// `tracking-filtre` sert à vérifier le CÂBLAGE des filtres : les tests couvrent
// le calcul, pas le fait qu'un menu déroulant atteigne bien l'agrégation.
CHEMINS["tracking-filtre"] = [];
// `battle-manches` ne photographie pas une mise en page : il JOUE GOAT Battle en
// solo et relève la paire de clubs posée à chaque manche. C'est la seule
// vérification de bout en bout du tirage anti-répétition — les tests couvrent la
// règle, l'audit la simule, mais aucun des deux ne prouve que le vrai écran
// enchaîne des manches différentes.
CHEMINS["battle-manches"] = [];
// `duel-fin` photographie l'écran de résultat d'un défi (VICTOIRE / ÉGALITÉ /
// DÉFAITE, les deux scores côte à côte). À lancer avec DEFI=1.
CHEMINS["duel-fin"] = [];
// `battle-clavier` rejoue le défaut du clavier : l'overlay doit continuer à
// couvrir l'écran même quand la zone jouable se recale sur la fenêtre visible.
CHEMINS["battle-clavier"] = [];
// `grille` photographie GOAT GRID en jeu — le plateau 3×3, ses en-têtes de
// critères et ses cases vides. LARGEUR=1280 pour le rendu PC.
CHEMINS["grille"] = [];
// `grille-remplie` va plus loin : il REMPLIT les neuf cases, pour photographier
// l'état qu'on ne voit pas autrement — les cases trouvées, dont la teinte dit la
// rareté du joueur. Le mode démo (cinq tapes sur le titre) affiche les réponses,
// on les lui emprunte.
CHEMINS["grille-remplie"] = [];
CHEMINS["grille-fin"] = [];
// `grille-saisie` ouvre la modale « QUI MATCHE ? » — l'écran où l'on tape sa
// réponse. Avec SAISIE=refus, il tape un nom faux d'abord, pour photographier
// aussi le champ en erreur et le panneau « je suis sûr que ça devrait passer ».
CHEMINS["grille-saisie"] = [];
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
    ? page.locator("div").filter({ hasText: /^\d+\s*\/\s*\d+\s*(cartes|cards|Karten|carte|cartas)/ }).last()
    : page.getByRole("button", { name: /mon compte|my account|mein konto|il mio account|minha conta|mi cuenta/i }).first();
  await cible.scrollIntoViewIfNeeded();
  await cible.click();
  await page.waitForTimeout(1600);
}

// Un mode precis du carrousel : pastille, puis carte.
if (ecran.startsWith("mode-") || ecran.startsWith("mercato-") || ecran === "partie-plug") {
  const i = ecran.startsWith("mercato-") ? MODES_CARROUSEL.indexOf("mercato")
          : ecran === "partie-plug"      ? MODES_CARROUSEL.indexOf("plug")
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
if (ecran === "partie" || ecran === "partie-fin" || ecran === "partie-faux"
    || ecran === "partie-plug" || ecran.startsWith("mercato-")) {
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
// Repond juste UNE fois dans The Mercato : lit le joueur affiche et lui donne un
// de ses clubs, pris dans players.jsx — la meme source que le jeu.
async function repondJuste() {
  const nom = (await page.locator("text=/DONNE UN CLUB DE/i").first()
    .locator("xpath=..").innerText()).split("\n").pop().trim();
  const base = await readFile(join(ici, "..", "src", "players.jsx"), "utf8");
  const ligne = base.split("\n").find((l) => l.includes('name:"' + nom + '"'));
  const clubs = ligne ? [...ligne.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  const club = clubs.find((c) => c !== nom && !["facile", "moyen", "expert"].includes(c));
  if (!club) { console.warn("aucun club trouve pour", nom); return false; }
  console.log("joueur affiche :", nom, "→ on repond", club);
  await page.locator("input[type='text'], input:not([type])").first().fill(club);
  const bv = await page.getByRole("button", { name: /^\s*valider\s*$/i }).first().boundingBox();
  if (bv) await page.mouse.click(bv.x + bv.width / 2, bv.y + bv.height / 2);
  return true;
}

if (ecran === "mercato-juste") {
  await repondJuste();
  await page.locator("text=/\\+\\d+ pts/").first()
    .waitFor({ state: "visible", timeout: 4000 })
    .catch(() => console.warn("bandeau non attrape"));
}

if (ecran === "mercato-fin") {
  // Trois bonnes reponses suffisent a poser un score, puis on laisse tomber le
  // chronometre (90 s) : passer les questions ne l'epuise pas.
  for (let k = 0; k < 3; k++) {
    const ok = await repondJuste().catch(() => false);
    if (!ok) break;
    await page.waitForTimeout(1200);
  }
  console.log("on laisse le chronometre s'epuiser…");
  const limite = 110000, pas = 5000;
  for (let attendu = 0; attendu < limite; attendu += pas) {
    await page.waitForTimeout(pas);
    const fini = await page.getByRole("button", { name: /rejouer|accueil/i }).first()
      .isVisible().catch(() => false);
    if (fini) { console.log("ecran de fin atteint apres", (attendu + pas) / 1000, "s"); break; }
  }
  await page.waitForTimeout(1200);
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

if (ecran === "grille" || ecran === "grille-remplie" || ecran === "grille-fin" || ecran === "grille-saisie") {
  // GOAT GRID en jeu. Deux chemins, parce que l'accueil n'est pas le même :
  // sur mobile un carrousel de cartes, sur ordinateur une liste de modes à
  // gauche puis un bouton JOUER. Sans la branche PC, l'aperçu restait sur la
  // page d'accueil et photographiait la landing — ce qui s'est produit au
  // premier essai.
  if (LARGEUR > 900) {
    await page.getByText(/^GOAT Grid$/).first().click();
    await page.waitForTimeout(900);
    // « JOUER » tout court attrape le lien de la barre de NAVIGATION, qui porte
    // le même mot. Le grand bouton de lancement porte un ▶ : on s'y accroche.
    await page.getByRole("button", { name:/▶\s*JOUER/i }).first().click();
    await page.waitForTimeout(2600);
  } else {
  const pastilles = page.locator("div[style*='border-radius: 5px'][style*='cursor: pointer']");
  const i = MODES_CARROUSEL.indexOf("goatgrid");
  if (await pastilles.count() > i) { await pastilles.nth(i).click(); await page.waitForTimeout(900); }
  const carte = await page.locator("img[src*='-card']").first().boundingBox();
  if (!carte) { console.error("carte du carrousel introuvable"); process.exit(1); }
  await page.mouse.click(carte.x + carte.width / 2, carte.y + carte.height / 2);
  await page.waitForTimeout(2200);
  }
  const solo = page.locator("div").filter({ hasText: /^(Défi du jour|Daily challenge|Tägliche Challenge|Sfida del giorno|Desafio do dia|Reto del día)/ }).first();
  const cible = (await solo.count()) ? solo : page.getByText(/^SOLO$/).first();
  await cible.scrollIntoViewIfNeeded().catch(() => {});
  await cible.click({ force:true }).catch(() => {});
  await page.waitForTimeout(2600);
}

if (ecran === "grille-remplie" || ecran === "grille-fin") {
  // Cinq tapes sur le titre ouvrent le mode démo, qui liste une réponse par case.
  const titre = page.getByText(/^GOAT GRID$/).first();
  for (let k = 0; k < 5; k++) { await titre.click({ force:true }); await page.waitForTimeout(120); }
  await page.waitForTimeout(900);
  const reponses = await page.evaluate(() => {
    const lignes = [...document.querySelectorAll("div")].filter(d =>
      /MODE DÉMO — réponses/.test(d.textContent || "") && d.children.length <= 3);
    const bloc = lignes[lignes.length - 1];
    if (!bloc) return [];
    const liste = bloc.parentElement;
    return [...liste.querySelectorAll("div > div > span:last-child")]
      .map(s => (s.textContent || "").trim()).filter(Boolean);
  });
  console.log("réponses du mode démo :", reponses.length, reponses.slice(0, 3).join(" · ") + "…");
  // Les cases vides portent le « + ». On les prend une par une : chaque réponse
  // trouvée en retire une de la liste, donc on relit à chaque tour.
  for (const nom of reponses) {
    const vides = page.locator("div").filter({ hasText: /^\+$/ });
    if (await vides.count() === 0) break;
    await vides.first().click({ force:true }).catch(() => {});
    await page.waitForTimeout(700);
    // Le champ de la modale porte son invite : on le cible par le placeholder
    // plutôt que par sa position, et on FRAPPE les touches — un `fill` direct ne
    // déclenche pas l'autocomplétion, qui écoute la saisie.
    const champ = page.locator("input[placeholder*='lettres'], input[placeholder*='letters'], input[placeholder*='Buchstaben'], input[placeholder*='lettere'], input[placeholder*='letras']").first();
    if (!(await champ.count())) break;
    await champ.click({ force:true }).catch(() => {});
    await champ.pressSequentially(nom, { delay: 25 });
    await page.waitForTimeout(1000);
    // La suggestion se touche : on prend le premier bouton qui porte le nom.
    const sugg = page.getByRole("button", { name:new RegExp(nom.split(" ").pop(), "i") }).first();
    if (await sugg.count()) { await sugg.click({ force:true }).catch(() => {}); }
    await page.waitForTimeout(400);
    const valider = page.getByRole("button", { name:/^(VALIDER|VALIDATE|BESTÄTIGEN|CONVALIDA|VALIDAR)$/i }).first();
    if (await valider.count()) { await valider.click({ force:true }).catch(() => {}); }
    await page.waitForTimeout(1200);
  }
  // La grille terminée ouvre son écran de fin, qui recouvre le plateau. On garde
  // les deux : `grille-fin` photographie la modale, `grille-remplie` la referme
  // sur les neuf cases trouvées avec « REVOIR MA GRILLE ».
  if (ecran !== "grille-fin") {
    const revoir = page.getByRole("button", { name:/revoir ma grille|review my grid|raster ansehen|rivedi la griglia|ver minha grade|ver mi cuadr/i }).first();
    if (await revoir.count()) { await revoir.click({ force:true }).catch(() => {}); }
  }
  await page.waitForTimeout(1600);
  if (ecran === "grille-fin") {
    // La question posée : est-ce que ça TIENT sur une page ? On mesure la carte
    // contre la fenêtre, et on regarde si l'enveloppe a de quoi défiler.
    const m = await page.evaluate(() => {
      const enveloppe = [...document.querySelectorAll("div")].find(d => {
        const st = getComputedStyle(d);
        return st.position === "fixed" && st.zIndex === "500" && d.querySelector("video");
      });
      if (!enveloppe) return null;
      const carte = enveloppe.firstElementChild;
      return { fenetre: window.innerHeight,
               carte: Math.round(carte.getBoundingClientRect().height),
               defile: enveloppe.scrollHeight - enveloppe.clientHeight,
               boutons: enveloppe.querySelectorAll("button").length };
    });
    if (!m) console.log("carte de fin introuvable");
    else console.log(`carte ${m.carte} px dans une fenêtre de ${m.fenetre} px · `
      + `${m.boutons} boutons · débordement ${m.defile} px `
      + (m.defile <= 0 ? "✅ tient sur une page" : "⚠️ il faut défiler"));
  }
}

if (ecran === "grille-saisie") {
  // Une case vide porte le « + » : on l'ouvre.
  const vides = page.locator("div").filter({ hasText: /^\+$/ });
  if (await vides.count()) { await vides.first().click({ force:true }).catch(() => {}); }
  await page.waitForTimeout(900);
  const champ = page.locator("input[placeholder*='lettres'], input[placeholder*='letters'], input[placeholder*='Buchstaben'], input[placeholder*='lettere'], input[placeholder*='letras']").first();
  if (await champ.count()) {
    await champ.click({ force:true }).catch(() => {});
    // SAISIE=refus : un nom volontairement faux, validé, pour obtenir l'état
    // d'erreur et le panneau de signalement. Sinon on tape de quoi faire
    // apparaître la liste de suggestions.
    if (process.env.SAISIE === "refus") {
      await champ.pressSequentially("Zinedine Zidane", { delay: 25 });
      await page.waitForTimeout(900);
      const valider = page.getByRole("button", { name:/^(VALIDER|VALIDATE|BESTÄTIGEN|CONVALIDA|VALIDAR)$/i }).first();
      if (await valider.count()) { await valider.click({ force:true }).catch(() => {}); }
      await page.waitForTimeout(1600);
    } else {
      await champ.pressSequentially("mar", { delay: 40 });
      await page.waitForTimeout(1200);
    }
  }
  await page.waitForTimeout(800);
}

if (ecran === "battle-clavier") {
  // Reproduit le défaut signalé : GOAT Battle lancé, clavier « ouvert », et
  // l'accueil qui réapparaissait sous l'overlay. On ne peut pas ouvrir un vrai
  // clavier logiciel dans un navigateur de test, donc on force la condition que
  // l'app observe — un écart de plus de 120 px entre window.innerHeight et
  // visualViewport.height, ET un champ de saisie focalisé.
  const pastilles = page.locator("div[style*='border-radius: 5px'][style*='cursor: pointer']");
  if (await pastilles.count() > 0) { await pastilles.nth(0).click(); await page.waitForTimeout(900); }
  const carte = await page.locator("img[src*='-card']").first().boundingBox();
  if (!carte) { console.error("carte du carrousel introuvable"); process.exit(1); }
  await page.mouse.click(carte.x + carte.width / 2, carte.y + carte.height / 2);
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name:/jouer solo/i }).first().click();
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    // innerHeight gonflé + visualViewport rétréci = ce que voit l'app quand le
    // clavier occupe le bas de l'écran.
    Object.defineProperty(window, "innerHeight", { value: 932, configurable: true });
    const vv = window.visualViewport;
    Object.defineProperty(vv, "height", { value: 420, configurable: true });
    Object.defineProperty(vv, "offsetTop", { value: 0, configurable: true });
    const champ = document.querySelector("input");
    if (champ) champ.focus();
    vv.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(1200);
  // Y a-t-il du contenu de l'ACCUEIL réellement ATTEIGNABLE à l'écran ? La
  // question n'est pas « existe-t-il dans le DOM » — l'accueil reste monté sous
  // l'overlay, c'est normal — mais « est-il le dessus au point où il s'affiche ».
  // On le demande donc à elementFromPoint, qui répond exactement ça.
  const fuite = await page.evaluate(() => {
    const cibles = [...document.querySelectorAll("button")].filter(e =>
      /Défis ouverts|Classement|Rejoindre/i.test(e.textContent || ""));
    const dehors = [];
    for (const e of cibles) {
      const r = e.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) continue;
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      if (y < 0 || y > window.innerHeight - 1) continue;   // hors écran : pas une fuite
      const dessus = document.elementFromPoint(x, y);
      // Fuite si l'élément d'accueil EST le dessus (ou contient ce qui l'est) :
      // rien de l'overlay ne s'interpose alors entre lui et le doigt.
      if (dessus && (dessus === e || e.contains(dessus))) {
        dehors.push((e.textContent || "").trim().slice(0, 40));
      }
    }
    return dehors;
  });
  console.log(fuite.length === 0
    ? "✅ aucun élément de l'accueil visible sous l'overlay"
    : "⚠️  éléments d'accueil dans la zone visible : " + JSON.stringify(fuite));
}

if (ecran === "duel-fin") {
  // Le bouton porte parfois une pastille de compteur dans son nom accessible.
  await page.getByRole("button", { name:/défis ouverts/i }).first().click();
  await page.waitForTimeout(1800);
  // La carte du défi de sjdrums : on clique le bouton qui lance la tentative.
  const relever = page.getByRole("button", { name:/relever|battre|jouer|290/i }).first();
  if (await relever.count()) {
    await relever.scrollIntoViewIfNeeded();
    await relever.click({ force:true });
  } else {
    console.warn("bouton de défi introuvable — capture de la liste");
  }
  await page.waitForTimeout(2500);
  // La partie dure ROUND_DURATION = 90 s. On répond juste assez pour finir avec
  // un score, puis on laisse le chrono tomber : c'est l'écran de FIN qu'on veut.
  for (let i = 0; i < 6; i++) {
    const opts = page.locator("button").filter({ hasText: /^[A-ZÀ-Ü][\w' .-]+$/ });
    if (await opts.count() > 1) { await opts.nth(1).click().catch(() => {}); }
    await page.waitForTimeout(1200);
  }
  const limite = 120000, pas = 5000;
  let attendu = 0;
  while (attendu < limite) {
    await page.waitForTimeout(pas);
    attendu += pas;
    const fini = await page.getByRole("button", { name:/retour à l'accueil/i }).first()
      .isVisible().catch(() => false);
    if (fini) { console.log("écran de résultat atteint après", attendu / 1000, "s"); break; }
  }
  await page.waitForTimeout(1200);
}

if (ecran === "battle-manches") {
  // Pastille 0 du carrousel = GOAT Battle (« duel » dans MODES_CARROUSEL).
  const pastilles = page.locator("div[style*='border-radius: 5px'][style*='cursor: pointer']");
  if (await pastilles.count() > 0) { await pastilles.nth(0).click(); await page.waitForTimeout(900); }
  const carte = await page.locator("img[src*='-card']").first().boundingBox();
  if (!carte) { console.error("carte du carrousel introuvable"); process.exit(1); }
  await page.mouse.click(carte.x + carte.width / 2, carte.y + carte.height / 2);
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name:/jouer solo/i }).first().click();

  // Les deux cartes de club sont les seuls blocs à clipPath en polygone de
  // l'écran ; on lit leur texte. Il faut attendre l'arrêt des rouleaux, sinon on
  // relève un club de l'animation « machine à sous » et non la question posée.
  const paires = [];
  const passer = page.getByRole("button", { name:/passer \(je ne sais pas\)/i }).first();
  for (let manche = 0; manche < 14; manche++) {
    await page.waitForTimeout(1500); // DUEL_SOLO_SPIN_MS = 1000, plus la marge
    const clubs = await page.locator("div[style*='clip-path'] , span").evaluateAll(() => {
      const cartes = [...document.querySelectorAll("div")].filter(d => {
        const st = d.getAttribute("style") || "";
        return st.includes("clip-path: polygon(30%");
      });
      return cartes.map(c => (c.parentElement?.innerText || "").trim()).filter(Boolean);
    });
    if (clubs.length < 2) { console.warn("manche", manche + 1, ": cartes de club illisibles"); break; }
    paires.push([clubs[0], clubs[1]].sort().join(" / "));
    if (!(await passer.isVisible().catch(() => false))) break;
    await passer.click();
  }
  const uniques = new Set(paires);
  console.log("manches relevées :", paires.length);
  for (const p of paires) console.log("   ", p);
  console.log(uniques.size === paires.length
    ? "✅ aucune paire posée deux fois dans la partie"
    : "❌ " + (paires.length - uniques.size) + " paire(s) reposée(s) dans la MÊME partie");
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
// Ouvrir le tableau de bord n'est pas jouer : le pop-up de la devinette du jour
// se déclenchait 1,4 s après le montage sans regarder l'URL. On laisse passer ce
// délai puis on vérifie qu'aucun overlay de jeu n'est apparu.
if (ecran.startsWith("tracking")) {
  await page.waitForTimeout(3000);
  // On cherche l'OVERLAY, pas le texte : l'accueil reste monté sous le tableau de
  // bord et sa barre porte elle aussi les mots « Devinette du jour ». Le pop-up,
  // lui, est un calque position:fixed à zIndex 400 — et les overlays de jeu
  // (GOAT Guess, Trouve le joueur) sont des plein-écrans montés par Index.
  const parasites = await page.evaluate(() => {
    const vus = [];
    for (const e of document.querySelectorAll("div")) {
      const st = getComputedStyle(e);
      if (st.position !== "fixed") continue;
      const z = parseInt(st.zIndex, 10);
      // 400 à 9000 : au-dessus, c'est le tableau de bord lui-même (z 9999).
      if (!(z >= 400 && z < 9000)) continue;
      const r = e.getBoundingClientRect();
      if (r.width < window.innerWidth * 0.6 || r.height < window.innerHeight * 0.5) continue;
      vus.push("calque z=" + z + " : " + (e.textContent || "").trim().slice(0, 46));
    }
    return vus;
  });
  console.log(parasites.length === 0
    ? "✅ aucun pop-up de devinette sur le tableau de bord"
    : "⚠️ pop-up parasite : " + JSON.stringify(parasites));
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

// MESURE=1 : liste la géométrie des blocs de l'écran, pour savoir D'OÙ vient un
// écart au lieu de le deviner. Un vide de 50 px entre deux panneaux vient soit
// d'une marge, soit d'un padding, soit d'un espace élastique — et une capture ne
// le dit pas.
if (process.env.MESURE) {
  const blocs = await page.evaluate(() => {
    const dedans = (e) => {
      const r = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      return { t: Math.round(r.top), h: Math.round(r.height),
               mt: st.marginTop, mb: st.marginBottom, pt: st.paddingTop, pb: st.paddingBottom,
               flex: st.flex, quoi: (e.className || e.tagName).toString().slice(0, 28) };
    };
    // La coque est le premier enfant de #root qui remplit l'écran.
    const root = document.getElementById("root");
    const coque = [...root.querySelectorAll("div")].find(
      (e) => e.getBoundingClientRect().height > innerHeight * 0.8 && e.children.length > 1);
    if (!coque) return null;
    return [...coque.children].map(dedans);
  });
  if (!blocs) console.log("coque introuvable");
  else {
    console.log("géométrie des blocs (haut · hauteur · marges · paddings · flex) :");
    let bas = null;
    for (const b of blocs) {
      if (bas !== null && b.h > 0) console.log("        ↕ écart : " + (b.t - bas) + " px");
      if (b.h > 0) bas = b.t + b.h;
      console.log(`  ${String(b.t).padStart(4)} +${String(b.h).padStart(4)}  m ${b.mt}/${b.mb}  p ${b.pt}/${b.pb}  flex ${b.flex}  ${b.quoi}`);
    }
  }
}

// ENCOCHE=47 simule une zone de sécurité haute (valeur d'un iPhone à encoche).
//
// Pourquoi c'est nécessaire : dans un navigateur d'ordinateur,
// `env(safe-area-inset-top)` vaut TOUJOURS 0. Toute la couche « zone de
// sécurité » de l'app — le décalage de #root, la remontée du bandeau
// d'en-tête, le voile derrière la barre d'état — était donc invisible sur
// chaque aperçu, et n'a jamais pu être vérifiée autrement que sur un vrai
// téléphone. C'est exactement là qu'un défaut s'est logé.
//
// On surcharge les deux règles qui en dépendent, APRÈS le rendu : l'app
// réinjecte sa feuille de style au chargement, un style posé plus tôt
// disparaîtrait.
const ENCOCHE = Number(process.env.ENCOCHE || 0);
if (ENCOCHE > 0) {
  await page.evaluate((h) => {
    const s = document.createElement("style");
    s.textContent = "#root{padding-top:" + h + "px !important}"
      + "body::before{height:" + h + "px !important}";
    document.head.appendChild(s);
  }, ENCOCHE);
  await page.waitForTimeout(300);
  const voile = await page.evaluate(() => {
    const st = getComputedStyle(document.body, "::before");
    return { hauteur: st.height, z: st.zIndex };
  });
  console.log("encoche simulée : " + ENCOCHE + " px — voile de barre d'état " + voile.hauteur + " (z " + voile.z + ")");
}

const suffixe = LARGEUR > 900 ? "-pc" : "";
const chemin = join(ici, "..", "apercu-" + ecran + suffixe + (ENCOCHE > 0 ? "-encoche" : "") + ".png");
await page.screenshot({ path:chemin, fullPage:false });
console.log("écrit", chemin);
await navigateur.close();
serveur.close();
