import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  QrCode,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LiveDriversMap } from "@/components/LiveDriversMap";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { RIDE_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

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
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });
}

function ClientHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);
  const [mode, setMode] = useState<"now" | "schedule">("now");

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
    refetchInterval: 15000,
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
          supabase.rpc("get_connected_driver_profiles"),
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
  const live = activeRide ?? pendingRequest ?? next ?? null;
  const liveIsRide = !!(activeRide ?? next);
  const liveDriver = live
    ? data.data?.drivers.find((d) => d.driver_id === (live as { driver_id: string }).driver_id)
    : undefined;
  const liveStatusLabel = live
    ? liveIsRide
      ? (RIDE_STATUS_LABELS[live.status] ?? live.status)
      : "Recherche d'un chauffeur"
    : null;
  const liveCta = activeRide ? "Suivre la course" : pendingRequest ? "Voir la demande" : "Voir les détails";
  const liveIso = (live as { scheduled_at?: string | null } | null)?.scheduled_at ?? null;
  const livePrice = (live as { price_total?: number | null; estimated_price?: number | null } | null);
  const priceValue = livePrice?.price_total ?? livePrice?.estimated_price ?? null;

  const favoriteName = favorite?.driver?.business_name ?? favorite?.profile?.full_name ?? "Chauffeur";
  const favoriteAvailable = favorite?.driver?.on_duty === true;

  return (
    <div
      className="flex w-full max-w-full flex-col gap-2 overflow-hidden"
      style={{ height: "calc(100dvh - 5.5rem - env(safe-area-inset-bottom))" }}
    >
      {/* 1. Salutation compacte */}
      <header className="min-w-0 shrink-0">
        <h1 className="truncate text-lg leading-tight font-bold tracking-tight">
          Bonjour {profile?.full_name?.split(" ")[0] ?? ""} <span aria-hidden>👋</span>
        </h1>
        <p className="truncate text-xs text-muted-foreground">Où souhaitez-vous aller ?</p>
      </header>

      {/* 2 & 3. Réservation */}
      <section className="shrink-0 space-y-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
        <Link
          to="/espace/demandes"
          className="flex w-full items-center gap-3 rounded-xl bg-primary py-3 pr-3 pl-3.5 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
            <Search className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-base font-semibold">Où allez-vous ?</span>
          <ArrowRight className="size-5 shrink-0" />
        </Link>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(
            [
              { key: "now", label: "Maintenant", icon: Clock3 },
              { key: "schedule", label: "Planifier", icon: CalendarClock },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setMode(opt.key);
                navigate({ to: "/espace/demandes" });
              }}
              aria-pressed={mode === opt.key}
              className={cn(
                "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors active:scale-[0.98]",
                mode === opt.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <opt.icon className="size-4 shrink-0" />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Course active / prochaine — ligne compacte */}
      {live ? (
        <Link
          to="/espace/suivi/$id"
          params={{ id: live.id }}
          className="flex shrink-0 animate-fade-in items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-2.5 shadow-sm active:scale-[0.995]"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15">
            {activeRide || pendingRequest ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <CalendarDays className="size-4 text-primary" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{liveStatusLabel}</span>
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0 text-primary" />
              <span className="truncate">{live.dropoff_address}</span>
              {liveIso ? (
                <span className="shrink-0">
                  · {new Date(liveIso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
              {priceValue != null ? <span className="shrink-0 font-semibold text-foreground">· {priceValue} €</span> : null}
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-primary">{liveCta}</span>
          <ChevronRight className="size-4 shrink-0 text-primary" />
        </Link>
      ) : null}

      {/* 5. Carte chauffeurs — occupe l'espace restant */}
      <section className="min-h-[100px] flex-1 overflow-hidden rounded-2xl border border-border bg-muted">
        <LiveDriversMap className="h-full w-full" />
      </section>

      {/* 6. Chauffeur favori — ligne compacte */}
      {favorite ? (
        <Link
          to="/espace/demandes"
          search={{ driver: favorite.driver_id }}
          className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm active:scale-[0.99]"
        >
          {favorite.profile?.avatar_url ? (
            <img
              src={favorite.profile.avatar_url}
              alt={favoriteName}
              loading="lazy"
              className="size-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initials(favorite.profile?.full_name)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{favoriteName}</span>
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <span
                className={cn(
                  "inline-block size-1.5 shrink-0 rounded-full",
                  favoriteAvailable ? "bg-primary" : "bg-muted-foreground/40",
                )}
              />
              {favoriteAvailable ? "Disponible" : "Indisponible"}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            Favori
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {/* 7. Ajouter un chauffeur — ligne compacte */}
      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="flex w-full shrink-0 items-center gap-2.5 rounded-2xl border border-dashed border-border bg-card p-2.5 text-left shadow-sm active:scale-[0.99]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <QrCode className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">Ajouter un chauffeur</span>
          <span className="block truncate text-xs text-muted-foreground">Scanner son QR code</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <QrScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} />
    </div>
  );
}

