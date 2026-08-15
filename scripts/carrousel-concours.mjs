#!/usr/bin/env node
// LE CARROUSEL DU CONCOURS — 9:16, pour Instagram et TikTok.
//
//     node scripts/carrousel-concours.mjs
//
// Sortie : visuels/annonces/carrousel/01-...png … 07-...png
//
// ── POURQUOI UN CARROUSEL ET NON UNE IMAGE ────────────────────────────────
//
// Une seule image peut annoncer un lot. Elle ne peut pas expliquer un
// classement, et c'est justement là que se joue la confiance : un concours
// dont on ne comprend pas comment on gagne se lit comme un tirage truqué. Le
// carrousel donne une diapositive par idée, et une idée par diapositive.
//
// TOUT EST EN 1080×1920. Instagram accepte le 9:16 en carrousel depuis qu'il a
// aligné le fil sur le format vertical, et TikTok ne connaît que celui-là. Un
// carrousel carré posté sur TikTok laisse deux bandes vides ; deux jeux de
// fichiers à maintenir pour une différence que personne ne remarque, non.
//
// ── CE QUI EST ÉCRIT ICI EST VÉRIFIÉ ──────────────────────────────────────
//
// Le contenu de l'édition Ultimate vient de la page officielle d'Electronic
// Arts (ea.com/games/ea-sports-fc/fc-27/news/fc-27-editions-and-release-dates),
// pas d'un article de presse ni de mémoire. Deux choses en ont été RETIRÉES
// exprès, et c'est le point le plus important de ce fichier :
//
//   • LES BONUS DE PRÉCOMMANDE (ICON 93+, Evolution FC 26) expirent le
//     31 août 2026. Le gagnant reçoit son lot en octobre. Les annoncer serait
//     promettre ce qu'il ne recevra pas.
//   • LES 7 JOURS D'ACCÈS ANTICIPÉ courent à partir du 18 septembre 2026, et le
//     jeu sort le 25. Le concours se termine le 30. L'accès anticipé est donc
//     épuisé avant même que le gagnant soit connu.
//
// Un visuel de concours n'est pas une plaquette commerciale : chaque ligne y
// est une promesse opposable. On n'y met que ce que le gagnant recevra vraiment.
//
// La mécanique du classement décrite en diapositives 3 et 4 vient de
// docs/supabase-classement.sql — la fonction qui calcule vraiment, pas une
// version simplifiée pour l'affiche.

import { chromium } from "playwright";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");
const lancer = promisify(execFile);

// ── LA CHARTE, LUE À LA SOURCE ────────────────────────────────────────────
// charte.jsx crée un élément JSX au niveau du module : l'importer depuis Node
// réclamerait React. On le lit donc comme TEXTE. Recopier les valeurs à la main
// serait le meilleur moyen de les voir diverger au premier ajustement.
const source = await readFile(join(racine, "src", "lib", "charte.jsx"), "utf8");
function jeton(nom) {
  const m = source.match(new RegExp(nom + ':\\s*"(#[0-9A-Fa-f]{3,8})"'));
  if (!m) throw new Error("jeton de charte introuvable : " + nom);
  return m[1];
}
const G = {
  encre: jeton("encre"), or: jeton("or"), orSombre: jeton("orSombre"),
  creme: jeton("creme"), nuit: jeton("nuit"), pelouseClaire: jeton("pelouseClaire"),
  maillot: jeton("maillot"),
};

const b64 = (buf, type) => "data:" + type + ";base64," + buf.toString("base64");
const anton = b64(await readFile(join(ici, "polices", "anton-latin.woff2")), "font/woff2");
// BEBAS NEUE : la police de l'app. `G.font` et `G.heading` de la charte la
// désignent tous les deux — Anton n'y sert QUE au lettrage d'affiche
// (`G.poster`). Les visuels composaient leur texte courant dans une pile
// système : ils ne ressemblaient donc à l'app que par leurs titres.
const bebas = b64(await readFile(join(ici, "polices", "bebas-neue-latin.woff2")), "font/woff2");
const motSymbole = b64(await readFile(join(racine, "public", "logo-mot.webp")), "image/webp");

