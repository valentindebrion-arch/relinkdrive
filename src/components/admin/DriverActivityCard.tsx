/**
 * Fiche chauffeur — activité ReLink et paramètres tarifaires en cours :
 * clientèle, courses, tarif kilométrique et majorations appliquées.
 */
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatEuro } from "@/lib/labels";
import { FREE_PRICE_PER_KM } from "@/lib/plan";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function DriverActivityCard({ driverId }: { driverId: string }) {
  const q = useQuery({
    queryKey: ["admin", "driver-activity", driverId],
    queryFn: async () => {
      const [clients, rides, completed, tariff, driver] = await Promise.all([
        supabase
          .from("driver_client_connections")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driverId),
        supabase.from("rides").select("id", { count: "exact", head: true }).eq("driver_id", driverId),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driverId)
          .eq("status", "completed"),
        supabase
          .from("driver_tariffs")
          .select("price_per_km_ht, minimum_ht, night_enabled, night_pct, pickup_pct")
          .eq("driver_id", driverId)
          .maybeSingle(),
        supabase
          .from("driver_profiles")
          .select("plan, on_duty, accepting_requests, page_published")
          .eq("user_id", driverId)
          .maybeSingle(),
      ]);
      return {
        clients: clients.count ?? 0,
        rides: rides.count ?? 0,
        completed: completed.count ?? 0,
        tariff: tariff.data,
        driver: driver.data,
      };
    },
  });

  const isPro = q.data?.driver?.plan === "pro";
  const pricePerKm = isPro
    ? (q.data?.tariff?.price_per_km_ht ?? FREE_PRICE_PER_KM)
    : FREE_PRICE_PER_KM;

  return (
    <section className="surface mb-4 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="size-4 text-muted-foreground" /> Activité ReLink
      </p>
      {q.isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat label="Clients connectés" value={q.data?.clients ?? 0} />
            <Stat label="Courses" value={q.data?.rides ?? 0} />
            <Stat label="Courses terminées" value={q.data?.completed ?? 0} />
          </div>
          <p className="mt-4 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
            Paramètres tarifaires
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Stat label="Tarif kilométrique" value={`${formatEuro(pricePerKm)}/km`} />
            <Stat
              label="Majoration de nuit"
              value={
                isPro && q.data?.tariff?.night_enabled
                  ? `${q.data.tariff.night_pct} %`
                  : "Désactivée"
              }
            />
            <Stat
              label="Majoration prise en charge"
              value={isPro && q.data?.tariff?.pickup_pct ? `${q.data.tariff.pickup_pct} %` : "—"}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {isPro
              ? "Tarification personnalisée ReLink Pro (plafond 3,00 €/km)."
              : "Tarif ReLink Gratuit imposé à 1,85 €/km : les majorations sont désactivées."}{" "}
            Page publique : {q.data?.driver?.page_published ? "publiée" : "non publiée"} · En
            service : {q.data?.driver?.on_duty ? "oui" : "non"}
          </p>
        </>
      )}
    </section>
  );
}
