import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Accessibility,
  Baby,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Dog,
  Flag,
  Luggage,
  MapPin,
  Pencil,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchConnectedProfiles } from "@/lib/connected-profiles";
import { useAuth } from "@/lib/auth";
import { ClientTopBar } from "@/components/client/ClientTopBar";
import { ConnectionDecor } from "@/components/client/ConnectionDecor";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { DiscoverDriverCard, type DiscoverDriver } from "@/components/client/DiscoverDriverCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignedUrls } from "@/lib/storage";
import { discoverDrivers, resolveSearchDepartment } from "@/lib/driver-discovery.functions";
import { departmentFromText, departmentName } from "@/lib/departments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

type Need = "child_seat" | "booster_seat" | "luggage" | "pets" | "accessible";
type VehicleStyle =
  "all" | "relink_classic" | "luxury_black_gold" | "dynamic_red" | "professional_blue";

type SearchRequest = {
  origin: string;
  destination: string;
  date: string;
  vehicleStyle: VehicleStyle;
  passengers: number;
  needs: Need[];
  department: string | null;
  city: string | null;
};

type SearchSession = {
  origin: string;
  originConfirmed: boolean;
  destination: string;
  destinationConfirmed: boolean;
  date: string;
  vehicleStyle: VehicleStyle;
  passengers: number;
  needs: Need[];
  request: SearchRequest | null;
};

type SearchDriver = DiscoverDriver & {
  service_areas?: string[] | null;
  service_departments?: string[] | null;
  departments?: string[];
};

const NEEDS: {
  value: Need;
  label: string;
  shortLabel: string;
  icon: typeof Baby;
}[] = [
  { value: "child_seat", label: "Siège bébé", shortLabel: "Siège bébé", icon: Baby },
  { value: "booster_seat", label: "Rehausseur", shortLabel: "Rehausseur", icon: Baby },
  { value: "luggage", label: "Bagages volumineux", shortLabel: "Grands bagages", icon: Luggage },
  { value: "pets", label: "Animaux acceptés", shortLabel: "Animaux", icon: Dog },
  { value: "accessible", label: "Accessible PMR", shortLabel: "PMR", icon: Accessibility },
];

const VEHICLE_STYLES: {
  value: VehicleStyle;
  label: string;
  shortLabel: string;
  dotClass: string;
}[] = [
  { value: "all", label: "Tous les véhicules", shortLabel: "Tous", dotClass: "bg-slate-400" },
  {
    value: "relink_classic",
    label: "Écologique",
    shortLabel: "Écologique",
    dotClass: "bg-emerald-500",
  },
  { value: "luxury_black_gold", label: "Premium", shortLabel: "Premium", dotClass: "bg-amber-500" },
  { value: "dynamic_red", label: "Sport", shortLabel: "Sport", dotClass: "bg-red-500" },
  { value: "professional_blue", label: "Van", shortLabel: "Van", dotClass: "bg-blue-500" },
];

const SEARCH_SESSION_PREFIX = "relink:client-driver-search:";

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const todayDate = new Date();
const today = localDateValue(todayDate);
const monthLimitDate = new Date(todayDate);
monthLimitDate.setDate(monthLimitDate.getDate() + 31);
const monthLimit = localDateValue(monthLimitDate);
const WEEK_DAYS = Array.from({ length: 7 }, (_, offset) => {
  const date = new Date(todayDate);
  date.setDate(date.getDate() + offset);
  return {
    value: localDateValue(date),
    day:
      offset === 0
        ? "Aujourd'hui"
        : new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date),
    date: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date),
  };
});
function formatDateLabel(value: string) {
  if (!value) return "Choisir une date";
  if (value === today) return "Aujourd'hui";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dateFromValue(value));
}

