// SIX JOUEURS SUR SEPT ÉTAIENT PERDUS, ET NE LE SAVAIENT PAS
//
// Les trois systèmes de salle rangent leurs joueurs dans une colonne `players` de
// type jsonb — un TABLEAU ENTIER réécrit à chaque arrivée. Le client lit la
// liste, s'y ajoute, réécrit le tout. Entre la lecture et l'écriture il y a un
// aller-retour réseau, et pendant ce temps quelqu'un d'autre a pu écrire : sa
// version est écrasée. C'est la mise à jour perdue, et elle est INVISIBLE à un
// joueur seul — donc invisible à tout essai fait à la main.
//
// Mesuré au banc de charge (`npm run sql:charge`, Postgres local, un processus
// par requête pour que lecture et écriture soient dans des transactions
// séparées comme chez PostgREST) :
//
//     GOAT BATTLE, ancien algorithme   2/8 joueurs — 6 perdus
//     GOAT BATTLE, avec reprise        8/8
//     The Plug (déjà avec reprise)     8/8
//     GOAT DUEL, ancien algorithme     2 invités entrés pour 1 place
//     GOAT DUEL, place prise dans l'écriture   1 entre, l'autre est refusé
//
// Un salon GOAT BATTLE complet était donc pratiquement impossible à remplir, et
// les éjectés voyaient le salon AVEC LEUR NOM DEDANS : ils attendaient une partie
// qui allait se lancer sans eux.
//
// CE QUE CES TESTS FONT, ET NE FONT PAS. Ils ne rejouent pas la concurrence —
// c'est le rôle du banc, qui a besoin d'un vrai Postgres. Ils tiennent les
// INVARIANTS du code : que la reprise et la vérification n'aient pas disparu, et
// qu'aucune des trois fonctions ne se remette à ouvrir un salon sans avoir
// vérifié qu'elle y est. C'est ce dernier point qui rendait le défaut muet.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "src/components/LePont.jsx"), "utf8");

/** Le corps d'une fonction du composant, jusqu'à l'accolade de sa colonne. */
function corps(nom: string): string {
  const i = src.indexOf("async function " + nom + "(");
  expect(i, "fonction " + nom + " introuvable").toBeGreaterThan(-1);
  const reste = src.slice(i);
  const fin = reste.search(/\n  \}\n/);
  return reste.slice(0, fin < 0 ? 4000 : fin);
}

describe("GOAT BATTLE — la reprise sur collision", () => {
  const gg = corps("ggBattleJoinRoom");

  it("réessaie au lieu d'écrire une fois", () => {
    expect(gg, "la boucle de reprise a disparu").toMatch(/for \(let essai = 1; essai <= 5/);
  });

  it("VÉRIFIE après écriture qu'il est bien dans la liste", () => {
    // Le cœur du correctif. Sans relecture, il n'y a aucun moyen de savoir si son
    // ajout a survécu : PostgREST répond 204 même quand un autre client vient
    // d'écraser la liste.
    expect(gg).toMatch(/const verif = await sbFetch\("bb_gg_rooms\?id=eq\."/);
    expect(gg).toMatch(/vl\.find\(\(p\) => p\.id === playerId\)/);
  });

  it("n'ouvre PAS le salon quand il a échoué", () => {
    // C'est ce qui rendait le défaut muet : `setGgBattleScreen("lobby")` était
    // appelé sans condition, donc l'éjecté voyait le salon avec son nom dedans.
    const iEchec = gg.indexOf("if (!entre)");
    const iOuvre = gg.lastIndexOf('setGgBattleScreen("lobby")');
    expect(iEchec, "le garde d'échec a disparu").toBeGreaterThan(-1);
    expect(iOuvre, "l'ouverture du salon doit venir APRÈS le garde d'échec").toBeGreaterThan(iEchec);
    // Et l'échec doit se DIRE, pas seulement empêcher l'ouverture.
    expect(gg.slice(iEchec, iOuvre)).toMatch(/setGgBattleError\(/);
  });

  it("attend un délai ALÉATOIRE entre deux essais", () => {
    // Sans l'aléa, huit clients qui recommencent ensemble se recognent au tour
    // suivant : la reprise ne convergerait pas.
    expect(gg).toMatch(/300 \+ essai \* 200 \+ Math\.random\(\) \* 200/);
  });
});

describe("GOAT DUEL — la place se prend dans l'écriture", () => {
  const duel = corps("duelJoinRoom");

  it("filtre sur guest_id is null au moment du PATCH", () => {
    // Le contrôle passe DANS l'update : Postgres n'écrit que si la place est
    // encore libre. C'est ce qu'un simple « lire puis écrire » ne peut pas offrir.
    expect(duel, "le filtre atomique a disparu — deux invités pourront entrer")
      .toContain('"bb_duel_rooms?id=eq."+room.id+"&guest_id=is.null"');
  });

  it("demande la ligne en retour pour savoir s'il a gagné la course", () => {
    // `return=minimal` répond 204 dans les deux cas : gagné ou trop tard. Sans
    // la représentation, le filtre serait posé sans qu'on puisse en lire l'issue.
    expect(duel).toMatch(/"Prefer"\s*:\s*"return=representation"/);
    expect(duel).toMatch(/if\(!Array\.isArray\(pris\) \|\| pris\.length===0\)/);
  });

  it("dit « salon complet » au perdant au lieu d'ouvrir le lobby", () => {
    const iRefus = duel.indexOf("pris.length===0");
    const iOuvre = duel.indexOf('setDuelScreen("lobby")', iRefus);
    expect(iRefus).toBeGreaterThan(-1);
    expect(iOuvre).toBeGreaterThan(iRefus);
  });
});

describe("The Plug — la reprise qui existait déjà, et qu'on ne casse pas", () => {
  // Elle sert de référence aux deux correctifs ci-dessus : c'est la seule des
  // trois qui tenait, et le banc la mesure à 8/8. Ce test empêche de la
  // « simplifier » un jour sans mesurer.
  const plug = corps("joinRoom");

  it("garde ses cinq essais et sa relecture de contrôle", () => {
    expect(plug).toMatch(/while \(!success && attempt < 5\)/);
    expect(plug).toMatch(/const verify = await sbFetch\("bb_rooms\?id=eq\."/);
    expect(plug).toMatch(/if \(!success\)/);
  });
});
