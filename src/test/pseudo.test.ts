import { describe, it, expect } from "vitest";
import { pseudoInterdit, squelettesPseudo, TERMES_INTERDITS } from "@/lib/pseudo";

// Un filtre de pseudos se juge sur DEUX chiffres, et le second compte plus que
// le premier : ce qu'il bloque, et ce qu'il laisse passer. Un filtre qui refuse
// « Nigeria » ou « antiraciste » fait plus de dégâts qu'un filtre qui laisse
// passer un cas tordu — le premier chasse des joueurs réels, le second sera
// signalé et corrigé.
//
// Les deux listes ci-dessous sont donc à garder à jour ENSEMBLE : on n'ajoute
// pas un terme à `src/lib/pseudo.ts` sans se demander quel mot innocent le
// contient, et sans l'écrire dans LEGITIMES si le doute existe.

// ── Ce qui doit tomber ──────────────────────────────────────────────────────
const REFUSES: [string, string][] = [
  // Le cas demandé, et ses contournements
  ["hitler", "haine"],
  ["Hitler", "haine"],
  ["HITLER88", "haine"],
  ["H1tl3r", "haine"],
  ["h1tl3r_88", "haine"],
  ["h.i.t.l.e.r", "haine"],
  ["h_i_t_l_e_r", "haine"],
  ["hiiitler", "haine"],
  ["hîtlér", "haine"],
  ["HiTlEr", "haine"],
  ["adolf-hitler", "haine"],
  ["Adolf_H1TLER", "haine"],
  ["SiegHeil", "haine"],
  ["s13gh31l", "haine"],
  // Autres références nazies
  ["nazi", "haine"],
  ["n4z1", "haine"],
  ["NeoNazi42", "haine"],
  ["Goebbels", "haine"],
  ["auschwitz", "haine"],
  ["1488", "haine"],
  ["hh88", "haine"],
  ["8-8-1-4", "haine"],
  ["kukluxklan", "haine"],
  ["WhitePower", "haine"],
  // Sigles, seulement quand le pseudo entier ne dit que ça
  ["s_s", "haine"],
  ["kkk", "haine"],
  ["h.h", "haine"],
  ["raciste", "haine"],
  // Dictateurs
  ["mussolini", "haine"],
  ["Staline", "haine"],
  ["binladen", "haine"],
  // Insultes racistes
  ["negro", "haine"],
  ["n3gr0", "haine"],
  ["bougnoule", "haine"],
  ["salearabe", "haine"],
  ["coon", "haine"],
  ["spic", "haine"],
  // Insultes
  ["encule", "insulte"],
  ["3ncul3", "insulte"],
  ["salope", "insulte"],
  ["NiqueTaMere", "insulte"],
  ["n1qu3t4m3r3", "insulte"],
  ["asshole", "insulte"],
  ["assshole", "insulte"],
  ["fuck", "insulte"],
  ["p.d", "insulte"],
  ["pedophile", "insulte"],
  // Usurpation
  ["admin", "usurpation"],
  ["Admin", "usurpation"],
  ["goatfc", "usurpation"],
  ["GoatFC_Officiel", "usurpation"],
  ["moderateur", "usurpation"],
  ["administrator", "usurpation"],
  ["null", "usurpation"],
];

// ── Ce qui doit passer : le vrai test ───────────────────────────────────────
// Trois familles, toutes des faux positifs classiques des filtres naïfs :
// des pays et nationalités, des noms de footballeurs, et des mots dont les
// lettres contiennent un terme de la liste.
const LEGITIMES = [
  // Pays et nationalités — « Nigeria » et « nigérien » contiennent « niger »
  "Nigeria", "nigerien", "NigeriaFan", "Niger", "Mongolie", "mongol",
  "Cameroun", "Senegal", "Pakistan", "pakistanais",
  // Noms de footballeurs et d'entraîneurs qui heurtent la liste
  "Franco", "FrancoBaresi", "Reich", "Lynch", "Aryan", "Sieger",
  "Pirlo", "Zidane", "Mbappe", "Haaland", "Vinicius", "Sane", "Kane",
  // Le problème de Scunthorpe, dans toutes ses variantes
  "Scunthorpe", "Penistone", "Boss", "leboss", "BigBoss", "Bossman",
  "Raccoon", "cocoon", "Spicy", "spice", "Assassin", "Assist", "Bassin",
  "Analyse", "analyste", "Cumbria", "Documents", "Consuelo", "conseil",
  "Cultura", "calcul", "Sexton", "Essex", "Pornic", "Shitake",
  "antiraciste", "Antifa", "Melon", "Titi", "Massimo", "Bitter",
  "Nazionale", "AzzurriNazionale", "nazionali", "Labbe", "Labbé", "Grabbe",
  "Klopp", "Kloppo", "Pepe", "Pep", "Guardiola",
  // Pseudos ordinaires, avec les chiffres qu'on met vraiment
  "jules88", "lucas14", "akram1988", "nadia_18", "james10", "kader-7",
  "toto2000", "Mehdi_92", "vice", "sjdrums", "strudel", "GOAT_Akram",
];

