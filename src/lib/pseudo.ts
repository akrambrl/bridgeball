// Pseudos interdits — modération à l'entrée.
//
// ⚠️ CE FICHIER CONTIENT DES INSULTES ET DES RÉFÉRENCES HAINEUSES. C'est le
// propre d'une liste de blocage : pour refuser un mot, il faut l'écrire. Rien
// ici n'est montré au joueur — seul un message de refus l'est.
//
// ── POURQUOI CE N'EST PAS QU'UNE LISTE ──────────────────────────────────────
// Comparer le pseudo tel quel à une liste ne bloque personne : celui qui veut
// écrire « hitler » écrira « H1tl3r », « h.i.t.l.e.r », « HiiiTLER », « hîtler ».
// Le travail est dans la NORMALISATION, pas dans la liste. On ramène le pseudo à
// un squelette de lettres — accents retirés, chiffres relus comme les lettres
// qu'ils imitent, séparateurs supprimés, lettres étirées détirées — et on
// compare là-dessus.
//
// ── DEUX NIVEAUX, ET C'EST TOUT LE SUJET ────────────────────────────────────
// Chercher un terme N'IMPORTE OÙ dans le pseudo est ce qu'on veut pour les mots
// longs et sans double sens : « sieghitler88 » doit tomber. Appliqué à un mot
// court, ça bloque des innocents — c'est le « problème de Scunthorpe », du nom de
// la ville anglaise que les filtres refusaient. Les termes courts, ou dont un mot
// banal contient les lettres, ne sont donc refusés QUE si le pseudo entier ne dit
// que ça.
//
// Trois exemples de ce que la règle protège, tous vérifiés par le test :
//   • « antiraciste » contient « raciste »  → « raciste » est EXACT, pas partiel
//   • « raccoon » contient « coon »          → idem
//   • « Scunthorpe » contient « cunt »       → idem
//
// ── ET UN TROISIÈME NIVEAU : LES EXCEPTIONS ─────────────────────────────────
// Certains termes doivent rester partiels malgré un mot légitime qui les
// contient. « nazi » est trop important pour être exact-seulement, mais il est
// dans « Nazionale » — et l'app est traduite en italien. Les exceptions sont donc
// RETIRÉES du pseudo avant comparaison : « AzzurriNazionale » devient
// « azzurri », tandis que « NazionaleNazi » laisse « nazi » et tombe.
//
// ── CE QU'ON NE BLOQUE PAS, VOLONTAIREMENT ──────────────────────────────────
// • Les nombres seuls (88, 14, 18). Ce sont des sigles d'extrême droite, mais
//   dans une app de FOOT ce sont d'abord des années de naissance et des numéros
//   de maillot. Refuser « lucas88 » pour attraper un cas sur mille est un mauvais
//   échange. Les combinaisons sans autre lecture (1488) sont refusées, mais
//   seulement comme pseudo ENTIER : « 1488 » normalisé donne « labb », et
//   « Labbé » est un nom de famille français.
// • Les noms de personnes qui sont aussi des mots chargés : Franco (Baresi),
//   Reich, Lynch, Aryan (prénom courant en Inde et en Iran), Sieger
//   (« vainqueur » en allemand). Dans une app de foot traduite en six langues, le
//   faux positif y est plus probable que le vrai.
//
// ── LA LIMITE, DITE FRANCHEMENT ─────────────────────────────────────────────
// Ce contrôle est CÔTÉ CLIENT. La clé `anon` est publique — elle est dans le
// bundle — donc qui sait la lire peut écrire directement dans `bb_pseudos` et se
// poser le pseudo qu'il veut. Ce fichier arrête les joueurs, pas un attaquant.
// Le verrou qui tient est en base : `docs/supabase-pseudos-interdits.sql` rejoue
// la même liste dans un trigger Postgres. Tant qu'il n'est pas appliqué, la
// modération est une politesse, pas une garantie.

/** Ce qui a motivé le refus. Sert à choisir le message et à journaliser. */
export type MotifRefus = "haine" | "insulte" | "usurpation";

// Chiffres et symboles relus comme les lettres qu'ils imitent. Le « 1 » est
// AMBIGU (i ou l) : il donne deux lectures, testées toutes les deux — sinon
// « h1tler » passait, ou « hit1er » passait, selon le choix fait ici.
const SUBSTITUTIONS: Record<string, string> = {
  "0": "o", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
  "@": "a", "$": "s", "!": "i", "|": "i", "+": "t", "€": "e", "£": "l", "¡": "i",
};

