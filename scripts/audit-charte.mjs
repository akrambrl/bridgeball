#!/usr/bin/env node
// CHERCHE LES TRACES DE L'ANCIEN STYLE, partout.
//
//     npm run charte
//
// ── CE QU'ON CHERCHE, ET POURQUOI CES SIGNATURES ───────────────────────────
//
// L'app est passée d'une charte « pelouse verte + verre flouté » à la charte
// manga « aplat d'or + trait d'encre + ombre dure ». Le basculement s'est fait
// écran par écran, donc les restes ne sont pas répartis au hasard : ils se
// concentrent là où personne n'est repassé.
//
// Quatre signatures suffisent à les trouver, et elles sont toutes objectives —
// pas « ça fait vieux » mais « cette valeur n'appartient pas à la charte » :
//
//  1. LE VERT SOMBRE DE FOND (#0A140A et ses variantes). C'était le sol.
//     Aujourd'hui le sol est l'or ; un fond vert sombre est un écran oublié.
//  2. LE VERT LED (#00E676 et proches). L'ancien accent, remplacé par
//     `pelouseClaire` #4FD07A. Les halos LED ont été retirés un par un.
//  3. LE VERRE FLOUTÉ (backdrop-filter). La charte est faite d'aplats opaques
//     cerclés d'encre ; un panneau translucide laisse remonter le fond.
//  4. L'OMBRE DIFFUSE (trois longueurs : `0 8px 24px …`). La charte n'a que des
//     ombres DURES à deux longueurs et zéro flou : `4px 4px 0 #081109`.
//     Une ombre floue est le marqueur le plus fiable de l'ancien style.
//
// Et un cinquième, plus faible mais utile : le filet blanc à 8 % d'opacité,
// qui était le bord des panneaux de verre. La charte borde à l'encre.
//
// ── CE QUE CE SCRIPT NE FAIT PAS ───────────────────────────────────────────
//
// Il ne condamne rien tout seul. Certains flous sont VOULUS — la carte de
// collection est floutée avant qu'on la découvre, c'est un effet de jeu, pas un
// reste de charte. Le script rend donc des emplacements et du contexte, et
// l'arbitrage reste humain. Un audit qui prétend trancher seul se fait ignorer
// dès son premier faux positif.

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, extname } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..");

const DOSSIERS = ["src", "public", "scripts", "."];
const EXTENSIONS = new Set([".jsx", ".tsx", ".ts", ".js", ".mjs", ".css", ".html", ".json"]);
const IGNORER = /node_modules|\/dist\/|\/android\/|\/ios\/|\/visuels\/|\.min\.|package-lock/;

// ── LA PALETTE, ET RIEN D'AUTRE ────────────────────────────────────────────
//
// Recopiée de src/lib/charte.jsx. Toute autre valeur hexadécimale est signalée.
//
// POURQUOI UNE LISTE BLANCHE ET NON UNE LISTE NOIRE. La première version de ce
// script cherchait les anciennes couleurs par une liste de valeurs vues dans
// l'historique. Elle a répondu « aucune trace » de vert sombre alors que
// `#0a1410` était en toutes lettres dans les pages publiques : ma liste noire ne
// couvrait pas cette teinte-là. Un contrôle qui rassure à tort est pire qu'un
// contrôle absent.
//
// Une liste blanche n'a rien à devinner : elle ne peut pas manquer une couleur
// qu'on n'avait pas prévue.
const PALETTE = new Set([
  "#081109", "#f5c22b", "#d9a21a", "#f2e7ce", "#2a9b4e",
  "#4fd07a", "#d93a2b", "#2a6fbf", "#12160f",
  // Le noir et le blanc purs restent légitimes : fond de carte, lettrage sur
  // panneau. Ce sont des non-couleurs, pas des choix de charte.
  "#000", "#000000", "#fff", "#ffffff",
]);

