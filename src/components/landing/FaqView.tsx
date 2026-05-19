import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = [
  {
    q: "GOAT FC, c'est gratuit ?",
    a: "Oui, 100% gratuit. Pas de paywall, pas de pub intrusive.",
  },
  {
    q: "Il faut s'inscrire / créer un compte ?",
    a: "Non. Tu choisis un pseudo au premier lancement et tu joues direct. Ton historique est sauvegardé localement.",
  },
  {
    q: "Je peux installer GOAT FC comme une app ?",
    a: "Oui. C'est une PWA : sur ton téléphone, ouvre le site et « Ajouter à l'écran d'accueil ». Tu auras une vraie icône d'app sans passer par les stores.",
  },
  {
    q: "Comment fonctionne le multijoueur ?",
    a: "Tu crées un salon, tu partages le code, tes amis rejoignent et vous jouez en même temps sur les mêmes manches.",
  },
  {
    q: "Pourquoi mon joueur préféré n'est pas reconnu ?",
    a: "La base contient plus de 4000 joueurs mais reste perfectible. Si un nom est refusé, vérifie l'orthographe — la base s'enrichit régulièrement.",
  },
  {
    q: "C'est quoi le système de saisons ?",
    a: "Une saison dure un mois. À la fin, les meilleurs scores sont figés dans le Hall of Fame et le classement repart de zéro.",
  },
  {
    q: "Quelle différence entre amateur, pro, légende, GOAT ?",
    a: "Ce sont les paliers de progression basés sur ton score. Plus tu joues bien, plus tu montes — jusqu'au statut suprême de GOAT.",
  },
  {
    q: "Vous récupérez mes données perso ?",
    a: "Le strict minimum : pseudo et scores. Pas d'email, pas de tracking pub.",
  },
];

export const FaqView = () => {
  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/10 text-[#FFC93C] font-display text-xs tracking-[0.3em] mb-3">
          FAQ
        </span>
        <h2 className="font-display text-6xl md:text-7xl tracking-wide leading-none">
          QUESTIONS FRÉQUENTES
        </h2>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {FAQ.map((it, i) => (
          <AccordionItem
            key={i}
            value={`q${i}`}
            className="border-b border-white/10"
          >
            <AccordionTrigger className="text-left font-display text-xl md:text-2xl tracking-wide hover:no-underline text-white">
              {it.q}
            </AccordionTrigger>
            <AccordionContent className="text-white/70 leading-relaxed">
              {it.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
