export const AboutView = () => {
  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/10 text-[#FFC93C] font-display text-xs tracking-[0.3em] mb-3">
          À PROPOS
        </span>
        <h2 className="font-display text-6xl md:text-7xl tracking-wide leading-none">
          L'HISTOIRE DERRIÈRE GOAT FC
        </h2>
      </div>

      <div className="space-y-5 text-white/80 leading-relaxed text-lg">
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
          Trois jeux ont émergé : <span className="text-[#00E676] font-semibold">The Plug</span> pour
          trouver le maillon entre deux clubs,{" "}
          <span className="text-[#FF8A2A] font-semibold">The Mercato</span> pour enchaîner
          les transferts à l'infini, et{" "}
          <span className="text-[#3DA5FF] font-semibold">GOAT Grid</span> pour la grille
          du jour stratégique.
        </p>
        <p>
          GOAT FC, c'est un projet entre amis, fait avec le cœur. Pas de pub, pas de
          paywall, pas de gimmicks. Juste un jeu de foot fait par et pour des fans de
          foot. Bienvenue dans le club. 🐐
        </p>
      </div>

      <div className="mt-10 grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="font-display text-5xl text-[#FFC93C] tracking-wider">4 100+</div>
          <div className="text-sm text-white/60 mt-1">joueurs dans la base</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="font-display text-5xl text-[#FFC93C] tracking-wider">3</div>
          <div className="text-sm text-white/60 mt-1">jeux différents</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="font-display text-5xl text-[#FFC93C] tracking-wider">∞</div>
          <div className="text-sm text-white/60 mt-1">combinaisons possibles</div>
        </div>
      </div>

      {/* ====== POURQUOI NOUS SOUTENIR ====== */}
      <div className="mt-16 rounded-3xl border-2 border-[#FF5E5B]/30 bg-gradient-to-br from-[#FF5E5B]/10 via-[#FF8A2A]/5 to-transparent p-6 md:p-10">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 rounded-full bg-[#FF5E5B]/15 text-[#FF5E5B] font-display text-xs tracking-[0.3em] mb-3">
            ☕ KO-FI
          </span>
          <h3 className="font-display text-4xl md:text-5xl tracking-wide leading-none text-white">
            POURQUOI NOUS SOUTENIR ?
          </h3>
          <p className="mt-4 text-white/70 max-w-xl mx-auto">
            GOAT FC est <span className="text-white font-semibold">gratuit</span>,
            sans pub et sans paywall. Mais derrière, il y a une vraie équipe qui
            bosse sur son temps libre — et des coûts bien réels.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl bg-black/30 border border-white/10 p-5">
            <div className="text-3xl mb-2">🖥️</div>
            <div className="font-display text-xl tracking-wider text-white mb-1">
              SERVEURS & HÉBERGEMENT
            </div>
            <div className="text-sm text-white/60">
              Base de données, matchmaking, classements en temps réel — tout
              ça tourne 24/7 et ça a un coût.
            </div>
          </div>
          <div className="rounded-2xl bg-black/30 border border-white/10 p-5">
            <div className="text-3xl mb-2">⚽</div>
            <div className="font-display text-xl tracking-wider text-white mb-1">
              NOUVEAUX JOUEURS, NOUVEAUX MODES
            </div>
            <div className="text-sm text-white/60">
              Plus on a de soutien, plus on agrandit la base et plus vite on
              sort de nouveaux jeux (battle royale, défis chronos, ligues
              privées…).
            </div>
          </div>
          <div className="rounded-2xl bg-black/30 border border-white/10 p-5">
            <div className="text-3xl mb-2">🚫</div>
            <div className="font-display text-xl tracking-wider text-white mb-1">
              ZÉRO PUB, POUR TOUJOURS
            </div>
            <div className="text-sm text-white/60">
              Ton soutien nous permet de tenir notre promesse : aucune
              publicité ne viendra jamais polluer ton jeu.
            </div>
          </div>
          <div className="rounded-2xl bg-black/30 border border-white/10 p-5">
            <div className="text-3xl mb-2">❤️</div>
            <div className="font-display text-xl tracking-wider text-white mb-1">
              MOTIVATION D'UNE ÉQUIPE
            </div>
            <div className="text-sm text-white/60">
              Chaque don, même symbolique, c'est un message qui nous dit
              « continuez ». Et ça, ça vaut tout l'or du monde.
            </div>
          </div>
        </div>

        <div className="text-center">
          <a
            href="https://ko-fi.com/goatfc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FF5E5B] to-[#FF8A2A] hover:from-[#FF7270] hover:to-[#FF9F4D] font-display text-xl md:text-2xl tracking-widest text-white shadow-[0_10px_30px_-5px_rgba(255,94,91,0.55)] hover:scale-[1.03] transition-all"
          >
            <span className="text-2xl">☕</span> OFFRIR UN CAFÉ
          </a>
          <div className="text-xs text-white/40 mt-3 tracking-widest">
            À PARTIR DE 3 € · PAIEMENT 100 % SÉCURISÉ VIA KO-FI
          </div>
        </div>
      </div>
    </div>
  );
};
