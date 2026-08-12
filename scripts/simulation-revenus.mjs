#!/usr/bin/env node
// COMBIEN RAPPORTERAIT LA PUB, et qu'est-ce que ça coûte de faire tourner l'app.
//
//     node scripts/simulation-revenus.mjs
//     DAU=1000 node scripts/simulation-revenus.mjs        # un seul scénario
//     INTER_TOUS_LES=3 CONSENTEMENT=0.6 node scripts/...   # changer une hypothèse
//
// LECTURE SEULE, clé publique uniquement. Aucune écriture, aucun secret.
//
// ── CE QUI EST MESURÉ ET CE QUI EST SUPPOSÉ ────────────────────────────────
//
// La distinction est tout l'intérêt de ce script, et elle est affichée à
// l'exécution. Ce qui vient de bb_events est MESURÉ sur les vrais joueurs :
// combien de parties, combien de sessions, combien de minutes par joueur et par
// jour. C'est ce qui détermine le nombre d'emplacements publicitaires, et c'est
// la moitié du calcul que personne ne peut deviner à ta place.
//
// Les eCPM, eux, sont SUPPOSÉS. Ce sont des fourchettes de marché pour la France,
// pas des relevés : ils varient du simple au triple selon la saison (le quatrième
// trimestre paie beaucoup mieux), la plateforme (iOS au-dessus d'Android) et le
// format. Aucune simulation ne remplace un premier mois de vraies données.
//
// ── LE FACTEUR QU'ON OUBLIE : LE CONSENTEMENT ──────────────────────────────
//
// Public français = public de l'EEE. Sans consentement recueilli par une
// plateforme certifiée, les régies ne servent que de la pub NON personnalisée,
// dont l'eCPM est nettement plus bas. Et le taux de consentement réel n'est jamais
// de 100 %. Ce facteur pèse plus lourd que le choix du format publicitaire, d'où
// sa place explicite dans le calcul plutôt que dans une note de bas de page.
//
// La solution de consentement de Google est gratuite ; les alternatives payantes
// n'apportent rien de plus à cette échelle.

import { readFileSync } from "node:fs";

const URL_SB = "https://ialjlsrgcolocoaegzrc.supabase.co/rest/v1/";
const CLE = readFileSync(new URL("../src/components/LePont.jsx", import.meta.url), "utf8")
  .match(/const SB_KEY = "([^"]+)"/)[1];
const H = { apikey: CLE, Authorization: "Bearer " + CLE };

const nb = (nom, defaut) => (process.env[nom] ? Number(process.env[nom]) : defaut);
const eur = (x) => (x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + " €";

// ── 1. MESURE ──────────────────────────────────────────────────────────────
async function pages(chemin) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(URL_SB + chemin, { headers: { ...H, Range: de + "-" + (de + 999) } });
    if (!r.ok) throw new Error("HTTP " + r.status + " — " + (await r.text()).slice(0, 150));
    const lot = await r.json();
    out.push(...lot);
    if (lot.length < 1000) return out;
  }
}

