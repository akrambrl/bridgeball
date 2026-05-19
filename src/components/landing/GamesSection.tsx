import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = { onPlay: () => void };

const GAMES = [
  {
    id: "plug",
    name: "The Plug",
    tagline: "Le pont entre deux clubs",
    description:
      "On te donne deux clubs, à toi de trouver le joueur qui a porté les deux maillots. De Cristiano Ronaldo à des transferts plus obscurs : à quel point connais-tu vraiment ton foot ?",
    img: "/plug-card.png",
    accent: "from-emerald-500/20 to-green-700/20",
    badge: "Le jeu signature",
  },
  {
    id: "mercato",
    name: "The Mercato",
    tagline: "La chaîne de transferts",
    description:
      "Pars d'un joueur, enchaîne les transferts en passant par ses anciens clubs. Plus la chaîne est longue, plus tu marques. Combien de noms peux-tu lier sans erreur ?",
    img: "/mercato-card.png",
    accent: "from-amber-500/20 to-orange-600/20",
    badge: "Marathon",
  },
  {
    id: "grid",
    name: "GOAT Grid",
    tagline: "Complète la grille",
    description:
      "Une grille 3x3 de clubs en lignes et colonnes. Place un joueur dans chaque case qui correspond au croisement. Stratégie, mémoire et culture foot.",
    img: "/grid-card.png",
    accent: "from-indigo-500/20 to-blue-700/20",
    badge: "Stratégique",
  },
];

export const GamesSection = ({ onPlay }: Props) => {
  return (
    <section id="jeux" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-[#1E5C2A]/10 text-[#1E5C2A] text-xs font-bold uppercase tracking-wider mb-3">
            Les jeux
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Trois jeux. Une seule mission : prouver que t'es un vrai.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Que tu sois fan de transferts WTF, marathonien du mercato ou
            stratège de la grille, il y a forcément un mode qui te ressemble.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES.map((g) => (
            <Card
              key={g.id}
              className="group overflow-hidden border-2 hover:border-[#1E5C2A] transition-all hover:shadow-xl hover:-translate-y-1 duration-200"
            >
              <div className={`relative aspect-[4/3] bg-gradient-to-br ${g.accent} overflow-hidden`}>
                <img
                  src={g.img}
                  alt={g.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#0F2E18] text-white text-xs font-semibold">
                  {g.badge}
                </span>
              </div>
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold mb-1">{g.name}</h3>
                <p className="text-sm font-medium text-[#1E5C2A] mb-3">
                  {g.tagline}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5 min-h-[5rem]">
                  {g.description}
                </p>
                <Button
                  onClick={onPlay}
                  className="w-full bg-[#1E5C2A] hover:bg-[#276B34] text-white font-semibold"
                >
                  Lancer {g.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
