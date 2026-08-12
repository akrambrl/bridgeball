// Les filtres du back-office doivent traverser TOUS les chiffres.
//
// Un filtre appliqué à une section sur deux ne se voit pas : le tableau de bord
// affiche des nombres cohérents entre eux et faux. Ces tests fixent, pour chaque
// filtre, ce qu'il doit faire bouger — et ce qu'il ne doit pas toucher.
import { describe, it, expect } from "vitest";
import { agregeTracking, modeDeType, nbFiltresActifs, formatDuree,
         FILTRES_VIDES, PLAY_MODES } from "../lib/tracking.js";

const JOURS = ["2026-08-10", "2026-08-09", "2026-08-08", "2026-08-07", "2026-08-06",
               "2026-08-05", "2026-08-04", "2026-08-03", "2026-08-02", "2026-08-01",
               "2026-07-31", "2026-07-30", "2026-07-29", "2026-07-28"];
const AUJ = JOURS[0], HIER = JOURS[1], VIEUX = JOURS[9];

// « alice » est inscrite, « dev-42 » ne l'est pas.
const ev = (player_id: string, type: string, day: string) => ({ player_id, type, day });
const sc = (player_id: string, mode: string, day: string) => ({ player_id, mode, day });

const DONNEES = {
  hasEvents: true,
  regIds: ["alice"],
  pseudoById: { alice: "alice" },
  accounts: 1,
  rawScores: [sc("alice", "pont", AUJ), sc("alice", "chaine", HIER), sc("dev-42", "pont", VIEUX)],
  rawEvents: [
    ev("alice", "play_pont", AUJ),
    ev("alice", "play_pont_online", AUJ),
    ev("alice", "play_grid", HIER),
    ev("dev-42", "play_pont", AUJ),
    ev("dev-42", "play_guess", VIEUX),
    ev("alice", "open_ios", AUJ),
    ev("dev-42", "open_android", AUJ),
    ev("alice", "dur_600", AUJ),
    ev("dev-42", "dur_120", AUJ),
  ],
  rawDuels: [AUJ, VIEUX],
  recent: [{ pseudo: "alice", country: "FR", created_at: "2026-08-10T08:00:00Z" },
           { pseudo: "bob", country: "BE", created_at: "2026-08-09T08:00:00Z" }],
  recentHasDate: true,
  allTime: { games: 3, duels: 2, rooms: 1, accounts: 1, grid: 0 },
  playsAllTime: null,
  trackingSince: null,
};

const vue = (f: Partial<typeof FILTRES_VIDES> = {}) =>
  agregeTracking(DONNEES, { ...FILTRES_VIDES, ...f }, JOURS)!;

describe("modeDeType", () => {
  it("sépare le mode du support", () => {
    expect(modeDeType("play_pont")).toEqual({ mode: "pont", online: false });
    expect(modeDeType("play_pont_online")).toEqual({ mode: "pont", online: true });
  });
  it("ignore ce qui n'est pas une partie, et les modes inconnus", () => {
    expect(modeDeType("open_ios")).toBeNull();
    expect(modeDeType("dur_600")).toBeNull();
    expect(modeDeType("play_inexistant")).toBeNull();
    expect(modeDeType(undefined as unknown as string)).toBeNull();
  });
});

describe("plage", () => {
  it("ne compte que les derniers jours calendaires demandés", () => {
    const j = vue({ plage: 1 });
    expect(j.parties).toBe(1);              // le score d'hier sort de la fenêtre
    expect(j.actifs).toBe(2);               // alice + dev-42, vus aujourd'hui
    expect(j.duels).toBe(1);
    const large = vue({ plage: 14 });
    expect(large.parties).toBe(3);
    expect(large.duels).toBe(2);
  });

  it("laisse le jour par jour couvrir les 14 jours quelle que soit la plage", () => {
    expect(vue({ plage: 1 }).parJour).toHaveLength(14);
    // Le vieux jour reste renseigné même en plage « aujourd'hui ».
    const vieux = vue({ plage: 1 }).parJour.find((d) => d.day === VIEUX)!;
    expect(vieux.games).toBe(1);
    expect(vieux.players).toBe(1);
  });
});

