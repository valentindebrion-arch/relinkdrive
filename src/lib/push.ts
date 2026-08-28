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

/** iPhone / iPad (y compris iPadOS qui se déclare « Macintosh » avec écran tactile). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** L'app est ouverte depuis l'icône de l'écran d'accueil (mode standalone). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export type PushState =
  | "unsupported" // navigateur/appareil incompatible
  | "ios-needs-install" // iPhone/iPad hors écran d'accueil
  | "denied" // autorisation refusée sur ce téléphone
  | "prompt" // autorisation pas encore demandée
  | "enabled" // abonnement réellement enregistré côté serveur
  | "disabled"; // autorisation accordée mais pas d'abonnement actif

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

/** Version du service worker : à incrémenter à chaque modification de /sw-push.js. */
export const SW_VERSION = "4";
const SW_VERSION_KEY = "relink:sw-version";

export async function registerPushWorker(): Promise<ServiceWorkerRegistration> {
  // Si la version enregistrée diffère, on purge l'ancien worker avant de réenregistrer.
  let storedVersion: string | null = null;
  try {
    storedVersion = window.localStorage.getItem(SW_VERSION_KEY);
  } catch {
    storedVersion = null;
  }

  if (storedVersion !== SW_VERSION) {
    const previous = await navigator.serviceWorker.getRegistration("/sw-push.js");
    if (previous) await previous.unregister().catch(() => undefined);
    try {
      window.localStorage.setItem(SW_VERSION_KEY, SW_VERSION);
    } catch {
      /* stockage indisponible */
    }
  }

  const registration = await navigator.serviceWorker.register(`/sw-push.js?v=${SW_VERSION}`, {
    scope: "/",
  });
  await registration.update().catch(() => undefined);
  return registration;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
  if (!registration) return null;
  return (await registration.pushManager.getSubscription()) ?? null;
}

/**
 * État réel des notifications pour cet appareil : on ne déclare « activées »
 * que si l'abonnement existe côté navigateur ET côté serveur.
 */
export async function getPushState(userId: string | undefined): Promise<PushState> {
  if (!pushSupported()) {
    return isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported";
  }
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return "prompt";
  if (!userId) return "disabled";

  const subscription = await currentSubscription();
  if (!subscription) return "disabled";

  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", userId)
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();

  if (data) return "enabled";

  // Abonnement local orphelin (expiré ou effacé côté serveur) : on le nettoie.
  await subscription.unsubscribe().catch(() => undefined);
  return "disabled";
}

/** Demande la permission, s'abonne au push et enregistre l'appareil. */
export async function enablePush(userId: string): Promise<void> {
  if (isIOS() && !isStandalone()) {
    throw new Error("Ajoutez d'abord Relink à votre écran d'accueil pour activer les notifications.");
  }
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

  // Un appareil ne doit jamais rester rattaché à un autre compte.
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);

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
  const subscription = await currentSubscription();
  if (subscription) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe().catch(() => undefined);
  }
  await supabase.from("profiles").update({ push_enabled: false }).eq("id", userId);
}

/**
 * Déconnexion : on retire l'abonnement de cet appareil pour qu'un téléphone
 * partagé ne reçoive plus les notifications du compte précédent.
 */
export async function cleanupPushOnSignOut(): Promise<void> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe().catch(() => undefined);
  } catch {
    /* la déconnexion ne doit jamais échouer à cause du push */
  }
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
