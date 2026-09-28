import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Loader2, MapPin } from "lucide-react";
import { BRAND, POSITIONING } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, homeForRoles } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DriverDirectoryCard,
  type DirectoryDriver,
} from "@/components/directory/DriverDirectoryCard";
import { SERVICES, VEHICLE_CATEGORIES, LANGUAGES } from "@/lib/showcase";
import { EmptyState } from "@/components/Ui";
import { useSignedUrls } from "@/lib/storage";

export const Route = createFileRoute("/chauffeurs")({
  head: () => ({
    meta: [
      { title: `Annuaire des chauffeurs VTC — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Explorez l'annuaire ReLink des chauffeurs VTC indépendants : recherchez par ville, prestation, type de véhicule ou capacité, et découvrez leur vitrine professionnelle.",
      },
      { property: "og:title", content: `Annuaire des chauffeurs VTC — ${BRAND.name}` },
      {
        property: "og:description",
        content:
          "Trouvez un chauffeur VTC professionnel dans votre secteur et gardez-le dans votre réseau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DirectoryPage,
});

function DirectoryPage() {
  const { session, roles, loading } = useAuth();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [service, setService] = useState("");
  const [category, setCategory] = useState("");
  const [minPassengers, setMinPassengers] = useState("");
  const [language, setLanguage] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const drivers = useQuery({
    queryKey: ["directory", query, service, category, minPassengers, language],
    queryFn: async () => {
      const args: Record<string, string | number> = { _limit: 40 };
      if (query) args["_q"] = query;
      if (service) args["_service"] = service;
      if (category) args["_category"] = category;
      if (minPassengers) args["_min_passengers"] = Number(minPassengers);
      if (language) args["_language"] = language;
      const { data, error } = await supabase.rpc("search_public_drivers", args);
      if (error) throw error;
      return (data ?? []) as DirectoryDriver[];
    },
  });

  const rawList = useMemo(() => drivers.data ?? [], [drivers.data]);
  const photos = useSignedUrls(
    "vehicles",
    rawList.map((d) => d.vehicle_photo_url),
  );
  const list = useMemo(
    () =>
      rawList.map((d) => ({
        ...d,
        vehicle_photo_url: d.vehicle_photo_url
          ? (photos.data?.[d.vehicle_photo_url] ?? null)
          : null,
      })),
    [rawList, photos.data],
  );
  const hasFilters = !!(service || category || minPassengers || language);

  return (
    <div className="directory-page min-h-screen overflow-x-hidden bg-[#f7faf8]">
      <header className="directory-nav sticky top-0 z-40 mx-auto mt-2 grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-[0_12px_40px_-24px_rgba(13,55,40,.4)] backdrop-blur-xl sm:mt-4 sm:px-5">
        <BrandLogo to="/" size="md" />
        <nav className="landing-menu flex shrink-0 items-center gap-1 rounded-xl bg-emerald-950/[.035] p-1 text-sm">
          {!loading && session ? (
            <Link
              to={homeForRoles(roles)}
              className="directory-primary-button rounded-xl bg-primary px-3 py-2 font-semibold text-primary-foreground sm:px-4"
            >
              Mon espace
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="landing-menu-link hidden rounded-lg px-2.5 py-2 font-medium text-muted-foreground transition hover:bg-white hover:text-foreground sm:inline-flex"
              >
                Connexion
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", role: "driver" }}
                className="directory-primary-button rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground"
              >
                Je suis chauffeur
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="pb-20">
        <section className="directory-hero relative mx-auto mt-3 w-[calc(100%-1rem)] max-w-[1400px] overflow-hidden rounded-[2rem] px-4 pt-9 pb-20 text-white sm:mt-5 sm:px-8 sm:pt-11 sm:pb-24 lg:px-14">
          <div className="directory-glow" aria-hidden />
          <div className="directory-hero-content relative z-10 mx-auto max-w-6xl">
            <h1 className="max-w-3xl text-[2.35rem] leading-[1.02] font-semibold tracking-[-.05em] text-balance sm:text-5xl">
              Trouvez votre <span className="landing-gradient-text">chauffeur.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-emerald-50/70 sm:text-base">
              Recherchez par ville et contactez directement le professionnel qui vous correspond.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-emerald-50/65 sm:text-sm">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-emerald-300" /> Partout en France</span>
              <span className="inline-flex items-center gap-1.5"><Search className="size-4 text-emerald-300" /> Contact direct</span>
            </div>
          </div>
        </section>

        <div className="relative z-20 mx-auto -mt-14 max-w-6xl px-4 sm:px-5">
          <div className="directory-search-panel rounded-[1.75rem] border border-white/80 bg-white/90 p-3 shadow-[0_30px_70px_-35px_rgba(8,52,35,.55)] backdrop-blur-xl sm:p-4">

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-emerald-700" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ville ou secteur — ex. Clermont-Ferrand"
              aria-label="Rechercher une ville ou un secteur"
              className="w-full rounded-2xl border border-emerald-950/10 bg-[#f5f9f7] py-4 pr-4 pl-12 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>
          <button
            type="submit"
            className="directory-primary-button rounded-2xl bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground"
          >
            Rechercher
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-950/10 bg-white px-5 py-4 text-sm font-semibold transition hover:bg-emerald-50"
          >
            <SlidersHorizontal className="size-4" />
            Filtres{hasFilters ? " ·" : ""}
          </button>
        </form>

        {showFilters ? (
          <div className="mt-3 grid gap-3 rounded-2xl bg-emerald-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Prestation
              </span>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full rounded-xl border border-emerald-950/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Toutes</option>
                {SERVICES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Type de véhicule
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-emerald-950/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Tous</option>
                {VEHICLE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Passagers minimum
              </span>
              <select
                value={minPassengers}
                onChange={(e) => setMinPassengers(e.target.value)}
                className="w-full rounded-xl border border-emerald-950/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Indifférent</option>
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} passagers et +
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Langue parlée
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-emerald-950/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Indifférent</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
          </div>

        <div className="mt-7">
          {drivers.isPending ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Chargement de l'annuaire…
            </p>
          ) : list.length === 0 ? (
            <EmptyState
              title="Aucun chauffeur trouvé"
              description="Élargissez votre recherche ou retirez certains filtres pour découvrir davantage de profils."
            />
          ) : (
            <>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-[-.035em] sm:text-2xl">Chauffeurs disponibles</h2>
                </div>
                <p className="shrink-0 rounded-full border border-emerald-950/10 bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {list.length} chauffeur{list.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="directory-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((d) => (
                  <DriverDirectoryCard key={d.user_id} driver={d} />
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </main>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        <p className="mx-auto max-w-2xl">{POSITIONING.responsibility}</p>
      </footer>
    </div>
  );
}
