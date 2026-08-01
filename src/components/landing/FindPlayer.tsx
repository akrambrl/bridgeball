import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYERS } from "../../players.jsx";
import { CLUB_COLORS } from "../LePont.jsx";
import { tr } from "@/lib/lang";
import { trackPlay } from "../../lib/track";

// ─────────────────────────────────────────────────────────────
// TROUVE LE JOUEUR DU JOUR — devine le joueur mystère à partir de son
// parcours de clubs (visuel) + une phrase d'indice, feedback façon Wordle.
// 1 partie/jour, même joueur pour tous, classement + partage.
// ─────────────────────────────────────────────────────────────

type Player = {
  name: string;
  clubs: string[];
  diff: "facile" | "moyen" | "expert";
  nationalities: string[];
  positions: string[];
  birthYear?: number;
};

const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

const MAX_GUESSES = 6;
const ALL = PLAYERS as Player[];

// Révélation puce par puce (suspens, façon « Who Are Ya »)
const CHIP_STAGGER = 0.22; // secondes entre chaque puce
const CHIP_DUR = 0.42; // durée d'apparition d'une puce
const REVEAL_MS = Math.round((5 * CHIP_STAGGER + CHIP_DUR) * 1000) + 250; // 6 puces (index 0..5)

// ── Helpers seed / date ──────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function parisDay(): string {
  const d = new Date();
  const p = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return p.getFullYear() + "-" + String(p.getMonth() + 1).padStart(2, "0") + "-" + String(p.getDate()).padStart(2, "0");
}

// ── Joueur mystère du jour ────────────────────────────────────
// Pool de stars (facile, parcours ≥ 3 clubs), mélangé une fois dans un ordre
// FIXE (même pour tout le monde), puis on tourne selon le numéro de jour →
// chaque joueur passe une seule fois avant un cycle complet (pas de répétition).
function dailyPlayer(): Player {
  let pool = ALL.filter(p => p.diff === "facile" && p.clubs && p.clubs.length >= 3 && p.clubs.length <= 9);
  if (pool.length === 0) pool = ALL.filter(p => p.clubs && p.clubs.length >= 3);
  const rand = seededRandom(987654321); // graine fixe → même ordre pour tous
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  const dayIdx = Math.floor(Date.parse(parisDay() + "T00:00:00Z") / 86400000);
  return arr[((dayIdx % arr.length) + arr.length) % arr.length];
}

function clubColors(name: string): [string, string] {
  return ((CLUB_COLORS as Record<string, [string, string]>)[name]) || ["#1a7a3a", "#FFFFFF"];
}

// Drapeaux pour les nations foot courantes (données en français)
const NAT_FLAG: Record<string, string> = {
  France: "🇫🇷", Portugal: "🇵🇹", Argentine: "🇦🇷", Brésil: "🇧🇷", Espagne: "🇪🇸", Angleterre: "🏴", Allemagne: "🇩🇪",
  Italie: "🇮🇹", "Pays-Bas": "🇳🇱", Belgique: "🇧🇪", Croatie: "🇭🇷", Uruguay: "🇺🇾", Colombie: "🇨🇴", Maroc: "🇲🇦",
  Algérie: "🇩🇿", Sénégal: "🇸🇳", "Côte d'Ivoire": "🇨🇮", Cameroun: "🇨🇲", Nigeria: "🇳🇬", Ghana: "🇬🇭", Danemark: "🇩🇰",
  Suède: "🇸🇪", Norvège: "🇳🇴", Suisse: "🇨🇭", Pologne: "🇵🇱", "République tchèque": "🇨🇿", Serbie: "🇷🇸", Turquie: "🇹🇷",
  Grèce: "🇬🇷", Mexique: "🇲🇽", Japon: "🇯🇵", "États-Unis": "🇺🇸", Mali: "🇲🇱", Écosse: "🏴", "Pays de Galles": "🏴",
  Irlande: "🇮🇪", Autriche: "🇦🇹", Ukraine: "🇺🇦", Russie: "🇷🇺", Égypte: "🇪🇬", Gabon: "🇬🇦", Slovénie: "🇸🇮",
};
function natLabel(nat: string): string { return (NAT_FLAG[nat] ? NAT_FLAG[nat] + " " : "") + nat; }