describe("pseudos interdits", () => {
  for (const [pseudo, motif] of REFUSES) {
    it("refuse « " + pseudo + " »", () => {
      expect(pseudoInterdit(pseudo), pseudo).toBe(motif);
    });
  }

  it("laisse passer les pseudos légitimes", () => {
    const bloques = LEGITIMES.filter((p) => pseudoInterdit(p) !== null)
      .map((p) => p + " → " + pseudoInterdit(p));
    expect(bloques).toEqual([]);
  });

  it("ne bloque jamais un nombre seul, année de naissance ou numéro de maillot", () => {
    // 88, 14 et 18 sont des sigles d'extrême droite ET les années de naissance
    // d'une bonne partie des joueurs. Le pseudo nu ne doit pas tomber.
    for (const n of ["88", "14", "18", "1988", "2014", "10", "7", "9"]) {
      expect(pseudoInterdit(n), n).toBeNull();
      expect(pseudoInterdit("leo" + n), "leo" + n).toBeNull();
    }
  });

  it("rend null sur du vide, sans jeter", () => {
    expect(pseudoInterdit("")).toBeNull();
    expect(pseudoInterdit("___")).toBeNull();
    expect(pseudoInterdit(undefined as any)).toBeNull();
  });
});

describe("hygiène des listes", () => {
  // Un terme court en PARTIEL est la façon la plus sûre de bloquer des
  // innocents : « ss » y refuserait « boss ». La barre est à cinq lettres, et
  // tout ce qui est plus court doit vivre dans EXACTS.
  it("n'accepte aucun terme partiel de moins de quatre lettres", () => {
    const courts: string[] = [];
    for (const [motif, liste] of Object.entries(TERMES_INTERDITS.PARTIELS)) {
      for (const t of liste as string[]) {
        const cle = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
        if (cle.length < 4) courts.push(motif + " : " + t);
      }
    }
    expect(courts).toEqual([]);
  });

  it("ne garde aucun doublon dans les listes", () => {
    for (const niveau of ["PARTIELS", "EXACTS"] as const) {
      const tous = Object.values(TERMES_INTERDITS[niveau]).flat() as string[];
      const vus = new Set<string>(), doubles: string[] = [];
      for (const t of tous) { if (vus.has(t)) doubles.push(t); vus.add(t); }
      expect(doubles, niveau).toEqual([]);
    }
  });

  // Le piège dans lequel on tombe en allongeant la liste : ajouter un partiel
  // qui contient déjà un autre partiel ne sert à rien, et fait croire à une
  // couverture qu'on a déjà.
  it("ne garde aucun partiel redondant avec un autre", () => {
    const tous = Object.values(TERMES_INTERDITS.PARTIELS).flat() as string[];
    const redondants = tous.filter((t) =>
      tous.some((autre) => autre !== t && t.includes(autre)));
    expect(redondants).toEqual([]);
  });
});

describe("squelettes", () => {
  it("relit le 1 comme un i ET comme un l", () => {
    const f = squelettesPseudo("h1tler");
    expect(f).toContain("hitler");
    expect(f).toContain("hltler");
  });

  it("retire accents, séparateurs et répétitions", () => {
    expect(squelettesPseudo("Hé-Ho_Là")).toContain("hehola");
    expect(squelettesPseudo("aaabbb")).toContain("ab");
  });
});
