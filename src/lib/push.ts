/**
 * Le système de notifications (internes et push) a été retiré de ReLink.
 * Ce module ne sert plus qu'à nettoyer proprement les anciens abonnements
 * push et l'ancien service worker de notification sur les appareils.
 */
import { supabase } from "@/integrations/supabase/client";

let cleaned = false;

export async function disableLegacyPush(): Promise<void> {
  if (cleaned) return;
  cleaned = true;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
    if (!registration) return;
    const sub = await registration.pushManager?.getSubscription?.();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => undefined);
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
    await registration.unregister().catch(() => undefined);
  } catch {
    /* nettoyage best-effort */
  }
}

/** Géolocalisation navigateur (indépendante des notifications). */
export async function requestLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Géolocalisation indisponible sur cet appareil"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
  });
}
