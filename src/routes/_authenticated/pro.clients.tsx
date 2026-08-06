import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { CRM_LABELS, formatDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/pro/clients")({
  component: DriverClients,
});

function DriverClients() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const clients = useQuery({
    queryKey: ["driver-clients", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: conns, error } = await supabase
        .from("driver_client_connections")
        .select("*")
        .eq("driver_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (conns ?? []).map((c) => c.client_id);
      if (!ids.length) return [];
      const [{ data: profiles }, { data: rides }, { data: notes }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, email").in("id", ids),
        supabase.from("rides").select("client_id, scheduled_at, price, status").eq("driver_id", user!.id),
        supabase.from("driver_notes").select("*").eq("driver_id", user!.id),
      ]);
      return (conns ?? []).map((c) => {
        const clientRides = (rides ?? []).filter((r) => r.client_id === c.client_id);
        return {
          ...c,
          profile: (profiles ?? []).find((p) => p.id === c.client_id),
          ridesCount: clientRides.length,
          lastRide: clientRides.sort((a, b) => (a.scheduled_at < b.scheduled_at ? 1 : -1))[0],
          note: (notes ?? []).find((n) => n.client_id === c.client_id),
        };
      });
    },
  });

  async function saveNote(clientId: string, existingId?: string) {
    const payload = { driver_id: user!.id, client_id: clientId, note: note };
    const { error } = existingId
      ? await supabase.from("driver_notes").update({ note }).eq("id", existingId)
      : await supabase.from("driver_notes").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNoteFor(null);
    setNote("");
    toast.success("Note enregistrée");
    void qc.invalidateQueries({ queryKey: ["driver-clients"] });
  }

  async function setCrm(id: string, crm_status: "new" | "active" | "regular" | "inactive") {
    await supabase.from("driver_client_connections").update({ crm_status }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["driver-clients"] });
  }

  const list = clients.data ?? [];

  return (
    <>
      <PageHeader title="Mes clients" description="Votre carnet de clients fidélisés." />
      {list.length === 0 ? (
        <EmptyState title="Aucun client" description="Partagez votre QR code après vos courses pour fidéliser vos clients." />
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <div key={c.id} className="surface p-3 sm:p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.profile?.full_name ?? "Client"}</p>
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">
                    {c.ridesCount} course(s)
                    {c.lastRide ? ` · dernière le ${formatDateTime(c.lastRide.scheduled_at)}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">Ajouté le {formatDateTime(c.created_at)}</p>
                  {c.note ? <p className="mt-1 line-clamp-2 text-xs">Note : {c.note.note}</p> : null}
                </div>
                <StatusBadge status={c.crm_status} labels={CRM_LABELS} />
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto">
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => setCrm(c.id, "regular")}>
                  Régulier
                </Button>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => setCrm(c.id, "inactive")}>
                  Inactif
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    setNoteFor(noteFor === c.client_id ? null : c.client_id);
                    setNote(c.note?.note ?? "");
                  }}
                >
                  Note
                </Button>
              </div>
              {noteFor === c.client_id ? (
                <div className="mt-3 space-y-2">
                  <Textarea value={note} maxLength={800} onChange={(e) => setNote(e.target.value)} placeholder="Préférences du client…" />
                  <Button size="sm" onClick={() => saveNote(c.client_id, c.note?.id)}>
                    Enregistrer
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
