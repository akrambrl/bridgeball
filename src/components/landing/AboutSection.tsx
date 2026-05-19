export const AboutSection = () => {
  return (
    <section
      id="about"
      className="py-20 md:py-28 bg-gradient-to-br from-[#F7FAF8] to-[#E8F0EA]"
    >
      <div className="container max-w-4xl">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-[#1E5C2A]/10 text-[#1E5C2A] text-xs font-bold uppercase tracking-wider mb-3">
            À propos
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            L'histoire derrière GOAT FC
          </h2>
        </div>

        <div className="prose prose-lg max-w-none text-foreground/80 space-y-5 leading-relaxed">
          <p>
            <em>[À compléter par toi]</em> — c'est ici que tu racontes le
            projet : pourquoi tu l'as lancé, comment l'idée est venue, ce qui
            te rend différent des autres quiz foot. Garde un ton perso, c'est
            la section où les fans se connectent vraiment au projet.
          </p>
          <p>
            Quelques pistes : ta passion foot, le moment où l'idée a germé
            (un match, un transfert improbable, un débat entre potes), ta vision
            pour la suite, et pourquoi tu crois que GOAT FC peut devenir
            <em> le</em> repère des fans qui veulent jouer plus malin.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border-2">
            <div className="text-4xl font-extrabold text-[#1E5C2A]">4 100+</div>
            <div className="text-sm text-muted-foreground mt-1">
              joueurs dans la base
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border-2">
            <div className="text-4xl font-extrabold text-[#1E5C2A]">3</div>
            <div className="text-sm text-muted-foreground mt-1">
              jeux différents
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border-2">
            <div className="text-4xl font-extrabold text-[#1E5C2A]">∞</div>
            <div className="text-sm text-muted-foreground mt-1">
              combinaisons possibles
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