// Continent (zone) de chaque nationalité foot → code court affiché dans la puce.
const NAT_CONT: Record<string, string> = {
  France: "EU", Portugal: "EU", Espagne: "EU", Angleterre: "EU", Allemagne: "EU", Italie: "EU",
  "Pays-Bas": "EU", Belgique: "EU", Croatie: "EU", Danemark: "EU", Suède: "EU", Norvège: "EU",
  Suisse: "EU", Pologne: "EU", "République tchèque": "EU", Serbie: "EU", Turquie: "EU", Grèce: "EU",
  Écosse: "EU", "Pays de Galles": "EU", Irlande: "EU", "Irlande du Nord": "EU", Autriche: "EU", Ukraine: "EU", Russie: "EU",
  Slovénie: "EU", Hongrie: "EU", Roumanie: "EU", Slovaquie: "EU", "Bosnie-Herzégovine": "EU", Bulgarie: "EU",
  Islande: "EU", Finlande: "EU", Albanie: "EU", "Macédoine du Nord": "EU", Monténégro: "EU", Géorgie: "EU", Arménie: "EU",
  Argentine: "AmS", Brésil: "AmS", Uruguay: "AmS", Colombie: "AmS", Chili: "AmS", Pérou: "AmS",
  Paraguay: "AmS", Équateur: "AmS", Venezuela: "AmS", Bolivie: "AmS",
  Mexique: "AmN", "États-Unis": "AmN", Canada: "AmN", "Costa Rica": "AmN", Honduras: "AmN", Panama: "AmN", Jamaïque: "AmN",
  Maroc: "AF", Algérie: "AF", Sénégal: "AF", "Côte d'Ivoire": "AF", Cameroun: "AF", Nigeria: "AF",
  Ghana: "AF", Mali: "AF", Égypte: "AF", Gabon: "AF", Tunisie: "AF", "Afrique du Sud": "AF",
  "RD Congo": "AF", Congo: "AF", "Burkina Faso": "AF", Guinée: "AF", Togo: "AF", Angola: "AF", Kenya: "AF", Zambie: "AF", "Cap-Vert": "AF",
  Japon: "AS", "Corée du Sud": "AS", Iran: "AS", "Arabie saoudite": "AS", Chine: "AS", Qatar: "AS",
  Irak: "AS", "Émirats arabes unis": "AS", Ouzbékistan: "AS",
  Australie: "OC", "Nouvelle-Zélande": "OC",
};
function continentOf(nat?: string): string { return (nat && NAT_CONT[nat]) || "?"; }
const NOW_Y = new Date().getFullYear();

function posLabel(pos: string): string {
  const l = pos.toLowerCase();
  if (l.includes("gardien")) return tr("Gardien", "Goalkeeper", "Torwart", "Portiere", "Goleiro");
  if (l.includes("défenseur") || l.includes("defenseur")) return tr("Défenseur", "Defender", "Verteidiger", "Difensore", "Zagueiro");
  if (l.includes("milieu")) return tr("Milieu", "Midfielder", "Mittelfeld", "Centrocampista", "Meio-campo");
  return tr("Attaquant", "Forward", "Stürmer", "Attaccante", "Atacante");
}
function posEmoji(pos: string): string {
  const l = pos.toLowerCase();
  if (l.includes("gardien")) return "🧤";
  if (l.includes("défenseur") || l.includes("defenseur")) return "🛡️";
  if (l.includes("milieu")) return "🎯";
  return "⚡";
}

