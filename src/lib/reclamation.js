// RÉCLAMATION DU LOT — la logique, isolée de l'écran.
//
// Ce qui est ici n'affiche rien et n'appelle rien : ce sont les règles qui
// décident QUI peut réclamer, POUR QUEL MOIS, et ce qu'on accepte comme
// saisie. Isolées parce qu'elles sont éprouvables sans navigateur, et parce
// qu'une règle enfouie dans un composant de 15 000 lignes ne se relit pas.
//
// ── CE QUE CE FICHIER NE FAIT PAS, ET POURQUOI C'EST ESSENTIEL ─────────────
//
// Il ne décide RIEN de sûr. Tout ce qu'il calcule est refait côté serveur par
// `bb_reclamer_lot` (docs/supabase-reclamation.sql). Ici, c'est du confort :
// ne pas proposer un bouton qui échouera, ne pas envoyer une adresse email
// manifestement fautive.
//
// Le ticket d'origine demandait « un HMAC du player_id ». Il n'y en a pas, et
// c'est délibéré : une signature calculée dans le navigateur suppose une clé
// dans le bundle, donc lisible par quiconque ouvre les outils de développement.
// Cette clé permettrait alors de signer le player_id d'un AUTRE joueur et de
// réclamer son lot. Une serrure dont la clé est collée sur la porte est pire
// qu'une porte ouverte : elle fait croire que c'est fermé.
//
// Le seul secret qui existe côté joueur est son code de récupération, et il
// n'est vérifiable que là où il est stocké — sur le serveur, dans une colonne
// que le client ne peut pas lire.

// La saison 1 est avril 2026 (SEASON_START dans LePont.jsx). Les saisons sont
// des mois calendaires consécutifs, donc le mois se déduit du numéro sans avoir
// à interroger quoi que ce soit.
export const SAISON_1 = { annee: 2026, mois: 3 }; // mois en base 0 : 3 = avril

/**
 * Le mois calendaire d'une saison, au format "AAAA-MM".
 *
 * POURQUOI DÉDUIRE PLUTÔT QUE LIRE. La table `bb_seasons` porte une colonne
 * `season_month`, mais `bb_cloturer_saison` ne la remplit pas : elle n'écrit
 * que season_number, champion_id, champion_name, champion_score, mode et
 * ended_at. Les lignes écrites par le serveur ont donc `season_month` à NULL, et
 * s'appuyer dessus reviendrait à ne rien savoir du mois précisément pour les
 * saisons qui comptent. Le numéro, lui, est toujours là.
 */
export function moisDeLaSaison(numero) {
  if (!Number.isInteger(numero) || numero < 1) return null;
  const total = SAISON_1.mois + (numero - 1);
  const annee = SAISON_1.annee + Math.floor(total / 12);
  const mois = ((total % 12) + 12) % 12;
  return annee + "-" + String(mois + 1).padStart(2, "0");
}

/** Le numéro de saison d'un mois "AAAA-MM" — la réciproque, utile aux essais. */
export function saisonDuMois(mois) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mois || ""));
  if (!m) return null;
  const n = (Number(m[1]) - SAISON_1.annee) * 12 + (Number(m[2]) - 1 - SAISON_1.mois) + 1;
  return n >= 1 ? n : null;
}

/**
 * Ce joueur a-t-il un lot à réclamer ?
 *
 * `saisons` : les lignes de bb_seasons (champion_id, season_number).
 * `lots`    : les lignes de bb_lots (season_number, intitule) — la liste des
 *             saisons pour lesquelles un lot a RÉELLEMENT été mis en jeu.
 *
 * La double condition est le point important : être champion ne suffit pas, il
 * faut que ce mois-là ait porté un lot. Sinon, dès la deuxième saison, tous les
 * anciens champions verraient un bouton « réclamer » qui ne mène à rien.
 */
export function lotAReclamer(playerId, saisons, lots) {
  if (!playerId || !Array.isArray(saisons) || !Array.isArray(lots)) return null;
  const parNumero = new Map();
  for (const l of lots) {
    if (l && Number.isInteger(l.season_number)) parNumero.set(l.season_number, l);
  }
  // La plus récente d'abord : si deux mois ont porté un lot, on propose celui
  // qu'on vient de gagner, pas celui de l'an dernier.
  const gagnees = saisons
    .filter((s) => s && s.champion_id === playerId && parNumero.has(s.season_number))
    .sort((a, b) => b.season_number - a.season_number);
  if (gagnees.length === 0) return null;
  const s = gagnees[0];
  const lot = parNumero.get(s.season_number);
  return {
    saison: s.season_number,
    mois: moisDeLaSaison(s.season_number),
    intitule: lot.intitule,
    pseudo: s.champion_name || null,
    score: s.champion_score ?? null,
  };
}

