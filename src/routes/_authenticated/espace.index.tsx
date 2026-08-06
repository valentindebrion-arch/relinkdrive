import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, ChevronRight, MapPin, Plus, Star, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LiveDriversMap } from "@/components/LiveDriversMap";
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
    <div className="relative -mx-3 -my-4 flex h-[calc(100dvh-7.5rem)] flex-col overflow-hidden sm:-mx-4 lg:mx-0 lg:my-0 lg:h-[calc(100dvh-3rem)] lg:overflow-visible lg:rounded-3xl">
      {/* Carte live en fond */}
      <div className="absolute inset-0">
        <LiveDriversMap className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/85 via-background/10 to-background" />
      </div>

      {/* Salutation */}
      <header className="relative shrink-0 px-4 pt-4">
        <h1 className="truncate text-2xl font-bold tracking-tight">
          Bonjour {profile?.full_name?.split(" ")[0] ?? ""} <span aria-hidden>👋</span>
        </h1>
        <p className="truncate text-xs text-muted-foreground">Des chauffeurs circulent près de vous</p>
      </header>

      <div className="relative min-h-0 flex-1" />

      {/* Panneau d'action */}
      <div className="relative shrink-0 space-y-2.5 rounded-t-3xl border-t border-border/60 bg-card/90 p-4 shadow-[0_-12px_40px_-20px_hsl(0_0%_0%/0.35)] backdrop-blur-xl lg:rounded-3xl lg:border">
        <Link
          to="/espace/demandes"
          className="flex w-full items-center gap-3 rounded-2xl bg-primary py-3 pr-3 pl-5 text-primary-foreground shadow-lg transition-transform active:scale-[0.99]"
        >
          <MapPin className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left font-semibold">Où allez-vous ?</span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
            <ArrowRight className="size-5" />
          </span>
        </Link>

        {favorite ? (
          <Link
            to="/espace/demandes"
            search={{ driver: favorite.driver_id }}
            className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border bg-background/70 p-2.5 transition-colors hover:bg-background active:scale-[0.99]"
          >
            {favorite.profile?.avatar_url ? (
              <img
                src={favorite.profile.avatar_url}
                alt={favorite.profile?.full_name ?? "Chauffeur"}
                loading="lazy"
                className="size-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {initials(favorite.profile?.full_name)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {favorite.driver?.business_name ?? favorite.profile?.full_name ?? "Chauffeur"}
              </span>
              <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full bg-primary" /> Disponible
                {favorite.vehicle
                  ? ` · ${[favorite.vehicle.brand, favorite.vehicle.model].filter(Boolean).join(" ")}`
                  : ""}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        ) : (
          <Link
            to="/espace/chauffeurs"
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-background/70 p-2.5"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
              <Plus className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Ajouter un chauffeur</span>
              <span className="block truncate text-xs text-muted-foreground">
                Scannez son QR code en fin de course.
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        )}

        {next ? (
          <Link
            to="/espace/suivi/$id"
            params={{ id: next.id }}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border border-border bg-background/70 p-2.5 active:scale-[0.99]"
          >
            <span className="shrink-0 rounded-xl bg-accent px-2.5 py-1.5 text-center text-accent-foreground">
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <CalendarDays className="size-3" /> {dayLabel(next.scheduled_at)}
              </span>
              <span className="block text-sm font-semibold">
                {new Date(next.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{next.pickup_address}</span>
              <span className="block truncate text-xs text-muted-foreground">→ {next.dropoff_address}</span>
              <span className="mt-1 block">
                <StatusBadge status={next.status} labels={RIDE_STATUS_LABELS} />
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {[
            { to: "/espace/chauffeurs", icon: Users, value: data.data?.conns.length ?? 0, label: "Chauffeurs" },
            { to: "/espace/courses", icon: CalendarDays, value: upcoming.length, label: "À venir" },
            { to: "/espace/courses", icon: Star, value: completed, label: "Effectuées" },
          ].map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-2xl border border-border bg-background/70 px-2 py-2 text-center active:scale-[0.98]"
            >
              <s.icon className="size-4 text-primary" />
              <span className="text-base leading-tight font-semibold">{s.value}</span>
              <span className="block w-full truncate text-[11px] text-muted-foreground">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
