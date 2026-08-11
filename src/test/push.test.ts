// Ces tests verrouillent ce que l'audit des notifications a trouvé cassé : rien
// n'envoyait jamais de push (pas d'Edge Function, pas de cron, pas de dépendance
// web-push), alors que l'app demandait la permission et promettait « on te
// pinguera ». Le script d'envoi ajouté doit se comporter correctement sur les
// deux points où une erreur coûte cher : les doublons d'abonnement, et le
// traitement d'un refus du serveur de push.
import { describe, it, expect } from "vitest";
import { abonnementUtilisable, dedupeAbonnements, decisionEnvoi, decisionFinale, tagDuJour } from "../lib/push.js";

const abo = (id: string, endpoint: string, created_at: string) =>
  ({ id, endpoint, p256dh: "cle", auth: "auth", created_at });

describe("abonnementUtilisable", () => {
  it("refuse une ligne sans clés de chiffrement", () => {
    expect(abonnementUtilisable({ endpoint: "https://a", p256dh: "", auth: "x" })).toBe(false);
    expect(abonnementUtilisable({ endpoint: "https://a", p256dh: "x" })).toBe(false);
  });

  it("refuse un endpoint qui n'est pas une URL https", () => {
    expect(abonnementUtilisable({ endpoint: "wss://a", p256dh: "x", auth: "y" })).toBe(false);
    expect(abonnementUtilisable(null)).toBe(false);
  });

  it("accepte une ligne complète", () => {
    expect(abonnementUtilisable(abo("1", "https://fcm.googleapis.com/x", "2026-08-01"))).toBe(true);
  });
});

describe("dedupeAbonnements", () => {
  it("ne garde qu'une ligne par endpoint", () => {
    const { garder } = dedupeAbonnements([
      abo("1", "https://a", "2026-08-01T00:00:00Z"),
      abo("2", "https://a", "2026-08-05T00:00:00Z"),
      abo("3", "https://b", "2026-08-02T00:00:00Z"),
    ]);
    expect(garder.map((g: any) => g.id).sort()).toEqual(["2", "3"]);
  });

  it("garde la PLUS RÉCENTE, pas la première", () => {
    // Les clés de chiffrement peuvent avoir été renouvelées par le navigateur
    // pour un même endpoint : seules les dernières déchiffrent.
    const { garder } = dedupeAbonnements([
      abo("vieux", "https://a", "2026-01-01T00:00:00Z"),
      abo("neuf", "https://a", "2026-08-01T00:00:00Z"),
    ]);
    expect(garder).toHaveLength(1);
    expect(garder[0].id).toBe("neuf");
  });

  it("range les autres lignes du même endpoint dans les doublons", () => {
    // Le client écrit avec `Prefer: resolution=merge-duplicates`, mais PostgREST
    // cible alors la clé primaire, et `id` est généré à chaque insertion : la
    // collision n'a jamais lieu et la table accumule une ligne par
    // réabonnement. Sans ce tri, dix réouvertures = dix notifications.
    const { garder, doublons } = dedupeAbonnements([
      abo("1", "https://a", "2026-08-01T00:00:00Z"),
      abo("2", "https://a", "2026-08-02T00:00:00Z"),
      abo("3", "https://a", "2026-08-03T00:00:00Z"),
    ]);
    expect(garder).toHaveLength(1);
    expect(doublons.map((d: any) => d.id).sort()).toEqual(["1", "2"]);
  });

  it("écarte les lignes sans clés au lieu de les envoyer", () => {
    const { garder, inutilisables } = dedupeAbonnements([
      { id: "ko", endpoint: "https://a", p256dh: "", auth: "", created_at: "2026-08-01" },
      abo("ok", "https://b", "2026-08-01T00:00:00Z"),
    ]);
    expect(garder.map((g: any) => g.id)).toEqual(["ok"]);
    expect(inutilisables.map((i: any) => i.id)).toEqual(["ko"]);
  });

  it("supporte une table vide", () => {
    expect(dedupeAbonnements([]).garder).toEqual([]);
    expect(dedupeAbonnements(null).garder).toEqual([]);
  });

  it("traite une date illisible comme la plus ancienne, sans planter", () => {
    const { garder } = dedupeAbonnements([
      abo("cassee", "https://a", "pas une date"),
      abo("bonne", "https://a", "2026-08-01T00:00:00Z"),
    ]);
    expect(garder[0].id).toBe("bonne");
  });
});

