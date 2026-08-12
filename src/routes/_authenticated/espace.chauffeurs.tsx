import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Car, MapPin, Plus, QrCode, Sparkles, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { cn } from "@/lib/utils";

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

const PAGE_SIZE = 8;

function ClientDrivers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "available">("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const handleScan = useCallback(
    (text: string) => {
      let slug: string | null = null;
      try {
        const url = new URL(text, window.location.origin);
        const match = url.pathname.match(/\/chauffeur\/([^/?#]+)/);
        slug = match?.[1] ?? null;
      } catch {
        slug = null;
      }
      if (!slug) {
        const match = text.trim().match(/([A-Za-z0-9-]+)$/);
        slug = match?.[1] ?? null;
      }
      setScanOpen(false);
      if (!slug) {
        toast.error("QR code non reconnu", {
          description: "Ce code ne correspond pas à un chauffeur Relink.",
        });
        return;
      }
      navigate({ to: "/chauffeur/$slug", params: { slug } });
    },
    [navigate],
  );

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
      const [{ data: profiles }, { data: dprofiles }, { data: vehicles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids),
        supabase.rpc("get_connected_driver_profiles"),
        supabase.from("vehicles").select("driver_id, brand, model, max_passengers").in("driver_id", ids),
      ]);
      return (conns ?? []).map((c) => ({
        ...c,
        profile: (profiles ?? []).find((p) => p.id === c.driver_id),
        driver: (dprofiles ?? []).find((d) => d.user_id === c.driver_id),
        vehicle: (vehicles ?? []).find((v) => v.driver_id === c.driver_id),
      }));
    },
  });

  const list = drivers.data ?? [];
  const total = list.length;

  const items = useMemo(
    () =>
      list.map((d) => {
        const name = d.driver?.business_name || d.profile?.full_name || "Chauffeur";
        const available = !!d.driver?.on_duty && d.driver?.accepting_requests !== false;
        const vehicle = d.vehicle ? [d.vehicle.brand, d.vehicle.model].filter(Boolean).join(" ") : null;
        const zone = d.driver?.city || d.driver?.zone || null;
        const services = (d.driver?.services ?? []).slice(0, 3);
        return { d, name, available, vehicle, zone, services };
      }),
    [list],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === "available" && !it.available) return false;
      if (!q) return true;
      const hay = [it.name, it.vehicle, it.zone, ...(it.services ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, filter]);

  const shown = filtered.slice(0, visible);
  const showTools = total >= 3;

  const countLabel =
    total === 0 ? "Aucun chauffeur enregistré" : `${total} chauffeur${total > 1 ? "s" : ""} enregistré${total > 1 ? "s" : ""}`;

  return (
    <div className="w-full max-w-full space-y-4 pb-2">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight">Mes chauffeurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Retrouvez et réservez vos chauffeurs de confiance.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Users className="size-3.5" aria-hidden="true" /> {countLabel}
        </span>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]"
        >
          <Plus className="size-4" aria-hidden="true" /> Ajouter un chauffeur
        </button>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]"
        >
          <QrCode className="size-4" aria-hidden="true" /> Scanner un QR code
        </button>
      </div>

      {showTools ? (
        <div className="space-y-2">
          <label className="sr-only" htmlFor="driver-search">
            Rechercher un chauffeur
          </label>
          <input
            id="driver-search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Rechercher un chauffeur"
            className="min-h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2" role="group" aria-label="Filtrer les chauffeurs">
            {([
              { key: "all", label: "Tous" },
              { key: "available", label: "Disponibles" },
            ] as const).map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => {
                  setFilter(f.key);
                  setVisible(PAGE_SIZE);
                }}
                className={cn(
                  "min-h-9 rounded-full border px-3.5 text-xs font-semibold transition",
                  filter === f.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {shown.map(({ d, name, available, vehicle, zone, services }) => (
          <article key={d.id} className="surface rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                {d.profile?.avatar_url ? (
                  <img
                    src={d.profile.avatar_url}
                    alt={`Photo de ${name}`}
                    className="size-12 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="grid size-12 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                  >
                    {initials(d.profile?.full_name || name)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base leading-snug font-bold break-words">{name}</h2>
                <span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("size-1.5 rounded-full", available ? "bg-primary" : "bg-muted-foreground")}
                  />
                  {available ? "Disponible" : "Indisponible"}
                </span>
              </div>
            </div>

            {(vehicle || zone || services.length) ? (
              <dl className="mt-3 space-y-1.5 text-sm">
                {vehicle ? (
                  <div className="flex items-start gap-2">
                    <Car className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <dt className="sr-only">Véhicule</dt>
                    <dd className="min-w-0 break-words">{vehicle}</dd>
                  </div>
                ) : null}
                {zone ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <dt className="sr-only">Zone d'activité</dt>
                    <dd className="min-w-0 break-words">{zone}</dd>
                  </div>
                ) : null}
                {services.length ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {services.map((s: string) => (
                      <span
                        key={s}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </dl>
            ) : null}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link
                to="/espace/demandes"
                search={{ driver: d.driver_id }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]"
              >
                <Car className="size-4" aria-hidden="true" /> Demander une course
              </Link>
              {d.driver?.slug ? (
                <Link
                  to="/chauffeur/$slug"
                  params={{ slug: d.driver.slug }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]"
                >
                  <User className="size-4" aria-hidden="true" /> Voir le profil
                </Link>
              ) : null}
            </div>
          </article>
        ))}

        {filtered.length > shown.length ? (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="min-h-11 w-full rounded-2xl border border-border bg-card text-sm font-semibold"
          >
            Afficher plus de chauffeurs
          </button>
        ) : null}

        {total > 0 && filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun chauffeur ne correspond à votre recherche.
          </p>
        ) : null}
      </div>

      {total === 0 && !drivers.isLoading ? (
        <section className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10">
            <QrCode className="size-7 text-primary" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold">Aucun chauffeur enregistré</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Ajoutez un chauffeur de confiance pour pouvoir le retrouver et lui demander une course
            rapidement.
          </p>
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            <QrCode className="size-4" aria-hidden="true" /> Scanner un QR code
          </button>
          <Link to="/aide" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Ajouter autrement
          </Link>
        </section>
      ) : null}

      {total > 0 && total < 3 ? (
        <section className="rounded-2xl border border-border bg-muted/40 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" /> Développez votre réseau
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez un chauffeur grâce à son QR code ou à son lien personnel.
          </p>
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold"
          >
            <Plus className="size-4" aria-hidden="true" /> Ajouter un chauffeur
          </button>
        </section>
      ) : null}

      <QrScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} />
    </div>
  );
}
