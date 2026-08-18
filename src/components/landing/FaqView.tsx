import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { tr } from "@/lib/lang";
import { G, posterText, posterTitre, posterLight } from "@/lib/charte.jsx";

function getFaq(): { q: string; a: string }[] {
  return [
    {
      q: tr("GOAT FC, c'est gratuit ?", "Is GOAT FC free?", "Ist GOAT FC kostenlos?", "GOAT FC è gratis?", "O GOAT FC é grátis?","¿GOAT FC es gratis?"),
      a: tr("Oui, 100% gratuit. Pas de paywall, pas de pub intrusive.", "Yes, 100% free. No paywall, no intrusive ads.", "Ja, 100% kostenlos. Keine Paywall, keine störende Werbung.", "Sì, 100% gratis. Niente paywall, niente pubblicità invadente.", "Sim, 100% grátis. Sem paywall, sem anúncios invasivos.","Sí, 100% gratis. Sin muro de pago, sin anuncios intrusivos."),
    },
    {
      q: tr("Il faut s'inscrire / créer un compte ?", "Do I need to sign up / create an account?", "Muss ich mich registrieren / ein Konto erstellen?", "Devo registrarmi / creare un account?", "Preciso me cadastrar / criar uma conta?","¿Hay que registrarse / crear una cuenta?"),
      a: tr("Non. Tu choisis un pseudo au premier lancement et tu joues direct. Ton historique est sauvegardé localement.", "No. You pick a nickname on first launch and play right away. Your history is saved locally.", "Nein. Du wählst beim ersten Start einen Namen und spielst sofort. Dein Verlauf wird lokal gespeichert.", "No. Scegli un nome al primo avvio e giochi subito. La tua cronologia è salvata localmente.", "Não. Você escolhe um apelido no primeiro acesso e já joga. Seu histórico é salvo localmente.","No. Eliges un nombre la primera vez que abres el juego y juegas directamente. Tu historial se guarda en el dispositivo."),
    },
    {
      q: tr("Je peux installer GOAT FC comme une app ?", "Can I install GOAT FC like an app?", "Kann ich GOAT FC wie eine App installieren?", "Posso installare GOAT FC come un'app?", "Posso instalar o GOAT FC como um app?","¿Puedo instalar GOAT FC como una app?"),
      a: tr("Oui. C'est une PWA : sur ton téléphone, ouvre le site et « Ajouter à l'écran d'accueil ». Tu auras une vraie icône d'app sans passer par les stores.", "Yes. It's a PWA: on your phone, open the site and \"Add to Home Screen\". You'll get a real app icon without any store.", "Ja. Es ist eine PWA: Öffne die Seite auf dem Handy und „Zum Startbildschirm hinzufügen\". Du bekommst ein echtes App-Icon ohne Store.", "Sì. È una PWA: sul telefono apri il sito e «Aggiungi a schermata Home». Avrai una vera icona app senza passare dagli store.", "Sim. É um PWA: no celular, abra o site e \"Adicionar à tela inicial\". Você terá um ícone de app de verdade, sem lojas.","Sí. Es una PWA: en el móvil, abre la web y pulsa «Añadir a la pantalla de inicio». Tendrás un icono de app de verdad sin pasar por ninguna tienda."),
    },
    {
      q: tr("Comment fonctionne le multijoueur ?", "How does multiplayer work?", "Wie funktioniert der Mehrspieler-Modus?", "Come funziona il multigiocatore?", "Como funciona o multijogador?","¿Cómo funciona el multijugador?"),
      a: tr("Tu crées un salon, tu partages le code, tes amis rejoignent et vous jouez en même temps sur les mêmes manches.", "You create a room, share the code, your friends join and you all play the same rounds at once.", "Du erstellst einen Raum, teilst den Code, deine Freunde treten bei und ihr spielt gleichzeitig dieselben Runden.", "Crei una stanza, condividi il codice, i tuoi amici entrano e giocate insieme le stesse manche.", "Você cria uma sala, compartilha o código, seus amigos entram e todos jogam as mesmas rodadas ao mesmo tempo.","Creas una sala, compartes el código, tus amigos entran y jugáis las mismas rondas a la vez."),
    },
    {
      q: tr("Pourquoi mon joueur préféré n'est pas reconnu ?", "Why isn't my favorite player recognized?", "Warum wird mein Lieblingsspieler nicht erkannt?", "Perché il mio giocatore preferito non è riconosciuto?", "Por que meu jogador favorito não é reconhecido?","¿Por qué no reconoce a mi jugador favorito?"),
      a: tr("La base contient plus de 4000 joueurs mais reste perfectible. Si un nom est refusé, vérifie l'orthographe — la base s'enrichit régulièrement.", "The database has over 4000 players but isn't perfect. If a name is rejected, check the spelling — the database is updated regularly.", "Die Datenbank enthält über 4000 Spieler, ist aber nicht perfekt. Wird ein Name abgelehnt, prüfe die Schreibweise — sie wird regelmäßig erweitert.", "Il database ha oltre 4000 giocatori ma è perfettibile. Se un nome viene rifiutato, controlla l'ortografia — il database si aggiorna spesso.", "A base tem mais de 4000 jogadores, mas ainda é perfectível. Se um nome for recusado, verifique a grafia — a base é atualizada com frequência.","La base tiene más de 4000 jugadores pero es mejorable. Si un nombre no se acepta, revisa la ortografía — la base se amplía con regularidad."),
    },
    {
      q: tr("C'est quoi le système de saisons ?", "What's the seasons system?", "Was ist das Saison-System?", "Cos'è il sistema delle stagioni?", "O que é o sistema de temporadas?","¿Qué es el sistema de temporadas?"),
      a: tr("Une saison dure un mois. À la fin, les meilleurs scores sont figés dans le Hall of Fame et le classement repart de zéro.", "A season lasts one month. At the end, the best scores are frozen into the Hall of Fame and the leaderboard resets.", "Eine Saison dauert einen Monat. Am Ende werden die besten Scores in der Hall of Fame festgehalten und die Rangliste startet neu.", "Una stagione dura un mese. Alla fine i migliori punteggi entrano nella Hall of Fame e la classifica riparte da zero.", "Uma temporada dura um mês. No fim, as melhores pontuações são fixadas no Hall of Fame e o ranking recomeça do zero.","Una temporada dura un mes. Al final, las mejores puntuaciones quedan grabadas en el Hall of Fame y la clasificación vuelve a cero."),
    },
    {
      q: tr("Comment marche la collection de cartes ?", "How does the card collection work?", "Wie funktioniert die Kartensammlung?", "Come funziona la collezione di carte?", "Como funciona a coleção de cartas?","¿Cómo funciona la colección de cartas?"),
      a: tr("Chaque partie rapporte des points. Vingt-neuf cartes se débloquent au fil de ton total, de La Recrue au GOAT — et la dernière obtenue devient ta photo de profil.", "Every game earns points. Twenty-nine cards unlock as your total grows, from The Rookie to the GOAT — and the latest one becomes your profile picture.", "Jede Partie bringt Punkte. Neunundzwanzig Karten werden mit deinem Gesamtstand freigeschaltet, vom Talent bis zum GOAT — die letzte wird dein Profilbild.", "Ogni partita fa punti. Ventinove carte si sbloccano man mano che sale il totale, da La Recluta al GOAT — e l'ultima ottenuta diventa la tua foto profilo.", "Cada partida rende pontos. Vinte e nove cartas são desbloqueadas conforme seu total sobe, do Novato ao GOAT — e a última obtida vira sua foto de perfil.","Cada partida da puntos. Veintinueve cartas se desbloquean según tu total, desde El Novato hasta el GOAT — y la última obtenida pasa a ser tu foto de perfil."),
    },
    {
      q: tr("Vous récupérez mes données perso ?", "Do you collect my personal data?", "Sammelt ihr meine persönlichen Daten?", "Raccogliete i miei dati personali?", "Vocês coletam meus dados pessoais?","¿Recopiláis mis datos personales?"),
      a: tr("Le strict minimum : pseudo et scores. Pas d'email, pas de mot de passe. Les publicités sont facultatives — tu les lances toi-même — et un identifiant publicitaire n'est utilisé que si tu l'acceptes.", "The bare minimum: nickname and scores. No email, no password. Ads are optional — you start them yourself — and an advertising identifier is only used if you agree to it.", "Das absolute Minimum: Name und Scores. Keine E-Mail, kein Passwort. Werbung ist freiwillig — du startest sie selbst — und eine Werbe-ID wird nur mit deiner Zustimmung genutzt.", "Il minimo indispensabile: nome e punteggi. Nessuna email, nessuna password. Gli annunci sono facoltativi — li avvii tu — e un identificativo pubblicitario è usato solo se lo accetti.", "O mínimo: apelido e pontuações. Sem email, sem senha. Os anúncios são opcionais — você os inicia — e um identificador de publicidade só é usado se você aceitar.","Lo mínimo: nombre y puntuaciones. Sin email, sin contraseña. Los anuncios son opcionales — los lanzas tú — y un identificador publicitario solo se usa si lo aceptas."),
    },
  ];
}

export const FaqView = () => {
  const FAQ = getFaq();
  return (
    <div className="container max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 mb-3"
          style={{ ...posterLight(15, G.encre), letterSpacing:3, background:G.projecteur,
            borderRadius:G.rayonS, border:G.traitFin, boxShadow:"2px 2px 0 "+G.encre }}>
          FAQ
        </span>
        <h2 style={{ ...posterTitre(80, G.white), fontSize:"clamp(44px,8vw,80px)" }}>
          {tr("QUESTIONS FRÉQUENTES", "FREQUENTLY ASKED QUESTIONS", "HÄUFIGE FRAGEN", "DOMANDE FREQUENTI", "PERGUNTAS FREQUENTES","PREGUNTAS FRECUENTES")}
        </h2>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {FAQ.map((it, i) => (
          <AccordionItem
            key={i}
            value={`q${i}`}
            className="mb-3 px-5"
            style={{ background:G.nuit, border:G.trait, borderRadius:G.rayon, boxShadow:G.ombre }}
          >
            <AccordionTrigger className="text-left hover:no-underline py-4"
              style={{ ...posterText(1, G.white, 0), fontSize:24 }}>
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
