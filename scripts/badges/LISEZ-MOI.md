# Badges officiels du générateur de visuels

Deux fichiers, chacun téléchargé depuis l'outil OFFICIEL du store qu'il
représente — jamais redessinés à la main, ce qui les rendrait à la fois faux
et attaquables (voir l'en-tête de `scripts/visuels-annonce.mjs`).

- **`app-store-fr.svg`** — badge « Télécharger dans l'App Store », noir,
  français. Généré via l'API officielle d'Apple :
  `https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/fr-fr`
- **`google-play-fr.png`** — badge « Disponible sur Google Play », français.
  Généré via le générateur officiel de Google :
  `https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png`

Posés ici, pas dans `public/` : ce sont des entrées du générateur de visuels
(comme les polices de `scripts/polices/`), pas des assets servis par l'app.

Ne JAMAIS recolorer, étirer hors de leurs proportions d'origine, ni recréer
ces badges à la main — les deux plateformes imposent des règles d'usage
précises (zone de respiration minimale, formulations, couleurs) et un badge
non conforme est un motif de refus ou de retrait.

À régénérer aux mêmes URL si Apple ou Google changent leur charte, plutôt que
de patcher les fichiers directement.
