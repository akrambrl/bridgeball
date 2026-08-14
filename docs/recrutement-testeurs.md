# Recruter les 12 testeurs — messages prêts à envoyer

Google exige **12 testeurs inscrits pendant 14 jours consécutifs** avant de
donner l'accès à la production. C'est le chemin critique du lancement d'octobre :
rien ne l'accélère, et une désinscription qui fait retomber le compteur sous 12
remet les 14 jours à zéro.

## Par quel canal, et avec quelle portée réelle

Le premier réflexe — « j'envoie une notification push à tous mes joueurs » — ne
marche pas ici, et il vaut mieux le savoir avant de compter dessus.

| canal | portée réelle | ce qu'il vaut |
|---|---|---|
| **Message direct** (WhatsApp, DM) | les gens que tu connais | 🟢 le seul qui convertit vraiment |
| **Story / post** Instagram, TikTok | ton audience | 🟡 large mais passif |
| **Notification push** | **~6 appareils** | 🔴 inutilisable pour ça |
| Bannière dans l'app | tous ceux qui ouvrent | 🟢 mais demande du code |

**Pourquoi le push ne sert à rien ici :** le dernier envoi réel a touché
**6 appareils sur 13 abonnements** — les 7 autres étaient des jetons morts d'une
ancienne clé VAPID. Presque aucun joueur n'a accepté les notifications. Six
personnes quand il en faut douze, ça ne fait pas le travail.

**Alors que la base est là.** Mesuré sur `bb_presence` le 14 août 2026 :

- **90 appareils Android** vus dans les 7 derniers jours
- **106** dans les 30 derniers jours
- dont **59 avec un pseudo**, donc un joueur identifiable

Il t'en faut 12. Tu as sept fois et demie ce qu'il faut — le problème n'est pas
d'en trouver, c'est de leur parler.

## Qui viser en premier

Tes joueurs Android les plus assidus, dans l'ordre où ils accepteront le plus
vite (ils jouent déjà tous les jours) :

```
thibault      n°1 au classement
fredo17       n°2
baptistem   valoche     nico        mrt007      davyids
benji54     guilloche   fcdrt       damienfcb   nono1901
marin69     walidleboss bano84      darkwar1er  gregsto11
```

**Vise 16 à 18 personnes, pas 12 pile.** Il y aura des « mauvais compte Google »
et des désinscriptions, et il faut rester **au-dessus de 12 en permanence**.

---

## 0. Le DM Instagram, pour quelqu'un que tu connais

**Le plus important d'abord : plus de la moitié de tes joueurs sont sur iPhone**
— 106 iOS contre 90 Android sur les 7 derniers jours. Un test fermé Play ne
concerne qu'Android, donc si tu ne sais pas sur quoi la personne joue, la
question passe en premier. Sinon tu brûles la moitié de tes demandes.

