import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Plane,
  Plus,
  Route as RouteIcon,
  Sparkles,
  Star,
} from "lucide-react";
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

function badgesFor(d: Discovered) {
  const list: { label: string; icon: typeof Star }[] = [];
  if ((d.rating_avg ?? 0) >= 4.7 && d.rating_count >= 3)
    list.push({ label: "Très bien noté", icon: Star });
  if (d.long_distance) list.push({ label: "Longue distance", icon: RouteIcon });
  if ((d.airports ?? []).length) list.push({ label: "Aéroport", icon: Plane });
  if (["van", "premium", "business", "berline"].includes((d.vehicle_category ?? "").toLowerCase()))
    list.push({ label: "Véhicule premium", icon: Sparkles });
  if (d.city) list.push({ label: d.city, icon: MapPin });
  return list.slice(0, 4);
}

function DiscoverPage() {
  const { user, isDriver, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [adding, setAdding] = useState(false);

  const query = useQuery({
    queryKey: ["discover-drivers", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_discover_drivers", { _limit: 20 });
      if (error) throw error;
      return (data ?? []) as unknown as Discovered[];
    },
  });

  const list = useMemo(() => query.data ?? [], [query.data]);
  const photos = useSignedUrls(
    "vehicles",
    list.map((d) => d.vehicle_photo_url),
  );
  const safeIndex = list.length ? ((index % list.length) + list.length) % list.length : 0;
  const driver = list[safeIndex] ?? null;
  const photoUrl = driver?.vehicle_photo_url
    ? (photos.data?.[driver.vehicle_photo_url] ?? null)
    : null;
  const vehicle = driver
    ? [driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(" ") || null
    : null;

  async function addDriver() {
    if (!user?.id || !driver) return;
    if (isDriver || isAdmin) {
      toast.info("Seuls les comptes passagers peuvent ajouter un chauffeur.");
      return;
    }
    setAdding(true);
    const { error } = await supabase
      .from("driver_client_connections")
      .insert({ client_id: user.id, driver_id: driver.user_id, source: "link" });
    setAdding(false);
    if (error && error.code !== "23505") {
      toast.error(error.message);
      return;
    }
    toast.success(`${driver.display_name} a rejoint vos chauffeurs`);
    void query.refetch();
    setIndex((i) => i);
  }

  return (
    <div className="w-full max-w-full pb-4">
      <ClientTopBar />

      <header className="mt-1">
        <h1 className="text-[22px] leading-tight font-black tracking-tight">Trouver un chauffeur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Élargissez votre réseau personnel de chauffeurs de confiance.
        </p>
      </header>

      <section className="mt-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <h2 className="text-[15px] font-extrabold">La crème de la crème</h2>
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Découvrez des chauffeurs recommandés par ReLink.
        </p>
      </section>

      {query.isLoading ? (
        <div className="mt-4 h-80 animate-pulse rounded-[1.75rem] bg-muted" />
      ) : !driver ? (
        <div className="mt-4 rounded-[1.75rem] border border-border/70 bg-card p-6 text-center">
          <p className="text-sm font-bold">Aucun nouveau chauffeur pour le moment</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vos chauffeurs enregistrés apparaissent dans « Mes chauffeurs ».
          </p>
          <Link
            to="/espace/chauffeurs"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Voir mes chauffeurs
          </Link>
        </div>
      ) : (
        <>
          <article className="mt-4 overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-[0_10px_30px_-24px_rgba(0,0,0,0.55)]">
            <div className="relative aspect-[16/10] w-full bg-muted">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={`Véhicule de ${driver.display_name}`}
                  className="size-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                  <Car className="size-7" aria-hidden />
                  <p className="text-[11px] font-semibold">Photo du véhicule à venir</p>
                </div>
              )}
              {list.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Chauffeur précédent"
                    onClick={() => setIndex(safeIndex - 1)}
                    className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-sm backdrop-blur active:scale-95"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Chauffeur suivant"
                    onClick={() => setIndex(safeIndex + 1)}
                    className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-sm backdrop-blur active:scale-95"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                {driver.avatar_url ? (
                  <img
                    src={driver.avatar_url}
                    alt=""
                    className="size-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-extrabold text-primary">
                    {initials(driver.display_name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[18px] leading-tight font-extrabold">
                    {driver.display_name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold">
                    {driver.rating_avg ? (
                      <>
                        <Star className="size-3.5 fill-primary text-primary" aria-hidden />
                        {driver.rating_avg.toFixed(1)}
                        <span className="text-muted-foreground">
                          · {driver.rating_count} avis
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Nouveau sur ReLink</span>
                    )}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {[vehicle, driver.vehicle_category].filter(Boolean).join(" · ") ||
                      "Véhicule non renseigné"}
                  </p>
                </div>
              </div>

              {driver.city || driver.zone ? (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                  <MapPin className="size-3.5 text-primary" aria-hidden />
                  {[driver.city, driver.zone].filter(Boolean).join(" · ")}
                </p>
              ) : null}

              <ul className="flex flex-wrap gap-1.5">
                {badgesFor(driver).map((b) => (
                  <li
                    key={b.label}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-bold text-primary"
                  >
                    <b.icon className="size-3" aria-hidden /> {b.label}
                  </li>
                ))}
              </ul>

              {(driver.services ?? []).length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {(driver.services ?? []).slice(0, 5).map((s) => (
                    <li
                      key={s}
                      className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              ) : null}

              {driver.public_intro || driver.bio ? (
                <p className="line-clamp-4 text-[13px] leading-relaxed text-muted-foreground">
                  {driver.public_intro || driver.bio}
                </p>
              ) : null}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => void addDriver()}
                  disabled={adding}
                  className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[15px] font-extrabold text-primary-foreground transition active:scale-[0.985] disabled:opacity-70"
                >
                  {adding ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Ajouter à mes chauffeurs
                </button>
                {driver.slug ? (
                  <button
                    type="button"
                    onClick={() =>
                      void navigate({
                        to: "/chauffeur/$slug",
                        params: { slug: driver.slug as string },
                      })
                    }
                    className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-border bg-background text-sm font-bold transition active:scale-[0.985]"
                  >
                    Voir le profil
                  </button>
                ) : null}
              </div>
            </div>
          </article>

          {list.length > 1 ? (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Profil {safeIndex + 1} sur {list.length}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