// L'artwork du lot. Image de TIERS : déposée à la main dans visuels/bruts/, et
// tenue hors du dépôt, qui est public.
const LOT_FICHIERS = ["fc27.jpg", "fc27.jpeg", "fc27.png", "fc27.webp"];
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
let artLot = null;
for (const nom of LOT_FICHIERS) {
  try {
    artLot = { donnee: b64(await readFile(join(racine, "visuels", "bruts", nom)),
      TYPES[nom.split(".").pop()]), nom };
    break;
  } catch (e) { /* pas celui-là */ }
}

// Composé à la moitié des pixels visés puis capturé en 2× : ça garde des tailles
// de police lisibles dans le code et sort du 2× net.
const ECHELLE = 2;
const L = 540, H = 960;   // → 1080 × 1920

// ── LES ZONES QUE LA PLATEFORME RECOUVRE ───────────────────────────────────
//
// Une image postée sur TikTok ou en story Instagram n'est pas montrée seule :
// la plateforme pose PAR-DESSUS le pseudo, la légende, le son, et la colonne
// de boutons (like, commentaire, partage). Ce qui tombe dessous est masqué.
//
// La première version posait les mentions légales à 12 px du bas — exactement
// sous la légende et le pseudo. Elles étaient donc invisibles là où elles sont
// le plus nécessaires, et un visuel de concours dont les mentions ne se lisent
// pas ne vaut pas mieux qu'un visuel sans mentions.
//
// Les marges ci-dessous sont en pixels de COMPOSITION (moitié de la sortie,
// l'échelle étant de 2). Elles sont volontairement moins larges que les
// « safe zones » publicitaires de TikTok, qui réservent près de 500 px en bas :
// ce carrousel est d'abord un carrousel de FIL Instagram, où rien ne recouvre
// l'image. On protège donc ce qui compte — le texte — sans amputer la
// composition de moitié pour un cas qui n'est pas le principal.
const RESERVE = {
  haut: 75,     // 150 px en sortie : barre de recherche / entête de story
  bas: 190,     // 380 px : légende, pseudo, son
  droite: 70,   // 140 px : la colonne des boutons d'action…
  // …mais SEULEMENT dans la moitié basse. La colonne like / commentaire /
  // partage ne court pas sur toute la hauteur : elle est ancrée en bas, au-
  // dessus de la légende. Un titre posé à 20 % de hauteur n'est pas recouvert.
  //
  // Cette précision n'est pas un détail de confort : la première version du
  // contrôle traitait la bande de droite comme pleine hauteur et signalait les
  // TITRES. Suivre ce contrôle-là aurait conduit à rétrécir chaque titre pour
  // éviter un recouvrement qui n'existe pas. Un contrôle trop sévère se fait
  // désobéir, puis ignorer — et il emporte les vrais signalements avec lui.
  droiteDepuis: 0.45,
};

// ── LE COMPTE INSTAGRAM ────────────────────────────────────────────────────
// À VÉRIFIER AVANT DE PUBLIER. Aucun compte n'était déclaré nulle part dans le
// dépôt : celui-ci est déduit du nom de l'app, pas constaté. Un pseudo faux
// imprimé sur un visuel envoie les gens chez quelqu'un d'autre, et ça ne se
// rattrape pas une fois posté.
const COMPTE_IG = "@goatfc";

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

