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
  History,
  Loader2,
  MapPin,
  QrCode,
  Search,
  Star,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LiveDriversMap } from "@/components/LiveDriversMap";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { StatusBadge } from "@/components/StatusBadge";
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
          supabase.from("driver_profiles").select("user_id, business_name, city, slug, on_duty").in("user_id", ids),
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
    <div className="space-y-4 pb-4">
      {/* 1. Salutation */}
      <header className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight">
          Bonjour {profile?.full_name?.split(" ")[0] ?? ""} <span aria-hidden>👋</span>
        </h1>
        <p className="truncate text-sm text-muted-foreground">Où souhaitez-vous aller aujourd'hui ?</p>
      </header>

      {/* 2 & 3. Réservation */}
      <section className="space-y-3 rounded-3xl border border-border bg-card p-3 shadow-sm">
        <Link
          to="/espace/demandes"
          className="flex w-full items-center gap-3 rounded-2xl bg-primary py-3.5 pr-3 pl-4 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
            <Search className="size-5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-base font-semibold">Où allez-vous ?</span>
          <ArrowRight className="size-5 shrink-0" />
        </Link>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
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
                "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]",
                mode === opt.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <opt.icon className="size-4 shrink-0" />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Course active / prochaine */}
      {live ? (
        <Link
          to="/espace/suivi/$id"
          params={{ id: live.id }}
          className="block animate-fade-in rounded-3xl border border-primary/30 bg-primary/5 p-3 shadow-sm active:scale-[0.995]"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15">
              {activeRide || pendingRequest ? (
                <Loader2 className="size-5 animate-spin text-primary" />
              ) : (
                <CalendarDays className="size-5 text-primary" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{liveStatusLabel}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {liveDriver?.driver?.business_name ?? liveDriver?.profile?.full_name ?? "Chauffeur à confirmer"}
              </span>
            </span>
            {liveIsRide ? <StatusBadge status={live.status} labels={RIDE_STATUS_LABELS} /> : null}
          </div>

          <div className="mt-3 space-y-1.5 border-t border-primary/20 pt-3 text-xs">
            {liveIso ? (
              <span className="flex items-center gap-2 font-medium text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0 text-primary" />
                {dayLabel(liveIso)} ·{" "}
                {new Date(liveIso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                {priceValue != null ? <span className="ml-auto font-semibold text-foreground">{priceValue} €</span> : null}
              </span>
            ) : null}
            <span className="flex items-start gap-2">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1 truncate font-medium">{live.pickup_address}</span>
            </span>
            <span className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate font-medium">{live.dropoff_address}</span>
            </span>
          </div>

          <span className="mt-3 flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            {liveCta}
          </span>
        </Link>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
          Vos prochaines réservations apparaîtront ici.
        </p>
      )}

      {/* 5. Carte chauffeurs */}
      <section className="space-y-2">
        <h2 className="truncate text-sm font-semibold">Chauffeurs disponibles autour de vous</h2>
        <div className="relative h-44 overflow-hidden rounded-3xl border border-border bg-muted">
          <LiveDriversMap className="h-full w-full" />
        </div>
      </section>

      {/* 6. Chauffeur favori */}
      {favorite ? (
        <section className="rounded-3xl border border-border bg-card p-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            {favorite.profile?.avatar_url ? (
              <img
                src={favorite.profile.avatar_url}
                alt={favoriteName}
                loading="lazy"
                className="size-12 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {initials(favorite.profile?.full_name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold">{favoriteName}</p>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Favori
                </span>
              </div>
              {favorite.vehicle ? (
                <p className="truncate text-xs text-muted-foreground">
                  {[favorite.vehicle.brand, favorite.vehicle.model].filter(Boolean).join(" ")}
                </p>
              ) : null}
              <p className="truncate text-xs font-medium text-muted-foreground">
                <span
                  className={cn(
                    "mr-1.5 inline-block size-2 rounded-full align-middle",
                    favoriteAvailable ? "bg-primary" : "bg-muted-foreground/40",
                  )}
                />
                {favoriteAvailable ? "Disponible" : "Indisponible actuellement"}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/espace/demandes"
              search={{ driver: favorite.driver_id }}
              className="flex h-10 items-center justify-center rounded-xl bg-primary px-2 text-center text-xs font-semibold text-primary-foreground active:scale-[0.98]"
            >
              Réserver avec ce chauffeur
            </Link>
            {favorite.driver?.slug ? (
              <Link
                to="/chauffeur/$slug"
                params={{ slug: favorite.driver.slug }}
                className="flex h-10 items-center justify-center rounded-xl border border-border px-2 text-center text-xs font-semibold active:scale-[0.98]"
              >
                Voir le profil
              </Link>
            ) : (
              <Link
                to="/espace/chauffeurs"
                className="flex h-10 items-center justify-center rounded-xl border border-border px-2 text-center text-xs font-semibold active:scale-[0.98]"
              >
                Voir le profil
              </Link>
            )}
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
          Aucun chauffeur enregistré pour le moment. Ajoutez-en un ci-dessous.
        </p>
      )}

      {/* 7. Ajouter un chauffeur */}
      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="flex w-full items-start gap-3 rounded-3xl border border-dashed border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.99]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <QrCode className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Ajouter un chauffeur</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
            Scannez le QR code d'un chauffeur ou utilisez son lien pour l'ajouter à votre liste.
          </span>
          <span className="mt-2 inline-flex h-8 items-center rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary">
            Scanner un QR code
          </span>
        </span>
        <ChevronRight className="mt-2 size-5 shrink-0 text-muted-foreground" />
      </button>

      {/* 8. Raccourcis */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { to: "/espace/chauffeurs", icon: Users, value: data.data?.conns.length ?? 0, label: "Mes chauffeurs" },
          { to: "/espace/courses", icon: CalendarDays, value: upcoming.length, label: "Courses à venir" },
          { to: "/espace/courses", icon: History, value: completed, label: "Historique" },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="flex min-w-0 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-1.5 py-2.5 text-center shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.98]"
          >
            <s.icon className="size-4 shrink-0 text-primary" />
            <span className="text-base leading-tight font-semibold">{s.value}</span>
            <span className="block w-full truncate text-[11px] text-muted-foreground">{s.label}</span>
          </Link>
        ))}
      </div>

      {data.isError ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          Impossible de charger vos données. Vérifiez votre connexion puis réessayez.
        </p>
      ) : null}

      <QrScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} />
    </div>
  );
}
