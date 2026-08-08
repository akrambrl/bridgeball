import { describe, it, expect } from "vitest";
import { duelTermine, bilanFaceAFace, type Duel } from "@/lib/duel";

// Les statuts sont ceux réellement présents dans bb_duels le 8 août 2026, avec
// leurs effectifs. Le déséquilibre est le cœur du bug : ne compter que
// `complete`, c'était ignorer 98 duels terminés sur 99.
const EFFECTIFS_REELS: Record<string, number> = {
  open_done: 98, open: 24, pending: 5, cancelled: 5, ready: 4,
  opponent_played: 3, challenger_played: 2, complete: 1, waiting: 1, sent: 1,
};

function duel(status: string, chal: string, opp: string, sChal: number, sOpp: number): Duel {
  return { status, challenger_id: chal, opponent_id: opp, challenger_score: sChal, opponent_score: sOpp };
}

describe("duelTermine", () => {
  it("accepte les deux façons de terminer un duel", () => {
    expect(duelTermine({ status: "complete" })).toBe(true);
    expect(duelTermine({ status: "open_done" })).toBe(true);
  });

  it("rejette tout duel en cours ou avorté", () => {
    for (const s of ["open", "pending", "ready", "sent", "waiting", "challenger_played", "opponent_played", "cancelled"]) {
      expect(duelTermine({ status: s }), s).toBe(false);
    }
  });

  it("ne casse pas sur une entrée vide", () => {
    expect(duelTermine(null)).toBe(false);
    expect(duelTermine(undefined)).toBe(false);
    expect(duelTermine({})).toBe(false);
  });

  it("compterait 99 duels sur les 144 lignes réelles, pas 1", () => {
    const termines = Object.entries(EFFECTIFS_REELS)
      .filter(([s]) => duelTermine({ status: s }))
      .reduce((n, [, c]) => n + c, 0);
    expect(termines).toBe(99);
    // Le filtre d'avant n'en voyait qu'un seul.
    expect(EFFECTIFS_REELS.complete).toBe(1);
  });
});

describe("bilanFaceAFace", () => {
  const moi = "MOI", lui = "LUI", tiers = "TIERS";
  const duels: Duel[] = [
    duel("open_done", moi, lui, 300, 100),   // victoire
    duel("open_done", lui, moi, 500, 900),   // victoire (je suis l'adversaire)
    duel("open_done", moi, lui, 100, 400),   // défaite
    duel("complete",  moi, lui, 200, 200),   // nul
    duel("open",      moi, lui, 999, 0),     // pas terminé → ignoré
    duel("cancelled", moi, lui, 999, 0),     // annulé → ignoré
    duel("open_done", moi, tiers, 700, 0),   // autre adversaire
    duel("open_done", tiers, lui, 1, 2),     // ne me concerne pas
  ];

  it("compte le face-à-face contre un adversaire précis", () => {
    expect(bilanFaceAFace(duels, moi, lui)).toEqual({ victoires: 2, nuls: 1, defaites: 1, total: 4 });
  });

  it("sans adversaire, donne le bilan global — sans les duels des autres", () => {
    expect(bilanFaceAFace(duels, moi)).toEqual({ victoires: 3, nuls: 1, defaites: 1, total: 5 });
  });

  it("l'ancien filtre `complete` seul n'aurait vu qu'un nul", () => {
    const ancien = duels.filter(d => d.status === "complete");
    expect(bilanFaceAFace(ancien, moi, lui)).toEqual({ victoires: 0, nuls: 1, defaites: 0, total: 1 });
  });

  it("ne renvoie que des zéros quand aucun duel ne concerne le joueur", () => {
    expect(bilanFaceAFace(duels, "INCONNU")).toEqual({ victoires: 0, nuls: 0, defaites: 0, total: 0 });
  });

  it("traite un score manquant comme zéro plutôt que de planter", () => {
    const bancal: Duel[] = [{ status: "open_done", challenger_id: moi, opponent_id: lui, challenger_score: 10, opponent_score: null }];
    expect(bilanFaceAFace(bancal, moi, lui)).toEqual({ victoires: 1, nuls: 0, defaites: 0, total: 1 });
  });
});
