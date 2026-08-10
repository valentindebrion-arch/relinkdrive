import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Clock, Users, Euro, User, Phone, XCircle, CircleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { InvoiceDownloadCard } from "@/components/InvoiceDownloadCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { getRideDriverPhone, requestRideCancellation } from "@/lib/ride-cancel.functions";
import { PRE_START_STATUSES } from "@/lib/ride-cancel";
import { RIDE_STATUS_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/espace/courses/$rideId")({
  head: () => ({
    meta: [
      { title: "Détail de la course — Relink" },
      { name: "description", content: "Retrouvez tous les détails de votre trajet Relink : itinéraire, horaires, chauffeur, prix et facture." },
      { property: "og:title", content: "Détail de la course — Relink" },
      { property: "og:description", content: "Itinéraire, horaires, chauffeur, prix et facture de votre trajet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RideDetail,
});

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

function RideDetail() {
  const { rideId } = Route.useParams();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["client-ride", rideId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ride } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .eq("client_id", user!.id)
        .maybeSingle();
      if (!ride) return { ride: null, invoice: null, driver: null, history: [] };

      const [{ data: invoice }, { data: driver }, { data: history }] = await Promise.all([
        supabase.from("invoices").select("*").eq("ride_id", ride.id).maybeSingle(),
        supabase.from("profiles").select("full_name, avatar_url").eq("id", ride.driver_id).maybeSingle(),
        supabase
          .from("ride_status_history")
          .select("status, created_at")
          .eq("ride_id", ride.id)
          .order("created_at", { ascending: true }),
      ]);
      return { ride, invoice, driver, history: history ?? [] };
    },
  });

  const qc = useQueryClient();
  const [askCancel, setAskCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const askCancellation = useServerFn(requestRideCancellation);
  const fetchPhone = useServerFn(getRideDriverPhone);

  const rideData = q.data?.ride;
  const upcoming =
    !!rideData &&
    !rideData.started_at &&
    !rideData.completed_at &&
    (PRE_START_STATUSES as readonly string[]).includes(rideData.status);

  const phoneQuery = useQuery({
    queryKey: ["ride-driver-phone", rideId],
    enabled: upcoming,
    staleTime: 5 * 60_000,
    queryFn: () => fetchPhone({ data: { rideId } }),
  });

  async function sendCancelRequest() {
    if (sending) return;
    setSending(true);
    try {
      const trimmed = reason.trim();
      const res = await askCancellation({
        data: trimmed ? { rideId, reason: trimmed } : { rideId },
      });
      toast.success(
        res.alreadyPending
          ? "Une demande d'annulation est déjà en attente"
          : "Demande d'annulation envoyée au chauffeur",
      );
      setAskCancel(false);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["client-ride", rideId] });
      void qc.invalidateQueries({ queryKey: ["client-rides"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demande impossible");
    } finally {
      setSending(false);
    }
  }

  if (q.isLoading) {
    return <div className="surface h-40 animate-pulse rounded-xl" />;
  }


  const ride = q.data?.ride;
  if (!ride) {
    return (
      <>
        <BackLink />
        <EmptyState title="Course introuvable" description="Cette course n'existe pas ou ne vous appartient pas." />
      </>
    );
  }

  const invoice = q.data?.invoice;
  const driver = q.data?.driver;
  const history = q.data?.history ?? [];

  return (
    <>
      <BackLink />
      <PageHeader
        title="Détail de la course"
        description={formatDateTime(ride.scheduled_at)}
        action={<StatusBadge status={ride.status} labels={RIDE_STATUS_LABELS} />}
      />

      <div className="surface p-4">
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="my-1 w-px flex-1 bg-border" />
            <span className="h-2.5 w-2.5 rounded-full border-2 border-primary" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Départ</p>
              <p className="text-sm font-medium">{ride.pickup_address}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Arrivée</p>
              <p className="text-sm font-medium">{ride.dropoff_address}</p>
            </div>
          </div>
        </div>
      </div>

      {ride.cancel_request_status === "pending" ? (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CircleAlert className="size-4 shrink-0" />
            Demande d'annulation envoyée au chauffeur
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Votre course reste confirmée jusqu'à l'acceptation de la demande.
          </p>
        </div>
      ) : null}

      {ride.cancel_request_status === "refused" && ride.status !== "cancelled" ? (
        <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          Le chauffeur n'a pas accepté la demande d'annulation. Votre course reste confirmée. Vous pouvez l'appeler
          pour trouver une solution.
        </p>
      ) : null}

      {ride.status === "cancelled" ? (
        <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          {ride.cancel_request_status === "accepted" && ride.cancel_requested_by === user?.id
            ? "Votre demande d'annulation a été acceptée."
            : "Cette course a été annulée."}
        </p>
      ) : null}

      {upcoming ? (
        <div className="mt-3 space-y-2">
          {phoneQuery.data?.phone ? (
            <Button asChild variant="outline" className="w-full gap-2">
              <a href={`tel:${phoneQuery.data.phone}`}>
                <Phone className="size-4" />
                Appeler le chauffeur
              </a>
            </Button>
          ) : phoneQuery.isFetched ? (
            <p className="text-center text-xs text-muted-foreground">Numéro du chauffeur indisponible</p>
          ) : null}

          {ride.driver_id && ride.cancel_request_status !== "pending" ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setAskCancel(true)}
            >
              <XCircle className="size-4" />
              Demander l'annulation
            </Button>
          ) : null}
        </div>
      ) : null}

      <AlertDialog open={askCancel} onOpenChange={(o) => (sending ? null : setAskCancel(o))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Souhaitez-vous demander l'annulation de cette course ?</AlertDialogTitle>
            <AlertDialogDescription>
              La course restera confirmée jusqu'à la réponse du chauffeur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Motif (facultatif) — ne transmettez aucune information sensible"
            className="min-h-20"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Conserver la course</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                void sendCancelRequest();
              }}
            >
              {sending ? "Envoi…" : "Envoyer la demande"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      <div className="surface mt-3 divide-y p-4">
        <Row icon={Clock} label="Date et heure prévues" value={formatDateTime(ride.scheduled_at)} />
        {ride.started_at ? <Row icon={Clock} label="Prise en charge" value={formatDateTime(ride.started_at)} /> : null}
        {ride.completed_at ? <Row icon={Clock} label="Fin de course" value={formatDateTime(ride.completed_at)} /> : null}
        <Row icon={Users} label="Passagers" value={ride.passengers} />
        <Row icon={Euro} label="Prix" value={ride.price ? formatEuro(Number(ride.price)) : "Non défini"} />
        <Row icon={User} label="Chauffeur" value={driver?.full_name ?? "—"} />
        {ride.notes ? <Row icon={MapPin} label="Informations complémentaires" value={ride.notes} /> : null}
      </div>

      {invoice ? (
        <div className="mt-3">
          <InvoiceDownloadCard
            invoice={invoice as never}
            driverId={ride.driver_id}
            ride={{
              pickup_address: ride.pickup_address,
              dropoff_address: ride.dropoff_address,
              scheduled_at: ride.scheduled_at,
              completed_at: ride.completed_at,
              passengers: ride.passengers,
              mileage_km: ride.mileage_km,
            }}
          />
          <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
            Facture émise par votre chauffeur indépendant. Relink est uniquement le logiciel de gestion utilisé pour
            la générer et décline toute responsabilité quant à son contenu.
          </p>
        </div>
      ) : null}


      {history.length > 0 ? (
        <div className="surface mt-3 p-4">
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
    </>
  );
}

function BackLink() {
  return (
    <Link
      to="/espace/courses"
      className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Mes courses
    </Link>
  );
}
