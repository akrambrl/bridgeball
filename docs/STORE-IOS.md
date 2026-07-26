# 🍎 Publier GOAT FC sur l'App Store (iOS, via Capacitor)

Contrairement à Android, Apple **refuse** les simples « site web emballé » (règle
**4.2 – Minimum Functionality**). On utilise donc **Capacitor** pour créer une
vraie coque native, avec des **fonctions natives** et les assets **empaquetés**
(l'app marche offline). C'est ce qui fait passer la revue.

> ⚠️ Il faut un **Mac avec Xcode** pour builder iOS. Les étapes `npx cap …`
> ci-dessous se font sur le Mac. Le reste (config, code natif, dépendances) est
> déjà prêt dans le repo.

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

```bash
npm install
npm run build
npx cap add ios         # crée le dossier ios/ (une seule fois)
npm run ios:sync        # build web + copie dans la coque
npm run ios:open        # ouvre Xcode
```

À chaque modif du site ensuite : `npm run ios:sync`.

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
- **Deployment Target** : iOS 14+ (16.4+ si tu actives le push web/natif).
- Lance sur un **simulateur** puis un **iPhone réel** pour vérifier haptique,
  splash, clavier, offline.

## 4. Compte & soumission

- **Apple Developer Program** : **99 $/an** (obligatoire).
- **App Store Connect** → crée l'app (Bundle ID `fr.goatfc.app`).
- **Captures d'écran** obligatoires : iPhone **6.7"** (1290×2796) et **6.5"**
  (1242×2688).
- **App Privacy (nutrition labels)** — déclare les mêmes données que côté Android :
  - Pseudo, scores → *User Content / Identifiers*
  - **Pays via IP** (`ipapi.co`, tiers) → *Location (Coarse)*
  - Identifiant d'appareil anonyme + events → *Identifiers / Usage Data*
  - Tokens push (si activé)
  - Indique : **pas de suivi publicitaire** (App Tracking Transparency non requis
    tant que tu ne traques pas cross-app).
- **Suppression de compte** : Apple l'exige → déjà présente in-app ✅.
- **Politique de confidentialité** : URL `https://goatfc.fr/privacy`.
- **Classification d'âge** : quiz → 4+, mais signale l'**interaction entre
  utilisateurs** (pseudos/duels) et prévois signalement/blocage.

## 5. Notifications push (optionnel)

Si tu veux le push natif iOS : ajoute `@capacitor/push-notifications`, active la
capability **Push Notifications** + **Background Modes** dans Xcode, configure
**APNs** dans App Store Connect, et relie les tokens à ta table
`bb_push_subscriptions`. À faire dans un second temps si besoin.

---

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
