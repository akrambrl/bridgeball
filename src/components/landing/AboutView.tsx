import { getLang, tr } from "@/lib/lang";
import { G, posterText, posterTitre, posterLight } from "@/lib/charte.jsx";

export const AboutView = () => {
  const l = getLang();
  const Plug = <span className="font-semibold" style={{ color: G.pelouse }}>The Plug</span>;
  const Mercato = <span className="font-semibold" style={{ color: G.projecteur }}>The Mercato</span>;
  const Grid = <span className="font-semibold" style={{ color: G.pelouse }}>{tr("Trouve le joueur", "Guess the player", "Errate den Spieler", "Indovina il giocatore", "Adivinhe o jogador")}</span>;

  const prose =
    l === "en" ? (
      <>
        <p>
          GOAT FC was born from a{" "}
          <span className="text-white font-semibold">bunch of friends who love football and quizzes</span>.
          After endless debates at the bar — "where did he play again?", "no look, these two clubs
          share a player, can you find who?" — we figured a game truly built for that was missing.
        </p>
        <p>
          So we launched it <span className="text-white font-semibold">together</span>. Each with our
          own obsessions: 2000s Ligue 1, forgotten Premier League transfers, the trickiest transfer
          chains, South American legends who moved to Europe… We put it all in the same database.
        </p>
        <p>
          Three games emerged: {Plug} to find the link between two clubs, {Mercato} to chain transfers
          endlessly, and {Grid}, unlimited mystery-player deduction.
        </p>
        <p>
          GOAT FC is a project between friends, made with heart. No ads, no paywall, no gimmicks. Just
          a football game made by and for football fans. Welcome to the club. 🐐
        </p>
      </>
    ) : l === "de" ? (
      <>
        <p>
          GOAT FC entstand aus einer{" "}
          <span className="text-white font-semibold">Gruppe von Freunden, die Fußball und Quiz lieben</span>.
          Nach endlosen Diskussionen an der Theke — „wo hat der nochmal gespielt?", „schau mal, diese
          zwei Klubs haben einen gemeinsamen Spieler, findest du ihn?" — war klar, dass ein Spiel dafür fehlte.
        </p>
        <p>
          Also haben wir es <span className="text-white font-semibold">gemeinsam</span> gestartet. Jeder
          mit seinen Vorlieben: die Ligue 1 der 2000er, vergessene Premier-League-Transfers, die
          verrücktesten Transferketten, südamerikanische Legenden in Europa… Alles in eine Datenbank gepackt.
        </p>
        <p>
          Drei Spiele entstanden: {Plug} um das Bindeglied zwischen zwei Klubs zu finden, {Mercato} um
          endlos Transfers aneinanderzureihen, und {Grid}, die unbegrenzte Mystery-Spieler-Deduktion.
        </p>
        <p>
          GOAT FC ist ein Projekt unter Freunden, mit Herzblut gemacht. Keine Werbung, keine Paywall,
          keine Spielereien. Nur ein Fußballspiel von und für Fußballfans. Willkommen im Klub. 🐐
        </p>
      </>
    ) : l === "it" ? (
      <>
        <p>
          GOAT FC è nato da un{" "}
          <span className="text-white font-semibold">gruppo di amici appassionati di calcio e quiz</span>.
          A furia di discutere al bar — «dove ha giocato lui?», «guarda, questi due club hanno un
          giocatore in comune, riesci a trovarlo?» — abbiamo capito che mancava un gioco fatto apposta.
        </p>
        <p>
          Così ci siamo lanciati <span className="text-white font-semibold">insieme</span>. Ognuno con le
          sue fissazioni: la Ligue 1 degli anni 2000, i trasferimenti dimenticati della Premier, le catene
          di mercato più assurde, le leggende sudamericane passate in Europa… Tutto nello stesso database.
        </p>
        <p>
          Sono nati tre giochi: {Plug} per trovare l'anello tra due club, {Mercato} per concatenare i
          trasferimenti all'infinito, e {Grid}, la deduzione del giocatore misterioso illimitata.
        </p>
        <p>
          GOAT FC è un progetto tra amici, fatto col cuore. Niente pubblicità, niente paywall, niente
          trucchi. Solo un gioco di calcio fatto da e per i tifosi. Benvenuto nel club. 🐐
        </p>
      </>
    ) : l === "pt" ? (
      <>
        <p>
          O GOAT FC nasceu de uma{" "}
          <span className="text-white font-semibold">turma de amigos apaixonados por futebol e quiz</span>.
          De tanto debater no bar — "onde ele jogou mesmo?", "olha, esses dois clubes têm um jogador em
          comum, consegue achar quem?" — percebemos que faltava um jogo feito pra isso.
        </p>
        <p>
          Então nos lançamos <span className="text-white font-semibold">juntos</span>. Cada um com suas
          obsessões: a Ligue 1 dos anos 2000, transferências esquecidas da Premier League, as correntes de
          mercado mais malucas, lendas sul-americanas que passaram pela Europa… Colocamos tudo na mesma base.
        </p>
        <p>
          Surgiram três jogos: {Plug} para achar o elo entre dois clubes, {Mercato} para encadear
          transferências sem fim, e {Grid}, a dedução do jogador misterioso ilimitada.
        </p>
        <p>
          O GOAT FC é um projeto entre amigos, feito com o coração. Sem anúncios, sem paywall, sem truques.
          Só um jogo de futebol feito por e para fãs de futebol. Bem-vindo ao clube. 🐐
        </p>
      </>
    ) : (
      <>
        <p>
          GOAT FC est né d'une <span className="text-white font-semibold">bande de potes
          passionnés de foot et de quizz</span>. À force d'enchaîner les débats au
          comptoir — « lui il a joué où déjà ? », « non mais regarde, ces deux clubs
          ont un joueur en commun, t'arrives à trouver lequel ? » — on a fini par se
          dire qu'il manquait un jeu vraiment fait pour ça.
        </p>
        <p>
          Alors on s'est lancés <span className="text-white font-semibold">ensemble</span>.
          Chacun avec ses obsessions : la Ligue 1 des années 2000, les transferts oubliés
          de Premier League, les chaînes de mercato les plus tordues, les légendes
          sud-américaines passées en Europe… On a tout mis dans la même base.
        </p>
        <p>
          Trois jeux ont émergé : {Plug} pour trouver le maillon entre deux clubs,{" "}
          {Mercato} pour enchaîner les transferts à l'infini, et {Grid}, la
          déduction du joueur mystère en illimité.
        </p>
        <p>
          GOAT FC, c'est un projet entre amis, fait avec le cœur. Pas de pub, pas de
          paywall, pas de gimmicks. Juste un jeu de foot fait par et pour des fans de
          foot. Bienvenue dans le club. 🐐
        </p>
      </>
    );

  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 mb-3"
          style={{ ...posterLight(15, G.encre), letterSpacing:3, background:G.projecteur,
            borderRadius:G.rayonS, border:G.traitFin, boxShadow:"2px 2px 0 "+G.encre }}>
          {tr("À PROPOS", "ABOUT", "ÜBER UNS", "CHI SIAMO", "SOBRE")}
        </span>
        <h2 style={{ ...posterTitre(80, G.white), fontSize:"clamp(38px,7vw,80px)" }}>
          {tr("L'HISTOIRE DERRIÈRE GOAT FC", "THE STORY BEHIND GOAT FC", "DIE GESCHICHTE HINTER GOAT FC", "LA STORIA DIETRO GOAT FC", "A HISTÓRIA POR TRÁS DO GOAT FC")}
        </h2>
      </div>

      <div className="space-y-5 text-white/80 leading-relaxed text-lg">
        {prose}
      </div>

      <div className="mt-10 grid md:grid-cols-3 gap-4">
        <div className="p-5" style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}>
          <div style={posterText(56, G.projecteur)}>4 100+</div>
          <div className="text-sm text-white/60 mt-1">{tr("joueurs dans la base", "players in the database", "Spieler in der Datenbank", "giocatori nel database", "jogadores na base")}</div>
        </div>
        <div className="p-5" style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}>
          <div style={posterText(56, G.projecteur)}>3</div>
          <div className="text-sm text-white/60 mt-1">{tr("jeux différents", "different games", "verschiedene Spiele", "giochi diversi", "jogos diferentes")}</div>
        </div>
        <div className="p-5" style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}>
          <div style={posterText(56, G.projecteur)}>∞</div>
          <div className="text-sm text-white/60 mt-1">{tr("combinaisons possibles", "possible combinations", "mögliche Kombinationen", "combinazioni possibili", "combinações possíveis")}</div>
        </div>
      </div>

    </div>
  );
};
