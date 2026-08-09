// Collecte les années par club depuis Wikidata pour les joueurs « facile » qui
// ne sont pas encore dans CLUB_SPELLS.
//
// Méthode, identique à celle de la complétion des carrières :
//   1. wbsearchentities pour trouver des QID candidats sur le nom
//   2. on ne retient un QID que s'il est humain, footballeur, ET né l'année que
//      dit players.jsx — un homonyme ne passe pas
//   3. P54 (membre d'une équipe) avec ses qualificatifs P580 (début) et P582
//      (fin) donne les périodes
//
// Règle de sûreté : un joueur n'est retenu que si TOUS les clubs listés dans
// players.jsx sont datés. Une liste partielle serait pire que rien — l'indice
// « mais jamais avec Y » lit ces périodes pour affirmer une ABSENCE, et une
// période manquante lui ferait dire « jamais » d'un vrai coéquipier.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Sorties et cache dans un dossier de travail ignoré par git : ce script
// interroge Wikidata, il n'a pas à laisser 300 réponses JSON dans le dépôt.
const ICI = process.env.SPELLS_DIR || "/tmp/goatfc-spells";
const CACHE = join(ICI, "cache");
mkdirSync(CACHE, { recursive: true });

const UA = "GoatFC-data/1.0 (contact via github.com/akrambrl/bridgeball)";
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, cle) {
  const f = join(CACHE, cle + ".json");
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  for (let essai = 0; essai < 4; essai++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.status === 429) { await dodo(2000 * (essai + 1)); continue; }
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      writeFileSync(f, JSON.stringify(d));
      return d;
    } catch (e) {
      if (essai === 3) throw e;
      await dodo(1200 * (essai + 1));
    }
  }
}

// ── Normalisation des noms de clubs ──────────────────────────────────────
// Wikidata dit « FC Bayern Munich », players.jsx dit « Bayern Munich ». On
// compare des formes réduites : sans accents, sans les sigles de statut, sans
// les mots vides. Deux clubs différents qui se réduiraient pareil seraient un
// faux positif — d'où la liste d'alias explicite pour les cas qu'on connaît.
const ALIAS = {
  "paris saint germain": "psg", "paris sg": "psg",
  "internazionale": "inter milan", "inter": "inter milan",
  "internazionale milano": "inter milan",
  "manchester city": "manchester city", "man city": "manchester city",
  "manchester united": "manchester united", "man utd": "manchester united",
  "atletico de madrid": "atletico madrid", "club atletico de madrid": "atletico madrid",
  "olympique lyonnais": "lyon", "olympique de marseille": "marseille",
  "as saint etienne": "saint etienne", "as monaco": "monaco",
  "rb leipzig": "rb leipzig", "rasenballsport leipzig": "rb leipzig",
  "borussia dortmund": "dortmund", "bvb": "dortmund",
  "bayer 04 leverkusen": "bayer leverkusen", "bayer leverkusen": "bayer leverkusen",
  "tottenham hotspur": "tottenham", "wolverhampton wanderers": "wolves",
  "brighton hove albion": "brighton", "west ham united": "west ham",
  "newcastle united": "newcastle", "leeds united": "leeds united",
  "sporting clube de portugal": "sporting cp", "sporting lisbon": "sporting cp",
  "sport lisboa e benfica": "benfica", "futebol clube do porto": "porto",
  "rc lens": "lens", "racing club de lens": "lens",
  "lille osc": "lille", "losc lille": "lille",
  "stade rennais": "rennes", "stade rennais fc": "rennes",
  "ogc nice": "nice", "fc nantes": "nantes", "girondins de bordeaux": "bordeaux",
  "vitesse arnhem": "vitesse", "sbv vitesse": "vitesse",
  "club brugge kv": "club brugge", "club bruges": "club brugge",
  "juventus": "juventus fc", "juventus turin": "juventus fc",
  "ssc napoli": "napoli", "as roma": "roma", "ss lazio": "lazio",
  "acf fiorentina": "fiorentina", "atalanta bc": "atalanta",
  "real madrid cf": "real madrid", "fc barcelona": "barcelona",
  "sevilla fc": "sevilla", "valencia cf": "valencia",
  "villarreal cf": "villarreal", "real sociedad de futbol": "real sociedad",
  "athletic club": "athletic bilbao", "athletic bilbao": "athletic bilbao",
  "afc ajax": "ajax", "psv eindhoven": "psv", "feyenoord rotterdam": "feyenoord",
  "galatasaray sk": "galatasaray", "fenerbahce sk": "fenerbahce",
  "al nassr fc": "al nassr", "al hilal saudi fc": "al hilal",
  "inter miami cf": "inter miami", "la galaxy": "la galaxy",
  // Clubs renommes ou connus sous un autre nom : aucun jeton commun, il faut
  // le dire explicitement.
  "fcsb": "steaua bucharest", "steaua bucharest": "steaua bucharest",
  "atletico junior": "junior", "junior": "junior",
  "cska moscow": "cska moscou", "cska moscou": "cska moscou",
  "stade rennais": "rennes", "rennais": "rennes",
  "west bromwich albion": "west brom", "west brom": "west brom",
  "sporting": "sporting cp", "sporting cp": "sporting cp",
  "paris saint germain": "psg", "psg": "psg",
  "internazionale milano": "inter milan", "inter milan": "inter milan",
};
// Jetons « decoratifs » : ils peuvent apparaitre d'un cote et pas de l'autre
// sans changer l'identite du club. Tout jeton HORS de cette liste doit se
// retrouver des deux cotes — c'est ce qui empeche « AC Milan » de matcher
// « Inter Milan » : « inter » n'est pas decoratif, il bloque.
const DECOR = new Set(("fc cf ac as ss ssc sc afc cd rc us ud sv vfb vfl bsc kv sk bk bc " +
  "club clube calcio futbol football fussball futebol voetbal foot spor kulubu " +
  "de of the do da du der den el la le les et and " +
  "s k e i a d f c b " +
  "1 04 05 96 98 1899 1900 1901 1902 1904 1905 1907 1908 1909 1910 1913 1919 " +
  "bucuresti bucharest hsc acr osc ogc sbv kaa rsc rcd ca cs sd nk hnk fk sk " +
  "sport sports deportivo real1 associacao asociacion").split(" "));

