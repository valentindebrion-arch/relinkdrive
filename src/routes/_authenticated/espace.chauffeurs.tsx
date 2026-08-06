import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Car, ChevronRight, MapPin, Plus, Star, User, Users, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/labels";
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
          .from("driver_profiles")
          .select("user_id, business_name, city, slug, languages, services")
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
    <div className="space-y-5 pb-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Mes chauffeurs</h1>
        <p className="text-muted-foreground">Les chauffeurs que vous avez ajoutés à votre carnet.</p>
        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium">
          <Users className="h-4 w-4 shrink-0 text-primary" />
          {list.length} chauffeur{list.length > 1 ? "s" : ""} enregistré{list.length > 1 ? "s" : ""}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((d) => {
          const name = d.driver?.business_name || d.profile?.full_name || "Chauffeur";
          return (
            <article key={d.id} className="surface animate-fade-in space-y-4 rounded-3xl p-5 shadow-sm">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
                <div className="relative shrink-0">
                  {d.profile?.avatar_url ? (
                    <img
                      src={d.profile.avatar_url}
                      alt={name}
                      className="h-16 w-16 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {initials(d.profile?.full_name)}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-primary" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-bold">{name}</h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Vérifié
                    </span>
                  </div>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />
                    <span className="font-semibold text-foreground">Nouveau</span>
                  </p>
                  {d.vehicle ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Car className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {[d.vehicle.brand, d.vehicle.model].filter(Boolean).join(" ")}
                      </span>
                    </p>
                  ) : null}
                  {d.driver?.city ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{d.driver.city}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Ajouté le
                    <br />
                    {formatDateTime(d.created_at)}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Link
                  to="/espace/demandes"
                  search={{ driver: d.driver_id }}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  <Car className="h-4 w-4" /> Demander un trajet
                </Link>
                {d.driver?.slug ? (
                  <Link
                    to="/chauffeur/$slug"
                    params={{ slug: d.driver.slug }}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted"
                  >
                    <User className="h-4 w-4" /> Voir le profil
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {list.length > 0 ? (
        <div className="flex items-center gap-4 rounded-3xl bg-primary/5 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Star className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Un chauffeur de confiance</p>
            <p className="text-sm text-muted-foreground">
              Réservez en toute sérénité avec vos chauffeurs préférés.
            </p>
          </div>
          <Link
            to="/espace/demandes"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card shadow-sm"
            aria-label="Demander un trajet"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="w-full rounded-3xl border-2 border-dashed border-border p-8 text-center transition hover:border-primary hover:bg-primary/5"
      >
        <span className="inline-flex items-center gap-2 text-base font-semibold text-primary">
          <Plus className="h-5 w-5" /> Ajouter un chauffeur
        </span>
        <span className="mt-2 block text-sm text-muted-foreground">
          Scannez le QR code de votre chauffeur en fin de course pour l'enregistrer ici.
        </span>
      </button>

      <QrScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} />
    </div>
  );
}
