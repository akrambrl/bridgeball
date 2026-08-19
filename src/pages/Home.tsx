import { useEffect, useState } from "react";
import LePont from "@/components/LePont.jsx";
import { LobbyHeader, type TabKey } from "@/components/landing/LobbyHeader";
import { LobbyView } from "@/components/landing/LobbyView";
import { TutosView } from "@/components/landing/TutosView";
import { LeaderboardView } from "@/components/landing/LeaderboardView";
import { FaqView } from "@/components/landing/FaqView";
import { AboutView } from "@/components/landing/AboutView";
import { DifficultyModal, type Difficulty } from "@/components/landing/DifficultyModal";
import { ModeChoiceModal, type PlayMode } from "@/components/landing/ModeChoiceModal";
import { MatchmakingOverlay } from "@/components/landing/MatchmakingOverlay";
import { CountdownOverlay } from "@/components/landing/CountdownOverlay";
import { GoatGuess } from "@/components/landing/GoatGuess";
import { FindPlayer } from "@/components/landing/FindPlayer";
import { nombre, tr } from "@/lib/lang";
import { trackTime } from "@/lib/track";
import { G, posterText, btn, fondCharte, areneCharte } from "@/lib/charte.jsx";

// "grid" = « Trouve le joueur » (overlay FindPlayer), "goatgrid" = la
// grille 3×3 jouée dans LePont. Deux jeux distincts, malgré les noms proches.
export type GameMode = "pont" | "chaine" | "grid" | "guess" | "goatgrid" | "duel";

