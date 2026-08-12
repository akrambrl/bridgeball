#!/usr/bin/env node
// Exerce scripts/notif-amis.mjs DE BOUT EN BOUT, contre un faux Supabase et un
// faux service de push.
//
//     npx tsx scripts/notif-amis.essai.mjs
//
// Ce que cet essai prouve et que les tests unitaires ne peuvent pas : le script
// est lancé DEUX FOIS de suite, et la seconde fois il n'envoie rien. C'est la
// propriété qui compte — un sondage toutes les 15 minutes qui réenverrait la
// même demande serait pire que pas de notification du tout.
//
// Il vérifie aussi le regroupement (deux demandes pour la même personne = une
// seule notification), le multi-appareil (une personne, deux téléphones, deux
// envois), et qu'une demande hors fenêtre est classée sans être annoncée.

import { createServer } from "node:https";
import { spawn, execFileSync } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import webpush from "web-push";

// Une paire VAPID JETABLE quand le secret n'est pas dans l'environnement.
//
// Sans ça, ce banc d'essai ne pouvait tourner QUE sur une machine où
// VAPID_PRIVATE_KEY était exporté : ailleurs, l'envoyeur s'arrêtait sur
// « clé absente » et les six vérifications tombaient d'un coup — un banc
// d'essai qui échoue faute de secret ne dit rien du code qu'il teste.
//
// La moitié publique n'est pas transmise : push-io.mjs la code en dur, et le
// faux service de push ne vérifie aucune signature. Ce qui est éprouvé ici,
// c'est que la requête est bien signée et chiffrée, pas que la paire soit la
// vraie — celle-là ne doit jamais se trouver dans le dépôt.
const CLE_PRIVEE_ESSAI = process.env.VAPID_PRIVATE_KEY || webpush.generateVAPIDKeys().privateKey;


const ici = dirname(fileURLToPath(import.meta.url));
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const cles = () => { const ec = createECDH("prime256v1"); ec.generateKeys(); return { p256dh: b64u(ec.getPublicKey()), auth: b64u(randomBytes(16)) }; };
const ISO = (msAvant) => new Date(Date.now() - msAvant).toISOString();

const PORT = 8792;
const base = "https://127.0.0.1:" + PORT;

const dossier = mkdtempSync(join(tmpdir(), "goatfc-amis-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
  "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
  "-keyout", join(dossier, "k.pem"), "-out", join(dossier, "c.pem")], { stdio: "ignore" });
const tls = { key: readFileSync(join(dossier, "k.pem")), cert: readFileSync(join(dossier, "c.pem")) };

// ── L'état de la fausse base, modifié par les PATCH du script ──
//   p1 : deux demandes pour Ana → doivent faire UNE notification
//   p2 : une demande pour Bob, qui a DEUX appareils → deux envois
//   p3 : une demande vieille de 3 jours → classée, jamais annoncée
//   p4 : une demande déjà acceptée → classée, jamais annoncée
const DEMANDES = [
  { id: "d1", from_id: "f1", from_name: "Karim", to_id: "p1", to_name: "Ana", status: "pending", created_at: ISO(5 * 60000), notified_at: null },
  { id: "d2", from_id: "f2", from_name: "Léa", to_id: "p1", to_name: "Ana", status: "pending", created_at: ISO(4 * 60000), notified_at: null },
  { id: "d3", from_id: "f3", from_name: "Sam", to_id: "p2", to_name: "Bob", status: "pending", created_at: ISO(3 * 60000), notified_at: null },
  { id: "d4", from_id: "f4", from_name: "Vieux", to_id: "p3", to_name: "Cid", status: "pending", created_at: ISO(3 * 86400000), notified_at: null },
  { id: "d5", from_id: "f5", from_name: "Deja", to_id: "p4", to_name: "Dan", status: "accepted", created_at: ISO(6 * 60000), notified_at: null },
];
const ABONNES = [
  { id: "a1", player_id: "p1", endpoint: base + "/push/ana", ...cles(), platform: "ios", created_at: ISO(86400000) },
  { id: "a2", player_id: "p2", endpoint: base + "/push/bob-tel", ...cles(), platform: "android", created_at: ISO(86400000) },
  { id: "a3", player_id: "p2", endpoint: base + "/push/bob-pc", ...cles(), platform: "desktop", created_at: ISO(86400000) },
  // p3 et p4 ne sont pas abonnés.
];

