/* Service worker dédié aux notifications push Relink.
   Il ne met rien en cache : uniquement l'affichage des notifications. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function hasVisibleClient() {
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  return list.some((c) => c.visibilityState === "visible");
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Relink", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Relink";
  const link = payload.link || "/espace";
  const options = {
    body: payload.body || "",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    // Identifiant unique de l'événement : évite tout doublon système.
    tag: payload.tag || payload.id || undefined,
    renotify: true,
    vibrate: [80, 40, 80],
    timestamp: payload.at ? Date.parse(payload.at) || Date.now() : Date.now(),
    data: { link, id: payload.id || null },
  };

  event.waitUntil(
    (async () => {
      // Si l'app est au premier plan, l'interface affiche déjà l'événement.
      if (await hasVisibleClient()) return;
      await self.registration.showNotification(title, options);
    })(),
  );
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
