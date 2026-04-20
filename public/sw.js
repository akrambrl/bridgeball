// GOAT FC — Service Worker pour push notifications
// À placer dans public/sw.js (ou racine du site)

const CACHE_NAME = "goatfc-v1";

// Install & activation : passer tout de suite en mode actif
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
