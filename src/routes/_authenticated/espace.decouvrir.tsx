import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ClientTopBar } from "@/components/client/ClientTopBar";
import { DiscoverDriverCard, type DiscoverDriver } from "@/components/client/DiscoverDriverCard";
import { useSignedUrls } from "@/lib/storage";
import {
  useClientSector,
  matchesVehicleFilter,
  VEHICLE_FILTERS,
  type VehicleFilter,
} from "@/lib/client-sector";
import { departmentLabel, departmentName } from "@/lib/departments";
import { searchSectors } from "@/lib/client-sector.functions";
import { discoverDrivers } from "@/lib/driver-discovery.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/espace/decouvrir")({
  head: () => ({
    meta: [
      { title: "Trouver un chauffeur dans votre département — ReLink" },
      {
        name: "description",
        content:
          "Découvrez les chauffeurs VTC ReLink qui interviennent dans votre département et ajoutez-les à votre réseau.",
      },
      { property: "og:title", content: "Trouver un chauffeur dans votre département — ReLink" },
      {
        property: "og:description",
        content:
          "La crème de la crème de votre département et tous les chauffeurs qui y interviennent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

type LocalDriver = DiscoverDriver & {
  service_areas: string[] | null;
  service_departments: string[] | null;
  departments: string[];
  quality_score: number | null;
};

type Scope = "department" | "all";

const PREMIUM_COUNT = 3;

function DiscoverPage() {
  const { user } = useAuth();
  const { sector, department, detecting, error, detect, setManual } = useClientSector();
  const [filter, setFilter] = useState<VehicleFilter>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("department");

  const query = useQuery({
    queryKey: ["discover-drivers", user?.id, scope, department],
    enabled: !!user?.id,
    queryFn: async () =>
      // Le secteur (département) est appliqué côté serveur.
      discoverDrivers({ data: { scope, department: department ?? null } }),
  });

  const effectiveScope: Scope = query.data?.scope ?? scope;
  const depLabel = departmentLabel(department);
  const depName = departmentName(department);

  const all = useMemo(() => (query.data?.drivers ?? []) as unknown as LocalDriver[], [query.data]);
  const filtered = useMemo(
    () => all.filter((d) => matchesVehicleFilter(filter, d.max_passengers, d.vehicle_category)),
    [all, filter],
  );
  const premium = useMemo(() => filtered.slice(0, PREMIUM_COUNT), [filtered]);
  const around = useMemo(() => filtered.slice(PREMIUM_COUNT), [filtered]);

  const photos = useSignedUrls(
    "vehicles",
    useMemo(
      () => filtered.map((d) => d.vehicle_photo_url).filter((p): p is string => !!p),
      [filtered],
    ),
  );
  const photoOf = (d: LocalDriver) =>
    d.vehicle_photo_url ? (photos.data?.[d.vehicle_photo_url] ?? null) : null;

  return (
    <div className="w-full max-w-full pb-6">
      <ClientTopBar />

      <header className="mt-1">
        <h1 className="text-[22px] leading-tight font-black tracking-tight">Trouver un Chauffeur </h1>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="tap mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold shadow-card"
        >
          <MapPin className="size-3.5 text-primary" aria-hidden />
          {detecting
            ? "Détection de votre secteur…"
            : depLabel
              ? `Votre secteur : ${depLabel}`
              : sector
                ? `Votre secteur : ${sector}`
                : "Choisir mon secteur"}
        </button>
        {depLabel && sector ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Position détectée : {sector} · Recherche sur tout le département
          </p>
        ) : null}
        {error && !department ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            {error} — choisissez votre secteur pour des résultats locaux.
          </p>
        ) : null}
      </header>

      {pickerOpen ? (
        <SectorPicker
          onPick={(city, dep, la, ln) => {
            setManual(city, dep, la, ln);
            setPickerOpen(false);
          }}
          onDetect={() => {
            detect();
            setPickerOpen(false);
          }}
        />
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-full border border-border bg-card p-1 shadow-card">
        {(
          [
            { value: "department", label: "Mon département" },
            { value: "all", label: "Tout afficher" },
          ] as const
        ).map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setScope(m.value)}
            aria-pressed={scope === m.value}
            className={cn(
              "tap tap-active rounded-full px-3 py-2 text-[13px] font-bold transition",
              scope === m.value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {VEHICLE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              "tap tap-active shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground shadow-card"
                : "border-border bg-card text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-card"
            >
              <div className="aspect-video w-full animate-pulse bg-muted" />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="h-5 w-1/3 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : !filtered.length ? (
        <EmptyState
          filter={filter}
          departmentLabelText={depName}
          scope={effectiveScope}
          hasOthers={all.length > 0}
          onReset={() => setFilter("all")}
          onShowAll={() => setScope("all")}
        />
      ) : (
        <>
          <Section
            title="La crème de la crème"
            subtitle={
              effectiveScope === "department" && depName
                ? `Les chauffeurs les plus appréciés qui interviennent dans le ${depName}.`
                : "Les chauffeurs les plus appréciés du réseau ReLink."
            }
          >
            {premium.map((d) => (
              <li key={d.user_id}>
                <DiscoverDriverCard driver={d} photoUrl={photoOf(d)} premium />
              </li>
            ))}
          </Section>

          {around.length ? (
            <Section
              title={
                effectiveScope === "department"
                  ? "Chauffeurs dans votre département"
                  : "Tous les chauffeurs"
              }
              subtitle={
                effectiveScope === "department" && depName
                  ? `Tous les chauffeurs ReLink qui exercent dans le ${depName}, quelle que soit leur commune.`
                  : "Explorez l'ensemble du réseau ReLink, sans limite géographique."
              }
            >
              {around.map((d) => (
                <li key={d.user_id}>
                  <DiscoverDriverCard driver={d} photoUrl={photoOf(d)} />
                </li>
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-[17px] font-black tracking-tight">{title}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
      <ul className="mt-3 space-y-4">{children}</ul>
    </section>
  );
}

function EmptyState({
  filter,
  departmentLabelText,
  scope,
  hasOthers,
  onReset,
  onShowAll,
}: {
  filter: VehicleFilter;
  departmentLabelText: string | null;
  scope: Scope;
  hasOthers: boolean;
  onReset: () => void;
  onShowAll: () => void;
}) {
  const vehicleLabel = filter === "van" ? "Van" : "Berline";
  return (
    <div className="mt-5 rounded-[1.25rem] border border-border/70 bg-card p-6 text-center shadow-card">
      {filter !== "all" && hasOthers ? (
        <>
          <p className="text-sm font-bold">
            Aucun {vehicleLabel} ReLink dans votre département pour le moment.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="tap tap-active mt-3 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground"
          >
            Voir tous les chauffeurs
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-bold">
            Aucun chauffeur ReLink{" "}
            {departmentLabelText ? `dans le ${departmentLabelText}` : "dans ce secteur"} pour le
            moment
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            ReLink développe progressivement son réseau local. Revenez bientôt, changez de secteur
            ou explorez tout le réseau.
          </p>
          {scope === "department" ? (
            <button
              type="button"
              onClick={onShowAll}
              className="tap tap-active mt-3 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground"
            >
              Tout afficher
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function SectorPicker({
  onPick,
  onDetect,
}: {
  onPick: (city: string, department: string | null, lat: number, lng: number) => void;
  onDetect: () => void;
}) {
  const [value, setValue] = useState("");
  const suggestions = useQuery({
    queryKey: ["sector-suggestions", value.trim()],
    enabled: value.trim().length >= 2,
    queryFn: async () => {
      const res = await searchSectors({ data: { query: value.trim() } });
      return res.items;
    },
  });

  return (
    <div className="mt-3 rounded-[1.25rem] border border-border bg-card p-3 shadow-card">
      <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Votre ville (ex. Clermont-Ferrand)"
          className="w-full bg-transparent text-sm outline-none"
        />
        {suggestions.isFetching ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </label>
      {suggestions.data?.length ? (
        <ul className="mt-2 space-y-1">
          {suggestions.data.map((s) => (
            <li key={`${s.city}-${s.postcode}`}>
              <button
                type="button"
                onClick={() => onPick(s.city, s.department ?? null, s.lat, s.lng)}
                className="tap w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-muted"
              >
                {s.city}
                <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                  {departmentLabel(s.department) ?? s.postcode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onDetect}
        className="tap mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary"
      >
        <MapPin className="size-3.5" aria-hidden /> Utiliser ma position
      </button>
    </div>
  );
}
