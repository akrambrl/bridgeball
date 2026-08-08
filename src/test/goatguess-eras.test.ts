import { describe, it, expect } from "vitest";
import { QUESTIONS } from "@/components/landing/GoatGuess";
import { PLAYERS } from "@/players.jsx";

// Le Devin rangeait toutes les carrières d'avant 1980 derrière une seule
// question — soit un unique bit d'information pour ~680 joueurs, contre cinq
// questions pour les trente dernières années. Ce test vérifie la promesse
// (« aucune tranche d'âge n'est un angle mort ») plutôt que la liste des
// questions, qui peut bouger.
const MAX_PAR_TRANCHE = 0.35; // aucune réponse « oui » ne doit couvrir plus de 35 % de la base

describe("les questions d'époque du Devin", () => {
  const era = QUESTIONS.filter((q) => q.category === "era");
  const joueurs = (PLAYERS as any[]).filter((p) => p.birthYear);

  it("existent en nombre suffisant", () => {
    expect(era.length).toBeGreaterThanOrEqual(8);
  });

  it("découpent la base sans laisser de gros bloc indistinct", () => {
    // Pour chaque joueur, la signature = l'ensemble des questions d'époque
    // auxquelles il répond « oui ». Deux joueurs de même signature sont
    // indiscernables sur l'axe temporel.
    const groupes = new Map<string, number>();
    for (const p of joueurs) {
      const sig = era.map((q) => (q.predicate(p) ? "1" : "0")).join("");
      groupes.set(sig, (groupes.get(sig) ?? 0) + 1);
    }
    const plusGros = Math.max(...groupes.values());
    expect(plusGros / joueurs.length).toBeLessThan(MAX_PAR_TRANCHE);
  });

  it("distinguent les anciens entre eux", () => {
    // Le cas qui a motivé le découpage : un joueur né en 1945 et un né en 1975
    // répondaient exactement pareil à toutes les questions d'époque.
    const sig = (annee: number) =>
      era.map((q) => (q.predicate({ birthYear: annee } as any) ? "1" : "0")).join("");
    expect(sig(1945)).not.toBe(sig(1965));
    expect(sig(1965)).not.toBe(sig(1975));
    expect(sig(1975)).not.toBe(sig(1985));
  });
});
