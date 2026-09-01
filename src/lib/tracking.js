// Agrégation du tableau de bord de suivi (?stats=CODE).
//
// Ce calcul vivait dans un useMemo de LePont.jsx, à côté de 350 lignes de rendu.
// Il est ici parce qu'il porte toute la sémantique du back-office — ce qu'est un
// « joueur actif », ce que compte une « partie » — et que les filtres ajoutés
// ensuite (mode, public, support) doivent traverser CHAQUE chiffre. Un filtre
// qui n'est appliqué qu'à la moitié des sections ne se voit pas : il affiche des
// nombres cohérents entre eux et faux. D'où src/test/tracking.test.ts.
import { G } from "./charte.jsx";

export const PLAY_MODES = [
  { key:"battle",    label:"GOAT Battle",       emoji:"⚡",  color:"#FFC93C" },
  { key:"pont",      label:"The Plug",          emoji:"🔗",  color:G.pelouseClaire },
  { key:"chaine",    label:"The Mercato",       emoji:"🔁",  color:"#FF8A2A" },
  { key:"reveal",    label:"Trouve le joueur",  emoji:"🕵️", color:"#E0B85C" },
  { key:"devinette", label:"Devinette du jour", emoji:"🗓️", color:"#F2D680" },
  { key:"grid",      label:"GOAT Grid",         emoji:"▦",   color:"#3DA5FF" },
  { key:"guess",     label:"GOAT Guess",        emoji:"🔮",  color:"#C084FC" },
];

export const MODES_PAR_CLE = PLAY_MODES.reduce(function (acc, m) { acc[m.key] = m; return acc; }, {});

// bb_scores porte son propre vocabulaire de modes, plus étroit que celui des
// événements : seuls les modes qui classent un score y écrivent. Sans cette
// table, un filtre « The Plug » laissait passer tous les scores et le compteur
// de parties ne bougeait pas.
export const MODE_DU_SCORE = { pont: "pont", chaine: "chaine", findscore: "reveal", devinette: "devinette" };

// Base neutre de l'agrégation : aucun filtre, et la plage la PLUS LARGE, parce
// qu'ici « vide » veut dire « ne restreint rien ». Ce n'est pas ce que le tableau
// de bord montre en premier — cette valeur-là est PLAGE_DEFAUT, plus bas. Les
// deux ont longtemps été confondues, ce qui ouvrait le tableau de bord sur
// 14 jours alors que la question du quotidien est « et aujourd'hui ? ».
export const FILTRES_VIDES = { plage: 14, mode: "tous", public: "tous", support: "tous", recherche: "" };

// Plage à l'ouverture. La plage n'est pas comptée comme un filtre actif
// (nbFiltresActifs l'ignore) et le bouton de remise à zéro la conserve : la
// changer ici ne touche donc que le premier écran.
export const PLAGE_DEFAUT = 1;

export const RUBRIQUES = [
  { key: "resume",   label: "Vue d'ensemble", emoji: "📊" },
  { key: "audience", label: "Audience",       emoji: "👥" },
  { key: "modes",    label: "Modes de jeu",   emoji: "🎮" },
  { key: "joueurs",  label: "Joueurs",        emoji: "👤" },
  { key: "comptes",  label: "Comptes",        emoji: "🆔" },
];

/** "play_pont_online" → { mode:"pont", online:true }. null si ce n'est pas une partie. */
export function modeDeType(type) {
  if (!type || type.indexOf("play_") !== 0) return null;
  const online = type.slice(-7) === "_online";
  const mode = online ? type.slice(5, -7) : type.slice(5);
  return MODES_PAR_CLE[mode] ? { mode: mode, online: online } : null;
}

/** Nombre de filtres qui restreignent réellement les chiffres (hors plage). */
export function nbFiltresActifs(f) {
  let n = 0;
  if (f.mode && f.mode !== "tous") n++;
  if (f.public && f.public !== "tous") n++;
  if (f.support && f.support !== "tous") n++;
  if (f.recherche && f.recherche.trim()) n++;
  return n;
}

export function formatDuree(sec) {
  if (!isFinite(sec) || sec <= 0) return "0 s";
  if (sec < 60) return Math.round(sec) + " s";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  if (m < 60) return m + " min" + (s ? " " + s + " s" : "");
  return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0");
}

// Les `range` DERNIERS JOURS CALENDAIRES (Paris), aujourd'hui inclus — et non une
// fenêtre glissante de range × 24 h. Sans ça, « 1 j » comptait aussi la soirée de
// la veille et le grand compteur du haut ne pouvait pas coïncider avec la ligne
// « Aujourd'hui » du détail jour par jour juste en dessous.
function bornes(jours, plage) {
  return jours[Math.min(plage, jours.length) - 1];
}

/**
 * @param data    ce que charge Tracking.jsx : rawScores, rawEvents, regIds, pseudoById…
 * @param filtres { plage, mode, public, support, recherche }
 * @param jours   les 14 derniers jours calendaires Paris, du plus récent au plus ancien
 */
