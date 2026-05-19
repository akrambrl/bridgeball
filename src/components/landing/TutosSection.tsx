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
    content: (
      <div className="space-y-4 text-sm md:text-base leading-relaxed">
        <p>
          <strong>Le principe.</strong> Le jeu affiche deux clubs (ex.
          <em> Real Madrid</em> et <em>AC Milan</em>). À toi de trouver un
          joueur qui a porté les deux maillots au cours de sa carrière.
        </p>
        <p>
          <strong>Le scoring.</strong> Plus tu trouves vite, plus tu marques.
          Une réponse rare (un joueur peu évident) rapporte un bonus. Tu peux
          enchaîner les combos pour faire exploser ton total.
        </p>
        <p>
          <strong>Astuces.</strong> Pense aux joueurs qui ont fait du
          « tour » (Ibrahimović, Anelka, Materazzi…). Beaucoup de ponts
          passent par PSG, le Real, le Milan AC, l'Inter, ou les grands clubs
          portugais.
        </p>
      </div>
    ),
  },
  {
    id: "mercato",
    title: "The Mercato — Comment jouer",
    content: (
      <div className="space-y-4 text-sm md:text-base leading-relaxed">
        <p>
          <strong>Le principe.</strong> Tu pars d'un joueur. À chaque tour, tu
          nommes un autre joueur qui a partagé au moins un club avec le
          précédent. La chaîne se construit, transfert après transfert.
        </p>
        <p>
          <strong>Le scoring.</strong> Chaque maillon valide ajoute des
          points. La chaîne s'arrête à la première erreur ou au time-out.
          Bats ton record et grimpe le classement.
        </p>
        <p>
          <strong>Astuces.</strong> Garde en tête des joueurs « hubs » qui
          relient plein de clubs (Zlatan, Cantona, Drogba…). Les vétérans
          d'Arsenal et Chelsea sont des perles pour étirer la chaîne.
        </p>
      </div>
    ),
  },
  {
    id: "grid",
    title: "GOAT Grid — Comment jouer",
    content: (
      <div className="space-y-4 text-sm md:text-base leading-relaxed">
        <p>
          <strong>Le principe.</strong> Une grille 3×3 avec 3 clubs en lignes
          et 3 clubs en colonnes. Chaque case attend un joueur qui a évolué
          dans <em>les deux</em> clubs croisés (ligne + colonne).
        </p>
        <p>
          <strong>Le scoring.</strong> Tu as un nombre limité d'essais.
          Trouver des joueurs très rares te rapporte plus de points qu'une
          réponse évidente. L'objectif : remplir toute la grille avec le
          meilleur score possible.
        </p>
        <p>
          <strong>Astuces.</strong> Commence par les croisements les plus
          difficiles. Évite d'utiliser une superstar sur une case « facile »
          si tu peux le sortir sur une case piège.
        </p>
      </div>
    ),
  },
];

export const TutosSection = () => {
  return (
    <section id="tutos" className="py-20 md:py-28 bg-[#F7FAF8]">
      <div className="container max-w-4xl">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-[#1E5C2A]/10 text-[#1E5C2A] text-xs font-bold uppercase tracking-wider mb-3">
            Tutoriels
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Comment jouer
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Trois minutes pour comprendre. Une vie pour devenir bon.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-3">
          {TUTOS.map((t) => (
            <AccordionItem
              key={t.id}
              value={t.id}
              className="border-2 rounded-xl bg-white px-5 data-[state=open]:border-[#1E5C2A]"
            >
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                {t.title}
              </AccordionTrigger>
              <AccordionContent>{t.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
