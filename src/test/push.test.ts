// Ces tests verrouillent ce que l'audit des notifications a trouvé cassé : rien
// n'envoyait jamais de push (pas d'Edge Function, pas de cron, pas de dépendance
// web-push), alors que l'app demandait la permission et promettait « on te
// pinguera ». Le script d'envoi ajouté doit se comporter correctement sur les
// deux points où une erreur coûte cher : les doublons d'abonnement, et le
// traitement d'un refus du serveur de push.
import { describe, it, expect } from "vitest";
import { abonnementUtilisable, dedupeAbonnements, decisionEnvoi, decisionFinale, tagDuJour,
         demandesANotifier, accrocheAmis, grouperPar, resumerCorps, repartitionHotes } from "../lib/push.js";

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

describe("demandesANotifier", () => {
  const H = 3600000;
  const maintenant = Date.parse("2026-08-11T12:00:00Z");
  const dem = (id: string, o: any = {}) => ({
    id, from_id: "f", from_name: "Machin", to_id: "t", to_name: "Toi",
    status: "pending", created_at: "2026-08-11T11:50:00Z", notified_at: null, ...o,
  });

  it("annonce une demande récente et en attente", () => {
    const { aEnvoyer } = demandesANotifier([dem("1")], maintenant, 24 * H);
    expect(aEnvoyer.map((d: any) => d.id)).toEqual(["1"]);
  });

  it("ignore une demande DÉJÀ notifiée", () => {
    // Sans ça, un sondage toutes les 15 minutes réenverrait la même demande
    // indéfiniment jusqu'à ce qu'elle soit acceptée.
    const r = demandesANotifier([dem("1", { notified_at: "2026-08-11T11:55:00Z" })], maintenant, 24 * H);
    expect(r.aEnvoyer).toEqual([]);
    expect(r.aMarquerSansEnvoi).toEqual([]);
  });

  it("classe sans envoi une demande qui n'est plus en attente", () => {
    const r = demandesANotifier([dem("1", { status: "accepted" })], maintenant, 24 * H);
    expect(r.aEnvoyer).toEqual([]);
    expect(r.aMarquerSansEnvoi.map((d: any) => d.id)).toEqual(["1"]);
  });

  it("classe sans envoi les demandes plus vieilles que la fenêtre", () => {
    // Le garde-fou de la PREMIÈRE exécution : sans lui, toutes les demandes en
    // attente depuis des mois partiraient d'un coup, et chacun recevrait une
    // rafale de « X t'a ajouté en ami » vieux de l'été dernier.
    const r = demandesANotifier([
      dem("vieille", { created_at: "2026-06-01T10:00:00Z" }),
      dem("recente"),
    ], maintenant, 24 * H);
    expect(r.aEnvoyer.map((d: any) => d.id)).toEqual(["recente"]);
    expect(r.aMarquerSansEnvoi.map((d: any) => d.id)).toEqual(["vieille"]);
  });

  it("classe sans envoi une date illisible, au lieu de la croire neuve", () => {
    const r = demandesANotifier([dem("1", { created_at: "n'importe quoi" })], maintenant, 24 * H);
    expect(r.aEnvoyer).toEqual([]);
    expect(r.aMarquerSansEnvoi.map((d: any) => d.id)).toEqual(["1"]);
  });

  it("supporte une table vide", () => {
    expect(demandesANotifier([], maintenant, 24 * H).aEnvoyer).toEqual([]);
    expect(demandesANotifier(null, maintenant, 24 * H).aEnvoyer).toEqual([]);
  });
});

describe("accrocheAmis", () => {
  const d = (nom: string | null) => ({ from_name: nom });

  it("nomme la personne quand il n'y en a qu'une", () => {
    expect(accrocheAmis([d("Karim")]).corps).toContain("Karim");
  });

  it("regroupe plusieurs demandes en UNE notification", () => {
    // Quelqu'un qui revient après une absence peut avoir trois demandes en
    // attente : trois notifications simultanées se lisent comme du harcèlement.
    const a = accrocheAmis([d("Karim"), d("Léa"), d("Sam")]);
    expect(a.titre).toContain("3");
    expect(a.corps).toContain("Karim");
    expect(a.corps).toContain("2 autres");
  });

  it("nomme les deux personnes quand elles sont deux", () => {
    expect(accrocheAmis([d("Karim"), d("Léa")]).corps).toContain("Karim et Léa veulent");
  });

  it("accorde toujours le verbe au pluriel dès qu'ils sont plusieurs", () => {
    // « Karim et 1 autre veut être tes amis » : le sujet est pluriel, le verbe
    // doit l'être aussi. La première version se trompait, et le test aussi.
    for (const n of [2, 3, 5]) {
      const corps = accrocheAmis(Array.from({ length: n }, (_, i) => d("N" + i))).corps;
      expect(corps).toContain("veulent");
      expect(corps).not.toContain(" veut ");
    }
  });

  it("survit à un pseudo absent ou vide", () => {
    expect(accrocheAmis([d(null)]).corps).toContain("Quelqu'un");
    expect(accrocheAmis([d("   ")]).corps).toContain("Quelqu'un");
  });
});