/**
 * Une adresse email plausible.
 *
 * On ne cherche PAS à valider une adresse selon la RFC 5322 — c'est un
 * problème sans fond, et une expression régulière qui prétend le faire finit
 * toujours par refuser une adresse valide. On écarte seulement ce qui ne peut
 * manifestement pas aboutir, parce que la seule vraie validation d'une adresse
 * est qu'un message y arrive.
 */
export function emailPlausible(valeur) {
  const v = String(valeur || "").trim();
  if (v.length < 6 || v.length > 254) return false;
  if (/\s/.test(v)) return false;
  const parts = v.split("@");
  if (parts.length !== 2) return false;
  const [local, domaine] = parts;
  if (!local || local.length > 64) return false;
  if (!domaine.includes(".")) return false;
  if (domaine.startsWith(".") || domaine.endsWith(".") || domaine.includes("..")) return false;
  // Le domaine doit finir par au moins deux lettres.
  return /\.[a-zA-Z]{2,}$/.test(domaine);
}

/** Le format d'un code de récupération, tel que l'app le génère. */
export const MOTIF_CODE = /^GOATFC-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Met un code saisi dans sa forme canonique — majuscules, sans espaces. */
export function normaliserCode(valeur) {
  return String(valeur || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function codeValide(valeur) {
  return MOTIF_CODE.test(normaliserCode(valeur));
}

// Les plateformes proposées. La liste sert l'écran ET le règlement, qui promet
// « plateforme au choix du gagnant ». `autre` existe pour ne pas transformer une
// promesse ouverte en menu fermé.
export const PLATEFORMES = [
  { cle: "ps5", nom: "PlayStation 5" },
  { cle: "xbox", nom: "Xbox Series X|S" },
  { cle: "pc", nom: "PC" },
  { cle: "switch", nom: "Nintendo Switch" },
  { cle: "autre", nom: "Autre / carte cadeau" },
];

export function plateformeValide(cle) {
  return PLATEFORMES.some((p) => p.cle === cle);
}

/**
 * Le formulaire est-il envoyable ? Rend la liste des manques, pas un booléen :
 * un écran qui dit « formulaire invalide » sans dire quoi fait recommencer à
 * l'aveugle.
 */
export function manques({ code, email, plateforme, autorisation }) {
  const out = [];
  if (!codeValide(code)) out.push("code");
  if (!emailPlausible(email)) out.push("email");
  if (!plateformeValide(plateforme)) out.push("plateforme");
  if (!autorisation) out.push("autorisation");
  return out;
}

/**
 * Un code de récupération tiré au sort SÛREMENT.
 *
 * POURQUOI CE N'EST PLUS `Math.random()`. Tant que ce code ne gardait qu'un
 * pseudo, la qualité du tirage était sans conséquence. Il est devenu la PREUVE
 * D'IDENTITÉ qui donne accès à un lot : `Math.random()` n'est pas prévu pour
 * résister à quelqu'un qui cherche à prédire un tirage, et l'implémentation
 * n'offre aucune garantie sur ce point.
 *
 * `crypto.getRandomValues` est présent partout où l'app tourne. Le repli sur
 * `Math.random()` n'existe que pour ne jamais empêcher la création d'un compte
 * si l'API venait à manquer — un joueur sans code est un joueur qui perd son
 * compte au premier changement de téléphone, ce qui est un tort certain face à
 * un risque théorique.
 *
 * L'alphabet écarte les caractères ambigus (pas de 0/O, ni de 1/I/L) : le code
 * est fait pour être recopié à la main depuis un écran.
 */
export const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function tirerCode(alea) {
  const n = ALPHABET_CODE.length;
  const tirage = alea || function (taille) {
    const c = (typeof globalThis !== "undefined" && globalThis.crypto) || null;
    if (c && typeof c.getRandomValues === "function") {
      return c.getRandomValues(new Uint8Array(taille));
    }
    const out = new Uint8Array(taille);
    for (let i = 0; i < taille; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  };
  // ── LE REJET, ET POURQUOI IL N'EST PAS FACULTATIF ───────────────────────
  // 256 n'est pas un multiple de 31. Prendre `octet % 31` rendrait les huit
  // premières lettres de l'alphabet plus probables que les autres (9 chances
  // sur 256 contre 8), soit un biais de 12 % qui réduit l'entropie réelle du
  // code. On écarte donc les octets au-delà du plus grand multiple de 31, et on
  // retire. C'est la seule façon d'obtenir un tirage uniforme à partir d'octets.
  const limite = Math.floor(256 / n) * n;
  const lettres = [];
  while (lettres.length < 8) {
    const octets = tirage(16);
    for (const o of octets) {
      if (o >= limite) continue;
      lettres.push(ALPHABET_CODE[o % n]);
      if (lettres.length === 8) break;
    }
  }
  return "GOATFC-" + lettres.slice(0, 4).join("") + "-" + lettres.slice(4).join("");
}
