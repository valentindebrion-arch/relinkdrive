/* Service worker dédié aux notifications push Relink.
   Il ne met rien en cache : uniquement l'affichage des notifications. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Relink", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Relink";
  const options = {
    body: payload.body || "",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    tag: payload.tag || undefined,
    renotify: true,
    vibrate: [80, 40, 80],
    data: { link: payload.link || "/espace" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/espace";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(link);
          return;
        }
      }
      await self.clients.openWindow(link);
    })(),
  );
});
