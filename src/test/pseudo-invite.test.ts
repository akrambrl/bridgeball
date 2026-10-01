// Beaucoup de joueurs du classement du mois apparaissent comme « ? » : ils jouent sans
// pseudo. On leur propose d'en créer un après une partie — sans les harceler.
import { describe, it, expect } from "vitest";
import { faut_il_inviter, DELAI_INVITATION_MS } from "../lib/pseudo-invite.js";

const T = 1_700_000_000_000;

describe("faut_il_inviter", () => {
  it("n'invite jamais quelqu'un qui a déjà un pseudo", () => {
    expect(faut_il_inviter({ aPseudo: true, derniereInvitation: null, maintenant: T })).toBe(false);
  });
  it("invite un joueur sans pseudo qui n'a jamais été invité", () => {
    expect(faut_il_inviter({ aPseudo: false, derniereInvitation: null, maintenant: T })).toBe(true);
    expect(faut_il_inviter({ aPseudo: false, derniereInvitation: undefined, maintenant: T })).toBe(true);
  });
  it("n'insiste pas avant la fin du répit", () => {
    expect(faut_il_inviter({ aPseudo: false, derniereInvitation: T - 60_000, maintenant: T })).toBe(false);
    expect(faut_il_inviter({ aPseudo: false, derniereInvitation: T - (DELAI_INVITATION_MS - 1), maintenant: T })).toBe(false);
  });
  it("réinvite une fois le répit écoulé", () => {
    expect(faut_il_inviter({ aPseudo: false, derniereInvitation: T - DELAI_INVITATION_MS, maintenant: T })).toBe(true);
    expect(faut_il_inviter({ aPseudo: false, derniereInvitation: String(T - 3 * DELAI_INVITATION_MS), maintenant: T })).toBe(true);
  });
  it("une valeur illisible ou une horloge qui a reculé ne bloque pas à vie", () => {
    expect(faut_il_inviter({ aPseudo: false, derniereInvitation: "n'importe quoi", maintenant: T })).toBe(true);
    expect(faut_il_inviter({ aPseudo: false, derniereInvitation: T + 10 * DELAI_INVITATION_MS, maintenant: T })).toBe(true);
  });
  it("le répit est d'un quart d'heure", () => {
    expect(DELAI_INVITATION_MS).toBe(15 * 60 * 1000);
  });
});
