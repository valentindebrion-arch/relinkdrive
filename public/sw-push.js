/* Le système de notifications push a été retiré de ReLink.
   Ce worker ne fait plus que se désinscrire pour les appareils
   qui l'avaient encore enregistré. La PWA (manifeste, installation)
   n'utilise pas de service worker. */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {
        /* rien à nettoyer */
      }
      await self.registration.unregister();
    })(),
  );
});