const SIGNATURES = [
  {
    cle: "vert-led",
    titre: "vert LED — l'ancien accent, remplacé par pelouseClaire #4FD07A",
    motif: /#00[Ee]676|#0[Ee][Ff]0|#39[Ff][Ff]14|rgba\(0,\s*230,\s*118/g,
    gravite: "haute",
  },
  {
    cle: "verre",
    titre: "verre flouté — la charte est faite d'aplats opaques cerclés d'encre",
    motif: /backdrop-?[Ff]ilter/g,
    gravite: "haute",
  },
  {
    cle: "ombre-diffuse",
    titre: "ombre diffuse — la charte n'a que des ombres dures « Npx Npx 0 »",
    // Trois longueurs = il y a un flou. On exclut le cas `… 0 <couleur>` en
    // exigeant que la troisième longueur ne soit pas 0.
    motif: /(?:box-)?[Ss]hadow"?\s*:\s*"?[^",;}]*?\d+px\s+-?\d+px\s+(?!0[^\d])\d+px/g,
    gravite: "moyenne",
  },
  {
    cle: "filet-blanc",
    titre: "filet blanc à 8 % — l'ancien bord des panneaux de verre",
    motif: /rgba\(255,\s*255,\s*255,\s*0?\.0[5-9]\)/g,
    gravite: "faible",
  },
];

// ── SAVOIR CE QUI EST UN COMMENTAIRE ───────────────────────────────────────
//
// La charte et ces scripts DÉCRIVENT abondamment l'ancien style : « le vert LED
// a été remplacé », « backdrop-filter a disparu ». Citer n'est pas employer, et
// un audit qui signale ses propres explications se fait ignorer.
//
// La première version testait le début de ligne (`//`, `*`, `/*`). Ça marche sur
// la première et la dernière ligne d'un bloc, et ça rate toutes celles du milieu
// qui ne commencent pas par une étoile — c'est comme ça que le commentaire de la
// charte sur `backdrop-filter` a été signalé comme une infraction.
//
// On suit donc réellement l'état `/* … */` et `<!-- … -->` d'une ligne à l'autre.
//
// CE QU'ON NE FAIT PAS, DÉLIBÉRÉMENT : traiter `//` comme un début de commentaire
// dans ce balayage. Les pages légales contiennent `https://fonts.googleapis.com`,
// et une règle naïve marquerait ces lignes comme commentées — donc les
// EXCLURAIT de l'audit. Un faux négatif coûte plus cher qu'un faux positif : il
// rassure. Le `//` reste traité par le test de début de ligne, où il est sans
// ambiguïté.
// Ce qui reste d'un fragment une fois retirées les accolades de la syntaxe JSX.
const codeNu = (s) => s.replace(/[{}]/g, "").trim();

function lignesCommentees(texte) {
  const lignes = texte.split("\n");
  const commentee = new Array(lignes.length).fill(false);
  let bloc = null;          // "/*" ou "<!--" quand on est dedans
  lignes.forEach((ligne, i) => {
    let reste = ligne, vuDuCode = false, debutBloc = bloc !== null;
    while (reste.length) {
      if (bloc) {
        const fin = reste.indexOf(bloc === "/*" ? "*/" : "-->");
        if (fin === -1) { reste = ""; break; }
        reste = reste.slice(fin + (bloc === "/*" ? 2 : 3));
        bloc = null;
      } else {
        const o1 = reste.indexOf("/*"), o2 = reste.indexOf("<!--");
        const o = o1 === -1 ? o2 : o2 === -1 ? o1 : Math.min(o1, o2);
        // Un commentaire JSX s'écrit `{/* … */}` : les accolades sont la syntaxe
        // qui le porte, pas du code qui l'accompagne. Sans les retirer, la
        // première ligne d'un commentaire JSX passe pour du code — et c'est
        // ainsi que l'explication du halo vert (LePont.jsx:11611) était comptée
        // comme une infraction au même titre que le halo lui-même.
        if (o === -1) { if (codeNu(reste)) vuDuCode = true; break; }
        if (codeNu(reste.slice(0, o))) vuDuCode = true;
        bloc = o === o1 ? "/*" : "<!--";
        reste = reste.slice(o + (bloc === "/*" ? 2 : 4));
      }
    }
    // Commentée = la ligne était déjà dans un bloc ou en ouvre un, ET elle ne
    // porte aucun code en dehors.
    commentee[i] = (debutBloc || bloc !== null || /\/\*|<!--/.test(ligne)) && !vuDuCode;
  });
  return commentee;
}

// Le test de début de ligne, conservé pour `//`, `*`, `--` : sans ambiguïté là
// où le balayage de blocs ne peut pas trancher.
function ligneDeCommentaire(nu) {
  return nu.startsWith("//") || nu.startsWith("*") || nu.startsWith("/*")
      || nu.startsWith("--") || nu.startsWith("<!--");
}

async function fichiers(dossier, profondeur = 0) {
  const out = [];
  let entrees;
  try { entrees = await readdir(join(racine, dossier), { withFileTypes: true }); }
  catch { return out; }
  for (const e of entrees) {
    const chemin = join(dossier, e.name);
    if (IGNORER.test("/" + chemin.replace(/\\/g, "/") + "/")) continue;
    if (e.isDirectory()) {
      if (e.name.startsWith(".") && e.name !== ".github") continue;
      if (profondeur < 4) out.push(...await fichiers(chemin, profondeur + 1));
    } else if (EXTENSIONS.has(extname(e.name))) {
      out.push(chemin);
    }
  }
  return out;
}

// Racine : uniquement les fichiers du premier niveau, pas une descente.
const liste = new Set();
for (const d of DOSSIERS) {
  if (d === ".") {
    for (const e of await readdir(racine, { withFileTypes: true })) {
      if (e.isFile() && EXTENSIONS.has(extname(e.name)) && !IGNORER.test(e.name)) liste.add(e.name);
    }
  } else {
    for (const f of await fichiers(d)) liste.add(f);
  }
}

const trouvailles = new Map(SIGNATURES.map((s) => [s.cle, []]));
for (const f of [...liste].sort()) {
  let texte;
  try { texte = await readFile(join(racine, f), "utf8"); } catch { continue; }
  // Le fichier de la charte lui-même DÉCRIT l'ancien style dans ses
  // commentaires : le citer n'est pas l'employer. Idem pour ce script.
  const lignes = texte.split("\n");
  const enCommentaire = lignesCommentees(texte);
  for (const s of SIGNATURES) {
    lignes.forEach((ligne, i) => {
      s.motif.lastIndex = 0;
      if (!s.motif.test(ligne)) return;
      // Une explication n'est pas une trace : c'est ce qui distingue un audit
      // utile d'un audit bruyant.
      const nu = ligne.trim();
      if (enCommentaire[i] || ligneDeCommentaire(nu)) return;
      trouvailles.get(s.cle).push({ f, n: i + 1, texte: nu.slice(0, 150) });
    });
  }
}

// ── PASSAGE 1 : LES COULEURS HORS PALETTE ─────────────────────────────────
const horsPalette = new Map();   // couleur -> [{f, n}]
for (const f of [...liste].sort()) {
  let texte;
  try { texte = await readFile(join(racine, f), "utf8"); } catch { continue; }
  // charte.jsx définit la palette : ses propres valeurs ne sont pas des écarts.
  // Et ce script les liste aussi.
  if (/charte\.jsx$|audit-charte\.mjs$/.test(f)) continue;
  // ── LES TABLES DE DONNÉES NE SONT PAS DE LA CHARTE ──────────────────────
  //
  // CLUB_COLORS contient les VRAIES couleurs des clubs : #C8102E est le rouge de
  // Liverpool, pas un reste d'ancienne charte. Sans cette exclusion, l'audit
  // rendait 324 teintes dont l'immense majorité était de la donnée — et un
  // rapport noyé dans le bruit ne se lit pas, donc ne sert à rien.
  //
  // On suit l'accolade plutôt que de deviner des numéros de ligne : la table
  // grandira sans que ce script ait à le savoir.
  let dansDonnees = false;
  const enCommentaire = lignesCommentees(texte);
  texte.split("\n").forEach((ligne, i) => {
    const nu = ligne.trim();
    if (/^(export )?const [A-Z_]*(COLORS|COULEURS)\b.*=\s*\{/.test(nu)) dansDonnees = true;
    else if (dansDonnees && /^\};?$/.test(nu)) { dansDonnees = false; return; }
    if (dansDonnees) return;
    if (enCommentaire[i] || ligneDeCommentaire(nu)) return;
    for (const m of ligne.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const c = m[0].toLowerCase();
      // On ignore les formes à 4 et 8 chiffres (couleur + alpha) et les ancres
      // HTML : seules les couleurs à 3 ou 6 chiffres nous intéressent.
      if (c.length !== 4 && c.length !== 7) continue;
      if (PALETTE.has(c)) continue;
      if (!horsPalette.has(c)) horsPalette.set(c, []);
      horsPalette.get(c).push({ f, n: i + 1 });
    }
  });
}
const tri = [...horsPalette].sort((a, b) => b[1].length - a[1].length);
console.log((tri.length ? "❌ " : "✅ ") + "COULEURS HORS PALETTE");
console.log("   " + (tri.length ? tri.length + " teinte(s) distincte(s), "
  + tri.reduce((n, [, v]) => n + v.length, 0) + " emplacement(s)" : "aucune"));
for (const [c, ou] of tri.slice(0, 18)) {
  const parF = new Map();
  for (const o of ou) parF.set(o.f, (parF.get(o.f) || 0) + 1);
  console.log("   " + c.padEnd(9) + String(ou.length).padStart(3) + "x   "
    + [...parF].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([f, n]) => f + " (" + n + ")").join(", "));
}
if (tri.length > 18) console.log("   … et " + (tri.length - 18) + " autre(s) teinte(s)");

