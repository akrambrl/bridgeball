// ── Normalisation des noms tapés ──────────────────────────────────────────
// Extrait de LePont.jsx pour la même raison que la charte : les jeux qui vivent
// dans leurs propres fichiers (Trouve le joueur, GOAT Guess) en avaient chacun
// recopié une version affaiblie, et les trois avaient divergé.
//
// La version affaiblie ne faisait que `normalize("NFD")` + retrait des accents
// combinants. Or ø, æ, ð, ł, ß et ı sont des LETTRES à part entière, pas des
// lettres accentuées : NFD ne les décompose pas. Højbjerg, Ødegaard et Højlund
// étaient donc introuvables à moins de taper le ø — absent d'un clavier
// français. C'est ce que corrigent les remplacements explicites ci-dessous.

export function normNom(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")        // ø
    .replace(/æ/g, "ae")       // æ
    .replace(/œ/g, "oe")       // œ
    .replace(/ß/g, "ss")       // ß
    .replace(/ł/g, "l")        // ł
    .replace(/[đð]/g, "d")// đ ð
    .replace(/þ/g, "th")       // þ
    .replace(/ı/g, "i")        // ı
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

// Version sans espaces : « Saint-Etienne », « Saint Etienne » et
// « SaintEtienne » doivent tous se rejoindre.
export function normCompactNom(s: string): string {
  return normNom(s).replace(/\s+/g, "");
}

// Normalisation phonétique, pour rattraper les fautes d'oreille
// (« Patchao » → « Paixao »).
export function normPhoneticNom(s: string): string {
  let n = normCompactNom(s);
  n = n.replace(/tch/g, "x").replace(/ch/g, "x").replace(/sh/g, "x");
  n = n.replace(/ph/g, "f").replace(/ck/g, "k").replace(/qu/g, "k");
  n = n.replace(/y/g, "i").replace(/z/g, "s").replace(/w/g, "v");
  n = n.replace(/(.)\1+/g, "$1");   // doubles lettres : « Nassr » ≈ « Naser »
  return n;
}

export function levenshteinNom(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length < b.length) { const t = a; a = b; b = t; }
  if (b.length === 0) return a.length;
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// Tolérance progressive : un mot court ne supporte pas trois fautes sans
// devenir un autre mot.
//
// ── ZÉRO EN DESSOUS DE SIX LETTRES, ET POURQUOI ────────────────────────────
//
// La règle disait « moins de 6 → une faute tolérée ». Sur un nom de quatre
// lettres, une faute, c'est un quart du mot : la tolérance ne rattrape plus une
// frappe malheureuse, elle transforme un nom en un autre. Et le football est
// plein de mononymes courts, donc les collisions ne sont pas théoriques.
//
// Mesuré sur les 5 622 joueurs de la base, huit paires de joueurs DISTINCTS
// étaient confondues par cette tolérance :
//
//     Gavi ↔ Xavi · Bento ↔ Beto · Zico ↔ Zizo · Kaká ↔ Kaku
//     Zico ↔ Pico · Isi ↔ Pizzi · Jonny ↔ Doni · Pizzi ↔ Pirri
//
// Plus le signalement qui a mené ici : « pepe » était accepté pour Pelé, et
// aussi pour Pepi, Pope, Pep — la cible « pele » fait quatre lettres.
//
// Accepter Xavi quand la réponse est Gavi n'est pas de l'indulgence, c'est une
// mauvaise réponse comptée juste. Ça fausse le score, donc le classement, donc
// le concours. Le coût de la sévérité est faible en regard : seuls 62 joueurs
// sur 5 622 portent un nom compact de cinq lettres ou moins, ils sont courts
// donc faciles à taper sans faute, et la liste de suggestions les propose.
export function seuilFuzzy(longueurCible: number): number {
  if (longueurCible <= 5) return 0;
  if (longueurCible < 12) return 2;
  return 3;
}

export function fuzzyNom(saisie: string, cible: string): boolean {
  const g1 = normCompactNom(saisie), t1 = normCompactNom(cible);
  if (g1 === t1) return true;
  if (levenshteinNom(g1, t1) <= seuilFuzzy(t1.length)) return true;
  const g2 = normPhoneticNom(saisie), t2 = normPhoneticNom(cible);
  if (g2 === t2) return true;
  return levenshteinNom(g2, t2) <= seuilFuzzy(t2.length);
}

/**
 * Cherche des joueurs par nom : sous-chaîne d'abord, puis tolérance aux fautes
 * si rien ne sort. Sans ce repli, la validation acceptait « Hojberg » mais la
 * liste de suggestions ne le proposait jamais — le joueur ne pouvait donc pas
 * saisir la réponse que le jeu aurait acceptée.
 */
export function chercheJoueurs<T extends { name: string }>(
  saisie: string,
  joueurs: T[],
  exclus?: (j: T) => boolean,
): T[] {
  const q = normNom(saisie.trim());
  if (!q) return [];
  const dispo = exclus ? joueurs.filter(j => !exclus(j)) : joueurs;
  const directs = dispo.filter(j => j && j.name && normNom(j.name).includes(q));
  if (directs.length || q.length < 4) return directs;
  return dispo.filter(j => j && j.name &&
    normNom(j.name).split(" ").some(mot => mot.length >= 4 && fuzzyNom(q, mot)));
}