describe("filtre de mode", () => {
  it("restreint les parties, les joueurs ET les scores", () => {
    const g = vue({ mode: "grid" });
    expect(g.parMode.grid.n).toBe(1);
    expect(g.parMode.pont.n).toBe(0);
    expect(g.totalParties).toBe(1);
    expect(g.joueurs.map((p) => p.pid)).toEqual(["alice"]);
    // Aucun score n'est enregistré pour GOAT Grid dans bb_scores : le compteur
    // de parties terminées doit tomber à zéro, pas rester à son total global.
    expect(g.parties).toBe(0);
  });

  it("fait suivre les scores du mode correspondant", () => {
    expect(vue({ mode: "pont" }).parties).toBe(2);     // pont d'aujourd'hui + celui du vieux jour
    expect(vue({ mode: "chaine" }).parties).toBe(1);
  });

  it("laisse passer les événements qui ne sont pas des parties", () => {
    // Sinon un filtre de mode ferait disparaître « appareils » et « temps passé »,
    // qui ne parlent pourtant pas de mode.
    const g = vue({ mode: "grid" });
    expect(g.os.ios + g.os.android).toBe(2);
    expect(g.sessions).toBe(2);
  });
});

// Le défaut signalé depuis le tableau de bord : « 44 actifs · filtré » affiché
// sous un filtre GOAT Battle où le graphique juste en dessous ne comptait que
// 10 parties. Les 44 avaient ouvert l'app ; le filtre, lui, promettait autre
// chose. Trois chiffres se contredisaient sur le même écran.
describe("un filtre de jeu restreint aussi les ACTIFS", () => {
  it("ne compte pas comme actif celui qui a seulement ouvert l'app", () => {
    // alice et dev-42 ont tous deux un `open_*` aujourd'hui, mais seule alice a
    // lancé une partie de GOAT Grid (hier). Sous ce filtre, l'active est alice.
    const g = vue({ mode: "grid" });
    expect(g.actifs).toBe(1);
    expect(g.joueurs.map((p) => p.pid)).toEqual(["alice"]);
  });

  it("tombe à zéro quand aucune partie du mode n'est dans la fenêtre", () => {
    // La partie de GOAT Grid est d'HIER : en plage « 1 j », plus personne n'a
    // joué à ce mode aujourd'hui, même si deux joueurs ont ouvert l'app.
    expect(vue({ mode: "grid", plage: 1 }).actifs).toBe(0);
    expect(vue({ mode: "battle" }).actifs).toBe(0);   // aucun événement battle
  });

  it("applique la même règle au détail jour par jour", () => {
    const g = vue({ mode: "grid" });
    const hier = g.parJour.find((d) => d.day === HIER)!;
    const auj = g.parJour.find((d) => d.day === AUJ)!;
    expect(hier.players).toBe(1);
    expect(auj.players).toBe(0);   // les `open_*` d'aujourd'hui ne comptent plus
  });

  it("mais laisse les actifs intacts SANS filtre de jeu", () => {
    // Le filtre de public, lui, ne parle pas de partie : quelqu'un qui ouvre
    // l'app reste un joueur actif, c'est bien ce que ce chiffre veut dire.
    expect(vue().actifs).toBe(2);
    expect(vue({ plage: 1 }).actifs).toBe(2);
  });
});

describe("« parties » ne se compte pas sur les scores", () => {
  it("compte les parties sur les ÉVÉNEMENTS, pour les sept modes", () => {
    // bb_scores ne reçoit que trois modes sur sept (MODE_DU_SCORE). Compter les
    // parties là affichait « 0 partie » sous GOAT Battle, GOAT Grid, GOAT Guess
    // et Devinette — zéro par construction, jamais parce que personne n'a joué.
    const g = vue({ mode: "grid" });
    expect(g.parties).toBe(0);          // aucun score : c'est exact, et inutile
    expect(g.partiesVues).toBe(1);      // une partie a bien été lancée
    expect(g.totalParties).toBe(1);
  });

  it("le détail jour par jour compte lui aussi les parties lancées", () => {
    // Sans ça, la ligne « Aujourd'hui » annonçait 0 partie juste sous un
    // graphique qui en affichait dix.
    const g = vue({ mode: "grid" });
    expect(g.parJour.find((d) => d.day === HIER)!.games).toBe(1);
  });

  it("retombe sur les scores quand bb_events est absente", () => {
    const s = agregeTracking({ ...DONNEES, hasEvents: false, rawEvents: null },
      FILTRES_VIDES, JOURS)!;
    expect(s.partiesVues).toBe(s.parties);
    expect(s.partiesVues).toBe(3);
  });
});

