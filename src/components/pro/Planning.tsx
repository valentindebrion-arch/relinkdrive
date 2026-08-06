import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function Planning() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [blockStart, setBlockStart] = useState("");
  const [blockLabel, setBlockLabel] = useState("");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)),
    [weekStart],
  );

  const rides = useQuery({
    queryKey: ["planning", user?.id, weekStart.toISOString()],
    enabled: !!user?.id,
    queryFn: async () => {
      const end = new Date(weekStart.getTime() + 7 * 86400000);
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user!.id)
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", end.toISOString())
        .order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addBlock() {
    if (!blockStart) return;
    const { error } = await supabase.from("rides").insert({
      driver_id: user!.id,
      client_id: null,
      is_block: true,
      client_label: blockLabel || "Indisponible",
      pickup_address: blockLabel || "Indisponibilité",
      dropoff_address: "—",
      scheduled_at: new Date(blockStart).toISOString(),
      status: "confirmed",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBlockStart("");
    setBlockLabel("");
    toast.success("Indisponibilité ajoutée");
    void qc.invalidateQueries({ queryKey: ["planning"] });
  }

  async function remove(id: string) {
    await supabase.from("rides").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["planning"] });
  }

  return (
    <>
      <PageHeader title="Planning" description="Votre semaine de courses et vos indisponibilités." />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))}>
          Semaine précédente
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          Cette semaine
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))}>
          Semaine suivante
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const items = (rides.data ?? []).filter(
            (r) => new Date(r.scheduled_at).toDateString() === day.toDateString(),
          );
          return (
            <div key={day.toISOString()} className="surface min-h-32 p-3">
              <p className="mb-2 text-xs font-semibold uppercase">
                {day.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <div className="space-y-2">
                {items.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border p-2 text-xs">
                    <p className="font-medium">
                      {new Date(r.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {r.is_block ? (
                      <>
                        <p className="text-muted-foreground">{r.client_label ?? "Indisponible"}</p>
                        <button onClick={() => remove(r.id)} className="mt-1 text-destructive">
                          Supprimer
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground">
                          {r.pickup_address} → {r.dropoff_address}
                        </p>
                        <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                      </>
                    )}
                  </div>
                ))}
                {items.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="surface mt-6 grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="bs">Bloquer un créneau</Label>
          <Input id="bs" type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="bl">Motif</Label>
          <Input id="bl" value={blockLabel} maxLength={80} onChange={(e) => setBlockLabel(e.target.value)} placeholder="Pause, entretien…" />
        </div>
        <div className="flex items-end">
          <Button onClick={addBlock}>Ajouter</Button>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Dernière mise à jour : {formatDateTime(new Date().toISOString())}
      </p>
    </>
  );
}
