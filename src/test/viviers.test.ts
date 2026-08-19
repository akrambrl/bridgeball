// LE JOUR OÙ THE PLUG NE DÉMARRAIT PLUS, ET OÙ PERSONNE NE L'A VU
//
// Quand la base joueurs est sortie du paquet JS pour être servie en fichier
// (src/lib/donnees.ts), son en-tête a énoncé la règle qui rend l'affaire
// possible : « la seule contrainte est de ne rien CALCULER sur ces données au
// chargement du module ». Les liaisons ESM sont vivantes, donc `PLAYERS` se
// remplit plus tard et les lecteurs voient la nouvelle valeur — mais tout ce qui
// DÉRIVE de ces données à l'import dérive du tableau VIDE.
//
// Cinq index ont été déplacés dans `initDerives()` à ce moment-là. Deux ont été
// oubliés, et les deux étaient des viviers de questions :
//
//   • DB = buildPontDB()  → THE PLUG NE DÉMARRAIT PLUS DU TOUT. `startRound()`
//     trouvait son vivier vide, écrivait « DB empty for diff: facile » dans la
//     console et retournait. On tapait JOUER et on restait sur l'accueil.
//
//   • DUEL_PAIRES = pairesRetenues(...) → GOAT DUEL NE PLANTAIT PAS, ce qui est
//     pire. `duelRollPair()` a un repli, `["Real Madrid", "Barcelona"]`, commenté
//     « ne devrait pas arriver ». Il arrivait à chaque manche : neuf lancements
//     sur neuf ont servi la même affiche. Un mode qui a l'air de marcher se
//     repère bien plus tard qu'un mode qui casse.
//
// Ces deux tests-là auraient attrapé les deux cas. Le troisième attrape la
// PROCHAINE fois : il refuse toute nouvelle dérivation calculée à l'import, en
// suivant les appels de fonction, parce que le défaut n'était pas visible dans la
// ligne fautive — `buildPontDB()` ne mentionne aucune donnée de jeu, c'est son
// corps qui lit PLAYERS_CLEAN.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { __viviers } from "@/components/LePont.jsx";
import { PLAYERS_CLEAN } from "@/lib/donnees";

const RACINE = process.cwd();

describe("les viviers de questions sont remplis", () => {
  // src/test/setup.ts charge l'artefact puis appelle initDerives() : on éprouve
  // donc l'app dans l'état où main.tsx la met avant le premier rendu.
  it("la base est bien chargée dans le harnais", () => {
    // Le garde-fou du garde-fou : si le harnais ne chargeait pas les données,
    // les deux tests suivants échoueraient en accusant le mauvais coupable.
    expect(PLAYERS_CLEAN.length).toBeGreaterThan(4000);
  });

  it("THE PLUG a des questions dans les trois difficultés", () => {
    const { DB } = __viviers();
    for (const diff of ["facile", "moyen", "expert"] as const) {
      expect(Array.isArray(DB[diff]), "DB." + diff + " n'est pas un tableau").toBe(true);
      expect(
        DB[diff].length,
        "DB." + diff + " est vide — startRound() refusera de lancer la partie",
      ).toBeGreaterThan(50);
    }
  });

  it("GOAT DUEL a un vivier de paires, et pas seulement son repli", () => {
    const { DUEL_PAIRES } = __viviers();
    // 36 clubs curés : le commentaire du fichier annonce « bien plus que les 189
    // paires » de l'ancien vivier à 20 clubs. On demande beaucoup moins que ça —
    // le test doit tenir si la curation change — mais assez pour prouver que le
    // vivier existe.
    expect(
      DUEL_PAIRES.length,
      "vivier vide : duelRollPair() servira Real Madrid × Barcelona à chaque manche",
    ).toBeGreaterThan(100);
    // Et il ne doit pas se réduire à la paire de repli.
    const cles = new Set(DUEL_PAIRES.map((p: string[]) => [p[0], p[1]].sort().join("|")));
    expect(cles.size).toBeGreaterThan(100);
  });
});

