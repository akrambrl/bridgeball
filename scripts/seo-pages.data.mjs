// Contenu éditorial des pages SEO statiques (une par mode de jeu).
// Ces pages sont de vraies pages HTML indexables : Google n'a pas besoin
// d'exécuter React pour lire leur contenu, contrairement à l'app elle-même.
// Chaque page doit avoir un titre, une description et un contenu UNIQUES —
// dupliquer le texte d'une page à l'autre les fait se cannibaliser.

export const SITE = "https://goatfc.fr";

export const PAGES = [
  {
    slug: "the-plug",
    play: "pont",
    accent: "#00E676",
    img: "/plug-card.webp",
    name: "The Plug",
    tagline: "Le pont entre deux clubs",
    title: "The Plug — Trouve le joueur qui a joué dans ces deux clubs | GOAT FC",
    description:
      "Deux clubs, un seul joueur à trouver : celui qui a porté les deux maillots. Règles, niveaux de difficulté et astuces du mode The Plug. Gratuit, sans inscription.",
    h1: "The Plug — trouve le joueur qui relie deux clubs",
    intro:
      "The Plug est le mode signature de GOAT FC. On t'affiche deux clubs, et tu dois nommer un joueur qui a évolué dans les deux. Ça paraît simple sur Real Madrid – Juventus. Beaucoup moins sur Middlesbrough – Zénith Saint-Pétersbourg.",
    sections: [
      {
        h2: "Comment jouer",
        body: [
          "Deux blasons s'affichent à l'écran, l'un en haut, l'autre en bas.",
          "Tu tapes le nom d'un joueur ayant porté les deux maillots au cours de sa carrière. L'autocomplétion te propose les joueurs de la base au fur et à mesure que tu écris.",
          "Chaque bonne réponse rapporte des points et enchaîne sur une nouvelle paire de clubs. Une erreur ou le temps écoulé met fin à la partie.",
        ],
      },
      {
        h2: "Les trois niveaux de difficulté",
        list: [
          ["Facile", "des stars mondiales et des transferts que tout le monde a suivis — parfait pour se lancer."],
          ["Moyen", "des joueurs bien connus des suiveurs de Ligue 1, Premier League, Liga et Serie A."],
          ["Expert", "des profils plus rares, des passages courts et des championnats moins médiatisés. C'est là que la culture foot fait la différence."],
        ],
      },
      {
        h2: "Solo, en ligne ou entre potes",
        body: [
          "En solo, tu joues contre ton propre record et tu montes au classement mensuel.",
          "En ligne, le matchmaking te place face à un autre joueur sur la même série de clubs : celui qui marque le plus l'emporte.",
          "Entre amis, tu crées un salon et tu partages le code. Vos écrans affichent les mêmes paires de clubs en direct.",
        ],
      },
      {
        h2: "Trois astuces pour marquer plus",
        list: [
          ["Pense aux joueurs à carrière longue", "un Zlatan Ibrahimović ou un Gianluigi Buffon relie à lui seul une dizaine de clubs."],
          ["Passe par les clubs formateurs", "beaucoup de paires improbables se résolvent via un club de formation ou un prêt oublié."],
          ["Ne bloque pas sur une paire", "mieux vaut tenter vite une piste que laisser filer le chrono."],
        ],
      },
    ],
    faq: [
      [
        "The Plug est-il gratuit ?",
        "Oui, entièrement gratuit, sans publicité et sans inscription obligatoire.",
      ],
      [
        "Faut-il installer une application ?",
        "Non. Le jeu tourne directement dans le navigateur, sur ordinateur comme sur mobile. Tu peux aussi l'installer comme application (PWA) depuis le menu de ton navigateur.",
      ],
      [
        "Les prêts comptent-ils comme un passage dans un club ?",
        "Oui, un prêt compte comme un passage dès lors que le joueur a évolué sous les couleurs du club.",
      ],
    ],
  },

  {
    slug: "the-mercato",
    play: "chaine",
    accent: "#FF8A2A",
    img: "/mercato-card.webp",
    name: "The Mercato",
    tagline: "La chaîne sans fin",
    title: "The Mercato — Le jeu de la chaîne de transferts | GOAT FC",
    description:
      "Pars d'un joueur et enchaîne les transferts de club en club le plus longtemps possible. Règles, système de score et astuces du mode The Mercato. Gratuit.",
    h1: "The Mercato — enchaîne les transferts sans jamais casser la chaîne",
    intro:
      "The Mercato est un mode marathon. Tu démarres sur un joueur, et tu construis une chaîne : chaque nouveau joueur doit partager un club avec le précédent. Plus la chaîne est longue, plus le score grimpe. Le seul adversaire, c'est ton propre record.",
    sections: [
      {
        h2: "Comment jouer",
        body: [
          "Le jeu te donne un joueur de départ et l'un de ses clubs.",
          "À toi de citer un autre joueur ayant évolué dans ce même club. Ce joueur devient le nouveau maillon, et l'un de ses autres clubs devient la prochaine cible.",
          "La chaîne continue tant que tu trouves. Un joueur déjà utilisé ne compte pas deux fois : il faut renouveler en permanence.",
        ],
      },
      {
        h2: "Comment le score est calculé",
        body: [
          "Chaque maillon validé rapporte des points, et la valeur des maillons augmente à mesure que la chaîne s'allonge. Une longue série vaut donc bien plus que plusieurs séries courtes.",
          "Ton meilleur score est conservé et apparaît dans le classement mensuel, qui se réinitialise au début de chaque mois.",
        ],
      },
      {
        h2: "Trois astuces pour allonger la chaîne",
        list: [
          ["Vise les clubs à gros effectif", "Real Madrid, Manchester United ou l'Inter t'ouvrent des centaines de possibilités au maillon suivant."],
          ["Évite les impasses", "un club au recrutement très local réduit fortement ton choix pour le coup d'après."],
          ["Garde tes valeurs sûres", "ne brûle pas tes joueurs les plus polyvalents dès les premiers maillons, ils te sauveront plus tard."],
        ],
      },
    ],
    faq: [
      [
        "Quelle différence avec The Plug ?",
        "Dans The Plug, tu cherches un joueur qui relie deux clubs imposés. Dans The Mercato, tu construis toi-même une chaîne continue de joueurs et de clubs, sans limite de longueur.",
      ],
      [
        "Puis-je réutiliser un joueur déjà cité ?",
        "Non. Chaque joueur ne peut servir qu'une fois par partie, ce qui rend les longues chaînes de plus en plus exigeantes.",
      ],
      [
        "Le classement est-il remis à zéro ?",
        "Oui, le classement repart de zéro chaque mois. Chaque nouvelle saison est une nouvelle chance de finir en tête.",
      ],
    ],
  },

  {
    slug: "trouve-le-joueur",
    play: "grid",
    accent: "#00E676",
    img: "/reveal-card.webp",
    name: "Trouve le joueur",
    tagline: "Déduction en illimité",
    title: "Trouve le joueur — Devine le footballeur mystère avec des indices | GOAT FC",
    description:
      "Déduis le footballeur mystère à partir de ses indices : nationalité, poste, clubs, âge. En illimité, avec une devinette du jour et une série à faire grandir.",
    h1: "Trouve le joueur — déduis le footballeur mystère indice par indice",
    intro:
      "Un joueur mystère, des indices qui se dévoilent au fil de tes tentatives. À chaque proposition, le jeu te dit ce qui colle et ce qui ne colle pas : nationalité, poste, club, âge. À toi de resserrer l'étau.",
    sections: [
      {
        h2: "Comment jouer",
        body: [
          "Propose le nom d'un footballeur. Le jeu compare ta proposition au joueur mystère et t'indique, critère par critère, ce qui correspond.",
          "Un critère vert est exact, un critère gris ne l'est pas. Les flèches t'indiquent si l'âge du joueur recherché est plus élevé ou plus bas.",
          "Chaque tentative resserre le champ des possibles. Trouve le joueur en un minimum d'essais.",
        ],
      },
      {
        h2: "La devinette du jour",
        body: [
          "Chaque jour, un joueur mystère identique pour tout le monde. Tout le monde joue la même énigme, ce qui rend les scores directement comparables entre amis.",
          "Résous-la chaque jour pour faire grandir ta série. Un jour manqué, et la série repart de zéro — c'est tout l'intérêt.",
        ],
      },
      {
        h2: "Le mode illimité",
        body: [
          "En dehors de la devinette quotidienne, tu peux enchaîner autant de joueurs mystères que tu veux. Chaque bonne réponse fait monter ta série en cours, une erreur la remet à zéro.",
        ],
      },
    ],
    faq: [
      [
        "Quels indices sont donnés ?",
        "La nationalité, le poste, le club actuel et l'âge du joueur mystère, comparés à chacune de tes propositions.",
      ],
      [
        "La devinette du jour est-elle la même pour tout le monde ?",
        "Oui. Le joueur mystère quotidien est identique pour tous les joueurs, et change chaque jour à minuit.",
      ],
      [
        "Combien de tentatives ai-je ?",
        "Le mode illimité ne limite pas les tentatives : c'est le nombre d'essais utilisés qui détermine ta performance.",
      ],
    ],
  },

  {
    slug: "goat-guess",
    play: "guess",
    accent: "#C084FC",
    img: "/guess-card.webp",
    name: "GOAT Guess",
    tagline: "Je devine ton joueur",
    title: "GOAT Guess — L'Akinator du football : je devine ton joueur | GOAT FC",
    description:
      "Pense à un footballeur, réponds à une série de questions, et le jeu devine de qui il s'agit en 25 questions maximum. Gratuit, sans inscription.",
    h1: "GOAT Guess — pense à un footballeur, je devine lequel",
    intro:
      "Le principe d'Akinator, appliqué au football. Tu penses à un joueur, tu ne le dis à personne, et tu réponds simplement par oui ou non. En 25 questions maximum, le jeu annonce son verdict.",
    sections: [
      {
        h2: "Comment jouer",
        body: [
          "Choisis un footballeur dans ta tête. Star mondiale ou joueur plus confidentiel, les deux fonctionnent.",
          "Le jeu te pose des questions fermées : nationalité, poste, club, palmarès, époque.",
          "Réponds honnêtement. À chaque réponse, le champ des joueurs possibles se réduit, jusqu'au verdict final.",
        ],
      },
      {
        h2: "Comment ça marche",
        body: [
          "À chaque tour, le jeu choisit la question qui sépare le mieux les joueurs encore possibles — celle dont la réponse élimine le plus de candidats, quelle qu'elle soit.",
          "C'est pour ça qu'une poignée de questions suffit à réduire des milliers de joueurs à une poignée de candidats.",
        ],
      },
    ],
    faq: [
      [
        "Combien de questions au maximum ?",
        "25. Dans la grande majorité des parties, le verdict tombe bien avant.",
      ],
      [
        "Que se passe-t-il si le jeu se trompe ?",
        "Tu peux lui indiquer qu'il a faux et il poursuit son raisonnement avec les candidats restants.",
      ],
      [
        "Les joueurs peu connus sont-ils reconnus ?",
        "La base couvre plusieurs milliers de joueurs. Les profils les plus confidentiels restent les plus difficiles à identifier.",
      ],
    ],
  },
];