function matchesRequest(driver: SearchDriver, request: SearchRequest) {
  if ((driver.max_passengers ?? 0) < request.passengers) return false;
  if (
    request.vehicleStyle !== "all" &&
    (driver.booking_theme ?? "relink_classic") !== request.vehicleStyle
  )
    return false;
  return request.needs.every((need) => {
    if (need === "child_seat") return !!driver.child_seat;
    if (need === "booster_seat") return !!driver.booster_seat;
    if (need === "luggage") return !!driver.large_trunk || (driver.large_luggage_capacity ?? 0) > 0;
    if (need === "pets")
      return (
        !!driver.pets_allowed || ["accepted", "conditional"].includes(driver.pets_policy ?? "")
      );
    if (need === "accessible") return !!driver.accessible;
    return true;
  });
}

function savedDriverCoversDepartment(driver: SearchDriver, department: string | null) {
  if (!department) return true;
  const explicit = (driver.service_departments ?? [])
    .map((value) => departmentFromText(value))
    .filter((value): value is string => !!value);
  if (explicit.length) return explicit.includes(department);
  const inferred = [...(driver.service_areas ?? []), driver.zone, driver.city]
    .map((value) => departmentFromText(value))
    .filter((value): value is string => !!value);
  // En l'absence de département exploitable, on conserve le chauffeur déjà
  // enregistré plutôt que de produire un faux négatif.
  return !inferred.length || inferred.includes(department);
}

function matchBadges(driver: SearchDriver, request: SearchRequest) {
  const badges = [`${driver.max_passengers ?? request.passengers} places`];
  for (const need of request.needs) {
    const label = NEEDS.find((item) => item.value === need)?.shortLabel;
    if (label) badges.push(label);
  }
  return badges;
}

