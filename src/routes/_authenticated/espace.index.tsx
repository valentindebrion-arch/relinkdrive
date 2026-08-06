import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Car,
  CalendarDays,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Plus,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/espace/")({
  component: ClientHome,
});

function initials(name?: string | null) {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === tomorrow.toDateString()) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long" });
}

function ClientHome() {
  const { user, profile } = useAuth();

  const data = useQuery({
    queryKey: ["client-home", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: conns }, { data: requests }, { data: rides }] = await Promise.all([
        supabase.from("driver_client_connections").select("*").eq("client_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("ride_requests").select("*").eq("client_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("rides").select("*").eq("client_id", user!.id).order("scheduled_at", { ascending: false }),
      ]);
      const ids = (conns ?? []).map((c) => c.driver_id);
      let drivers: { profile?: any; driver?: any; vehicle?: any; driver_id: string }[] = [];
      if (ids.length) {
        const [{ data: profiles }, { data: dprofiles }, { data: vehicles }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids),
          supabase.from("driver_profiles").select("user_id, business_name, city, slug").in("user_id", ids),
          supabase.from("vehicles").select("driver_id, brand, model").in("driver_id", ids),
        ]);
        drivers = ids.map((id) => ({
          driver_id: id,
          profile: (profiles ?? []).find((p) => p.id === id),
          driver: (dprofiles ?? []).find((d) => d.user_id === id),
          vehicle: (vehicles ?? []).find((v) => v.driver_id === id),
        }));
      }
      return { conns: conns ?? [], requests: requests ?? [], rides: rides ?? [], drivers };
    },
  });

  const rides = data.data?.rides ?? [];
  const upcoming = rides
    .filter((r) => new Date(r.scheduled_at) >= new Date() && !["cancelled", "completed"].includes(r.status))
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const completed = rides.filter((r) => r.status === "completed").length;
  const favorite = data.data?.drivers[0];
  const next = upcoming[0];

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">
          Bonjour {profile?.full_name?.split(" ")[0] ?? ""} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-muted-foreground">Prêt pour votre prochain trajet ?</p>

        <Link
          to="/espace/demandes"
          className="mt-5 flex items-center gap-3 rounded-full border border-primary/40 bg-card py-2 pr-2 pl-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <MapPin className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">Où allez-vous ?</span>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <ArrowRight className="size-5" />
          </span>
        </Link>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Votre chauffeur</h2>
          <Link to="/espace/chauffeurs" className="text-sm font-medium text-primary">
            Voir tous
          </Link>
        </div>
        {favorite ? (
          <div className="surface overflow-hidden p-4">
            <div className="flex items-center gap-4">
              {favorite.profile?.avatar_url ? (
                <img
                  src={favorite.profile.avatar_url}
                  alt={favorite.profile?.full_name ?? "Chauffeur"}
                  className="size-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
                  {initials(favorite.profile?.full_name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold">
                  {favorite.driver?.business_name ?? favorite.profile?.full_name ?? "Chauffeur"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="size-2 rounded-full bg-primary" /> Disponible
                </p>
                {favorite.vehicle ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Car className="size-4" />
                    {[favorite.vehicle.brand, favorite.vehicle.model].filter(Boolean).join(" ")}
                  </p>
                ) : null}
              </div>
            </div>
            <Link
              to="/espace/demandes"
              search={{ driver: favorite.driver_id }}
              className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-medium text-primary-foreground"
            >
              Réserver avec {favorite.driver?.business_name ?? favorite.profile?.full_name?.split(" ")[0] ?? "mon chauffeur"}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="surface p-5 text-center">
            <p className="font-medium">Aucun chauffeur dans votre carnet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scannez le QR code de votre chauffeur en fin de course pour l'ajouter.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Aperçu</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, value: data.data?.conns.length ?? 0, label: "Mes chauffeurs", hint: "Chauffeur de confiance" },
            { icon: CalendarDays, value: upcoming.length, label: "Courses à venir", hint: "Prochainement" },
            { icon: Star, value: completed, label: "Courses effectuées", hint: "Merci !" },
          ].map((s) => (
            <div key={s.label} className="surface p-3">
              <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
                <s.icon className="size-4" />
              </span>
              <p className="mt-2 text-2xl font-semibold">{s.value}</p>
              <p className="text-sm leading-tight font-medium">{s.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Prochaine course</h2>
        {next ? (
          <div className="surface p-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
              <div className="rounded-xl bg-accent p-3 text-center text-accent-foreground">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <CalendarDays className="size-3.5" /> {dayLabel(next.scheduled_at)}
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {new Date(next.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs">
                  {new Date(next.scheduled_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-3">
                    <p className="flex items-start gap-2 text-sm font-medium">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">{next.pickup_address}</span>
                    </p>
                    <p className="flex items-start gap-2 text-sm font-medium">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground" />
                      <span className="truncate">{next.dropoff_address}</span>
                    </p>
                  </div>
                  <StatusBadge status={next.status} labels={RIDE_STATUS_LABELS} />
                </div>
                <Link
                  to="/espace/suivi/$id"
                  params={{ id: next.id }}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium"
                >
                  Suivre évolution de la course <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="surface p-5 text-center text-sm text-muted-foreground">Aucune course prévue.</div>
        )}
      </section>

      <Link to="/espace/chauffeurs" className="flex items-center gap-3 rounded-2xl bg-accent p-4 text-accent-foreground">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Voyagez en toute sérénité</span>
          <span className="block text-sm text-muted-foreground">Tous nos chauffeurs sont vérifiés et évalués.</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Actions rapides</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { to: "/espace/demandes", icon: Plus, label: "Nouveau trajet", filled: true },
            { to: "/espace/chauffeurs", icon: Heart, label: "Mes chauffeurs", filled: false },
            { to: "/espace/courses", icon: Clock, label: "Historique", filled: false },
          ].map((a) => (
            <Link key={a.label} to={a.to} className="surface flex flex-col items-center gap-2 p-4 text-center">
              <span
                className={
                  a.filled
                    ? "grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"
                    : "grid size-10 place-items-center rounded-full text-primary"
                }
              >
                <a.icon className="size-5" />
              </span>
              <span className="text-sm font-medium">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