const Home = () => {
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<TabKey>("play");
  // 1) Choix Solo/Multi (pont/chaine seulement)
  const [pendingMode, setPendingMode] = useState<"pont" | "chaine" | null>(null);
  // 2) Choix difficulté — on conserve le mode déjà choisi
  const [pendingDiff, setPendingDiff] = useState<
    { game: "pont" | "chaine"; mode: PlayMode } | null
  >(null);
  // 3a) Matchmaking en ligne (recherche d'un faux adversaire)
  const [matchmaking, setMatchmaking] = useState<
    { game: "pont" | "chaine"; diff: Difficulty } | null
  >(null);
  // 3b) Countdown 3..0 avant lancement effectif (solo / après matchmaking)
  const [countdown, setCountdown] = useState<
    {
      game: Extract<GameMode, "pont" | "chaine">;
      diff?: Difficulty;
      bot?: { pseudo: string; country: string; avatar?: string };
    } | null
  >(null);
  // Pop-up de confirmation avant de quitter une partie
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  // Adversaire actif si on est en mode EN LIGNE (sert pour quit = forfait)
  const [onlineOpponent, setOnlineOpponent] = useState<
    { pseudo: string; country: string; avatar?: string } | null
  >(null);
  // Overlay "DÉFAITE PAR ABANDON" affiché après un quit en mode online
  const [forfeitNotice, setForfeitNotice] = useState<
    { pseudo: string; country: string; avatar?: string } | null
  >(null);
  // Overlay GOAT Guess (Akinator foot)
  const [goatGuessOpen, setGoatGuessOpen] = useState(false);
  const [findPlayerOpen, setFindPlayerOpen] = useState(false);
  // Mesure du temps passé sur l'app côté desktop. LePont fait de même côté
  // mobile ; trackTime est idempotent, les deux appels ne se marchent pas dessus.
  useEffect(() => { trackTime(); }, []);
  // Devinette du jour : elle n'existait que sur mobile (pop-up dans Index.tsx),
  // le desktop n'y avait aucun accès. Ouverte depuis le lobby.
  // Lu à l'INITIALISATION et non dans un effet, et mémorisé en sessionStorage.
  // C'est la règle que le commentaire de Index.tsx énonce déjà : l'effet qui lit
  // `?play=` EFFACE l'URL juste après, donc tout remontage du composant perd le
  // lien. Et Home se remonte — mesuré : la devinette s'ouvrait bien, puis
  // disparaissait au remontage suivant, l'URL étant déjà nettoyée. La
  // notification quotidienne déposait donc sur l'accueil, sur ordinateur.
  const [devinetteOpen, setDevinetteOpen] = useState(() => {
    try { if (new URLSearchParams(window.location.search).get("play") === "devinette") return true; } catch { /* noop */ }
    try { return sessionStorage.getItem("bb_active_overlay") === "devinette"; } catch { return false; }
  });
  useEffect(() => {
    try {
      if (devinetteOpen) sessionStorage.setItem("bb_active_overlay", "devinette");
      else if (sessionStorage.getItem("bb_active_overlay") === "devinette") sessionStorage.removeItem("bb_active_overlay");
    } catch { /* noop */ }
  }, [devinetteOpen]);
  useEffect(() => {
    const onDevinette = () => setDevinetteOpen(true);
    window.addEventListener("goatfc:open-devinette", onDevinette);
    return () => window.removeEventListener("goatfc:open-devinette", onDevinette);
  }, []);

  // LePont émet cet event quand l'utilisateur quitte la partie autolaunchée
  // (← interne, fin de partie). On ferme l'overlay pour revenir à la landing.
  useEffect(() => {
    const onBack = () => {
      setPlaying(false);
      setOnlineOpponent(null);
    };
    window.addEventListener("goatfc:back-to-landing", onBack);
    return () => window.removeEventListener("goatfc:back-to-landing", onBack);
  }, []);

  // Arrivée depuis une page SEO (/the-plug/, /the-mercato/, …) : le CTA pointe
  // sur /?play=<mode>, on ouvre directement le bon jeu. Sur mobile c'est LePont
  // qui lit déjà ce paramètre ; ici on gère le cas desktop.
  useEffect(() => {
    let mode: string | null = null;
    try {
      mode = new URLSearchParams(window.location.search).get("play");
    } catch { /* noop */ }
    if (!mode) {
      // `?friends=1`, `?duels=1` et `?room=CODE` sont lus par LePont, pas ici :
      // il suffit de le monter. C'est exactement ce que font les boutons « Mes
      // amis » et « Défis » du lobby. Sans cette branche, la notification de
      // demande d'ami déposait sur le lobby sur ordinateur, alors que le
      // paramètre était là.
      //
      // `room` manquait à cette liste, et c'est le lien d'invitation lui-même :
      // le bouton « Inviter des joueurs » de la salle partage
      // `https://www.goatfc.fr/?room=CODE`. Ouvert sur un ordinateur ou un iPad,
      // Index rendait <Home /> — LePont n'était jamais monté, donc PERSONNE ne
      // lisait le paramètre, et le destinataire atterrissait sur l'accueil sans
      // un mot. Un lien de défi qui ne mène pas au défi.
      try {
        const p = new URLSearchParams(window.location.search);
        if (p.get("friends") === "1" || p.get("duels") === "1" || p.get("room")) setPlaying(true);
      } catch { /* noop */ }
      return;
    }
    if (mode === "goatgrid" || mode === "duel") {
      // LePont lit ?play=<mode> puis nettoie l'URL lui-même : surtout ne pas
      // l'effacer ici, il ne verrait plus rien au montage.
      setPlaying(true);
      return;
    }
    if (mode === "guess") setGoatGuessOpen(true);
    else if (mode === "grid") setFindPlayerOpen(true);
    // `devinette` est déjà ouverte par l'initialisation de l'état ci-dessus. On
    // garde la branche pour tomber sur le nettoyage d'URL commun, sinon le
    // paramètre resterait et rouvrirait la devinette à chaque rechargement.
    else if (mode === "devinette") { /* rien à faire, déjà ouvert */ }
    else if (mode === "pont" || mode === "chaine") setPendingMode(mode);
    else return;
    // On nettoie l'URL pour ne pas relancer le jeu à chaque retour à l'accueil
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch { /* noop */ }
  }, []);

  if (playing) {
    // Le jeu tient dans une colonne, mais elle était posée sur `bg-background` —
    // un jeton CLAIR, donc deux marges blanches de part et d'autre d'une app
    // entièrement sombre. On pose le fond de nuit de la charte : la colonne se
    // détache dessus grâce à son ombre portée, au lieu de flotter sur du papier.
    return (
      <div className="fixed inset-0 z-50 overflow-auto" style={{ background:G.nuit }}>
        <button
          onClick={() => setShowQuitConfirm(true)}
          className="fixed top-3 right-3 z-[60]"
          style={{ ...btn(G.projecteur, G.encre, 18), fontFamily:G.font, fontWeight:800, letterSpacing:1.5, transform:"none" }}
          aria-label={tr("Quitter et revenir à la landing GOAT FC", "Quit and return to the GOAT FC landing", "Beenden und zur GOAT-FC-Startseite zurück", "Esci e torna alla landing GOAT FC", "Sair e voltar à landing do GOAT FC","Salir y volver a la portada de GOAT FC")}
          title={tr("Quitter et revenir à la landing", "Quit and return to landing", "Beenden und zur Startseite", "Esci e torna alla landing", "Sair e voltar à landing","Salir y volver a la portada")}
        >
          ← {tr("QUITTER", "QUIT", "BEENDEN", "ESCI", "SAIR","SALIR")}
        </button>
        <LePont />

        {showQuitConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background:"rgba(8,17,9,.88)" }}
            onClick={() => setShowQuitConfirm(false)}
          >
            <div
              className="w-full max-w-sm p-6 lg:p-8 text-center"
              style={{ background:G.nuit, border:G.trait, borderRadius:G.rayonL, boxShadow:G.ombreL }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl mb-3">{onlineOpponent ? "🏳️" : "⚠️"}</div>
              <h3 className="mb-2" style={posterText(34, G.white)}>
                {onlineOpponent ? tr("ABANDONNER LE DUEL ?", "FORFEIT THE DUEL?", "DUELL AUFGEBEN?", "ABBANDONARE IL DUELLO?", "DESISTIR DO DUELO?","¿ABANDONAR EL DUELO?") : tr("QUITTER LA PARTIE ?", "QUIT THE GAME?", "SPIEL BEENDEN?", "USCIRE DALLA PARTITA?", "SAIR DO JOGO?","¿SALIR DE LA PARTIDA?")}
              </h3>
              <p className="text-sm text-white/60 mb-7">
                {onlineOpponent ? (
                  <>
                    {tr("Tu perds automatiquement contre", "You automatically lose against", "Du verlierst automatisch gegen", "Perdi automaticamente contro", "Você perde automaticamente contra","Pierdes automáticamente contra")}{" "}
                    <span className="text-white font-bold">
                      {onlineOpponent.pseudo} {onlineOpponent.country}
                    </span>
                  </>
                ) : (
                  tr("Ta progression en cours sera perdue.", "Your current progress will be lost.", "Dein aktueller Fortschritt geht verloren.", "I tuoi progressi attuali andranno persi.", "Seu progresso atual será perdido.","Perderás el progreso actual.")
                )}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowQuitConfirm(false)}
                  style={{ ...btn(G.projecteur, G.encre, 22), width:"100%", padding:"12px 16px" }}
                >
                  ▶ {tr("CONTINUER", "CONTINUE", "WEITER", "CONTINUA", "CONTINUAR","CONTINUAR")}
                </button>
                <button
                  onClick={() => {
                    setShowQuitConfirm(false);
                    if (onlineOpponent) {
                      setForfeitNotice(onlineOpponent);
                      setOnlineOpponent(null);
                    }
                    setPlaying(false);
                  }}
                  style={{ ...btn(G.maillot, G.white, 18), width:"100%", padding:"12px 16px" }}
                >
                  {onlineOpponent ? tr("Concéder le duel", "Concede the duel", "Duell aufgeben", "Cedi il duello", "Ceder o duelo","Conceder el duelo") : tr("Quitter quand même", "Quit anyway", "Trotzdem beenden", "Esci comunque", "Sair mesmo assim","Salir igualmente")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Clic JOUER sur une card : grid = direct ; pont/chaine = choix solo/multi ;
  // guess = ouvre l'overlay Akinator dédié.
  const onPlay = (game?: GameMode) => {
    if (game === "guess") {
      setGoatGuessOpen(true);
      return;
    }
    if (game === "grid") {
      // « Trouve le joueur » : overlay autonome, ne passe pas par LePont.
      setFindPlayerOpen(true);
      return;
    }
    if (game === "goatgrid" || game === "duel") {
      // Ces deux-là vivent dans LePont, qui les démarre sur ?play=<mode>.
      launchGame(game);
      return;
    }
    if (game === "pont" || game === "chaine") {
      setPendingMode(game);
      return;
    }
    setPlaying(true);
  };

  // Après le choix Solo/Online/Multi :
  // - online : matchmaking visuel (adversaire random, diff random)
  // - solo/multi : on passe au choix de difficulté
  const onModePicked = (mode: PlayMode) => {
    if (!pendingMode) return;
    const game = pendingMode;
    setPendingMode(null);
    if (mode === "online") {
      const diffs: Difficulty[] = ["facile", "moyen", "expert"];
      const randomDiff = diffs[Math.floor(Math.random() * diffs.length)];
      setMatchmaking({ game, diff: randomDiff });
      return;
    }
    setPendingDiff({ game, mode });
  };

  // Après le choix de difficulté :
  // - multi  → ouvre direct la création de salon LePont
  // - online → matchmaking (faux adversaire) puis countdown
  // - solo   → countdown direct
  const onDiffPicked = (diff: Difficulty) => {
    if (!pendingDiff) return;
    const { game, mode } = pendingDiff;
    setPendingDiff(null);
    if (mode === "multi") {
      launchGame(game, diff, "create");
      return;
    }
    if (mode === "online") {
      setMatchmaking({ game, diff });
      return;
    }
    setCountdown({ game, diff });
  };

  // Fin du countdown OU clic multi : ouvre LePont avec les bons params URL
  const launchGame = (
    game: GameMode,
    diff?: Difficulty,
    multi?: "create",
    bot?: { pseudo: string; country: string; avatar?: string }
  ) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("play", game);
      if (diff) url.searchParams.set("diff", diff);
      if (multi) url.searchParams.set("multi", multi);
      if (bot) {
        url.searchParams.set("bot", bot.pseudo);
        url.searchParams.set("flag", bot.country);
        if (bot.avatar) url.searchParams.set("avatar", bot.avatar);
      }
      window.history.replaceState({}, "", url.toString());
    } catch {}
    setCountdown(null);
    setPlaying(true);
  };

  // Rejoindre une room avec un code : on injecte ?room=CODE et LePont
  // lit le code dans son propre useEffect pour appeler joinRoom().
  const onJoinRoom = (code: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("room", code);
      window.history.replaceState({}, "", url.toString());
    } catch {}
    setPlaying(true);
  };

  // Ouvre le salon de défis ouverts (LePont lit ?duels=1 et affiche directement le salon)
  // tab="mine" -> ouvre directement sur "Mes défis" (détail des tentatives reçues)
  const onOpenDuels = (tab?: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("duels", "1");
      if (tab) url.searchParams.set("duelstab", tab);
      window.history.replaceState({}, "", url.toString());
    } catch {}
    setPlaying(true);
  };

  // Ouvre le panneau "Mes amis" (LePont lit ?friends=1 et affiche directement le panneau)
  const onOpenFriends = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("friends", "1");
      window.history.replaceState({}, "", url.toString());
    } catch {}
    setPlaying(true);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white flex flex-col"
      style={{ background: fondCharte, backgroundAttachment:"fixed",
        // Contexte d'empilement pour le terrain (calque à zIndex -1).
        isolation:"isolate" }}>
      {/* Le terrain de la charte : bandes de tonte, tracés d'encre et grain
          sérigraphié, dessinés PAR-DESSUS la pelouse éclairée. Les anciens
          voiles blancs translucides (filigrane, grille, halo vert) ne tenaient
          pas la charte : le trait d'encre des panneaux disparaissait dessus. */}
      {areneCharte}
      {/* Filigrane GOAT FC : conservé, mais à l'encre plutôt qu'en blanc. */}
      <div
        className="pointer-events-none absolute inset-0 select-none flex items-center justify-center"
        style={{ opacity:.07, zIndex:0 }}
        aria-hidden
      >
        <span className="leading-none" style={{ ...posterText(1, G.encre, 0), fontSize:"28vw" }}>
          GOAT FC
        </span>
      </div>

      <LobbyHeader active={tab} onChange={setTab} />

      <main className="relative flex-1 z-10">
        {tab === "play" && <LobbyView onPlay={onPlay} onJoinRoom={onJoinRoom} onOpenDuels={onOpenDuels} onOpenFriends={onOpenFriends} />}
        {tab === "tutos" && <TutosView />}
        {tab === "leaderboard" && <LeaderboardView />}
        {tab === "faq" && <FaqView />}
        {tab === "about" && <AboutView />}
      </main>

      {/* Ticker scrolling — actions récentes (mock) */}
      <ScoreTicker />

      {/* 1) Choix Solo / Multi */}
      {pendingMode && (
        <ModeChoiceModal
          game={pendingMode}
          onPick={onModePicked}
          onClose={() => setPendingMode(null)}
        />
      )}

      {/* 2) Choix de difficulté */}
      {pendingDiff && (
        <DifficultyModal
          game={pendingDiff.game}
          onPick={onDiffPicked}
          onClose={() => setPendingDiff(null)}
        />
      )}

      {/* 3a) Matchmaking (mode EN LIGNE — faux adversaire) */}
      {matchmaking && (
        <MatchmakingOverlay
          game={matchmaking.game}
          onFound={(opponent) => {
            const { game, diff } = matchmaking;
            setMatchmaking(null);
            setOnlineOpponent(opponent);
            setCountdown({ game, diff, bot: opponent });
          }}
          onCancel={() => setMatchmaking(null)}
        />
      )}

      {/* Overlay défaite par abandon (quit en mode EN LIGNE) */}
      {forfeitNotice && (
        <ForfeitOverlay
          opponent={forfeitNotice}
          onDone={() => setForfeitNotice(null)}
        />
      )}

      {/* Countdown 5..0 avant d'ouvrir LePont */}
      {countdown && (
        <CountdownOverlay
          game={countdown.game}
          onDone={() => launchGame(countdown.game, countdown.diff, undefined, countdown.bot)}
          onCancel={() => setCountdown(null)}
        />
      )}

      {/* GOAT Guess — Akinator foot (overlay plein écran, indépendant de LePont) */}
      {goatGuessOpen && <GoatGuess onClose={() => setGoatGuessOpen(false)} />}
      {findPlayerOpen && <FindPlayer onClose={() => setFindPlayerOpen(false)} />}
      {devinetteOpen && (
        <FindPlayer
          daily
          onClose={() => {
            setDevinetteOpen(false);
            // Le lobby affiche la barre « Devinette du jour » tant qu'elle n'a
            // pas été jouée : il doit relire l'état à la fermeture pour la faire
            // disparaître immédiatement.
            window.dispatchEvent(new CustomEvent("goatfc:devinette-closed"));
          }}
        />
      )}
    </div>
  );
};

