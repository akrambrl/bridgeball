# 📱 Publier GOAT FC sur le Play Store (Android)

Guide pas-à-pas pour empaqueter la PWA en app Android (TWA) et la publier.
Sur Android, on n'écrit **pas** de code natif : on emballe le site dans une
**Trusted Web Activity (TWA)**, une coque officielle Google qui affiche
`goatfc.fr` en plein écran, sans barre d'adresse.

---

## ✅ Ce qui est déjà prêt (fait dans le repo)

- `public/manifest.json` — manifest Web App complet (nom, couleurs, orientation).
- Icônes : `icon-192.png`, `icon-512.png` + **`icon-maskable-512.png`** (icône
  adaptative Android, logo dans la « safe zone »).
- `apple-touch-icon.png` (180×180) et `favicon.png` recréés (étaient en 404).
- Service worker (offline) + `theme_color` / `background_color`.
- CGU (`/terms`), politique de confidentialité (`/privacy`), bannière RGPD,
  **suppression de compte in-app** (exigée par les stores).

> Après déploiement Vercel, vérifie que <https://goatfc.fr/manifest.json>
> répond bien **200** (plus 404).

---

## 1. Générer l'app (le plus simple : PWABuilder)

1. Va sur **<https://www.pwabuilder.com>** et entre `https://goatfc.fr`.
2. Il analyse le manifest/SW et donne un score. Corrige les éventuels avertissements.
3. Clique **Package for stores → Android**.
4. Renseigne :
   - **Package ID** : `fr.goatfc.app` (unique, définitif — ne change plus jamais).
   - **App name** : `GOAT FC`
   - **Launcher name** : `GOAT FC`
   - Signing key : **« Create new »** → PWABuilder génère ta clé.
     ⚠️ **Télécharge et sauvegarde le `.keystore` + les mots de passe** dans un
     endroit sûr. Si tu le perds, tu ne pourras **plus jamais** mettre à jour
     l'app sous le même compte.
5. Télécharge le zip : il contient l'**`.aab`** (à uploader sur Play), l'APK de
   test, la clé, et un fichier **`assetlinks.json`**.

> Alternative en ligne de commande : `@bubblewrap/cli`
> (`npm i -g @bubblewrap/cli` → `bubblewrap init --manifest https://goatfc.fr/manifest.json`
> → `bubblewrap build`). Même résultat, plus de contrôle.

---

## 2. Digital Asset Links (retire la barre d'adresse) — **obligatoire**

Sans ça, l'app affiche une barre d'URL Chrome moche en haut. Pour la retirer,
Google doit vérifier que tu possèdes bien `goatfc.fr` :

1. Récupère le fichier **`assetlinks.json`** fourni par PWABuilder (il contient
   l'empreinte **SHA-256** de ta clé de signature).
2. Place-le dans le repo à **`public/.well-known/assetlinks.json`**.
3. Déploie → il doit être accessible à
   **<https://goatfc.fr/.well-known/assetlinks.json>** (code 200).

> Si tu actives **Play App Signing** (recommandé), Google **re-signe** ton app
> avec SA propre clé. Il faut alors mettre dans `assetlinks.json` l'empreinte
> **SHA-256 du certificat de Play App Signing** (Play Console → *Configuration →
> Intégrité de l'app*), sinon la barre d'URL restera. Fingerprint à copier tel quel.

---

## 3. Play Console — checklist de publication

1. **Compte développeur** : 25 $ une fois (<https://play.google.com/console>).
   Pour un compte perso créé récemment, Google exige souvent **20 testeurs
   pendant 14 jours** avant l'accès public → anticipe.
2. **Créer l'app** → uploade l'**`.aab`** dans un canal (test interne d'abord).
3. **Fiche du store** : titre, description courte/longue, icône 512×512, bannière
   **feature graphic 1024×500**, **2 à 8 captures d'écran** de téléphone.
4. **Politique de confidentialité** : renseigne l'URL **<https://goatfc.fr/privacy>**.
5. **Data safety** (formulaire obligatoire) — déclare ce que tu collectes :
   - Pseudo, scores → *App activity / User content*
   - **Pays via IP** (tu utilises `ipapi.co`, un tiers) → *Location approximate*
   - Identifiant d'appareil anonyme + events → *App activity / Device IDs*
   - Tokens push → si tu gardes les notifications
   - Précise : données chiffrées en transit, suppression possible (tu as la
     suppression de compte in-app ✅).
6. **Classification du contenu** : remplis le questionnaire (quiz → tout public /
   PEGI 3, mais indique qu'il y a **interaction entre utilisateurs** à cause des
   pseudos/duels visibles).
7. **Public cible** : évite « enfants < 13 ans » pour ne pas déclencher les
   règles *Designed for Families* (plus lourdes).

---

## 4. ⚠️ À régler AVANT le lancement public (hors packaging)

- **🔒 Sécurité Supabase (RLS).** Ta clé `anon` est publique dans le bundle
  (normal), donc **Row Level Security doit être activé** sur toutes les tables
  `bb_*` avec des règles strictes. Sinon n'importe qui peut lire/effacer scores,
  pseudos, events. → Supabase → *Authentication → Policies*. **Point n°1.**
- **Marques.** Noms de joueurs/clubs = faits, OK. Jamais d'écussons ni de photos
  officielles sans licence (actuellement OK, que ton propre `logo.png`).
- **Nom « GOAT FC ».** Vérifie l'absence de marque déposée (INPI / EUIPO).
- **Modération.** Pseudos/duels visibles par d'autres → prévois signalement/blocage
  (tu as déjà `bb_reports`, confirme que c'est branché côté UI).

---

## 5. iOS (plus tard)

Apple **refuse** les simples WebView (règle 4.2). Il faudra une coque
**Capacitor** + quelques fonctions natives (push natif, haptique, offline).
À planifier séparément une fois la version Android en ligne.
