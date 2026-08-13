import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Le QR code et le lien direct n'existent côté serveur qu'après validation
 * administrative : rien n'est retourné tant que le compte n'est pas actif.
 */
export const getMyPublicLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("driver_profiles")
      .select("slug, verification_status, page_published")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data || data.verification_status !== "verified" || !data.page_published) {
      return { available: false as const, status: data?.verification_status ?? "incomplete" };
    }

    let origin = "https://relinkdrive.lovable.app";
    try {
      origin = new URL(getRequest().url).origin;
    } catch {
      /* origine par défaut */
    }

    return { available: true as const, url: `${origin}/chauffeur/${data.slug}` };
  });
