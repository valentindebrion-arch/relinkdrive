import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  DEFAULT_BRANDING,
  getBookingTheme,
  normalizeBookingTheme,
  type BookingThemeId,
  type DriverBranding,
} from "@/lib/booking-themes";

/**
 * Récupère le thème public d'un chauffeur (lien direct, QR code, réservation).
 * Toute valeur invalide ou absente retombe sur le thème ReLink classique.
 */
export function useDriverBranding(opts: { driverId?: string | null; slug?: string | null }) {
  const driverId = opts.driverId ?? null;
  const slug = opts.slug ?? null;
  return useQuery({
    queryKey: ["driver-branding", driverId, slug],
    enabled: !!driverId || !!slug,
    staleTime: 60_000,
    queryFn: async (): Promise<DriverBranding> => {
      const args = {
        ...(driverId ? { _driver: driverId } : {}),
        ...(slug ? { _slug: slug } : {}),
      };
      const { data, error } = await supabase.rpc("get_driver_booking_theme", args);
      if (error) return DEFAULT_BRANDING;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return DEFAULT_BRANDING;
      return {
        themeId: normalizeBookingTheme(row.booking_theme),
        displayName: row.brand_display_name ?? null,
        logoPath: row.brand_logo_path ?? null,
        coverPath: row.brand_cover_path ?? null,
        welcomeMessage: row.brand_welcome_message ?? null,
      };
    },
  });
}

export function useBrandingImage(path?: string | null) {
  return useSignedUrl("branding", path ?? undefined).data ?? null;
}

/** Applique les variables du thème sur un conteneur : aucun composant n'est dupliqué. */
export function BookingThemeScope({
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
  const resolved = getBookingTheme(theme);
  return (
    <div
      data-booking-theme={resolved.id}
      className={cn("bg-background text-foreground", className)}
      style={{ ...(resolved.vars as CSSProperties), ...style }}
    >
      {children}
    </div>
  );
}

/** Mention ReLink obligatoire et non supprimable par le chauffeur. */
export function PoweredByRelink({ className }: { className?: string | undefined }) {
  return (
    <p className={cn("py-4 text-center text-xs text-muted-foreground", className)}>
      Propulsé par <span className="font-semibold">ReLink</span>
    </p>
  );
}
