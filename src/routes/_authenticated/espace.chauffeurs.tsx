import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Car, Compass, MapPin, Plus, Search, Star, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AddDriverSheet } from "@/components/client/AddDriverSheet";
import { ClientTopBar } from "@/components/client/ClientTopBar";
import { saveRequestDraft } from "@/lib/request-draft";
import { useSignedUrls } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/espace/chauffeurs")({
  component: ClientDrivers,
});

function initials(name?: string | null) {
  return (
    (name ?? "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function ClientDrivers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // Temps réel : le statut Disponible / Indisponible se met à jour sans rechargement.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("client-drivers-availability")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_profiles" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["client-drivers", user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const drivers = useQuery({
    queryKey: ["client-drivers", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: conns } = await supabase
        .from("driver_client_connections")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (conns ?? []).map((c) => c.driver_id);
      if (!ids.length) return [];
      const [{ data: profiles }, { data: dprofiles }, { data: vehicles }, { data: rides }] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids),
          supabase.rpc("get_connected_driver_profiles"),
          supabase.from("vehicles").select("*").in("driver_id", ids),
          supabase.from("rides").select("driver_id").eq("client_id", user!.id),
        ]);

      return Promise.all(
        (conns ?? []).map(async (c) => {
          const profile = (profiles ?? []).find((p) => p.id === c.driver_id);
          const dp = (dprofiles ?? []).find((d) => d.user_id === c.driver_id);
          const car =
            (vehicles ?? []).find((v) => v.driver_id === c.driver_id && v.is_primary) ??
            (vehicles ?? []).find((v) => v.driver_id === c.driver_id);
          let ratingAvg: number | null = null;
          let ratingCount = 0;
          if (dp?.slug) {
            const { data: r } = await supabase.rpc("get_public_driver_rating", { _slug: dp.slug });
            const row = r?.[0];
            if (row) {
              ratingAvg = row.rating_avg ?? null;
              ratingCount = Number(row.rating_count ?? 0);
            }
          }
          return {
            id: c.driver_id,
            name: dp?.business_name || profile?.full_name || "Chauffeur",
            avatarUrl: profile?.avatar_url ?? null,
            available: !!dp?.on_duty && dp?.accepting_requests !== false,
            vehicle: car ? [car.brand, car.model].filter(Boolean).join(" ") || null : null,
            photoPath: car?.photo_url ?? null,
            zone: dp?.city || dp?.zone || null,
            slug: dp?.slug ?? null,
            trips: (rides ?? []).filter((r) => r.driver_id === c.driver_id).length,
            ratingAvg,
            ratingCount,
          };
        }),
      );
    },
  });

  const list = useMemo(() => drivers.data ?? [], [drivers.data]);
  const photos = useSignedUrls(
    "vehicles",
    list.map((d) => d.photoPath),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) =>
      [d.name, d.vehicle, d.zone].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [list, search]);

  function book(driverId: string, mode: "now" | "later") {
    saveRequestDraft({
      driver_id: driverId,
      pickup_address: "",
      dropoff_address: "",
      scheduled_at: "",
      whenMode: mode,
      pickupOk: false,
      dropoffOk: false,
    });
    void navigate({ to: "/espace/demandes" });
  }

  return (
    <div className="w-full max-w-full pb-4">
      <ClientTopBar />

      <header className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-black tracking-tight">Mes chauffeurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre carnet personnel de chauffeurs de confiance.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
          <Users className="size-3.5" aria-hidden /> {list.length}
        </span>
      </header>

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-extrabold text-primary-foreground transition active:scale-[0.985]"
      >
        <Plus className="size-5" /> Ajouter un chauffeur
      </button>

      {list.length >= 4 ? (
        <label className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un chauffeur"
            className="w-full bg-transparent text-sm font-semibold outline-none"
          />
        </label>
      ) : null}

      <div className="mt-4 space-y-4">
        {drivers.isLoading ? (
          [0, 1].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-card"
            >
              <div className="aspect-[16/10] w-full animate-pulse bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-5 w-1/2 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
                <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-[1.5rem] border border-border/70 bg-card p-6 text-center">
            <p className="text-sm font-bold">Votre carnet est vide</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez un chauffeur en scannant son QR code en fin de course, ou découvrez nos
              chauffeurs recommandés.
            </p>
            <Link
              to="/espace/decouvrir"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-primary/35 px-5 text-sm font-bold text-primary"
            >
              <Compass className="size-4" /> Trouver un chauffeur
            </Link>
          </div>
        ) : (
          filtered.map((d) => (
            <article
              key={d.id}
              className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-card"
            >
              {/* ZONE 1 — véhicule en entier, jamais recadré (contain, fond showroom conservé) */}
              <div className="relative aspect-[16/10] w-full bg-muted/60">
                {d.photoPath && photos.data?.[d.photoPath] ? (
                  <img
                    src={photos.data[d.photoPath]}
                    alt={`Véhicule de ${d.name}`}
                    className="size-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-muted-foreground">
                    <Car className="size-8" aria-hidden />
                  </span>
                )}
              </div>

              {/* ZONE 2 — informations, ordre et hauteurs identiques sur toutes les cartes */}
              <div className="space-y-1 px-4 pt-3.5 pb-3">
                <div className="flex min-h-7 items-center gap-2">
                  {d.avatarUrl ? (
                    <img
                      src={d.avatarUrl}
                      alt=""
                      onError={(e) => (e.currentTarget.style.display = "none")}
                      className="size-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                      {initials(d.name)}
                    </span>
                  )}
                  <p className="truncate text-[16px] leading-tight font-extrabold">{d.name}</p>
                </div>

                <p className="min-h-5 truncate text-[13px] font-semibold text-muted-foreground">
                  {d.vehicle ?? "Véhicule non renseigné"}
                </p>

                <div className="flex min-h-5 items-center gap-x-3 text-[12.5px] font-semibold">
                  {d.ratingAvg ? (
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Star className="size-3.5 fill-primary text-primary" aria-hidden />
                      {d.ratingAvg.toFixed(1)}
                      <span className="text-muted-foreground">({d.ratingCount})</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-muted-foreground">Nouveau sur ReLink</span>
                  )}
                  <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{d.zone ?? "Zone non renseignée"}</span>
                  </span>
                </div>

                <div className="flex min-h-6 items-center gap-x-3 text-[12px] font-semibold">
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${
                      d.available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        d.available ? "status-dot-pulse bg-primary" : "bg-muted-foreground/60"
                      }`}
                      aria-hidden
                    />
                    {d.available ? "Disponible" : "Indisponible"}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {d.trips > 0
                      ? `${d.trips} trajet${d.trips > 1 ? "s" : ""} ensemble`
                      : "Aucun trajet ensemble"}
                  </span>
                </div>
              </div>

              {/* ZONE 3 — actions, toujours au même endroit */}
              <div className="flex gap-2 border-t border-border/60 px-4 py-3">
                <button
                  type="button"
                  onClick={() => book(d.id, "now")}
                  className="min-h-11 flex-1 rounded-xl bg-primary text-[13px] font-bold text-primary-foreground transition active:scale-[0.985]"
                >
                  Réserver
                </button>
                <button
                  type="button"
                  onClick={() => book(d.id, "later")}
                  aria-label={`Planifier un trajet avec ${d.name}`}
                  className="grid min-h-11 w-12 shrink-0 place-items-center rounded-xl border border-border text-primary transition active:scale-[0.985]"
                >
                  <CalendarClock className="size-4" />
                </button>
                {d.slug ? (
                  <Link
                    to="/chauffeur/$slug"
                    params={{ slug: d.slug }}
                    className="flex min-h-11 shrink-0 items-center rounded-xl border border-border px-4 text-[13px] font-bold"
                  >
                    Profil
                  </Link>
                ) : (
                  <span
                    aria-disabled
                    className="flex min-h-11 shrink-0 items-center rounded-xl border border-border px-4 text-[13px] font-bold text-muted-foreground/60"
                  >
                    Profil
                  </span>
                )}
              </div>
            </article>
          ))
        )}
      </div>


      <AddDriverSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
