/**
 * Traçage anonyme des visites de vitrine chauffeur.
 *
 * Aucune donnée personnelle n'est stockée : uniquement une clé aléatoire de
 * navigateur, utilisée côté serveur pour dédoublonner les vues (fenêtre de
 * 30 minutes) et estimer les visiteurs uniques.
 */
import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "relink:visitor-key";

/** Origines de visite connues (extensible : instagram, whatsapp…). */
export const VISIT_SOURCES = ["qr", "discovery", "share", "direct"] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

export function normalizeSource(value: unknown): VisitSource {
  return typeof value === "string" && (VISIT_SOURCES as readonly string[]).includes(value)
    ? (value as VisitSource)
    : "direct";
}

/** Clé anonyme et stable par navigateur. */
export function visitorKey(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return "anon";
  }
}

/** Origine déduite de l'URL courante (`?src=`). */
export function currentSource(): VisitSource {
  if (typeof window === "undefined") return "direct";
  return normalizeSource(new URLSearchParams(window.location.search).get("src"));
}

/**
 * Enregistre un événement de visibilité. Le serveur ignore l'événement quand
 * le chauffeur consulte sa propre vitrine et déduplique les doublons.
 */
const inFlight = new Set<string>();

export async function trackDriverVisit(
  slug: string,
  event: "driver_page_view" | "qr_scan" | "contact_click",
  source: VisitSource = currentSource(),
) {
  // Anti double-envoi côté client (double rendu React, double clic).
  const key = `${slug}:${event}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  window.setTimeout(() => inFlight.delete(key), 5000);
  try {
    await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: unknown }>
    )("track_driver_visit", {
      _slug: slug,
      _event: event,
      _source: source,
      _visitor_key: visitorKey(),
    });
  } catch {
    /* le traçage ne doit jamais bloquer la navigation */
  }
}
