import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ClientTopBar } from "@/components/client/ClientTopBar";
import { useSignedUrls } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/espace/decouvrir")({
  head: () => ({
    meta: [
      { title: "Trouver un chauffeur — ReLink" },
      {
        name: "description",
        content:
          "Découvrez des chauffeurs VTC recommandés par ReLink et ajoutez-les à votre réseau personnel.",
      },
      { property: "og:title", content: "Trouver un chauffeur — ReLink" },
      {
        property: "og:description",
        content: "La crème de la crème : des chauffeurs de confiance à ajouter à votre carnet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

type Discovered = {
  rank_position: number;
  already_connected: boolean;
  on_duty: boolean | null;
  accepting_requests: boolean | null;
  price_per_km: number | null;
  vehicle_interior_photo_url: string | null;
  user_id: string;
  slug: string | null;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  zone: string | null;
  public_intro: string | null;
  bio: string | null;
  services: string[] | null;
  long_distance: boolean | null;
  airports: string[] | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_category: string | null;
  vehicle_photo_url: string | null;
  max_passengers: number | null;
  rating_avg: number | null;
  rating_count: number;
};

function DiscoverPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["top10-drivers", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top10_drivers");
      if (error) throw error;
      return (data ?? []) as unknown as Discovered[];
    },
  });

  const list = useMemo(() => query.data ?? [], [query.data]);
  const exteriorPhotos = useMemo(
    () => list.map((d) => d.vehicle_photo_url).filter((p): p is string => !!p),
    [list],
  );
  const photos = useSignedUrls("vehicles", exteriorPhotos);

  return (
    <div className="w-full max-w-full pb-6">
      <ClientTopBar />

      <header className="mt-1">
        <h1 className="text-[22px] leading-tight font-black tracking-tight">La crème de la crème</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les chauffeurs sélectionnés par ReLink.
        </p>
      </header>

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
      ) : !list.length ? (
        <div className="mt-4 rounded-[1.25rem] border border-border/70 bg-card p-6 text-center shadow-card">
          <p className="text-sm font-bold">Aucune sélection disponible pour le moment</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenez plus tard pour découvrir les chauffeurs ReLink.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {list.map((driver) => {
            const photoUrl = driver.vehicle_photo_url
              ? (photos.data?.[driver.vehicle_photo_url] ?? null)
              : null;
            return (
              <li key={driver.user_id}>
                {driver.slug ? (
                  <Link
                    to="/chauffeur/$slug"
                    params={{ slug: driver.slug }}
                    className="group tap tap-active block overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-card transition"
                  >
                    <div className="relative aspect-video w-full bg-muted">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={`Véhicule de ${driver.display_name}`}
                          className="size-full cursor-default object-cover"
                          loading="lazy"
                          draggable={false}
                        />
                      ) : null}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-primary/92 px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground shadow-sm backdrop-blur-sm">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Sélection ReLink
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-[15px] font-extrabold tracking-tight">
                        {driver.display_name}
                      </span>
                      <span className="flex items-center gap-0.5 text-[13px] font-semibold text-primary">
                        Voir le profil
                        <ChevronRight
                          className="size-4 transition group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="group overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-card">
                    <div className="relative aspect-video w-full bg-muted">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={`Véhicule de ${driver.display_name}`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-primary/92 px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground shadow-sm backdrop-blur-sm">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Sélection ReLink
                      </span>
                    </div>
                    <div className="px-4 py-3.5">
                      <span className="text-[15px] font-extrabold tracking-tight">
                        {driver.display_name}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
