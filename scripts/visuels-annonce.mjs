#!/usr/bin/env node
// Les VISUELS D'ANNONCE à poster sur Instagram et TikTok.
//
//     node scripts/visuels-annonce.mjs                  # les quatre
//     node scripts/visuels-annonce.mjs cadeau           # une annonce
//     node scripts/visuels-annonce.mjs stores story     # un seul format
//
// Sortie : visuels/annonces/<annonce>-<format>.png
//
// DEUX FORMATS et pas un. 1080×1350 pour le fil (le portrait 4:5 occupe presque
// deux fois la hauteur d'un carré à largeur égale) et 1080×1920 pour les stories
// et TikTok. Une image carrée postée en story laisse deux bandes vides, et une
// verticale recadrée dans le fil se fait couper la tête : ce sont deux compositions
// différentes, pas un redimensionnement.
//
// TOUT VIENT DE LA CHARTE, lue dans src/lib/charte.jsx comme TEXTE — charte.jsx
// crée un élément JSX au niveau du module, donc l'importer depuis Node réclamerait
// React. Le décor est celui de l'accueil (lignes de vitesse + trame), le lettrage
// est composé avec la vraie police du logo, et le mot-symbole est le fichier de
// l'app. Rien n'est redessiné : ces visuels doivent ressembler à l'app, sinon ils
// annoncent autre chose qu'elle.
//
// ── CE QUE CE SCRIPT NE FAIT PAS, ET POURQUOI ──────────────────────────────
//
// Pas de badge « App Store » ni « Google Play ». Ce sont des marques déposées
// fournies par Apple et Google avec des règles d'usage précises (proportions,
// zone de respiration, formulations autorisées) ; un badge refait à la main est
// à la fois faux et attaquable. Le visuel écrit donc « SUR iOS ET ANDROID » en
// texte. Les vrais badges se téléchargent chez Apple et Google, et se posent
// quand les fiches sont acceptées.
//
// Pas de logo « EA SPORTS FC » non plus. Nommer le lot est un usage nominatif
// légitime ; en reprendre l'identité visuelle ne l'est pas.
//
// L'adresse du règlement est DONNÉE EN ENTIER — goatfc.fr/reglement — et non
// réduite au domaine. Quand ces textes ont été écrits, la page n'existait pas et
// « sur goatfc.fr » était la seule chose honnête à dire. Elle existe maintenant :
// renvoyer à l'accueil obligerait le lecteur à chercher, et un règlement qu'on
// doit chercher est un règlement qu'on ne lit pas — c'est-à-dire exactement ce
// que la mention est censée empêcher.
//
// Pas de date au jour près pour les stores. Une soumission passe par la revue
// d'Apple, dont le délai ne t'appartient pas : « OCTOBRE 2026 » est une promesse
// tenable, « 1ER OCTOBRE » ne l'est pas.

