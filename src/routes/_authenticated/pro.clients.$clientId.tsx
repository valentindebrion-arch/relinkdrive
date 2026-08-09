import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Phone, MessageSquare, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { CRM_LABELS, INVOICE_LABELS, RIDE_STATUS_LABELS, formatDate, formatDateTime, formatEuro } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { initials } from "./pro.clients.index";

export const Route = createFileRoute("/_authenticated/pro/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Fiche client — Relink Chauffeur" },
      { name: "description", content: "Coordonnées, activité, historique des courses et note privée de votre client." },
      { property: "og:title", content: "Fiche client — Relink Chauffeur" },
      { property: "og:description", content: "Détail complet d'un client de votre carnet Relink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientDetail,
});

const CRM_OPTIONS = ["new", "regular", "inactive"] as const;

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium break-words">{value}</span>
    </div>
  );
}

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [showAllRides, setShowAllRides] = useState(false);

  const detail = useQuery({
    queryKey: ["driver-client-detail", user?.id, clientId],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: conn }, { data: profile }, { data: rides }, { data: noteRow }] = await Promise.all([
        supabase
          .from("driver_client_connections")
          .select("*")
          .eq("driver_id", user!.id)
          .eq("client_id", clientId)
          .maybeSingle(),
        supabase.from("profiles").select("id, full_name, phone, email, avatar_url").eq("id", clientId).maybeSingle(),
        supabase
          .from("rides")
          .select("*")
          .eq("driver_id", user!.id)
          .eq("client_id", clientId)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("driver_notes")
          .select("*")
          .eq("driver_id", user!.id)
          .eq("client_id", clientId)
          .maybeSingle(),
      ]);
      const rideIds = (rides ?? []).map((r) => r.id);
      let invoices: { ride_id: string | null; status: string }[] = [];
      if (rideIds.length) {
        const { data } = await supabase.from("invoices").select("ride_id, status").in("ride_id", rideIds);
        invoices = data ?? [];
      }
      return { conn, profile, rides: rides ?? [], noteRow, invoices };
    },
  });

  useEffect(() => {
    if (detail.data?.noteRow) setNote(detail.data.noteRow.note);
  }, [detail.data?.noteRow]);

  if (detail.isLoading) {
    return (
      <div className="space-y-3 pb-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const d = detail.data;
  const profile = d?.profile;
  const conn = d?.conn;
  const rides = d?.rides ?? [];
  const completed = rides.filter((r) => r.status === "completed");
  const cancelled = rides.filter((r) => ["cancelled", "refused"].includes(r.status));
  const revenue = completed.reduce((s, r) => s + (r.price ? Number(r.price) : 0), 0);
  const lastRide = rides[0];

  const destCount = new Map<string, number>();
  for (const r of rides) destCount.set(r.dropoff_address, (destCount.get(r.dropoff_address) ?? 0) + 1);
  const topDest = [...destCount.entries()].sort((a, b) => b[1] - a[1])[0];

  const visibleRides = showAllRides ? rides : rides.slice(0, 5);

  async function saveNote() {
    const existingId = d?.noteRow?.id;
    const { error } = existingId
      ? await supabase.from("driver_notes").update({ note }).eq("id", existingId)
      : await supabase.from("driver_notes").insert({ driver_id: user!.id, client_id: clientId, note });
    if (error) return toast.error(error.message);
    setEditingNote(false);
    toast.success("Note enregistrée");
    void qc.invalidateQueries({ queryKey: ["driver-client-detail"] });
  }

  async function setCrm(crm_status: (typeof CRM_OPTIONS)[number]) {
    if (!conn) return;
    const { error } = await supabase.from("driver_client_connections").update({ crm_status }).eq("id", conn.id);
    if (error) return toast.error(error.message);
    toast.success(`Statut : ${CRM_LABELS[crm_status]}`);
    void qc.invalidateQueries({ queryKey: ["driver-client-detail"] });
    void qc.invalidateQueries({ queryKey: ["driver-clients"] });
  }

  return (
    <div className="space-y-4 overflow-x-hidden pb-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label="Retour"
          onClick={() => navigate({ to: "/pro/clients" })}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <p className="truncate text-sm font-medium text-muted-foreground">Fiche client</p>
      </div>

      <section className="surface p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-bold text-primary">
            {initials(profile?.full_name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{profile?.full_name ?? "Client"}</h1>
            {conn ? <StatusBadge status={conn.crm_status} labels={CRM_LABELS} className="mt-1" /> : null}
            {conn ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Vous a ajouté le {formatDate(conn.created_at)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="gap-2" disabled={!profile?.phone}>
            <a href={profile?.phone ? `tel:${profile.phone}` : undefined}>
              <Phone className="size-4" /> Appeler
            </a>
          </Button>
          <Button asChild variant="outline" className="gap-2" disabled={!profile?.phone}>
            <a href={profile?.phone ? `sms:${profile.phone}` : undefined}>
              <MessageSquare className="size-4" /> Message
            </a>
          </Button>
        </div>
      </section>

      <section className="surface p-4">
        <h2 className="mb-1 text-sm font-semibold">Coordonnées</h2>
        <Row label="Nom" value={profile?.full_name} />
        <Row label="Téléphone" value={profile?.phone} />
        <Row label="E-mail" value={profile?.email} />
        <Row label="Ajouté le" value={conn ? formatDate(conn.created_at) : null} />
      </section>

      <section className="surface p-4">
        <h2 className="mb-1 text-sm font-semibold">Activité avec ce client</h2>
        <Row label="Courses totales" value={String(rides.length)} />
        <Row label="Courses terminées" value={String(completed.length)} />
        {cancelled.length ? <Row label="Courses annulées" value={String(cancelled.length)} /> : null}
        <Row label="Dernière course" value={lastRide ? formatDateTime(lastRide.scheduled_at) : null} />
        {revenue > 0 ? <Row label="Montant généré" value={formatEuro(revenue)} /> : null}
        {topDest && topDest[1] > 1 ? <Row label="Destination fréquente" value={topDest[0]} /> : null}
      </section>

      <section className="surface p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Historique des courses</h2>
          <span className="text-xs text-muted-foreground">{rides.length}</span>
        </div>
        {rides.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune course avec ce client pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {visibleRides.map((r) => {
              const inv = (d?.invoices ?? []).find((i) => i.ride_id === r.id);
              return (
                <Link
                  key={r.id}
                  to="/pro/factures"
                  className="tap-active block rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.scheduled_at)}</p>
                      <p className="mt-0.5 truncate text-sm font-medium">
                        {r.pickup_address} → {r.dropoff_address}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-primary">
                      {r.price ? formatEuro(Number(r.price)) : "—"}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="flex flex-wrap gap-1.5">
                      <StatusBadge status={r.status} labels={RIDE_STATUS_LABELS} />
                      {inv ? <StatusBadge status={inv.status} labels={INVOICE_LABELS} /> : null}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {rides.length > 5 && !showAllRides ? (
          <Button variant="outline" className="mt-3 w-full" onClick={() => setShowAllRides(true)}>
            Voir toutes les courses
          </Button>
        ) : null}
      </section>

      <section className="surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Note personnelle</h2>
        {editingNote ? (
          <div className="space-y-2">
            <Textarea
              value={note}
              maxLength={800}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Préférences du client…"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNote}>
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNote(d?.noteRow?.note ?? "");
                  setEditingNote(false);
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {d?.noteRow?.note || "Aucune note. Cette note est privée et invisible pour le client."}
            </p>
            <Button size="sm" variant="outline" onClick={() => setEditingNote(true)}>
              {d?.noteRow ? "Modifier la note" : "Ajouter une note"}
            </Button>
          </div>
        )}
      </section>

      <section className="surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Statut du client</h2>
        <div className="grid grid-cols-3 gap-2">
          {CRM_OPTIONS.map((opt) => (
            <Button
              key={opt}
              size="sm"
              variant={conn?.crm_status === opt ? "default" : "outline"}
              className={cn("w-full")}
              onClick={() => setCrm(opt)}
            >
              {CRM_LABELS[opt]}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
