import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BHcRfwqeF0iMIW15lSzrZp_GxT6xLKpZVK92Qo8Q02he8JRCf7UmGd_UyrCSmIr1nGzHbNjYuJzXVzzXaKUsuy4";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function keyToBase64(key: ArrayBuffer | null): string {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function registerPushWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
}

/** Demande la permission, s'abonne au push et enregistre l'appareil. */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported()) throw new Error("Les notifications ne sont pas supportées sur cet appareil.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications refusées dans les réglages du navigateur.");

  const registration = await registerPushWorker();
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const p256dh = json.keys?.p256dh ?? keyToBase64(subscription.getKey("p256dh"));
  const auth = json.keys?.auth ?? keyToBase64(subscription.getKey("auth"));

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ push_enabled: true })
    .eq("id", userId);
  if (profileError) throw profileError;
}

export async function disablePush(userId: string): Promise<void> {
  if (pushSupported()) {
    const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
  }
  await supabase.from("profiles").update({ push_enabled: false }).eq("id", userId);
}

/** Demande l'accès à la position (une seule fois) pour activer le partage. */
export async function requestLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Position refusée.")), {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}