// ── PASSAGE 2 : LES VARIABLES CSS FANTÔMES ────────────────────────────────
//
// POURQUOI CE PASSAGE EXISTE. Le passage 1 cherche des valeurs hexadécimales.
// Il a donc laissé passer, dans les deux pages légales, un `style="color:
// var(--accent)"` — `--accent` étant une variable de L'ANCIENNE charte, qui n'a
// pas été redéclarée dans la nouvelle. Aucun hexadécimal, aucune signature
// connue : invisible pour l'audit, et pourtant c'est bien un reste.
//
// Une variable non définie ne casse rien bruyamment : la déclaration devient
// invalide, la propriété retombe sur sa valeur héritée, et la page reste
// « presque » juste. C'est exactement le genre de reste qui survit à un
// changement de charte — il ne se voit qu'en comparant à l'intention.
//
// On ne regarde que les pages autonomes (.html, .css) : là, une variable doit
// être définie dans le fichier même. Dans le JSX, les couleurs viennent de
// l'objet `G` de charte.jsx, pas de variables CSS.
const fantomes = [];
for (const f of [...liste].sort()) {
  if (!/\.(html|css)$/.test(f) || /audit-charte/.test(f)) continue;
  let texte;
  try { texte = await readFile(join(racine, f), "utf8"); } catch { continue; }
  const definies = new Set();
  for (const m of texte.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) definies.add(m[1]);
  const enCommentaire = lignesCommentees(texte);
  texte.split("\n").forEach((ligne, i) => {
    if (enCommentaire[i] || ligneDeCommentaire(ligne.trim())) return;
    for (const m of ligne.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)\s*(?:,[^)]*)?\)/g)) {
      // `var(--x, valeur)` porte sa propre solution de repli : ce n'est pas un
      // fantôme, c'est une valeur par défaut assumée.
      if (/,/.test(m[0])) continue;
      if (definies.has(m[1])) continue;
      fantomes.push({ f, n: i + 1, nom: m[1], texte: ligne.trim().slice(0, 120) });
    }
  });
}
console.log("\n" + (fantomes.length ? "❌ " : "✅ ") + "VARIABLES CSS FANTÔMES — employées, jamais définies");
console.log("   " + (fantomes.length ? fantomes.length + " emplacement(s)" : "aucune"));
for (const t of fantomes) console.log("   " + t.f + ":" + t.n + "  " + t.nom + "   " + t.texte);

