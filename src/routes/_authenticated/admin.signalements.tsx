import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { REPORT_LABELS, REPORT_TYPES, formatDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/signalements")({
  component: AdminReports,
});

const STATUSES = ["new", "in_progress", "waiting", "resolved", "closed"] as const;

function AdminReports() {
  const qc = useQueryClient();
  const [resolution, setResolution] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      status,
      text,
    }: {
      id: string;
      status: (typeof STATUSES)[number];
      text?: string | undefined;
    }) => {
      const { error } = await supabase
        .from("reports")
        .update({ status, resolution: text ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Signalement mis à jour");
      void qc.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div>
      <PageHeader
        title="Signalements"
        description="Incidents remontés par les chauffeurs et les passagers."
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !data?.length ? (
        <EmptyState title="Aucun signalement" description="Rien à traiter pour le moment." />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <div key={r.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{REPORT_TYPES[r.type] ?? r.type}</p>
                  <p className="text-sm text-muted-foreground">
                    Priorité {r.priority} · {formatDateTime(r.created_at)}
                  </p>
                  {r.description ? <p className="mt-2 text-sm">{r.description}</p> : null}
                </div>
                <StatusBadge status={r.status} labels={REPORT_LABELS} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Résolution"
                  value={resolution[r.id] ?? r.resolution ?? ""}
                  onChange={(e) => setResolution((s) => ({ ...s, [r.id]: e.target.value }))}
                  className="max-w-xs"
                />
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="ghost"
                    onClick={() => update.mutate({ id: r.id, status: s, text: resolution[r.id] })}
                  >
                    {REPORT_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
