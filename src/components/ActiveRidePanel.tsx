import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, MapPin, Navigation, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatEuro } from "@/lib/labels";

const ACTIVE_STATUSES = ["confirmed", "driver_enroute", "driver_arrived", "client_onboard", "in_progress"];

const STEPS = [
  { status: "driver_enroute", label: "En route chez le client", action: "Je pars chez le client" },
  { status: "driver_arrived", label: "Arrivé", action: "Je suis arrivé" },
  { status: "client_onboard", label: "Prise en charge", action: "Client à bord" },
  { status: "in_progress", label: "Fin de course", action: "Démarrer la course" },
  { status: "completed", label: "Terminé", action: "Terminer la course" },
];

export function ActiveRidePanel() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const ride = useQuery({
    queryKey: ["driver-active-ride", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user!.id)
        .eq("is_block", false)
        .in("status", ACTIVE_STATUSES)
        .order("scheduled_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const r = ride.data;
  if (!r) return null;

  const currentIndex = STEPS.findIndex((s) => s.status === r.status);
  const nextStep = STEPS[currentIndex + 1] ?? (r.status === "confirmed" ? STEPS[0] : null);

  async function advance(status: string) {
    if (!r) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("rides")
      .update({
        status: status as never,
        ...(status === "in_progress" ? { started_at: now } : {}),
        ...(status === "completed" ? { completed_at: now } : {}),
      })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("ride_status_history").insert({ ride_id: r.id, status: status as never, changed_by: user!.id });
    if (r.client_id) await supabase.rpc("notify_counterparty", { _recipient: r.client_id, _kind: "ride_update" });
    toast.success("Statut mis à jour");
    void qc.invalidateQueries({ queryKey: ["driver-active-ride"] });
    void qc.invalidateQueries({ queryKey: ["driver-rides"] });
    void qc.invalidateQueries({ queryKey: ["pro-overview"] });
  }

  return (
    <section className="surface mb-6 overflow-hidden border-primary/40 p-0">
      <div className="border-b border-border bg-primary/10 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Course en cours</p>
        <h2 className="mt-1 text-lg font-semibold">
          {r.client_label ?? "Client"} · {formatDateTime(r.scheduled_at)}
        </h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2 text-sm">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="break-words">{r.pickup_address}</span>
          </p>
          <p className="flex items-start gap-2">
            <Navigation className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="break-words">{r.dropoff_address}</span>
          </p>
          <p className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="size-4" /> {r.passengers}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-4" /> {r.price ? formatEuro(Number(r.price)) : "Prix à définir"}
            </span>
          </p>
        </div>

        <ol className="space-y-2">
          {STEPS.map((s, i) => {
            const done = currentIndex >= i;
            const active = currentIndex + 1 === i || (r.status === "confirmed" && i === 0);
            return (
              <li key={s.status} className="flex items-center gap-3">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={`text-sm ${done || active ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>

        {nextStep ? (
          <Button size="lg" className="w-full text-base" onClick={() => advance(nextStep.status)}>
            {nextStep.action}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
