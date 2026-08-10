import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, MapPin, Navigation, Clock, User, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTime, formatEuro } from "@/lib/labels";
import { CompleteRideDialog } from "@/components/CompleteRideDialog";
import { NotifyClientSmsButton, NotifyClientSmsDialog } from "@/components/NotifyClientSms";
import { getServerNow, startRide } from "@/lib/ride-start.functions";
import { formatHour, startWindowOpensAt } from "@/lib/ride-start";

const ACTIVE_STATUSES = ["confirmed", "driver_enroute", "driver_arrived", "client_onboard", "in_progress"] as const;

const STEPS = [
  { status: "driver_enroute", label: "En route chez le client", action: "Je pars chez le client" },
  { status: "driver_arrived", label: "Arrivé", action: "Je suis arrivé" },
  { status: "client_onboard", label: "Prise en charge", action: "Client à bord" },
  { status: "in_progress", label: "Fin de course", action: "Démarrer la course" },
  { status: "completed", label: "Terminé", action: "Terminer la course" },
];

export function ActiveRidePanel({ showEmpty = false, className }: { showEmpty?: boolean; className?: string } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [, setTick] = useState(0);
  const start = useServerFn(startRide);
  const serverTime = useServerFn(getServerNow);

  /** Décalage entre l'horloge du téléphone et l'heure serveur (référence). */
  const clock = useQuery({
    queryKey: ["server-now"],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const res = await serverTime({});
      return new Date(res.nowIso).getTime() - Date.now();
    },
  });
  const offset = clock.data ?? 0;

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);


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
  if (!r)
    return showEmpty ? (
      <div className="surface p-6 text-center text-sm text-muted-foreground">Aucune course en cours</div>
    ) : null;

  const currentIndex = STEPS.findIndex((s) => s.status === r.status);
  const nextStep = STEPS[currentIndex + 1] ?? (r.status === "confirmed" ? STEPS[0] : null);

  const opensAt = startWindowOpensAt(r.scheduled_at);
  const serverNow = new Date(Date.now() + offset);
  const startAllowed = serverNow >= opensAt;
  const isLate = serverNow > new Date(r.scheduled_at) && !r.started_at;

  async function advance(status: string) {
    if (!r) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("rides")
      .update({
        status: status as never,
        ...(status === "completed" ? { completed_at: now } : {}),
      })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("ride_status_history").insert({ ride_id: r.id, status: status as never, changed_by: user!.id });
    toast.success("Statut mis à jour");
    refresh();
  }

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["driver-active-ride"] });
    void qc.invalidateQueries({ queryKey: ["driver-rides"] });
    void qc.invalidateQueries({ queryKey: ["planning"] });
    void qc.invalidateQueries({ queryKey: ["pro-overview"] });
  }

  async function doStart() {
    if (!r || starting) return;
    setStarting(true);
    try {
      await start({ data: { rideId: r.id } });
      toast.success("Course démarrée");
      setConfirmStart(false);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Démarrage impossible");
    } finally {
      setStarting(false);
    }
  }


  return (
    <section className={`surface mb-6 overflow-hidden border-2 border-primary/50 p-0 shadow-lg shadow-primary/10 ${className ?? ""}`}>
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

        {isLate ? (
          <p className="flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-medium text-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            Heure de prise en charge dépassée ({formatHour(new Date(r.scheduled_at))}) — la course n'est pas démarrée.
          </p>
        ) : null}

        {nextStep ? (
          nextStep.status === "in_progress" ? (
            <div className="space-y-1.5">
              <Button
                size="lg"
                className="w-full text-base"
                disabled={!startAllowed || starting}
                onClick={() => setConfirmStart(true)}
              >
                {nextStep.action}
              </Button>
              {!startAllowed ? (
                <p className="text-center text-xs text-muted-foreground">
                  Disponible à partir de {formatHour(opensAt)}
                </p>
              ) : null}
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full text-base"
              onClick={() => (nextStep.status === "completed" ? setCompleting(true) : advance(nextStep.status))}
            >
              {nextStep.action}
            </Button>
          )
        ) : null}
      </div>

      <AlertDialog open={confirmStart} onOpenChange={(o) => (starting ? null : setConfirmStart(o))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Le client est-il bien pris en charge ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'heure prévue ({formatHour(new Date(r.scheduled_at))}) reste inchangée ; seule l'heure réelle de
              démarrage est enregistrée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={starting}
              onClick={(e) => {
                e.preventDefault();
                void doStart();
              }}
            >
              {starting ? "Démarrage…" : "Confirmer le démarrage"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompleteRideDialog ride={r} open={completing} onOpenChange={setCompleting} />

    </section>
  );
}
