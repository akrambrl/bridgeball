import { useEffect, useState } from "react";
import type { GameMode } from "@/pages/Home";
import { tr } from "@/lib/lang";
import { fetchTopPlayers, type TopPlayer } from "@/lib/leaderboard";

type Props = {
  onPlay: (game?: GameMode) => void;
  onJoinRoom: (code: string) => void;
  onOpenDuels?: (tab?: string) => void;
  onOpenFriends?: () => void;
};

type GameKey = "plug" | "mercato" | "grid" | "guess";

const GAMES: {
  key: GameKey;
  mode: GameMode;
  name: string;
  tagline: string;
  img: string;
  mascot: string;
  description: string;
  accent: string;
  badge: string;
}[] = [
  {
    key: "mercato",
    mode: "chaine",
    name: "The Mercato",
    tagline: "La chaîne sans fin",
    img: "/mercato-card.png",
    mascot: "/win1.png",
    description:
      "Pars d'un joueur et enchaîne les transferts. Bats ton record.",
    accent: "#FF8A2A",
    badge: "MARATHON",
  },
  {
    key: "plug",
    mode: "pont",
    name: "The Plug",
    tagline: "Le pont entre deux clubs",
    img: "/plug-card.png",
    mascot: "/win3.png",
    description:
      "Deux clubs, un seul joueur. À toi de trouver le maillon qui les relie.",
    accent: "#00E676",
    badge: "SIGNATURE",
  },
  {
    key: "grid",
    mode: "grid",
    name: "Trouve le joueur",
    tagline: "Déduction en illimité",
    img: "/reveal-card.png",
    mascot: "/win2.png",
    description:
      "Déduis le joueur mystère grâce à ses indices, en illimité. Enchaîne les bonnes réponses et monte ta série.",
    accent: "#00E676",
    badge: "ILLIMITÉ",
  },
  {
    key: "guess",
    mode: "guess",
    name: "GOAT Guess",
    tagline: "Je devine ton joueur",
    img: "/guess-card.png",
    mascot: "/win1.png",
    description:
      "Pense à un footballeur. En 25 questions max, je devine de qui il s'agit. 🔮",
    accent: "#C084FC",
    badge: "MAGIE",
  },
];

// Champs traduits des jeux (tagline / description / badge) résolus au rendu
function gameTagline(k: GameKey): string {
  switch (k) {
    case "mercato": return tr("La chaîne sans fin", "The endless chain", "Die endlose Kette", "La catena infinita", "A corrente sem fim");
    case "plug": return tr("Le pont entre deux clubs", "The bridge between two clubs", "Die Brücke zwischen zwei Klubs", "Il ponte tra due club", "A ponte entre dois clubes");
    case "grid": return tr("Déduction en illimité", "Endless deduction", "Endlose Deduktion", "Deduzione illimitata", "Dedução ilimitada");
    case "guess": return tr("Je devine ton joueur", "I guess your player", "Ich errate deinen Spieler", "Indovino il tuo giocatore", "Eu adivinho seu jogador");
  }
}
function gameDescription(k: GameKey): string {
  switch (k) {
    case "mercato": return tr("Pars d'un joueur et enchaîne les transferts. Bats ton record.", "Start from a player and chain transfers. Beat your record.", "Starte bei einem Spieler und reihe Transfers aneinander. Schlag deinen Rekord.", "Parti da un giocatore e concatena i trasferimenti. Batti il tuo record.", "Comece por um jogador e encadeie as transferências. Bata seu recorde.");
    case "plug": return tr("Deux clubs, un seul joueur. À toi de trouver le maillon qui les relie.", "Two clubs, one player. Find the link that connects them.", "Zwei Klubs, ein Spieler. Finde das Bindeglied zwischen ihnen.", "Due club, un solo giocatore. Trova l'anello che li unisce.", "Dois clubes, um jogador. Ache o elo que os liga.");
    case "grid": return tr("Déduis le joueur mystère grâce à ses indices, en illimité. Enchaîne les bonnes réponses et monte ta série.", "Deduce the mystery player from his clues, unlimited. Chain correct answers to build your streak.", "Leite den Mystery-Spieler aus seinen Hinweisen ab, unbegrenzt. Reihe richtige Antworten für deine Serie aneinander.", "Deduci il giocatore misterioso dai suoi indizi, illimitato. Concatena le risposte giuste per la tua serie.", "Deduza o jogador misterioso pelas dicas, ilimitado. Encadeie acertos para subir sua sequência.");
    case "guess": return tr("Pense à un footballeur. En 25 questions max, je devine de qui il s'agit. 🔮", "Think of a footballer. In 25 questions max, I'll guess who it is. 🔮", "Denk an einen Fußballer. In max. 25 Fragen errate ich, wer es ist. 🔮", "Pensa a un calciatore. In max 25 domande indovino chi è. 🔮", "Pense num jogador. Em no máximo 25 perguntas, eu adivinho quem é. 🔮");
  }
}
function gameBadge(k: GameKey): string {
  switch (k) {
    case "mercato": return tr("MARATHON", "MARATHON", "MARATHON", "MARATONA", "MARATONA");
    case "plug": return "SIGNATURE";
    case "grid": return tr("ILLIMITÉ", "UNLIMITED", "UNBEGRENZT", "ILLIMITATO", "ILIMITADO");
    case "guess": return tr("MAGIE", "MAGIC", "MAGIE", "MAGIA", "MAGIA");
  }
}

