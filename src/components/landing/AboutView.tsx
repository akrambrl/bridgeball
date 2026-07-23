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

    </div>
  );
};