const fmtJour = new Intl.DateTimeFormat("en-CA",
  { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

async function mesurer() {
  const depuis = new Date(Date.now() - 21 * 86400000).toISOString();
  const ev = await pages("bb_events?select=created_at,type,player_id&created_at=gte." + depuis);
  const parJour = new Map();
  for (const e of ev) {
    const j = fmtJour.format(new Date(e.created_at));
    if (!parJour.has(j)) parJour.set(j, { joueurs: new Set(), parties: 0, sessions: 0, secondes: 0, lignes: 0 });
    const d = parJour.get(j);
    d.lignes++;
    if (e.player_id) d.joueurs.add(e.player_id);
    const t = String(e.type || "");
    if (t.startsWith("play_")) d.parties++;
    if (t.startsWith("dur_")) {
      const s = parseInt(t.slice(4), 10);
      if (s > 0) { d.sessions++; d.secondes += s; }
    }
  }
  // Le jour en cours est PARTIEL : l'inclure tirerait toutes les moyennes vers le
  // bas d'autant qu'il est tôt.
  const tous = [...parJour.entries()].sort().slice(0, -1);
  // La mesure de durée n'existe que depuis le déploiement qui l'a introduite : sur
  // les jours d'avant, `sessions` vaut zéro et ferait mentir la moyenne. On ne
  // garde donc, pour les sessions, que les jours où elle a effectivement tourné.
  const avecDuree = tous.filter(([, d]) => d.sessions > 0);
  const moy = (liste, f) => liste.reduce((s, [, d]) => s + f(d), 0) / Math.max(liste.length, 1);
  const dau = moy(avecDuree, (d) => d.joueurs.size);
  return {
    jours: tous.length, joursDuree: avecDuree.length,
    dau,
    partiesParJoueur: moy(avecDuree, (d) => d.parties) / dau,
    sessionsParJoueur: moy(avecDuree, (d) => d.sessions) / dau,
    minutesParJoueur: moy(avecDuree, (d) => d.secondes) / dau / 60,
    lignesParJoueur: moy(avecDuree, (d) => d.lignes) / dau,
    dernier: tous.length ? tous[tous.length - 1] : null,
  };
}

// ── 2. HYPOTHÈSES ──────────────────────────────────────────────────────────
//
// Le nombre d'emplacements n'est pas un curseur libre : une pub tous les tours
// fait fuir, et le coût d'un joueur perdu dépasse ce que son interstitiel
// rapporte. Un interstitiel toutes les DEUX parties est le compromis courant sur
// un jeu de session courte comme celui-ci.
const INTER_TOUS_LES = nb("INTER_TOUS_LES", 2);
const BANNIERE_RAFRAICHIT_S = nb("BANNIERE_RAFRAICHIT_S", 60);
// La vidéo récompensée est OPTIONNELLE par nature (un indice, une seconde
// chance) : seule une fraction des joueurs la regarde, mais elle paie le mieux.
const RECOMPENSEE_PAR_JOUEUR = nb("RECOMPENSEE_PAR_JOUEUR", 0.3);

// eCPM France, en euros pour mille impressions. FOURCHETTES DE MARCHÉ, pas des
// relevés — à remplacer par tes vrais chiffres après un mois.
const ECPM = {
  interstitiel: { bas: 6, moyen: 9, haut: 14 },
  banniere:     { bas: 0.4, moyen: 0.7, haut: 1.2 },
  recompensee:  { bas: 12, moyen: 18, haut: 25 },
};
// Part d'impressions effectivement servies. Élevée en France, jamais 100 %.
const REMPLISSAGE = nb("REMPLISSAGE", 0.92);
// Effet combiné du consentement : part de joueurs qui acceptent la pub
// personnalisée, et manque à gagner sur les autres.
const CONSENTEMENT = nb("CONSENTEMENT", 0.7);
const DECOTE_SANS_CONSENTEMENT = nb("DECOTE_SANS_CONSENTEMENT", 0.55);

// ── 3. COÛTS ───────────────────────────────────────────────────────────────
const CHANGE_USD_EUR = nb("CHANGE_USD_EUR", 0.92);
const FIXES_MENSUELS = [
  { poste: "Compte Apple Developer", montant: 99 * CHANGE_USD_EUR / 12, note: "99 $/an" },
  { poste: "Supabase Pro", montant: 25 * CHANGE_USD_EUR, note: "25 $/mois — le gratuit ne suffit plus" },
  { poste: "Nom de domaine", montant: 15 / 12, note: "~15 €/an" },
];
const UNIQUES = [
  { poste: "Compte Google Play", montant: 25 * CHANGE_USD_EUR, note: "une seule fois" },
];
// Cotisations d'une micro-entreprise sur des revenus publicitaires. C'est le coût
// que personne n'anticipe, et il est proportionnel : il ne disparaît pas à
// l'échelle, il grandit avec elle.
const COTISATIONS = nb("COTISATIONS", 0.22);
const LOT_MENSUEL = nb("LOT_MENSUEL", 70);

// ── 4. LE CALCUL ───────────────────────────────────────────────────────────
function revenus(u, dau, niveau) {
  const inters = dau * (u.partiesParJoueur / INTER_TOUS_LES);
  const bannieres = dau * (u.minutesParJoueur * 60 / BANNIERE_RAFRAICHIT_S);
  const recompensees = dau * RECOMPENSEE_PAR_JOUEUR;
  const mixte = CONSENTEMENT + (1 - CONSENTEMENT) * DECOTE_SANS_CONSENTEMENT;
  const parJour = (n, e) => n / 1000 * e * REMPLISSAGE * mixte;
  const jour = parJour(inters, ECPM.interstitiel[niveau])
             + parJour(bannieres, ECPM.banniere[niveau])
             + parJour(recompensees, ECPM.recompensee[niveau]);
  return { inters, bannieres, recompensees, jour, mois: jour * 30.4 };
}

const u = await mesurer();
const DAU_DEMANDES = process.env.DAU ? [Number(process.env.DAU)] : [Math.round(u.dau), 250, 500, 1000, 2500];

console.log("═══ MESURÉ SUR TES JOUEURS ═══════════════════════════════════════");
console.log("  " + u.joursDuree + " jours avec mesure de durée (sur " + u.jours + " jours de données)");
console.log("  joueurs actifs par jour        " + u.dau.toFixed(1));
console.log("  parties par joueur et par jour " + u.partiesParJoueur.toFixed(2));
console.log("  sessions par joueur            " + u.sessionsParJoueur.toFixed(2));
console.log("  minutes par joueur             " + u.minutesParJoueur.toFixed(1)
  + "   (" + (u.minutesParJoueur / Math.max(u.sessionsParJoueur, .01)).toFixed(1) + " min par session)");
if (u.dernier) console.log("  dernier jour complet           " + u.dernier[0]
  + " : " + u.dernier[1].joueurs.size + " joueurs, " + u.dernier[1].parties + " parties");

console.log("\n═══ HYPOTHÈSES (modifiables) ═════════════════════════════════════");
console.log("  1 interstitiel toutes les " + INTER_TOUS_LES + " parties, bannière rafraîchie à "
  + BANNIERE_RAFRAICHIT_S + " s, " + RECOMPENSEE_PAR_JOUEUR + " vidéo récompensée par joueur");
console.log("  remplissage " + Math.round(REMPLISSAGE * 100) + " % · consentement "
  + Math.round(CONSENTEMENT * 100) + " % · les non-consentants rapportent "
  + Math.round(DECOTE_SANS_CONSENTEMENT * 100) + " % d'un consentant");
console.log("  eCPM France supposés — interstitiel " + ECPM.interstitiel.bas + "–" + ECPM.interstitiel.haut
  + " €, bannière " + ECPM.banniere.bas + "–" + ECPM.banniere.haut
  + " €, récompensée " + ECPM.recompensee.bas + "–" + ECPM.recompensee.haut + " €");

console.log("\n═══ REVENU PUBLICITAIRE BRUT PAR MOIS ════════════════════════════");
console.log("   joueurs/j   impressions/j          bas     moyen      haut    ARPDAU");
for (const dau of DAU_DEMANDES) {
  const b = revenus(u, dau, "bas"), m = revenus(u, dau, "moyen"), h = revenus(u, dau, "haut");
  const imp = Math.round(b.inters + b.bannieres + b.recompensees);
  console.log("  " + String(dau).padStart(8) + String(imp.toLocaleString("fr-FR")).padStart(15)
    + "   " + eur(b.mois).padStart(9) + eur(m.mois).padStart(10) + eur(h.mois).padStart(10)
    + "   " + (m.jour / dau).toFixed(3) + " €");
}

console.log("\n═══ CHARGES ══════════════════════════════════════════════════════");
let fixe = 0;
for (const f of FIXES_MENSUELS) { fixe += f.montant; console.log("  " + f.poste.padEnd(26) + eur(f.montant).padStart(8) + " /mois   (" + f.note + ")"); }
console.log("  " + "Lot du Hall of Fame".padEnd(26) + eur(LOT_MENSUEL).padStart(8) + " /mois   (ton plan)");
console.log("  " + "─".repeat(58));
console.log("  " + "total fixe".padEnd(26) + eur(fixe + LOT_MENSUEL).padStart(8) + " /mois");
for (const p of UNIQUES) console.log("  " + p.poste.padEnd(26) + eur(p.montant).padStart(8) + "        (" + p.note + ")");
console.log("  cotisations micro-entreprise : " + Math.round(COTISATIONS * 100) + " % du CHIFFRE D'AFFAIRES");
console.log("    → proportionnel : cette charge grandit avec les revenus, elle ne se dilue pas.");

console.log("\n═══ CE QU'IL RESTE, APRÈS COTISATIONS ET CHARGES ═════════════════");
console.log("   joueurs/j        bas     moyen      haut");
for (const dau of DAU_DEMANDES) {
  const net = (niveau) => revenus(u, dau, niveau).mois * (1 - COTISATIONS) - fixe - LOT_MENSUEL;
  const signe = (x) => (x >= 0 ? "  " : " ") + eur(x);
  console.log("  " + String(dau).padStart(8) + signe(net("bas")).padStart(11)
    + signe(net("moyen")).padStart(10) + signe(net("haut")).padStart(10));
}

// ── 5. LE SEUIL ────────────────────────────────────────────────────────────
// Le chiffre le plus utile du script : en dessous, l'app coûte de l'argent.
console.log("\n═══ SEUIL DE RENTABILITÉ ═════════════════════════════════════════");
for (const niveau of ["bas", "moyen", "haut"]) {
  const parDauMois = revenus(u, 1000, niveau).mois / 1000 * (1 - COTISATIONS);
  const seuil = Math.ceil((fixe + LOT_MENSUEL) / parDauMois);
  console.log("  scénario " + niveau.padEnd(6) + " → " + String(seuil).padStart(4)
    + " joueurs par jour pour couvrir " + eur(fixe + LOT_MENSUEL) + " par mois");
}
const facteur = (1000 / u.dau);
console.log("\n  Pour situer : 1000 joueurs par jour, c'est " + facteur.toFixed(0)
  + " fois ton audience actuelle.");
console.log("  Le revenu publicitaire est LINÉAIRE en nombre de joueurs : toute la");
console.log("  question est donc la croissance, pas le réglage des emplacements.");