const sansAccent = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Les squelettes d'une chaîne. Sert AUSSI BIEN au pseudo qu'aux termes de la
 * liste, et c'est essentiel : traiter les deux côtés différemment est ce qui a
 * produit le pire défaut de ce fichier. Une première version retirait les
 * chiffres des termes — « hh88 » devenait « hh », puis « h » une fois les
 * répétitions écrasées, et refusait TOUT pseudo contenant la lettre h. Haaland,
 * Lynch, Scunthorpe et Mehdi étaient tous bloqués.
 */
function squelettes(chaine: string): string[] {
  const base = sansAccent(chaine || "");
  const formes = new Set<string>();
  for (const lectureDuUn of ["i", "l"]) {
    let lettres = "";
    for (const c of base) {
      if (c === "1") lettres += lectureDuUn;
      else if (SUBSTITUTIONS[c]) lettres += SUBSTITUTIONS[c];
      else if (c >= "a" && c <= "z") lettres += c;
      // Tout le reste — chiffres non substitués, _, -, . — disparaît : c'est ce
      // qui fait tomber « h.i.t.l.e.r » et « s_s ».
    }
    if (lettres) formes.add(lettres);
  }
  return [...formes];
}

/**
 * Réduit les lettres répétées TROIS FOIS OU PLUS à une seule — et pas les
 * doubles. La distinction n'est pas un détail : personne n'écrit trois lettres
 * de suite par accident, donc « hiiitler » est une évasion. Mais écraser les
 * DOUBLES confondrait « nigger » avec « niger » — un pays, une nationalité, et
 * les fiches nigériennes et nigérianes de la base. C'est ce raccourci qui
 * faisait refuser le pseudo « Nigeria ».
 */
const deStretch = (s: string) => s.replace(/(.)\1{2,}/g, "$1");

/** Formes d'un pseudo : telle quelle, et détirée. */
export function squelettesPseudo(pseudo: string): string[] {
  const formes = new Set<string>();
  for (const f of squelettes(pseudo)) { formes.add(f); formes.add(deStretch(f)); }
  return [...formes];
}

// Les termes ne sont normalisés qu'une fois : leurs squelettes ne changent
// jamais, et `pseudoInterdit` peut être appelé à chaque frappe.
const memo = new Map<string, string[]>();
function formesTerme(t: string): string[] {
  let f = memo.get(t);
  if (!f) { f = squelettes(t); memo.set(t, f); }
  return f;
}

// ── Mots légitimes qui contiennent un terme interdit ────────────────────────
// Retirés du pseudo avant comparaison. À n'utiliser que quand le terme DOIT
// rester partiel : sinon, déplacer le terme dans EXACTS est plus simple.
const EXCEPTIONS = [
  "nazionale", "nazional", "nazioni", // italien : « nazi » est dedans
  "renaissance",                       // « naissance » n'a rien à voir, mais
                                       // « renai » + « ss » : garde-fou
];

// ── Termes cherchés N'IMPORTE OÙ dans le pseudo ─────────────────────────────
// Mots longs et sans double sens. Le test refuse toute entrée de moins de quatre
// lettres ici, refuse les redondances, et vérifie qu'aucune n'apparaît dans une
// liste de pseudos légitimes — c'est ce garde-fou qui empêche la liste de dériver.
const PARTIELS: Record<MotifRefus, string[]> = {
  haine: [
    // Nazisme, IIIe Reich, camps
    "hitler", "siegheil", "sieghail", "nazi", "fuhrer", "fuehrer", "gestapo",
    "waffenss", "goebbels", "himmler", "mengele", "eichmann", "auschwitz",
    "birkenau", "treblinka", "sobibor", "buchenwald", "holocaust",
    "swastika", "hakenkreuz", "troisiemereich", "thirdreich", "drittesreich",
    "sturmabteilung", "blutundehre", "bloodandhonour",
    // Suprémacisme — les organisations, nommées, plutôt que les adjectifs, qui
    // sont aussi des mots de dictionnaire ou des prénoms.
    "kuklux", "whitepower", "whitepride", "whitesupremac",
    "suprematieblanche", "aryanbrotherhood", "aryannation", "racewar",
    // Dictateurs et terroristes, quand le nom n'a pas d'autre porteur courant.
    // « Franco » est exclu exprès : c'est aussi le prénom de Franco Baresi.
    "mussolini", "stalin", "polpot", "binladen", "daesh", "daech",
    "alqaeda", "bokoharam", "breivik", "milosevic",
    // Appels au meurtre
    "genocide", "killall", "tuezles", "mortaux", "deathto", "gasthe", "gazez",
    // Insultes racistes et ethniques (FR / EN). « niger » est absent : il est
    // dans « Nigeria » et « nigérien ».
    "negro", "negre", "nigger", "nigga", "bougnoul",
    "youpin", "chinetoque", "wetback", "salearabe", "salejuif", "salenoir",
    "saleblanc", "salebeur",
    // Homophobie, transphobie
    "tarlouze", "tapette", "fagot", "faggot", "tranny", "travelo", "battyman",
    // Validisme
    "mongolien", "mongoloid", "trisomique", "retarded",
  ],
  insulte: [
    // Sexuel et scatologique explicite — l'app est jouée par des mineurs
    "encule", "salope", "salopard", "putain", "putassier", "niquetamer",
    "filsdepute", "fuckyou", "motherfucker", "cocksucker", "blowjob",
    "cumshot", "dickhead", "asshole", "ashole", "bullshit", "connard",
    "connasse", "batard", "bastard", "shithead", "sucemoi", "lechemoi",
    "branleur", "branlette", "zboub", "couille", "sperme", "masturb",
    "pornhub", "xvideos", "onlyfans",
    "pedophile", "pedobear", "violeur", "rapist", "zoophile", "inceste",
    // Automutilation : pas une insulte, mais rien à faire dans un pseudo
    "suicide", "pendstoi", "killyourself",
  ],
  usurpation: [
    // Se faire passer pour l'app ou son équipe. Dans un jeu avec classement,
    // demandes d'amis et signalements, c'est un vrai vecteur d'arnaque.
    "goatfcofficiel", "goatfcofficial", "goatfcadmin", "goatfcsupport",
    "goatfcteam", "equipegoatfc", "administrateur", "administrator",
    "moderateur", "moderator",
  ],
};