const SB_URL_TICKER = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY_TICKER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

const MODE_LABEL: Record<string, string> = {
  pont: "The Plug",
  chaine: "The Mercato",
  grid: "GOAT Grid",
};

function useTickerItems() {
  const [items, setItems] = useState<{ who: string; what: string }[]>([]);
  useEffect(() => {
    const h = { apikey: SB_KEY_TICKER, Authorization: "Bearer " + SB_KEY_TICKER };
    fetch(SB_URL_TICKER + "/rest/v1/bb_scores?order=created_at.desc&limit=20&select=player_name,score,mode", { headers: h })
      .then(r => r.ok ? r.json() : [])
      .then((rows: { player_name: string; score: number; mode: string }[]) => {
        if (!Array.isArray(rows)) return;
        const seen = new Set<string>();
        const built: { who: string; what: string }[] = [];
        for (const r of rows) {
          if (!r.player_name || seen.has(r.player_name)) continue;
          seen.add(r.player_name);
          const game = MODE_LABEL[r.mode] || r.mode;
          // Le score formaté UNE fois, et non six. `tr()` évalue ses six
          // arguments avant d'en choisir un, donc les six appels à
          // toLocaleString tournaient à chaque ligne du bandeau pour n'en garder
          // qu'un. Et l'un d'eux était faux : le portugais passait par `pt-BR`,
          // qui groupe avec un POINT, alors que le drapeau du sélecteur est 🇵🇹
          // et que le reste de l'app suit pt-PT, qui groupe avec une espace.
          const pts = nombre(r.score);
          built.push({ who: r.player_name, what: tr(`vient de scorer ${pts} pts sur ${game} 🔥`, `just scored ${pts} pts on ${game} 🔥`, `hat gerade ${pts} Pkt bei ${game} erzielt 🔥`, `ha appena segnato ${pts} pt su ${game} 🔥`, `acabou de marcar ${pts} pts no ${game} 🔥`,`acaba de marcar ${pts} pts en ${game} 🔥`) });
          if (built.length >= 8) break;
        }
        if (built.length > 0) setItems(built);
      })
      .catch(() => {});
  }, []);
  return items;
}

