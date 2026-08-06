import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Inbox, Receipt, Users, Wallet, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyVehicle, useMyDocuments } from "@/lib/driver-queries";
import { StatCard, PageHeader } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ActiveRidePanel } from "@/components/ActiveRidePanel";
import { RIDE_STATUS_LABELS, VERIFICATION_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/pro/")({
  component: ProOverview,
});

function ProOverview() {
  const { user, profile } = useAuth();
  const driver = useDriverProfile();
  const vehicle = useMyVehicle();
  const docs = useMyDocuments();

  const data = useQuery({
    queryKey: ["pro-overview", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [requests, rides, invoices, clients] = await Promise.all([
        supabase.from("ride_requests").select("*").eq("driver_id", user!.id).in("status", ["new", "reviewing", "awaiting_client", "proposal_sent"]),
        supabase.from("rides").select("*").eq("driver_id", user!.id).order("scheduled_at"),
        supabase.from("invoices").select("*").eq("driver_id", user!.id),
        supabase.from("driver_client_connections").select("id").eq("driver_id", user!.id),
      ]);
      const allRides = rides.data ?? [];
      const now = new Date();
      const today = allRides.filter(
        (r) => new Date(r.scheduled_at).toDateString() === now.toDateString() && !r.is_block,
      );
      const upcoming = allRides.filter((r) => new Date(r.scheduled_at) >= now && !r.is_block);
      const revenue = (invoices.data ?? [])
        .filter((i) => new Date(i.issued_on) >= startOfMonth && i.status !== "cancelled")
        .reduce((sum, i) => sum + Number(i.amount_ttc), 0);
      return {
        requests: requests.data ?? [],
        today,
        upcoming,
        unpaidInvoices: (invoices.data ?? []).filter((i) => i.status !== "paid" && i.status !== "cancelled"),
        revenue,
        clients: clients.data?.length ?? 0,
      };
    },
  });

  const alerts: string[] = [];
  const v = vehicle.data;
  const soon = (d?: string | null) => d && new Date(d).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45;
  if (soon(v?.insurance_expires_at)) alerts.push("Votre assurance arrive bientôt à expiration.");
  if (soon(v?.inspection_expires_at)) alerts.push("Votre contrôle technique arrive bientôt à expiration.");
  if (soon(v?.next_service_date)) alerts.push("Vous devriez prévoir l'entretien du véhicule.");
  (docs.data ?? []).forEach((d) => {
    if (d.status === "rejected") alerts.push(`Document refusé : ${d.doc_type}. Une correction est demandée.`);
    if (soon(d.expires_at)) alerts.push(`Un document arrive à expiration (${d.doc_type}).`);
  });

  const next = data.data?.upcoming[0];

  return (
    <>
      <PageHeader
        title={`Bonjour ${profile?.full_name?.split(" ")[0] ?? ""}`}
        description="Votre activité en un coup d'œil."
        action={
          <Link
            to="/pro/qr"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <QrCode className="size-4" /> Mon QR code
          </Link>
        }
      />

      {driver.data && driver.data.verification_status !== "verified" ? (
        <div className="surface mb-6 flex flex-wrap items-center justify-between gap-3 border-warning/40 bg-warning/10 p-4">
          <div>
            <p className="font-medium">
              Statut du compte : <StatusBadge status={driver.data.verification_status} labels={VERIFICATION_LABELS} />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Votre page publique et vos demandes réelles seront activées après validation par un administrateur.
            </p>
          </div>
          <Link to="/pro/verification" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium">
            Compléter mon dossier
          </Link>
        </div>
      ) : null}

      <ActiveRidePanel />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Demandes à traiter" value={data.data?.requests.length ?? 0} icon={<Inbox className="size-4" />} />
        <StatCard label="Courses aujourd'hui" value={data.data?.today.length ?? 0} />
        <StatCard label="CA du mois" value={formatEuro(data.data?.revenue ?? 0)} icon={<Wallet className="size-4" />} />
        <StatCard label="Clients fidélisés" value={data.data?.clients ?? 0} icon={<Users className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Prochaines courses</h2>
          {data.data?.upcoming.length ? (
            <ul className="divide-y divide-border">
              {data.data.upcoming.slice(0, 6).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {r.pickup_address} → {r.dropoff_address}
                    </p>
                    <p className="text-muted-foreground">{formatDateTime(r.scheduled_at)}</p>
                  </div>
                  <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune course planifiée.</p>
          )}
          {next ? (
            <p className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
              Prochaine course : {formatDateTime(next.scheduled_at)} — {next.pickup_address}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="surface p-5">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Receipt className="size-4 text-primary" /> Factures en attente
            </h2>
            <p className="text-2xl font-semibold">{data.data?.unpaidInvoices.length ?? 0}</p>
            <Link to="/pro/factures" className="mt-2 inline-block text-sm text-primary">
              Gérer les factures
            </Link>
          </div>
          <div className="surface p-5">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-warning" /> Alertes
            </h2>
            {alerts.length ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {alerts.slice(0, 4).map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune alerte.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