import { chromium } from "playwright";
import { readFile, writeFile, mkdir, stat, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const lancer = promisify(execFile);

const source = await readFile(join(racine, "src", "lib", "charte.jsx"), "utf8");
function jeton(nom) {
  const m = source.match(new RegExp(nom + ':\\s*"(#[0-9A-Fa-f]{3,8})"'));
  if (!m) throw new Error("jeton de charte introuvable : " + nom);
  return m[1];
}
const G = {
  encre: jeton("encre"), or: jeton("or"), orSombre: jeton("orSombre"),
  creme: jeton("creme"), nuit: jeton("nuit"), pelouseClaire: jeton("pelouseClaire"),
};

const b64 = (b, t) => "data:" + t + ";base64," + b.toString("base64");
const anton = b64(await readFile(join(ici, "polices", "anton-latin.woff2")), "font/woff2");
// BEBAS NEUE : la police de l'app. `G.font` et `G.heading` de la charte la
// désignent tous les deux — Anton n'y sert QUE au lettrage d'affiche
// (`G.poster`). Les visuels composaient leur texte courant dans une pile
// système : ils ne ressemblaient donc à l'app que par leurs titres.
const bebas = b64(await readFile(join(ici, "polices", "bebas-neue-latin.woff2")), "font/woff2");
const motSymbole = b64(await readFile(join(racine, "public", "logo-mot.webp")), "image/webp");

// ── L'ARTWORK DU LOT, s'il est fourni ──────────────────────────────────────
// Déposé à la main dans visuels/bruts/ (fc27.jpg, .png ou .webp), parce que c'est
// une image de tiers : elle n'a pas à vivre dans public/, qui part dans le bundle
// de l'app.
//
// Montrer l'art officiel d'un lot dans un concours est un usage courant et
// défendable — on désigne le produit qu'on offre. Ce qui ne l'est pas, c'est de
// laisser croire à un partenariat : d'où la mention de non-affiliation ajoutée
// automatiquement dès que l'image est utilisée. C'est elle qui protège, pas
// l'absence de logo.
const LOT_FICHIERS = ["fc27.jpg", "fc27.jpeg", "fc27.png", "fc27.webp"];
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
let artLot = null;
for (const nom of LOT_FICHIERS) {
  try {
    const brut = await readFile(join(racine, "visuels", "bruts", nom));
    artLot = { donnee: b64(brut, TYPES[nom.split(".").pop()]), nom };
    break;
  } catch (e) { /* pas celui-là */ }
}

// Rendu à l'échelle 2 : on compose en CSS à la moitié des pixels visés, ce qui
// garde des tailles de police lisibles dans le code et sort du 2× net.
const ECHELLE = 2;
const story = (f) => f.h > 800;

// ── LES ZONES QUE LA PLATEFORME RECOUVRE ───────────────────────────────────
//
// Une image postée en story ou sur TikTok n'est pas montrée seule : pseudo,
// légende, son et colonne de boutons se posent PAR-DESSUS. Les mentions
// légales étaient à 12 px du bas — donc invisibles là où elles sont le plus
// nécessaires.
//
// Ne s'applique QU'AU FORMAT VERTICAL. Le 1080×1350 est un format de FIL :
// l'interface s'y place SOUS l'image, pas dessus. Lui imposer les mêmes marges
// amputerait la composition pour un recouvrement qui n'existe pas.
const RESERVE_STORY = { haut: 75, bas: 190, droite: 70 };
const FORMATS = {
  feed:  { l: 540, h: 675 },   // → 1080 × 1350, le portrait du fil
  story: { l: 540, h: 960 },   // → 1080 × 1920, stories et TikTok
};

// ── Le décor de l'accueil, à l'identique ───────────────────────────────────
// Les lignes de vitesse sont un dégradé conique répété : un conique dessine des
// coins qui rayonnent depuis un point, ce qui EST une ligne de vitesse. Le centre
// est ensuite recouvert d'un aplat plutôt que masqué, sinon les lignes se
// rejoignent en une tache. La trame sérigraphiée ferme la couche, en or sombre
// sur l'or — une trame noire grise le fond au lieu de le texturer.
const lignes = (couleur, ep, pas) => `repeating-conic-gradient(from 0deg at 50% 30%,
  ${couleur} 0deg ${ep}deg, transparent ${ep}deg ${pas}deg)`;

const decorOr = `
  <div style="position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 26%,
    rgba(245,194,43,.96) 0 34%, rgba(217,162,26,.55) 100%), ${G.or}"></div>
  <div style="position:absolute;inset:-25%;background:${lignes("rgba(8,17,9,.42)", .55, 2.7)}"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,
    ${G.or} 0 18%, rgba(245,194,43,.92) 30%, rgba(245,194,43,0) 60%)"></div>
  <div style="position:absolute;inset:0;opacity:.5;background-size:7px 7px;
    background-image:radial-gradient(circle, ${G.orSombre} 1.4px, transparent 1.7px)"></div>`;

// ── Les deux annonces ──────────────────────────────────────────────────────
//
// Règle de couleur, mesurée dans la charte et non choisie à l'œil : SUR L'OR,
// SEULE L'ENCRE SE LIT. Le crème y tombe à 1,4 de contraste et le blanc à 1,7,
// contre 11,5 pour l'encre. Les petits textes posés sur le jaune sont donc en
// encre, sans exception.
//
// Les GRANDS titres échappent à cette règle par leur CONTOUR : cerné d'encre, un
// lettrage crème tient son contraste par le cerne, et le crème ne sert plus qu'à
// remplir. C'est la recette d'affiche de la charte — contour d'encre puis ombre
// dure décalée. Elle ne marche que sur un lettrage CLAIR : appliquée à des lettres
// d'encre, l'ombre a la couleur de la lettre et double le mot d'un fantôme noir.
//
// Dans le bandeau de nuit, tout se libère : blanc 18,3, crème 14,9, or 11,0.
const ANNONCES = {
  cadeau: {
    fichier: "cadeau-septembre",
    surligne: "HALL OF FAME · SEPTEMBRE 2026",
    titre: ["LE PODIUM DU MOIS", "REPART AVEC"],
    vedette: "FC 27 ULTIMATE",
    // Remplacée par l'artwork quand il est déposé : une image du jeu dit le lot
    // mieux que son nom écrit.
    artwork: true,
    corps: "<b>1ᵉʳ</b> EA SPORTS FC 27 édition Ultimate (109,99 €) · <b>2ᵉ</b> carte "
         + "cadeau de 50 € · <b>3ᵉ</b> carte cadeau de 30 €. Tout le monde part "
         + "à égalité le 1er septembre.",
    appel: "goatfc.fr",
    mentions: "Concours de connaissances sans obligation d'achat · Règlement complet sur goatfc.fr/reglement · "
            + "Jeu non sponsorisé, administré ni associé à Instagram ou TikTok · Trois lots "
            + "dématérialisés, plateforme ou enseigne au choix des gagnants.",
    mentionsArtwork: "EA SPORTS FC 27 est une marque d'Electronic Arts Inc., qui n'est ni "
            + "organisateur, ni sponsor, ni partenaire de ce concours. Visuel du jeu à titre "
            + "d'illustration du lot.",
  },
  stores: {
    fichier: "stores-octobre",
    surligne: "L'APPLI ARRIVE",
    titre: ["SUR iOS", "ET ANDROID"],
    vedette: "OCTOBRE 2026",
    corps: "Six modes de jeu, un classement mensuel, et des duels contre tes potes. "
         + "En attendant, ça se joue déjà dans le navigateur.",
    appel: "goatfc.fr",
    mentions: "iOS et Android sont des marques de leurs détenteurs respectifs. "
            + "Disponibilité soumise à la validation des plateformes.",
  },
};

// ── Les légendes ───────────────────────────────────────────────────────────
// Écrites ici et non laissées à improviser : ce qui se joue dans la légende, ce
// sont les deux choses que le visuel ne peut pas porter — l'appel à l'action et
// les mentions du concours. Un visuel de concours sans règlement accessible est
// attaquable, et sur Instagram comme sur TikTok la non-affiliation doit être dite.
const LEGENDES = {
  cadeau: {
    instagram: `🏆 SEPTEMBRE, C'EST PARTI.

Les TROIS premiers du classement mensuel de GOAT FC repartent avec quelque chose :

🥇 EA SPORTS FC 27, édition Ultimate — 109,99 €
🥈 Carte cadeau de 50 €, enseigne de ton choix
🥉 Carte cadeau de 30 €, enseigne de ton choix

Tout le monde part à égalité le 1er septembre. Le classement compte les points de tes six modes préférés, jour après jour — donc ça ne se gagne pas en une soirée, ça se gagne en revenant.

👉 Ça se joue sur goatfc.fr, sans rien installer.

⚠️ Pour être éligible aux lots : abonne-toi à @goatfc, identifie 2 amis en commentaire et partage ce post en story. Le classement décide de l'ordre, ces 3 gestes sont vérifiés à la remise.
📱 Et l'appli arrive sur iOS et Android en octobre.

Concours de connaissances sans obligation d'achat. Règlement complet sur goatfc.fr/reglement. Jeu non sponsorisé, administré ni associé à Instagram. Lots dématérialisés, plateforme ou enseigne au choix des gagnants.

#football #quizfoot #mercato #ligue1 #premierleague #jeuconcours #concours #goatfc`,
    tiktok: `Le podium de septembre repart avec 🏆
🥇 FC 27 édition Ultimate (109,99 €)
🥈 Carte cadeau 50 €
🥉 Carte cadeau 30 €

Classement remis à zéro le 1er septembre — tout le monde part à égalité.
Ça se joue sur goatfc.fr, appli iOS et Android en octobre 📱

Pour être éligible : abonne-toi, identifie 2 amis, partage en story

Règlement sur goatfc.fr/reglement · Sans obligation d'achat · Jeu non associé à TikTok

#football #quizfoot #mercato #footballtiktok #concours #goatfc`,
  },
  stores: {
    instagram: `📱 GOAT FC ARRIVE SUR iOS ET ANDROID — OCTOBRE 2026.

Six modes, un classement mensuel, et des duels en direct contre tes potes.

En attendant, tout est déjà jouable dans le navigateur sur goatfc.fr — et le classement de septembre est lancé, avec un podium récompensé : FC 27 Ultimate, et deux cartes cadeaux. Autant prendre de l'avance.

👉 goatfc.fr

#football #quizfoot #mercato #ligue1 #premierleague #applifoot #goatfc`,
    tiktok: `L'appli arrive en octobre 📱 iOS + Android

6 modes, un classement du mois, des duels en direct.
En attendant ça se joue déjà sur goatfc.fr 👉 et les 3 premiers de septembre repartent avec quelque chose

#football #quizfoot #mercato #footballtiktok #goatfc`,
  },
};

async function ecrireLegendes(cles) {
  const bouts = ["# Légendes prêtes à coller",
    "",
    "Générées par `scripts/visuels-annonce.mjs`. Le visuel porte déjà les mentions",
    "obligatoires en petit ; la légende les répète parce que c'est elle qui est lue,",
    "et parce qu'un visuel recadré par la plateforme peut les rogner.",
    ""];
for (const cle of cles) {
    const l = LEGENDES[cle];
    if (!l) continue;
    bouts.push("## " + cle, "", "### Instagram", "", "```", l.instagram, "```", "",
               "### TikTok", "", "```", l.tiktok, "```", "");
  }
  await writeFile(join(racine, "visuels", "annonces", "legendes.md"), bouts.join("\n"));
}

function page(a, f) {
  const { l, h } = f;
  const story = h > 800;   // même seuil que le helper du module
  // Le bandeau de nuit prend la moitié basse en story, un peu plus du tiers en
  // fil : dans les deux cas il doit tenir la vedette, le corps et les mentions
  // sans que le titre du haut ne se retrouve à l'étroit.
  // Avec l'artwork, le bandeau prend nettement plus de place : le cadre 16/9 doit
  // tenir sa hauteur ENTIÈRE, plus le corps, l'appel et les mentions.
  const avecArt = !!(a.artwork && artLot);
  // En STORY, le bandeau remonte : les 190 derniers pixels de composition sont
  // réservés à l'interface de la plateforme, donc inutilisables. Le format de
  // fil, lui, ne change pas.
  // Réglé PAR MESURE et non repris du carrousel : ce visuel porte un
  // mot-symbole de 210 px et un titre de 61 px, contre 150 et 54 là-bas. À 74 %,
  // la bande d'or tombait à 250 px et coupait « REPART AVEC » — le contrôle du
  // titre ne le voit pas, il mesure la LARGEUR, pas la hauteur disponible.
  const bandeau = avecArt ? (story ? 70 : 66) : (story ? 60 : 45);
  const tTitre = story ? 62 : 54;        // corps du titre en relief
  const tVedette = story ? 96 : 78;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Anton';src:url(${anton}) format('woff2');font-display:block}
  @font-face{font-family:'Bebas Neue';src:url(${bebas}) format('woff2');font-display:block}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${l}px;height:${h}px;overflow:hidden;position:relative;background:${G.or};
    font-family:'Anton',Impact,sans-serif;-webkit-font-smoothing:antialiased}
  /* La moitié haute : le décor d'or, le mot-symbole, la surligne d'encre et le
     titre en relief. */
  .haut{position:absolute;left:0;right:0;top:0;height:${100 - bandeau}%;overflow:hidden}
  .contenuHaut{position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:${story ? 11 : 10}px;
    padding:${story ? 26 : 32}px 30px ${story ? 20 : 32}px}
  .mot{width:${story ? 178 : 186}px;height:auto;display:block}
  .surligne{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:${story ? 18 : 16}px;letter-spacing:${story ? 3.6 : 3}px;color:${G.encre};
    text-transform:uppercase;text-align:center}
  /* L'ordre de peinture est indispensable : par défaut le contour est peint
     PAR-DESSUS la lettre et lui ronge l'intérieur — à cette épaisseur, les
     contre-formes du A et du O se bouchent complètement. */
  .titre span{display:block}
  .titre{font-size:${tTitre}px;line-height:.94;letter-spacing:.5px;color:${G.creme};
    transform:skewX(-7deg);-webkit-text-stroke:${story ? 7 : 6}px ${G.encre};
    paint-order:stroke fill;text-shadow:${story ? 8 : 7}px ${story ? 8 : 7}px 0 ${G.encre};
    text-align:center;text-wrap:balance}
  /* Le bandeau de nuit : là, blanc, crème et or se lisent tous les trois. */
  .bas{position:absolute;left:0;right:0;bottom:0;height:${bandeau}%;background:${G.nuit};
    box-shadow:inset 0 ${story ? 11 : 9}px 0 ${G.encre};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:${story ? 12 : 10}px;
    padding:${story ? 34 : 26}px ${story ? 40 + RESERVE_STORY.droite / 2 : 32}px
            ${story ? RESERVE_STORY.bas + 30 : 26}px ${story ? 40 : 32}px}
  .vedette{font-size:${tVedette}px;line-height:1;letter-spacing:1px;color:${G.or};
    transform:skewX(-7deg);text-shadow:${story ? 6 : 5}px ${story ? 6 : 5}px 0 rgba(0,0,0,.55);
    text-align:center}
  /* L'artwork est CADRÉ à la charte — trait d'encre et ombre dure — et non posé
     nu : encadré, il se lit comme « le lot », posé nu il se lit comme le fond du
     visuel, et l'annonce n'aurait plus l'air d'être la tienne. */
  /* flex:0 0 auto est INDISPENSABLE : dans un conteneur flex en colonne, un
     élément qui tient sa proportion se laisse écraser dès que le contenu déborde,
     et le cadre sortait à 47 px de haut au lieu de 236. Même piège que les
     affiches de mode, où le visuel se retrouvait en bandes noires.
     (Et pas d'accent grave dans ce commentaire : il vit DANS un gabarit de
     chaîne, qu'un accent grave refermerait au milieu.) */
  /* PAS d'aspect-ratio impose, et pas d'object-fit:cover. Le cadre epouse les
     proportions de l'image deposee.
     (Aucun accent grave dans ce commentaire : il vit dans un gabarit de chaine
     JavaScript, qu'un accent grave refermerait au milieu du CSS.)

     C'etait un 16/9 fixe, ce qui marche tant que l'artwork est un 16/9. Le
     notre ne l'est pas : la key art officielle porte « ULTIMATE EDITION » sous
     le logo, alors que le lot annonce est l'edition STANDARD. Elle a donc ete
     recadree au-dessus de cette ligne, ce qui en fait un bandeau large. Force
     dans un 16/9 en mode cover, ce bandeau se serait fait rogner sur les cotes
     — c'est-a-dire perdre le logo a gauche ET le joueur a droite, pour ne
     garder que le fond noir du milieu. */
  .cadreLot{flex:0 0 auto;width:100%;max-width:${story ? 360 : 330}px;
    border:${story ? 5 : 4}px solid ${G.encre};border-radius:${story ? 14 : 11}px;
    overflow:hidden;box-shadow:${story ? 7 : 6}px ${story ? 7 : 6}px 0 rgba(0,0,0,.55);
    line-height:0}
  .cadreLot img{width:100%;height:auto;display:block}
  .corps{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:${story ? 21 : 18}px;letter-spacing:.4px;line-height:1.38;color:${G.creme};text-align:center;
    max-width:${story ? 420 : 400}px}
  .corps b{color:${G.or};font-weight:900}
  .appel{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:${story ? 25 : 21}px;letter-spacing:1.8px;color:${G.encre};
    background:${G.or};border:3px solid ${G.encre};border-radius:11px;
    padding:${story ? "11px 26px" : "9px 22px"};box-shadow:4px 4px 0 rgba(0,0,0,.5)}
  /* Les mentions ne sont pas décoratives : un concours annoncé sans règlement ni
     mention de non-affiliation aux plateformes est un concours attaquable. Assez
     petites pour ne pas prendre la vedette, assez grandes pour être lues — le
     crème à 45 % tient encore 6,7 de contraste sur la nuit. */
  .mentions{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:${story ? 13 : 12}px;letter-spacing:.2px;line-height:1.35;color:rgba(240,233,214,.68);
    text-align:center;max-width:${story ? 476 : 452}px}
  /* La trame de la charte dans la réserve : de la décoration, pas du texte.
     Vide, cette bande se lit comme un oubli ; recouverte par la plateforme, on
     n'y perd rien. */
  .reserve{position:absolute;left:0;right:0;bottom:0;height:${RESERVE_STORY.bas}px;
    pointer-events:none;opacity:.5;background-size:7px 7px;
    background-image:radial-gradient(circle, rgba(245,194,43,.22) 1.3px, transparent 1.6px);
    -webkit-mask-image:linear-gradient(to bottom, transparent, #000 55%);
    mask-image:linear-gradient(to bottom, transparent, #000 55%)}
  .cadre{position:absolute;inset:0;box-shadow:inset 0 0 0 ${story ? 11 : 9}px ${G.encre};
    pointer-events:none}
  </style></head><body>
    <div class="haut">
      ${decorOr}
      <div class="contenuHaut">
        <img class="mot" src="${motSymbole}" alt="GOAT FC">
        <div class="surligne">${a.surligne}</div>
        <div class="titre">${a.titre.map((l) => `<span>${l}</span>`).join("")}</div>
      </div>
    </div>
    <div class="bas">
      ${a.artwork && artLot
        ? `<div class="cadreLot"><img src="${artLot.donnee}" alt="${a.vedette}"></div>`
        : `<div class="vedette">${a.vedette}</div>`}
      <div class="corps">${a.corps}</div>
      <div class="appel">${a.appel}</div>
      <div class="mentions">${a.artwork && artLot
        ? a.mentions + " " + a.mentionsArtwork : a.mentions}</div>
    </div>
    ${story ? '<div class="reserve"></div>' : ""}
    <div class="cadre"></div>
  </body></html>`;
}

/** Réduit le PNG à une palette : ce sont des aplats et des trames, pas des photos. */
async function alleger(chemin) {
  const brut = chemin.replace(/\.png$/, ".brut.png");
  try {
    await writeFile(brut, await readFile(chemin));
    await lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", brut,
      "-vf", "split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none",
      chemin]);
    return true;
  } catch (e) {
    return false;   // mieux vaut un fichier lourd qu'un script qui refuse de tourner
  } finally {
    await rm(brut, { force: true });
  }
}

const args = process.argv.slice(2);
const cles = Object.keys(ANNONCES).filter((k) => !args.length || args.includes(k));
const formats = Object.keys(FORMATS).filter((k) => !args.includes("feed") && !args.includes("story")
  ? true : args.includes(k));
if (!cles.length) {
  console.error("annonces connues : " + Object.keys(ANNONCES).join(", "));
  process.exit(1);
}

if (cles.includes("cadeau")) {
  console.log(artLot
    ? "artwork du lot : visuels/bruts/" + artLot.nom
    : "artwork du lot ABSENT — dépose-le dans visuels/bruts/ (fc27.jpg, .png ou .webp)\n"
      + "  en attendant, le visuel écrit « FC 27 » en lettres.");
}

let deborde = 0;
const sortie = join(racine, "visuels", "annonces");
await mkdir(sortie, { recursive: true });

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});

for (const cle of cles) {
  for (const nomFormat of formats) {
    const f = FORMATS[nomFormat];
    const ctx = await navigateur.newContext({
      viewport: { width: f.l, height: f.h }, deviceScaleFactor: ECHELLE });
    const onglet = await ctx.newPage();
    await onglet.setContent(page(ANNONCES[cle], f), { waitUntil: "load" });
    // La police est en @font-face avec font-display:block : sans cette attente,
    // la capture part parfois sur la police de repli, et le lettrage n'est plus
    // celui du logo. Le défaut est sournois — l'image paraît juste « un peu
    // différente », pas cassée.
    await onglet.evaluate(() => document.fonts.ready);
    // ── LE TITRE EST MESURÉ, PAS DEVINÉ ────────────────────────────────────
    // Premier rendu : « REPART AVEC » et « ET ANDROID » touchaient les deux bords
    // et leur ombre était rognée par le cadre d'encre. Compter les caractères ne
    // marche pas — la largeur dépend du dessin des lettres — et deux réglages en
    // dur ne survivraient pas au premier changement de texte.
    //
    // Deux dépassements que `scrollWidth` ne voit pas et qu'il faut retirer de la
    // place disponible : l'INCLINAISON, qui élargit le tracé d'environ
    // tan(7°) × hauteur de ligne, et l'OMBRE DURE, décalée vers la droite. Sans
    // eux, un titre « qui rentre » sort quand même de son cadre.
    const corps = await onglet.evaluate((arg) => {
      const titre = document.querySelector(".titre");
      const zone = document.querySelector(".contenuHaut");
      const st = getComputedStyle(zone);
      const dispo = zone.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      const lignes = [...titre.querySelectorAll("span")];
      const large = () => Math.max(...lignes.map((l) => l.getBoundingClientRect().width));
      let px = parseFloat(getComputedStyle(titre).fontSize);
      for (let i = 0; i < 60; i++) {
        const marge = Math.tan(7 * Math.PI / 180) * px * 0.94 + arg.ombre;
        if (large() + marge <= dispo || px <= arg.plancher) break;
        px -= 1;
        titre.style.fontSize = px + "px";
      }
      return { px, dispo: Math.round(dispo), large: Math.round(large()) };
    }, { ombre: story(f) ? 8 : 7, plancher: 26 });
    await onglet.waitForTimeout(120);
    // ── LE BANDEAU BAS DÉBORDE-T-IL ? ────────────────────────────────────────
    // Le contrôle qui manquait à CE générateur, et que le carrousel avait déjà.
    // `.bas` est en hauteur fixe : si son contenu est plus grand, il déborde
    // VERS LE HAUT et recouvre le titre — c'est exactement ce qui est arrivé au
    // format story quand la réserve de la plateforme a mangé 190 px. Rien ne le
    // signalait : ni la compilation, ni la mesure du titre, qui regarde la
    // largeur et pas la hauteur disponible.
    const debord = await onglet.evaluate(() => {
      const b = document.querySelector(".bas");
      const haut = document.querySelector(".haut").getBoundingClientRect();
      let plusHaut = Infinity;
      for (const e of b.children) plusHaut = Math.min(plusHaut, e.getBoundingClientRect().top);
      return { trop: Math.round(Math.max(0, haut.bottom - plusHaut)),
               interne: b.scrollHeight > b.clientHeight + 1 };
    });
    if (debord.trop > 0 || debord.interne) deborde++;
    if (debord.trop > 0 || debord.interne)
      console.log("      ↳ débordement : " + debord.trop + "px sur le titre"
        + (debord.interne ? ", et le bandeau lui-même déborde" : ""));
    const chemin = join(sortie, ANNONCES[cle].fichier + "-" + nomFormat + ".png");
    await onglet.screenshot({ path: chemin });
    await ctx.close();
    const allege = await alleger(chemin);
    const { size } = await stat(chemin);
    console.log("  " + (f.l * ECHELLE) + "×" + (f.h * ECHELLE) + "  "
      + chemin.replace(racine + "/", "") + "  " + Math.round(size / 1024) + " ko"
      + "  titre " + corps.px + "px (" + corps.large + "/" + corps.dispo + ")"
      + (allege ? "" : "  ffmpeg absent"));
  }
}
await navigateur.close();

console.log("\n" + (deborde
  ? "❌ " + deborde + " visuel(s) débordent : le bandeau bas recouvre le titre."
  : "✅ aucun bandeau ne déborde sur le titre."));
await ecrireLegendes(cles);
console.log("\nLégendes prêtes à coller : visuels/annonces/legendes.md");