// Compteur "live" qui fluctue entre 80 et 320 joueurs (mock)
function useLiveOnline() {
  const [n, setN] = useState(() => 120 + Math.floor(Math.random() * 80));
  useEffect(() => {
    const id = setInterval(() => {
      setN((prev) => {
        const drift = Math.floor(Math.random() * 13) - 6;
        const next = prev + drift;
        return Math.max(60, Math.min(380, next));
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);
  return n;
}


const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

export const LobbyView = ({ onPlay, onJoinRoom, onOpenDuels, onOpenFriends }: Props) => {
  const [selected, setSelected] = useState<GameKey>("mercato");
  const game = GAMES.find((g) => g.key === selected)!;
  const online = useLiveOnline();
  const [roomCode, setRoomCode] = useState("");
  const [top5, setTop5] = useState<TopPlayer[]>([]);
  // Indicateurs "Défis ouverts" : nb de défis à relever + tentatives non vues sur mes défis
  const [openCount, setOpenCount] = useState(0);
  const [myUnseen, setMyUnseen] = useState(0);
  // Demandes d'ami reçues en attente (badge rouge)
  const [pendingFriends, setPendingFriends] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const myId = localStorage.getItem("bb_player_id") || "";
        const h = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };
        // Demandes d'ami reçues en attente
        if (myId) {
          const frRes = await fetch(
            SB_URL + "/rest/v1/bb_friend_requests?to_id=eq." + myId + "&status=eq.pending&select=id&limit=100",
            { headers: h }
          );
          const fr = frRes.ok ? await frRes.json() : [];
          if (alive) setPendingFriends(Array.isArray(fr) ? fr.length : 0);
        }
        // Défis ouverts dispo (des autres, pas déjà relevés)
        const openRes = await fetch(
          SB_URL + "/rest/v1/bb_duels?status=eq.open&select=id,challenger_id&limit=200",
          { headers: h }
        );
        const open = openRes.ok ? await openRes.json() : [];
        let done: string[] = [];
        try { done = JSON.parse(localStorage.getItem("bb_open_done") || "[]"); } catch {}
        const avail = (Array.isArray(open) ? open : []).filter(
          (d: any) => d.challenger_id !== myId && done.indexOf(d.id) === -1
        ).length;
        // Tentatives sur MES défis, non encore vues
        let unseen = 0;
        if (myId) {
          const attRes = await fetch(
            SB_URL + "/rest/v1/bb_duels?challenger_id=eq." + myId + "&status=eq.open_done&select=id&limit=200",
            { headers: h }
          );
          const att = attRes.ok ? await attRes.json() : [];
          let seen: string[] = [];
          try { seen = JSON.parse(localStorage.getItem("bb_open_seen") || "[]"); } catch {}
          unseen = (Array.isArray(att) ? att : []).filter((a: any) => seen.indexOf(a.id) === -1).length;
        }
        if (alive) { setOpenCount(avail); setMyUnseen(unseen); }

        // Top 5 de la saison en cours — même source que le mobile
        const top = await fetchTopPlayers(5);
        if (alive) setTop5(top);
      } catch {}
    };
    load();
    // Rafraîchit les indicateurs (défis + demandes d'ami) toutes les 30 s
    const id = setInterval(load, 30000);
    // …et dès que l'utilisateur revient sur l'onglet/l'app
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const submitRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) return;
    onJoinRoom(code);
  };

  return (
    <div className="container max-w-[1440px] mx-auto px-6 lg:px-10 py-6 grid lg:grid-cols-[280px_1fr_320px] gap-6 items-start">
      {/* COLONNE GAUCHE — choix du jeu */}
      <div className="space-y-3">
        <div className="font-display text-sm tracking-[0.25em] text-white/40 px-1 mb-2">
          {tr("NOS JEUX", "OUR GAMES", "UNSERE SPIELE", "I NOSTRI GIOCHI", "NOSSOS JOGOS")}
        </div>
        {GAMES.map((g) => {
          const isActive = g.key === selected;
          return (
            <button
              key={g.key}
              onClick={() => setSelected(g.key)}
              className={
                "w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 transition-all " +
                (isActive
                  ? "border-[#FFC93C] bg-white/[0.04]"
                  : "border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04]")
              }
            >
              <div className="relative h-14 w-14 rounded-xl overflow-hidden flex-shrink-0">
                <img src={g.img} alt={g.name} className="h-full w-full object-cover" />
                {isActive && (
                  <div className="absolute inset-0 ring-2 ring-[#FFC93C] rounded-xl" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-display text-xl tracking-wider truncate">{g.name}</div>
                <div className="text-xs text-white/50 truncate">{gameTagline(g.key)}</div>
              </div>
            </button>
          );
        })}

        {/* Live online counter */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3 flex items-center gap-2.5">
          <span className="goat-blink h-2.5 w-2.5 rounded-full bg-[#00E676] shadow-[0_0_10px_#00E676]" />
          <span className="font-display text-base tracking-wider text-white tabular-nums">
            {online}
          </span>
          <span className="text-xs text-white/50">{tr("en ligne", "online", "online", "online", "online")}</span>
        </div>
      </div>

      {/* CENTRE — preview du jeu sélectionné + mascotte + bouton PLAY */}
      <div className="relative">
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur min-h-[460px] lg:h-[calc(100dvh-190px)] lg:min-h-[480px] lg:max-h-[640px]">
          {/* Halo couleur jeu */}
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 h-[380px] w-[640px] rounded-full blur-[110px] opacity-30"
            style={{ backgroundColor: game.accent }}
          />

          {/* Visuel du mode — grande carte portrait, comme sur mobile */}
          <div className="hidden md:flex absolute inset-y-0 right-0 w-[50%] items-center justify-center p-6 lg:p-8 pointer-events-none">
            <div
              className="absolute inset-10 rounded-full blur-[70px] opacity-30"
              style={{ backgroundColor: game.accent }}
            />
            <img
              key={game.key}
              src={game.img}
              alt={game.name}
              className="goat-float relative max-h-full max-w-full w-auto object-contain rounded-2xl ring-1 ring-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.75)]"
            />
          </div>

          {/* Texte + CTA */}
          <div className="relative lg:h-full p-6 lg:p-8 flex flex-col justify-center md:max-w-[52%]">
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <span
                className="px-3 py-1 rounded-full font-display text-xs tracking-[0.25em] mb-2"
                style={{
                  backgroundColor: `${game.accent}20`,
                  color: game.accent,
                  border: `1px solid ${game.accent}40`,
                }}
              >
                {gameBadge(game.key)}
              </span>

              <h2 className="font-display text-4xl lg:text-6xl tracking-wide leading-none mb-2">
                {game.name}
              </h2>
              <p
                className="font-display text-xl lg:text-2xl tracking-widest mb-3"
                style={{ color: game.accent }}
              >
                {gameTagline(game.key)}
              </p>

              {/* Card preview — seulement en dessous de md (au-dessus, la grande
                  carte du mode occupe la moitié droite du cadre) */}
              <div className="relative my-1 mb-4 md:hidden">
                <div
                  className="absolute inset-0 blur-2xl opacity-50 rounded-2xl"
                  style={{ backgroundColor: game.accent }}
                />
                <img
                  src={game.img}
                  alt={game.name}
                  className="relative h-20 lg:h-24 w-auto rounded-xl shadow-2xl"
                />
              </div>

              <p className="text-white/70 max-w-md mb-4 text-sm lg:text-base">{gameDescription(game.key)}</p>

              {/* Gros bouton PLAY */}
              <button
                onClick={() => onPlay(game.mode)}
                className="goat-pulse group relative inline-flex items-center gap-3 px-12 py-4 rounded-2xl bg-gradient-to-r from-[#FF8A2A] to-[#FFC93C] text-[#1A0F00] font-display text-4xl tracking-widest hover:scale-[1.03] active:scale-[0.98] transition-transform"
              >
                <span className="text-3xl">▶</span> {tr("JOUER", "PLAY", "SPIELEN", "GIOCA", "JOGAR")}
                <span className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
              </button>

              <p className="mt-2 text-xs text-white/40">
                {tr("Gratuit · Sans inscription · 3 minutes", "Free · No sign-up · 3 minutes", "Gratis · Ohne Anmeldung · 3 Minuten", "Gratis · Senza registrazione · 3 minuti", "Grátis · Sem cadastro · 3 minutos")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* COLONNE DROITE — widgets gamifiés */}
      <div className="space-y-4">

        {/* Défis ouverts — salon de duels asynchrones */}
        <button
          onClick={() => onOpenDuels?.(myUnseen > 0 ? "mine" : undefined)}
          className="relative w-full text-left rounded-2xl border-2 border-[#FF8A2A]/40 bg-gradient-to-br from-[#FF8A2A]/15 to-[#FFC93C]/5 p-4 hover:from-[#FF8A2A]/25 transition-colors"
        >
          {myUnseen > 0 && (
            <span className="goat-blink absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF3D57] px-1.5 text-xs font-black text-white shadow-lg">
              {myUnseen}
            </span>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF8A2A] to-[#FFC93C] text-2xl shadow-[0_4px_14px_rgba(255,138,42,0.45)]">
              ⚔️
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg tracking-wider text-[#FF8A2A]">{tr("DÉFIS OUVERTS", "OPEN CHALLENGES", "OFFENE HERAUSFORDERUNGEN", "SFIDE APERTE", "DESAFIOS ABERTOS")}</div>
              <div className="text-xs text-white/60">
                {myUnseen > 0
                  ? (myUnseen > 1
                      ? tr(`🔥 ${myUnseen} joueurs ont relevé ton défi !`, `🔥 ${myUnseen} players took your challenge!`, `🔥 ${myUnseen} Spieler haben deine Herausforderung angenommen!`, `🔥 ${myUnseen} giocatori hanno accettato la tua sfida!`, `🔥 ${myUnseen} jogadores aceitaram seu desafio!`)
                      : tr(`🔥 ${myUnseen} joueur a relevé ton défi !`, `🔥 ${myUnseen} player took your challenge!`, `🔥 ${myUnseen} Spieler hat deine Herausforderung angenommen!`, `🔥 ${myUnseen} giocatore ha accettato la tua sfida!`, `🔥 ${myUnseen} jogador aceitou seu desafio!`))
                  : openCount > 0
                  ? (openCount > 1
                      ? tr(`${openCount} défis à relever`, `${openCount} challenges to take`, `${openCount} Herausforderungen`, `${openCount} sfide da affrontare`, `${openCount} desafios para encarar`)
                      : tr(`${openCount} défi à relever`, `${openCount} challenge to take`, `${openCount} Herausforderung`, `${openCount} sfida da affrontare`, `${openCount} desafio para encarar`))
                  : tr("Bats les scores des autres — ou lance le tien", "Beat others' scores — or post your own", "Schlag die Scores anderer — oder poste deinen", "Batti i punteggi altrui — o lancia il tuo", "Bata as pontuações dos outros — ou lance o seu")}
              </div>
            </div>
          </div>
        </button>

        {/* Mes amis — badge rouge si demande(s) reçue(s) */}
        <button
          onClick={() => onOpenFriends?.()}
          className="relative w-full text-left rounded-2xl border-2 border-[#00E676]/40 bg-gradient-to-br from-[#00E676]/12 to-transparent p-4 hover:from-[#00E676]/20 transition-colors"
        >
          {pendingFriends > 0 && (
            <span className="goat-blink absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF3D57] px-1.5 text-xs font-black text-white shadow-lg">
              {pendingFriends}
            </span>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00E676] to-[#3DA5FF] text-2xl shadow-[0_4px_14px_rgba(0,230,118,0.4)]">
              👥
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg tracking-wider text-[#00E676]">{tr("MES AMIS", "MY FRIENDS", "MEINE FREUNDE", "I MIEI AMICI", "MEUS AMIGOS")}</div>
              <div className="text-xs text-white/60">
                {pendingFriends > 0
                  ? (pendingFriends > 1
                      ? tr(`🔴 ${pendingFriends} demandes d'ami en attente !`, `🔴 ${pendingFriends} pending friend requests!`, `🔴 ${pendingFriends} offene Freundschaftsanfragen!`, `🔴 ${pendingFriends} richieste di amicizia in attesa!`, `🔴 ${pendingFriends} pedidos de amizade pendentes!`)
                      : tr(`🔴 ${pendingFriends} demande d'ami en attente !`, `🔴 ${pendingFriends} pending friend request!`, `🔴 ${pendingFriends} offene Freundschaftsanfrage!`, `🔴 ${pendingFriends} richiesta di amicizia in attesa!`, `🔴 ${pendingFriends} pedido de amizade pendente!`))
                  : tr("Ajoute tes amis et défie-les", "Add your friends and challenge them", "Füge Freunde hinzu und fordere sie heraus", "Aggiungi i tuoi amici e sfidali", "Adicione seus amigos e desafie-os")}
              </div>
            </div>
          </div>
        </button>

        {/* Rejoindre une partie via un code */}
        <form
          onSubmit={submitRoom}
          className="rounded-2xl border-2 border-[#C084FC]/30 bg-gradient-to-br from-[#C084FC]/10 to-transparent p-4"
        >
          <div className="font-display text-base tracking-[0.2em] text-[#C084FC] mb-3">
            {tr("🔑 REJOINDRE UNE PARTIE", "🔑 JOIN A GAME", "🔑 SPIEL BEITRETEN", "🔑 ENTRA IN UNA PARTITA", "🔑 ENTRAR NUMA PARTIDA")}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) =>
                setRoomCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 8)
                )
              }
              placeholder="CODE"
              autoComplete="off"
              maxLength={8}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-[#C084FC] focus:outline-none font-display text-lg tracking-[0.3em] text-center text-white placeholder-white/30"
            />
            <button
              type="submit"
              disabled={roomCode.trim().length < 4}
              className="px-4 py-2.5 rounded-xl font-display text-sm tracking-widest bg-[#C084FC] hover:bg-[#B070EE] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-[#0A1410] transition-colors"
            >
              GO
            </button>
          </div>
          <div className="text-xs text-white/40 mt-2">
            {tr("Tu as un code d'un ami ? Colle-le ici.", "Got a code from a friend? Paste it here.", "Hast du einen Code von einem Freund? Füg ihn hier ein.", "Hai un codice di un amico? Incollalo qui.", "Tem um código de um amigo? Cole aqui.")}
          </div>
        </form>

        {/* Leaderboard preview */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-base tracking-[0.2em] text-white/70">
              {tr("🏆 TOP JOUEURS", "🏆 TOP PLAYERS", "🏆 TOP-SPIELER", "🏆 TOP GIOCATORI", "🏆 TOP JOGADORES")}
            </div>
            <span className="font-display text-xs tracking-widest text-white/40">{tr("CE MOIS-CI", "THIS MONTH", "DIESEN MONAT", "QUESTO MESE", "ESTE MÊS")}</span>
          </div>
          <ul className="space-y-2">
            {top5.map((p) => (
              <li
                key={p.rank}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={
                    "flex-shrink-0 h-6 w-6 rounded-md flex items-center justify-center font-display text-base " +
                    (p.rank === 1
                      ? "bg-[#FFD700] text-black"
                      : p.rank === 2
                      ? "bg-[#C0C0C0] text-black"
                      : p.rank === 3
                      ? "bg-[#CD7F32] text-black"
                      : "bg-white/10 text-white/70")
                  }
                >
                  {p.rank}
                </span>
                <span className="flex-1 truncate text-white/90 font-medium">
                  {p.name}
                </span>
                <span className="font-display text-base tabular-nums text-[#FFC93C] tracking-wider">
                  {p.score.toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
