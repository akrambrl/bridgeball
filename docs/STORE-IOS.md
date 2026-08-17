# 🍎 Publier GOAT FC sur l'App Store (iOS, via Capacitor)

Contrairement à Android, Apple **refuse** les simples « site web emballé » (règle
**4.2 – Minimum Functionality**). On utilise donc **Capacitor** pour créer une
vraie coque native, avec des **fonctions natives** et les assets **empaquetés**
(l'app marche offline). C'est ce qui fait passer la revue.

> ✅ **Tu n'as PAS besoin d'installer Xcode.** Le workflow
> `.github/workflows/ipa-ios.yml` construit l'IPA signé sur un runner macOS de
> GitHub et le dépose sur TestFlight. Le dépôt étant public, ces minutes ne sont
> pas facturées. Xcode ne devient utile que pour déboguer sur un simulateur.

---

## 🚦 L'ordre réel des choses, et le seul vrai bloquant

| # | étape | délai | qui |
|---|---|---|---|
| 1 | **S'inscrire au Apple Developer Program — 99 $/an** | **24-48 h**, parfois plus (vérification d'identité) | toi |
| 2 | Créer la clé d'API App Store Connect (3 secrets) | 5 min | toi |
| 3 | Créer l'app dans App Store Connect (`fr.goatfc.app`) | 10 min | toi |
| 4 | Lancer le workflow **IPA iOS** | ~20 min | un clic |
| 5 | TestFlight interne (jusqu'à 100 testeurs) | immédiat, sans revue | toi |
| 6 | Revue App Store | 1 à 3 jours | Apple |

**Rien ne peut avancer avant le point 1**, pas même un essai du workflow.

**Et le point 1 cache une décision.** Les 24-48 h annoncées valent pour une
inscription en **Particulier** — et le vendeur affiché sous l'app est alors le
nom d'état civil, Apple ne proposant pas de nom commercial libre aux comptes
particuliers (contrairement à Play). Pour afficher `GOAT FC`, il faut une
inscription en **Organisation** : entité immatriculée, site à son nom, et un
**numéro D-U-N-S** — gratuit, mais jusqu'à 5 jours ouvrés, parfois deux
semaines. C'est le seul délai du projet qu'on ne peut pas comprimer.

**Et la bonne nouvelle :** Apple n'a **aucune** exigence équivalente aux 12 testeurs
pendant 14 jours de Google. TestFlight interne est immédiat. À compte égal, iOS
sort donc PLUS VITE qu'Android.

## 📱 iPhone SEUL, et c'est une décision datée

`TARGETED_DEVICE_FAMILY` est passé de `"1,2"` à `"1"` le 14 août 2026.

Motif, mesuré et non supposé : la mise en page à trois colonnes (celle qui
s'active au-delà de 900 px de large) **ne remplit pas un iPad en portrait** — le
contenu tient dans le haut du cadre et 60 % de l'écran reste du fond vide. Apple
contrôle le rendu iPad dès qu'une app se déclare compatible, et une mise en page
qui ne remplit pas est un motif de refus au titre du design.

Ouvrir ce chantier à six semaines du lancement n'était pas le bon échange. L'iPad
reste jouable dans le navigateur, comme aujourd'hui.

**Pour le rétablir plus tard :** remettre `"1,2"`, adapter la mise en page large
aux ratios hauts, puis `npm run ios:visuels -- --ipad`. Le contrôle des visuels
LIT cette valeur dans le projet : remettre l'iPad sans refaire les captures fait
échouer `npm run ios:visuels`, et non le téléversement chez Apple.

---

## ✅ Ce qui est déjà fait dans le repo

- **Dépendances Capacitor** installées : `@capacitor/core`, `ios`, `cli`, +
  plugins `app`, `haptics`, `status-bar`, `keyboard`, `splash-screen`.
- **`capacitor.config.ts`** : `appId: fr.goatfc.app`, `appName: GOAT FC`,
  `webDir: dist`, fond `#0A140A`, splash + clavier natif.
- **`src/lib/native.ts`** : initialisation native (barre de statut sombre, splash,
  bouton retour) + **retour haptique** (`hapticSuccess` / `hapticError`), le tout
  **no-op sur le web**.
- **Haptique branchée** dans le jeu : vibration native sur bonne/mauvaise réponse
  (`handleCorrectAnswer` / `handleWrongAnswer`).
- **`initNative()`** appelée au démarrage (`main.tsx`).
- Scripts : `npm run ios:sync` (build + sync) et `npm run ios:open`.

Ces fonctions natives (haptique, barre de statut, splash, offline) sont
justement ce qu'Apple attend pour ne **pas** te refuser sous 4.2.

---

## 1. Générer le projet iOS (sur Mac)

Le dossier `ios/` **existe déjà** dans le dépôt — `npx cap add ios` n'est plus à
faire et écraserait la configuration. Sur un Mac, pour déboguer :

```bash
npm install
npm run ios:sync        # build web + copie dans la coque
npm run ios:open        # ouvre Xcode
```

À chaque modif du site ensuite : `npm run ios:sync`. Le workflow le fait seul.

## 2. Icônes & splash

Les sources sont **déjà prêtes** dans `assets/` (`icon.png` 1024, `splash.png`
et `splash-dark.png` 2732×2732). Il suffit de générer tous les formats iOS :

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --ios   # lit automatiquement le dossier assets/
```

Fournis une icône **1024×1024** propre (sans coins arrondis, sans transparence —
Apple les ajoute). Ton `public/icon-512.png` peut servir de base (à re-générer en 1024).

## 3. Réglages Xcode

- **Signing & Capabilities** : sélectionne ton **Team** (compte Apple Developer),
  Bundle Identifier `fr.goatfc.app`.
- **Deployment Target** : le projet est à **iOS 15.0** — relevé dans
  `project.pbxproj`, et non supposé. Ce document annonçait « iOS 14+ ».
  Il faudra 16.4+ le jour où tu activeras le push natif.
- Lance sur un **simulateur** puis un **iPhone réel** pour vérifier haptique,
  splash, clavier, offline.

## 4. Compte & soumission

- **Apple Developer Program** : **99 $/an** (obligatoire).
- **App Store Connect** → crée l'app (Bundle ID `fr.goatfc.app`).
- **Captures d'écran** : `npm run ios:visuels` les rend et les CONTRÔLE, dans
  `visuels/store-ios/`. Une seule taille iPhone est exigée — **6.9" en
  1290×2796** — et Apple dérive les autres. L'ancienne version de ce document
  demandait aussi du 6.5" en 1242×2688 : ce n'est plus nécessaire, et le second
  format n'était même pas le bon. Vérifié sur la documentation d'App Store
  Connect le 14 août 2026, en recroisant deux sources — un premier relevé
  annonçait « 1260 × 2736 », un format qui ne correspond à aucun iPhone.
- **Aucun canal alpha**, nulle part. Apple refuse. Play ne le refuse que sur sa
  bannière, donc c'est un piège pour qui recopie les visuels d'un store à l'autre.
- **App Privacy (nutrition labels)** — déclare les mêmes données que côté Android :
  - Pseudo, scores → *User Content / Identifiers*
  - **Pays via IP** (`ipapi.co`, tiers) → *Location (Coarse)*
  - Identifiant d'appareil anonyme + events → *Identifiers / Usage Data*
  - Tokens push (si activé)
  - **Publicité — cette ligne a changé.** Ce document affirmait « pas de suivi
    publicitaire, App Tracking Transparency non requis ». C'était vrai jusqu'à
    l'arrivée d'AdMob. Il faut désormais déclarer, dans les étiquettes de
    confidentialité, **Identifiers → Third-Party Advertising** et
    **Usage Data → Advertising Data**, et l'app demande l'autorisation ATT au
    lancement. Refuser ne bloque rien : les pubs deviennent non personnalisées.
- **Suppression de compte** : Apple l'exige → déjà présente in-app ✅.
- **Politique de confidentialité** : `https://goatfc.fr/privacy/` — vérifiée
  vivante (HTTP 200). L'adresse de contact qui y figure est `contact@goatfc.online`.
- **Classification d'âge** : quiz → 4+, mais signale l'**interaction entre
  utilisateurs** (pseudos/duels) et prévois signalement/blocage.

## 5. Notifications push (optionnel)

Si tu veux le push natif iOS : ajoute `@capacitor/push-notifications`, active la
capability **Push Notifications** + **Background Modes** dans Xcode, configure
**APNs** dans App Store Connect, et relie les tokens à ta table
`bb_push_subscriptions`. À faire dans un second temps si besoin.

---

## 📺 Publicités sur iOS — deux clés qui font planter l'app si elles manquent

`ios/App/App/Info.plist` porte maintenant deux clés, et **l'absence de l'une ou
l'autre fait planter l'app**, pour deux raisons différentes :

| clé | sans elle |
|---|---|
| `GADApplicationIdentifier` | le SDK Google Mobile Ads lève au **démarrage**, avant le premier écran, sur tous les iPhone |
| `NSUserTrackingUsageDescription` | iOS fait planter l'app au moment d'**afficher** la fenêtre d'autorisation |

L'identifiant présent est celui de **TEST** de Google
(`ca-app-pub-3940256099942544~1458002511`). À remplacer par celui de l'app iOS
créée dans AdMob **au moment de passer en production, et pas avant** — un clic
sur sa propre vraie publicité fait fermer un compte AdMob définitivement.

C'est l'identifiant d'**application** (avec un `~`), jamais celui du **bloc
d'annonces** (avec un `/`). Ce dernier va dans `src/lib/pub.ts`, champ
`ID_REEL_RECOMPENSE.ios`, aujourd'hui vide — et vide veut dire mode test, ce qui
est le bon défaut.

**Deux points restés ouverts, volontairement :**

- **La phrase ATT est en anglais.** `CFBundleDevelopmentRegion` vaut `en`, c'est
  donc la langue de repli du bundle. La traduire demande un
  `fr.lproj/InfoPlist.strings` ajouté aux ressources du projet — à faire depuis
  Xcode, pas à la main dans le `.xcodeproj`.
- **`SKAdNetworkItems` n'est pas renseigné.** Google publie une liste d'une
  centaine d'identifiants de réseaux à coller dans le plist ; elle améliore
  l'attribution, donc le revenu. Elle n'a pas été ajoutée ici parce qu'elle
  change régulièrement et qu'une liste recopiée de mémoire serait fausse : à
  prendre à la source, sur la page « Configure SKAdNetwork » d'AdMob, le jour de
  la mise en production.

## 🔑 Le premier IPA, dans l'ordre

Le compte Apple Developer existant, il reste quatre gestes.

**1. Enregistrer le Bundle ID.** `developer.apple.com/account` → Certificates,
Identifiers & Profiles → **Identifiers → +** → App IDs → App → `fr.goatfc.app`.
Sans lui, App Store Connect refuse de créer l'app à l'étape 3.

**2. Créer la clé d'API.** App Store Connect → Utilisateurs et accès →
Intégrations → Clés API → **+**. Rôle **Admin** : le workflow s'appuie sur
`-allowProvisioningUpdates` pour créer lui-même certificat et profil, ce qu'un
rôle App Manager ne permet pas — lui suffit à téléverser, pas à signer.

Tu obtiens `KEY_ID`, `ISSUER_ID`, et le fichier `.p8`. **Le .p8 ne se télécharge
qu'une fois.** Il ne doit passer par aucun autre canal que le formulaire des
secrets GitHub : il permet de déposer des versions sur le compte, et de les
retirer.

**3. Créer l'app** dans App Store Connect → Mes apps → **+** → Bundle ID
`fr.goatfc.app`. Le nom `GOAT FC` doit être libre sur l'App Store ; s'il est
pris, il faut un variant, et c'est le nom affiché qu'on ne peut plus changer
librement ensuite.

**4. Lancer Actions → IPA iOS.** Le pipeline a produit son premier IPA valide
le 17 août 2026 — 8 min 33 s, 16,1 Mo, `altool --validate-app` passé.

Il a fallu sept passages, et les pièges sont consignés dans l'en-tête de
`.github/workflows/ipa-ios.yml`. Les deux qui coûtent le plus cher à retrouver :

- **un appareil doit être enregistré** dans Certificates, Identifiers & Profiles.
  L'archivage réclame un profil de DÉVELOPPEMENT — c'est l'export qui signe en
  distribution — et un profil de développement exige au moins un appareil ;
- **le runner doit porter Xcode 26 ET la plateforme iOS**, qui ne vient plus
  dans le paquet Xcode et se télécharge à la demande.

### Si l'archivage échoue sur la signature

```
error: Signing for "App" requires a development team.
```

Attendu : le projet est en `CODE_SIGN_STYLE = Automatic` mais ne porte aucun
`DEVELOPMENT_TEAM` — il a été généré par Capacitor, jamais ouvert dans Xcode sur
un compte. Avec une équipe unique, `-allowProvisioningUpdates` la déduit parfois
seule de la clé d'API ; « parfois » ne se paramètre pas.

Le correctif est un secret de plus, **facultatif** et lu seulement s'il existe :
`APPSTORE_TEAM_ID`, l'identifiant à 10 caractères visible dans **Membership
details** sur `developer.apple.com/account`. Renseigne-le, relance, rien d'autre
à changer — le workflow l'injecte alors dans `xcodebuild` et dans le `teamID` des
options d'export.

## ⚠️ Avant de soumettre — rappels

- **RLS Supabase appliqué** (voir `docs/SECURITY-SUPABASE.md`) — Phase 1 + 2.
- **Manifest & icônes** OK (déjà en place).
- Teste le parcours complet dans la coque : création de compte, jeu, classement,
  amis, salon multi, **offline** (mode avion → l'app doit se lancer).

## Anti-rejet 4.2 — la checklist qui compte

Si Apple te met quand même un 4.2, mets en avant (et renforce au besoin) :
- l'app fonctionne **hors-ligne** (assets empaquetés) ✅
- **retour haptique** natif en jeu ✅
- **barre de statut / splash** natifs ✅
- push natif (si tu l'ajoutes)
- éventuellement : partage natif des scores (`@capacitor/share`), sauvegarde
  d'image de résultat — chaque touche native supplémentaire réduit le risque.
