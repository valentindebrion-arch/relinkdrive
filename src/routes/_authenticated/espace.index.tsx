import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Car,
  LifeBuoy,
  Loader2,
  QrCode,
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

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

type HomeDriver = {
  id: string;
  name: string;
  available: boolean;
  vehicle: string | null;
  zone: string | null;
  slug: string | null;
  favorite: boolean;
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Lignes de connexion décoratives derrière le chauffeur (non cliquables). */
function ConnectDecor() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 240 240"
      className="pointer-events-none absolute inset-0 h-full w-full text-primary/25"
    >
      <circle cx="120" cy="120" r="112" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
      <path d="M8 120 H48" stroke="currentColor" strokeWidth="1" />
      <path d="M192 120 H232" stroke="currentColor" strokeWidth="1" />
      <path d="M120 8 V44" stroke="currentColor" strokeWidth="1" />
      <circle cx="18" cy="120" r="3" fill="currentColor" />
      <circle cx="222" cy="120" r="3" fill="currentColor" />
      <circle cx="120" cy="14" r="3" fill="currentColor" />
    </svg>
  );
}

function ClientHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const blocking = useBlockingImmediate().data ?? null;
  const blockingCountdown = useCountdown(blocking?.response_deadline ?? null);

  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

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
            .select("driver_id, brand, model, is_primary")
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
            zone: dp?.zone ?? null,
            slug: dp?.slug ?? null,
            favorite: id === favoriteId,
          };
        });
      }
      return { requests: requests ?? [], rides: rides ?? [], drivers };
    },
  });

  const drivers = useMemo(() => data.data?.drivers ?? [], [data.data?.drivers]);
  const rides = data.data?.rides ?? [];
  const requests = data.data?.requests ?? [];

  // Chauffeur favori mis en avant au premier affichage.
  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || !drivers.length) return;
    primed.current = true;
    const fav = drivers.findIndex((d) => d.favorite);
    if (fav > 0) setIndex(fav);
  }, [drivers]);

  const safeIndex = drivers.length ? Math.min(index, drivers.length - 1) : 0;
  const selectedDriver = drivers[safeIndex] ?? null;

  const activeRide = rides.find((r) =>
    ["driver_enroute", "driver_arrived", "client_onboard", "in_progress"].includes(r.status),
  );
  const nextRide = rides
    .filter(
      (r) =>
        new Date(r.scheduled_at) >= new Date() && !["cancelled", "completed"].includes(r.status),
    )
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  const pendingRequest =
    blocking ??
    (requests.find(
      (r) =>
        ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status) &&
        !rides.some((ride) => ride.request_id === r.id),
    )
      ? null
      : null);
  const pendingLocal = requests.find(
    (r) =>
      ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status) &&
      !rides.some((ride) => ride.request_id === r.id),
  );

  const firstName = (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ?? "";
  const driverName = (id: string | null | undefined) =>
    drivers.find((d) => d.id === id)?.name.split(" ")[0] ?? "Votre chauffeur";

  function go(delta: number) {
    if (drivers.length < 2) return;
    setIndex((i) => (i + delta + drivers.length) % drivers.length);
  }

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
            ? { label: "Commander une course", onClick: () => startRequest("now") }
            : { label: "Planifier un trajet", onClick: () => startRequest("later") };

  const showSecondary = primary.label === "Commander une course";
  const noDriver = !data.isLoading && drivers.length === 0;

  const shortcuts = [
    { label: "Planifier", icon: CalendarClock, onClick: () => startRequest("later") },
    { label: "Mes courses", icon: Car, onClick: () => void navigate({ to: "/espace/courses" }) },
    { label: "Mes chauffeurs", icon: Users, onClick: () => void navigate({ to: "/espace/chauffeurs" }) },
    { label: "Assistance", icon: LifeBuoy, onClick: () => void navigate({ to: "/aide" }) },
  ];

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-muted/30"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* 1. En-tête compact */}
      <header className="relative shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center justify-center">
          <BrandLogo to="/espace" size="sm" />
          <NotificationBell className="absolute top-3 right-3" />
        </div>
        <p className="mt-2 text-center text-[15px] font-semibold">
          {firstName ? `Bonjour ${firstName} 👋` : "Bonjour 👋"}
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        {/* 2 & 3. Chauffeur sélectionné */}
        <section
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center"
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            const end = e.changedTouches[0]?.clientX;
            if (start == null || end == null) return;
            const dx = end - start;
            if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="relative flex w-full max-w-xs items-center justify-center">
            {drivers.length > 1 ? (
              <button
                type="button"
                aria-label="Chauffeur précédent"
                onClick={() => go(-1)}
                className="absolute left-0 grid size-9 place-items-center rounded-full border border-primary/25 bg-card text-primary shadow-sm"
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : null}

            <div className="relative grid size-[clamp(9.5rem,34vw,12rem)] place-items-center rounded-full border border-primary/40 bg-primary/[0.06]">
              <ConnectDecor />
              {data.isLoading ? (
                <span className="size-16 animate-pulse rounded-full bg-primary/15" />
              ) : selectedDriver ? (
                <div className="relative flex flex-col items-center px-4 text-center">
                  <span
                    className={`grid size-14 place-items-center rounded-full bg-primary/12 text-[17px] font-extrabold text-primary ${
                      selectedDriver.available ? "animate-pulse" : ""
                    }`}
                  >
                    {initials(selectedDriver.name)}
                  </span>
                  <p className="mt-1.5 line-clamp-1 text-[15px] font-extrabold">
                    {selectedDriver.name}
                  </p>
                  <p
                    className={`text-[12px] font-semibold ${
                      selectedDriver.available ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {selectedDriver.available ? "Disponible maintenant" : "Indisponible"}
                  </p>
                  <p className="line-clamp-1 text-[12px] text-muted-foreground">
                    {selectedDriver.vehicle ?? "Véhicule non renseigné"}
                  </p>
                  {selectedDriver.slug ? (
                    <Link
                      to="/chauffeur/$slug"
                      params={{ slug: selectedDriver.slug }}
                      className="mt-0.5 text-[12px] font-bold text-primary underline underline-offset-2"
                    >
                      Voir le profil
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className="relative px-6 text-center">
                  <QrCode className="mx-auto size-6 text-primary" />
                  <p className="mt-1.5 text-[13px] font-bold">Aucun chauffeur</p>
                  <p className="text-[12px] text-muted-foreground">Scannez un QR code</p>
                </div>
              )}
            </div>

            {drivers.length > 1 ? (
              <button
                type="button"
                aria-label="Chauffeur suivant"
                onClick={() => go(1)}
                className="absolute right-0 grid size-9 place-items-center rounded-full border border-primary/25 bg-card text-primary shadow-sm"
              >
                <ChevronRight className="size-5" />
              </button>
            ) : null}
          </div>

          {drivers.length > 1 ? (
            <div className="mt-2.5 flex items-center gap-1.5">
              {drivers.map((d, i) => (
                <span
                  key={d.id}
                  className={`size-1.5 rounded-full transition-colors ${
                    i === safeIndex ? "bg-primary" : "bg-primary/25"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </section>

        {/* 4 & 5. Action principale + action secondaire */}
        <section className="shrink-0 space-y-2">
          {noDriver ? (
            <Link
              to="/espace/chauffeurs"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-[16px] font-extrabold text-primary-foreground shadow-[0_8px_20px_-14px_rgba(0,0,0,0.6)]"
            >
              Ajouter un chauffeur <ArrowRight className="size-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={primary.onClick}
              disabled={data.isLoading}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-[16px] font-extrabold text-primary-foreground shadow-[0_8px_20px_-14px_rgba(0,0,0,0.6)] transition-transform active:scale-[0.99] disabled:opacity-70"
            >
              {primary.label} <ArrowRight className="size-5" />
            </button>
          )}

          {showSecondary ? (
            <button
              type="button"
              onClick={() => startRequest("later")}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card text-[14px] font-bold text-primary"
            >
              <CalendarClock className="size-4" /> Planifier un trajet
            </button>
          ) : null}
        </section>

        {/* 6. Raccourcis fixes */}
        <section className="grid shrink-0 grid-cols-2 gap-2">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              className="flex min-h-[3.25rem] items-center gap-2 rounded-2xl border border-primary/20 bg-card px-3 text-left shadow-[0_4px_14px_-12px_rgba(0,0,0,0.5)]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{s.label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </section>

        {/* 7. Zone contextuelle « Aujourd'hui » */}
        <section className="flex h-[5.5rem] shrink-0 flex-col justify-center rounded-2xl border border-border/70 bg-card px-4 shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)]">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Aujourd'hui
          </p>
          {data.isLoading ? (
            <div className="mt-2 space-y-1.5">
              <span className="block h-3.5 w-2/3 animate-pulse rounded bg-muted" />
              <span className="block h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ) : activeRide ? (
            <TodayRow
              title={RIDE_STATUS_LABELS[activeRide.status] ?? activeRide.status}
              detail={`${driverName(activeRide.driver_id)} · ${activeRide.pickup_address}`}
              action="Suivre ma course"
              to={activeRide.id}
              spinning
            />
          ) : blocking ? (
            <TodayRow
              title="Demande en attente"
              detail={`${blocking.driver_first_name ?? "Votre chauffeur"}${
                blockingCountdown ? ` · réponse sous ${blockingCountdown.label}` : ""
              }`}
              action="Suivre ma demande"
              to={blocking.request_id}
              spinning
            />
          ) : pendingLocal ? (
            <TodayRow
              title="Demande en attente"
              detail={driverName(pendingLocal.driver_id)}
              action="Suivre ma demande"
              to={pendingLocal.id}
              spinning
            />
          ) : nextRide ? (
            <TodayRow
              title={formatDateTime(nextRide.scheduled_at)}
              detail={`${driverName(nextRide.driver_id)} · ${nextRide.pickup_address}`}
              action="Voir la course"
              to={nextRide.id}
            />
          ) : (
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[14px] font-semibold">Aucune course prévue</p>
              <Link
                to="/espace/courses"
                className="shrink-0 text-[13px] font-bold text-primary"
              >
                Voir mon activité
              </Link>
            </div>
          )}
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
