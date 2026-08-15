#!/usr/bin/env node
// LES TROIS POSTS DU CONCOURS — format de fil Instagram, 1080 × 1350.
//
//     npm run posts
//
// Sortie : visuels/annonces/posts/1-le-podium.png … 3-pour-gagner.png
//
// ── POURQUOI TROIS, ET POURQUOI CE FORMAT ─────────────────────────────────
//
// Le carrousel de neuf diapositives part en story à la une : il a le temps
// d'expliquer. Un post de fil, non — il se lit en deux secondes, dans une
// colonne où tout défile. Trois posts, une idée chacun, dans l'ordre où la
// question se pose : qu'est-ce que je gagne → à quoi je joue → qu'est-ce que
// je dois faire.
//
// 1080 × 1350, soit du 4:5. C'est le format le plus HAUT que le fil accepte
// sans recadrer nulle part. Instagram sait afficher plus haut depuis qu'il a
// aligné le fil sur le vertical, mais le 4:5 est le seul dont on soit certain
// qu'il traverse la grille du profil, le fil et le partage sans perdre un
// morceau — et un visuel de concours amputé, ce sont des mentions qui sautent.
//
// PAS DE ZONE RÉSERVÉE ICI, contrairement au carrousel. Dans le fil, le pseudo
// et la légende se posent SOUS l'image, jamais dessus. Toute la toile est
// utilisable, et lui appliquer les marges des stories l'amputerait pour un
// recouvrement qui n'existe pas.
//
// ── CE QUI EST ÉCRIT ICI EST VÉRIFIÉ ──────────────────────────────────────
//
// Contenu de l'édition Ultimate : page officielle d'Electronic Arts. Les bonus
// de précommande (clos le 31 août) et les jours d'accès anticipé (avant la
// sortie du 25 septembre) en sont ÉCARTÉS — le gagnant reçoit son lot en
// octobre, les annoncer serait promettre ce qu'il ne recevra pas.
//
// Mécanique du classement : docs/supabase-classement.sql, la fonction qui
// calcule vraiment.
//
// Conditions de participation : article 5.1 du règlement. Elles sont sur le
// POST et pas seulement dans la légende, parce qu'une image se partage seule et
// qu'un joueur qui découvre la condition au moment de réclamer se sent piégé.

import { chromium } from "playwright";
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const lancer = promisify(execFile);

// La charte, lue à la source : charte.jsx crée un élément JSX au niveau du
// module, donc l'importer depuis Node réclamerait React. Recopier ses valeurs à
// la main serait le meilleur moyen de les voir diverger au premier ajustement.
const source = await readFile(join(racine, "src", "lib", "charte.jsx"), "utf8");
function jeton(nom) {
  const m = source.match(new RegExp(nom + ':\\s*"(#[0-9A-Fa-f]{3,8})"'));
  if (!m) throw new Error("jeton de charte introuvable : " + nom);
  return m[1];
}
const G = {
  encre: jeton("encre"), or: jeton("or"), orSombre: jeton("orSombre"),
  creme: jeton("creme"), nuit: jeton("nuit"), maillot: jeton("maillot"),
};

const b64 = (buf, type) => "data:" + type + ";base64," + buf.toString("base64");
const anton = b64(await readFile(join(ici, "polices", "anton-latin.woff2")), "font/woff2");
// Bebas Neue est LA police de l'app : G.font et G.heading la désignent tous les
// deux. Anton ne sert qu'au lettrage d'affiche (G.poster).
const bebas = b64(await readFile(join(ici, "polices", "bebas-neue-latin.woff2")), "font/woff2");
const motSymbole = b64(await readFile(join(racine, "public", "logo-mot.webp")), "image/webp");

async function peutEtreLu(chemin, type) {
  try { return b64(await readFile(chemin), type); } catch (e) { return null; }
}
// Image de TIERS, déposée à la main et tenue hors du dépôt, qui est public.
const artLot = await peutEtreLu(join(racine, "visuels", "bruts", "fc27.jpeg"), "image/jpeg");
// Illustration de l'app : aucun footballeur réel n'y figure, contrairement aux
// cartes de collection. Publiable sans réserve.
const artDuel = await peutEtreLu(join(racine, "visuels", "bruts", "duel.png"), "image/png");
const capPlug = await peutEtreLu(join(racine, "visuels", "captures", "plug-cadre.png"), "image/png");
const capDev = await peutEtreLu(join(racine, "visuels", "captures", "devinette-cadre.png"), "image/png");

const COMPTE_IG = "@goatfc_app";

const ECHELLE = 2;
const L = 540, H = 675;   // → 1080 × 1350

