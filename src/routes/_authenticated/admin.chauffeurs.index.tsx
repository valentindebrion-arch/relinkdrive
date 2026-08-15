import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { VERIFICATION_LABELS, DOCUMENT_LABELS, DOC_STATUS_LABELS, formatDate } from "@/lib/labels";
import { fetchDossierState, SECTION_STATE_LABELS, type DossierState } from "@/lib/driver-dossier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/chauffeurs/")({
  component: AdminDrivers,
});

const FILTERS = ["pending", "under_review", "changes_requested", "expired_documents", "verified", "all"];

function AdminDrivers() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");
  const [note, setNote] = useState<Record<string, string>>({});

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["admin", "drivers", filter],
    queryFn: async () => {
      let q = supabase.from("driver_profiles").select("*").order("updated_at", { ascending: false });
      if (filter !== "all") q = q.eq("verification_status", filter as never);
      const { data, error } = await q;
      if (error) throw error;
      const ids = (data ?? []).map((d) => d.user_id);
      const [{ data: profiles }, { data: docs }] = await Promise.all([
        ids.length ? supabase.from("profiles").select("id, full_name, email, phone, status").in("id", ids) : { data: [] },
        ids.length ? supabase.from("verification_documents").select("*").in("driver_id", ids) : { data: [] },
      ]);
      const states = await Promise.all(
        ids.map(async (id) => {
          try {
            return [id, await fetchDossierState(id)] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      const stateMap = new Map<string, DossierState | null>(states);
      return (data ?? []).map((d) => ({
        ...d,
        profile: (profiles ?? []).find((p) => p.id === d.user_id) ?? null,
        docs: (docs ?? []).filter((doc) => doc.driver_id === d.user_id),
        dossier: stateMap.get(d.user_id) ?? null,
      }));
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      userId,
      decision,
      reason,
    }: {
      userId: string;
      decision: "approve" | "changes" | "reject" | "suspend" | "reinstate";
      reason?: string | undefined;
    }) => {
      const { error } = await supabase.rpc("admin_decide_driver", {
        _driver: userId,
        _decision: decision,
        _reason: reason ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const reviewDoc = useMutation({
    mutationFn: async ({
      id,
      status,
      note: reviewNote,
    }: {
      id: string;
      status: "approved" | "rejected";
      note?: string | undefined;
    }) => {
      const { error } = await supabase.rpc("admin_review_document", {
        _document: id,
        _decision: status,
        _note: reviewNote ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "drivers"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div>
      <PageHeader
        title="Vérification des chauffeurs"
        description="Contrôlez les dossiers pièce par pièce et autorisez l'activation des comptes professionnels."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-sm ${filter === f ? "border-primary bg-accent" : "border-border text-muted-foreground"}`}
          >
            {f === "all" ? "Tous" : (VERIFICATION_LABELS[f] ?? f)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !drivers?.length ? (
        <EmptyState title="Aucun dossier" description="Aucun chauffeur ne correspond à ce filtre." />
      ) : (
        <div className="space-y-4">
          {drivers.map((d) => (
            <div key={d.user_id} className="surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{d.profile?.full_name || d.business_name || "Chauffeur"}</p>
                  <p className="text-sm text-muted-foreground">
                    {d.profile?.email ?? "—"} · {d.profile?.phone ?? "—"} · {d.city ?? "Ville non renseignée"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SIRET {d.siret || "—"} · Carte VTC {d.vtc_card_number || "—"} · /chauffeur/{d.slug}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={d.verification_status} labels={VERIFICATION_LABELS} />
                  <Button asChild size="sm" variant="outline">
                    <Link to="/admin/chauffeurs/$driverId" params={{ driverId: d.user_id }}>
                      Consulter le dossier
                    </Link>
                  </Button>
                </div>
              </div>


              {d.dossier ? (
                <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Dossier complété à {d.dossier.percent} %
                  </p>
                  {d.dossier.sections.map((s) => (
                    <div key={s.key} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                      <span>{s.label}</span>
                      <span
                        className={
                          s.state === "approved"
                            ? "text-primary"
                            : s.state === "todo"
                              ? "text-muted-foreground"
                              : "text-destructive"
                        }
                      >
                        {SECTION_STATE_LABELS[s.state]}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                {d.docs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun document déposé.</p>
                ) : (
                  d.docs.map((doc) => (
                    <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <div className="text-sm">
                        <span className="font-medium">{DOCUMENT_LABELS[doc.doc_type] ?? doc.doc_type}</span>
                        <span className="text-muted-foreground"> · expire le {formatDate(doc.expires_at)}</span>
                        {!doc.file_path ? (
                          <span className="block text-xs text-destructive">Document non transmis</span>
                        ) : null}
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <StatusBadge status={doc.status} labels={DOC_STATUS_LABELS} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary text-primary hover:bg-accent"
                          disabled={!doc.file_path}
                          onClick={() => setViewer({ ...doc, driverName: d.profile?.full_name ?? d.business_name ?? null })}
                        >
                          <Eye className="size-4" /> Voir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!doc.file_path}
                          aria-label="Télécharger"
                          onClick={() => void downloadDoc(doc.id)}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!doc.file_path}
                          onClick={() => reviewDoc.mutate({ id: doc.id, status: "approved" })}
                        >
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => reviewDoc.mutate({ id: doc.id, status: "rejected", note: note[d.user_id] })}
                        >
                          Refuser
                        </Button>
                      </div>
                    </div>
                  ))

                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Motif communiqué au chauffeur"
                  value={note[d.user_id] ?? ""}
                  onChange={(e) => setNote((n) => ({ ...n, [d.user_id]: e.target.value }))}
                  className="max-w-xs"
                />
                <Button
                  size="sm"
                  disabled={!d.dossier?.all_approved}
                  title={d.dossier?.all_approved ? undefined : "Toutes les pièces doivent être validées"}
                  onClick={() => decide.mutate({ userId: d.user_id, decision: "approve" })}
                >
                  Valider le compte
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide.mutate({ userId: d.user_id, decision: "changes", reason: note[d.user_id] })}
                >
                  Demander une correction
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => decide.mutate({ userId: d.user_id, decision: "reject", reason: note[d.user_id] })}
                >
                  Refuser
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => decide.mutate({ userId: d.user_id, decision: "suspend", reason: note[d.user_id] })}
                >
                  Suspendre
                </Button>
                {d.verification_status === "suspended" ? (
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ userId: d.user_id, decision: "reinstate" })}>
                    Réactiver
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