const recus = [];
const serveur = createServer(tls, (req, res) => {
  const [chemin, requete] = req.url.split("?");
  const q = new URLSearchParams(requete || "");

  if (chemin === "/rest/v1/bb_friend_requests") {
    if (req.method === "PATCH") {
      const m = (requete || "").match(/id=in\.\(([^)]*)\)/);
      let corps = "";
      req.on("data", (c) => { corps += c; });
      req.on("end", () => {
        const patch = JSON.parse(corps || "{}");
        if (m) for (const id of m[1].split(",")) {
          const d = DEMANDES.find((x) => x.id === id);
          if (d) Object.assign(d, patch);
        }
        res.writeHead(204); res.end();
      });
      return;
    }
    // Le script ne demande que les lignes jamais notifiées : on respecte le
    // filtre, sinon l'essai ne testerait pas l'idempotence mais la mémoire du
    // script.
    const seulementNonNotifiees = q.get("notified_at") === "is.null";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(DEMANDES.filter((d) => !seulementNonNotifiees || !d.notified_at)));
    return;
  }

  if (chemin === "/rest/v1/bb_push_subscriptions") {
    const filtre = q.get("player_id") || "";
    const ids = (filtre.match(/in\.\((.*)\)/) || [, ""])[1].replace(/"/g, "").split(",").filter(Boolean);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ABONNES.filter((a) => !ids.length || ids.includes(a.player_id))));
    return;
  }

  if (chemin.startsWith("/push/")) {
    let corps = "";
    req.on("data", (c) => { corps += c; });
    req.on("end", () => { recus.push({ cible: chemin, octets: corps.length }); res.writeHead(201); res.end(); });
    return;
  }
  res.writeHead(404); res.end();
});

await new Promise((ok) => serveur.listen(PORT, "127.0.0.1", ok));

function lancer(tour) {
  console.log("\n══ passage " + tour + " ══");
  return new Promise((ok) => {
    spawn("npx", ["tsx", join(ici, "notif-amis.mjs")], {
      stdio: "inherit",
      env: { ...process.env, SB_URL: base, SB_SERVICE_KEY: "fausse-cle-de-service",
        VAPID_PRIVATE_KEY: CLE_PRIVEE_ESSAI, VAPID_SUBJECT: "https://goatfc.fr",
        NODE_TLS_REJECT_UNAUTHORIZED: "0" },
    }).on("exit", ok);
  });
}

const code1 = await lancer(1);
const apresPremier = recus.length;
const code2 = await lancer(2);
const apresSecond = recus.length;

serveur.close();
rmSync(dossier, { recursive: true, force: true });

// ── Vérifications ──
const echecs = [];
const attendu = (nom, reel, veut) => { if (JSON.stringify(reel) !== JSON.stringify(veut)) echecs.push(nom + " : " + JSON.stringify(reel) + " au lieu de " + JSON.stringify(veut)); };

attendu("3 envois au premier passage (Ana ×1 groupé, Bob ×2 appareils)", apresPremier, 3);
attendu("Ana n'a reçu qu'UNE notification pour ses deux demandes",
  recus.filter((r) => r.cible === "/push/ana").length, 1);
attendu("Bob a été notifié sur ses deux appareils",
  recus.filter((r) => r.cible.startsWith("/push/bob")).length, 2);
attendu("RIEN au second passage — la propriété qui compte", apresSecond - apresPremier, 0);
attendu("les demandes annoncées sont marquées",
  DEMANDES.filter((d) => ["d1", "d2", "d3"].includes(d.id)).every((d) => !!d.notified_at), true);
attendu("la demande hors fenêtre est classée sans avoir été annoncée",
  [!!DEMANDES.find((d) => d.id === "d4").notified_at,
   recus.some((r) => r.cible.includes("cid"))], [true, false]);
attendu("la demande déjà acceptée est classée sans envoi",
  !!DEMANDES.find((d) => d.id === "d5").notified_at, true);
attendu("codes de sortie", [code1, code2], [0, 0]);

console.log("");
if (echecs.length) { for (const e of echecs) console.error("✗ " + e); process.exit(1); }
console.log("✓ notifications d'ami vérifiées : 3 envois au premier passage, 0 au second, "
  + "regroupement par destinataire et multi-appareil corrects");