describe("decisionEnvoi", () => {
  it("purge sur 404 et 410 — l'abonnement est mort", () => {
    expect(decisionEnvoi(404)).toBe("purger");
    expect(decisionEnvoi(410)).toBe("purger");
  });

  it("NE purge PAS sur 401 / 403 : c'est notre clé VAPID qui est refusée", () => {
    // Le test le plus important du fichier. Purger sur 403 viderait TOUTE la
    // table sur une simple erreur de configuration — la panne deviendrait
    // irréparable, puisqu'il faudrait que chaque utilisateur se réabonne.
    expect(decisionEnvoi(401)).toBe("alerter");
    expect(decisionEnvoi(403)).toBe("alerter");
  });

  it("retente quand le serveur de push est saturé ou en panne", () => {
    expect(decisionEnvoi(429)).toBe("reessayer");
    expect(decisionEnvoi(500)).toBe("reessayer");
    expect(decisionEnvoi(503)).toBe("reessayer");
  });

  it("compte les 2xx comme envoyés", () => {
    expect(decisionEnvoi(200)).toBe("ok");
    expect(decisionEnvoi(201)).toBe("ok");
  });

  it("alerte plutôt que de deviner sur un code inconnu", () => {
    expect(decisionEnvoi(400)).toBe("alerter");
    expect(decisionEnvoi(0)).toBe("alerter");
  });
});

describe("decisionFinale", () => {
  it("purge un 403 quand d'autres envois ont réussi : c'est l'abonnement, pas la clé", () => {
    // Un abonnement est lié pour toujours à la clé publique qui l'a créé. Si la
    // clé privée signe correctement pour les autres, ce 403 dit seulement que
    // celui-ci vient d'une paire précédente : il ne recevra jamais rien.
    expect(decisionFinale(403, true)).toBe("purger");
    expect(decisionFinale(401, true)).toBe("purger");
  });

  it("n'y touche PAS quand aucun envoi n'a réussi : là, c'est bien notre clé", () => {
    // Le cas du premier lancement après un changement de paire VAPID : tous les
    // abonnements datent de l'ancienne clé, donc rien ne vient prouver que la
    // nouvelle est bonne. Purger ici viderait la table sur ce qui pourrait tout
    // aussi bien être un secret mal collé.
    expect(decisionFinale(403, false)).toBe("alerter");
    expect(decisionFinale(401, false)).toBe("alerter");
  });

  it("ne change rien aux autres codes, succès ou pas", () => {
    for (const succes of [true, false]) {
      expect(decisionFinale(410, succes)).toBe("purger");
      expect(decisionFinale(404, succes)).toBe("purger");
      expect(decisionFinale(429, succes)).toBe("reessayer");
      expect(decisionFinale(500, succes)).toBe("reessayer");
      expect(decisionFinale(201, succes)).toBe("ok");
      expect(decisionFinale(400, succes)).toBe("alerter");
    }
  });
});

describe("tagDuJour", () => {
  it("change chaque jour", () => {
    expect(tagDuJour("2026-08-11")).not.toBe(tagDuJour("2026-08-12"));
  });

  it("est stable pour un même jour — c'est le garde-fou anti double envoi", () => {
    // Deux notifications de même tag se REMPLACENT sur l'appareil au lieu de
    // s'empiler : même si le cron se déclenche deux fois, l'utilisateur ne voit
    // qu'une devinette.
    expect(tagDuJour("2026-08-11")).toBe(tagDuJour("2026-08-11"));
  });
});
