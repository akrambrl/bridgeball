// La devinette du jour est calculée à DEUX endroits : dans l'app, et dans le
// script qui envoie la notification quotidienne (scripts/notif-devinette.mjs).
// Ces tests verrouillent la seule chose qui compte — que ce soit le même joueur,
// et que la notification n'en donne pas la réponse.
import { describe, it, expect } from "vitest";
import { PLAYERS, RETIRED_PLAYERS } from "@/players.jsx";
import { parisDay, jourIndex, poolDevinette, joueurDuJour, accrocheDevinette, MODERN_MIN_BY } from "@/lib/devinette.js";
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
