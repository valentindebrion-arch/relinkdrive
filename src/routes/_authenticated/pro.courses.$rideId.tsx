import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Clock, CreditCard, MapPin, Navigation, Receipt, User, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { CompleteRideDialog } from "@/components/CompleteRideDialog";
import { NotifyClientSmsButton, NotifyClientSmsDialog } from "@/components/NotifyClientSms";
import type { SmsKind } from "@/lib/ride-sms";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";
import { getServerNow, startRide } from "@/lib/ride-start.functions";
import { formatHour, startWindowOpensAt } from "@/lib/ride-start";
import { decideRideCancellation, driverCancelRide } from "@/lib/ride-cancel.functions";
import { DRIVER_CANCEL_REASONS, driverCancelDeadline } from "@/lib/ride-cancel";

export const Route = createFileRoute("/_authenticated/pro/courses/$rideId")({
  head: () => ({
    meta: [
      { title: "Détail de la course — Relink Chauffeur" },
      {
        name: "description",
        content:
          "Suivi opérationnel d'une course Relink : statut, horaires, itinéraire, client, prix et démarrage de la course.",
      },
      { property: "og:title", content: "Détail de la course — Relink Chauffeur" },
      { property: "og:description", content: "Statut, horaires, itinéraire, client et démarrage de la course." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverRideDetail,
});

const STEPS = [
  { status: "driver_enroute", label: "En route chez le client", action: "Je pars chez le client" },
  { status: "driver_arrived", label: "Arrivé", action: "Je suis arrivé" },
  { status: "client_onboard", label: "Prise en charge", action: "Client à bord" },
  { status: "in_progress", label: "Fin de course", action: "Démarrer la course" },
  { status: "completed", label: "Terminé", action: "Terminer la course" },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte bancaire",
  transfer: "Virement",
  invoice: "Sur facture",
};

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

function DriverRideDetail() {
  const { rideId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [completing, setCompleting] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsKind, setSmsKind] = useState<SmsKind>("departure");
  const [advancing, setAdvancing] = useState(false);
  const [decision, setDecision] = useState<null | "accepted" | "refused">(null);
  const [deciding, setDeciding] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [, setTick] = useState(0);
  const start = useServerFn(startRide);
  const serverTime = useServerFn(getServerNow);
  const decide = useServerFn(decideRideCancellation);
  const cancelRide = useServerFn(driverCancelRide);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);

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

  const q = useQuery({
    queryKey: ["driver-ride", rideId, user?.id],
    enabled: !!user?.id && !!rideId,
    queryFn: async () => {
      const { data: ride, error } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .eq("driver_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!ride) return { ride: null, invoice: null, history: [] };

      const [{ data: invoice }, { data: history }] = await Promise.all([
        supabase.from("invoices").select("id, number, status").eq("ride_id", ride.id).maybeSingle(),
        supabase
          .from("ride_status_history")
          .select("status, created_at")
          .eq("ride_id", ride.id)
          .order("created_at", { ascending: true }),
      ]);
      return { ride, invoice, history: history ?? [] };
    },
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["driver-ride", rideId] });
    void qc.invalidateQueries({ queryKey: ["driver-active-ride"] });
    void qc.invalidateQueries({ queryKey: ["driver-rides"] });
    void qc.invalidateQueries({ queryKey: ["driver-planning"] });
    void qc.invalidateQueries({ queryKey: ["planning"] });
    void qc.invalidateQueries({ queryKey: ["pro-overview"] });
  }

  if (q.isLoading) return <div className="surface h-48 animate-pulse rounded-xl bg-muted/40" />;

  const ride = q.data?.ride;
  if (!ride) {
    return (
      <div className="space-y-3">
        <BackLink />
        <EmptyState
          title="Course introuvable"
          description="Cette course n'existe plus ou ne vous est pas attribuée."
        />
        <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/pro/planning" })}>
          Retour au planning
        </Button>
      </div>
    );
  }

  const invoice = q.data?.invoice;
  const history = q.data?.history ?? [];

  const currentIndex = STEPS.findIndex((s) => s.status === ride.status);
  const nextStep =
    ride.status === "confirmed" ? STEPS[0] : currentIndex >= 0 ? (STEPS[currentIndex + 1] ?? null) : null;

  const opensAt = startWindowOpensAt(ride.scheduled_at);
  const serverNow = new Date(Date.now() + offset);
  const startAllowed = serverNow >= opensAt;
  const isLate = serverNow > new Date(ride.scheduled_at) && !ride.started_at;

  const isFlash = ride.ride_type === "flash";
  /** Une course programmée n'ouvre ses étapes opérationnelles qu'à T - 1 h. */
  const tooEarly =
    !isFlash && ride.status === "confirmed" && !isImminent(ride.scheduled_at, serverNow);
  const remaining = countdownLabel(ride.scheduled_at, serverNow);

  const preStart = !ride.started_at && !ride.completed_at && ride.status !== "cancelled" && ride.status !== "completed";
  const pendingCancel = ride.cancel_request_status === "pending" && preStart;
  const cancelDeadline = driverCancelDeadline(ride.scheduled_at);
  const canSelfCancel = preStart && serverNow <= cancelDeadline;


  async function doDecide(value: "accepted" | "refused") {
    if (!ride || deciding) return;
    setDeciding(true);
    try {
      await decide({ data: { rideId: ride.id, decision: value } });
      toast.success(value === "accepted" ? "Annulation acceptée" : "Demande refusée");
      setDecision(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setDeciding(false);
    }
  }

  async function doDriverCancel() {
    if (!ride || cancelling) return;
    setCancelling(true);
    try {
      await cancelRide({
        data: cancelReason ? { rideId: ride.id, reason: cancelReason } : { rideId: ride.id },
      });
      toast.success("Course annulée, le client est informé");
      setCancelOpen(false);
      setCancelReason("");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Annulation impossible");
    } finally {
      setCancelling(false);
    }
  }


  async function advance(status: string) {
    if (!ride || advancing) return;
    setAdvancing(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("rides")
        .update({ status: status as never, ...(status === "completed" ? { completed_at: now } : {}) })
        .eq("id", ride.id)
        .eq("status", ride.status);
      if (error) {
        toast.error(error.message);
        return;
      }
      await supabase
        .from("ride_status_history")
        .insert({ ride_id: ride.id, status: status as never, changed_by: user!.id });
      toast.success("Statut mis à jour");
      refresh();
      if (status === "driver_enroute" || status === "driver_arrived") {
        setSmsKind(status === "driver_arrived" ? "arrival" : "departure");
        setSmsOpen(true);
      }
    } finally {
      setAdvancing(false);
    }
  }

  async function doStart() {
    if (!ride || starting) return;
    setStarting(true);
    try {
      await start({ data: { rideId: ride.id } });
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
    <div className="space-y-3 overflow-x-hidden pb-6">
      <BackLink />

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">Détail de la course</h1>
          <p className="truncate text-sm text-muted-foreground">{formatDateTime(ride.scheduled_at)}</p>
        </div>
        <StatusBadge status={ride.status} labels={RIDE_STATUS_LABELS} />
      </header>

      <div className="surface p-4">
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="size-2.5 rounded-full bg-primary" />
            <span className="my-1 w-px flex-1 bg-border" />
            <span className="size-2.5 rounded-full border-2 border-primary" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Départ</p>
              <p className="text-sm font-medium break-words">{ride.pickup_address}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Arrivée</p>
              <p className="text-sm font-medium break-words">{ride.dropoff_address}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="surface divide-y p-4">
        <Row icon={Clock} label="Date et heure prévues" value={formatDateTime(ride.scheduled_at)} />
        {ride.started_at ? <Row icon={Clock} label="Démarrage réel" value={formatDateTime(ride.started_at)} /> : null}
        {ride.completed_at ? (
          <Row icon={Clock} label="Fin de course" value={formatDateTime(ride.completed_at)} />
        ) : null}
        <Row icon={User} label="Client" value={`${ride.client_label ?? "Client"} · ${ride.passengers} passager(s)`} />
        <Row
          icon={MapPin}
          label="Prix"
          value={ride.price ? formatEuro(Number(ride.price)) : "Estimation à confirmer"}
        />
        {ride.payment_method ? (
          <Row
            icon={CreditCard}
            label="Mode de paiement"
            value={PAYMENT_LABELS[ride.payment_method] ?? ride.payment_method}
          />
        ) : null}
        {ride.notes ? <Row icon={Navigation} label="Informations complémentaires" value={ride.notes} /> : null}
      </div>

      {pendingCancel ? (
        <div className="rounded-xl border border-warning/50 bg-warning/10 p-4">
          <p className="text-sm font-semibold">Demande d'annulation du client</p>
          {ride.cancel_request_reason ? (
            <p className="mt-1 text-xs text-muted-foreground break-words">
              Motif indiqué : {ride.cancel_request_reason}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            La course reste confirmée et le créneau réservé tant que vous n'avez pas répondu.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={deciding} onClick={() => setDecision("refused")}>
              Refuser l'annulation
            </Button>
            <Button
              variant="destructive"
              disabled={deciding}
              onClick={() => setDecision("accepted")}
            >
              Accepter l'annulation
            </Button>
          </div>
        </div>
      ) : null}

      {ride.status === "cancelled" ? (
        <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          Course annulée{ride.cancelled_at ? ` le ${formatDateTime(ride.cancelled_at)}` : ""}. Elle reste consultable
          dans votre historique.
        </p>
      ) : null}



      {isLate ? (
        <p className="flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-medium">
          <AlertTriangle className="size-4 shrink-0" />
          Heure de prise en charge dépassée ({formatHour(new Date(ride.scheduled_at))}) — la course n'est pas démarrée.
        </p>
      ) : null}

      {nextStep ? (
        <div className="space-y-1.5">
          {nextStep.status === "in_progress" ? (
            <>
              <Button
                size="lg"
                className="w-full text-base"
                disabled={!startAllowed || starting}
                onClick={() => setConfirmStart(true)}
              >
                Démarrer la course
              </Button>
              {!startAllowed ? (
                <p className="text-center text-xs text-muted-foreground">
                  Disponible à partir de {formatHour(opensAt)}
                </p>
              ) : null}
            </>
          ) : (
            <Button
              size="lg"
              className="w-full text-base"
              disabled={advancing}
              onClick={() => (nextStep.status === "completed" ? setCompleting(true) : advance(nextStep.status))}
            >
              {nextStep.action}
            </Button>
          )}
        </div>
      ) : null}

      {ride.status === "driver_enroute" || ride.status === "driver_arrived" ? (
        <NotifyClientSmsButton rideId={ride.id} kind={ride.status === "driver_arrived" ? "arrival" : "departure"} />
      ) : null}

      <NotifyClientSmsDialog rideId={ride.id} kind={smsKind} open={smsOpen} onOpenChange={setSmsOpen} />

      {preStart ? (
        canSelfCancel ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="size-4" />
            Annuler la course
          </Button>
        ) : (
          <p className="rounded-xl bg-muted p-3 text-center text-xs text-muted-foreground">
            L'annulation autonome n'est plus disponible moins de 30 minutes avant la prise en charge (limite{" "}
            {formatHour(cancelDeadline)}). Contactez l'assistance.
          </p>
        )
      ) : null}



      {invoice ? (
        <Button asChild variant="outline" className="w-full gap-2">
          <Link to="/pro/factures">
            <Receipt className="size-4" />
            Voir la facture {invoice.number}
          </Link>
        </Button>
      ) : null}

      {history.length > 0 ? (
        <div className="surface p-4">
          <p className="mb-3 text-sm font-medium">Suivi</p>
          <ol className="space-y-2">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <StatusBadge status={h.status} labels={RIDE_STATUS_LABELS} />
                <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <AlertDialog open={confirmStart} onOpenChange={(o) => (starting ? null : setConfirmStart(o))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Le client est-il bien pris en charge ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'heure prévue ({formatHour(new Date(ride.scheduled_at))}) reste inchangée ; seule l'heure réelle de
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

      <AlertDialog open={decision !== null} onOpenChange={(o) => (deciding || o ? null : setDecision(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision === "accepted" ? "Accepter l'annulation ?" : "Refuser l'annulation ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision === "accepted"
                ? "La course passera en « Annulée », le créneau sera libéré et le client sera informé."
                : "La course restera confirmée et le créneau réservé. Le client sera informé de votre refus."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deciding}>Retour</AlertDialogCancel>
            <AlertDialogAction
              disabled={deciding}
              onClick={(e) => {
                e.preventDefault();
                if (decision) void doDecide(decision);
              }}
            >
              {deciding ? "Enregistrement…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={(o) => (cancelling ? null : setCancelOpen(o))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette course ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action annulera la course et informera immédiatement le client. Souhaitez-vous continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup value={cancelReason} onValueChange={setCancelReason} className="gap-2">
            {DRIVER_CANCEL_REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-2">
                <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                <Label htmlFor={`reason-${r.value}`} className="text-sm font-normal">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Conserver la course</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                void doDriverCancel();
              }}
            >
              {cancelling ? "Annulation…" : "Confirmer l'annulation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompleteRideDialog ride={ride} open={completing} onOpenChange={setCompleting} />

    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/pro/planning"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Planning
    </Link>
  );
}
