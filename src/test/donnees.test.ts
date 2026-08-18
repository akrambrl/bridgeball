// LES DONNÉES DE JEU SONT DEVENUES UN ARTEFACT, ET UN ARTEFACT DÉRIVE
//
// `src/players.jsx` reste la SOURCE — onze scripts du dépôt la lisent, dont
// `npm run transferts` et les audits de fiches. `public/donnees/joueurs.json` en
// est une projection, fabriquée par `npm run donnees` et embarquée dans le paquet.
//
// Deux façons de se tromper, et les deux sont muettes :
//
//   1. MODIFIER players.jsx SANS REGÉNÉRER. L'app continue de tourner, sur les
//      données d'avant. On corrigerait un transfert, on verrait le test passer,
//      on déploierait, et rien n'aurait changé pour les joueurs. C'est le défaut
//      le plus probable de cette architecture, et il ne fait aucun bruit.
//
//   2. RÉ-IMPORTER players.jsx DANS L'APP. Un `import { PLAYERS } from
//      "../players.jsx"` ajouté par distraction remettrait 1008 Ko dans le bundle
//      JS. Tout marcherait — l'app serait juste redevenue lourde, et les
//      corrections à distance cesseraient de servir à quelque chose pour ce
//      morceau-là.
//
// Le troisième test éprouve le DÉCODAGE colonnaire lui-même, en comparant fiche
// par fiche avec la source. Le format gagne 338 Ko en écrivant les clés une seule
// fois ; si le décodeur les remettait dans le mauvais ordre, chaque joueur aurait
// la nationalité d'un autre — un défaut qu'aucun contrôle de taille ne verrait.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { construire, empreinte, CHEMIN } from "../../scripts/donnees-json.mjs";
import { PLAYERS, RETIRED_PLAYERS, PLAYERS_CLEAN, PLAYER_BY_NAME } from "../lib/donnees";
import * as source from "../players.jsx";

const RACINE = process.cwd();