const lignes = (couleur, ep, pas) => `repeating-conic-gradient(from 0deg at 50% 30%,
  ${couleur} 0deg ${ep}deg, transparent ${ep}deg ${pas}deg)`;

const decorOr = `
  <div class="c" style="background:radial-gradient(120% 80% at 50% 26%,
    rgba(245,194,43,.96) 0 34%, rgba(217,162,26,.55) 100%), ${G.or}"></div>
  <div class="c" style="inset:-25%;background:${lignes("rgba(8,17,9,.42)", .55, 2.7)}"></div>
  <div class="c" style="background:radial-gradient(circle at 50% 30%,
    ${G.or} 0 18%, rgba(245,194,43,.92) 30%, rgba(245,194,43,0) 60%)"></div>
  <div class="c" style="opacity:.5;background-size:7px 7px;
    background-image:radial-gradient(circle, ${G.orSombre} 1.4px, transparent 1.7px)"></div>`;

const MENTIONS = "Concours de connaissances sans obligation d'achat · Règlement complet sur "
  + "goatfc.fr/reglement · Jeu non sponsorisé, administré ni associé à Instagram ou TikTok";
const MENTIONS_EA = " · EA SPORTS FC 27 est une marque d'Electronic Arts Inc., qui n'est ni "
  + "organisateur, ni sponsor, ni partenaire de ce concours. Visuel du jeu à titre d'illustration.";

// ── LES TROIS POSTS ────────────────────────────────────────────────────────
const POSTS = [
  {
    fichier: "1-le-podium",
    // L'illustration manga en fond : elle dit « affrontement » sans une ligne
    // de texte, ce qui est le sujet même d'un podium.
    fond: "duel",
    surligne: "HALL OF FAME · SEPTEMBRE 2026",
    titre: ["LE PODIUM", "DE SEPTEMBRE"],
    artwork: true,
    podium: [
      ["🥇", "1ᵉʳ", "EA SPORTS FC 27 édition Ultimate", "109,99 € · plateforme de ton choix"],
      ["🥈", "2ᵉ", "Carte cadeau de 50 €", "enseigne de ton choix"],
      ["🥉", "3ᵉ", "Carte cadeau de 30 €", "enseigne de ton choix"],
    ],
    mentionsEA: true,
  },
  {
    fichier: "2-le-jeu",
    surligne: "SIX MODES · ZÉRO INSTALLATION",
    titre: ["TOUT LE MONDE", "PART À ZÉRO LE 1ER"],
    captures: [
      [capPlug, "Le joueur qui relie deux clubs"],
      [capDev, "Le parcours à reconstituer"],
    ],
    // UNE ligne, pas un panneau de trois règles. Le premier jet en portait
    // trois : le contrôle de débordement l'a refusé, et il avait raison — deux
    // captures plus un panneau ne tiennent pas en 4:5. Un post de fil se lit en
    // deux secondes ; le détail de la mécanique vit dans le carrousel et dans
    // le règlement, qui sont faits pour ça.
    pied: "Ton <b>meilleur score du jour</b> compte dans chaque mode, et tout "
        + "s'additionne sur le mois. Rejouer vingt fois ne sert à rien : "
        + "<b>c'est la régularité qui gagne</b>.",
  },
  {
    fichier: "3-pour-gagner",
    surligne: "SANS OBLIGATION D'ACHAT",
    titre: ["POUR GAGNER,", "QUATRE GESTES"],
    // LE post qui compte. Les conditions sur l'image et pas seulement dans la
    // légende : une image se partage seule, et une condition découverte au
    // moment de réclamer se lit comme un piège.
    conditions: [
      ["Joue sur goatfc.fr", "gratuit, rien à installer"],
      ["Abonne-toi à " + COMPTE_IG, "sur Instagram"],
      ["Identifie 2 amis", "en commentaire de ce post"],
      ["Partage ce post en story", "et laisse-la en ligne"],
    ],
    pied: "Du 1ᵉʳ au 30 septembre, heure de Paris. Le classement décide de "
        + "<b>l'ordre</b> ; les trois gestes Instagram sont vérifiés <b>à la remise</b>.",
  },
];