describe("rien ne se calcule sur les données de jeu au chargement du module", () => {
  // LA RÈGLE, ÉPROUVÉE PLUTÔT QUE COMMENTÉE.
  //
  // On lit chaque fichier de l'app, on repère les fonctions qui touchent aux
  // données de jeu — directement ou en appelant une fonction qui y touche, par
  // fermeture transitive — puis on refuse toute déclaration de haut niveau qui
  // les appelle. C'est la forme exacte du défaut : `const DB = buildPontDB()` ne
  // nomme aucune donnée, c'est le corps de `buildPontDB` qui lit PLAYERS_CLEAN.
  const GRAINES = [
    "PLAYERS", "PLAYERS_CLEAN", "CLUB_INDEX", "PLAYER_DIFF", "PLAYER_BY_NAME",
    "ALL_CLUBS_LIST", "RETIRED_PLAYERS", "GG_SHIRT_10", "GG_WC_WINNERS",
    "GG_CL_WINNERS", "GG_BALLON_DOR", "GG_BALLON_DOR_MULTI",
  ];

  function fichiersApp(dossier: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dossier)) {
      const p = join(dossier, e);
      if (statSync(p).isDirectory()) {
        if (e === "test") continue;
        out.push(...fichiersApp(p));
      } else if (/\.(ts|tsx|jsx)$/.test(e) && e !== "players.jsx") {
        out.push(p);
      }
    }
    return out;
  }

  /** Les déclarations de haut niveau d'un fichier qui dépendent des données. */
  function coupables(src: string): string[] {
    if (!GRAINES.some((g) => src.includes(g))) return [];

    // Le corps de chaque fonction déclarée au niveau du module. On coupe à la
    // première accolade fermante en colonne 0 : c'est le style de tout le dépôt.
    const corps = new Map<string, string>();
    for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm)) {
      const debut = m.index! + m[0].length;
      const fin = src.slice(debut).search(/^\}/m);
      corps.set(m[1], src.slice(debut, fin < 0 ? src.length : debut + fin));
    }

    // Fermeture transitive : une fonction est « sale » si son corps nomme une
    // graine, ou nomme une fonction déjà sale.
    const sales = new Set(GRAINES.filter((g) => src.includes(g)));
    for (let tour = 0; tour < 12; tour++) {
      let bouge = false;
      for (const [nom, c] of corps) {
        if (sales.has(nom)) continue;
        if ([...sales].some((s) => new RegExp("\\b" + s + "\\b").test(c))) { sales.add(nom); bouge = true; }
      }
      if (!bouge) break;
    }

    const trouves: string[] = [];
    for (const m of src.matchAll(/^(const|let|var)\s+(\w+)\s*=\s*([^\n;]{0,200})/gm)) {
      const val = m[3].trimStart();
      // Une fonction n'est pas ÉVALUÉE à l'import, seulement définie — on la
      // laisse passer. Mais il faut reconnaître une DÉFINITION de flèche, pas
      // n'importe quelle valeur qui contient une flèche : la première version de
      // ce test écartait tout ce qui contenait « => », donc elle aurait laissé
      // filer `const X = PLAYERS_CLEAN.filter(p => p)` — la forme la plus
      // évidente du défaut. C'est l'auto-contrôle du test suivant qui l'a montré.
      if (/^(function\b|async\b)/.test(val)) continue;
      // Une définition de flèche, avec son annotation de type de retour
      // éventuelle : `(): Player[] => PLAYERS` est justement la bonne façon de
      // faire — l'accès est PARESSEUX, il relira la liaison vivante à l'appel.
      if (/^(\([^)]*\)(\s*:[^=]{0,80})?|[A-Za-z_$][\w$]*)\s*=>/.test(val)) continue;
      const touche = [...sales].filter((s) => new RegExp("\\b" + s + "\\b").test(val));
      if (touche.length) {
        const ligne = src.slice(0, m.index!).split("\n").length;
        trouves.push(`ligne ${ligne} : ${m[2]} = ${val.slice(0, 44)} → dépend de ${touche.sort()[0]}`);
      }
    }
    return trouves;
  }

  it("aucune dérivation à l'import, dans aucun fichier de src/", () => {
    const listes: string[] = [];
    for (const f of fichiersApp(join(RACINE, "src"))) {
      for (const c of coupables(readFileSync(f, "utf8"))) {
        listes.push(relative(RACINE, f) + " " + c);
      }
    }
    expect(
      listes,
      "ces valeurs sont calculées au chargement du module, donc sur une base VIDE — "
        + "déplace-les dans initDerives(), comme DB et DUEL_PAIRES",
    ).toEqual([]);
  });

  it("et le détecteur détecte vraiment quelque chose", () => {
    // Un test de garde-fou qui ne détecte rien passerait au vert pour toujours.
    // On lui donne le code fautif, tel qu'il était, et il doit le voir — y
    // compris dans sa forme indirecte, qui est celle qui est passée inaperçue.
    const direct = "const X = PLAYERS_CLEAN.filter(p => p);\n";
    expect(coupables(direct).length).toBe(1);

    const indirect = [
      "function bidule() {",
      "  for (const p of PLAYERS_CLEAN) void p;",
      "  return [];",
      "}",
      "const DB = bidule();",
    ].join("\n");
    expect(coupables(indirect).length, "la forme INDIRECTE est celle qui a échappé").toBe(1);

    // Et il ne doit pas crier sur une fonction simplement DÉFINIE.
    const sain = [
      "function bidule() {",
      "  for (const p of PLAYERS_CLEAN) void p;",
      "  return [];",
      "}",
      "const faire = () => bidule();",
    ].join("\n");
    expect(coupables(sain)).toEqual([]);
  });
});
