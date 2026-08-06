import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Clock, Users, Euro, FileText, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, INVOICE_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

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
