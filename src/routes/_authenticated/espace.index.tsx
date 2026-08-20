import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarClock, Loader2, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ClientTopBar } from "@/components/client/ClientTopBar";
import { useBlockingImmediate } from "@/lib/immediate-request";
import { saveRequestDraft } from "@/lib/request-draft";
import { ConnectionDecor } from "@/components/client/ConnectionDecor";
import { HomeDriverCard, type HomeCardDriver } from "@/components/client/HomeDriverCard";
import {
  EQUIPMENT_LABELS,
  VehicleFacts,
  type VehicleFactsData,
} from "@/components/client/VehicleFacts";
import { useSignedUrls } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

type HomeDriver = HomeCardDriver & {
  vehiclePhotoPath: string | null;
  vehiclePhotoVersion: string | null;
  facts: VehicleFactsData;
};

let selectedDriverMemory: string | null = null;
const ANIM_MS = 260;

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(8);
    } catch {
      /* non supporté */
    }
  }
}

function ClientHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const blocking = useBlockingImmediate().data ?? null;

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(selectedDriverMemory);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!transitioning) return;
    const t = window.setTimeout(() => {
      setTransitioning(false);
      setDir(null);
    }, ANIM_MS);
    return () => window.clearTimeout(t);
  }, [transitioning, selectedDriverId]);

  const data = useQuery({
    queryKey: ["client-home", user?.id],
    enabled: !!user?.id,
    refetchInterval: 20000,
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
      let drivers: HomeDriver[] = [];
      if (ids.length) {
        const [{ data: profiles }, { data: dprofiles }, { data: vehicles }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids),
          supabase.rpc("get_connected_driver_profiles"),
          supabase.from("vehicles").select("*").in("driver_id", ids),
        ]);

        const counts = new Map<string, number>();
        (rides ?? []).forEach((r) => counts.set(r.driver_id, (counts.get(r.driver_id) ?? 0) + 1));
        let favoriteId: string | null = null;
        counts.forEach((n, id) => {
          if (n > (favoriteId ? (counts.get(favoriteId) ?? 0) : 0)) favoriteId = id;
        });

        // Notes publiques agrégées (une requête par chauffeur du carnet).
        const ratings = new Map<string, { avg: number | null; count: number }>();
        await Promise.all(
          ids.map(async (id) => {
            const slug = (dprofiles ?? []).find((d) => d.user_id === id)?.slug;
            if (!slug) return;
            const { data: r } = await supabase.rpc("get_public_driver_rating", { _slug: slug });
            const row = r?.[0];
            if (row) ratings.set(id, { avg: row.rating_avg ?? null, count: Number(row.rating_count ?? 0) });
          }),
        );

        drivers = ids.map((id) => {
          const profile = (profiles ?? []).find((p) => p.id === id);
          const dp = (dprofiles ?? []).find((d) => d.user_id === id);
          const car =
            (vehicles ?? []).find((v) => v.driver_id === id && v.is_primary) ??
            (vehicles ?? []).find((v) => v.driver_id === id);
          const rating = ratings.get(id);
          return {
            id,
            name: dp?.business_name || profile?.full_name || "Chauffeur",
            avatarUrl: profile?.avatar_url ?? null,
            available: !!dp?.on_duty && dp?.accepting_requests !== false,
            vehicle: car ? [car.brand, car.model].filter(Boolean).join(" ") || null : null,
            vehiclePhotoUrl: null,
            ratingAvg: rating?.avg ?? null,
            ratingCount: rating?.count ?? 0,
            trips: counts.get(id) ?? 0,
            slug: dp?.slug ?? null,
            vehiclePhotoPath: car?.photo_url ?? null,
            vehiclePhotoVersion: car?.updated_at ?? null,
            facts: {
              vehicleId: car?.id ?? null,
              interiorPhotoPath: car?.photo_interior_url ?? null,
              interiorPhotoUrl: null,
              maxPassengers: car?.max_passengers ?? null,
              largeLuggage: car?.large_luggage_capacity ?? null,
              cabinLuggage: car?.cabin_luggage_capacity ?? null,
              petsPolicy: (car?.pets_policy as VehicleFactsData["petsPolicy"]) ?? null,
              equipment: car
                ? EQUIPMENT_LABELS.filter(
                    (e) => (car as Record<string, unknown>)[e.key] === true,
                  ).map((e) => e.label)
                : [],
            } satisfies VehicleFactsData,
            favoriteId,
          } as HomeDriver & { favoriteId: string | null };
        });
        // L'accueil ne présente que les chauffeurs du carnet actuellement disponibles.
        // La relation client / chauffeur reste intacte : « Mes chauffeurs » affiche tout le carnet.
        drivers = drivers.filter((d) => d.available);
        // Le chauffeur le plus sollicité est présenté en premier.
        const favIndex = drivers.findIndex((d) => d.id === favoriteId);
        if (favIndex > 0) {
          const [fav] = drivers.splice(favIndex, 1);
          if (fav) drivers.unshift(fav);
        }
      }
      return {
        requests: requests ?? [],
        rides: rides ?? [],
        drivers,
        connectionsCount: ids.length,
      };
    },
  });

  const rawDrivers = useMemo(() => data.data?.drivers ?? [], [data.data?.drivers]);
  const photos = useSignedUrls(
    "vehicles",
    rawDrivers.flatMap((d) => [d.vehiclePhotoPath, d.facts.interiorPhotoPath]),
    rawDrivers.map((d) => d.vehiclePhotoVersion),
  );
  const photoUrls = photos.data;
  const drivers = useMemo(
    () =>
      rawDrivers.map((d) => {
        const interiorUrl = d.facts.interiorPhotoPath
          ? (photoUrls?.[d.facts.interiorPhotoPath] ?? null)
          : null;
        return {
          ...d,
          vehiclePhotoUrl: d.vehiclePhotoPath ? (photoUrls?.[d.vehiclePhotoPath] ?? null) : null,
          facts: { ...d.facts, interiorPhotoUrl: interiorUrl },
        };
      }),
    [rawDrivers, photoUrls],
  );
  const photosPending =
    photos.isPending && rawDrivers.some((d) => !!d.vehiclePhotoPath || !!d.facts.interiorPhotoPath);
  const rides = data.data?.rides ?? [];
  const requests = data.data?.requests ?? [];

  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || !drivers.length) return;
    primed.current = true;
    if (selectedDriverId && drivers.some((driver) => driver.id === selectedDriverId)) return;
    const initial = drivers[0]?.id ?? null;
    selectedDriverMemory = initial;
    setSelectedDriverId(initial);
  }, [drivers, selectedDriverId]);

  const restoredIndex = selectedDriverId
    ? drivers.findIndex((driver) => driver.id === selectedDriverId)
    : -1;
  const safeIndex = restoredIndex >= 0 ? restoredIndex : 0;
  const selectedDriver = drivers[safeIndex] ?? null;

  function goToDriver(delta: number) {
    if (drivers.length < 2 || transitioning) return;
    const nextIndex = (safeIndex + delta + drivers.length) % drivers.length;
    const nextId = drivers[nextIndex]?.id ?? null;
    setDir(delta > 0 ? "right" : "left");
    setTransitioning(true);
    selectedDriverMemory = nextId;
    setSelectedDriverId(nextId);
  }

  const activeRide = rides.find((r) =>
    ["driver_enroute", "driver_arrived", "client_onboard", "in_progress"].includes(r.status),
  );
  const pendingLocal = requests.find(
    (r) =>
      ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status) &&
      !rides.some((ride) => ride.request_id === r.id),
  );
  const ongoingId = activeRide?.id ?? blocking?.request_id ?? pendingLocal?.id ?? null;
  const ongoingLabel = activeRide ? "Suivre ma course en cours" : "Suivre ma demande en cours";

  const firstName = (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ?? "";
  const noDriver = !data.isLoading && drivers.length === 0;

  function startRequest(mode: "now" | "later") {
    haptic();
    saveRequestDraft({
      driver_id: selectedDriver?.id ?? "",
      pickup_address: "",
      dropoff_address: "",
      scheduled_at: "",
      whenMode: mode,
      pickupOk: false,
      dropoffOk: false,
    });
    void navigate({ to: "/espace/demandes" });
  }

  return (
    <div
      className="home-screen relative isolate flex w-full max-w-full flex-col overflow-x-hidden bg-muted/30"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <ConnectionDecor />

      <div className="home-rise relative shrink-0 px-4">
        <ClientTopBar />
        <p className="mt-1 text-[13px] font-semibold text-muted-foreground">
          {firstName ? `Bonjour ${firstName} 👋` : "Bonjour 👋"}
        </p>
        <h1 className="text-[22px] leading-tight font-black tracking-tight">Votre chauffeur</h1>
      </div>

      <main className="flex w-full min-w-0 flex-col gap-[var(--home-gap)] px-4 pt-[var(--home-gap)] pb-[calc(var(--home-tabbar-h)+env(safe-area-inset-bottom)+24px)]">
        {ongoingId ? (
          <Link
            to="/espace/suivi/$id"
            params={{ id: ongoingId }}
            className="home-rise flex items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-primary/8 px-4 py-3 text-[13px] font-bold text-primary"
          >
            {ongoingLabel}
            <ArrowRight className="size-4 shrink-0" />
          </Link>
        ) : null}

        <div className="home-rise" style={{ animationDelay: "40ms" }}>
          <HomeDriverCard
            drivers={drivers}
            index={safeIndex}
            onGo={goToDriver}
            dir={dir}
            loading={data.isLoading || photosPending}
          />
        </div>

        <section className="home-rise space-y-2" style={{ animationDelay: "90ms" }}>
          {noDriver ? (
            <Link
              to="/espace/chauffeurs"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-[15px] font-extrabold text-primary-foreground transition active:scale-[0.985]"
            >
              <QrCode className="size-5" /> Ajouter mon premier chauffeur
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startRequest("now")}
                disabled={data.isLoading || transitioning}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-[15px] font-extrabold text-primary-foreground transition active:scale-[0.985] disabled:opacity-70"
              >
                {data.isLoading ? <Loader2 className="size-5 animate-spin" /> : null}
                Réserver maintenant
                <ArrowRight className="size-5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => startRequest("later")}
                disabled={transitioning}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/35 bg-card px-3 text-[14px] font-bold text-primary transition active:scale-[0.985] disabled:opacity-70"
              >
                <CalendarClock className="size-4" /> Planifier un trajet
              </button>
            </>
          )}
        </section>

        <VehicleFacts
          facts={selectedDriver?.facts ?? null}
          driverSlug={selectedDriver?.slug ?? null}
          driverKey={selectedDriver?.id ?? (data.isLoading ? "loading" : "empty")}
          anim={
            dir === "right" ? "driver-card-in-right" : dir === "left" ? "driver-card-in-left" : ""
          }
          loading={data.isLoading || photosPending}
        />
      </main>
    </div>
  );
}
