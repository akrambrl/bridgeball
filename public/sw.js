// GOAT FC — Service Worker pour push notifications + auto-update
// À placer dans public/sw.js (ou racine du site)
//
// IMPORTANT : bumper CACHE_NAME à chaque deploy pour forcer le navigateur
// à détecter un nouveau SW (les changements de fichier suffisent en théorie
// mais ça garantit un install propre côté PWA mobile installée).
const CACHE_NAME = "goatfc-v553-2026-08-15";

// Install : on prend la main tout de suite sans attendre la fermeture des onglets
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate : on revendique tous les clients existants ET on purge les
// anciens caches éventuels (utile si une version précédente faisait du cache).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // ── CE CACHE-CI NE DOIT PAS ÊTRE PURGÉ ────────────────────────────────
      // "goatfc-donnees" porte la base joueurs téléchargée depuis le site (voir
      // src/lib/donnees.ts). Le purger à chaque activation — donc à chaque
      // déploiement — ferait retomber TOUS les joueurs sur les données du paquet,
      // en silence : l'app fonctionnerait, avec des transferts périmés et aucun
      // moyen de s'en apercevoir. C'est le premier défaut trouvé en sortant les
      // données du bundle, et il l'a été en lisant ce fichier AVANT d'écrire
      // l'autre.
      const A_GARDER = [CACHE_NAME, "goatfc-donnees"];
      await Promise.all(
        keys.filter((k) => !A_GARDER.includes(k)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Permettre à la page de demander un skipWaiting depuis le client
// (utile si on veut un bouton "rafraîchir" plus tard).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Réception d'une push notification depuis le serveur
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "GOAT FC", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "GOAT FC ⚽";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "goatfc-push",
    renotify: true,
    requireInteraction: false,
    vibrate: [150, 80, 150],
    data: { url: data.url || "/", ...data.extra },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click sur la notif : ouvrir l'app (ou la ramener au premier plan)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si l'app est déjà ouverte, la ramener au premier plan
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Gestion de la souscription qui expire ou est révoquée — tentative de re-subscribe
self.addEventListener("pushsubscriptionchange", (event) => {
  // Le client JS s'en occupera au prochain chargement de l'app
  // via subscribeToPush()
});
