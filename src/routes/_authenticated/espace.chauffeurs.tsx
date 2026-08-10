import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Car, MapPin, Plus, QrCode, Star, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { QrScannerDialog } from "@/components/QrScannerDialog";

export const Route = createFileRoute("/_authenticated/espace/chauffeurs")({
  component: ClientDrivers,
});

function initials(name?: string | null) {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function ClientDrivers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);

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
        toast.error("QR code non reconnu", { description: "Ce code ne correspond pas à un chauffeur Relink." });
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
        supabase
          .from("connected_driver_profiles")
          .select("user_id, business_name, city, slug, languages, services, on_duty")
          .in("user_id", ids),
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

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3 lg:h-[calc(100dvh-4rem)]">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">Mes chauffeurs</h1>
          <p className="truncate text-xs text-muted-foreground">Votre carnet de chauffeurs de confiance.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Users className="size-3.5" /> {list.length}
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {list.map((d) => {
          const name = d.driver?.business_name || d.profile?.full_name || "Chauffeur";
          const available = !!d.driver?.on_duty;
          const vehicle = d.vehicle ? [d.vehicle.brand, d.vehicle.model].filter(Boolean).join(" ") : null;
          return (
            <article key={d.id} className="surface rounded-2xl p-3">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <div className="relative shrink-0">
                  {d.profile?.avatar_url ? (
                    <img
                      src={d.profile.avatar_url}
                      alt={name}
                      className="size-12 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {initials(d.profile?.full_name)}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card ${available ? "bg-primary" : "bg-muted-foreground"}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-sm font-bold">{name}</h2>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {available ? "Dispo" : "Indispo"}
                    </span>
                  </div>
                  <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Star className="size-3 fill-primary text-primary" /> Nouveau
                    </span>
                    {vehicle ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Car className="size-3 shrink-0" /> <span className="truncate">{vehicle}</span>
                      </span>
                    ) : null}
                    {d.driver?.city ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="size-3 shrink-0" /> <span className="truncate">{d.driver.city}</span>
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Link
                  to="/espace/demandes"
                  search={{ driver: d.driver_id }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition active:scale-[0.98]"
                >
                  <Car className="size-4" /> Demander un trajet
                </Link>
                {d.driver?.slug ? (
                  <Link
                    to="/chauffeur/$slug"
                    params={{ slug: d.driver.slug }}
                    aria-label="Voir le profil"
                    className="grid size-10 place-items-center rounded-full border border-border transition active:scale-95"
                  >
                    <User className="size-4" />
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}

        {!list.length ? (
          <div className="grid h-full place-items-center rounded-2xl border-2 border-dashed border-border p-6 text-center">
            <div>
              <QrCode className="mx-auto size-8 text-primary" />
              <p className="mt-2 text-sm font-semibold">Aucun chauffeur enregistré</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Scannez le QR code de votre chauffeur en fin de course.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
      >
        <Plus className="size-4" /> Ajouter un chauffeur
      </button>

      <QrScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} />
    </div>
  );
}
