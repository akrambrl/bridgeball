// La devinette du jour est calculée à DEUX endroits : dans l'app, et dans le
// script qui envoie la notification quotidienne (scripts/notif-devinette.mjs).
// Ces tests verrouillent la seule chose qui compte — que ce soit le même joueur,
// et que la notification n'en donne pas la réponse.
import { describe, it, expect } from "vitest";
import { PLAYERS, RETIRED_PLAYERS } from "@/players.jsx";
import { parisDay, jourIndex, poolDevinette, joueurDuJour, accrocheDevinette, MODERN_MIN_BY,
         clubsDistincts, nbClubs, nomInscritPour } from "@/lib/devinette.js";
import { ROTATION, EPOQUE_JOUR } from "@/lib/devinette-rotation.js";
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

  it("passe tout le vivier sur un cycle, sans doublon", () => {
    // La promesse du mode : « chaque joueur passe une seule fois ». Elle est
    // maintenant portée par un calendrier ÉCRIT (devinette-rotation.js), et elle
    // se vérifie donc SUR UN CYCLE, à partir de son début.
    //
    // CE QUI A ÉTÉ ÉCHANGÉ, et il faut le savoir : la version d'avant garantissait
    // l'unicité sur N'IMPORTE QUELLE fenêtre de la taille du vivier, parce que
    // c'était une rotation modulo. Mais elle l'obtenait au prix d'un calendrier qui
    // se réordonnait entièrement dès qu'un joueur entrait ou sortait du vivier —
    // le défaut signalé en production. Une fenêtre à cheval sur deux cycles peut
    // désormais revoir quelqu'un, jamais à moins de douze jours (test plus bas).
    // Les deux garanties ne peuvent pas coexister, c'est démontré en tête de
    // scripts/devinette-rotation.mjs.
    const vus = new Set<string>();
    for (let i = 0; i < POOL.length; i++) {
      const jour = new Date((EPOQUE_JOUR + i) * 86400000).toISOString().slice(0, 10);
      vus.add(joueurDuJour(POOL, jour)!.name);
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
  // Ginter est revenu à Fribourg : Fribourg → Dortmund → Gladbach → Fribourg.
  // Quatre entrées, trois clubs. (Fixture stable : un vétéran au parcours figé.)
  const ginter = (PLAYERS as any[]).find((p) => p.name === "Matthias Ginter");
  const zlatan = (PLAYERS as any[]).find((p) => p.name === "Zlatan Ibrahimović");

  it("ne compte pas deux fois un club où le joueur est revenu", () => {
    expect(ginter.clubs.filter((c: string) => c === "SC Freiburg")).toHaveLength(2);
    expect(ginter.clubs.length).toBe(4);
    expect(nbClubs(ginter)).toBe(3);
  });

  it("garde la liste ORDONNÉE intacte : le dernier maillot reste le bon", () => {
    // Le piège de la déduplication : `new Set` conserve la PREMIÈRE occurrence,
    // donc dédoublonner la liste ferait repasser Ginter pour un joueur de
    // Mönchengladbach. Les comptes se dédoublonnent, la liste jamais : le
    // dernier maillot publié reste bien Fribourg, son club actuel.
    expect(ginter.clubs[ginter.clubs.length - 1]).toBe("SC Freiburg");
    expect(clubsDistincts(ginter)[clubsDistincts(ginter).length - 1]).toBe("Borussia Mönchengladbach");
  });

  it("la notification annonce le nombre de clubs DIFFÉRENTS", () => {
    expect(accrocheDevinette(ginter).corps).toContain("3 clubs");
    expect(accrocheDevinette(ginter).corps).not.toContain("4 clubs");
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

// Le signalement : « la devinette du jour est la même que celle de quelques jours ».
// Cause : joueurDuJour faisait `melange(vivier)[jour % vivier.length]` sur un vivier
// RECALCULÉ depuis players.jsx. Le mélange avait une graine fixe, mais il mélangeait
// une liste dont le contenu bouge — un joueur qui entre ou sort réordonnait TOUT le
// calendrier. En corrigeant le comptage des clubs, le vivier est passé de 96 à 97 et
// les douze jours examinés ont tous changé de joueur.
describe("le calendrier est ÉCRIT, donc stable", () => {
  const jourDe = (pos: number) =>
    new Date((EPOQUE_JOUR + pos) * 86400000).toISOString().slice(0, 10);

  it("le jour d'époque donne la première case", () => {
    expect(joueurDuJour(POOL, jourDe(0))!.name).toBe(ROTATION[0]);
    expect(joueurDuJour(POOL, jourDe(5))!.name).toBe(ROTATION[5]);
  });

  it("AJOUTER un joueur au vivier ne déplace AUCUN jour déjà attribué", () => {
    // LE test de cette correction. C'est exactement ce qui s'est produit en
    // production, et c'est ce qui ne doit plus jamais se produire.
    const intrus = { name: "Zzz Intrus", clubs: ["A", "B", "C", "D"], diff: "facile",
                     nationalities: ["France"], positions: ["milieu"], birthYear: 1999 };
    const agrandi = [...POOL, intrus as any];
    const ecarts: string[] = [];
    for (let pos = 0; pos < 60; pos++) {
      const j = jourDe(pos);
      const avant = joueurDuJour(POOL, j)!.name;
      const apres = joueurDuJour(agrandi, j)!.name;
      if (avant !== apres) ecarts.push(j + " : " + avant + " → " + apres);
    }
    expect(ecarts).toEqual([]);
  });

  it("RETIRER un joueur ne déplace que les jours qui étaient les siens", () => {
    // On ne peut pas garantir mieux : son jour doit bien changer. Ce qui compte est
    // que les AUTRES ne bougent pas.
    const sansPremier = POOL.filter((p: any) => p.name !== ROTATION[0]);
    const ecarts: string[] = [];
    for (let pos = 1; pos < 40; pos++) {
      const j = jourDe(pos);
      if (ROTATION[pos] === ROTATION[0]) continue;
      const avant = joueurDuJour(POOL, j)!.name;
      const apres = joueurDuJour(sansPremier, j)!.name;
      if (avant !== apres) ecarts.push(j + " : " + avant + " → " + apres);
    }
    expect(ecarts).toEqual([]);
  });

  it("aucune répétition à moins de douze jours sur tout le calendrier", () => {
    // La jointure entre deux cycles est l'endroit à risque : rien n'empêche
    // naturellement le dernier joueur d'un cycle de rouvrir le suivant. Le premier
    // essai du générateur a produit deux répétitions à onze jours d'écart.
    const trop: string[] = [];
    for (let i = 1; i < ROTATION.length; i++) {
      for (let k = 1; k <= 12 && i - k >= 0; k++) {
        if (ROTATION[i] === ROTATION[i - k]) trop.push(ROTATION[i] + " en " + (i - k) + " et " + i);
      }
    }
    expect(trop).toEqual([]);
  });

  it("couvre plus d'un an, pour ne pas retomber sur le calcul instable", () => {
    // Au-delà de la liste, joueurDuJour reprend l'ancien calcul — donc
    // l'instabilité. La liste doit laisser largement le temps de l'étendre.
    expect(ROTATION.length).toBeGreaterThan(365);
  });

  it("tous les noms inscrits existent dans le vivier", () => {
    const dedans = new Set(POOL.map((p: any) => p.name));
    const absents = [...new Set(ROTATION)].filter((n) => !dedans.has(n));
    expect(absents).toEqual([]);
  });

  it("hors de la liste, il n'y a pas de nom inscrit", () => {
    expect(nomInscritPour(jourDe(-1))).toBeNull();
    expect(nomInscritPour(jourDe(ROTATION.length))).toBeNull();
    // Et le mode continue de rendre un joueur : le repli fonctionne.
    expect(joueurDuJour(POOL, jourDe(ROTATION.length))).not.toBeNull();
  });
});
