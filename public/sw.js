// GOAT FC — Service Worker pour push notifications + auto-update
// À placer dans public/sw.js (ou racine du site)
//
// IMPORTANT : bumper CACHE_NAME à chaque deploy pour forcer le navigateur
// à détecter un nouveau SW (les changements de fichier suffisent en théorie
// mais ça garantit un install propre côté PWA mobile installée).
const CACHE_NAME = "goatfc-v27-2026-05-22";

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
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
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