// ── LES DIAPOSITIVES ──────────────────────────────────────────────────────
//
// Une idée par diapositive, dans l'ordre où on se pose les questions : c'est
// quoi le lot → est-ce que j'ai mes chances → comment on marque → comment on ne
// marque pas → ce que je gagne exactement → comment je participe → jusqu'à quand.
//
// L'ordre n'est pas décoratif. « Tout le monde part à zéro » vient en DEUXIÈME,
// juste après le lot, parce que c'est l'objection qui fait fermer le carrousel :
// quelqu'un qui croit que les anciens joueurs ont trop d'avance ne lit pas la
// suite.
const DIAPOS = [
  {
    fichier: "01-le-lot",
    surligne: "HALL OF FAME · SEPTEMBRE 2026",
    titre: ["LE PODIUM DU MOIS", "REPART AVEC"],
    artwork: true,
    prix: "1ᵉʳ · VALEUR 109,99 €",
    corps: "EA SPORTS FC 27, <b>édition Ultimate</b>, sur la plateforme de ton "
         + "choix. Et le podium ne s'arrête pas au premier →",
  },
  {
    // Les trois lots sur UNE diapositive, tôt : c'est ce qui fait rester
    // quelqu'un qui se sait incapable de finir premier. Un concours à lot
    // unique se lit « ce n'est pas pour moi » et se referme.
    fichier: "02-trois-places",
    surligne: "TROIS PLACES RÉCOMPENSÉES",
    titre: ["TU N'AS PAS BESOIN", "D'ÊTRE PREMIER"],
    podium: [
      ["🥇", "1ᵉʳ", "EA SPORTS FC 27 édition Ultimate", "valeur 109,99 €"],
      ["🥈", "2ᵉ",  "Carte cadeau de 50 €", "enseigne de ton choix"],
      ["🥉", "3ᵉ",  "Carte cadeau de 30 €", "enseigne de ton choix"],
    ],
  },
  {
    fichier: "03-tout-le-monde-a-zero",
    surligne: "LE 1ER SEPTEMBRE À 00H00",
    titre: ["TOUT LE MONDE", "PART À ZÉRO"],
    // Le mot qui compte. Un joueur qui arrive le 12 septembre doit comprendre
    // qu'il n'a pas déjà perdu, sinon il ne s'inscrit pas.
    grosMot: "0",
    corps: "Le classement du mois est <b>remis à zéro</b>. Que tu joues depuis "
         + "avril ou que tu découvres l'app aujourd'hui, tu démarres au même "
         + "point que tout le monde.",
  },
  {
    fichier: "04-comment-on-marque",
    surligne: "LA RÈGLE",
    titre: ["COMMENT ON", "MARQUE DES POINTS"],
    liste: [
      ["Ton MEILLEUR score de la journée", "compte dans chaque mode"],
      ["Chaque mode pèse pareil", "les scores sont ramenés sur une échelle de 0 à 1000"],
      ["Tout s'additionne sur le mois", "jour après jour, mode après mode"],
    ],
  },
  {
    fichier: "05-ce-qui-ne-marche-pas",
    surligne: "ET CE QUI NE MARCHE PAS",
    titre: ["ÇA NE SE GAGNE PAS", "EN UNE SOIRÉE"],
    // Dit en négatif, exprès. Annoncer ce qui NE rapporte pas est ce qui
    // désamorce le soupçon de « celui qui farme le plus gagne ».
    listeCroix: [
      "Rejouer 20 fois le même mode dans la journée ne rapporte pas plus qu'une seule très bonne partie",
      "Un score anormalement haut ne rapporte pas plus qu'un excellent score honnête",
    ],
    corps: "Pour accumuler, il faut <b>jouer plusieurs modes, sur plusieurs "
         + "jours</b>. La régularité gagne, pas l'acharnement d'un soir.",
  },
  {
    fichier: "06-dans-l-edition-ultimate",
    surligne: "CE QUE TU REÇOIS VRAIMENT",
    titre: ["DANS L'ÉDITION", "ULTIMATE"],
    // Chaque ligne vient de la page officielle d'EA. Les bonus de précommande
    // et l'accès anticipé en sont ABSENTS : voir l'en-tête du fichier.
    puces: [
      "Le jeu complet EA SPORTS FC 27",
      "Jusqu'à 6 000 points FC, versés en 3 fois",
      "Premium Pass de la Saison 1",
      "Mode Carrière : 3 ICONs/Héros, coach et recruteurs 5 étoiles",
      "Ultimate Team : un emplacement d'Evolution en plus",
      "The Grounds : survêtement signature et bonus d'XP",
    ],
  },
  {
    fichier: "07-comment-participer",
    surligne: "SANS OBLIGATION D'ACHAT",
    titre: ["POUR PARTICIPER", "ET ÊTRE ÉLIGIBLE"],
    // Quatre gestes, numérotés, dont UN seul est le jeu. Les trois autres
    // conditionnent la REMISE du lot, pas le classement : c'est dit ici comme
    // dans le règlement, parce qu'un joueur qui découvre la condition au moment
    // de réclamer se sent piégé — et il aurait raison.
    liste: [
      ["Joue sur goatfc.fr", "gratuit, rien à installer"],
      ["Abonne-toi à " + COMPTE_IG, "sur Instagram"],
      ["Identifie 2 amis", "en commentaire de ce post"],
      ["Partage ce post en story", "et laisse-la en ligne"],
    ],
    corps: "Le classement décide de <b>l'ordre</b>. Les trois gestes Instagram "
         + "sont vérifiés <b>au moment de la remise</b>.",
  },
  {
    fichier: "08-les-dates",
    surligne: "À RETENIR",
    titre: ["DU 1ER AU", "30 SEPTEMBRE"],
    dates: [
      ["1ER SEPT · 00H00", "le classement repart de zéro"],
      ["30 SEPT · 23H59", "fin du concours, heure de Paris"],
      ["1ER OCT", "le gagnant est annoncé dans l'app"],
    ],
    corps: "Règlement complet sur <b>goatfc.fr/reglement</b>",
  },
];