function ClientHome() {
  const { user } = useAuth();
  const resolveDepartment = useServerFn(resolveSearchDepartment);
  const [origin, setOrigin] = useState("");
  const [originConfirmed, setOriginConfirmed] = useState(false);
  const [destination, setDestination] = useState("");
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [date, setDate] = useState("");
  const [vehicleStyle, setVehicleStyle] = useState<VehicleStyle>("all");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [exactDateOpen, setExactDateOpen] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [needsOpen, setNeedsOpen] = useState(false);
  const [request, setRequest] = useState<SearchRequest | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setSessionReady(false);
    setOrigin("");
    setOriginConfirmed(false);
    setDestination("");
    setDestinationConfirmed(false);
    setDate("");
    setVehicleStyle("all");
    setPassengers(1);
    setNeeds([]);
    setRequest(null);
    try {
      const stored = window.sessionStorage.getItem(`${SEARCH_SESSION_PREFIX}${user.id}`);
      if (stored) {
        const session = JSON.parse(stored) as SearchSession;
        setOrigin(session.origin ?? "");
        setOriginConfirmed(!!session.originConfirmed);
        setDestination(session.destination ?? "");
        setDestinationConfirmed(!!session.destinationConfirmed);
        setDate(session.date ?? "");
        setVehicleStyle(session.vehicleStyle ?? "all");
        setPassengers(Math.max(1, Math.min(8, session.passengers || 1)));
        setNeeds(Array.isArray(session.needs) ? session.needs : []);
        setRequest(session.request ?? null);
      }
    } catch {
      window.sessionStorage.removeItem(`${SEARCH_SESSION_PREFIX}${user.id}`);
    } finally {
      setSessionReady(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !sessionReady) return;
    const session: SearchSession = {
      origin,
      originConfirmed,
      destination,
      destinationConfirmed,
      date,
      vehicleStyle,
      passengers,
      needs,
      request,
    };
    window.sessionStorage.setItem(`${SEARCH_SESSION_PREFIX}${user.id}`, JSON.stringify(session));
  }, [
    user?.id,
    sessionReady,
    origin,
    originConfirmed,
    destination,
    destinationConfirmed,
    date,
    vehicleStyle,
    passengers,
    needs,
    request,
  ]);

  useEffect(() => {
    if (!request) return;
    const timer = window.setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
    return () => window.clearTimeout(timer);
  }, [request]);

  const savedQuery = useQuery({
    queryKey: ["client-home-saved-search", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: connections } = await supabase
        .from("driver_client_connections")
        .select("driver_id, created_at")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (connections ?? []).map((connection) => connection.driver_id);
      if (!ids.length) return [] as SearchDriver[];

      const [{ data: profiles }, { data: driverProfiles }, { data: vehicles }, { data: themes }] =
        await Promise.all([
          fetchConnectedProfiles(ids).then((profiles) => ({ data: profiles })),
          supabase.rpc("get_connected_driver_profiles"),
          supabase
            .from("vehicles")
            .select(
              "driver_id, brand, model, category, photo_front_url, photo_url, photo_side_url, max_passengers, large_luggage_capacity, cabin_luggage_capacity, pets_policy, pets_allowed, child_seat, booster_seat, stroller_space, accessible, large_trunk, is_primary, created_at",
            )
            .in("driver_id", ids)
            .order("is_primary", { ascending: false })
            .order("created_at", { ascending: true }),
          supabase.rpc("get_driver_themes", { _ids: ids }),
        ]);

      return ids.flatMap((id) => {
        const profile = (profiles ?? []).find((item) => item.id === id);
        const driver = (driverProfiles ?? []).find((item) => item.user_id === id);
        if (!driver) return [];
        const vehicle = (vehicles ?? []).find((item) => item.driver_id === id);
        return [
          {
            user_id: id,
            slug: driver.slug,
            display_name: driver.business_name || profile?.full_name || "Chauffeur",
            city: driver.city,
            zone: driver.zone,
            service_areas: driver.service_areas,
            vehicle_brand: vehicle?.brand ?? null,
            vehicle_model: vehicle?.model ?? null,
            vehicle_category: vehicle?.category ?? null,
            vehicle_photo_url:
              vehicle?.photo_front_url ?? vehicle?.photo_url ?? vehicle?.photo_side_url ?? null,
            max_passengers: vehicle?.max_passengers ?? null,
            on_duty: null,
            woman_for_woman: driver.woman_for_woman,
            booking_theme:
              (themes ?? []).find((item) => item.user_id === id)?.booking_theme ?? null,
            large_luggage_capacity: vehicle?.large_luggage_capacity ?? null,
            cabin_luggage_capacity: vehicle?.cabin_luggage_capacity ?? null,
            pets_policy: vehicle?.pets_policy ?? null,
            pets_allowed: vehicle?.pets_allowed ?? null,
            child_seat: vehicle?.child_seat ?? null,
            booster_seat: vehicle?.booster_seat ?? null,
            stroller_space: vehicle?.stroller_space ?? null,
            accessible: vehicle?.accessible ?? null,
            large_trunk: vehicle?.large_trunk ?? null,
          } satisfies SearchDriver,
        ];
      });
    },
  });

  const othersQuery = useQuery({
    queryKey: ["client-home-driver-search", request?.department, request?.origin],
    enabled: !!request,
    queryFn: async () => {
      const result = await discoverDrivers({
        data: {
          scope: request?.department ? "department" : "all",
          department: request?.department ?? null,
        },
      });
      return (result.drivers ?? []) as unknown as SearchDriver[];
    },
  });

  const savedMatches = useMemo(
    () =>
      request
        ? (savedQuery.data ?? []).filter(
            (driver) =>
              savedDriverCoversDepartment(driver, request.department) &&
              matchesRequest(driver, request),
          )
        : [],
    [request, savedQuery.data],
  );
  const otherMatches = useMemo(
    () =>
      request ? (othersQuery.data ?? []).filter((driver) => matchesRequest(driver, request)) : [],
    [request, othersQuery.data],
  );
  const allMatches = useMemo(
    () => [...savedMatches, ...otherMatches],
    [savedMatches, otherMatches],
  );
  const photos = useSignedUrls(
    "vehicles",
    allMatches.map((driver) => driver.vehicle_photo_url),
  );
  const photoOf = (driver: SearchDriver) =>
    driver.vehicle_photo_url ? (photos.data?.[driver.vehicle_photo_url] ?? null) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!originConfirmed || !destinationConfirmed) {
      setFormError("Sélectionnez le départ et la destination dans les suggestions.");
      return;
    }
    if (!date) {
      setFormError("Indiquez la date souhaitée.");
      return;
    }
    setResolving(true);
    try {
      const place = await resolveDepartment({ data: { origin } });
      setRequest({
        origin,
        destination,
        date,
        vehicleStyle,
        passengers,
        needs,
        department: place.department,
        city: place.city,
      });
      setNeedsOpen(false);
    } catch {
      setFormError("Impossible de localiser le départ. Vérifiez l'adresse sélectionnée.");
    } finally {
      setResolving(false);
    }
  }

  function toggleNeed(need: Need) {
    setNeeds((current) =>
      current.includes(need) ? current.filter((item) => item !== need) : [...current, need],
    );
  }

  const loadingResults = !!request && (othersQuery.isLoading || savedQuery.isLoading);

  return (
    <div
      className="home-screen relative flex w-full max-w-full flex-col overflow-x-hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <ConnectionDecor />
      <div className="home-rise client-home-heading relative shrink-0 px-4 pt-2 pb-3">
        <ClientTopBar />
        <p className="mt-3 text-[11px] font-black tracking-[.16em] text-primary uppercase">
          Recherche rapide
        </p>
        <h1 className="mt-1 text-[27px] leading-[1.05] font-black tracking-[-.045em] sm:text-[32px]">
          Trouver le bon chauffeur
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Décrivez votre trajet, puis contactez directement le chauffeur qui vous correspond.
        </p>
      </div>

      <main className="relative mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-5 px-4 pt-2 pb-[calc(var(--home-tabbar-h)+env(safe-area-inset-bottom)+40px)]">
        {request ? (
          <section className="home-rise rounded-[1.5rem] border border-primary/20 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black tracking-[.13em] text-primary uppercase">
                  Votre recherche
                </p>
                <p className="mt-1 flex items-center gap-2 text-[13px] font-extrabold">
                  <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{request.origin.split(",")[0]}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="truncate">{request.destination.split(",")[0]}</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDateLabel(request.date)} ·{" "}
                  {VEHICLE_STYLES.find((style) => style.value === request.vehicleStyle)?.shortLabel}{" "}
                  · {request.passengers} passager
                  {request.passengers > 1 ? "s" : ""}
                  {request.needs.length
                    ? ` · ${request.needs.length} besoin${request.needs.length > 1 ? "s" : ""}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequest(null)}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 text-[11px] font-bold text-primary"
              >
                <Pencil className="size-3.5" aria-hidden /> Modifier
              </button>
            </div>
          </section>
        ) : (
          <form
            onSubmit={submit}
            className="home-rise rounded-[1.75rem] border border-border/60 bg-card p-4 shadow-[0_22px_55px_-38px_rgba(7,55,35,.7)] sm:p-5"
          >
            <div className="space-y-2.5">
              <AddressAutocomplete
                value={origin}
                confirmed={originConfirmed}
                placeholder="Lieu de départ"
                ariaLabel="Lieu de départ"
                icon={<MapPin className="size-4" />}
                onChange={(value) => {
                  setOrigin(value);
                  setOriginConfirmed(false);
                }}
                onConfirm={(value) => {
                  setOrigin(value);
                  setOriginConfirmed(true);
                }}
              />
              <AddressAutocomplete
                value={destination}
                confirmed={destinationConfirmed}
                placeholder="Destination"
                ariaLabel="Destination"
                icon={<Flag className="size-4" />}
                onChange={(value) => {
                  setDestination(value);
                  setDestinationConfirmed(false);
                }}
                onConfirm={(value) => {
                  setDestination(value);
                  setDestinationConfirmed(true);
                }}
              />
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDatePickerOpen((open) => !open)}
                aria-expanded={datePickerOpen}
                className={cn(
                  "min-w-0 rounded-2xl border bg-card px-3 py-2 text-left",
                  date ? "border-primary/45" : "border-input",
                )}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <CalendarDays className="size-3.5 text-primary" aria-hidden /> Date souhaitée
                </span>
                <span className="mt-1 block truncate text-[13px] font-bold">
                  {formatDateLabel(date)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVehiclePickerOpen((open) => !open)}
                aria-expanded={vehiclePickerOpen}
                className="min-w-0 overflow-hidden rounded-2xl border border-input bg-card px-3 py-2 text-left"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" aria-hidden /> Type de véhicule
                </span>
                <span className="mt-1 flex items-center gap-2 truncate text-[13px] font-bold">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      VEHICLE_STYLES.find((style) => style.value === vehicleStyle)?.dotClass,
                    )}
                  />
                  {VEHICLE_STYLES.find((style) => style.value === vehicleStyle)?.shortLabel}
                </span>
              </button>
            </div>

            {datePickerOpen ? (
              <div className="mt-2 rounded-2xl border border-border bg-muted/25 p-3">
                <p className="text-[11px] font-black tracking-wide text-muted-foreground uppercase">
                  Aujourd'hui ou dans la semaine
                </p>
                <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                  {WEEK_DAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={date === day.value}
                      onClick={() => {
                        setDate(day.value);
                        setDatePickerOpen(false);
                        setExactDateOpen(false);
                      }}
                      className={cn(
                        "min-h-12 rounded-xl border px-1.5 text-center transition",
                        date === day.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card",
                      )}
                    >
                      <span className="block truncate text-[10px] font-bold capitalize">
                        {day.day}
                      </span>
                      <span className="block text-[11px] font-extrabold">{day.date}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setExactDateOpen((open) => !open)}
                  aria-expanded={exactDateOpen}
                  className="mt-2 flex min-h-10 w-full items-center justify-between rounded-xl border border-border bg-card px-3 text-[12px] font-bold"
                >
                  Choisir une date précise dans le mois
                  <ChevronDown
                    className={cn("size-4 transition", exactDateOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
                {exactDateOpen ? (
                  <Input
                    aria-label="Date précise"
                    type="date"
                    min={today}
                    max={monthLimit}
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      if (event.target.value) setDatePickerOpen(false);
                    }}
                    className="mt-2 h-11 w-full min-w-0 rounded-xl bg-card text-[13px] font-semibold"
                  />
                ) : null}
              </div>
            ) : null}

            {vehiclePickerOpen ? (
              <div className="mt-2 rounded-2xl border border-border bg-muted/25 p-3">
                <p className="text-[11px] font-black tracking-wide text-muted-foreground uppercase">
                  Univers du véhicule
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {VEHICLE_STYLES.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      aria-pressed={vehicleStyle === style.value}
                      onClick={() => {
                        setVehicleStyle(style.value);
                        setVehiclePickerOpen(false);
                      }}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-[12px] font-bold transition",
                        vehicleStyle === style.value
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      <span className={cn("size-3 shrink-0 rounded-full", style.dotClass)} />
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-3">
              <Label htmlFor="passengers" className="text-[12px] font-bold">
                Nombre de passagers
              </Label>
              <div className="mt-1 flex items-center gap-3 rounded-2xl border border-input px-3">
                <Users className="size-4 text-primary" aria-hidden />
                <Input
                  id="passengers"
                  type="number"
                  min={1}
                  max={8}
                  value={passengers}
                  onChange={(event) =>
                    setPassengers(Math.max(1, Math.min(8, Number(event.target.value) || 1)))
                  }
                  className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNeedsOpen((open) => !open)}
              aria-expanded={needsOpen}
              className="mt-3 flex min-h-11 w-full items-center justify-between rounded-2xl border border-border bg-muted/35 px-3.5 text-left text-[13px] font-bold"
            >
              <span className="flex items-center gap-2">
                <BriefcaseBusiness className="size-4 text-primary" aria-hidden />
                Ajouter des besoins
                {needs.length ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                    {needs.length}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={cn("size-4 transition", needsOpen && "rotate-180")}
                aria-hidden
              />
            </button>

            {needsOpen ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {NEEDS.map((need) => {
                  const active = needs.includes(need.value);
                  return (
                    <button
                      key={need.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleNeed(need.value)}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-[12px] font-bold transition",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      <need.icon className="size-4 shrink-0" aria-hidden /> {need.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {formError ? (
              <p className="mt-3 rounded-xl bg-destructive/8 px-3 py-2 text-[12px] font-semibold text-destructive">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="mt-4 h-13 w-full text-[15px]"
              disabled={resolving}
            >
              <Search className="size-5" aria-hidden />
              {resolving ? "Recherche du secteur…" : "Trouver mon chauffeur"}
            </Button>
            <p className="mt-2 text-center text-[10.5px] leading-snug text-muted-foreground">
              ReLink ne confirme aucune disponibilité. La date sert uniquement à préparer votre
              prise de contact.
            </p>
          </form>
        )}

        {request ? (
          <section
            ref={resultsRef}
            className="home-rise scroll-mt-3"
            style={{ animationDelay: "60ms" }}
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[.13em] text-primary uppercase">
                  Résultats
                </p>
                <h2 className="text-[20px] font-black tracking-tight">Chauffeurs correspondants</h2>
              </div>
              <p className="text-right text-[11px] text-muted-foreground">
                {request.city ?? "Réseau ReLink"}
                {request.department
                  ? ` · ${departmentName(request.department) ?? request.department}`
                  : ""}
              </p>
            </div>

            {loadingResults ? (
              <div className="mt-4 space-y-3">
                {[0, 1].map((item) => (
                  <div key={item} className="h-56 animate-pulse rounded-[1.75rem] bg-muted" />
                ))}
              </div>
            ) : !savedMatches.length && !otherMatches.length ? (
              <div className="mt-4 rounded-[1.5rem] border border-border bg-card p-6 text-center">
                <p className="text-sm font-black">Aucun profil ne réunit tous ces critères</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Essayez de retirer un besoin spécifique ou d'élargir la capacité recherchée.
                </p>
              </div>
            ) : (
              <div className="space-y-7">
                {savedMatches.length ? (
                  <ResultSection
                    title="Mes chauffeurs qui correspondent"
                    subtitle={`${savedMatches.length} dans votre carnet`}
                  >
                    {savedMatches.map((driver) => (
                      <DiscoverDriverCard
                        key={driver.user_id}
                        driver={driver}
                        theme={driver.booking_theme}
                        photoUrl={photoOf(driver)}
                        eyebrow="Déjà dans mes chauffeurs"
                        badges={matchBadges(driver, request)}
                        actionLabel="Voir et contacter"
                      />
                    ))}
                  </ResultSection>
                ) : null}

                {otherMatches.length ? (
                  <ResultSection
                    title="D'autres chauffeurs ReLink qui correspondent"
                    subtitle={`${otherMatches.length} profil${otherMatches.length > 1 ? "s" : ""}`}
                  >
                    {otherMatches.map((driver) => (
                      <DiscoverDriverCard
                        key={driver.user_id}
                        driver={driver}
                        theme={driver.booking_theme}
                        photoUrl={photoOf(driver)}
                        badges={matchBadges(driver, request)}
                        actionLabel="Voir et contacter"
                      />
                    ))}
                  </ResultSection>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function ResultSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="max-w-[70%] text-[17px] leading-tight font-black tracking-tight">{title}</h2>
        <p className="shrink-0 text-[11px] font-semibold text-muted-foreground">{subtitle}</p>
      </div>
      <div className="client-discover-grid mt-3 grid gap-4">{children}</div>
    </section>
  );
}
