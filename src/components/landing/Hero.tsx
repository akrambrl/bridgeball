import { Button } from "@/components/ui/button";

type Props = { onPlay: () => void };

export const Hero = ({ onPlay }: Props) => {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-br from-[#0F2E18] via-[#1E5C2A] to-[#276B34] text-white"
    >
      {/* Décor : lignes verticales façon terrain */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #ffffff 0 1px, transparent 1px 80px)",
        }}
        aria-hidden
      />

      <div className="container relative py-20 md:py-28 lg:py-36">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-white/90 mb-6">
              <span className="h-2 w-2 rounded-full bg-[#00E676] animate-pulse" />
              Le quiz football n°1 en France
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
              GOAT FC
            </h1>
            <p className="mt-4 text-2xl md:text-3xl font-bold text-[#00E676]">
              Le quiz qui sépare les fans des GOAT
            </p>
            <p className="mt-6 text-lg text-white/80 max-w-xl leading-relaxed">
              Trouve le joueur qui fait le pont entre deux clubs, construis la
              plus longue chaîne de transferts, ou complète la grille des
              légendes. Trois jeux, un seul objectif : devenir le GOAT du
              mercato.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                onClick={onPlay}
                size="lg"
                className="bg-[#00E676] hover:bg-[#00C966] text-[#0F2E18] font-bold text-base h-12 px-8"
              >
                Jouer gratuitement
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-8 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#jeux">Découvrir les jeux</a>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/70">
              <span>⚡ 100% gratuit</span>
              <span>📱 Sans téléchargement</span>
              <span>🏆 Classements mondiaux</span>
              <span>👥 Multijoueur</span>
            </div>
          </div>

          {/* Illustration / logo géant */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-[#00E676]/20 blur-3xl rounded-full" />
              <img
                src="/bridgeball-logo.svg"
                alt=""
                className="relative h-80 w-80 rounded-3xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
