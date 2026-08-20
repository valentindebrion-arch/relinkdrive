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
          La sélection officielle ReLink : jusqu'à 10 chauffeurs de référence.
        </p>
      </header>

      {query.isLoading ? (
        <div className="mt-5 space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[4/3] w-full animate-pulse rounded-[1.75rem] bg-muted" />
              <div className="h-5 w-1/3 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      ) : !list.length ? (
        <div className="mt-5 rounded-[1.75rem] border border-border/70 bg-card p-6 text-center">
          <p className="text-sm font-bold">Aucune sélection disponible pour le moment</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenez plus tard pour découvrir les chauffeurs ReLink.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-5">
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
                    className="group block"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.75rem] bg-muted">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={`Véhicule de ${driver.display_name}`}
                          className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between px-0.5">
                      <span className="text-[17px] font-extrabold tracking-tight">
                        {driver.display_name}
                      </span>
                      <ChevronRight
                        className="size-5 text-muted-foreground transition group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                  </Link>
                ) : (
                  <div className="block">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.75rem] bg-muted">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={`Véhicule de ${driver.display_name}`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="mt-2.5 px-0.5">
                      <span className="text-[17px] font-extrabold tracking-tight">
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
