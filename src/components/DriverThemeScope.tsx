/**
 * Identité visuelle du chauffeur appliquée aux composants publics le représentant
 * (cartes de l'annuaire, réseau client, QR code, partage).
 *
 * Une seule source : `driver_profiles.booking_theme`. Aucun composant n'est
 * dupliqué : seules les variables d'accent changent.
 */
import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { driverAccentVars, normalizeBookingTheme, type BookingThemeId } from "@/lib/booking-themes";

/** Thèmes de plusieurs chauffeurs en une requête (listes, carrousels). */
export function useDriverThemes(ids: (string | null | undefined)[]) {
  const clean = Array.from(new Set(ids.filter((v): v is string => !!v))).sort();
  return useQuery({
    queryKey: ["driver-themes", clean],
    enabled: clean.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, BookingThemeId>> => {
      const { data, error } = await supabase.rpc("get_driver_themes", { _ids: clean });
      if (error) return {};
      const out: Record<string, BookingThemeId> = {};
      for (const row of data ?? []) {
        out[row.user_id] = normalizeBookingTheme(row.booking_theme);
      }
      return out;
    },
  });
}

/** Applique uniquement les accents du chauffeur (fond et texte restent ReLink). */
export function DriverThemeScope({
  theme,
  className,
  style,
  children,
}: {
  theme?: BookingThemeId | string | null | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children: ReactNode;
}) {
  return (
    <div
      className={className ?? "contents"}
      style={{ ...(driverAccentVars(theme) as CSSProperties), ...style }}
    >
      {children}
    </div>
  );
}
