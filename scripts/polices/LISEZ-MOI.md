# Polices du générateur de visuels

`anton-latin.woff2` — sous-ensemble latin d'**Anton**, sous licence SIL Open Font
License 1.1 (la même police que l'app charge déjà depuis Google Fonts, cf. le
`@import` de `LePont.jsx`).

Elle est versionnée ici pour une seule raison : `scripts/cartes-modes.mjs` doit
pouvoir régénérer les visuels **sans réseau**. Une police chargée depuis un CDN
au moment du rendu échoue en silence et retombe sur une police système — le
visuel part alors avec le mauvais lettrage sans que rien ne le signale.
