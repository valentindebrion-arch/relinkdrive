import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
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
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LiveDriversMap } from "@/components/LiveDriversMap";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { BrandLogo } from "@/components/BrandLogo";
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

type Snap = "collapsed" | "mid" | "expanded";
const SNAP_H: Record<Snap, string> = {
  collapsed: "7.5rem",
  mid: "45dvh",
  expanded: "78dvh",
};
const SNAP_ORDER: Snap[] = ["collapsed", "mid", "expanded"];

function ClientHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);
  const [snap, setSnap] = useState<Snap>("mid");
  const [selectedDriverIdx, setSelectedDriverIdx] = useState<number | null>(null);
  const dragStart = useRef<number | null>(null);

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
        toast.error("QR code non reconnu", {
          description: "Ce code ne correspond pas à un chauffeur Relink.",
        });
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
        supabase
          .from("driver_client_connections")
          .select("*")
          .eq("client_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("ride_requests")
          .select("*")
          .eq("client_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("rides")
          .select("*")
          .eq("client_id", user!.id)
          .order("scheduled_at", { ascending: false }),
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
  const allDrivers = useMemo(() => data.data?.drivers ?? [], [data.data?.drivers]);
  const upcoming = rides
    .filter((r) => new Date(r.scheduled_at) >= new Date() && !["cancelled", "completed"].includes(r.status))
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const favorite = allDrivers[0];
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
  const liveStatusLabel = live
    ? liveIsRide
      ? (RIDE_STATUS_LABELS[live.status] ?? live.status)
      : "Recherche d'un chauffeur"
    : null;
  const liveCta = activeRide ? "Suivre" : pendingRequest ? "Voir" : "Détails";
  const liveIso = (live as { scheduled_at?: string | null } | null)?.scheduled_at ?? null;

  const favoriteName = favorite?.driver?.business_name ?? favorite?.profile?.full_name ?? "Chauffeur";
  const favoriteAvailable = favorite?.driver?.on_duty === true;

  const selectedDriver =
    selectedDriverIdx != null ? allDrivers[selectedDriverIdx % Math.max(allDrivers.length, 1)] : undefined;

  const onDriverSelect = useCallback(
    (i: number) => {
      setSelectedDriverIdx(i);
      setSnap("mid");
    },
    [],
  );

  const cycleSnap = (dir: 1 | -1) => {
    const i = SNAP_ORDER.indexOf(snap);
    const nextI = Math.min(SNAP_ORDER.length - 1, Math.max(0, i + dir));
    setSnap(SNAP_ORDER[nextI]!);
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Carte plein écran (arrière-plan) */}
      <div className="absolute inset-0">
        <LiveDriversMap
          className="h-full w-full"
          bare
          interactive
          onDriverSelect={allDrivers.length ? onDriverSelect : undefined}
        />
      </div>

      {/* Logo centré + bouton profil */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="pointer-events-auto rounded-full bg-card/90 px-3.5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur">
          <BrandLogo size="sm" />
        </div>
        <Link
          to="/espace/parametres"
          aria-label="Mon profil"
          className="pointer-events-auto absolute right-3 grid size-10 place-items-center overflow-hidden rounded-full bg-card/90 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-full object-cover" />
          ) : profile?.full_name ? (
            <span className="text-xs font-bold text-foreground">{initials(profile.full_name)}</span>
          ) : (
            <UserRound className="size-5 text-muted-foreground" />
          )}
        </Link>
      </div>

      {/* Course active prioritaire */}
      {live ? (
        <Link
          to="/espace/suivi/$id"
          params={{ id: live.id }}
          className="animate-fade-in absolute inset-x-3 z-20 flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-card/95 p-2.5 shadow-lg backdrop-blur"
          style={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}
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
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-primary">{liveCta}</span>
          <ChevronRight className="size-4 shrink-0 text-primary" />
        </Link>
      ) : null}

      {/* Bloc de recherche flottant */}
      <section
        className="absolute inset-x-3 z-20 space-y-2 rounded-2xl bg-card/95 p-2 shadow-[0_6px_24px_rgba(0,0,0,0.10)] backdrop-blur"
        style={{ top: live ? "calc(env(safe-area-inset-top) + 8.5rem)" : "calc(env(safe-area-inset-top) + 4rem)" }}
      >
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
            <Link
              key={opt.key}
              to="/espace/demandes"
              className="flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground transition-colors active:scale-[0.98]"
            >
              <opt.icon className="size-4 shrink-0" />
              <span className="truncate">{opt.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Fiche inférieure coulissante */}
      <div
        className="absolute inset-x-0 z-30 flex flex-col rounded-t-3xl border-t border-border bg-card shadow-[0_-6px_24px_rgba(0,0,0,0.10)] transition-[height] duration-300 motion-reduce:transition-none"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))", height: SNAP_H[snap] }}
        onPointerDown={(e) => (dragStart.current = e.clientY)}
        onPointerUp={(e) => {
          const start = dragStart.current;
          dragStart.current = null;
          if (start == null) return;
          const dy = e.clientY - start;
          if (dy < -30) cycleSnap(1);
          else if (dy > 30) cycleSnap(-1);
        }}
      >
        <button
          type="button"
          aria-label={snap === "collapsed" ? "Déplier la fiche" : "Replier la fiche"}
          onClick={() => cycleSnap(snap === "expanded" ? -1 : 1)}
          className="mx-auto flex w-full shrink-0 justify-center py-2.5"
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </button>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {selectedDriver ? (
            <div className="animate-fade-in rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2.5">
                {selectedDriver.profile?.avatar_url ? (
                  <img
                    src={selectedDriver.profile.avatar_url}
                    alt=""
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {initials(selectedDriver.profile?.full_name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {selectedDriver.driver?.business_name ?? selectedDriver.profile?.full_name ?? "Chauffeur"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedDriver.driver?.on_duty ? "Disponible" : "Indisponible"}
                    {selectedDriver.vehicle
                      ? ` · ${selectedDriver.vehicle.brand} ${selectedDriver.vehicle.model}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Fermer la fiche chauffeur"
                  onClick={() => setSelectedDriverIdx(null)}
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <Link
                to="/espace/demandes"
                search={{ driver: selectedDriver.driver_id }}
                className="mt-2 flex min-h-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                Réserver avec ce chauffeur
              </Link>
            </div>
          ) : null}

          {favorite ? (
            <Link
              to="/espace/demandes"
              search={{ driver: favorite.driver_id }}
              className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm active:scale-[0.99]"
            >
              {favorite.profile?.avatar_url ? (
                <img
                  src={favorite.profile.avatar_url}
                  alt=""
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
          ) : (
            <p className="px-1 text-xs text-muted-foreground">
              Aucun chauffeur enregistré pour le moment. Scannez le QR code de votre chauffeur pour l'ajouter.
            </p>
          )}

          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-border bg-card p-2.5 text-left shadow-sm active:scale-[0.99]"
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

          <Link
            to="/espace/chauffeurs"
            className="flex w-full items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 text-left shadow-sm active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">Tous mes chauffeurs</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>
      </div>

      <QrScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} />
    </div>
  );
}
