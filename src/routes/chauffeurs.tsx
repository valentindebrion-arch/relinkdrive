import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { BRAND, POSITIONING } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, homeForRoles } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { DriverDirectoryCard, type DirectoryDriver } from "@/components/directory/DriverDirectoryCard";
import { SERVICES, VEHICLE_CATEGORIES, LANGUAGES } from "@/lib/showcase";
import { EmptyState } from "@/components/Ui";

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
        content: "Trouvez un chauffeur VTC professionnel dans votre secteur et gardez-le dans votre réseau.",
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

  const list = drivers.data ?? [];
  const hasFilters = !!(service || category || minPassengers || language);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-5">
        <BrandLogo to="/" size="md" />
        <nav className="flex shrink-0 items-center gap-1.5 text-sm">
          {!loading && session ? (
            <Link
              to={homeForRoles(roles)}
              className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground sm:px-4"
            >
              Mon espace
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="rounded-lg px-2.5 py-2 text-muted-foreground hover:text-foreground"
              >
                Connexion
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", role: "driver" }}
                className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground"
              >
                Je suis chauffeur
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-5">
        <h1 className="text-2xl font-semibold text-balance sm:text-3xl">Trouver un chauffeur</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Explorez le réseau des chauffeurs VTC professionnels et découvrez ceux qui interviennent dans votre secteur.
        </p>

        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ville ou secteur — ex. Clermont-Ferrand"
              aria-label="Rechercher une ville ou un secteur"
              className="w-full rounded-xl border border-border bg-card py-3 pr-3 pl-9 text-sm"
            />
          </div>
          <button type="submit" className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">
            Rechercher
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium"
          >
            <SlidersHorizontal className="size-4" />
            Filtres{hasFilters ? " ·" : ""}
          </button>
        </form>

        {showFilters ? (
          <div className="surface mt-3 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Prestation</span>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
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
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Type de véhicule</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
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
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Passagers minimum</span>
              <select
                value={minPassengers}
                onChange={(e) => setMinPassengers(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
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
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Langue parlée</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
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

        <div className="mt-6">
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
              <p className="mb-3 text-sm text-muted-foreground">
                {list.length} chauffeur{list.length > 1 ? "s" : ""} dans l'annuaire
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((d) => (
                  <DriverDirectoryCard key={d.user_id} driver={d} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        <p className="mx-auto max-w-2xl">{POSITIONING.responsibility}</p>
      </footer>
    </div>
  );
}