// Quelques jetons disent la meme ville dans deux langues.
const JETON = { munchen:"munich", muenchen:"munich", milano:"milan", torino:"turin",
  roma:"roma", napoli:"napoli", lisboa:"lisbon", sevilla:"sevilla", wien:"vienna",
  moskva:"moscow", praha:"prague", koln:"cologne", zurich:"zurich",
  eindhoven:"eindhoven", rotterdam:"rotterdam", amsterdam:"amsterdam" };

function jetons(nom) {
  return nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").map((m) => JETON[m] || m).filter(Boolean);
}

// Forme canonique : jetons significatifs, alias applique APRES le nettoyage.
// C'est la que le premier essai se trompait : il cherchait « psg » dans une
// table dont la cle etait « paris saint germain f c », donc jamais trouve.
//
// Les equipes reserve (« Benfica B ») gardent leur B : sans ca, elles se
// confondraient avec l'equipe premiere, et Cancelo aurait deux clubs pour une
// seule serie de dates.
function canon(nom) {
  const brut = jetons(nom);
  const utiles = brut.filter((m) => !DECOR.has(m));
  let c = (ALIAS[utiles.join(" ")] || utiles.join(" ")).trim();
  if (/\s(b|ii)$/i.test(nom.trim()) && !/\sb$/.test(c)) c += " b";
  return c;
}

