// La devinette du jour est calculée à DEUX endroits : dans l'app, et dans le
// script qui envoie la notification quotidienne (scripts/notif-devinette.mjs).
// Ces tests verrouillent la seule chose qui compte — que ce soit le même joueur,
// et que la notification n'en donne pas la réponse.
import { describe, it, expect } from "vitest";
import { PLAYERS, RETIRED_PLAYERS } from "@/players.jsx";
import { parisDay, jourIndex, poolDevinette, joueurDuJour, accrocheDevinette, MODERN_MIN_BY,
         clubsDistincts, nbClubs } from "@/lib/devinette.js";
import { parisDayOf } from "@/lib/days";
import { dailyPool } from "@/components/landing/FindPlayer";

const POOL = poolDevinette(PLAYERS as any[], RETIRED_PLAYERS as Set<string>);

describe("parisDay", () => {
  // Le jour parisien était calculé ici par `new Date(d.toLocaleString("en-US",
  // {timeZone}))`, c'est-à-dire en RE-PARSANT une chaîne localisée — ce que la
  // spec ne garantit pour aucun format. days.ts fait le même calcul avec Intl
  // depuis le début : les deux doivent tomber d'accord, sinon l'app et le
  // tableau de bord ne parlent pas du même jour.
  it("donne le même jour que parisDayOf, y compris quand le jour UTC diffère", () => {
    for (const instant of [
      "2026-08-11T09:58:00Z",   // plein jour
      "2026-08-11T22:30:00Z",   // 00 h 30 à Paris le 12 (UTC+2)
      "2026-01-01T23:30:00Z",   // 00 h 30 à Paris le 2 (UTC+1)
      "2026-03-29T01:30:00Z",   // passage à l'heure d'été
      "2026-10-25T00:30:00Z",   // passage à l'heure d'hiver
    ]) {
      expect(parisDay(instant)).toBe(parisDayOf(instant));
    }
  });

  it("sans argument, rend un jour au bon format", () => {
    expect(parisDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("le joueur du jour", () => {
  it("est le même pour tout le monde : deux appels, même réponse", () => {
    expect(joueurDuJour(POOL, "2026-08-11").name).toBe(joueurDuJour(POOL, "2026-08-11").name);
  });

  it("ne se répète pas avant un cycle complet du vivier", () => {
    // C'est la promesse du mode : « chaque joueur passe une seule fois ». Elle
    // tient parce que le vivier est mélangé une fois avec une graine FIXE puis
    // parcouru par rotation — pas retiré au hasard chaque jour.
    const vus = new Set<string>();
    const base = jourIndex("2026-08-11");
    for (let i = 0; i < POOL.length; i++) {
      const jour = new Date((base + i) * 86400000).toISOString().slice(0, 10);
      vus.add(joueurDuJour(POOL, jour).name);
    }
    expect(vus.size).toBe(POOL.length);
  });

  it("survit à un vivier vide sans planter", () => {
    expect(joueurDuJour([], "2026-08-11")).toBeNull();
  });

  it("ne propose que des joueurs en activité, jamais un retraité", () => {
    for (const p of POOL) {
      expect(RETIRED_PLAYERS.has(p.name)).toBe(false);
      expect(p.birthYear).toBeGreaterThanOrEqual(MODERN_MIN_BY);
    }
  });
});

describe("l'app et l'envoyeur désignent le même joueur", () => {
  // LE test qui compte. Si un jour quelqu'un remet une copie du calcul dans
  // FindPlayer.tsx, celui-ci tombe : la notification annoncerait « 4 clubs,
  // milieu » pour un joueur que le jeu ne propose pas ce jour-là.
  it("dailyPool() de FindPlayer EST poolDevinette", () => {
    expect((dailyPool() as any[]).map((p) => p.name)).toEqual(POOL.map((p) => p.name));
  });
});

describe("l'accroche de la notification ne divulgue pas la réponse", () => {
  // Une notification arrive AVANT que le joueur n'ouvre le jeu. Un nom ou un
  // club dans la barre de notification supprimerait la partie du jour pour tous
  // ceux qui la reçoivent — la seule chose que la notification ne doit jamais
  // faire.
  it("ne cite ni le nom ni aucun club, pour aucun joueur du vivier", () => {
    const fuites: string[] = [];
    for (const p of POOL) {
      const corps = accrocheDevinette(p).corps;
      if (corps.includes(p.name)) fuites.push(p.name + " : nom cité");
      for (const club of p.clubs || []) {
        if (corps.includes(club)) fuites.push(p.name + " : club « " + club + " » cité");
      }
    }
    expect(fuites).toEqual([]);
  });

  it("donne quand même de quoi accrocher : nombre de clubs, poste, décennie", () => {
    const corps = accrocheDevinette({
      name: "Untel", clubs: ["A", "B", "C", "D"], positions: ["milieu"], birthYear: 1993,
    }).corps;
    expect(corps).toContain("4 clubs");
    expect(corps).toContain("milieu");
    expect(corps).toContain("2010");
  });

  it("reste envoyable si le vivier ne rend rien", () => {
    const a = accrocheDevinette(null);
    expect(a.titre.length).toBeGreaterThan(0);
    expect(a.corps.length).toBeGreaterThan(0);
  });
});

// `clubs` est une liste ORDONNÉE : un joueur revenu dans un club y figure deux
// fois, parce que le dernier élément est publié comme « 🏁 Dernier maillot ».
// `clubs.length` n'est donc pas un nombre de clubs, et il l'était pris pour tel.
describe("compter les clubs quand un club revient", () => {
  const rulli = (PLAYERS as any[]).find((p) => p.name === "Gerónimo Rulli");
  const zlatan = (PLAYERS as any[]).find((p) => p.name === "Zlatan Ibrahimović");

  it("ne compte pas deux fois un club où le joueur est revenu", () => {
    // Rulli : Manchester City en 2016 puis de nouveau en 2026. Huit entrées,
    // sept clubs.
    expect(rulli.clubs.filter((c: string) => c === "Manchester City")).toHaveLength(2);
    expect(rulli.clubs.length).toBe(8);
    expect(nbClubs(rulli)).toBe(7);
  });

  it("garde la liste ORDONNÉE intacte : le dernier maillot reste le bon", () => {
    // Le piège de la déduplication : `new Set` conserve la PREMIÈRE occurrence,
    // donc dédoublonner la liste ferait repasser Rulli pour un joueur de
    // Marseille. Les comptes se dédoublonnent, la liste jamais.
    expect(rulli.clubs[rulli.clubs.length - 1]).toBe("Manchester City");
    expect(clubsDistincts(rulli)[clubsDistincts(rulli).length - 1]).toBe("Marseille");
  });

  it("la notification annonce le nombre de clubs DIFFÉRENTS", () => {
    expect(accrocheDevinette(rulli).corps).toContain("7 clubs");
    expect(accrocheDevinette(rulli).corps).not.toContain("8 clubs");
  });

  it("un doublon n'exclut plus du vivier quotidien", () => {
    // LE test qui compte. Le vivier exige 3 à 9 clubs. Comptées avec les
    // répétitions, les 10 entrées de Zlatan passaient le plafond : l'un des noms
    // les plus reconnaissables du jeu ne sortait jamais en devinette du jour.
    expect(zlatan.clubs.length).toBeGreaterThan(9);
    expect(nbClubs(zlatan)).toBe(9);
    const eligible = (p: any) => nbClubs(p) >= 3 && nbClubs(p) <= 9;
    expect(eligible(zlatan)).toBe(true);
  });

  it("et un doublon ne fait plus entrer un joueur à deux clubs", () => {
    // L'autre sens, tout aussi faux : le plancher de 3 clubs existe pour que
    // l'énigme ait de la matière. Robbie Fowler a trois entrées pour deux clubs.
    const fowler = (PLAYERS as any[]).find((p) => p.name === "Robbie Fowler");
    expect(fowler.clubs.length).toBe(3);
    expect(nbClubs(fowler)).toBe(2);
    expect(POOL.some((p: any) => p.name === "Robbie Fowler")).toBe(false);
  });

  it("tout le vivier a bien 3 à 9 clubs DIFFÉRENTS", () => {
    const hors = POOL.filter((p: any) => nbClubs(p) < 3 || nbClubs(p) > 9).map((p: any) => p.name);
    expect(hors).toEqual([]);
  });
});