// La mention légale, en pied de CHAQUE diapositive. Répétée parce qu'une
// diapositive de carrousel se partage seule : celle qui montre le lot doit
// porter ses mentions même sortie de son contexte.
const MENTIONS = "Concours de connaissances sans obligation d'achat · Règlement sur "
  + "goatfc.fr/reglement · Jeu non sponsorisé, administré ni associé à Instagram ou TikTok";
const MENTIONS_EA = " · EA SPORTS FC 27 est une marque d'Electronic Arts Inc., qui n'est "
  + "ni organisateur, ni sponsor, ni partenaire de ce concours.";

function page(d, n, total) {
  // ── OÙ PASSE LA LIGNE DE PARTAGE ────────────────────────────────────────
  // Le bandeau de nuit prenait la moitié basse. Il en prend désormais près des
  // trois quarts, et ce n'est pas un choix esthétique : les 190 derniers pixels
  // sont RÉSERVÉS à la plateforme (voir RESERVE), donc inutilisables. Sans
  // remonter cette ligne, le contenu se retrouvait comprimé dans ce qui restait
  // — le contrôle de débordement a refusé deux diapositives, ce qui est
  // exactement son travail.
  //
  // L'aplat de nuit, lui, descend toujours jusqu'au bord : c'est une couleur,
  // qu'elle soit recouverte ne coûte rien. Seul le TEXTE remonte.
  const bandeau = d.artwork ? 74 : 70;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Anton';src:url(${anton}) format('woff2');font-display:block}
  @font-face{font-family:'Bebas Neue';src:url(${bebas}) format('woff2');font-display:block}
  *{margin:0;padding:0;box-sizing:border-box}
  .c{position:absolute;inset:0}
  body{width:${L}px;height:${H}px;overflow:hidden;position:relative;background:${G.or};
    font-family:'Anton',Impact,sans-serif;-webkit-font-smoothing:antialiased}
  .haut{position:absolute;left:0;right:0;top:0;height:${100 - bandeau}%;overflow:hidden}
  .contenuHaut{position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:13px;padding:40px 30px}
  .mot{width:150px;height:auto;display:block}
  /* Le compteur de diapositives. Il n'est pas décoratif : sur Instagram, rien
     n'indique combien de vues restent, et un lecteur qui ne sait pas qu'il en
     reste cinq s'arrête à la deuxième. */
  /* Le compteur descend sous l'entête de la plateforme et se décale de la
     colonne de boutons. */
  .compteur{position:absolute;top:${RESERVE.haut + 14}px;right:${RESERVE.droite + 14}px;z-index:5;
    font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:16px;letter-spacing:1.6px;color:${G.encre};
    background:rgba(245,194,43,.9);border:2.5px solid ${G.encre};border-radius:9px;
    padding:5px 10px;box-shadow:3px 3px 0 ${G.encre}}
  .surligne{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:17px;letter-spacing:3.4px;color:${G.encre};text-transform:uppercase;
    text-align:center}
  /* L'ordre de peinture est indispensable : par défaut le contour est peint
     PAR-DESSUS la lettre et lui ronge l'intérieur — à cette épaisseur, les
     contre-formes du A et du O se bouchent complètement. */
  .titre span{display:block}
  .titre{font-size:54px;line-height:.95;letter-spacing:.5px;color:${G.creme};
    transform:skewX(-7deg);-webkit-text-stroke:6.5px ${G.encre};
    paint-order:stroke fill;text-shadow:7px 7px 0 ${G.encre};
    text-align:center;text-wrap:balance}
  .bas{position:absolute;left:0;right:0;bottom:0;height:${bandeau}%;background:${G.nuit};
    box-shadow:inset 0 10px 0 ${G.encre};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:15px;padding:30px ${36 + RESERVE.droite / 2}px ${RESERVE.bas + 44}px}
  /* Le gros chiffre : « 0 » et « 0 € » sont les deux arguments qui se retiennent.
     Ils méritent la place que prend un chiffre, pas celle que prend une phrase. */
  .grosMot{font-size:150px;line-height:.85;color:${G.or};transform:skewX(-7deg);
    text-shadow:8px 8px 0 rgba(0,0,0,.55);text-align:center}
  .prix{font-size:30px;line-height:1;color:${G.or};transform:skewX(-7deg);
    text-shadow:5px 5px 0 rgba(0,0,0,.55);text-align:center;letter-spacing:1px}
  .corps{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:22px;letter-spacing:.4px;line-height:1.4;color:${G.creme};text-align:center;max-width:445px}
  .corps b{color:${G.or};font-weight:900}
  .appel{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:26px;letter-spacing:1.8px;color:${G.encre};
    background:${G.or};border:3px solid ${G.encre};border-radius:11px;
    padding:11px 26px;box-shadow:4px 4px 0 rgba(0,0,0,.5)}
  /* ── LES LISTES ────────────────────────────────────────────────────────
     UN SEUL PANNEAU, pas une boîte par ligne.

     La première version encadrait chaque élément d'un filet d'or fin sur le
     fond de nuit. Ce n'est pas un motif de la charte : c'en est même l'inverse.
     La charte n'a que des APLATS OPAQUES CERCLÉS D'ENCRE, et une liste s'y
     présente comme dans la feuille « Règles du jeu » de l'app — un panneau
     unique, trait d'encre, ombre INTÉRIEURE, et des lignes séparées par un
     filet d'encre fin. Le filet d'or empilé faisait une grille de vignettes,
     un vocabulaire qui appartient au verre et pas à l'affiche.

     Copié sur le vrai écran (LePont.jsx, homeRulesModal) et non recomposé de
     mémoire : un motif « à peu près juste » se voit tout de suite à côté de
     l'original. */
  /* LES TAILLES ONT ÉTÉ REMONTÉES D'ENVIRON 20 % en passant à Bebas Neue.
     Elle est CONDENSÉE et sans bas-de-casse : à nombre de pixels égal, elle
     rend un texte nettement plus étroit et perçu plus petit qu'une pile
     système. Les mentions légales, elles, ont carrément gonflé de 8,5 à 12 px —
     à 8,5 en Bebas elles n'étaient plus lisibles sur un téléphone, et une
     mention qu'on ne lit pas ne protège personne. La graisse retombe à 400 :
     Bebas n'a qu'une graisse, demander 700 ou 900 déclenche une graisse
     SYNTHÉTIQUE que le navigateur épaissit lui-même, et qui empâte les lettres. */
  .cadre-liste{width:100%;max-width:452px;background:rgba(8,17,9,.5);
    border:3px solid ${G.encre};border-radius:18px;padding:0 16px;overflow:hidden;
    box-shadow:inset 3px 3px 0 rgba(8,17,9,.35)}
  .ligne{display:flex;align-items:flex-start;gap:13px;padding:12px 0;
    border-bottom:2px solid ${G.encre};
    font-family:'Bebas Neue',Impact,sans-serif;text-align:left}
  .ligne:last-child{border-bottom:none}
  /* La pastille du numéro : aplat d'or, RAYON FRANC et non cercle, cerclée
     d'encre. Le cercle sans contour était le dernier reste de l'ancien
     vocabulaire, et il a été retiré de l'app pour cette raison. */
  .num{flex:0 0 auto;min-width:30px;height:30px;border-radius:9px;background:${G.or};
    color:${G.encre};font-family:'Anton',Impact,sans-serif;font-size:20px;
    display:flex;align-items:center;justify-content:center;
    border:2px solid ${G.encre};margin-top:1px}
  .titreLigne{font-weight:400;font-size:21px;letter-spacing:.4px;color:${G.or};line-height:1.28}
  .sousLigne{font-weight:400;font-size:17px;letter-spacing:.3px;color:rgba(242,231,206,.82);
    line-height:1.35;margin-top:2px}
  .texteLigne{flex:1;font-weight:400;font-size:19px;letter-spacing:.3px;color:${G.creme};line-height:1.42}
  .croixMarque{flex:0 0 auto;font-size:19px;color:${G.maillot};line-height:1.2;margin-top:-1px}
  .puceMarque{flex:0 0 auto;font-size:17px;color:${G.or};font-weight:900;line-height:1.3}
  /* La 1re place se distingue par un APLAT D'OR sur sa ligne, pas par un cadre
     de plus : la hiérarchie doit se voir sans lire, et l'or est ce que la
     charte emploie pour dire « celui-là ». */
  .ligne.or{background:${G.or};margin:0 -16px;padding-left:16px;padding-right:16px}
  .ligne.or .titreLigne{color:${G.encre}}
  .ligne.or .sousLigne{color:rgba(8,17,9,.72)}
  .ligne.or .rang{color:${G.encre}}
  .rang{flex:0 0 auto;font-family:'Anton',Impact,sans-serif;font-size:25px;
    transform:skewX(-7deg);min-width:32px;color:${G.or};line-height:1.1}
  .medaille{flex:0 0 auto;font-size:27px;line-height:1}
  /* L'artwork est CADRÉ à la charte — trait d'encre et ombre dure — et non posé
     nu : encadré il se lit comme « le lot », posé nu il se lit comme le fond du
     visuel, et l'annonce n'aurait plus l'air d'être la tienne.
     flex:0 0 auto est indispensable : dans un conteneur flex en colonne, une
     image se laisse écraser dès que le contenu déborde. */
  .cadreLot{flex:0 0 auto;width:100%;max-width:430px;border:5px solid ${G.encre};
    border-radius:14px;overflow:hidden;box-shadow:7px 7px 0 rgba(0,0,0,.55);line-height:0}
  .cadreLot img{width:100%;height:auto;display:block}
  /* Les mentions se posent AU-DESSUS de la zone que la plateforme recouvre, et
     non collées au bord. Voir RESERVE en tête de fichier. */
  .mentions{position:absolute;left:0;right:${RESERVE.droite}px;bottom:${RESERVE.bas}px;
    padding:0 12px 0 34px;
    font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;
    font-size:12px;letter-spacing:.2px;line-height:1.35;color:rgba(240,233,214,.62);text-align:center}
  /* ── LA RÉSERVE, HABILLÉE ────────────────────────────────────────────────
     Les 380 derniers pixels sont laissés au pseudo, à la légende et au son de
     la plateforme. Vides, ils se lisent comme un oubli dans le fil Instagram,
     où rien ne recouvre l'image.
     On y pose donc la trame sérigraphiée de la charte — de la DÉCORATION et
     pas du texte. Elle ferme la composition, et le jour où TikTok l'a
     recouverte on n'a rien perdu. Poser une signature écrite ici aurait
     demandé une exception au contrôle des zones, et une exception dans un
     contrôle finit toujours par en accueillir une deuxième. */
  .reserve{position:absolute;left:0;right:0;bottom:0;height:${RESERVE.bas}px;
    pointer-events:none;opacity:.5;background-size:7px 7px;
    background-image:radial-gradient(circle, rgba(245,194,43,.22) 1.3px, transparent 1.6px);
    -webkit-mask-image:linear-gradient(to bottom, transparent, #000 55%);
    mask-image:linear-gradient(to bottom, transparent, #000 55%)}
  .cadre{position:absolute;inset:0;box-shadow:inset 0 0 0 11px ${G.encre};
    pointer-events:none}
  </style></head><body>
    <div class="compteur">${n} / ${total}</div>
    <div class="haut">
      ${decorOr}
      <div class="contenuHaut">
        <img class="mot" src="${motSymbole}" alt="GOAT FC">
        <div class="surligne">${d.surligne}</div>
        <div class="titre">${d.titre.map((l) => `<span>${l}</span>`).join("")}</div>
      </div>
    </div>
    <div class="bas">
      ${d.artwork && artLot
        ? `<div class="cadreLot"><img src="${artLot.donnee}" alt="EA SPORTS FC 27"></div>` : ""}
      ${d.prix ? `<div class="prix">${d.prix}</div>` : ""}
      ${d.grosMot ? `<div class="grosMot">${d.grosMot}</div>` : ""}
      ${d.liste ? `<div class="cadre-liste">${d.liste.map(([t, sous], i) =>
        `<div class="ligne"><div class="num">${i + 1}</div>
          <div><div class="titreLigne">${t}</div>
          <div class="sousLigne">${sous}</div></div></div>`).join("")}</div>` : ""}
      ${d.listeCroix ? `<div class="cadre-liste">${d.listeCroix.map((t) =>
        `<div class="ligne"><div class="croixMarque">✕</div>
          <div class="texteLigne">${t}</div></div>`).join("")}</div>` : ""}
      ${d.puces ? `<div class="cadre-liste">${d.puces.map((t) =>
        `<div class="ligne"><div class="puceMarque">▸</div>
          <div class="texteLigne">${t}</div></div>`).join("")}</div>` : ""}
      ${d.podium ? `<div class="cadre-liste">${d.podium.map(([m, r, quoi, sous], i) =>
        `<div class="ligne${i === 0 ? " or" : ""}">
          <div class="medaille">${m}</div>
          <div class="rang">${r}</div>
          <div><div class="titreLigne">${quoi}</div>
          <div class="sousLigne">${sous}</div></div></div>`).join("")}</div>` : ""}
      ${d.dates ? `<div class="cadre-liste">${d.dates.map(([q, w]) =>
        `<div class="ligne"><div><div class="titreLigne">${q}</div>
          <div class="sousLigne">${w}</div></div></div>`).join("")}</div>` : ""}
      ${d.corps ? `<div class="corps">${d.corps}</div>` : ""}
      ${d.appel ? `<div class="appel">${d.appel}</div>` : ""}
      <div class="mentions">${MENTIONS}${d.artwork || d.puces || d.podium ? MENTIONS_EA : ""}</div>
    </div>
    <div class="reserve"></div>
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
  } catch (e) {
    return false;   // mieux vaut un fichier lourd qu'un script qui refuse de tourner
  } finally {
    await rm(brut, { force: true });
  }
}

const sortie = join(racine, "visuels", "annonces", "carrousel");
await mkdir(sortie, { recursive: true });

console.log(artLot
  ? "artwork du lot : visuels/bruts/" + artLot.nom
  : "artwork du lot ABSENT — la diapositive 1 sortira sans image du jeu.");

const navigateur = await chromium.launch({
  args: ["--no-proxy-server"],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});

let debordements = 0, recouverts = 0;
for (const [i, d] of DIAPOS.entries()) {
  const ctx = await navigateur.newContext({
    viewport: { width: L, height: H }, deviceScaleFactor: ECHELLE });
  const onglet = await ctx.newPage();
  await onglet.setContent(page(d, i + 1, DIAPOS.length), { waitUntil: "load" });
  // La police est en @font-face avec font-display:block : sans cette attente, la
  // capture part parfois sur la police de repli, et le lettrage n'est plus celui
  // du logo. Le défaut est sournois — l'image paraît « un peu différente », pas
  // cassée.
  await onglet.evaluate(() => document.fonts.ready);

  // ── LE TITRE EST MESURÉ, PAS DEVINÉ ──────────────────────────────────────
  // Deux dépassements que `scrollWidth` ne voit pas et qu'il faut retirer de la
  // place disponible : l'INCLINAISON, qui élargit le tracé d'environ
  // tan(7°) × hauteur de ligne, et l'OMBRE DURE, décalée vers la droite. Sans
  // eux, un titre « qui rentre » sort quand même de son cadre d'encre.
  const titre = await onglet.evaluate(() => {
    const t = document.querySelector(".titre");
    const zone = document.querySelector(".contenuHaut");
    const st = getComputedStyle(zone);
    const dispo = zone.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
    let taille = parseFloat(getComputedStyle(t).fontSize);
    const marge = () => {
      const h = parseFloat(getComputedStyle(t).lineHeight) || taille;
      return Math.tan(7 * Math.PI / 180) * h + 8;   // inclinaison + ombre
    };
    let garde = 40;
    while (t.scrollWidth + marge() > dispo && taille > 26 && garde-- > 0) {
      taille -= 1.5;
      t.style.fontSize = taille + "px";
    }
    return { taille: Math.round(taille), largeur: t.scrollWidth, dispo: Math.round(dispo) };
  });

  // ── LE BAS DÉBORDE-T-IL ? ────────────────────────────────────────────────
  // Le contrôle qui manquait au générateur d'annonces : une liste de six puces
  // dans un bandeau de hauteur fixe sort du cadre sans que rien ne le signale,
  // et le visuel part sur Instagram avec sa dernière ligne coupée. On le mesure
  // au lieu de l'espérer.
  const bas = await onglet.evaluate(() => {
    const b = document.querySelector(".bas");
    const m = document.querySelector(".mentions");
    const dernier = [...b.children].filter((e) => !e.classList.contains("mentions")).pop();
    if (!dernier) return { deborde: false, marge: 999 };
    const rb = b.getBoundingClientRect(), rd = dernier.getBoundingClientRect();
    const rm = m.getBoundingClientRect();
    return {
      deborde: b.scrollHeight > b.clientHeight + 1 || rd.bottom > rm.top - 4,
      marge: Math.round(rm.top - rd.bottom),
      hauteur: b.scrollHeight, cadre: b.clientHeight,
    };
  });
  if (bas.deborde) debordements++;

  // ── AUCUN TEXTE DANS LA ZONE QUE LA PLATEFORME RECOUVRE ──────────────────
  //
  // Le contrôle que ce script n'avait pas, et qui a laissé passer des mentions
  // légales posées à 12 px du bas — c'est-à-dire sous la légende TikTok. On
  // mesure chaque bloc de texte contre les trois bandes réservées, au lieu
  // d'espérer qu'un réglage de padding suffise.
  //
  // Le DÉCOR est exclu : l'aplat de nuit, le décor d'or et le cadre d'encre
  // descendent jusqu'au bord et c'est voulu — une couleur recouverte ne coûte
  // rien. Seul ce qui se LIT doit rester visible.
  const masques = await onglet.evaluate((R) => {
    const dedans = [];
    const zones = [
      { nom: "haut", test: (b) => b.top < R.haut },
      { nom: "bas", test: (b) => b.bottom > innerHeight - R.bas },
      { nom: "droite", test: (b) => b.right > innerWidth - R.droite
                                 && b.bottom > innerHeight * R.droiteDepuis },
    ];
    const aDuTexte = (e) => [...e.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    for (const e of document.querySelectorAll("body *")) {
      if (e.classList.contains("c") || e.classList.contains("cadre")) continue;
      if (!aDuTexte(e)) continue;
      const b = e.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      for (const z of zones) {
        if (z.test(b)) dedans.push(z.nom + ":" + (e.className || e.tagName)
          + " (" + Math.round(b.top) + "→" + Math.round(b.bottom) + ")");
      }
    }
    return dedans;
  }, RESERVE);
  if (masques.length) recouverts++;


  const chemin = join(sortie, d.fichier + ".png");
  await onglet.screenshot({ path: chemin });
  await ctx.close();
  // L'artwork est une PHOTO : 128 couleurs la salissent. Les autres diapositives
  // sont des aplats et des trames, elles s'en contentent largement.
  await alleger(chemin, d.artwork ? 256 : 128);
  const taille = Math.round((await readFile(chemin)).length / 1024);
  console.log(`  ${(i + 1 + "").padStart(2, "0")}/${DIAPOS.length}  ${d.fichier}.png`
    + `  ${taille} ko  titre ${titre.taille}px`
    + `  bas ${bas.deborde ? "❌ DÉBORDE" : "✅ " + bas.marge + "px"}`
    + `  zones ${masques.length ? "❌ " + masques.join(" · ") : "✅ dégagées"}`);
}

await navigateur.close();

console.log("\n" + (debordements
  ? "❌ " + debordements + " diapositive(s) débordent — raccourcis le texte ou réduis la liste."
  : "✅ les " + DIAPOS.length + " diapositives tiennent dans leur cadre."));
console.log(recouverts
  ? "❌ " + recouverts + " diapositive(s) ont du texte sous l'interface de la plateforme."
  : "✅ aucun texte sous le pseudo, la légende ou les boutons de la plateforme"
    + "  (réserves : " + RESERVE.haut * 2 + " px en haut, " + RESERVE.bas * 2
    + " en bas, " + RESERVE.droite * 2 + " à droite, en pixels de sortie)");
console.log("   " + sortie);
console.log("\nÀ poster dans l'ordre des noms de fichiers. Instagram et TikTok gardent");
console.log("l'ordre de sélection, pas l'ordre alphabétique : sélectionne-les une par une.");
process.exit(debordements || recouverts ? 1 : 0);