export function agregeTracking(data, filtres, jours) {
  if (!data) return null;
  const f = Object.assign({}, FILTRES_VIDES, filtres || {});
  const coupe = bornes(jours, f.plage);
  const dansPlage = function (day) { return !!day && day >= coupe; };
  const inscrits = new Set(data.regIds || []);
  const aEvents = !!data.hasEvents;
  const pseudoById = data.pseudoById || {};
  const recherche = (f.recherche || "").trim().toLowerCase();

  // ── Les trois prédicats de filtrage, appliqués partout en dessous ──
  const passePublic = function (pid) {
    if (f.public === "inscrits") return inscrits.has(pid);
    // Sans bb_events on ne sait pas distinguer un anonyme : tout score vient
    // forcément d'un joueur, inscrit ou non, et prétendre le contraire
    // afficherait « 0 anonyme » avec l'assurance d'une mesure.
    if (f.public === "anonymes") return aEvents && !inscrits.has(pid);
    return true;
  };
  const passeRecherche = function (pid) {
    if (!recherche) return true;
    const p = pseudoById[pid];
    return (p && p.toLowerCase().indexOf(recherche) !== -1) ||
           String(pid || "").toLowerCase().indexOf(recherche) !== -1;
  };
  // `avecPlage` à false pour la vue « jour par jour », qui couvre toujours les 14
  // jours : seuls les autres filtres s'y appliquent.
  const passeEvent = function (r, avecPlage) {
    if (avecPlage !== false && !dansPlage(r.day)) return false;
    if (!r.day || !passePublic(r.player_id) || !passeRecherche(r.player_id)) return false;
    const m = modeDeType(r.type);
    // Les événements qui ne sont pas des parties (open_*, dur_*) ne portent ni
    // mode ni support : les filtres de jeu ne les concernent pas, ils restent
    // dans le flux pour que « appareils » et « temps passé » continuent de vivre.
    if (!m) return true;
    if (f.mode !== "tous" && m.mode !== f.mode) return false;
    if (f.support === "solo" && m.online) return false;
    if (f.support === "en-ligne" && !m.online) return false;
    return true;
  };
  const passeScore = function (r, avecPlage) {
    if (avecPlage !== false && !dansPlage(r.day)) return false;
    if (!r.day || !passePublic(r.player_id) || !passeRecherche(r.player_id)) return false;
    if (f.mode !== "tous" && MODE_DU_SCORE[r.mode] !== f.mode) return false;
    // Un score enregistré ne dit pas s'il vient d'une partie en ligne : filtrer
    // par support le retirerait du compte au lieu de l'ignorer.
    if (f.support !== "tous") return false;
    return true;
  };

  const scoresW = (data.rawScores || []).filter(function (r) { return passeScore(r, true); });
  const eventsW = aEvents ? (data.rawEvents || []).filter(function (r) { return passeEvent(r, true); }) : [];

  // Joueurs actifs = UNION des deux sources. bb_events seul ne suffit pas : un
  // score enregistré dont le ping d'événement a échoué (réseau, ancien bundle en
  // cache, RLS) produisait un « 0 joueur · N parties » contradictoire.
  //
  // MAIS il faut alors retirer les événements qui ne sont pas des parties, sinon
  // le filtre de mode ne touche pas ce compteur. passeEvent les laisse passer
  // exprès — `open_*` et `dur_*` ne portent pas de mode, et les écarter viderait
  // « appareils » et « temps passé » dès qu'on filtre un mode. Sauf qu'ils
  // arrivaient ensuite ici : l'écran affichait « 44 actifs · filtré » sur un
  // filtre GOAT Battle où seuls 10 joueurs avaient lancé une partie. Les 44
  // avaient ouvert l'app, ce qui est un autre chiffre — vrai, mais pas celui que
  // le filtre annonce.
  const filtreDeJeu = f.mode !== "tous" || f.support !== "tous";
  const prouveActivite = function (r) { return !filtreDeJeu || !!modeDeType(r.type); };
  const actifs = new Set(), anonymes = new Set();
  const lignesActives = aEvents ? eventsW.filter(prouveActivite).concat(scoresW) : scoresW;
  for (const r of lignesActives) {
    if (!r.player_id) continue;
    actifs.add(r.player_id);
    if (aEvents && !inscrits.has(r.player_id)) anonymes.add(r.player_id);
  }

  // ── Parties par mode, solo / en ligne, et détail par joueur ──
  const parMode = {};
  PLAY_MODES.forEach(function (m) { parMode[m.key] = { solo: 0, online: 0, n: 0 }; });
  let solo = 0, enLigne = 0;
  const parJoueur = {};
  for (const r of eventsW) {
    const m = modeDeType(r.type);
    if (!m) continue;
    const c = parMode[m.mode];
    c.n++; if (m.online) { c.online++; enLigne++; } else { c.solo++; solo++; }
    if (!r.player_id) continue;
    const p = parJoueur[r.player_id] ||
      (parJoueur[r.player_id] = { pid: r.player_id, pseudo: pseudoById[r.player_id] || null, n: 0, modes: {} });
    p.n++; p.modes[m.mode] = (p.modes[m.mode] || 0) + 1;
  }
  const totalParties = PLAY_MODES.reduce(function (s, m) { return s + parMode[m.key].n; }, 0);
  const joueurs = Object.keys(parJoueur).map(function (k) { return parJoueur[k]; })
    .sort(function (a, b) { return b.n - a.n || String(a.pid).localeCompare(String(b.pid)); });

  // ── Temps passé — événements "dur_<secondes>", un par session (lib/track) ──
  let sessions = 0, tempsTotal = 0;
  const tempsParJoueur = {};
  for (const r of eventsW) {
    if (!r.type || r.type.indexOf("dur_") !== 0) continue;
    const s = parseInt(r.type.slice(4), 10);
    if (!isFinite(s) || s <= 0) continue;
    sessions++; tempsTotal += s;
    tempsParJoueur[r.player_id] = (tempsParJoueur[r.player_id] || 0) + s;
  }

  // ── OS — pings "open_<os>", un appareil compté une fois ──
  const osParAppareil = {};
  for (const r of eventsW) { if (r.type && r.type.indexOf("open_") === 0) osParAppareil[r.player_id] = r.type.slice(5); }
  const os = { ios: 0, android: 0, other: 0 };
  for (const id in osParAppareil) { const o = osParAppareil[id]; if (os[o] !== undefined) os[o]++; else os.other++; }

  // ── Jour par jour — TOUJOURS les 14 jours, indépendamment de la plage, pour
  // que la vue reste lisible même en « 1 j ». Les autres filtres s'appliquent. ──
  const toutScores = (data.rawScores || []).filter(function (r) { return passeScore(r, false); });
  const toutEvents = aEvents ? (data.rawEvents || []).filter(function (r) { return passeEvent(r, false); }) : [];
  const actifsParJour = {}, partiesParJour = {};
  const toutActives = aEvents ? toutEvents.filter(prouveActivite).concat(toutScores) : toutScores;
  for (const r of toutActives) {
    if (r.day) (actifsParJour[r.day] = actifsParJour[r.day] || new Set()).add(r.player_id);
  }
  // Une partie se compte sur les ÉVÉNEMENTS quand ils existent, pas sur les
  // scores. bb_scores ne reçoit que les modes qui classent un score — quatre sur
  // sept (voir MODE_DU_SCORE) — donc compter les parties là revenait à afficher
  // « 0 partie » tous les jours sous un filtre GOAT Battle, GOAT Grid ou GOAT
  // Guess, juste à côté d'un graphique qui en annonçait dix. Zéro par
  // construction, jamais parce que personne n'avait joué.
  const partiesDe = aEvents ? toutEvents.filter(function (r) { return !!modeDeType(r.type); }) : toutScores;
  for (const r of partiesDe) { if (r.day) partiesParJour[r.day] = (partiesParJour[r.day] || 0) + 1; }
  const parJour = jours.map(function (d) {
    const set = actifsParJour[d];
    let anon = 0;
    if (set && aEvents) set.forEach(function (id) { if (!inscrits.has(id)) anon++; });
    return { day: d, players: set ? set.size : 0, anon: anon, games: partiesParJour[d] || 0 };
  });

  // ── Comptes créés, filtrés par la recherche (rubrique Comptes) ──
  const comptes = (data.recent || []).filter(function (u) {
    return !recherche || String(u.pseudo || "").toLowerCase().indexOf(recherche) !== -1;
  });

  return {
    plage: f.plage, filtresActifs: nbFiltresActifs(f), aEvents: aEvents,
    actifs: actifs.size, anonymes: anonymes.size,
    // `parties` compte les SCORES ENREGISTRÉS, et seuls trois modes en écrivent :
    // c'est un chiffre juste, mais qui ne répond pas à « combien de parties ».
    // `partiesVues` répond à celle-là, sur les événements, pour les sept modes —
    // et c'est lui qui va dans le grand compteur du haut, là où l'écran promet un
    // résultat « filtré ».
    parties: scoresW.length,
    partiesVues: aEvents ? totalParties : scoresW.length,
    // Les duels n'obéissent QU'À LA PLAGE : bb_duels est chargée sans les
    // identifiants des joueurs (select=id,created_at), donc ni le public ni la
    // recherche ne peuvent s'y appliquer. Le tableau de bord doit donc dire que ce
    // chiffre-là est hors filtres au lieu de le présenter comme filtré.
    duels: (data.rawDuels || []).filter(dansPlage).length,
    parMode: parMode, totalParties: totalParties, solo: solo, enLigne: enLigne,
    joueurs: joueurs, joueursInscrits: joueurs.filter(function (p) { return !!p.pseudo; }).length,
    sessions: sessions, tempsTotal: tempsTotal, tempsJoueurs: Object.keys(tempsParJoueur).length,
    os: os, parJour: parJour, comptes: comptes,
  };
}