const ForfeitOverlay = ({
  opponent,
  onDone,
}: {
  opponent: { pseudo: string; country: string; avatar?: string };
  onDone: () => void;
}) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center"
      style={{ background:"rgba(8,17,9,.95)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, rgba(217,58,43,.30) 0%, transparent 55%)",
        }}
        aria-hidden
      />
      <div className="relative text-center">
        <div className="text-7xl mb-4 animate-in zoom-in duration-300">🏳️</div>
        <div className="mb-3" style={{ ...posterText(1, G.maillot, 0), fontSize:15, letterSpacing:6 }}>
          {tr("ABANDON", "FORFEIT", "AUFGABE", "RESA", "DESISTÊNCIA","ABANDONO")}
        </div>
        <div className="mb-5" style={posterText(84, G.maillot)}>
          {tr("DÉFAITE", "DEFEAT", "NIEDERLAGE", "SCONFITTA", "DERROTA","DERROTA")}
        </div>
        <div className="text-white/80 text-lg">
          {tr("Tu as concédé le duel contre", "You conceded the duel against", "Du hast das Duell aufgegeben gegen", "Hai ceduto il duello contro", "Você cedeu o duelo contra","Has concedido el duelo contra")}
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          {opponent.avatar && (
            <div
              className="h-20 w-20 overflow-hidden"
              style={{
                borderRadius: G.rayonS, border: G.trait, boxShadow: G.ombre,
              }}
            >
              <img
                src={opponent.avatar}
                alt=""
                className="w-full h-full object-cover object-top"
              />
            </div>
          )}
          <div style={posterText(34, G.white)}>
            {opponent.pseudo}{" "}
            <span className="text-2xl">{opponent.country}</span>
          </div>
        </div>
        <div className="text-xs text-white/40 mt-6 tracking-widest font-display">
          {tr("RETOUR AU LOBBY...", "BACK TO LOBBY...", "ZURÜCK ZUR LOBBY...", "RITORNO ALLA LOBBY...", "VOLTANDO AO LOBBY...","VOLVIENDO AL VESTÍBULO...")}
        </div>
      </div>
    </div>
  );
};

