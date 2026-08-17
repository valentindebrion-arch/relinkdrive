import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Car,
  PhoneCall,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { RIDE_STATUS_LABELS, formatDateTime } from "@/lib/labels";
import { useBlockingImmediate } from "@/lib/immediate-request";
import { useCountdown } from "@/components/ExpiryCountdown";
import { saveRequestDraft } from "@/lib/request-draft";
import { ConnectionDecor } from "@/components/client/ConnectionDecor";
import { DriverSpotlight, type SpotlightDriver } from "@/components/client/DriverSpotlight";
import { useSignedUrls } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

type HomeDriver = SpotlightDriver & { zone: string | null };

let selectedDriverMemory: string | null = null;

/** Léger retour haptique, facultatif et jamais nécessaire à la compréhension. */
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
  const blockingCountdown = useCountdown(blocking?.response_deadline ?? null);

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(selectedDriverMemory);

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
          supabase.from("profiles").select("id, full_name").in("id", ids),
          supabase.rpc("get_connected_driver_profiles"),
          supabase
            .from("vehicles")
            .select("id, driver_id, brand, model, color, photo_url, is_primary, updated_at")
            .in("driver_id", ids),
        ]);
        const counts = new Map<string, number>();
        (rides ?? []).forEach((r) => counts.set(r.driver_id, (counts.get(r.driver_id) ?? 0) + 1));
        let favoriteId: string | null = null;
        counts.forEach((n, id) => {
          if (n > (favoriteId ? (counts.get(favoriteId) ?? 0) : 0)) favoriteId = id;
        });
        drivers = ids.map((id) => {
          const profile = (profiles ?? []).find((p) => p.id === id);
          const dp = (dprofiles ?? []).find((d) => d.user_id === id);
          const car =
            (vehicles ?? []).find((v) => v.driver_id === id && v.is_primary) ??
            (vehicles ?? []).find((v) => v.driver_id === id);
          return {
            id,
            name: dp?.business_name || profile?.full_name || "Chauffeur",
            available: dp?.on_duty ?? false,
            vehicle: car ? [car.brand, car.model].filter(Boolean).join(" ") || null : null,
            activeVehicleId: car?.id ?? null,
            vehiclePhotoPath: car?.photo_url ?? null,
            vehiclePhotoVersion: car?.updated_at ?? null,
            zone: dp?.zone ?? null,
            slug: dp?.slug ?? null,
            favorite: id === favoriteId,
          };
        });
      }
      return { requests: requests ?? [], rides: rides ?? [], drivers };
    },
  });

  const rawDrivers = useMemo(() => data.data?.drivers ?? [], [data.data?.drivers]);
  // Les photos sont stockées en privé : le chemin permanent est la source de vérité,
  // l'URL signée est mise en cache (clé = bucket + chemins) et renouvelée si besoin.
  const photos = useSignedUrls(
    "vehicles",
    rawDrivers.map((d) => d.vehiclePhotoPath),
    rawDrivers.map((d) => d.vehiclePhotoVersion),
  );
  const photoUrls = photos.data;
  const drivers = useMemo(
    () =>
      rawDrivers.map((d) => ({
        ...d,
        vehiclePhotoUrl: d.vehiclePhotoPath ? (photoUrls?.[d.vehiclePhotoPath] ?? null) : null,
      })),
    [rawDrivers, photoUrls],
  );
  // Tant que les URL signées ne sont pas résolues, on garde le skeleton :
  // jamais le placeholder « photo indisponible » sur un véhicule qui en a une.
  const photosPending = photos.isPending && rawDrivers.some((d) => !!d.vehiclePhotoPath);
  const rides = data.data?.rides ?? [];
  const requests = data.data?.requests ?? [];

  // Le chauffeur sélectionné est restauré par identifiant, jamais par la
  // position momentanée du carrousel lors d'un retour de route.
  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || !drivers.length) return;
    primed.current = true;
    if (selectedDriverId && drivers.some((driver) => driver.id === selectedDriverId)) return;
    const fav = drivers.findIndex((d) => d.favorite);
    const initial = drivers[fav >= 0 ? fav : 0]?.id ?? null;
    selectedDriverMemory = initial;
    setSelectedDriverId(initial);
  }, [drivers, selectedDriverId]);

  const restoredIndex = selectedDriverId
    ? drivers.findIndex((driver) => driver.id === selectedDriverId)
    : -1;
  const safeIndex = restoredIndex >= 0 ? restoredIndex : 0;
  const selectedDriver = drivers[safeIndex] ?? null;

  function selectDriver(nextIndex: number) {
    const nextId = drivers[nextIndex]?.id ?? null;
    selectedDriverMemory = nextId;
    setSelectedDriverId(nextId);
  }

  const activeRide = rides.find((r) =>
    ["driver_enroute", "driver_arrived", "client_onboard", "in_progress"].includes(r.status),
  );
  const nextRide = rides
    .filter(
      (r) =>
        new Date(r.scheduled_at) >= new Date() && !["cancelled", "completed"].includes(r.status),
    )
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  
  const pendingLocal = requests.find(
    (r) =>
      ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status) &&
      !rides.some((ride) => ride.request_id === r.id),
  );

  const firstName = (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ?? "";
  const driverName = (id: string | null | undefined) =>
    drivers.find((d) => d.id === id)?.name.split(" ")[0] ?? "Votre chauffeur";

  const shortName = selectedDriver?.name ?? "";
  const bookLabel =
    shortName && shortName.length <= 16
      ? `Réserver auprès de ${shortName}`
      : "Réserver auprès de ce chauffeur";


  function startRequest(mode: "now" | "later") {
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

  /** Action principale unique, déduite de la situation courante. */
  const primary: { label: string; onClick: () => void } = activeRide
    ? {
        label: "Suivre ma course",
        onClick: () => void navigate({ to: "/espace/suivi/$id", params: { id: activeRide.id } }),
      }
    : blocking
      ? {
          label: "Suivre ma demande",
          onClick: () =>
            void navigate({ to: "/espace/suivi/$id", params: { id: blocking.request_id } }),
        }
      : pendingLocal
        ? {
            label: "Suivre ma demande",
            onClick: () =>
              void navigate({ to: "/espace/suivi/$id", params: { id: pendingLocal.id } }),
          }
        : nextRide
          ? {
              label: "Voir ma prochaine course",
              onClick: () =>
                void navigate({ to: "/espace/suivi/$id", params: { id: nextRide.id } }),
            }
          : selectedDriver?.available
            ? { label: bookLabel, onClick: () => startRequest("now") }
            : { label: "Planifier avec ce chauffeur", onClick: () => startRequest("later") };

  const showSecondary = primary.label === bookLabel;
  const noDriver = !data.isLoading && drivers.length === 0;

  const shortcuts = [
    { label: "Mes courses", icon: Car, onClick: () => void navigate({ to: "/espace/courses" }) },
    {
      label: "Mes chauffeurs",
      icon: Users,
      onClick: () => void navigate({ to: "/espace/chauffeurs" }),
    },
    {
      label: "Contacter",
      icon: PhoneCall,
      onClick: () =>
        void (selectedDriver?.slug
          ? navigate({ to: "/chauffeur/$slug", params: { slug: selectedDriver.slug } })
          : navigate({ to: "/espace/chauffeurs" })),
    },
    {
      label: "Ajouter un chauffeur",
      icon: UserPlus,
      onClick: () => void navigate({ to: "/espace/chauffeurs" }),
    },
  ];

  // Contenu unique de la carte « Aujourd'hui » (hauteur stable, transition en fondu).
  const today: { key: string; node: React.ReactNode } = data.isLoading
    ? {
        key: "loading",
        node: (
          <div className="mt-2 space-y-1.5">
            <span className="block h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        ),
      }
    : activeRide
      ? {
          key: `active-${activeRide.id}`,
          node: (
            <TodayRow
              title={RIDE_STATUS_LABELS[activeRide.status] ?? activeRide.status}
              detail={`${driverName(activeRide.driver_id)} · ${activeRide.pickup_address}`}
              action="Suivre ma course"
              to={activeRide.id}
              spinning
            />
          ),
        }
      : blocking
        ? {
            key: `blocking-${blocking.request_id}`,
            node: (
              <TodayRow
                title="En attente de la réponse du chauffeur"
                detail={`${blocking.driver_first_name ?? "Votre chauffeur"}${
                  blockingCountdown ? ` · réponse sous ${blockingCountdown.label}` : ""
                }`}
                action="Suivre ma demande"
                to={blocking.request_id}
                spinning
              />
            ),
          }
        : pendingLocal
          ? {
              key: `pending-${pendingLocal.id}`,
              node: (
                <TodayRow
                  title="En attente de la réponse du chauffeur"
                  detail={driverName(pendingLocal.driver_id)}
                  action="Suivre ma demande"
                  to={pendingLocal.id}
                  spinning
                />
              ),
            }
          : nextRide
            ? {
                key: `next-${nextRide.id}`,
                node: (
                  <TodayRow
                    title={formatDateTime(nextRide.scheduled_at)}
                    detail={`${driverName(nextRide.driver_id)} · ${nextRide.pickup_address}`}
                    action="Voir la course"
                    to={nextRide.id}
                  />
                ),
              }
            : {
                key: "empty",
                node: (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[14px] font-semibold">
                      Aucune course prévue
                    </p>
                    <Link to="/espace/courses" className="shrink-0 text-[13px] font-bold text-primary">
                      Voir mon activité
                    </Link>
                  </div>
                ),
              };

  return (
    <div
      className="home-screen relative isolate flex w-full max-w-full flex-col overflow-x-hidden bg-muted/30"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <ConnectionDecor />

      {/* 1. En-tête compact */}
      <header className="home-rise relative shrink-0 px-4 pt-2 pb-0.5">
        <div className="flex items-center justify-center">
          <BrandLogo to="/espace" size="sm" />
          <NotificationBell className="absolute top-1 right-3" />
        </div>
        <p className="mt-1 text-center text-[14px] font-semibold sm:text-[15px]">
          {firstName ? `Bonjour ${firstName} 👋` : "Bonjour 👋"}
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col justify-between gap-[var(--home-gap)] px-4 pt-[var(--home-gap)] pb-[calc(var(--home-tabbar-h)+var(--home-gap))]">
        {/* 2 & 3. Carte du chauffeur sélectionné + carrousel */}
        <div className="home-rise" style={{ animationDelay: "40ms" }}>
          <DriverSpotlight
            drivers={drivers}
            index={safeIndex}
            onIndexChange={selectDriver}
            loading={data.isLoading || photosPending}
            onPhotoRefresh={() => photos.refetch()}
          />
        </div>

        {/* 4 & 5. Action principale + action secondaire */}
        <section
          className="home-rise shrink-0 space-y-[calc(var(--home-gap)*0.7)]"
          style={{ animationDelay: "90ms" }}
        >
          {noDriver ? (
            <Link
              to="/espace/chauffeurs"
              className="group flex min-h-[var(--home-btn-h)] w-full items-center justify-center gap-2 rounded-3xl bg-primary px-3 text-center text-[15px] font-extrabold text-primary-foreground shadow-[0_8px_20px_-14px_rgba(0,0,0,0.6)] transition-transform duration-200 active:scale-[0.985] sm:text-[16px]"
            >
              Ajouter un chauffeur
              <ArrowRight className="size-5 shrink-0 transition-transform duration-200 group-active:translate-x-1" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                haptic();
                primary.onClick();
              }}
              disabled={data.isLoading}
              className="group flex min-h-[var(--home-btn-h)] w-full items-center justify-center gap-2 rounded-3xl bg-primary px-3 text-center text-[15px] leading-tight font-extrabold text-primary-foreground shadow-[0_8px_20px_-14px_rgba(0,0,0,0.6)] transition-all duration-200 active:scale-[0.985] active:shadow-none disabled:opacity-70 sm:text-[16px]"
            >
              {data.isLoading ? <Loader2 className="size-5 shrink-0 animate-spin" /> : null}
              {primary.label}
              <ArrowRight className="size-5 shrink-0 transition-transform duration-200 group-active:translate-x-1" />
            </button>
          )}

          {showSecondary ? (
            <button
              type="button"
              onClick={() => startRequest("later")}
              className="flex min-h-[var(--home-btn2-h)] w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card px-3 text-[13px] leading-tight font-bold text-primary transition-transform duration-200 active:scale-[0.985] sm:text-[14px]"
            >
              <CalendarClock className="size-4 shrink-0" /> Planifier avec ce chauffeur
            </button>
          ) : null}
        </section>

        {/* 6. Raccourcis fixes */}
        <section
          className="home-rise grid shrink-0 grid-cols-2 gap-[calc(var(--home-gap)*0.7)]"
          style={{ animationDelay: "140ms" }}
        >
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                haptic();
                s.onClick();
              }}
              className="group flex min-h-[var(--home-shortcut-h)] items-center gap-1.5 rounded-2xl border border-primary/20 bg-card px-2 py-1.5 text-left shadow-[0_4px_14px_-12px_rgba(0,0,0,0.5)] transition-colors duration-200 active:bg-primary/5 sm:gap-2 sm:px-3"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-active:scale-105 sm:size-8">
                <s.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] leading-tight font-bold break-words hyphens-auto sm:text-[13px]">
                {s.label}
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
            </button>
          ))}
        </section>

        {/* 7. Zone contextuelle « Aujourd'hui » */}
        <section
          className="home-rise flex min-h-[var(--home-today-h)] shrink-0 flex-col justify-center rounded-2xl border border-border/70 bg-card px-3 py-2 shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)] sm:px-4"
          style={{ animationDelay: "190ms" }}
        >
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Aujourd'hui
          </p>
          <div key={today.key} className="today-swap">
            {today.node}
          </div>
        </section>
      </main>
    </div>
  );
}


function TodayRow({
  title,
  detail,
  action,
  to,
  spinning = false,
}: {
  title: string;
  detail: string;
  action: string;
  to: string;
  spinning?: boolean;
}) {
  return (
    <div className="mt-1 flex items-center gap-2">
      {spinning ? <Loader2 className="size-4 shrink-0 animate-spin text-primary" /> : (
        <CalendarDays className="size-4 shrink-0 text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-extrabold">{title}</p>
        <p className="truncate text-[12px] text-muted-foreground">{detail}</p>
      </div>
      <Link
        to="/espace/suivi/$id"
        params={{ id: to }}
        className="shrink-0 text-[13px] font-bold text-primary"
      >
        {action}
      </Link>
    </div>
  );
}