describe("filtre de public", () => {
  it("ne garde que les inscrits", () => {
    const i = vue({ public: "inscrits" });
    expect(i.joueurs.map((p) => p.pid)).toEqual(["alice"]);
    expect(i.anonymes).toBe(0);
    expect(i.os.android).toBe(0);
  });
  it("ne garde que les joueurs sans compte", () => {
    const a = vue({ public: "anonymes" });
    expect(a.joueurs.map((p) => p.pid)).toEqual(["dev-42"]);
    expect(a.actifs).toBe(1);
    expect(a.os.ios).toBe(0);
  });
  it("ne prétend pas connaître les anonymes sans bb_events", () => {
    const sans = agregeTracking(
      { ...DONNEES, hasEvents: false, rawEvents: null },
      { ...FILTRES_VIDES, public: "anonymes" }, JOURS)!;
    expect(sans.joueurs).toEqual([]);
    expect(sans.parties).toBe(0);
  });
});

describe("filtre de support", () => {
  it("sépare solo et en ligne", () => {
    // solo : pont + grid d'alice, pont + guess de dev-42
    expect(vue({ support: "solo" }).solo).toBe(4);
    expect(vue({ support: "solo" }).enLigne).toBe(0);
    expect(vue({ support: "en-ligne" }).enLigne).toBe(1);
    expect(vue({ support: "en-ligne" }).solo).toBe(0);
  });
  it("retire les scores, qui ne portent pas cette information", () => {
    // bb_scores ne dit pas si la partie était en ligne : la compter dans « solo »
    // serait une affirmation gratuite.
    expect(vue({ support: "solo" }).parties).toBe(0);
    expect(vue({ support: "en-ligne" }).parties).toBe(0);
  });
});

describe("recherche", () => {
  it("trouve par pseudo comme par identifiant d'appareil", () => {
    expect(vue({ recherche: "ali" }).joueurs.map((p) => p.pid)).toEqual(["alice"]);
    expect(vue({ recherche: "DEV-4" }).joueurs.map((p) => p.pid)).toEqual(["dev-42"]);
    expect(vue({ recherche: "personne" }).joueurs).toEqual([]);
  });
  it("filtre aussi la liste des comptes créés", () => {
    expect(vue({ recherche: "bob" }).comptes.map((u: any) => u.pseudo)).toEqual(["bob"]);
    expect(vue().comptes).toHaveLength(2);
  });
});

describe("cumul de filtres", () => {
  it("les combine sans en perdre un", () => {
    const c = vue({ plage: 1, mode: "pont", public: "inscrits", support: "solo" });
    expect(c.totalParties).toBe(1);          // seule la partie solo de pont d'alice aujourd'hui
    expect(c.joueurs).toHaveLength(1);
    expect(c.filtresActifs).toBe(3);         // la plage n'est pas comptée comme un filtre
  });
  it("compte les filtres actifs", () => {
    expect(nbFiltresActifs(FILTRES_VIDES)).toBe(0);
    expect(nbFiltresActifs({ ...FILTRES_VIDES, plage: 1 })).toBe(0);
    expect(nbFiltresActifs({ ...FILTRES_VIDES, mode: "grid", recherche: " " })).toBe(1);
  });
});

describe("robustesse", () => {
  it("renvoie null sans données plutôt que de fabriquer des zéros", () => {
    expect(agregeTracking(null, FILTRES_VIDES, JOURS)).toBeNull();
  });
  it("tient debout quand bb_events est absente", () => {
    const s = agregeTracking({ ...DONNEES, hasEvents: false, rawEvents: null }, FILTRES_VIDES, JOURS)!;
    expect(s.aEvents).toBe(false);
    expect(s.parties).toBe(3);          // les scores restent comptés
    expect(s.totalParties).toBe(0);     // le détail par mode, non
    expect(s.joueurs).toEqual([]);
    expect(s.actifs).toBe(2);
  });
  it("connaît tous les modes déclarés, même à zéro", () => {
    const m = vue().parMode;
    for (const mode of PLAY_MODES) expect(m[mode.key]).toBeDefined();
  });
});

describe("formatDuree", () => {
  it("passe des secondes aux heures", () => {
    expect(formatDuree(45)).toBe("45 s");
    expect(formatDuree(90)).toBe("1 min 30 s");
    expect(formatDuree(600)).toBe("10 min");
    expect(formatDuree(3720)).toBe("1 h 02");
  });
  it("ne rend pas de valeur négative ou absurde", () => {
    expect(formatDuree(0)).toBe("0 s");
    expect(formatDuree(-5)).toBe("0 s");
    expect(formatDuree(NaN)).toBe("0 s");
  });
});
