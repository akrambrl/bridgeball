# Notifications push

## Ce qui ne marchait pas

L'app demandait la permission d'envoyer des notifications, enregistrait les
abonnements dans `bb_push_subscriptions`, et promettait « on te pinguera si t'as
pas joué depuis 24h ». **Rien, nulle part, n'envoyait de notification.** Pas
d'Edge Function, pas de cron, pas de `.github/workflows`, pas de dépendance
`web-push`. La permission était demandée pour rien.

C'est le pire des cas, parce qu'un refus de notification est **définitif** : le
navigateur ne permet pas de redemander.

Trois défauts côté client s'y ajoutaient :

| Défaut | Conséquence |
|---|---|
| `sendNotif` utilisait `new Notification()` | Lève « Illegal constructor » sur Chrome Android **et** en PWA iOS, c'est-à-dire sur tout le public. L'erreur était avalée par un `try/catch`. Une notification déclenchée par une page doit passer par le service worker. |
| `scheduleNextNotif` posait un `setTimeout` de 24 h | Suppose un onglet ouvert 24 h. Un onglet mobile est gelé en quelques minutes : il ne s'est jamais déclenché. |
| `subscribeToPush` rendait `true` sans lire la réponse du POST | Un échec réseau ou un refus de la base passait pour un succès. |
| L'abonnement ne se faisait qu'au moment du tap sur « Oui, active ! » | Un POST raté ce jour-là, un endpoint renouvelé par le navigateur, une permission accordée avant l'existence du code : dans tous ces cas, permission accordée et zéro notification, sans moyen de réparer — le bouton ne réapparaît jamais. |

## Ce qui existe maintenant

```
GitHub Actions (cron quotidien)
  └── scripts/notif-devinette.mjs
        ├── lit bb_push_subscriptions       (clé service_role)
        ├── calcule le joueur du jour       (src/lib/devinette.js)
        ├── envoie, chiffré et signé VAPID  (web-push)
        └── purge les abonnements morts, les doublons, les lignes sans clés
```

Un seul message, une fois par jour : **la devinette du jour**. Le texte est une
accroche, pas une réponse — nombre de clubs, poste, décennie d'éclosion. Il ne
cite ni le nom ni aucun club, et un test le vérifie sur la totalité du vivier :
une notification arrive avant qu'on ouvre le jeu, un nom dedans supprimerait la
partie du jour pour tous ceux qui la reçoivent.

### Pourquoi le calcul du joueur est dans `src/lib/devinette.js`

Il vivait dans `FindPlayer.tsx`, qui importe `LePont.jsx` (15 000 lignes) et
React : impossible à charger depuis un script Node. Recopier la formule dans
l'envoyeur aurait garanti sa divergence, et une notification qui décrit un autre
joueur que le jeu est un mensonge visible par tout le monde. Une seule
implémentation, deux appelants, et un test (`src/test/devinette.test.ts`) qui
tombe si quelqu'un remet une copie dans le composant.

## Mise en route — les deux secrets à créer

Dans **Settings → Secrets and variables → Actions** du dépôt :

| Secret | Où le trouver |
|---|---|
| `SB_SERVICE_KEY` | Supabase → Project Settings → API → `service_role`. Indispensable : `bb_push_subscriptions` est volontairement **illisible** avec la clé publique (les endpoints push sont des données sensibles), donc la clé `anon` ne permet pas de lire les abonnés. |
| `VAPID_PRIVATE_KEY` | La moitié privée de la paire VAPID. Elle a été générée en même temps que la clé publique du client et **ne doit jamais entrer dans le dépôt**. |

La clé **publique** vit dans `src/components/LePont.jsx` (`VAPID_PUBLIC_KEY`) —
c'est normal, elle est publique par construction.

### La clé service_role sort de Supabase

C'est la contrepartie assumée du choix « GitHub Actions » : la clé vit dans les
secrets GitHub. Elle est révocable à tout moment depuis le tableau de bord
Supabase (Project Settings → API → *Reset*), ce qui la rend moins définitive
qu'il n'y paraît. L'autre option — une Edge Function Supabase déclenchée par
`pg_cron` — garde la clé à l'intérieur de Supabase, au prix d'un déploiement
avec la CLI `supabase`.

## Essayer sans rien envoyer

```bash
npm run notif:essai   # circuit complet contre un faux Supabase et un faux service de push
```

Cet essai vérifie ce que les tests unitaires ne peuvent pas : lecture paginée,
chiffrement `aes128gcm`, signature VAPID, purge des morts et des doublons. Il
sert de vraies clés ECDH et un vrai HTTPS (certificat auto-signé jetable), parce
que `web-push` refuse de chiffrer sans les premières et que la vérification
d'abonnement exige le second.

Pour une simulation contre la **vraie** base, sans envoyer :

```bash
SB_SERVICE_KEY=... npm run notif:sec
```

Elle compte les abonnés par plateforme et n'envoie rien.

Depuis GitHub : **Actions → Notification devinette → Run workflow**, en laissant
`dry_run` coché.

## Le cron

`0 17 * * *` — 19 h à Paris en été, 18 h en hiver. GitHub n'accepte que l'UTC ;
une heure de décalage l'hiver vaut mieux que deux crons, qui risqueraient
d'envoyer deux fois le même jour.

Garde-fou supplémentaire : le `tag` de la notification contient le jour
(`goatfc-devinette-2026-08-11`). Deux notifications de même tag se **remplacent**
sur l'appareil au lieu de s'empiler — même envoyée deux fois, la devinette
n'apparaît qu'une fois.

## Changer les clés VAPID

Un abonnement est lié **pour toujours** à la clé publique avec laquelle il a été
créé. Changer la paire invalide donc tous les abonnements existants.

Ce n'est pas une catastrophe : `subscribeToPush` compare l'`applicationServerKey`
de l'abonnement en place à la clé courante, révoque celui qui ne correspond pas,
et se réabonne. Le remplacement se fait au prochain lancement de l'app, sans que
l'utilisateur ait quoi que ce soit à faire — la permission, elle, reste acquise.

Pour générer une paire :

```bash
node -e 'const c=require("crypto");
const {publicKey,privateKey}=c.generateKeyPairSync("ec",{namedCurve:"prime256v1"});
const b=x=>Buffer.from(x).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
console.log("PUBLIC :",b(publicKey.export({type:"spki",format:"der"}).subarray(-65)));
console.log("PRIVATE:",privateKey.export({format:"jwk"}).d);'
```

La publique fait 87 caractères, la privée 43. La publique va dans
`VAPID_PUBLIC_KEY`, la privée dans le secret GitHub.

## Ce que ça ne couvre pas

- **La langue.** L'accroche est en français pour tout le monde.
  `bb_push_subscriptions` ne porte pas la langue de l'utilisateur (`bb_lang` ne
  vit que dans son `localStorage`), donc le serveur ne peut pas la connaître. La
  corriger demande une colonne de plus et une écriture côté client.
- **Les défis reçus.** `bb_duels` contient déjà les défis en attente
  (`status=sent`) : « X te défie » serait la notification la plus forte, et elle
  pousserait le mode multi. Elle n'est pas branchée.
- **iOS hors PWA.** Sur iPhone, les notifications web n'existent que si l'app est
  **installée** sur l'écran d'accueil. Le code en tient compte
  (`typeof Notification === "undefined"`), mais aucun message n'explique cette
  condition à l'utilisateur.
- **La mesure.** Rien ne compte les notifications ouvertes. Le lien porte
  `utm_source=push`, donc le tableau de bord peut le voir, mais aucun écran ne
  l'affiche aujourd'hui.
