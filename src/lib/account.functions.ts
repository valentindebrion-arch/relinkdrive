import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Nom trop court").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+ ().-]*$/, "Numéro de téléphone invalide")
    .optional()
    .default(""),
  // Donnée strictement déclarative, jamais déduite d'une autre information.
  gender: z.enum(["female", "male", "undisclosed"]).nullable().optional(),
});

/** Met à jour le profil de l'utilisateur connecté uniquement (RLS appliquée). */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Le genre est définitif : on ne le transmet que s'il n'a jamais été renseigné.
    const { data: current } = await context.supabase
      .from("profiles")
      .select("gender")
      .eq("id", context.userId)
      .maybeSingle();
    const genderLocked = !!current?.gender;
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
        ...(!genderLocked && data.gender !== undefined && data.gender !== null
          ? { gender: data.gender }
          : {}),
      })
      .eq("id", context.userId);
    if (error) {
      if (/gender_already_set/i.test(error.message)) {
        throw new Error("Votre genre a déjà été enregistré et ne peut plus être modifié.");
      }
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

/** Enregistre une adresse personnelle du client connecté. */
export const saveMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().trim().min(1).max(40),
        address: z.string().trim().min(4).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("client_addresses")
      .insert({ client_id: context.userId, label: data.label, address: data.address });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Supprime une adresse personnelle appartenant au client connecté. */
export const deleteMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("client_addresses")
      .delete()
      .eq("id", data.id)
      .eq("client_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Demande de suppression du compte : le compte est immédiatement désactivé
 * (statut « deleted ») puis purgé selon les obligations légales de conservation.
 */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ confirmation: z.literal("SUPPRIMER") }).parse(input),
  )
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isPrivileged = (roles ?? []).some((r) => r.role === "admin" || r.role === "superadmin");
    if (isPrivileged) {
      throw new Error("Un compte d'administration ne peut pas être supprimé depuis l'application.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: "deleted" })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "account_deletion_requested",
      resource: "profiles",
      resource_id: context.userId,
      reason: "Demande de l'utilisateur depuis l'espace client",
    });

    return { ok: true as const };
  });
