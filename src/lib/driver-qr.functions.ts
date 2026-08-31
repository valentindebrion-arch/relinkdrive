import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Lien public et QR code du chauffeur connecté. */
export const getMyPublicLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("driver_profiles")
      .select("slug, verification_status, page_published")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data?.slug) {
      return { available: false as const, status: "incomplete" as const };
    }

    let origin = "https://relinkdrive.lovable.app";
    try {
      origin = new URL(getRequest().url).origin;
    } catch {
      /* origine par défaut */
    }

    return { available: true as const, url: `${origin}/chauffeur/${data.slug}` };
  });
