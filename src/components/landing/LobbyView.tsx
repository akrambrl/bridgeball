import { useEffect, useState } from "react";
import type { GameMode } from "@/pages/Home";
import { nombre, tr } from "@/lib/lang";
import { fetchTopPlayers, type TopPlayer } from "@/lib/leaderboard";
import { dailyRiddleDone } from "@/lib/streak";
import { G, posterText, posterTitre, posterLight, btn, pastilleCharte } from "@/lib/charte.jsx";

type Props = {
  onPlay: (game?: GameMode) => void;
  onJoinRoom: (code: string) => void;
  onOpenDuels?: (tab?: string) => void;
  onOpenFriends?: () => void;
};

type GameKey = "plug" | "mercato" | "grid" | "guess" | "goatgrid" | "duel";

// Les accents viennent désormais des quatre jetons de la charte, plus des
// couleurs libres : le duel prend le ciel (le second camp, par définition dans
// la charte), la grille le maillot, et les deux paires restantes se partagent
// projecteur et pelouse. Quatre teintes pour six jeux : l'identité d'une carte
// vient d'abord de son visuel, l'accent ne fait que la souligner.
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
    img: "/mercato-card.webp",
    mascot: "/win1.webp",
    description:
      "Pars d'un joueur et enchaîne les transferts. Bats ton record.",
    accent: G.projecteur,
    badge: "MARATHON",
  },
  {
    key: "plug",
    mode: "pont",
    name: "The Plug",
    tagline: "Le pont entre deux clubs",
    img: "/plug-card.webp",
    mascot: "/win3.webp",
    description:
      "Deux clubs, un seul joueur. À toi de trouver le maillon qui les relie.",
    accent: G.pelouse,
    badge: "SIGNATURE",
  },
  {
    key: "grid",
    mode: "grid",
    name: "Trouve le joueur",
    tagline: "Déduction en illimité",
    img: "/reveal-card.webp",
    mascot: "/win2.webp",
    description:
      "Déduis le joueur mystère grâce à ses indices, en illimité. Enchaîne les bonnes réponses et monte ta série.",
    accent: G.pelouse,
    badge: "ILLIMITÉ",
  },
  {
    key: "goatgrid",
    mode: "goatgrid",
    name: "GOAT Grid",
    tagline: "La grille 3\u00d73",
    img: "/grid-card.webp",
    mascot: "/win2.webp",
    // \u00ab Solo ou en versus \u00bb est dit ici parce que le bouton JOUER ouvre
    // maintenant le choix des deux, comme sur mobile : la fiche annon\u00e7ait une
    // grille solo alors que le mode a un versus \u00e0 huit.
    description:
      "Neuf cases, neuf crit\u00e8res crois\u00e9s. Trouve un joueur qui coche les deux \u00e0 chaque fois. Solo, ou en versus jusqu'\u00e0 8 joueurs.",
    accent: G.maillot,
    badge: "GRILLE",
  },
  {
    key: "duel",
    mode: "duel",
    name: "GOAT Duel",
    tagline: "Le 1v1 en 90 secondes",
    img: "/duel-card.webp",
    mascot: "/win3.webp",
    description:
      "Quatre-vingt-dix secondes, manches illimit\u00e9es, 10 ou 20 points par bonne r\u00e9ponse. Solo, en ligne ou entre potes.",
    accent: G.ciel,
    badge: "1V1",
  },
  {
    key: "guess",
    mode: "guess",
    name: "GOAT Guess",
    tagline: "Je devine ton joueur",
    img: "/guess-card.webp",
    mascot: "/win1.webp",
    description:
      "Pense à un footballeur. En 25 questions max, je devine de qui il s'agit. 🔮",
    accent: G.projecteur,
    badge: "MAGIE",
  },
];

