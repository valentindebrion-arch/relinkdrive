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

      {/* Capsule logo centrée (seul élément supérieur) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="pointer-events-auto rounded-full bg-card/95 px-3.5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur">
          <BrandLogo to="/espace" size="sm" />
        </div>
      </div>

      {/* Panneau inférieur : réservation (et course active en priorité) */}
      <div
        className="absolute inset-x-0 z-30 rounded-t-3xl border-t border-border bg-card px-3 pt-2 pb-3 shadow-[0_-6px_24px_rgba(0,0,0,0.10)]"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      >
        <span className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-muted-foreground/25" />

        {live ? (
          <Link
            to="/espace/suivi/$id"
            params={{ id: live.id }}
            className="animate-fade-in mb-2 flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-2.5"
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

        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(
            [
              { key: "now", label: "Maintenant", icon: Clock3 },
              { key: "schedule", label: "Planifier", icon: CalendarClock },
            ] as const
          ).map((opt) => (
            <Link
              key={opt.key}
              to="/espace/demandes"
              className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground transition-colors active:scale-[0.98]"
            >
              <opt.icon className="size-4 shrink-0" />
              <span className="truncate">{opt.label}</span>
            </Link>
          ))}
        </div>

        {!allDrivers.length ? (
          <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
            Aucun chauffeur enregistré : ajoutez-en un depuis l'onglet « Chauffeurs ».
          </p>
        ) : null}
      </div>
    </div>
  );
}