Celui-ci est écrit pour un DM : des blocs courts, pas de mise en forme (Instagram
n'en garde aucune), et le lien vient plus tard. À coller tel quel.

```
Yo ! J'ai un service à te demander, ça prend 2 min 🙏

GOAT FC sort sur le Play Store, et Google me bloque : il me faut 12 testeurs
Android avant de pouvoir publier. Tu joues déjà, donc t'es exactement la
personne qu'il me faut.

Ce que ça implique concrètement :
— j'ajoute ton adresse Gmail, je t'envoie un lien
— tu installes l'app depuis le Play Store
— tu la gardes 2 semaines

C'est tout. Tu joues comme d'habitude, pas besoin d'y aller tous les jours.
Et t'as la version Android avant tout le monde.

T'es bien sur Android ? Si oui je t'ajoute 🙌
```

**Pourquoi la question Android est à la FIN** : posée en premier, elle transforme
la demande en interrogatoire. Placée là, la personne a déjà lu ce qu'on lui
demande et répond « oui, vas-y » d'un seul message.

### Si tu sais déjà qu'il est sur Android

```
Yo ! Petit service, 2 min 🙏

GOAT FC sort sur le Play Store et Google me demande 12 testeurs Android avant
de valider. Tu joues déjà, donc t'es parfait pour ça.

Tu installes l'app avec un lien que je t'envoie, tu la gardes 2 semaines, et
tu joues comme d'habitude. Rien d'autre. En échange t'as la version Android
avant tout le monde.

Envoie-moi l'adresse Gmail avec laquelle t'es connecté au Play Store et je
t'ajoute 🙌
```

### Et si c'est un iPhone

Ne le laisse pas en plan, il te servira en octobre.

```
Ah mince, c'est Android uniquement pour ce test 😅 Mais l'iOS arrive en octobre,
je te préviens dès que c'est dispo pour que tu l'aies en premier 🙌
```

---

## 1. Le message direct — celui qui convertit

Court, il dit ce qu'ils y gagnent, et il demande un oui avant d'envoyer le lien.
Ne colle pas le lien tout de suite : une demande à laquelle on répond « oui »
engage, un lien reçu sans contexte se perd dans le fil.

```
Salut ! GOAT FC arrive sur le Play Store 🎉

Google me demande 12 testeurs Android pour valider la sortie. Tu joues déjà,
donc t'es exactement la bonne personne.

Concrètement : t'acceptes un lien, tu installes, et tu gardes l'app 2 semaines.
Tu joues comme d'habitude, rien de plus. Et t'as la version Android avant tout
le monde.

Ça te va ?
```

### Pour quelqu'un qui ne joue pas encore

```
Salut ! Je sors mon jeu de foot sur Android et Google me demande 12 testeurs
pour valider la sortie 🙏

C'est un quiz foot — deviner le joueur qui relie deux clubs, un défi par jour.
T'acceptes un lien, tu installes, tu gardes 2 semaines. 5 min pour voir si ça
te plaît, et ça me débloque le lancement.

Je t'envoie le lien ?
```

---

## 2. Le message d'inscription — celui qui évite de perdre des jours

À envoyer **seulement après un oui**. Les deux avertissements ne sont pas du
zèle : le mauvais compte Google est l'échec numéro un, et une désinscription
remet les 14 jours à zéro pour tout le monde.

```
Parfait, merci 🙏 Deux minutes :

1️⃣ Dis-moi avec quelle adresse Gmail tu es connecté au Play Store
   ⚠️ Important : c'est CE compte que je dois autoriser. Si tu me donnes une
   autre adresse, le lien te répondra « page introuvable ».
   Pour vérifier : ouvre le Play Store → ton avatar en haut à droite → l'adresse
   affichée, c'est celle-là qu'il me faut.

2️⃣ Je t'ajoute, puis je t'envoie le lien d'inscription. Tu l'ouvres, tu acceptes,
   tu installes.

3️⃣ Et surtout : ne quitte pas le programme avant octobre 🙏 Si quelqu'un se
   désinscrit, le compteur de Google repart de zéro pour tout le monde.

Pas besoin de jouer tous les jours. Il faut juste que l'app reste installée.
```

### Puis, avec le lien

Play te donne ce lien dans **Tests fermés → Testeurs**, de la forme
`https://play.google.com/apps/testing/fr.goatfc.app`. Vérifie-le dans la console,
ne recopie pas celui-ci de mémoire.

```
C'est bon, t'es ajouté 👇

<lien>

Ouvre-le avec le compte dont on a parlé, accepte le test, et installe.
Si ça dit « page introuvable », c'est que t'es sur un autre compte Google —
dis-le-moi et on corrige.

Merci 🙏
```

---

## 3. Story Instagram / TikTok

Passif, mais ça touche ton audience d'un coup. Même ton que les annonces
existantes (voir `visuels/annonces/legendes.md`).

```
📱 GOAT FC ARRIVE SUR ANDROID.

Google me demande 12 testeurs pour valider la sortie. Il faut juste installer
l'app et la garder 2 semaines — tu joues comme d'habitude.

En échange t'as la version Android avant tout le monde.

👉 Réponds « TEST » en message et je t'ajoute.

(Android uniquement pour l'instant. L'iOS suit.)
```

### Version courte, pour un sticker de story

```
JE CHERCHE 12 TESTEURS ANDROID 📱
Réponds « TEST » et t'as l'app avant tout le monde
```

---

## 4. Notification push — si tu la fais quand même

Portée : ~6 appareils. À ne faire qu'en complément, jamais comme plan principal.
Contrainte de format : le titre est tronqué vers 40 caractères sur Android.

```
titre : 📱 GOAT FC arrive sur Android
corps : Il me faut 12 testeurs pour valider la sortie. Tu joues déjà — 2 min pour m'aider ?
```

Dis-le-moi si tu veux que je l'écrive : le circuit d'envoi existe déjà
(`scripts/push-io.mjs`), il n'y a que le ciblage Android à ajouter.

---

## 5. Le message de rappel, à J+2

Pour ceux qui n'ont pas répondu. Un seul rappel, pas deux.

```
Hey, je relance juste au cas où 🙏 Toujours besoin de testeurs Android pour
débloquer la sortie Play Store — c'est un lien à accepter et l'app à garder
2 semaines. Si c'est non, aucun souci, dis-le-moi juste que je cherche ailleurs.
```

---

## Ce qu'il ne faut pas faire

**Créer plusieurs comptes Google sur ton appareil pour te compter toi-même.**
Google relie les comptes par identifiant d'appareil, IP et numéro de
récupération — plusieurs comptes créés le même jour sur le même téléphone est le
motif le plus simple à détecter qui existe, et c'est précisément contre ça que
cette exigence a été introduite. Le formulaire d'accès production demande en
plus, par écrit, comment tu as recruté tes testeurs et ce que tu as changé grâce
à leurs retours.

Le risque n'est pas symétrique : un refus coûte 14 jours, une suspension de
compte développeur est définitive et rattachée à ton identité. Et avec 90
joueurs Android déjà actifs, il n'y a rien à gagner à truquer.