function correspond(a, b) {
  const ca = canon(a), cb = canon(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  // Le nom court de la base peut etre le debut du nom long de Wikidata
  // (« Montpellier » / « Montpellier Herault Sport Club »). On exige un vrai
  // prefixe de JETONS : « Milan » ne devient donc pas « Inter Milan », dont il
  // n'est pas le debut.
  return cb.startsWith(ca + " ") || ca.startsWith(cb + " ");
}

// ── Programme ────────────────────────────────────────────────────────────
const cibles = JSON.parse(readFileSync(join(ICI, "cible.json"), "utf8"));
const seulement = process.argv[2] ? Number(process.argv[2]) : cibles.length;
const retenus = {}, rejets = [];

for (const p of cibles.slice(0, seulement)) {
  try {
    const rech = await json(
      "https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=6&search="
      + encodeURIComponent(p.nom), "rech-" + p.nom.replace(/[^a-zA-Z0-9]/g, "_"));
    const candidats = (rech.search || []).map((s) => s.id);
    if (!candidats.length) { rejets.push([p.nom, "aucun QID"]); continue; }

    let ent = null, qid = null;
    for (const q of candidats) {
      const d = await json("https://www.wikidata.org/wiki/Special:EntityData/" + q + ".json", "ent-" + q);
      const e = d.entities[q];
      const cl = e.claims || {};
      const humain = (cl.P31 || []).some((c) => c.mainsnak?.datavalue?.value?.id === "Q5");
      const foot = (cl.P106 || []).some((c) => ["Q937857", "Q628099"].includes(c.mainsnak?.datavalue?.value?.id));
      const nais = cl.P569?.[0]?.mainsnak?.datavalue?.value?.time;
      const an = nais ? Number(nais.slice(1, 5)) : null;
      if (humain && foot && an === p.an) { ent = e; qid = q; break; }
      await dodo(120);
    }
    if (!ent) { rejets.push([p.nom, "aucun QID ne colle a l'annee " + p.an]); continue; }

    // P54 → périodes. On ne garde que les clubs que players.jsx connaît.
    const officielDe = (label) => p.clubs.find((c) => correspond(c, label)) || null;
    const trouves = new Map();
    let incomplet = null;
    for (const c of ent.claims?.P54 || []) {
      const cq = c.mainsnak?.datavalue?.value?.id;
      if (!cq) continue;
      const d = await json("https://www.wikidata.org/wiki/Special:EntityData/" + cq + ".json", "ent-" + cq);
      const label = d.entities[cq]?.labels?.en?.value || d.entities[cq]?.labels?.fr?.value;
      if (!label) continue;
      const officiel = officielDe(label);
      if (!officiel) continue;                       // club inconnu de la base : ignoré
      const t0 = c.qualifiers?.P580?.[0]?.datavalue?.value?.time;
      const t1 = c.qualifiers?.P582?.[0]?.datavalue?.value?.time;
      if (!t0) { incomplet = officiel + " (pas de date de debut)"; break; }
      const from = Number(t0.slice(1, 5));
      let to = t1 ? Number(t1.slice(1, 5)) : 2026;
      // Une periode a duree nulle (2023-2023, un pret de six mois note a
      // l'annee) ne chevauchera JAMAIS rien : le test de coequipiers est
      // strict. Elle ferait donc repondre « jamais ensemble » a propos d'un
      // vrai coequipier. On lui donne sa saison.
      if (to <= from) to = from + 1;
      if (!trouves.has(officiel)) trouves.set(officiel, []);
      trouves.get(officiel).push({ club: officiel, from, to });
      await dodo(120);
    }
    if (incomplet) { rejets.push([p.nom, incomplet]); continue; }

    const manquants = p.clubs.filter((c) => !trouves.has(c));
    if (manquants.length) { rejets.push([p.nom, "clubs sans dates : " + manquants.join(", ")]); continue; }

    const vues = new Set();
    const spells = [...trouves.values()].flat()
      .filter((s) => { const k = s.club + s.from + s.to; if (vues.has(k)) return false; vues.add(k); return true; })
      .sort((a, b) => a.from - b.from || a.club.localeCompare(b.club));
    // Wikidata n'est pas toujours juste. Sur Schuster elle porte DEUX passages
    // a l'Atletico, dont un en 1996-1997 ou il etait a Pumas — les deux
    // periodes se chevauchent. Un joueur ne peut pas etre a deux clubs a la
    // fois ; quand ca arrive, une des deux lignes est fausse et on ne sait pas
    // laquelle. On refuse le joueur entier plutot que d'importer l'erreur.
    // Les prets, que Wikidata note parfois en double avec le club proprietaire,
    // tombent aussi — c'est le prix de la regle, et il est bon marche.
    const chevauche = [];
    for (let i = 0; i < spells.length; i++)
      for (let j = i + 1; j < spells.length; j++)
        if (spells[i].club !== spells[j].club &&
            spells[i].from < spells[j].to && spells[j].from < spells[i].to)
          chevauche.push(spells[i].club + " " + spells[i].from + "-" + spells[i].to +
            " ET " + spells[j].club + " " + spells[j].from + "-" + spells[j].to);
    if (chevauche.length) { rejets.push([p.nom, "periodes contradictoires : " + chevauche[0]]); continue; }

    retenus[p.nom] = spells;
    console.log("✓", p.nom, "—", spells.map((s) => s.club + " " + s.from + "-" + s.to).join(" · "));
  } catch (e) {
    rejets.push([p.nom, "erreur : " + String(e).slice(0, 60)]);
  }
}

writeFileSync(join(ICI, "spells-trouves.json"), JSON.stringify(retenus, null, 1));
writeFileSync(join(ICI, "spells-rejets.json"), JSON.stringify(rejets, null, 1));
console.log("\nretenus :", Object.keys(retenus).length, "| rejetes :", rejets.length);
