import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { tr } from "@/lib/lang";
import { G, posterText, posterTitre, posterLight } from "@/lib/charte.jsx";

function P({ label, text }: { label: string; text: string }) {
  return (
    <p>
      <strong className="text-white">{label}</strong> {text}
    </p>
  );
}

function getTutos() {
  const principle = tr("Le principe.", "The concept.", "Das Prinzip.", "Il principio.", "O conceito.");
  const scoring = tr("Le scoring.", "Scoring.", "Die Wertung.", "Il punteggio.", "A pontuação.");
  const tip = tr("Astuce.", "Tip.", "Tipp.", "Consiglio.", "Dica.");
  const howTo = (name: string) =>
    name + tr(" — Comment jouer", " — How to play", " — So spielt man", " — Come si gioca", " — Como jogar");

  return [
    {
      id: "plug",
      title: howTo("The Plug"),
      accent: G.pelouse,
      badge: "SIGNATURE",
      content: (
        <div className="space-y-3 text-sm md:text-base leading-relaxed text-white/80">
          <P label={principle} text={tr(
            "Deux clubs s'affichent (ex. Real Madrid et AC Milan). À toi de trouver un joueur qui a porté les deux maillots dans sa carrière.",
            "Two clubs appear (e.g. Real Madrid and AC Milan). Find a player who wore both shirts in their career.",
            "Zwei Klubs erscheinen (z. B. Real Madrid und AC Mailand). Finde einen Spieler, der beide Trikots getragen hat.",
            "Appaiono due club (es. Real Madrid e Milan). Trova un giocatore che ha indossato entrambe le maglie in carriera.",
            "Dois clubes aparecem (ex. Real Madrid e Milan). Ache um jogador que vestiu as duas camisas na carreira.")} />
          <P label={scoring} text={tr(
            "Plus tu trouves vite, plus tu marques. Une réponse rare donne un bonus. Enchaîne les combos pour faire exploser ton total.",
            "The faster you answer, the more you score. A rare answer gives a bonus. Chain combos to blow up your total.",
            "Je schneller du antwortest, desto mehr Punkte. Eine seltene Antwort gibt einen Bonus. Verkette Combos, um dein Total zu sprengen.",
            "Più rispondi in fretta, più segni. Una risposta rara dà un bonus. Concatena i combo per far esplodere il totale.",
            "Quanto mais rápido você responde, mais pontua. Uma resposta rara dá bônus. Encadeie combos para estourar seu total.")} />
          <P label={tip} text={tr(
            "Pense aux joueurs qui ont fait le tour de l'Europe (Ibrahimović, Anelka, Materazzi). PSG, Real, Inter, Milan AC, gros clubs portugais → des hubs en or.",
            "Think of players who toured Europe (Ibrahimović, Anelka, Materazzi). PSG, Real, Inter, AC Milan, big Portuguese clubs → golden hubs.",
            "Denk an Spieler, die durch Europa tourten (Ibrahimović, Anelka, Materazzi). PSG, Real, Inter, AC Mailand, große portugiesische Klubs → goldene Drehkreuze.",
            "Pensa ai giocatori che hanno girato l'Europa (Ibrahimović, Anelka, Materazzi). PSG, Real, Inter, Milan, grandi club portoghesi → snodi d'oro.",
            "Pense em jogadores que rodaram a Europa (Ibrahimović, Anelka, Materazzi). PSG, Real, Inter, Milan, grandes clubes portugueses → hubs de ouro.")} />
        </div>
      ),
    },
    {
      id: "mercato",
      title: howTo("The Mercato"),
      accent: G.projecteur,
      badge: tr("MARATHON", "MARATHON", "MARATHON", "MARATONA", "MARATONA"),
      content: (
        <div className="space-y-3 text-sm md:text-base leading-relaxed text-white/80">
          <P label={principle} text={tr(
            "Tu pars d'un joueur. À chaque tour, tu nommes un autre joueur qui a partagé au moins un club avec le précédent. La chaîne se construit, transfert après transfert.",
            "You start from a player. Each turn, name another player who shared at least one club with the previous one. The chain builds, transfer after transfer.",
            "Du startest bei einem Spieler. Nenne jede Runde einen anderen Spieler, der mindestens einen Klub mit dem vorherigen teilte. Die Kette wächst, Transfer für Transfer.",
            "Parti da un giocatore. A ogni turno nomini un altro giocatore che ha condiviso almeno un club con il precedente. La catena cresce, trasferimento dopo trasferimento.",
            "Você começa por um jogador. A cada turno, diga outro jogador que dividiu ao menos um clube com o anterior. A corrente cresce, transferência após transferência.")} />
          <P label={scoring} text={tr(
            "Chaque maillon valide rapporte des points. Le jeu s'arrête à la première erreur ou au time-out.",
            "Each valid link scores points. The game ends on the first mistake or on time-out.",
            "Jedes gültige Glied bringt Punkte. Das Spiel endet beim ersten Fehler oder bei Zeitablauf.",
            "Ogni anello valido dà punti. Il gioco finisce al primo errore o allo scadere del tempo.",
            "Cada elo válido dá pontos. O jogo acaba no primeiro erro ou quando o tempo esgota.")} />
          <P label={tip} text={tr(
            "Garde en tête des joueurs hubs (Zlatan, Cantona, Drogba). Les vétérans d'Arsenal et Chelsea sont des perles pour étirer la chaîne.",
            "Keep hub players in mind (Zlatan, Cantona, Drogba). Arsenal and Chelsea veterans are gems to stretch the chain.",
            "Merke dir Drehkreuz-Spieler (Zlatan, Cantona, Drogba). Arsenal- und Chelsea-Veteranen sind Perlen, um die Kette zu verlängern.",
            "Tieni a mente i giocatori snodo (Zlatan, Cantona, Drogba). I veterani di Arsenal e Chelsea sono perle per allungare la catena.",
            "Tenha em mente jogadores-hub (Zlatan, Cantona, Drogba). Veteranos de Arsenal e Chelsea são pérolas para esticar a corrente.")} />
        </div>
      ),
    },
    {
      id: "grid",
      title: howTo(tr("Trouve le joueur", "Guess the Player", "Errate den Spieler", "Indovina il giocatore", "Adivinhe o jogador")),
      accent: G.pelouse,
      badge: tr("ILLIMITÉ", "UNLIMITED", "UNBEGRENZT", "ILLIMITATO", "ILIMITADO"),
      content: (
        <div className="space-y-3 text-sm md:text-base leading-relaxed text-white/80">
          <P label={principle} text={tr(
            "Un joueur mystère à deviner, en illimité. Son parcours reste caché : tu déduis uniquement à partir de tes propositions (révélable en indice).",
            "A mystery player to guess, unlimited. His career stays hidden: you deduce only from your guesses (revealable as a hint).",
            "Ein Mystery-Spieler zum Erraten, unbegrenzt. Seine Karriere bleibt verborgen: du schließt nur aus deinen Tipps (als Hinweis aufdeckbar).",
            "Un giocatore misterioso da indovinare, illimitato. La carriera resta nascosta: deduci solo dai tuoi tentativi (svelabile come indizio).",
            "Um jogador misterioso para adivinhar, ilimitado. A carreira fica escondida: você deduz só pelos seus palpites (revelável como dica).")} />
          <P label={scoring} text={tr(
            "Tu as 6 essais. Chaque proposition affiche des puces : nationalité, zone, poste, âge (↑↓), club et clubs en commun — ✓ vert, 🟨 proche, ✗ rouge.",
            "You get 6 tries. Each guess shows chips: nationality, zone, position, age (↑↓), club and clubs in common — ✓ green, 🟨 close, ✗ red.",
            "Du hast 6 Versuche. Jeder Tipp zeigt Chips: Nationalität, Zone, Position, Alter (↑↓), Klub und gemeinsame Klubs — ✓ grün, 🟨 nah, ✗ rot.",
            "Hai 6 tentativi. Ogni proposta mostra delle pedine: nazionalità, zona, ruolo, età (↑↓), club e club in comune — ✓ verde, 🟨 vicino, ✗ rosso.",
            "Você tem 6 tentativas. Cada palpite mostra fichas: nacionalidade, zona, posição, idade (↑↓), clube e clubes em comum — ✓ verde, 🟨 perto, ✗ vermelho.")} />
          <P label={tip} text={tr(
            "Enchaîne les bonnes réponses pour faire grimper ta SÉRIE 🔥 : le classement récompense les meilleures séries. Défie tes potes avec l'énigme partageable.",
            "Chain correct answers to build your STREAK 🔥: the leaderboard rewards the best streaks. Challenge your friends with the shareable riddle.",
            "Reihe richtige Antworten für deine SERIE 🔥 aneinander: die Rangliste belohnt die besten Serien. Fordere Freunde mit dem teilbaren Rätsel heraus.",
            "Concatena le risposte giuste per la tua SERIE 🔥: la classifica premia le migliori serie. Sfida gli amici con l'enigma condivisibile.",
            "Encadeie acertos para subir sua SÉRIE 🔥: o ranking premia as melhores sequências. Desafie seus amigos com o enigma compartilhável.")} />
        </div>
      ),
    },
  ];
}

