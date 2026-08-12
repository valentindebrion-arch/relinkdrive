import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Finalise un compte issu d'une connexion OAuth (Google).
 * Idempotent : ne crée jamais de doublon et ne modifie jamais le rôle
 * d'un utilisateur qui en possède déjà un.
 */
export const finalizeOAuthAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { intent?: "client" | "driver" } | undefined) =>
    z
      .object({ intent: z.enum(["client", "driver"]).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const claims = context.claims as Record<string, unknown>;
    const meta = (claims["user_metadata"] ?? {}) as Record<string, unknown>;
    const email = typeof claims["email"] === "string" ? (claims["email"] as string) : null;
    const fullName =
      (typeof meta["full_name"] === "string" && meta["full_name"]) ||
      (typeof meta["name"] === "string" && meta["name"]) ||
      (email ? email.split("@")[0] : "") ||
      "";
    const avatar =
      (typeof meta["avatar_url"] === "string" && (meta["avatar_url"] as string)) ||
      (typeof meta["picture"] === "string" && (meta["picture"] as string)) ||
      null;

    // 1. Profil (créé normalement par le trigger d'inscription) — filet de sécurité.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, status")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, full_name: fullName, email, avatar_url: avatar }, { onConflict: "id" });
      if (error) throw new Error(error.message);
    } else {
      const patch: { full_name?: string; avatar_url?: string } = {};
      if (!profile.full_name && fullName) patch.full_name = fullName;
      if (!profile.avatar_url && avatar) patch.avatar_url = avatar;
      if (Object.keys(patch).length) {
        await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
      }
    }

    if (profile?.status && profile.status !== "active") {
      return { status: "suspended" as const, role: null, needsProfile: false, driverStatus: null };
    }

    // 2. Rôles : on ne touche jamais à un rôle existant.
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    let roles = (existingRoles ?? []).map((r) => r.role as string);

    if (roles.length === 0) {
      const role = data.intent === "driver" ? "driver" : "client";
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
      roles = [role];
    }

    const isAdmin = roles.includes("admin") || roles.includes("superadmin");
    const isDriver = roles.includes("driver");

    // 3. Amorce de dossier chauffeur (jamais vérifié automatiquement).
    let driverStatus: string | null = null;
    if (isDriver) {
      const { data: dp } = await supabaseAdmin
        .from("driver_profiles")
        .select("user_id, verification_status")
        .eq("user_id", userId)
        .maybeSingle();
      if (!dp) {
        const slug = `chauffeur-${userId.replace(/-/g, "").slice(0, 8)}`;
        const { error } = await supabaseAdmin
          .from("driver_profiles")
          .upsert({ user_id: userId, slug }, { onConflict: "user_id" });
        if (error) throw new Error(error.message);
        driverStatus = "incomplete";
      } else {
        driverStatus = dp.verification_status;
      }
    }

    // 4. Informations obligatoires manquantes côté client.
    const { data: fresh } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();
    const needsProfile = !fresh?.full_name?.trim() || !fresh?.phone?.trim();

    const role = isAdmin ? "admin" : isDriver ? "driver" : "client";
    return { status: "ok" as const, role, needsProfile, driverStatus };
  });
