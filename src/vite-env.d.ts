/// <reference types="vite/client" />

// Numéro de build injecté par vite.config.ts, depuis le CACHE_NAME du service
// worker. Affiché dans le pied de page pour qu'on puisse vérifier, depuis l'app,
// quelle version tourne.
declare const __BUILD__: string;