export const TutosView = () => {
  const TUTOS = getTutos();
  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 mb-3"
          style={{ ...posterLight(15, G.encre), letterSpacing:3, background:G.projecteur,
            borderRadius:G.rayonS, border:G.traitFin, boxShadow:"2px 2px 0 "+G.encre }}>
          {tr("TUTORIELS", "TUTORIALS", "ANLEITUNGEN", "TUTORIAL", "TUTORIAIS")}
        </span>
        <h2 style={{ ...posterTitre(80, G.white), fontSize:"clamp(44px,8vw,80px)" }}>
          {tr("COMMENT JOUER", "HOW TO PLAY", "SO SPIELT MAN", "COME SI GIOCA", "COMO JOGAR")}
        </h2>
        <p className="mt-4 text-white/60">
          {tr("3 minutes pour comprendre. Une vie pour devenir bon.", "3 minutes to understand. A lifetime to master.", "3 Minuten zum Verstehen. Ein Leben, um gut zu werden.", "3 minuti per capire. Una vita per diventare bravo.", "3 minutos para entender. Uma vida para dominar.")}
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-3">
        {TUTOS.map((t) => (
          <AccordionItem
            key={t.id}
            value={t.id}
            className="px-5"
            style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}
          >
            <AccordionTrigger className="hover:no-underline py-5">
              <div className="flex items-center gap-3 text-left">
                <span
                  className="px-2 py-0.5"
                  style={{
                    ...posterText(1, t.accent === G.projecteur ? G.encre : G.white, 0),
                    fontSize: 13, letterSpacing: 3,
                    background: t.accent, borderRadius: 8,
                    border: "1.5px solid " + G.encre,
                  }}
                >
                  {t.badge}
                </span>
                <span style={{ ...posterText(1, G.white, 0), fontSize:26 }}>{t.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>{t.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
