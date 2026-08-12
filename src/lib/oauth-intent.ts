/**
 * Mémorise le type de compte choisi avant une redirection OAuth.
 * Stocké côté navigateur uniquement : il sert d'indication, jamais de preuve.
 * Le rôle final est décidé et vérifié côté serveur (voir oauth-account.functions.ts).
 */
export type OAuthIntentRole = "client" | "driver";

const KEY = "relink.oauth.intent";

type StoredIntent = { role: OAuthIntentRole; next?: string; at: number };

export function setOAuthIntent(role: OAuthIntentRole, next?: string) {
  if (typeof window === "undefined") return;
  const payload: StoredIntent = { role, at: Date.now() };
  if (next && next.startsWith("/")) payload.next = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* stockage indisponible : l'inscription retombera sur le rôle client par défaut */
  }
}

export function readOAuthIntent(): StoredIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIntent;
    if (parsed.role !== "client" && parsed.role !== "driver") return null;
    // Expire après 30 minutes.
    if (!parsed.at || Date.now() - parsed.at > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOAuthIntent() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
