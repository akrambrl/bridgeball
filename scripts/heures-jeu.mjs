#!/usr/bin/env node
// À QUELLE HEURE les joueurs jouent-ils ? — pour régler l'heure d'envoi des
// notifications sur une mesure et non sur une intuition.
//
//     node scripts/heures-jeu.mjs [--jours=14] [--mode=devinette]
//
// Pourquoi ce script existe. La notification quotidienne partait à 20 h, et la
// question « et si le joueur a déjà fait la devinette ? » n'avait pas de réponse
// chiffrée. Elle en a une : à 20 h, 81 % de ceux qui jouent la devinette l'ont
// déjà jouée. Quatre notifications sur cinq arrivaient après la partie qu'elles
// annonçaient.
//
// LECTURE SEULE, et avec la clé PUBLIQUE uniquement — celle qui est déjà dans le
// bundle de l'app. Aucune écriture, aucun secret : ce script peut tourner
// n'importe où, y compris sur une machine de passage.
//
// Deux chiffres, et la distinction compte :
//  • le nombre de PARTIES par heure dit quand ça joue beaucoup, mais quelques
//    joueurs qui enchaînent les manches suffisent à créer un pic ;
//  • le nombre de JOUEURS DISTINCTS par heure dit quand il y a du monde
//    joignable. C'est celui-là qui décide d'une heure d'envoi.
// La mesure de départ donnait 77 parties à 01 h du matin : le second chiffre a
// montré que c'était bien 13 personnes différentes, et non deux insomniaques.

import { readFileSync } from "node:fs";

const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co/rest/v1/";
// La clé publique est lue dans le code de l'app plutôt que recopiée ici : une
// copie de plus, c'est une copie qui divergera.
const CLE = readFileSync(new URL("../src/components/LePont.jsx", import.meta.url), "utf8")
  .match(/const SB_KEY = "([^"]+)"/)[1];
const ENTETES = { apikey: CLE, Authorization: "Bearer " + CLE };

const args = process.argv.slice(2);
const lire = (nom, defaut) => {
  const a = args.find((x) => x.startsWith("--" + nom + "="));
  return a ? a.split("=")[1] : defaut;
};
const JOURS = Math.max(1, parseInt(lire("jours", "14"), 10) || 14);
const MODE = lire("mode", null);

// L'heure de Paris, lue dans les PARTIES du format et non dans sa chaîne.
// `fr-FR` rend « 14 h » — que Number() lit NaN. La première version de cette
// mesure affichait donc 24 heures à zéro sur 1527 lignes bien chargées : un
// résultat qu'on aurait pu croire (« personne ne joue »), ce qui est le pire cas.
// D'où en-GB, formatToParts, et le garde ci-dessous.
const FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false });
function heureParis(iso) {
  const p = FMT.formatToParts(new Date(iso)).find((x) => x.type === "hour");
  const h = Number(p && p.value);
  if (!Number.isInteger(h) || h < 0 || h > 24) throw new Error("heure illisible : " + iso);
  return h === 24 ? 0 : h;
}

// PostgREST tronque à 1000 lignes sans le dire : 14 jours d'événements dépassent
// largement ce seuil, et une troncature silencieuse ferait disparaître les
// heures les plus chargées.
async function toutesLesLignes(chemin) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(SB_URL + chemin, { headers: { ...ENTETES, Range: de + "-" + (de + 999) } });
    if (!r.ok) throw new Error("HTTP " + r.status + " — " + (await r.text()).slice(0, 200));
    const lot = await r.json();
    out.push(...lot);
    if (lot.length < 1000) return out;
  }
}

function barre(n, max, signe) {
  return signe.repeat(max ? Math.round(n / max * 40) : 0);
}

const depuis = new Date(Date.now() - JOURS * 86400000).toISOString();
const lignes = await toutesLesLignes(
  "bb_events?select=created_at,type,player_id&type=like.play_*&created_at=gte." + depuis);
const retenues = MODE
  ? lignes.filter((l) => String(l.type).replace(/^play_/, "").replace(/_online$/, "") === MODE)
  : lignes;

console.log(retenues.length + " parties" + (MODE ? " de « " + MODE + " »" : " (tous modes)")
  + " sur " + JOURS + " jours, heure de Paris\n");
if (!retenues.length) { console.log("Rien à mesurer."); process.exit(0); }

const parties = Array(24).fill(0), joueurs = [];
for (let h = 0; h < 24; h++) joueurs.push(new Set());
for (const l of retenues) {
  const h = heureParis(l.created_at);
  parties[h]++;
  if (l.player_id) joueurs[h].add(l.player_id);
}
const distincts = joueurs.map((s) => s.size);
const maxP = Math.max(...parties), maxD = Math.max(...distincts);

console.log("heure   parties                                    joueurs distincts");
for (let h = 0; h < 24; h++) {
  console.log("  " + String(h).padStart(2, "0") + "h "
    + String(parties[h]).padStart(4) + " " + barre(parties[h], maxP, "█").padEnd(41)
    + String(distincts[h]).padStart(3) + " " + barre(distincts[h], maxD, "▉"));
}

// Le chiffre qui a motivé le déplacement de l'envoi : la part des joueurs qui ont
// DÉJÀ joué à une heure donnée, c'est-à-dire la part de notifications qui
// arrivent après la partie qu'elles annoncent. Cumul depuis minuit à Paris,
// puisque c'est le découpage qui définit la partie du jour.
const total = retenues.length;
console.log("\nenvoyer à … → part des parties DÉJÀ jouées à cette heure");
let cumul = 0;
for (let h = 0; h < 24; h++) {
  cumul += parties[h];
  if (h < 7 || h > 22) continue;
  console.log("  " + String(h).padStart(2, "0") + "h  " + String(Math.round(cumul / total * 100)).padStart(3)
    + " %   (" + cumul + "/" + total + ")   joignables à cette heure : " + distincts[h] + " joueurs");
}

// Un envoi n'agit que sur ceux qui n'ont pas encore joué : ce produit-là est ce
// qu'on cherche à maximiser, et il n'est pas maximal à l'heure la plus animée.
console.log("\nmarge restante × monde présent (indicatif, pour comparer des heures)");
cumul = 0;
const notes = [];
for (let h = 0; h < 24; h++) {
  const avant = cumul; cumul += parties[h];
  notes.push({ h, marge: 1 - avant / total, presents: distincts[h] });
}
for (const n of notes.filter((n) => n.h >= 7 && n.h <= 23)
  .sort((a, b) => b.marge * b.presents - a.marge * a.presents).slice(0, 6)) {
  console.log("  " + String(n.h).padStart(2, "0") + "h  "
    + Math.round(n.marge * 100) + " % pas encore joué · " + n.presents + " joueurs présents");
}
