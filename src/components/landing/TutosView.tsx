import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TUTOS = [
  {
    id: "plug",
    title: "The Plug — Comment jouer",
    accent: "#00E676",
    badge: "SIGNATURE",
    content: (
      <div className="space-y-3 text-sm md:text-base leading-relaxed text-white/80">
        <p>
          <strong className="text-white">Le principe.</strong> Deux clubs
          s'affichent (ex. Real Madrid et AC Milan). À toi de trouver un joueur
          qui a porté les deux maillots dans sa carrière.
        </p>
        <p>
          <strong className="text-white">Le scoring.</strong> Plus tu trouves
          vite, plus tu marques. Une réponse rare donne un bonus. Enchaîne les
          combos pour faire exploser ton total.
        </p>
        <p>
          <strong className="text-white">Astuce.</strong> Pense aux joueurs qui
          ont fait le tour de l'Europe (Ibrahimović, Anelka, Materazzi). PSG,
          Real, Inter, Milan AC, gros clubs portugais → des hubs en or.
        </p>
      </div>
    ),
  },
  {
    id: "mercato",
    title: "The Mercato — Comment jouer",
    accent: "#FF8A2A",
    badge: "MARATHON",
    content: (
      <div className="space-y-3 text-sm md:text-base leading-relaxed text-white/80">
        <p>
          <strong className="text-white">Le principe.</strong> Tu pars d'un
          joueur. À chaque tour, tu nommes un autre joueur qui a partagé au
          moins un club avec le précédent. La chaîne se construit, transfert
          après transfert.
        </p>
        <p>
          <strong className="text-white">Le scoring.</strong> Chaque maillon
          valide rapporte des points. Le jeu s'arrête à la première erreur ou
          au time-out.
        </p>
        <p>
          <strong className="text-white">Astuce.</strong> Garde en tête des
          joueurs hubs (Zlatan, Cantona, Drogba). Les vétérans d'Arsenal et
          Chelsea sont des perles pour étirer la chaîne.
        </p>
      </div>
    ),
  },
  {
    id: "grid",
    title: "GOAT Grid — Comment jouer",
    accent: "#3DA5FF",
    badge: "STRATÉGIE",
    content: (
      <div className="space-y-3 text-sm md:text-base leading-relaxed text-white/80">
        <p>
          <strong className="text-white">Le principe.</strong> Une grille 3×3.
          3 clubs en lignes, 3 clubs en colonnes. Chaque case veut un joueur
          qui a évolué dans les deux clubs croisés.
        </p>
        <p>
          <strong className="text-white">Le scoring.</strong> Nombre limité
          d'essais. Trouver un joueur rare rapporte plus qu'une superstar
          évidente.
        </p>
        <p>
          <strong className="text-white">Astuce.</strong> Commence par les
          croisements les plus durs. Garde tes superstars pour les cases pièges.
        </p>
      </div>
    ),
  },
];

export const TutosView = () => {
  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/10 text-[#FFC93C] text-[10px] font-black tracking-widest mb-3">
          TUTORIELS
        </span>
        <h2 className="text-4xl md:text-5xl font-black tracking-tight">
          Comment jouer
        </h2>
        <p className="mt-3 text-white/60">
          3 minutes pour comprendre. Une vie pour devenir bon.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-3">
        {TUTOS.map((t) => (
          <AccordionItem
            key={t.id}
            value={t.id}
            className="border-2 border-white/10 rounded-2xl bg-white/[0.02] px-5 data-[state=open]:border-white/30"
          >
            <AccordionTrigger className="hover:no-underline py-5">
              <div className="flex items-center gap-3 text-left">
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest"
                  style={{
                    backgroundColor: `${t.accent}25`,
                    color: t.accent,
                  }}
                >
                  {t.badge}
                </span>
                <span className="text-lg font-bold text-white">{t.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>{t.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
