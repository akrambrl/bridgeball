#!/usr/bin/env node
// Exerce scripts/notif-devinette.mjs DE BOUT EN BOUT, contre un faux Supabase et
// un faux service de push.
//
//     npx tsx scripts/notif-devinette.essai.mjs
//
// Pourquoi ce script existe : les tests unitaires (src/test/push.test.ts)
// couvrent les décisions, pas le circuit — lecture paginée, chiffrement du
// message, envoi, purge des morts et des doublons. Or ce circuit ne peut pas
// être essayé en production : le premier vrai lancement s'adresse à de vrais
// téléphones. Ici, les abonnés et le service de push sont locaux, et l'on
// vérifie ce qui a été envoyé et ce qui a été supprimé.
//
// Deux détails rendent cet essai fidèle :
//  • les clés d'abonné sont de VRAIES clés ECDH P-256 générées à la volée. Sans
//    ça, web-push refuse de chiffrer et l'essai ne prouverait rien.
//  • le faux service de push est en HTTPS, avec un certificat auto-signé fait
//    sur place. Un endpoint de push est toujours en https, et la vérification
//    d'abonnement l'exige — servir en http aurait écarté les quatre abonnés
//    avant tout envoi, et l'essai serait passé en ne testant rien.

import { createServer } from "node:https";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const cles = () => { const ec = createECDH("prime256v1"); ec.generateKeys(); return { p256dh: b64u(ec.getPublicKey()), auth: b64u(randomBytes(16)) }; };

const PORT = 8791;
const base = "https://127.0.0.1:" + PORT;

// Certificat auto-signé jetable. Le processus fils le traitera comme non fiable,
// d'où NODE_TLS_REJECT_UNAUTHORIZED=0 — sur lui seul, et seulement ici.
const dossier = mkdtempSync(join(tmpdir(), "goatfc-push-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
  "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
  "-keyout", join(dossier, "k.pem"), "-out", join(dossier, "c.pem")], { stdio: "ignore" });
const tls = { key: readFileSync(join(dossier, "k.pem")), cert: readFileSync(join(dossier, "c.pem")) };

// Quatre lignes pour quatre cas : un abonné vivant, un DOUBLON du vivant (même
// endpoint, plus ancien — celui que la table accumule faute de contrainte
// d'unicité), un abonné mort (410), et une ligne sans clés de chiffrement.
const ABONNES = [
  { id: "a1", endpoint: base + "/push/vivant", ...cles(), platform: "android", created_at: "2026-08-05T10:00:00Z" },
  { id: "a0", endpoint: base + "/push/vivant", ...cles(), platform: "android", created_at: "2026-01-01T10:00:00Z" },
  { id: "a2", endpoint: base + "/push/mort", ...cles(), platform: "ios", created_at: "2026-08-06T10:00:00Z" },
  { id: "a3", endpoint: base + "/push/vivant2", p256dh: "", auth: "", platform: "desktop", created_at: "2026-08-07T10:00:00Z" },
];

const recus = [], supprimes = [];
let lectures = 0;

const serveur = createServer(tls, (req, res) => {
  const [chemin, requete] = req.url.split("?");
  if (chemin.startsWith("/rest/v1/bb_push_subscriptions")) {
    if (req.method === "DELETE") {
      const m = (requete || "").match(/id=in\.\(([^)]*)\)/);
      if (m) supprimes.push(...m[1].split(","));
      res.writeHead(204); res.end(); return;
    }
    // Le script pagine par l'en-tête Range. Ici le lot tient dans la première
    // page, donc une seule lecture suffit ; on répond quand même vide au-delà,
    // pour qu'une modification du plafond ne fasse pas boucler l'essai.
    const range = req.headers.range || "0-999";
    const debut = Number(range.split("-")[0]);
    lectures++;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(debut === 0 ? ABONNES : []));
    return;
  }
  if (chemin === "/push/vivant") {
    recus.push({ cible: "vivant", encodage: req.headers["content-encoding"], signe: /vapid/.test(req.headers.authorization || "") });
    res.writeHead(201); res.end(); return;
  }
  if (chemin === "/push/mort") { res.writeHead(410); res.end(); return; }
  res.writeHead(404); res.end();
});

await new Promise((ok) => serveur.listen(PORT, "127.0.0.1", ok));

const code = await new Promise((ok) => {
  const fils = spawn("npx", ["tsx", join(ici, "notif-devinette.mjs"), "--jour=2026-08-11"], {
    stdio: "inherit",
    env: { ...process.env, SB_URL: base, SB_SERVICE_KEY: "fausse-cle-de-service",
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || "", VAPID_SUBJECT: "https://goatfc.fr",
      NODE_TLS_REJECT_UNAUTHORIZED: "0" },
  });
  fils.on("exit", ok);
});
serveur.close();
rmSync(dossier, { recursive: true, force: true });

// ── Vérifications ──
const echecs = [];
const attendu = (nom, reel, veut) => { if (JSON.stringify(reel) !== JSON.stringify(veut)) echecs.push(nom + " : " + JSON.stringify(reel) + " au lieu de " + JSON.stringify(veut)); };

attendu("une seule notification envoyée (le doublon n'a pas reçu deux fois)", recus.length, 1);
attendu("message chiffré en aes128gcm", recus[0] && recus[0].encodage, "aes128gcm");
attendu("requête signée VAPID", recus[0] && recus[0].signe, true);
attendu("l'abonné mort, le doublon et la ligne sans clés sont supprimés",
  supprimes.slice().sort(), ["a0", "a2", "a3"]);
attendu("code de sortie", code, 0);
// Une seule lecture : la première page rend moins de lignes que le plafond, ce
// qui suffit à savoir qu'il n'y en a pas d'autre. Demander une deuxième page
// serait un aller-retour pour rien.
attendu("une seule lecture pour un lot plus petit que le plafond", lectures, 1);

console.log("");
if (echecs.length) { for (const e of echecs) console.error("✗ " + e); process.exit(1); }
console.log("✓ circuit complet vérifié : 1 envoi chiffré et signé, 3 lignes purgées (mort, doublon, sans clés)");
