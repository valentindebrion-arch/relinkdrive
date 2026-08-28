/* Service worker dédié aux notifications push Relink.
   Il ne met rien en cache : uniquement l'affichage des notifications.
   Règle absolue : chaque événement push DOIT afficher une notification
   système (contrainte userVisibleOnly), même si l'application est ouverte.
   Sans cela le navigateur finit par révoquer l'abonnement push. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    console.error("[sw-push] payload illisible", error);
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

  console.log("[sw-push] push reçue", payload.id || "(sans id)");

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, options);
        console.log("[sw-push] showNotification OK");
      } catch (error) {
        console.error("[sw-push] showNotification a échoué", error);
        await self.registration.showNotification("Relink", { body: "Nouvel événement", icon: "/app-icon-192.png" });
      }
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
          if ("navigate" in client) await client.navigate(link).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(link);
    })(),
  );
});

/* Abonnement renouvelé par le navigateur : l'ancien endpoint devient invalide.
   L'application le resynchronise à la prochaine ouverture. */
self.addEventListener("pushsubscriptionchange", () => {
  console.warn("[sw-push] abonnement renouvelé par le navigateur");
});
