import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = [
  {
    q: "GOAT FC, c'est gratuit ?",
    a: "Oui, 100% gratuit. Pas de paywall, pas de pub intrusive. Tu peux jouer autant que tu veux, créer ton pseudo et grimper le classement sans rien sortir.",
  },
  {
    q: "Il faut s'inscrire / créer un compte ?",
    a: "Non. Tu choisis un pseudo au premier lancement et tu joues direct. Ton historique est sauvegardé localement sur ton appareil.",
  },
  {
    q: "Je peux installer GOAT FC comme une app ?",
    a: "Oui. C'est une PWA (Progressive Web App) : sur ton téléphone, ouvre le site dans Safari ou Chrome puis « Ajouter à l'écran d'accueil ». Tu auras une vraie icône d'app, sans passer par les stores.",
  },
  {
    q: "Comment fonctionne le multijoueur ?",
    a: "Tu crées un salon, tu partages le code à tes amis, ils rejoignent et vous jouez en même temps sur les mêmes manches. Le score final départage tout le monde en direct.",
  },
  {
    q: "Pourquoi mon joueur préféré n'est pas reconnu ?",
    a: "La base contient plus de 4000 joueurs mais reste perfectible. Si un nom est refusé, vérifie l'orthographe (sans accents si besoin) ou signale-le — la base s'enrichit régulièrement.",
  },
  {
    q: "C'est quoi le système de saisons ?",
    a: "Une saison dure un mois. À la fin, les meilleurs scores sont figés dans le Hall of Fame et le classement repart de zéro le mois suivant. Tout le monde a sa chance de finir GOAT.",
  },
  {
    q: "Quelle différence entre amateur, pro, légende, GOAT ?",
    a: "Ce sont les paliers de progression basés sur ton score. Plus tu joues bien, plus tu montes — du rang amateur jusqu'au statut suprême de GOAT.",
  },
  {
    q: "Vous récupérez mes données perso ?",
    a: "Le strict minimum : ton pseudo et tes scores pour le classement. Pas d'email demandé, pas de tracking publicitaire. Les détails sont dans les mentions.",
  },
];

export const FaqSection = () => {
  return (
    <section id="faq" className="py-20 md:py-28 bg-background">
      <div className="container max-w-3xl">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-[#1E5C2A]/10 text-[#1E5C2A] text-xs font-bold uppercase tracking-wider mb-3">
            FAQ
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Questions fréquentes
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((it, i) => (
            <AccordionItem key={i} value={`q${i}`} className="border-b">
              <AccordionTrigger className="text-left text-base md:text-lg font-semibold hover:no-underline">
                {it.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {it.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
