import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { tr } from "@/lib/lang";

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
      accent: "#00E676",
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
      accent: "#FF8A2A",
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
      accent: "#00E676",
      badge: tr("DÉFI DU JOUR", "DAILY CHALLENGE", "TAGES-CHALLENGE", "SFIDA DEL GIORNO", "DESAFIO DO DIA"),
      content: (
        <div className="space-y-3 text-sm md:text-base leading-relaxed text-white/80">
          <P label={principle} text={tr(
            "Chaque jour, un joueur mystère (le même pour tous). On te montre son parcours de clubs dans l'ordre, plus un indice (nationalité, poste, décennie).",
            "Every day, one mystery player (the same for everyone). We show his club career in order, plus a hint (nationality, position, decade).",
            "Jeden Tag ein Mystery-Spieler (für alle gleich). Wir zeigen seine Klub-Karriere der Reihe nach, plus einen Hinweis (Nationalität, Position, Jahrzehnt).",
            "Ogni giorno un giocatore misterioso (uguale per tutti). Ti mostriamo la sua carriera nei club in ordine, più un indizio (nazionalità, ruolo, decennio).",
            "Todo dia, um jogador misterioso (o mesmo para todos). Mostramos a carreira dele nos clubes em ordem, mais uma dica (nacionalidade, posição, década).")} />
          <P label={scoring} text={tr(
            "Tu as 6 essais. À chaque proposition, un feedback façon Wordle : 🟩 bon, 🟨 proche, ⬛ non — sur la nationalité, le poste, l'âge et les clubs en commun.",
            "You get 6 tries. Each guess gives Wordle-style feedback: 🟩 right, 🟨 close, ⬛ no — on nationality, position, age and clubs in common.",
            "Du hast 6 Versuche. Jeder Tipp gibt Wordle-Feedback: 🟩 richtig, 🟨 nah, ⬛ nein — zu Nationalität, Position, Alter und gemeinsamen Klubs.",
            "Hai 6 tentativi. Ogni proposta dà un feedback stile Wordle: 🟩 giusto, 🟨 vicino, ⬛ no — su nazionalità, ruolo, età e club in comune.",
            "Você tem 6 tentativas. Cada palpite dá feedback estilo Wordle: 🟩 certo, 🟨 perto, ⬛ não — sobre nacionalidade, posição, idade e clubes em comum.")} />
          <P label={tip} text={tr(
            "Moins tu utilises d'essais, plus tu marques. Un classement quotidien départage tout le monde — et tu peux partager ta grille.",
            "The fewer tries you use, the more you score. A daily leaderboard ranks everyone — and you can share your grid.",
            "Je weniger Versuche, desto mehr Punkte. Eine Tages-Rangliste vergleicht alle — und du kannst dein Raster teilen.",
            "Meno tentativi usi, più punti fai. Una classifica giornaliera confronta tutti — e puoi condividere la tua griglia.",
            "Quanto menos tentativas, mais pontos. Um ranking diário compara todos — e você pode compartilhar sua grade.")} />
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
        <span className="inline-block px-3 py-1 rounded-full bg-[#FFC93C]/10 text-[#FFC93C] font-display text-xs tracking-[0.3em] mb-3">
          {tr("TUTORIELS", "TUTORIALS", "ANLEITUNGEN", "TUTORIAL", "TUTORIAIS")}
        </span>
        <h2 className="font-display text-6xl md:text-7xl tracking-wide leading-none">
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
            className="border-2 border-white/10 rounded-2xl bg-white/[0.02] px-5 data-[state=open]:border-white/30"
          >
            <AccordionTrigger className="hover:no-underline py-5">
              <div className="flex items-center gap-3 text-left">
                <span
                  className="px-2 py-0.5 rounded-md font-display text-xs tracking-[0.25em]"
                  style={{
                    backgroundColor: `${t.accent}25`,
                    color: t.accent,
                  }}
                >
                  {t.badge}
                </span>
                <span className="font-display text-2xl tracking-wider text-white">{t.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>{t.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