function page(p) {
  // La bande d'or tient le lettrage, la bande de nuit tient le contenu. En 4:5
  // la hauteur est comptée : la bande d'or prend juste ce qu'il faut au
  // mot-symbole, à la surligne et au titre.
  const bandeau = p.artwork ? 68 : 66;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Anton';src:url(${anton}) format('woff2');font-display:block}
  @font-face{font-family:'Bebas Neue';src:url(${bebas}) format('woff2');font-display:block}
  *{margin:0;padding:0;box-sizing:border-box}
  .c{position:absolute;inset:0}
  body{width:${L}px;height:${H}px;overflow:hidden;position:relative;background:${G.or};
    font-family:'Anton',Impact,sans-serif;-webkit-font-smoothing:antialiased}
  .haut{position:absolute;left:0;right:0;top:0;height:${100 - bandeau}%;overflow:hidden}
  .contenuHaut{position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:8px;padding:22px 30px 16px}
  .mot{width:132px;height:auto;display:block}
  .surligne{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:16px;letter-spacing:3.2px;color:${G.encre};text-transform:uppercase;
    text-align:center}
  /* L'ordre de peinture est indispensable : par défaut le contour est peint
     PAR-DESSUS la lettre et lui ronge l'intérieur — à cette épaisseur, les
     contre-formes du A et du O se bouchent complètement. */
  .titre span{display:block}
  .titre{font-size:46px;line-height:.95;letter-spacing:.5px;color:${G.creme};
    transform:skewX(-7deg);-webkit-text-stroke:6px ${G.encre};
    paint-order:stroke fill;text-shadow:6px 6px 0 ${G.encre};
    text-align:center;text-wrap:balance}
  .bas{position:absolute;left:0;right:0;bottom:0;height:${bandeau}%;background:${G.nuit};
    box-shadow:inset 0 9px 0 ${G.encre};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:12px;padding:20px 30px 16px}
  /* L'illustration derrière le lettrage, atténuée : à pleine opacité elle mange
     le titre, qui est ce qu'on doit lire en premier. Le dégradé la fond dans la
     bande de nuit au lieu de la couper net. */
  .fondArt{position:absolute;inset:0;overflow:hidden}
  .fondArt img{width:100%;height:100%;object-fit:cover;object-position:center 30%;
    display:block;opacity:.9}
  .fondArt::after{content:"";position:absolute;inset:0;
    background:linear-gradient(to bottom, rgba(245,194,43,.12) 0%,
      rgba(245,194,43,.44) 55%, rgba(18,22,15,.85) 100%)}
  /* L'artwork du lot, cadré à la charte et non posé nu : encadré il se lit
     comme « le lot », posé nu il se lit comme le fond du visuel. */
  .cadreLot{flex:0 0 auto;width:100%;max-width:300px;border:4px solid ${G.encre};
    border-radius:12px;overflow:hidden;box-shadow:5px 5px 0 rgba(0,0,0,.55);line-height:0}
  .cadreLot img{width:100%;height:auto;display:block}
  /* ── LES LISTES : UN SEUL PANNEAU ─────────────────────────────────────
     Le motif de l'app, repris de sa feuille « Règles du jeu » : un panneau
     unique cerclé d'encre, ombre INTÉRIEURE, et des lignes séparées par un
     filet d'encre fin. Pas une boîte par ligne — un filet d'or empilé fait une
     grille de vignettes, vocabulaire du verre et pas de l'affiche. */
  /* flex-shrink:0 EST INDISPENSABLE, et ce n'est pas un réglage de confort.
     Dans un conteneur flex en colonne, un panneau se laisse écraser dès que le
     contenu déborde — et comme celui-ci porte overflow:hidden, il ROGNE son
     contenu en silence au lieu de déborder. Le contrôle de débordement ne voyait
     donc rien : le post 2 est sorti avec deux de ses trois règles invisibles,
     cachées derrière les mentions, et le script a dit « ✅ ».
     Avec flex-shrink:0, le panneau garde sa taille, déborde du bandeau, et le
     contrôle le signale. Un contrôle qu'on peut contourner sans le savoir est
     pire que pas de contrôle. */
  .cadre-liste{flex:0 0 auto;width:100%;max-width:452px;background:rgba(8,17,9,.5);
    border:3px solid ${G.encre};border-radius:16px;padding:0 14px;overflow:hidden;
    box-shadow:inset 3px 3px 0 rgba(8,17,9,.35)}
  .ligne{display:flex;align-items:flex-start;gap:11px;padding:9px 0;
    border-bottom:2px solid ${G.encre};
    font-family:'Bebas Neue',Impact,sans-serif;text-align:left}
  .ligne:last-child{border-bottom:none}
  /* Aplat d'or, RAYON FRANC et non cercle, cerclé d'encre : le cercle sans
     contour a été retiré de l'app, il appartenait à l'ancien vocabulaire. */
  .num{flex:0 0 auto;min-width:26px;height:26px;border-radius:8px;background:${G.or};
    color:${G.encre};font-family:'Anton',Impact,sans-serif;font-size:17px;
    display:flex;align-items:center;justify-content:center;
    border:2px solid ${G.encre};margin-top:1px}
  .titreLigne{font-weight:400;font-size:19px;letter-spacing:.4px;color:${G.or};line-height:1.24}
  .sousLigne{font-weight:400;font-size:15.5px;letter-spacing:.3px;
    color:rgba(242,231,206,.82);line-height:1.3;margin-top:1px}
  /* La 1re place se distingue par un APLAT D'OR sur sa ligne, pas par un cadre
     de plus : la hiérarchie se voit sans lire. */
  .ligne.or{background:${G.or};margin:0 -14px;padding-left:14px;padding-right:14px}
  .ligne.or .titreLigne{color:${G.encre}}
  .ligne.or .sousLigne{color:rgba(8,17,9,.72)}
  .ligne.or .rang{color:${G.encre}}
  .rang{flex:0 0 auto;font-family:'Anton',Impact,sans-serif;font-size:22px;
    transform:skewX(-7deg);min-width:29px;color:${G.or};line-height:1.1}
  .medaille{flex:0 0 auto;font-size:24px;line-height:1}
  /* Deux captures côte à côte, cadrées à la charte. Pas de coque de téléphone
     dessinée : une coque générique ajoute du chrome étranger à la charte. */
  .captures{flex:0 0 auto;display:flex;gap:12px;width:100%;max-width:420px;align-items:flex-start}
  .capture{flex:1 1 0;min-width:0}
  .capture .vue{width:100%;aspect-ratio:860 / 1180;overflow:hidden;
    border:3px solid ${G.encre};border-radius:13px;box-shadow:4px 4px 0 rgba(0,0,0,.55)}
  .capture .vue img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
  .capture .sous{margin-top:6px;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:13.5px;letter-spacing:.3px;line-height:1.2;color:rgba(242,231,206,.8);
    text-align:center}
  .pied{flex:0 0 auto;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:18px;
    letter-spacing:.4px;line-height:1.35;color:${G.creme};text-align:center;max-width:452px}
  .pied b{color:${G.or}}
  .mentions{flex:0 0 auto;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:11.5px;letter-spacing:.2px;line-height:1.3;color:rgba(240,233,214,.6);
    text-align:center;max-width:470px}
  .cadre{position:absolute;inset:0;box-shadow:inset 0 0 0 10px ${G.encre};
    pointer-events:none}
  </style></head><body>
    <div class="haut">
      ${p.fond === "duel" && artDuel
        ? `<div class="fondArt"><img src="${artDuel}" alt=""></div>` : decorOr}
      <div class="contenuHaut">
        <img class="mot" src="${motSymbole}" alt="GOAT FC">
        <div class="surligne">${p.surligne}</div>
        <div class="titre">${p.titre.map((l) => `<span>${l}</span>`).join("")}</div>
      </div>
    </div>
    <div class="bas">
      ${p.artwork && artLot
        ? `<div class="cadreLot"><img src="${artLot}" alt="EA SPORTS FC 27"></div>` : ""}
      ${p.podium ? `<div class="cadre-liste">${p.podium.map(([m, r, quoi, sous], i) =>
        `<div class="ligne${i === 0 ? " or" : ""}">
          <div class="medaille">${m}</div><div class="rang">${r}</div>
          <div><div class="titreLigne">${quoi}</div>
          <div class="sousLigne">${sous}</div></div></div>`).join("")}</div>` : ""}
      ${p.captures ? `<div class="captures">${p.captures.map(([img, sous]) =>
        img ? `<div class="capture"><div class="vue"><img src="${img}" alt=""></div>
                <div class="sous">${sous}</div></div>` : "").join("")}</div>` : ""}
      ${p.liste ? `<div class="cadre-liste">${p.liste.map(([t, sous], i) =>
        `<div class="ligne"><div class="num">${i + 1}</div>
          <div><div class="titreLigne">${t}</div>
          <div class="sousLigne">${sous}</div></div></div>`).join("")}</div>` : ""}
      ${p.conditions ? `<div class="cadre-liste">${p.conditions.map(([t, sous], i) =>
        `<div class="ligne"><div class="num">${i + 1}</div>
          <div><div class="titreLigne">${t}</div>
          <div class="sousLigne">${sous}</div></div></div>`).join("")}</div>` : ""}
      ${p.pied ? `<div class="pied">${p.pied}</div>` : ""}
      <div class="mentions">${MENTIONS}${p.mentionsEA ? MENTIONS_EA : ""}</div>
    </div>
    <div class="cadre"></div>
  </body></html>`;
}

/** Réduit le PNG à une palette : ce sont des aplats et des trames, pas des photos. */
async function alleger(chemin, couleurs) {
  const brut = chemin.replace(/\.png$/, ".brut.png");
  try {
    await writeFile(brut, await readFile(chemin));
    await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", brut,
      "-vf", `split[a][b];[a]palettegen=max_colors=${couleurs}:stats_mode=full[p];`
           + "[b][p]paletteuse=dither=none", chemin]);
    return true;
  } catch (e) { return false; } finally { await rm(brut, { force: true }); }
}

const sortie = join(racine, "visuels", "annonces", "posts");
await mkdir(sortie, { recursive: true });
// Les fichiers portent leur numéro d'ordre : sans ce ménage, renuméroter laisse
// les anciens derrière et on publie des doublons dans le désordre.
for (const vieux of await readdir(sortie)) {
  if (vieux.endsWith(".png")) await rm(join(sortie, vieux));
}

for (const [nom, present] of [["artwork du lot", artLot], ["illustration duel", artDuel],
                              ["capture Plug", capPlug], ["capture devinette", capDev]]) {
  if (!present) console.warn("⚠️  " + nom + " absent — le visuel se rendra sans.");
}

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});

let deborde = 0;
for (const p of POSTS) {
  const ctx = await navigateur.newContext({
    viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE });
  const onglet = await ctx.newPage();
  await onglet.setContent(page(p), { waitUntil: "load" });
  // Sans cette attente, la capture part parfois sur la police de repli et le
  // lettrage n'est plus celui du logo. Le défaut est sournois — l'image paraît
  // « un peu différente », pas cassée.
  await onglet.evaluate(() => document.fonts.ready);

  // ── LE TITRE EST MESURÉ, PAS DEVINÉ ────────────────────────────────────
  // Deux dépassements que scrollWidth ne voit pas : l'INCLINAISON, qui élargit
  // le tracé d'environ tan(7°) x hauteur de ligne, et l'OMBRE DURE, décalée
  // vers la droite. Sans eux, un titre « qui rentre » sort quand même du cadre.
  const titre = await onglet.evaluate(() => {
    const t = document.querySelector(".titre");
    const zone = document.querySelector(".contenuHaut");
    const st = getComputedStyle(zone);
    const dispo = zone.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
    let taille = parseFloat(getComputedStyle(t).fontSize);
    const marge = () => {
      const h = parseFloat(getComputedStyle(t).lineHeight) || taille;
      return Math.tan(7 * Math.PI / 180) * h + 7;
    };
    let garde = 40;
    while (t.scrollWidth + marge() > dispo && taille > 24 && garde-- > 0) {
      taille -= 1.5; t.style.fontSize = taille + "px";
    }
    return Math.round(taille);
  });

  // ── LE BANDEAU BAS DÉBORDE-T-IL ? ──────────────────────────────────────
  // `.bas` est en hauteur fixe : si son contenu est plus grand, il déborde VERS
  // LE HAUT et recouvre le titre. Rien d'autre ne le signale — ni la
  // compilation, ni la mesure du titre, qui regarde la largeur.
  const bas = await onglet.evaluate(() => {
    const b = document.querySelector(".bas");
    const haut = document.querySelector(".haut").getBoundingClientRect();
    let plusHaut = Infinity;
    for (const e of b.children) plusHaut = Math.min(plusHaut, e.getBoundingClientRect().top);
    return { trop: Math.round(Math.max(0, haut.bottom - plusHaut)),
             interne: b.scrollHeight > b.clientHeight + 1 };
  });
  if (bas.trop > 0 || bas.interne) deborde++;

  const chemin = join(sortie, p.fichier + ".png");
  await onglet.screenshot({ path: chemin });
  await ctx.close();
  // L'artwork et les captures sont des images riches : 256 couleurs. Les
  // aplats et les trames se contentent de 128.
  await alleger(chemin, p.artwork || p.captures ? 256 : 128);
  const ko = Math.round((await readFile(chemin)).length / 1024);
  console.log("  1080×1350  " + p.fichier + ".png  " + ko + " ko  titre " + titre + "px"
    + "  bas " + (bas.trop > 0 || bas.interne
        ? "❌ DÉBORDE de " + bas.trop + "px sur le titre" : "✅"));
}

await navigateur.close();
console.log("\n" + (deborde
  ? "❌ " + deborde + " post(s) débordent — raccourcis le texte."
  : "✅ les " + POSTS.length + " posts tiennent dans leur cadre."));
console.log("   " + sortie);
console.log("\nÀ poster dans l'ordre des numéros. Les mentions sont SUR l'image :");
console.log("une image se partage seule, la légende ne la suit pas toujours.");
process.exit(deborde ? 1 : 0);