describe("grouperPar", () => {
  it("regroupe par la clé donnée", () => {
    const g = grouperPar([{ to: "a", n: 1 }, { to: "b", n: 2 }, { to: "a", n: 3 }], "to");
    expect([...g.keys()].sort()).toEqual(["a", "b"]);
    expect(g.get("a").map((x: any) => x.n)).toEqual([1, 3]);
  });

  it("supporte une liste vide", () => {
    expect(grouperPar(null, "to").size).toBe(0);
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

// La panne qui a motivé ces deux fonctions : sept envois sur onze échouaient en
// HTTP 400 chaque jour, et le journal n'en disait rien de plus que « HTTP 400 —
// Received unexpected response code ». Ce message vient de web-push et est
// TOUJOURS le même ; la cause est dans `body`, qui était jeté.
describe("resumerCorps", () => {
  it("lit le refus d'Apple", () => {
    expect(resumerCorps('{"reason":"BadDeviceToken"}')).toBe("BadDeviceToken");
    expect(resumerCorps('{"reason":"BadJwtToken"}')).toBe("BadJwtToken");
  });

  it("lit le refus de FCM, message ET statut", () => {
    const corps = '{"error":{"code":400,"message":"The registration token is not a valid FCM registration token","status":"INVALID_ARGUMENT"}}';
    const r = resumerCorps(corps);
    expect(r).toContain("registration token is not a valid");
    expect(r).toContain("INVALID_ARGUMENT");
  });

  it("garde l'errno de Mozilla — c'est lui qui distingue les 400 entre eux", () => {
    // 110 « en-tête de chiffrement invalide » et 105 « abonnement invalide »
    // arrivent tous deux en HTTP 400 mais n'ont pas la même cause : l'un est
    // notre requête, l'autre l'abonné. Sans l'errno, ils sont indistinguables.
    const r = resumerCorps('{"code":400,"errno":110,"error":"Bad Request","message":"Invalid encryption headers"}');
    expect(r).toContain("Invalid encryption headers");
    expect(r).toContain("errno 110");
  });

  it("ne rend pas deux fois la même chose", () => {
    // Certains services répètent le libellé dans `reason` et `message`.
    expect(resumerCorps('{"reason":"BadDeviceToken","message":"BadDeviceToken"}')).toBe("BadDeviceToken");
  });

  it("retombe sur le texte brut quand ce n'est pas du JSON", () => {
    expect(resumerCorps("<html><body>Bad Request</body></html>")).toContain("Bad Request");
    expect(resumerCorps("  push failed \n  badly  ")).toBe("push failed badly");
  });

  it("ne casse pas sur un corps vide ou absent", () => {
    expect(resumerCorps("")).toBe("");
    expect(resumerCorps(null)).toBe("");
    expect(resumerCorps(undefined)).toBe("");
    expect(resumerCorps("{}")).toBe("{}");
  });

  it("borne la longueur : un corps énorme ne doit pas noyer le journal", () => {
    expect(resumerCorps("x".repeat(5000)).length).toBe(200);
    expect(resumerCorps(JSON.stringify({ message: "y".repeat(5000) })).length).toBe(200);
  });
});

describe("repartitionHotes", () => {
  const a = (endpoint: string, platform?: string) => ({ endpoint, platform });

  it("compte par service de push, pas par plateforme déclarée", () => {
    const r = repartitionHotes([
      a("https://web.push.apple.com/aaa", "ios"),
      a("https://web.push.apple.com/bbb", "desktop"), // Safari macOS : même service
      a("https://fcm.googleapis.com/fcm/send/ccc", "android"),
    ]);
    expect(r.map((h) => h.hote)).toEqual(["web.push.apple.com", "fcm.googleapis.com"]);
    expect(r[0].nombre).toBe(2);
    expect(r[0].plateformes).toEqual({ ios: 1, desktop: 1 });
  });

  it("expose l'écart de longueur, qui trahit un endpoint tronqué", () => {
    // Tous les endpoints d'un même service font la même taille à quelques
    // caractères près : un écart franc signale une écriture tronquée, donc un
    // jeton que le service refusera — en HTTP 400, sans autre indice.
    const r = repartitionHotes([
      a("https://fcm.googleapis.com/fcm/send/" + "x".repeat(152)),
      a("https://fcm.googleapis.com/fcm/send/" + "x".repeat(152)),
      a("https://fcm.googleapis.com/fcm/send/" + "x".repeat(60)),
    ]);
    expect(r[0].longueurMax - r[0].longueurMin).toBe(92);
  });

  it("ne jette pas sur un endpoint illisible et le range à part", () => {
    const r = repartitionHotes([a("pas-une-url"), a("https://fcm.googleapis.com/fcm/send/z")]);
    expect(r.find((h) => h.hote === "?")?.nombre).toBe(1);
  });

  it("rend une liste vide sans abonnés", () => {
    expect(repartitionHotes([])).toEqual([]);
    expect(repartitionHotes(null)).toEqual([]);
  });
});
