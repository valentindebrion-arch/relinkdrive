import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Car,
  ChevronRight,
  Clock3,
  Loader2,
  LocateFixed,
  QrCode,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { RIDE_STATUS_LABELS, formatDateTime } from "@/lib/labels";
import { useBlockingImmediate } from "@/lib/immediate-request";
import { useCountdown } from "@/components/ExpiryCountdown";
import { AddressSearchPanel, pushRecentAddress } from "@/components/request/AddressSearchPanel";
import { DriverPickerSheet } from "@/components/request/DriverPickerSheet";
import { ScheduleSheet } from "@/components/request/ScheduleSheet";
import { reverseGeocode } from "@/lib/route-estimate.functions";
import { saveRequestDraft } from "@/lib/request-draft";

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

/** Décor abstrait de la zone supérieure : formes douces, aucune carte. */
function HeroDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -top-16 -right-10 size-56 rounded-full bg-primary-foreground/10" />
      <span className="absolute -bottom-24 -left-16 size-64 rounded-full bg-primary-foreground/[0.08]" />
      <span className="absolute top-10 left-1/2 h-px w-2/3 -translate-x-1/2 rounded-full bg-primary-foreground/20" />
      <svg
        viewBox="0 0 400 120"
        className="absolute inset-x-0 bottom-0 h-24 w-full text-primary-foreground/15"
        preserveAspectRatio="none"
      >
        <path
          d="M0 90 C 90 40, 150 110, 240 60 S 360 20, 400 45"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="10 12"
        />
      </svg>
    </div>
  );
}

function ClientHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const geocodeFn = useServerFn(reverseGeocode);

  const blocking = useBlockingImmediate().data ?? null;
  const blockingCountdown = useCountdown(blocking?.response_deadline ?? null);

  const [driverId, setDriverId] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [whenMode, setWhenMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [searchField, setSearchField] = useState<"pickup" | "dropoff" | null>(null);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [locating, setLocating] = useState(false);

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
      let drivers: {
        id: string;
        name: string;
        available: boolean;
        vehicle: string | null;
        zone: string | null;
        favorite: boolean;
      }[] = [];
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
            name: profile?.full_name || "Chauffeur",
            available: dp?.on_duty ?? false,
            vehicle: car ? [car.brand, car.model].filter(Boolean).join(" ") || null : null,
            zone: dp?.zone ?? null,
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

  const selectedDriver =
    drivers.find((d) => d.id === driverId) ?? drivers.find((d) => d.favorite) ?? drivers[0] ?? null;

  const activeRide = rides.find((r) =>
    ["driver_enroute", "driver_arrived", "client_onboard", "in_progress"].includes(r.status),
  );
  const nextRide = rides
    .filter(
      (r) =>
        new Date(r.scheduled_at) >= new Date() && !["cancelled", "completed"].includes(r.status),
    )
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  const pendingRequest = requests.find(
    (r) =>
      ["new", "reviewing", "proposal_sent", "awaiting_client"].includes(r.status) &&
      !rides.some((ride) => ride.request_id === r.id),
  );

  const firstName = (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ?? "";
  const driverName = (id: string | null | undefined) =>
    drivers.find((d) => d.id === id)?.name.split(" ")[0] ?? "Votre chauffeur";

  function goToForm() {
    saveRequestDraft({
      driver_id: selectedDriver?.id ?? "",
      pickup_address: pickup,
      dropoff_address: dropoff,
      scheduled_at: scheduledAt,
      whenMode,
      pickupOk: !!pickup,
      dropoffOk: !!dropoff,
    });
    void navigate({ to: "/espace/demandes" });
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Votre position n'est pas accessible. Saisissez votre lieu de départ manuellement.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await geocodeFn({
            data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          setPickup(res.address);
          pushRecentAddress(res.address);
          setSearchField(null);
        } catch {
          toast.error("Adresse introuvable à votre position. Saisissez-la manuellement.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error(
          "Votre position n'est pas accessible. Saisissez votre lieu de départ manuellement.",
        );
      },
      { timeout: 8000 },
    );
  }

  const noDriver = !data.isLoading && drivers.length === 0;

  return (
    <div className="min-h-[100dvh] bg-muted/40 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Zone supérieure verte */}
      <header
        className="relative overflow-hidden bg-primary px-4 pb-10 text-primary-foreground sm:pb-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <HeroDecor />
        <div className="relative flex justify-center">
          <div className="rounded-full bg-card px-3.5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.12)]">
            <BrandLogo to="/espace" size="sm" />
          </div>
        </div>
        <div className="relative mt-6">
          <p className="text-[15px] font-semibold text-primary-foreground/80">
            {firstName ? `Bonjour ${firstName}` : "Bonjour"}
          </p>
          <h1 className="mt-1 text-[26px] leading-tight font-extrabold tracking-tight">
            Où souhaitez-vous aller ?
          </h1>
          <p className="mt-1.5 text-[13px] text-primary-foreground/80">
            Réservez votre chauffeur de confiance en quelques instants.
          </p>
        </div>
      </header>

      <div className="mx-auto -mt-6 w-full max-w-md space-y-3 px-3 sm:max-w-lg">
        {/* Course active en priorité */}
        {activeRide ? (
          <Link
            to="/espace/suivi/$id"
            params={{ id: activeRide.id }}
            className="block rounded-3xl border border-primary/30 bg-card p-4 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-primary/15">
                <Loader2 className="size-4 animate-spin text-primary" />
              </span>
              <p className="text-[15px] font-extrabold">
                {RIDE_STATUS_LABELS[activeRide.status] ?? activeRide.status}
              </p>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {driverName(activeRide.driver_id)} · {formatDateTime(activeRide.scheduled_at)}
            </p>
            <p className="mt-1 truncate text-[13px] font-semibold">
              {activeRide.pickup_address} → {activeRide.dropoff_address}
            </p>
            <span className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-[14px] font-bold text-primary-foreground">
              Voir ma course <ArrowRight className="size-4" />
            </span>
          </Link>
        ) : null}

        {/* Demande « Maintenant » en attente */}
        {blocking ? (
          <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.5)]">
            <p className="text-[15px] font-extrabold">Votre demande est en attente</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {blocking.driver_first_name ?? "Votre chauffeur"} n'a pas encore répondu.
            </p>
            {blockingCountdown ? (
              <p className="mt-2 text-[13px] font-bold tabular-nums text-primary">
                Réponse sous {blockingCountdown.label}
              </p>
            ) : null}
            <Link
              to="/espace/suivi/$id"
              params={{ id: blocking.request_id }}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-[15px] font-bold text-primary-foreground"
            >
              Suivre ma demande <ArrowRight className="size-4" />
            </Link>
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              Une nouvelle course « Maintenant » sera possible après réponse, annulation ou
              expiration.
            </p>
          </section>
        ) : noDriver ? (
          /* Aucun chauffeur enregistré */
          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.5)]">
            <p className="text-[17px] font-extrabold">Ajoutez votre premier chauffeur</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Scannez son QR code ou utilisez son lien pour pouvoir lui demander une course.
            </p>
            <div className="mt-4 grid gap-2">
              <Link
                to="/espace/chauffeurs"
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-bold text-primary-foreground"
              >
                <QrCode className="size-4" /> Scanner un QR code
              </Link>
              <Link
                to="/espace/chauffeurs"
                className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-[15px] font-bold"
              >
                <UserRound className="size-4" /> Ajouter un chauffeur
              </Link>
            </div>
          </section>
        ) : (
          /* Bloc de réservation */
          <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-[0_14px_40px_-24px_rgba(0,0,0,0.55)]">
            <button
              type="button"
              onClick={() => setDriverPickerOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl bg-muted/60 p-3 text-left"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-[14px] font-extrabold text-primary">
                {selectedDriver
                  ? selectedDriver.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">
                  {selectedDriver ? selectedDriver.name.split(" ")[0] : "Choisir un chauffeur"}
                </span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {selectedDriver
                    ? [
                        selectedDriver.available ? "Disponible" : "Hors service",
                        selectedDriver.vehicle,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Obligatoire pour envoyer une demande"}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-bold text-primary">
                {selectedDriver ? "Modifier" : "Choisir"}
              </span>
            </button>

            {/* Départ / destination reliés par une ligne verticale */}
            <div className="relative mt-3 pl-6">
              <span className="absolute top-5 left-[5px] h-[calc(100%-2.5rem)] w-px bg-primary/30" />
              <button
                type="button"
                onClick={() => setSearchField("pickup")}
                className="relative block w-full py-2 text-left"
              >
                <span className="absolute top-3.5 -left-6 size-2.5 rounded-full bg-primary" />
                <span className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Départ
                </span>
                <span
                  className={`block truncate text-[15px] font-semibold ${pickup ? "" : "text-muted-foreground"}`}
                >
                  {pickup || "Votre position ou une adresse"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSearchField("dropoff")}
                className="relative block w-full py-2 text-left"
              >
                <span className="absolute top-3.5 -left-6 size-2.5 rounded-[3px] bg-foreground" />
                <span className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Destination
                </span>
                <span
                  className={`block truncate text-[15px] font-semibold ${dropoff ? "" : "text-muted-foreground"}`}
                >
                  {dropoff || "Où souhaitez-vous aller ?"}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={useMyLocation}
              className="mt-1 flex items-center gap-1.5 text-[13px] font-bold text-primary"
            >
              {locating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LocateFixed className="size-3.5" />
              )}
              Utiliser ma position
            </button>

            <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
              {(
                [
                  { key: "now", label: "Maintenant", icon: Clock3 },
                  { key: "later", label: "Planifier", icon: CalendarClock },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setWhenMode(opt.key);
                    if (opt.key === "later" && selectedDriver && pickup && dropoff) {
                      setScheduleOpen(true);
                    }
                  }}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold transition-colors ${
                    whenMode === opt.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  <opt.icon className="size-4" />
                  {opt.label}
                </button>
              ))}
            </div>
            {whenMode === "later" && scheduledAt ? (
              <p className="mt-2 text-center text-[13px] font-semibold text-primary">
                {formatDateTime(new Date(scheduledAt).toISOString())}
              </p>
            ) : null}

            <button
              type="button"
              onClick={goToForm}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-extrabold text-primary-foreground transition-transform active:scale-[0.99]"
            >
              Estimer ma course <ArrowRight className="size-4" />
            </button>
          </section>
        )}

        {/* Prochaine course planifiée */}
        {!activeRide && nextRide ? (
          <Link
            to="/espace/suivi/$id"
            params={{ id: nextRide.id }}
            className="block rounded-3xl border border-border/70 bg-card p-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]"
          >
            <p className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">
              Votre prochaine course
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[15px] font-extrabold">
              <CalendarDays className="size-4 text-primary" />
              {formatDateTime(nextRide.scheduled_at)}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {driverName(nextRide.driver_id)}
            </p>
            <p className="mt-1 truncate text-[13px] font-semibold">
              {nextRide.pickup_address} → {nextRide.dropoff_address}
            </p>
            <span className="mt-2 flex items-center gap-1 text-[13px] font-bold text-primary">
              Voir la course <ChevronRight className="size-4" />
            </span>
          </Link>
        ) : null}

        {pendingRequest && !blocking ? (
          <Link
            to="/espace/suivi/$id"
            params={{ id: pendingRequest.id }}
            className="flex items-center gap-2 rounded-3xl border border-border/70 bg-card p-4 text-[14px] font-semibold shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]"
          >
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <span className="min-w-0 flex-1 truncate">Demande envoyée · en attente de réponse</span>
            <ChevronRight className="size-4 shrink-0 text-primary" />
          </Link>
        ) : null}

      </div>

      {searchField ? (
        <AddressSearchPanel
          field={searchField}
          initialValue={searchField === "pickup" ? pickup : dropoff}
          locating={locating}
          {...(searchField === "pickup" ? { onUseMyLocation: useMyLocation } : {})}
          onClose={() => setSearchField(null)}
          onSelect={(address) => {
            if (searchField === "pickup") setPickup(address);
            else setDropoff(address);
            setSearchField(null);
          }}
        />
      ) : null}

      <DriverPickerSheet
        open={driverPickerOpen}
        onOpenChange={setDriverPickerOpen}
        loading={data.isLoading}
        selectedId={selectedDriver?.id ?? ""}
        drivers={drivers}
        onSelect={(id) => {
          setDriverId(id);
          setDriverPickerOpen(false);
        }}
        onScanQr={() => {
          setDriverPickerOpen(false);
          void navigate({ to: "/espace/chauffeurs" });
        }}
        onAddDriver={() => {
          setDriverPickerOpen(false);
          void navigate({ to: "/espace/chauffeurs" });
        }}
      />

      {scheduleOpen && selectedDriver && pickup && dropoff ? (
        <ScheduleSheet
          open
          driverId={selectedDriver.id}
          driverName={selectedDriver.name.split(" ")[0] ?? "votre chauffeur"}
          pickup={pickup}
          dropoff={dropoff}
          roundTrip={false}
          valueIso={scheduledAt || null}
          onClose={() => setScheduleOpen(false)}
          onConfirm={(iso) => {
            setScheduledAt(iso);
            setScheduleOpen(false);
          }}
          onChangeDriver={() => {
            setScheduleOpen(false);
            setDriverPickerOpen(true);
          }}
        />
      ) : null}
    </div>
  );
}
