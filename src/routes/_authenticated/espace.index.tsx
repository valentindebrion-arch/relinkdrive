import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CalendarDays, ChevronRight, MapPin, QrCode, Star, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LiveDriversMap } from "@/components/LiveDriversMap";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

function initials(name?: string | null) {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === tomorrow.toDateString()) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long" });
}

function ClientHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);

  const handleScan = useCallback(
    (text: string) => {
      let slug: string | null = null;
      try {
        const url = new URL(text, window.location.origin);
        slug = url.pathname.match(/\/chauffeur\/([^/?#]+)/)?.[1] ?? null;
      } catch {
        slug = null;
      }
      if (!slug) slug = text.trim().match(/([A-Za-z0-9-]+)$/)?.[1] ?? null;
      setScanOpen(false);
      if (!slug) {
        toast.error("QR code non reconnu", { description: "Ce code ne correspond pas à un chauffeur Relink." });
        return;
      }
      navigate({ to: "/chauffeur/$slug", params: { slug } });
    },
    [navigate],
  );


  const data = useQuery({
    queryKey: ["client-home", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: conns }, { data: requests }, { data: rides }] = await Promise.all([
        supabase.from("driver_client_connections").select("*").eq("client_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("ride_requests").select("*").eq("client_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("rides").select("*").eq("client_id", user!.id).order("scheduled_at", { ascending: false }),
      ]);
      const ids = (conns ?? []).map((c) => c.driver_id);
      let drivers: { profile?: any; driver?: any; vehicle?: any; driver_id: string }[] = [];
      if (ids.length) {
        const [{ data: profiles }, { data: dprofiles }, { data: vehicles }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids),
          supabase.from("driver_profiles").select("user_id, business_name, city, slug").in("user_id", ids),
          supabase.from("vehicles").select("driver_id, brand, model").in("driver_id", ids),
        ]);
        drivers = ids.map((id) => ({
          driver_id: id,
          profile: (profiles ?? []).find((p) => p.id === id),
          driver: (dprofiles ?? []).find((d) => d.user_id === id),
          vehicle: (vehicles ?? []).find((v) => v.driver_id === id),
        }));
      }
      return { conns: conns ?? [], requests: requests ?? [], rides: rides ?? [], drivers };
    },
  });

  const rides = data.data?.rides ?? [];
  const requests = data.data?.requests ?? [];
  const upcoming = rides
    .filter((r) => new Date(r.scheduled_at) >= new Date() && !["cancelled", "completed"].includes(r.status))
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const completed = rides.filter((r) => r.status === "completed").length;
  const favorite = data.data?.drivers[0];
  const next = upcoming[0];

  const activeRide = rides.find((r) =>
    ["confirmed", "driver_enroute", "driver_arrived", "client_onboard", "in_progress"].includes(r.status),
  );
  const pendingRequest = requests.find(
    (r) =>
      ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status) &&
      !rides.some((ride) => ride.request_id === r.id),
  );
  const live = activeRide ?? pendingRequest ?? null;
  const liveIsRide = !!activeRide;
  const liveDriver = live
    ? data.data?.drivers.find((d) => d.driver_id === (live as { driver_id: string }).driver_id)
    : undefined;
  const liveStep = live
    ? liveIsRide
      ? (RIDE_STATUS_LABELS[live.status] ?? live.status)
      : "En attente de confirmation"
    : null;


  return (
    <div className="flex h-[calc(100dvh-6.25rem-env(safe-area-inset-bottom))] flex-col gap-2.5 overflow-hidden lg:h-[calc(100dvh-4.5rem)]">
      {/* Salutation */}
      <header className="shrink-0">
        <h1 className="truncate text-xl font-bold tracking-tight">
          Bonjour {profile?.full_name?.split(" ")[0] ?? ""} <span aria-hidden>👋</span>
        </h1>
        <p className="truncate text-xs text-muted-foreground">Des chauffeurs circulent près de vous</p>
      </header>

      {/* Carte live dans un bloc */}
      <div className="relative min-h-24 flex-1 overflow-hidden rounded-3xl border border-border bg-muted">
        <LiveDriversMap className="h-full w-full" />
      </div>

      {/* Panneau d'action */}
      <div className="shrink-0 space-y-2 rounded-3xl border border-border bg-card/90 p-3 shadow-[0_-12px_40px_-24px_hsl(0_0%_0%/0.35)] backdrop-blur-xl">

        <Link
          to="/espace/demandes"
          className="flex w-full items-center gap-3 rounded-2xl bg-primary py-3 pr-3 pl-5 text-primary-foreground shadow-lg transition-transform active:scale-[0.99]"
        >
          <MapPin className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left font-semibold">Où allez-vous ?</span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
            <ArrowRight className="size-5" />
          </span>
        </Link>

        {favorite ? (
          <Link
            to="/espace/demandes"
            search={{ driver: favorite.driver_id }}
            className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border bg-background/70 p-2.5 transition-colors hover:bg-background active:scale-[0.99]"
          >
            {favorite.profile?.avatar_url ? (
              <img
                src={favorite.profile.avatar_url}
                alt={favorite.profile?.full_name ?? "Chauffeur"}
                loading="lazy"
                className="size-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {initials(favorite.profile?.full_name)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {favorite.driver?.business_name ?? favorite.profile?.full_name ?? "Chauffeur"}
              </span>
              <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full bg-primary" /> Disponible
                {favorite.vehicle
                  ? ` · ${[favorite.vehicle.brand, favorite.vehicle.model].filter(Boolean).join(" ")}`
                  : ""}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-background/70 p-2.5 text-left transition-colors hover:bg-background active:scale-[0.99]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <QrCode className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Ajouter un chauffeur</span>
            <span className="block truncate text-xs text-muted-foreground">
              Scannez son QR code avec l'appareil photo.
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>


        {next ? (
          <Link
            to="/espace/suivi/$id"
            params={{ id: next.id }}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border border-border bg-background/70 p-2.5 active:scale-[0.99]"
          >
            <span className="shrink-0 rounded-xl bg-accent px-2.5 py-1.5 text-center text-accent-foreground">
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <CalendarDays className="size-3" /> {dayLabel(next.scheduled_at)}
              </span>
              <span className="block text-sm font-semibold">
                {new Date(next.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{next.pickup_address}</span>
              <span className="block truncate text-xs text-muted-foreground">→ {next.dropoff_address}</span>
              <span className="mt-1 block">
                <StatusBadge status={next.status} labels={RIDE_STATUS_LABELS} />
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {[
            { to: "/espace/chauffeurs", icon: Users, value: data.data?.conns.length ?? 0, label: "Chauffeurs" },
            { to: "/espace/courses", icon: CalendarDays, value: upcoming.length, label: "À venir" },
            { to: "/espace/courses", icon: Star, value: completed, label: "Effectuées" },
          ].map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-2xl border border-border bg-background/70 px-2 py-2 text-center active:scale-[0.98]"
            >
              <s.icon className="size-4 text-primary" />
              <span className="text-base leading-tight font-semibold">{s.value}</span>
              <span className="block w-full truncate text-[11px] text-muted-foreground">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <QrScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} />
    </div>

  );
}
