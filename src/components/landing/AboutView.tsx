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

      <div className="space-y-4 text-white/80 leading-relaxed text-lg">
        <p>
          <em className="text-white/50">
            [Section à remplir par toi — donne-moi 5-10 lignes sur le projet]
          </em>
        </p>
        <p>
          Quelques pistes : ta passion foot, le moment où l'idée a germé, ce
          qui rend GOAT FC différent des autres quiz, ta vision pour la suite.
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