type State = "ok" | "close" | "no";
type Chip = { key: string; label: string; top: string; big?: boolean; state: State; arrow?: "up" | "down"; bg?: string; fg?: string };

// Code court d'un club pour la puce (ex. "Real Madrid" → "REA", "Inter Milan" → "INT").
function clubCode(name: string): string {
  const clean = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z ]/g, "").trim();
  const words = clean.split(/\s+/).filter(w => !/^(fc|cf|ac|as|ss|sc|afc|cd|rc|us|ud|sv|vfb|vfl|bsc|1|de|of|the)$/i.test(w));
  const base = (words[0] || clean).toUpperCase();
  return base.slice(0, 3) || "?";
}

// Feedback façon « Who Are Ya » : chaque attribut de la proposition est comparé
// au joueur mystère → puce ronde + pastille ✓ (vert) / ✗ (rouge) / ↑↓ (âge).
function computeChips(guess: Player, answer: Player): Chip[] {
  const natMatch = guess.nationalities.some(n => answer.nationalities.includes(n));
  const gCont = continentOf(guess.nationalities[0]);
  const aCont = continentOf(answer.nationalities[0]);
  const contMatch = gCont !== "?" && gCont === aCont;
  const posMatch = guess.positions.some(p => answer.positions.some(a => a.toLowerCase() === p.toLowerCase()));
  const shared = guess.clubs.filter(c => answer.clubs.includes(c)).length;
  const gy = guess.birthYear || 0, ay = answer.birthYear || 0;
  // Âge affiché = celui de la proposition ; flèche = sens vers le mystère.
  const gAge = gy ? NOW_Y - gy : 0;
  let ageState: State = "no"; let ageArrow: "up" | "down" | undefined;
  if (gy && ay) {
    const dAge = (NOW_Y - ay) - gAge; // >0 → mystère plus vieux
    if (dAge === 0) ageState = "ok";
    else { ageArrow = dAge > 0 ? "up" : "down"; ageState = Math.abs(dAge) <= 2 ? "close" : "no"; }
  }
  const clubState: State = shared >= 3 ? "ok" : shared >= 1 ? "close" : "no";
  const flag = guess.nationalities[0] ? (NAT_FLAG[guess.nationalities[0]] || guess.nationalities[0].slice(0, 3).toUpperCase()) : "?";
  // Dernier club (club « actuel » en fin de carrière) — comme la référence.
  const gLast = guess.clubs[guess.clubs.length - 1] || "";
  const aLast = answer.clubs[answer.clubs.length - 1] || "";
  const lastState: State = gLast && aLast && gLast === aLast ? "ok" : (gLast && answer.clubs.includes(gLast) ? "close" : "no");
  const [lbg, lfg] = clubColors(gLast);
  return [
    { key: "nat", label: tr("NAT", "NAT", "NAT", "NAZ", "NAC"), top: flag, big: true, state: natMatch ? "ok" : "no" },
    { key: "cont", label: tr("ZONE", "ZONE", "ZONE", "ZONA", "ZONA"), top: gCont, state: contMatch ? "ok" : "no" },
    { key: "pos", label: tr("POSTE", "POS", "POS", "RUOLO", "POS"), top: posEmoji(guess.positions[0] || ""), big: true, state: posMatch ? "ok" : "no" },
    { key: "age", label: tr("ÂGE", "AGE", "ALTER", "ETÀ", "IDADE"), top: gAge ? String(gAge) : "?", state: ageState, arrow: ageArrow },
    { key: "lastclub", label: tr("CLUB", "CLUB", "KLUB", "CLUB", "CLUBE"), top: gLast ? clubCode(gLast) : "?", state: lastState, bg: lbg, fg: lfg },
    { key: "clubs", label: tr("COMMUNS", "SHARED", "GETEILT", "COMUNI", "COMUNS"), top: "🛡" + shared, state: clubState },
  ];
}
const SQ: Record<State, string> = { ok: "🟩", close: "🟨", no: "⬛" };