// ── Termes refusés SEULEMENT si le pseudo entier ne dit que ça ───────────────
// Sigles, mots courts, et tout terme dont les lettres se retrouvent dans un mot
// banal : « ss » est dans « boss », « coon » dans « raccoon », « spic » dans
// « spicy », « cunt » dans « Scunthorpe », « con » dans « Consuelo », « labb »
// (la forme normalisée de 1488) dans « Labbé ».
//
// Un pseudo fait au moins trois caractères, mais ces entrées de deux lettres ne
// sont pas mortes : la normalisation retire les séparateurs, donc « s_s » et
// « p.d » arrivent ici.
const EXACTS: Record<MotifRefus, string[]> = {
  haine: ["ss", "hh", "kkk", "nsdap", "zog", "raciste", "racist",
    "coon", "spic", "chink", "gook", "paki", "kike", "raton",
    "1488", "8814", "hh88", "heil", "sieg", "swast"],
  insulte: ["pd", "pede", "pute", "nique", "ntm", "fdp", "fuck", "shit", "cul",
    "sexe", "sex", "porn", "porno", "bite", "con", "conne", "merde", "penis",
    "vagin", "chatte", "clito", "zizi", "pedo", "viol", "kys",
    "bitch", "whore", "slut", "cunt", "cum", "anal"],
  usurpation: ["admin", "root", "support", "staff", "systeme", "system",
    "goatfc", "null", "undefined"],
};

/** Les listes, exportées pour le trigger SQL et l'audit : une seule source. */
export const TERMES_INTERDITS = { PARTIELS, EXACTS, EXCEPTIONS };

const MOTIFS: MotifRefus[] = ["haine", "insulte", "usurpation"];

/**
 * Le pseudo est-il refusé ? Rend le motif, ou `null` s'il passe.
 *
 *   pseudoInterdit("H1tl3r_88")       → "haine"
 *   pseudoInterdit("Boss")            → null
 *   pseudoInterdit("antiraciste")     → null
 *   pseudoInterdit("AzzurriNazionale")→ null
 */
export function pseudoInterdit(pseudo: string): MotifRefus | null {
  let formes = squelettesPseudo(pseudo);
  if (!formes.length) return null;
  // Les exceptions sont CONSOMMÉES avant toute comparaison : le mot légitime
  // disparaît, et ce qui reste est jugé normalement.
  for (const exc of EXCEPTIONS) {
    for (const e of formesTerme(exc)) {
      if (e) formes = formes.map((f) => f.split(e).join(""));
    }
  }
  formes = formes.filter(Boolean);
  if (!formes.length) return null;
  // La haine d'abord : sur un pseudo qui coche deux cases, c'est le motif qu'on
  // veut voir remonter, pas « insulte ».
  for (const motif of MOTIFS) {
    for (const terme of PARTIELS[motif]) {
      for (const cle of formesTerme(terme)) {
        if (formes.some((f) => f.includes(cle))) return motif;
      }
    }
  }
  for (const motif of MOTIFS) {
    for (const terme of EXACTS[motif]) {
      for (const cle of formesTerme(terme)) {
        if (formes.some((f) => f === cle)) return motif;
      }
    }
  }
  return null;
}
