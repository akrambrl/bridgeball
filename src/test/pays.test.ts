// UN JOUEUR A REMARQUÉ QUE GEORGE WEAH N'AVAIT PAS DE NATIONALITÉ
//
// La donnée était pourtant là : `nationalities: ["Liberia"]` dans la fiche. Ce qui
// manquait, c'était le DRAPEAU et la ZONE côté écran — et pas seulement pour lui.
//
// Mesuré sur les 125 nationalités réellement présentes dans la base, avant
// réparation :
//
//     GoatGuess    FLAGS      127 clés ·  0 trou
//     FindPlayer   NAT_CONT    99 clés · 30 trous
//     FindPlayer   NAT_FLAG    90 clés · 37 trous
//
// 41 nationalités sur 125 avaient au moins un trou, soit 887 joueurs affichés
// sans drapeau ou sans zone dans « Trouve le joueur ».
//
// Le défaut n'était pas une donnée absente — la table de GoatGuess était complète.
// C'était TROIS COPIES de la même table dans trois fichiers, qui avaient divergé.
// Elles sont fusionnées dans src/lib/pays.ts, et ce fichier-ci empêche la
// divergence de revenir : ajouter un joueur d'un pays inconnu casse le test au lieu
// de produire un écran à trou.
//
// C'est le seul test du dépôt dont on sait qu'il aurait épargné à un joueur de
// signaler un défaut.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DRAPEAUX, CONTINENTS, drapeau, continent } from "../lib/pays";
import { PLAYERS } from "../lib/donnees";
import { paysConnus } from "../lib/vocabulaire";

const RACINE = process.cwd();

/** Toutes les nationalités réellement utilisées, avec le nombre de joueurs. */
function nationalitesUtilisees(): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of PLAYERS) {
    for (const n of p.nationalities || []) m.set(n, (m.get(n) || 0) + 1);
  }
  return m;
}

describe("les pays de la base", () => {
  it("chaque nationalité a son drapeau", () => {
    const manquants = [...nationalitesUtilisees()]
      .filter(([n]) => !DRAPEAUX[n])
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `${n} (${c} joueurs)`);
    expect(
      manquants,
      "ajoute-les dans DRAPEAUX (src/lib/pays.ts) — sinon ces joueurs s'affichent avec un code à trois lettres",
    ).toEqual([]);
  });

  it("chaque nationalité a sa zone", () => {
    // La zone est un INDICE dans « Trouve le joueur » : sans elle, la comparaison
    // « même continent que le joueur cherché ? » répond « ? » et l'indice est
    // perdu — silencieusement, sans que l'écran paraisse cassé.
    const manquants = [...nationalitesUtilisees()]
      .filter(([n]) => !CONTINENTS[n])
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `${n} (${c} joueurs)`);
    expect(
      manquants,
      "ajoute-les dans CONTINENTS (src/lib/pays.ts) — sinon l'indice de zone disparaît pour ces joueurs",
    ).toEqual([]);
  });

  it("George Weah, nommément", () => {
    // Le cas signalé. On le garde en clair : un test nommé se relit, et il dit
    // d'où vient la règle. S'il casse un jour, on saura que c'est reparti.
    const weah = PLAYERS.find((p) => p.name === "George Weah");
    expect(weah, "George Weah a disparu de la base").toBeTruthy();
    expect(weah!.nationalities).toEqual(["Liberia"]);
    expect(drapeau("Liberia")).toBe("🇱🇷");
    expect(continent("Liberia")).toBe("AF");
  });

  it("les six zones, et pas une septième", () => {
    // EU · AF · AS · AmN · AmS · OC. Un code de plus voudrait dire qu'une valeur a
    // été écrite au hasard : l'indice se lit d'un coup d'œil, et un septième code
    // n'aurait aucun libellé pour l'afficher.
    const attendues = new Set(["EU", "AF", "AS", "AmN", "AmS", "OC"]);
    const inconnues = [...new Set(Object.values(CONTINENTS))].filter((z) => !attendues.has(z));
    expect(inconnues).toEqual([]);
  });

  it("la logique des zones reste footballistique", () => {
    // Israël, la Géorgie, l'Arménie et Chypre jouent en UEFA. C'était le choix de
    // la table d'origine, et il compte : la zone sert d'indice à des joueurs de
    // foot, pas de leçon de géographie. Un « correctif » géographique casserait
    // l'indice sans que personne ne s'en aperçoive.
    for (const pays of ["Israël", "Géorgie", "Arménie", "Chypre"]) {
      expect(CONTINENTS[pays], pays + " doit rester en zone Europe (UEFA)").toBe("EU");
    }
  });

  it("chaque nationalité est traduisible", () => {
    // `nomPays()` affiche le pays dans la langue de l'app. Une nationalité absente
    // de vocabulaire.ts retomberait sur son nom français au milieu d'une interface
    // allemande — moins grave qu'un drapeau manquant, mais du même genre.
    const connus = new Set(paysConnus());
    const manquants = [...nationalitesUtilisees()]
      .filter(([n]) => !connus.has(n))
      .map(([n, c]) => `${n} (${c} joueurs)`);
    expect(manquants, "ajoute-les dans CODE_PAYS (src/lib/vocabulaire.ts)").toEqual([]);
  });
});

describe("une seule table de pays", () => {
  // La cause du défaut n'était pas l'absence de donnée mais sa DUPLICATION : trois
  // copies dans trois fichiers, dont deux incomplètes. Ce test refuse la quatrième.
  function fichiersApp(dossier: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dossier)) {
      const p = join(dossier, e);
      if (statSync(p).isDirectory()) {
        if (e === "test") continue;
        out.push(...fichiersApp(p));
      } else if (/\.(ts|tsx|jsx)$/.test(e) && e !== "pays.ts") {
        out.push(p);
      }
    }
    return out;
  }

  it("aucun fichier ne redéclare une table de drapeaux", () => {
    // On cherche une accumulation d'emojis drapeau associés à des clés — la forme
    // d'une table recopiée. Trois emojis suffisent : personne n'écrit trois
    // drapeaux en dur dans un fichier sans être en train de refaire la table.
    const coupables: string[] = [];
    for (const f of fichiersApp(join(RACINE, "src"))) {
      const src = readFileSync(f, "utf8");
      // Paires « "Pays": "🇽🇽" », comptées hors du fichier de référence.
      const paires = src.match(/["'][^"']{3,30}["']\s*:\s*["'][\u{1F1E6}-\u{1F1FF}]{2}["']/gu) || [];
      if (paires.length >= 3) coupables.push(`${relative(RACINE, f)} (${paires.length} entrées)`);
    }
    expect(
      coupables,
      "ces fichiers refabriquent une table de pays — importe DRAPEAUX depuis src/lib/pays.ts",
    ).toEqual([]);
  });
});