describe("l'artefact des données de jeu", () => {
  it("correspond exactement à src/players.jsx", () => {
    // Regénéré et comparé par empreinte : si ce test casse, la seule chose à
    // faire est `npm run donnees` puis committer le fichier. Le message le dit,
    // parce qu'un test qui échoue sans dire quoi faire coûte plus qu'il ne rend.
    const attendu = construire();
    const surDisque = readFileSync(CHEMIN, "utf8");
    expect(
      empreinte(surDisque),
      "public/donnees/joueurs.json ne correspond plus à src/players.jsx — lance `npm run donnees`",
    ).toBe(empreinte(attendu));
  });

  it("est chargé, et complet", () => {
    // Le harnais de test le charge dans src/test/setup.ts. S'il ne l'était pas,
    // tous les tests qui exercent les vraies données passeraient au vert en ne
    // vérifiant plus rien — c'est arrivé, et cinq d'entre eux ont échoué.
    expect(PLAYERS.length).toBe(source.PLAYERS.length);
    expect(PLAYERS.length).toBeGreaterThan(5000);
    expect(RETIRED_PLAYERS.size).toBe(source.RETIRED_PLAYERS.size);
    // Les deux index dérivés, sans lesquels le jeu paraît vide sans erreur.
    expect(PLAYERS_CLEAN.length).toBeGreaterThan(4000);
  });

  it("aucun joueur n'apparaît deux fois", () => {
    // Cette assertion a trouvé un vrai défaut le jour où elle a été écrite :
    // « Christian Nørgaard » figurait deux fois, avec 7 clubs sur une fiche et 5
    // sur l'autre. Et le défaut était pire qu'une redondance —
    //
    //   • PLAYER_BY_NAME se construit par `new Map(...)`, qui garde la DERNIÈRE
    //     entrée : l'app répondait donc sur la fiche TRONQUÉE ;
    //   • mais PLAYERS_CLEAN contenait les deux, donc le tirage de paires pouvait
    //     proposer « Lyngby × Arsenal », dont la seule réponse valable était
    //     ensuite REFUSÉE par la vérification, qui interrogeait la fiche courte.
    //
    // Un doublon n'est donc pas un détail de propreté : c'est une paire
    // insoluble servie à un joueur. D'où le contrôle, sur la source comme sur
    // l'artefact.
    for (const [nom, liste] of [["source", source.PLAYERS], ["artefact", PLAYERS]] as const) {
      const vus = new Set<string>();
      const doublons: string[] = [];
      for (const p of liste as { name?: string }[]) {
        if (!p || !p.name) continue;
        if (vus.has(p.name)) doublons.push(p.name);
        else vus.add(p.name);
      }
      expect(doublons, nom + " : ces joueurs figurent deux fois").toEqual([]);
    }
    // Le pendant : l'index par nom couvre alors TOUS les joueurs exploitables.
    expect(PLAYER_BY_NAME.size).toBe(PLAYERS_CLEAN.length);
  });

  it("le décodage colonnaire ne mélange rien", () => {
    // Fiche par fiche contre la source, sur toute la base. Une erreur d'index
    // dans le décodeur donnerait à chaque joueur les nationalités du voisin, et
    // le jeu resterait parfaitement fonctionnel — avec de fausses réponses.
    const attendus = source.PLAYERS as Record<string, unknown>[];
    expect(PLAYERS.length).toBe(attendus.length);
    const ecarts: string[] = [];
    for (let i = 0; i < attendus.length && ecarts.length < 5; i++) {
      const a = attendus[i];
      const b = PLAYERS[i] as unknown as Record<string, unknown>;
      // Mêmes clés PRÉSENTES : le format écrit `null` pour une clé absente, et le
      // décodeur ne doit pas la poser — sinon `p.birthYear === undefined`
      // deviendrait faux là où le jeu s'en sert pour filtrer.
      const clesA = Object.keys(a).sort().join(",");
      const clesB = Object.keys(b).sort().join(",");
      if (clesA !== clesB) { ecarts.push(`${a.name} : clés ${clesB} au lieu de ${clesA}`); continue; }
      if (JSON.stringify(a, Object.keys(a).sort()) !== JSON.stringify(b, Object.keys(a).sort())) {
        ecarts.push(`${a.name} : contenu différent`);
      }
    }
    expect(ecarts).toEqual([]);
  });

  it("aucune clé n'est perdue en route", () => {
    // Le pendant du test précédent, vu depuis les clés : le générateur trie les
    // clés rencontrées sur TOUTE la base, donc une clé n'existant que sur une
    // poignée de fiches doit survivre. birthYear est justement de celles-là.
    const clesSource = new Set<string>();
    for (const p of source.PLAYERS as Record<string, unknown>[]) {
      for (const k of Object.keys(p)) clesSource.add(k);
    }
    const clesRendues = new Set<string>();
    for (const p of PLAYERS as unknown as Record<string, unknown>[]) {
      for (const k of Object.keys(p)) clesRendues.add(k);
    }
    expect([...clesRendues].sort()).toEqual([...clesSource].sort());
  });
});

describe("players.jsx ne doit plus revenir dans le paquet JS", () => {
  // On parcourt src/ à l'exception des tests et du module de données lui-même :
  // le premier a le droit de lire la source pour la comparer, le second est
  // justement celui qui la remplace.
  function fichiersApp(dossier: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dossier)) {
      const p = join(dossier, e);
      if (statSync(p).isDirectory()) {
        if (e === "test") continue;
        out.push(...fichiersApp(p));
      } else if (/\.(ts|tsx|js|jsx)$/.test(e) && e !== "players.jsx") {
        out.push(p);
      }
    }
    return out;
  }

  it("aucun fichier de src/ n'importe players.jsx", () => {
    const coupables = fichiersApp(join(RACINE, "src"))
      .filter((f) => /from\s+["'][^"']*players\.jsx["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(RACINE, f));
    expect(
      coupables,
      "ces fichiers remettraient 1008 Ko dans le bundle JS et couperaient les corrections à distance",
    ).toEqual([]);
  });

  it("les données restent servies en fichier, sous le plafond de public/", () => {
    // 1 Mo est le plafond que src/test/images.test.ts impose déjà à public/. Le
    // format colonnaire tient à 644 Ko ; le format naïf ferait 982 Ko et passerait
    // encore, mais de justesse. Ce test dit à partir d'où il faudra recompter.
    const octets = statSync(CHEMIN).size;
    expect(Math.round(octets / 1024)).toBeLessThan(800);
  });
});