let total = horsPalette.size + fantomes.length;
for (const s of SIGNATURES) {
  const lot = trouvailles.get(s.cle);
  total += lot.length;
  const icone = lot.length === 0 ? "✅" : s.gravite === "haute" ? "❌" : s.gravite === "moyenne" ? "⚠️ " : "◦ ";
  console.log("\n" + icone + " " + s.titre.toUpperCase());
  console.log("   " + (lot.length === 0 ? "aucune trace" : lot.length + " emplacement(s)"));
  const parFichier = new Map();
  for (const t of lot) {
    if (!parFichier.has(t.f)) parFichier.set(t.f, []);
    parFichier.get(t.f).push(t);
  }
  for (const [f, ts] of [...parFichier].sort((a, b) => b[1].length - a[1].length)) {
    console.log("   " + f + "  (" + ts.length + ")");
    for (const t of ts.slice(0, 6)) console.log("      :" + t.n + "  " + t.texte);
    if (ts.length > 6) console.log("      … et " + (ts.length - 6) + " autre(s)");
  }
}

console.log("\n── " + liste.size + " fichiers examinés, " + total + " emplacement(s) à juger.");
console.log("   Les flous VOULUS (carte de collection avant découverte) sont des faux");
console.log("   positifs légitimes : ce script localise, il ne tranche pas.");
