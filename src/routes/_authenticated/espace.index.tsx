import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, QrCode, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchConnectedProfiles } from "@/lib/connected-profiles";
import { useAuth } from "@/lib/auth";
import { ClientTopBar } from "@/components/client/ClientTopBar";
import { ConnectionDecor } from "@/components/client/ConnectionDecor";
import { HomeDriverCard, type HomeCardDriver } from "@/components/client/HomeDriverCard";
import { EQUIPMENT_LABELS, VehicleFacts, type VehicleFactsData } from "@/components/client/VehicleFacts";
import { useSignedUrls } from "@/lib/storage";
import emptyDriverStateAsset from "@/assets/empty-driver-state.png.asset.json";

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

type HomeDriver = HomeCardDriver & {
  vehiclePhotoPath: string | null;
  frontPhotoPath: string | null;
  exteriorPhotoPath: string | null;
  vehiclePhotoVersion: string | null;
  facts: VehicleFactsData;
};

let selectedDriverMemory: string | null = null;
const ANIM_MS = 260;

function ClientHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
    queryFn: async () => {
      const { data: conns } = await supabase
        .from("driver_client_connections")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });

      const ids = (conns ?? []).map((c) => c.driver_id);
      let drivers: HomeDriver[] = [];
      if (ids.length) {
        const [{ data: profiles }, { data: dprofiles }, { data: vehicles }] = await Promise.all([
          fetchConnectedProfiles(ids).then((d) => ({ data: d })),
          supabase.rpc("get_connected_driver_profiles"),
          supabase.from("vehicles").select("*").in("driver_id", ids),
        ]);

        drivers = ids.map((id) => {
          const profile = (profiles ?? []).find((p) => p.id === id);
          const dp = (dprofiles ?? []).find((d) => d.user_id === id);
          const car =
            (vehicles ?? []).find((v) => v.driver_id === id && v.is_primary) ??
            (vehicles ?? []).find((v) => v.driver_id === id);
          return {
            id,
            name: dp?.business_name || profile?.full_name || "Chauffeur",
            avatarUrl: profile?.avatar_url ?? null,
            available: true,
            vehicle: car ? [car.brand, car.model].filter(Boolean).join(" ") || null : null,
            vehiclePhotoUrl: null,
            ratingAvg: null,
            ratingCount: 0,
            trips: 0,
            slug: dp?.slug ?? null,
            vehiclePhotoPath: car?.photo_front_url ?? car?.photo_url ?? null,
            frontPhotoPath: car?.photo_front_url ?? null,
            exteriorPhotoPath: car?.photo_url ?? null,
            vehiclePhotoVersion: car?.updated_at ?? null,
            facts: {
              vehicleId: car?.id ?? null,
              exteriorPhotoPath: car?.photo_url ?? null,
              exteriorPhotoUrl: null,
              interiorPhotoPath: car?.photo_interior_url ?? null,
              interiorPhotoUrl: null,
              maxPassengers: car?.max_passengers ?? null,
              largeLuggage: car?.large_luggage_capacity ?? null,
              cabinLuggage: car?.cabin_luggage_capacity ?? null,
              petsPolicy: (car?.pets_policy as VehicleFactsData["petsPolicy"]) ?? null,
              equipment: car
                ? EQUIPMENT_LABELS.filter((e) => (car as Record<string, unknown>)[e.key] === true).map((e) => e.label)
                : [],
            } satisfies VehicleFactsData,
          } as HomeDriver;
        });
      }
      return { drivers, connectionsCount: ids.length };
    },
  });

  // Temps réel : une mise à jour de vitrine rafraîchit le réseau du client.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("client-home-network")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_profiles" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["client-home", user.id] });
        void queryClient.invalidateQueries({ queryKey: ["client-drivers", user.id] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const rawDrivers = useMemo(() => data.data?.drivers ?? [], [data.data?.drivers]);
  const photos = useSignedUrls(
    "vehicles",
    rawDrivers.flatMap((d) => [d.vehiclePhotoPath, d.frontPhotoPath, d.exteriorPhotoPath, d.facts.interiorPhotoPath]),
    rawDrivers.map((d) => d.vehiclePhotoVersion),
  );
  const photoUrls = photos.data;
  const drivers = useMemo(
    () =>
      rawDrivers.map((d) => {
        const interiorUrl = d.facts.interiorPhotoPath ? (photoUrls?.[d.facts.interiorPhotoPath] ?? null) : null;
        const exteriorUrl = d.exteriorPhotoPath ? (photoUrls?.[d.exteriorPhotoPath] ?? null) : null;
        return {
          ...d,
          vehiclePhotoUrl: d.vehiclePhotoPath ? (photoUrls?.[d.vehiclePhotoPath] ?? null) : null,
          frontPhotoUrl: d.frontPhotoPath ? (photoUrls?.[d.frontPhotoPath] ?? null) : null,
          exteriorPhotoUrl: exteriorUrl,
          facts: { ...d.facts, interiorPhotoUrl: interiorUrl, exteriorPhotoUrl: exteriorUrl },
        };
      }),
    [rawDrivers, photoUrls],
  );
  const photosPending =
    photos.isPending && rawDrivers.some((d) => !!d.vehiclePhotoPath || !!d.facts.interiorPhotoPath);

  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || !drivers.length) return;
    primed.current = true;
    if (selectedDriverId && drivers.some((driver) => driver.id === selectedDriverId)) return;
    const initial = drivers[0]?.id ?? null;
    selectedDriverMemory = initial;
    setSelectedDriverId(initial);
  }, [drivers, selectedDriverId]);

  const restoredIndex = selectedDriverId ? drivers.findIndex((driver) => driver.id === selectedDriverId) : -1;
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

  const firstName = (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ?? "";
  const connectionsCount = data.data?.connectionsCount ?? 0;
  const noDriver = !data.isLoading && connectionsCount === 0;

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
        <h1 className="text-[22px] leading-tight font-black tracking-tight">Mon réseau de chauffeurs</h1>
      </div>

      <main className="flex w-full min-w-0 flex-col gap-[var(--home-gap)] px-4 pt-[var(--home-gap)] pb-[calc(var(--home-tabbar-h)+env(safe-area-inset-bottom)+24px)]">
        {noDriver ? (
          <div
            className="home-rise overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-[0_10px_30px_-24px_rgba(0,0,0,0.55)]"
            style={{ animationDelay: "40ms" }}
          >
            <div className="relative aspect-[16/10] w-full bg-muted">
              <img
                src={emptyDriverStateAsset.url}
                alt="Pas encore de chauffeur"
                loading="eager"
                decoding="async"
                draggable={false}
                className="size-full cursor-default object-cover"
              />
            </div>
            <div className="p-5 text-center">
              <p className="text-sm font-bold">Votre réseau est vide</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Scannez le QR code d'un chauffeur ou explorez l'annuaire pour ajouter vos premiers professionnels.
              </p>
            </div>
          </div>
        ) : (
          <div className="home-rise" style={{ animationDelay: "40ms" }}>
            <HomeDriverCard
              drivers={drivers}
              index={safeIndex}
              onGo={goToDriver}
              dir={dir}
              loading={data.isLoading || photosPending}
            />
          </div>
        )}

        <section className="home-rise space-y-2" style={{ animationDelay: "90ms" }}>
          {noDriver ? (
            <>
              <Link
                to="/espace/decouvrir"
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-[15px] font-extrabold text-primary-foreground transition active:scale-[0.985]"
              >
                <Compass className="size-5" /> Trouver un chauffeur
              </Link>
              <Link
                to="/espace/chauffeurs"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/35 bg-card px-3 text-[14px] font-bold text-primary transition active:scale-[0.985]"
              >
                <QrCode className="size-4" /> J'ai un QR code chauffeur
              </Link>
            </>
          ) : (
            <>
              {selectedDriver?.slug ? (
                <Link
                  to="/chauffeur/$slug"
                  params={{ slug: selectedDriver.slug }}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-[15px] font-extrabold text-primary-foreground transition active:scale-[0.985]"
                >
                  Voir le profil et contacter
                </Link>
              ) : null}
              <Link
                to="/espace/chauffeurs"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/35 bg-card px-3 text-[14px] font-bold text-primary transition active:scale-[0.985]"
              >
                <Users className="size-4" /> Tous mes chauffeurs ({connectionsCount})
              </Link>
            </>
          )}
        </section>

        {noDriver ? null : (
          <VehicleFacts
            facts={selectedDriver?.facts ?? null}
            driverSlug={selectedDriver?.slug ?? null}
            driverKey={selectedDriver?.id ?? (data.isLoading ? "loading" : "empty")}
            anim={dir === "right" ? "driver-card-in-right" : dir === "left" ? "driver-card-in-left" : ""}
            loading={data.isLoading || photosPending}
            locked={false}
          />
        )}
      </main>
    </div>
  );
}