export const FindPlayer = ({ onClose }: { onClose: () => void }) => {
  const answer = useMemo(() => dailyPlayer(), []);
  const day = parisDay();
  const STORE_KEY = "bb_findplayer";

  const [guesses, setGuesses] = useState<Player[]>([]);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [input, setInput] = useState("");
  const [board, setBoard] = useState<{ loading: boolean; rows: any[]; myRank: number | null; total: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCareer, setShowCareer] = useState(false); // parcours caché par défaut (déduction pure)
  const [animRow, setAnimRow] = useState(-1); // index de la proposition à révéler puce par puce
  const [revealing, setRevealing] = useState(false); // révélation en cours (bloque la saisie sur la manche finale)
  const submittedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restaure la partie du jour
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (raw && raw.date === day && Array.isArray(raw.guesses)) {
        const gs = raw.guesses.map((n: string) => ALL.find(p => p.name === n)).filter(Boolean) as Player[];
        setGuesses(gs);
        setWon(!!raw.won);
        setOver(!!raw.over);
        if (raw.over) submittedRef.current = true;
      }
    } catch { /* noop */ }
    trackPlay("grid"); // réutilise le compteur de l'emplacement (ex-GOAT Grid)
  }, [day]);

  function persist(gs: Player[], w: boolean, o: boolean) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ date: day, guesses: gs.map(g => g.name), won: w, over: o })); } catch { /* noop */ }
  }

  function playerId(): string {
    try {
      let id = localStorage.getItem("bb_player_id");
      if (!id) { id = "anon"; }
      return id;
    } catch { return "anon"; }
  }

  function scoreFor(guessCount: number, w: boolean): number {
    if (!w) return 0;
    return Math.max(100, (MAX_GUESSES - guessCount + 1) * 100); // 1 essai = 600, 6 = 100
  }

  async function submitScore(w: boolean, gs: Player[]) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const name = (() => { try { return localStorage.getItem("bb_name") || ""; } catch { return ""; } })();
    const sc = scoreFor(gs.length, w);
    try {
      await fetch(SB_URL + "/rest/v1/bb_scores", {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ player_id: playerId(), player_name: name || "Anonyme", score: sc, mode: "findplayer", diff: day }),
        keepalive: true,
      });
    } catch { /* noop */ }
    loadBoard();
  }

  async function loadBoard() {
    setBoard({ loading: true, rows: [], myRank: null, total: 0 });
    try {
      const res = await fetch(SB_URL + "/rest/v1/bb_scores?mode=eq.findplayer&diff=eq." + day + "&order=score.desc&limit=200&select=player_id,player_name,score", {
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
      });
      const list = res.ok ? await res.json() : [];
      const seen = new Set<string>(); const best: any[] = [];
      for (const r of Array.isArray(list) ? list : []) { if (seen.has(r.player_id)) continue; seen.add(r.player_id); best.push(r); }
      const idx = best.findIndex((r: any) => r.player_id === playerId());
      setBoard({ loading: false, rows: best.slice(0, 10), myRank: idx >= 0 ? idx + 1 : null, total: best.length });
    } catch { setBoard({ loading: false, rows: [], myRank: null, total: 0 }); }
  }

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (q.length < 2) return [];
    const guessed = new Set(guesses.map(g => g.name));
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const nq = norm(q);
    return ALL.filter(p => !guessed.has(p.name) && norm(p.name).includes(nq))
      .sort((a, b) => (a.diff === "facile" ? -1 : 1) - (b.diff === "facile" ? -1 : 1))
      .slice(0, 6);
  }, [input, guesses]);

  function submitGuess(p: Player) {
    if (over || revealing) return;
    const gs = [...guesses, p];
    const w = p.name === answer.name;
    const o = w || gs.length >= MAX_GUESSES;
    setGuesses(gs);
    setInput("");
    setAnimRow(gs.length - 1); // la nouvelle ligne se révèle puce par puce
    persist(gs, w, o);
    if (o) {
      // Manche finale : on laisse la révélation des puces se jouer (suspens) avant
      // d'afficher le résultat (victoire/défaite) et le parcours.
      setRevealing(true);
      setTimeout(() => {
        setRevealing(false);
        if (w) setWon(true);
        setOver(true);
        submitScore(w, gs);
      }, REVEAL_MS);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function shareText(): string {
    const rows = guesses.map(g => computeChips(g, answer).map(c => SQ[c.state]).join("")).join("\n");
    const head = "🐐 GOAT FC · " + tr("Trouve le joueur", "Guess the player", "Errate den Spieler", "Indovina il giocatore", "Adivinhe o jogador") + " " + day;
    const res = won ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const cta = tr("Tu fais mieux ? 👇", "Can you beat it? 👇", "Schaffst du mehr? 👇", "Fai meglio? 👇", "Consegue superar? 👇");
    return `${head} — ${res}\n${rows}\n\n${cta}\nhttps://goatfc.fr`;
  }
  function doShare() {
    const txt = shareText();
    try { if ((navigator as any).share) { (navigator as any).share({ title: "GOAT FC", text: txt }); return; } } catch { /* noop */ }
    try { navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); } catch { /* noop */ }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0A1410", overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(12px + env(safe-area-inset-top)) 16px 12px", background: "linear-gradient(180deg,#0A1410,rgba(10,20,16,.85))", backdropFilter: "blur(8px)" }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, color: "#fff", padding: "8px 12px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>← {tr("QUITTER", "QUIT", "BEENDEN", "ESCI", "SAIR")}</button>
        <div style={{ fontFamily: "Anton, sans-serif", fontSize: 22, letterSpacing: 1, color: "#00E676", textAlign: "center", lineHeight: 1 }}>{tr("TROUVE LE JOUEUR", "GUESS THE PLAYER", "ERRATE DEN SPIELER", "INDOVINA IL GIOCATORE", "ADIVINHE O JOGADOR")}</div>
        <div style={{ width: 74 }} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px 40px" }}>
        {/* Bandeau défi du jour */}
        <div style={{ textAlign: "center", fontSize: 11, letterSpacing: 2, fontWeight: 800, color: "rgba(255,255,255,.45)", marginBottom: 10 }}>🗓 {tr("DÉFI DU JOUR", "DAILY CHALLENGE", "TAGES-CHALLENGE", "SFIDA DEL GIORNO", "DESAFIO DO DIA")} · {day}</div>

        {/* Parcours de clubs — caché par défaut (déduction pure), révélable en indice */}
        {(showCareer || over) ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,.4)", marginBottom: 6, textAlign: "center" }}>⚽ {tr("SON PARCOURS", "HIS CAREER", "SEINE KARRIERE", "LA SUA CARRIERA", "SUA CARREIRA")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 16, justifyContent: answer.clubs.length <= 4 ? "center" : "flex-start" }}>
              {answer.clubs.map((c, i) => {
                const [bg, fg] = clubColors(c);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {i > 0 && <span style={{ color: "rgba(255,255,255,.35)", fontSize: 14 }}>→</span>}
                    <div style={{ background: bg, color: fg, border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 3px 10px rgba(0,0,0,.35)" }}>{c}</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.4, maxWidth: 300 }}>
              {tr("Devine le joueur mystère à partir de tes propositions.", "Guess the mystery player from your attempts.", "Errate den Mystery-Spieler anhand deiner Versuche.", "Indovina il giocatore misterioso dai tuoi tentativi.", "Adivinhe o jogador misterioso a partir das suas tentativas.")}
            </div>
            <button onClick={() => setShowCareer(true)} style={{ padding: "9px 16px", borderRadius: 999, border: "1px solid rgba(0,230,118,.4)", background: "rgba(0,230,118,.1)", color: "#00E676", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
              💡 {tr("Voir le parcours (indice)", "Reveal career (hint)", "Karriere zeigen (Tipp)", "Mostra la carriera (indizio)", "Ver a carreira (dica)")}
            </button>
          </div>
        )}

        {/* Progression */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          {Array.from({ length: MAX_GUESSES }).map((_, i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < guesses.length ? (won && i === guesses.length - 1 ? "#00E676" : "#FF3D57") : "rgba(255,255,255,.15)" }} />
          ))}
        </div>

        {/* Saisie */}
        {!over && !revealing && (
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={tr("Rechercher un joueur…", "Search a player…", "Spieler suchen…", "Cerca un giocatore…", "Buscar um jogador…")}
              autoComplete="off"
              style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 14, border: "1.5px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 15, fontWeight: 600, outline: "none" }}
            />
            {suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 4, background: "#132419", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
                {suggestions.map(s => (
                  <button key={s.name} onClick={() => submitGuess(s)} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "11px 14px", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,.06)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                    <span>{s.name}</span>
                    <span style={{ fontSize: 15 }}>{s.nationalities[0] && NAT_FLAG[s.nationalities[0]] ? NAT_FLAG[s.nationalities[0]] : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Révélation puce par puce (suspens) */}
        <style>{`@keyframes fpChipIn{0%{opacity:0;transform:rotateY(90deg) scale(.5)}55%{opacity:1;transform:rotateY(0deg) scale(1.12)}100%{opacity:1;transform:rotateY(0deg) scale(1)}}`}</style>

        {/* Lignes de propositions — la plus récente en haut */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {guesses.map((g, gi) => ({ g, gi })).reverse().map(({ g, gi }) => {
            const chips = computeChips(g, answer);
            const correct = g.name === answer.name;
            const anim = gi === animRow; // seule la nouvelle ligne se révèle puce par puce
            return (
              <div key={gi} style={{ background: correct ? "rgba(0,230,118,.16)" : "rgba(255,255,255,.04)", border: "1px solid " + (correct ? "rgba(0,230,118,.5)" : "rgba(255,255,255,.1)"), borderRadius: 14, padding: "10px 10px 12px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: correct ? "#00E676" : "#fff", marginBottom: 9, textAlign: "center" }}>{correct ? "✓ " : ""}{g.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 3, perspective: 600 }}>
                  {chips.map((c, ci) => {
                    const arrow = c.arrow ? (c.arrow === "up" ? "↑" : "↓") : null;
                    const bBg = arrow ? (c.state === "close" ? "#FFB020" : "#FF3D57")
                      : c.state === "ok" ? "#00E676" : c.state === "close" ? "#FFB020" : "#FF3D57";
                    const bSym = arrow ? arrow : c.state === "no" ? "✕" : "✓";
                    const ring = c.state === "ok" ? "rgba(0,230,118,.7)" : c.state === "close" ? "rgba(255,176,32,.7)" : "rgba(255,61,87,.55)";
                    return (
                      <div key={c.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, ...(anim ? { animation: `fpChipIn ${CHIP_DUR}s ease both`, animationDelay: (ci * CHIP_STAGGER) + "s" } : {}) }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: c.bg || "#fff", border: "2px solid " + ring, display: "flex", alignItems: "center", justifyContent: "center", fontSize: c.big ? 20 : c.bg ? 11 : 12, fontWeight: 900, color: c.fg || "#06130B", textShadow: c.bg ? "0 1px 3px rgba(0,0,0,.6)" : "none", boxShadow: "0 3px 8px rgba(0,0,0,.35)", overflow: "hidden" }}>{c.top}</div>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: bBg, color: "#fff", fontSize: 11, fontWeight: 900, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,.4)" }}>{bSym}</div>
                        <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: .3, color: "rgba(255,255,255,.4)" }}>{c.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Écran de fin */}
        {over && (
          <div style={{ marginTop: 16, background: won ? "rgba(0,230,118,.1)" : "rgba(255,61,87,.1)", border: "1px solid " + (won ? "rgba(0,230,118,.4)" : "rgba(255,61,87,.4)"), borderRadius: 18, padding: 18, textAlign: "center" }}>
            <div style={{ fontFamily: "Anton, sans-serif", fontSize: 26, color: won ? "#00E676" : "#FF3D57", letterSpacing: 1 }}>
              {won ? tr("BIEN JOUÉ ! 🎉", "WELL DONE! 🎉", "GUT GEMACHT! 🎉", "BEN FATTO! 🎉", "MANDOU BEM! 🎉") : tr("RATÉ ! 😅", "MISSED! 😅", "VERPASST! 😅", "MANCATO! 😅", "ERROU! 😅")}
            </div>
            <div style={{ fontSize: 14, color: "#fff", marginTop: 6 }}>
              {won ? tr("Trouvé en", "Found in", "Gefunden in", "Trovato in", "Encontrado em") + " " + guesses.length + "/" + MAX_GUESSES : tr("C'était", "It was", "Es war", "Era", "Era") + " :"}
            </div>
            {!won && <div style={{ fontFamily: "Anton, sans-serif", fontSize: 22, color: "#fff", marginTop: 2 }}>{answer.name}</div>}

            <button onClick={doShare} style={{ width: "100%", marginTop: 14, padding: "13px", background: "linear-gradient(135deg,#00E676,#00B85C)", color: "#06130B", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 900, cursor: "pointer" }}>
              {copied ? tr("Copié ! 📋", "Copied! 📋", "Kopiert! 📋", "Copiato! 📋", "Copiado! 📋") : "📤 " + tr("Partager mon résultat", "Share my result", "Ergebnis teilen", "Condividi il risultato", "Compartilhar resultado")}
            </button>

            {/* Classement du jour */}
            <div style={{ marginTop: 14, background: "rgba(0,0,0,.25)", borderRadius: 12, padding: "10px 12px", textAlign: "left" }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,.45)", marginBottom: 6, textAlign: "center" }}>🏆 {tr("CLASSEMENT DU JOUR", "TODAY'S LEADERBOARD", "RANGLISTE DES TAGES", "CLASSIFICA DI OGGI", "RANKING DE HOJE")}</div>
              {(!board || board.loading) ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center", padding: 6 }}>{tr("Chargement…", "Loading…", "Wird geladen…", "Caricamento…", "Carregando…")}</div>
              ) : board.rows.length === 0 ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center", padding: 6 }}>{tr("Sois le premier aujourd'hui !", "Be the first today!", "Sei heute der Erste!", "Sii il primo oggi!", "Seja o primeiro hoje!")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {board.rows.map((r, i) => {
                    const me = r.player_id === playerId();
                    return (
                      <div key={r.player_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 8, background: me ? "rgba(0,230,118,.16)" : "transparent" }}>
                        <span style={{ width: 20, textAlign: "center", fontWeight: 900, fontSize: 12, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,.4)" }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: me ? 800 : 600, color: me ? "#fff" : "rgba(255,255,255,.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.player_name || "Anonyme"}</span>
                        <span style={{ fontFamily: "Anton, sans-serif", fontSize: 15, color: "#00E676" }}>{r.score}</span>
                      </div>
                    );
                  })}
                  {board.myRank && board.myRank > 10 && <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", textAlign: "center", marginTop: 4 }}>{tr("Ton rang", "Your rank", "Dein Rang", "Il tuo posto", "Sua posição")} : #{board.myRank} / {board.total}</div>}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 10 }}>🔒 {tr("Reviens demain pour un nouveau joueur", "Come back tomorrow for a new player", "Komm morgen für einen neuen Spieler", "Torna domani per un nuovo giocatore", "Volte amanhã para um novo jogador")}</div>
          </div>
        )}
      </div>
    </div>
  );
};
