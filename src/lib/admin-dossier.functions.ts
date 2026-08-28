import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Dossier complet d'un chauffeur, réservé aux administrateurs. */
export const getDriverDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ driverId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const mod = await import("@/lib/admin-dossier.server");
    await mod.assertAdmin(context.userId);
    const dossier = await mod.loadDossier(data.driverId);
    await mod.logAdminAction(context.userId, "dossier_viewed", "driver_profiles", data.driverId);
    return dossier;
  });

/** URL signée de très courte durée pour consulter ou télécharger une pièce. */
export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ documentId: z.string().uuid(), download: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("@/lib/admin-dossier.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await mod.assertAdmin(context.userId);

    const { data: doc } = await supabaseAdmin
      .from("verification_documents")
      .select("id, driver_id, doc_type, file_path")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc?.file_path) throw new Error("Document introuvable");

    const signed = await supabaseAdmin.storage
      .from(mod.DOCUMENTS_BUCKET)
      .createSignedUrl(doc.file_path, mod.SIGNED_URL_TTL, data.download ? { download: true } : {});
    if (signed.error || !signed.data) throw new Error("Lien temporaire indisponible");

    await mod.logAdminAction(
      context.userId,
      data.download ? "dossier_document_downloaded" : "dossier_document_viewed",
      "verification_documents",
      doc.id,
      { doc_type: doc.doc_type, driver_id: doc.driver_id },
    );
    return { url: signed.data.signedUrl, expiresIn: mod.SIGNED_URL_TTL };
  });

/** Réauthentification renforcée avant toute action sensible. */
export const confirmAdminReauth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ password: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const mod = await import("@/lib/admin-dossier.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await mod.assertAdmin(context.userId);

    const email = (context.claims as { email?: string }).email;
    if (!email) throw new Error("Compte administrateur sans adresse e-mail");

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const check = createClient(url, key, {
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { error } = await check.auth.signInWithPassword({ email, password: data.password });
    if (error) throw new Error("Mot de passe incorrect");
    await check.auth.signOut();

    await supabaseAdmin.from("admin_reauth_events").insert({ admin_id: context.userId });
    await mod.logAdminAction(context.userId, "admin_reauth_confirmed", "profiles", context.userId);
    return { ok: true, validForMinutes: mod.REAUTH_WINDOW_MINUTES };
  });

/** Archive ZIP structurée du dossier, protégée par réauthentification. */
export const exportDossierArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ driverId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("@/lib/admin-dossier.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await mod.assertAdmin(context.userId);

    if (!(await mod.hasRecentReauth(context.userId))) {
      throw new Error("Réauthentification requise avant l'export");
    }

    const { zipped, fileName, count } = await mod.buildDossierArchive(data.driverId);
    const path = `${data.driverId}/${Date.now()}-${fileName}`;
    const upload = await supabaseAdmin.storage
      .from(mod.EXPORTS_BUCKET)
      .upload(path, zipped, { contentType: "application/zip", upsert: true });
    if (upload.error) throw new Error("Génération de l'archive impossible");

    const signed = await supabaseAdmin.storage
      .from(mod.EXPORTS_BUCKET)
      .createSignedUrl(path, mod.EXPORT_URL_TTL, { download: fileName });
    if (signed.error || !signed.data) throw new Error("Lien de téléchargement indisponible");

    await mod.logAdminAction(context.userId, "dossier_exported", "driver_profiles", data.driverId, {
      files: count,
      reason: data.reason ?? null,
    });
    void mod.cleanupOldExports();

    return { url: signed.data.signedUrl, fileName, files: count, expiresIn: mod.EXPORT_URL_TTL };
  });

/** PDF complet du dossier, généré à la demande côté serveur (aucune URL permanente). */
export const generateDossierPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ driverId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const mod = await import("@/lib/admin-dossier.server");
    await mod.assertAdmin(context.userId);
    const { buildDossierPdf } = await import("@/lib/dossier-pdf.server");
    const { bytes, fileName } = await buildDossierPdf(data.driverId);
    await mod.logAdminAction(context.userId, "dossier_pdf_generated", "driver_profiles", data.driverId, {
      file_name: fileName,
      bytes: bytes.byteLength,
    });
    return { fileName, base64: Buffer.from(bytes).toString("base64") };
  });

/** Liste des demandes d'inscription chauffeur transmises à ReLink. */
export const listDriverApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("@/lib/admin-dossier.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await mod.assertAdmin(context.userId);

    const { data: drivers } = await supabaseAdmin
      .from("driver_profiles")
      .select(
        "user_id, verification_status, driver_kind, vtc_card_number, taxi_license_number, submitted_at, approved_at, created_at",
      )
      .neq("verification_status", "incomplete")
      .order("submitted_at", { ascending: false, nullsFirst: false });

    const ids = (drivers ?? []).map((d) => d.user_id);
    const profiles = ids.length
      ? ((await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", ids)).data ?? [])
      : [];

    return (drivers ?? []).map((d) => {
      const p = profiles.find((x) => x.id === d.user_id);
      const full = (p?.full_name ?? "").trim();
      const parts = full.split(/\s+/).filter(Boolean);
      return {
        driverId: d.user_id,
        fullName: full || "Chauffeur ReLink",
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
        kind: d.driver_kind ?? "vtc",
        number: (d.driver_kind === "taxi" ? d.taxi_license_number : d.vtc_card_number) ?? null,
        status: d.verification_status as string,
        submittedAt: d.submitted_at,
        approvedAt: d.approved_at,
      };
    });
  });