const ScoreTicker = () => {
  const items = useTickerItems();
  if (items.length === 0) return null;
  return (
  <div className="relative z-10 overflow-hidden"
    style={{ borderTop:G.trait, background:G.nuit }}>
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="goat-blink shrink-0 px-2 py-0.5"
        style={{ ...posterText(1, G.encre, 0), fontSize:13, letterSpacing:1.5,
          background:G.maillot, color:G.white, borderRadius:8, border:G.traitFin,
          boxShadow:"2px 2px 0 "+G.encre }}>
        {tr("EN DIRECT", "LIVE", "LIVE", "IN DIRETTA", "AO VIVO","EN DIRECTO")}
      </span>
      {/* Numéro de build, à droite du bandeau et hors du défilement. Il sert à
          répondre en deux secondes à « est-ce que j'ai bien la dernière version ? » :
          plusieurs écrans corrigés et déployés ont été signalés comme « encore à
          l'ancien style » alors que la prod était à jour, et il n'existait aucun
          moyen de le vérifier depuis l'app. */}
      <div className="flex-1 overflow-hidden">
        <div className="goat-marquee flex gap-12 whitespace-nowrap">
          {[...items, ...items].map((it, i) => (
            <span key={i} className="text-sm text-white/70 flex items-center gap-2">
              <span style={{ ...posterText(1, G.projecteur, 0), fontSize:17 }}>
                {it.who}
              </span>
              <span>{it.what}</span>
              <span className="text-white/20 ml-8">•</span>
            </span>
          ))}
        </div>
      </div>
      <span className="text-xs text-white/35 flex-shrink-0 ml-4 tabular-nums">{__BUILD__}</span>
    </div>
  </div>
  );
};

export default Home;