// Champs traduits des jeux (tagline / description / badge) résolus au rendu
function gameTagline(k: GameKey): string {
  switch (k) {
    case "mercato": return tr("La chaîne sans fin", "The endless chain", "Die endlose Kette", "La catena infinita", "A corrente sem fim","La cadena sin fin");
    case "plug": return tr("Le pont entre deux clubs", "The bridge between two clubs", "Die Brücke zwischen zwei Klubs", "Il ponte tra due club", "A ponte entre dois clubes","El puente entre dos clubes");
    case "grid": return tr("Déduction en illimité", "Endless deduction", "Endlose Deduktion", "Deduzione illimitata", "Dedução ilimitada","Deducción sin límite");
    case "guess": return tr("Je devine ton joueur", "I guess your player", "Ich errate deinen Spieler", "Indovino il tuo giocatore", "Eu adivinho seu jogador","Adivino tu jugador");
    case "goatgrid": return tr("La grille 3\u00d73", "The 3\u00d73 grid", "Das 3\u00d73-Raster", "La griglia 3\u00d73", "A grade 3\u00d73","La cuadrícula 3×3");
    case "duel": return tr("Le 1v1 en 90 secondes", "The 90-second 1v1", "Das 1-gegen-1 in 90 Sekunden", "L'1contro1 in 90 secondi", "O 1v1 em 90 segundos","El 1c1 en 90 segundos");
  }
}
function gameDescription(k: GameKey): string {
  switch (k) {
    case "mercato": return tr("Pars d'un joueur et enchaîne les transferts. Bats ton record.", "Start from a player and chain transfers. Beat your record.", "Starte bei einem Spieler und reihe Transfers aneinander. Schlag deinen Rekord.", "Parti da un giocatore e concatena i trasferimenti. Batti il tuo record.", "Comece por um jogador e encadeie as transferências. Bata seu recorde.","Parte de un jugador y encadena traspasos. Bate tu récord.");
    case "plug": return tr("Deux clubs, un seul joueur. À toi de trouver le maillon qui les relie.", "Two clubs, one player. Find the link that connects them.", "Zwei Klubs, ein Spieler. Finde das Bindeglied zwischen ihnen.", "Due club, un solo giocatore. Trova l'anello che li unisce.", "Dois clubes, um jogador. Ache o elo que os liga.","Dos clubes, un solo jugador. Encuentra el eslabón que los une.");
    case "grid": return tr("Déduis le joueur mystère grâce à ses indices, en illimité. Enchaîne les bonnes réponses et monte ta série.", "Deduce the mystery player from his clues, unlimited. Chain correct answers to build your streak.", "Leite den Mystery-Spieler aus seinen Hinweisen ab, unbegrenzt. Reihe richtige Antworten für deine Serie aneinander.", "Deduci il giocatore misterioso dai suoi indizi, illimitato. Concatena le risposte giuste per la tua serie.", "Deduza o jogador misterioso pelas dicas, ilimitado. Encadeie acertos para subir sua sequência.","Deduce el jugador misterioso a partir de sus pistas, sin límite. Encadena aciertos para subir tu racha.");
    case "guess": return tr("Pense à un footballeur. En 25 questions max, je devine de qui il s'agit. 🔮", "Think of a footballer. In 25 questions max, I'll guess who it is. 🔮", "Denk an einen Fußballer. In max. 25 Fragen errate ich, wer es ist. 🔮", "Pensa a un calciatore. In max 25 domande indovino chi è. 🔮", "Pense num jogador. Em no máximo 25 perguntas, eu adivinho quem é. 🔮","Piensa en un futbolista. En 25 preguntas como máximo, adivino quién es. 🔮");
    case "goatgrid": return tr("Neuf cases, neuf critères croisés. Trouve un joueur qui coche les deux à chaque fois.", "Nine cells, nine crossed criteria. Find a player who ticks both every time.", "Neun Felder, neun gekreuzte Kriterien. Finde jedes Mal einen Spieler, der beide erfüllt.", "Nove caselle, nove criteri incrociati. Trova ogni volta un giocatore che soddisfa entrambi.", "Nove casas, nove critérios cruzados. Ache um jogador que atenda aos dois em cada uma.","Nueve casillas, nueve criterios cruzados. Encuentra un jugador que cumpla los dos cada vez.");
    case "duel": return tr("Quatre-vingt-dix secondes, manches illimitées, 10 ou 20 points par bonne réponse. Solo, en ligne ou entre potes.", "Ninety seconds, unlimited rounds, 10 or 20 points per correct answer. Solo, online or with friends.", "Neunzig Sekunden, unbegrenzte Runden, 10 oder 20 Punkte pro richtiger Antwort. Solo, online oder mit Freunden.", "Novanta secondi, turni illimitati, 10 o 20 punti per risposta esatta. Solo, online o con gli amici.", "Noventa segundos, rodadas ilimitadas, 10 ou 20 pontos por acerto. Solo, online ou com amigos.","Noventa segundos, rondas ilimitadas, 10 o 20 puntos por acierto. Solo, en línea o con amigos.");
  }
}
// Nom affiché. Cinq des six sont des marques et ne bougent pas d'une langue à
// l'autre ; « Trouve le joueur » est une phrase française, et restait en
// français dans une interface italienne, allemande ou portugaise.
function gameName(k: GameKey): string {
  switch (k) {
    case "grid": return tr("Trouve le joueur", "Guess the player", "Errate den Spieler", "Indovina il giocatore", "Adivinhe o jogador","Adivina el jugador");
    case "mercato": return "The Mercato";
    case "plug": return "The Plug";
    case "goatgrid": return "GOAT Grid";
    case "duel": return "GOAT Duel";
    case "guess": return "GOAT Guess";
  }
}
function gameBadge(k: GameKey): string {
  switch (k) {
    case "mercato": return tr("MARATHON", "MARATHON", "MARATHON", "MARATONA", "MARATONA","MARATÓN");
    case "plug": return "SIGNATURE";
    case "grid": return tr("ILLIMITÉ", "UNLIMITED", "UNBEGRENZT", "ILLIMITATO", "ILIMITADO","SIN LÍMITE");
    case "guess": return tr("MAGIE", "MAGIC", "MAGIE", "MAGIA", "MAGIA","MAGIA");
    case "goatgrid": return tr("GRILLE", "GRID", "RASTER", "GRIGLIA", "GRADE","CUADRÍCULA");
    case "duel": return "1V1";
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
  // Devinette du jour : la barre d'accès disparaît une fois la devinette jouée
  // (rien à y faire jusqu'au lendemain). Home réémet l'event à la fermeture.
  const [riddleDone, setRiddleDone] = useState(dailyRiddleDone);
  useEffect(() => {
    const refresh = () => setRiddleDone(dailyRiddleDone());
    window.addEventListener("goatfc:devinette-closed", refresh);
    return () => window.removeEventListener("goatfc:devinette-closed", refresh);
  }, []);
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

        // Top 5 par XP cumulée — même source et même défaut que le mobile
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
        <div className="px-1 mb-2" style={{ ...posterText(1, G.projecteur, 0), fontSize:15, letterSpacing:4 }}>
          {tr("NOS JEUX", "OUR GAMES", "UNSERE SPIELE", "I NOSTRI GIOCHI", "NOSSOS JOGOS","NUESTROS JUEGOS")}
        </div>
        {GAMES.map((g) => {
          const isActive = g.key === selected;
          return (
            <button
              key={g.key}
              onClick={() => setSelected(g.key)}
              className="w-full text-left p-3 flex items-center gap-3 transition-transform"
              style={{ background:isActive ? G.projecteur : G.nuit, border:G.trait,
                borderRadius:G.rayon, boxShadow:G.ombre, cursor:"pointer",
                transform:isActive ? "translate(-1px,-1px)" : "none" }}
            >
              <div className="relative h-14 w-14 overflow-hidden flex-shrink-0"
                style={{ borderRadius:G.rayonS, border:G.traitFin, background:G.encre }}>
                <img src={g.img} alt={gameName(g.key)} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="truncate" style={{ ...posterText(1, isActive ? G.encre : G.white, 0), fontSize:22 }}>{gameName(g.key)}</div>
                <div className="text-xs truncate"
                  style={{ color:isActive ? "rgba(8,17,9,.7)" : "rgba(255,255,255,.5)" }}>{gameTagline(g.key)}</div>
              </div>
            </button>
          );
        })}

        {/* Compteur « en ligne » : pastille de pelouse cerclée d'encre, plutôt
            que le point vert LED et son halo lumineux. */}
        <div className="mt-4 p-3 flex items-center gap-2.5"
          style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}>
          <span className="goat-blink h-2.5 w-2.5"
            style={{ borderRadius:"50%", background:G.pelouse, border:"1.5px solid "+G.encre }} />
          <span className="tabular-nums" style={{ ...posterText(1, G.white, 0), fontSize:19 }}>
            {online}
          </span>
          <span className="text-xs text-white/50">{tr("en ligne", "online", "online", "online", "online","en línea")}</span>
        </div>
      </div>

      {/* CENTRE — preview du jeu sélectionné + mascotte + bouton PLAY */}
      <div className="relative">
        <div className="relative overflow-hidden min-h-[460px] lg:h-[calc(100dvh-190px)] lg:min-h-[480px] lg:max-h-[640px]"
          style={{ background:G.nuit, border:G.trait, borderRadius:G.rayonL, boxShadow:G.ombreL }}>
          {/* Bandeau d'accent du mode : un aplat franc en haut du cadre, à la
              place du halo flouté — la charte ne connaît pas le dégradé. */}
          <div className="absolute top-0 left-0 right-0" style={{ height:6, background:game.accent }} />

          {/* Visuel du mode — grande carte portrait, comme sur mobile */}
          <div className="hidden md:flex absolute inset-y-0 right-0 w-[50%] items-center justify-center p-6 lg:p-8 pointer-events-none">
            <img
              key={game.key}
              src={game.img}
              alt={gameName(game.key)}
              className="goat-float relative max-h-full max-w-full w-auto object-contain"
              style={{ borderRadius:G.rayon, border:G.trait, boxShadow:G.ombreL }}
            />
          </div>

          {/* Texte + CTA */}
          <div className="relative lg:h-full p-6 lg:p-8 flex flex-col justify-center md:max-w-[52%]">
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <span
                className="px-3 py-1 mb-2"
                style={{
                  ...posterText(1, game.accent === G.projecteur ? G.encre : G.white, 0),
                  fontSize: 13, letterSpacing: 3,
                  background: game.accent,
                  borderRadius: G.rayonS,
                  border: G.traitFin,
                  boxShadow: "2px 2px 0 " + G.encre,
                }}
              >
                {gameBadge(game.key)}
              </span>

              {/* Corps calé pour que le nom du mode le plus long tienne sur UNE
                  ligne dans la moitié gauche du cadre : deux lignes de lettrage
                  d'affiche font se cogner l'ombre dure de la première dans les
                  capitales de la seconde. */}
              <h2 className="mb-2" style={{ ...posterTitre(48, G.white), fontSize:"clamp(30px,3.4vw,48px)" }}>
                {gameName(game.key)}
              </h2>
              <p className="mb-3" style={{ ...posterText(1, game.accent, 0), fontSize:26, letterSpacing:2 }}>
                {gameTagline(game.key)}
              </p>

              {/* Card preview — seulement en dessous de md (au-dessus, la grande
                  carte du mode occupe la moitié droite du cadre) */}
              <div className="relative my-1 mb-4 md:hidden">
                <img
                  src={game.img}
                  alt={gameName(game.key)}
                  className="relative h-20 lg:h-24 w-auto"
                  style={{ borderRadius:G.rayonS, border:G.traitFin, boxShadow:G.ombre }}
                />
              </div>

              <p className="text-white/70 max-w-md mb-4 text-sm lg:text-base">{gameDescription(game.key)}</p>

              {/* Gros bouton JOUER */}
              <button
                onClick={() => onPlay(game.mode)}
                className="goat-pulse-encre inline-flex"
                style={{ ...btn(G.projecteur, G.encre, 44), display:"inline-flex", padding:"14px 48px", boxShadow:G.ombreL }}
              >
                <span style={{ fontSize:32 }}>▶</span> {tr("JOUER", "PLAY", "SPIELEN", "GIOCA", "JOGAR","JUGAR")}
              </button>

              <p className="mt-2 text-xs text-white/40">
                {tr("Gratuit · Sans inscription · 3 minutes", "Free · No sign-up · 3 minutes", "Gratis · Ohne Anmeldung · 3 Minuten", "Gratis · Senza registrazione · 3 minuti", "Grátis · Sem cadastro · 3 minutos","Gratis · Sin registro · 3 minutos")}
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
          className="relative w-full text-left p-4"
          style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre, cursor:"pointer" }}
        >
          {myUnseen > 0 && (
            <span className="goat-blink absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center px-1.5 text-xs font-black text-white"
              style={{ background:G.maillot, borderRadius:"50%", border:G.traitFin, boxShadow:"2px 2px 0 "+G.encre }}>
              {myUnseen}
            </span>
          )}
          <div className="flex items-center gap-3">
            <div style={{ ...pastilleCharte(G.projecteur, 44), fontSize:24 }}>
              ⚔️
            </div>
            <div className="min-w-0">
              <div style={{ ...posterText(1, G.projecteur, 0), fontSize:21, letterSpacing:1.5 }}>{tr("DÉFIS OUVERTS", "OPEN CHALLENGES", "OFFENE HERAUSFORDERUNGEN", "SFIDE APERTE", "DESAFIOS ABERTOS","RETOS ABIERTOS")}</div>
              <div className="text-xs text-white/60">
                {myUnseen > 0
                  ? (myUnseen > 1
                      ? tr(`🔥 ${myUnseen} joueurs ont relevé ton défi !`, `🔥 ${myUnseen} players took your challenge!`, `🔥 ${myUnseen} Spieler haben deine Herausforderung angenommen!`, `🔥 ${myUnseen} giocatori hanno accettato la tua sfida!`, `🔥 ${myUnseen} jogadores aceitaram seu desafio!`,`🔥 ¡${myUnseen} jugadores han aceptado tu reto!`)
                      : tr(`🔥 ${myUnseen} joueur a relevé ton défi !`, `🔥 ${myUnseen} player took your challenge!`, `🔥 ${myUnseen} Spieler hat deine Herausforderung angenommen!`, `🔥 ${myUnseen} giocatore ha accettato la tua sfida!`, `🔥 ${myUnseen} jogador aceitou seu desafio!`,`🔥 ¡${myUnseen} jugador ha aceptado tu reto!`))
                  : openCount > 0
                  ? (openCount > 1
                      ? tr(`${openCount} défis à relever`, `${openCount} challenges to take`, `${openCount} Herausforderungen`, `${openCount} sfide da affrontare`, `${openCount} desafios para encarar`,`${openCount} retos por aceptar`)
                      : tr(`${openCount} défi à relever`, `${openCount} challenge to take`, `${openCount} Herausforderung`, `${openCount} sfida da affrontare`, `${openCount} desafio para encarar`,`${openCount} reto por aceptar`))
                  : tr("Bats les scores des autres — ou lance le tien", "Beat others' scores — or post your own", "Schlag die Scores anderer — oder poste deinen", "Batti i punteggi altrui — o lancia il tuo", "Bata as pontuações dos outros — ou lance o seu","Supera las puntuaciones de otros — o pon la tuya")}
              </div>
            </div>
          </div>
        </button>

        {/* Mes amis — badge rouge si demande(s) reçue(s) */}
        <button
          onClick={() => onOpenFriends?.()}
          className="relative w-full text-left p-4"
          style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre, cursor:"pointer" }}
        >
          {pendingFriends > 0 && (
            <span className="goat-blink absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center px-1.5 text-xs font-black text-white"
              style={{ background:G.maillot, borderRadius:"50%", border:G.traitFin, boxShadow:"2px 2px 0 "+G.encre }}>
              {pendingFriends}
            </span>
          )}
          <div className="flex items-center gap-3">
            <div style={{ ...pastilleCharte(G.pelouse, 44), fontSize:24 }}>
              👥
            </div>
            <div className="min-w-0">
              <div style={{ ...posterText(1, G.pelouse, 0), fontSize:21, letterSpacing:1.5 }}>{tr("MES AMIS", "MY FRIENDS", "MEINE FREUNDE", "I MIEI AMICI", "MEUS AMIGOS","MIS AMIGOS")}</div>
              <div className="text-xs text-white/60">
                {pendingFriends > 0
                  ? (pendingFriends > 1
                      ? tr(`🔴 ${pendingFriends} demandes d'ami en attente !`, `🔴 ${pendingFriends} pending friend requests!`, `🔴 ${pendingFriends} offene Freundschaftsanfragen!`, `🔴 ${pendingFriends} richieste di amicizia in attesa!`, `🔴 ${pendingFriends} pedidos de amizade pendentes!`,`🔴 ¡${pendingFriends} solicitudes de amistad pendientes!`)
                      : tr(`🔴 ${pendingFriends} demande d'ami en attente !`, `🔴 ${pendingFriends} pending friend request!`, `🔴 ${pendingFriends} offene Freundschaftsanfrage!`, `🔴 ${pendingFriends} richiesta di amicizia in attesa!`, `🔴 ${pendingFriends} pedido de amizade pendente!`,`🔴 ¡${pendingFriends} solicitud de amistad pendiente!`))
                  : tr("Ajoute tes amis et défie-les", "Add your friends and challenge them", "Füge Freunde hinzu und fordere sie heraus", "Aggiungi i tuoi amici e sfidali", "Adicione seus amigos e desafie-os","Añade a tus amigos y rétalos")}
              </div>
            </div>
          </div>
        </button>

        {/* Rejoindre une partie via un code */}
        <form
          onSubmit={submitRoom}
          className="p-4"
          style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}
        >
          <div className="mb-3" style={{ ...posterText(1, G.ciel, 0), fontSize:18, letterSpacing:1 }}>
            {tr("🔑 REJOINDRE UNE PARTIE", "🔑 JOIN A GAME", "🔑 SPIEL BEITRETEN", "🔑 ENTRA IN UNA PARTITA", "🔑 ENTRAR NUMA PARTIDA","🔑 ENTRAR EN UNA PARTIDA")}
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
              className="flex-1 min-w-0 px-3 py-2.5 text-center placeholder-white/30 focus:outline-none"
              style={{ ...posterText(1, G.white, 0), fontSize:20, letterSpacing:6,
                background:"rgba(8,17,9,.55)", border:G.traitFin, borderRadius:G.rayonS }}
            />
            <button
              type="submit"
              disabled={roomCode.trim().length < 4}
              style={{ ...btn(roomCode.trim().length < 4 ? "rgba(8,17,9,.55)" : G.ciel, G.white, 18),
                padding:"10px 18px", borderRadius:G.rayonS,
                opacity:roomCode.trim().length < 4 ? .5 : 1,
                cursor:roomCode.trim().length < 4 ? "not-allowed" : "pointer" }}
            >
              GO
            </button>
          </div>
          <div className="text-xs text-white/40 mt-2">
            {tr("Tu as un code d'un ami ? Colle-le ici.", "Got a code from a friend? Paste it here.", "Hast du einen Code von einem Freund? Füg ihn hier ein.", "Hai un codice di un amico? Incollalo qui.", "Tem um código de um amigo? Cole aqui.","¿Tienes el código de un amigo? Pégalo aquí.")}
          </div>
        </form>

        {/* Devinette du jour — un joueur mystère par jour, partagé par tous.
            Elle n'était accessible que par le pop-up mobile ; ici c'est un accès
            permanent, côté desktop comme côté mobile. Masquée une fois jouée. */}
        {!riddleDone && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("goatfc:open-devinette"))}
          className="w-full flex items-center gap-3 p-4 text-left"
          style={{ background:G.projecteur, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre, cursor:"pointer" }}
        >
          <span className="text-2xl leading-none">🕵️</span>
          <span className="flex-1 min-w-0">
            <span className="block" style={{ ...posterLight(18, G.encre), letterSpacing:.5 }}>
              {tr("DEVINETTE DU JOUR", "DAILY RIDDLE", "RÄTSEL DES TAGES", "INDOVINELLO DEL GIORNO", "ADIVINHA DO DIA","ADIVINANZA DEL DÍA")}
            </span>
            <span className="block text-xs mt-0.5" style={{ color:"rgba(8,17,9,.7)" }}>
              {tr("Un joueur mystère à deviner", "A mystery player to guess", "Ein Rätselspieler zu erraten", "Un giocatore misterioso da indovinare", "Um jogador misterioso para adivinhar","Un jugador misterioso para adivinar")}
            </span>
          </span>
          <span style={{ ...posterLight(24, G.encre) }}>›</span>
        </button>
        )}

        {/* Leaderboard preview */}
        <div className="p-4"
          style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}>
          <div className="flex items-center justify-between mb-3">
            <div style={{ ...posterText(1, G.white, 0), fontSize:19, letterSpacing:2.5 }}>
              {tr("🏆 TOP JOUEURS", "🏆 TOP PLAYERS", "🏆 TOP-SPIELER", "🏆 TOP GIOCATORI", "🏆 TOP JOGADORES","🏆 MEJORES JUGADORES")}
            </div>
            {/* Aperçu = onglet "global" du mobile : XP cumulée, pas le mois. */}
            <span className="font-display text-xs tracking-widest text-white/40">{tr("XP TOTALE", "TOTAL XP", "GESAMT-XP", "XP TOTALI", "XP TOTAL","XP TOTAL")}</span>
          </div>
          <ul className="space-y-2">
            {top5.map((p) => (
              <li
                key={p.rank}
                className="flex items-center gap-2 text-sm"
              >
                {/* Le podium reprend les jetons de la charte : projecteur, puis
                    deux aplats plus sourds. L'or/argent/bronze métallique ne
                    tient pas à côté d'un aplat franc. */}
                <span
                  className="flex-shrink-0 h-6 w-6 flex items-center justify-center"
                  style={{ ...posterText(1, p.rank <= 3 ? G.encre : G.white, 0), fontSize:17,
                    borderRadius:8, border:"1.5px solid "+G.encre,
                    background: p.rank === 1 ? G.projecteur
                      : p.rank === 2 ? "#C9CBC4"
                      : p.rank === 3 ? "#C08A4A"
                      : "rgba(8,17,9,.55)" }}
                >
                  {p.rank}
                </span>
                <span className="flex-1 truncate text-white/90 font-medium">
                  {p.name}
                </span>
                <span className="tabular-nums" style={{ ...posterText(1, G.projecteur, 0), fontSize:19 }}>
                  {nombre(p.score)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
