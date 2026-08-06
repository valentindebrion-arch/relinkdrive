import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Period = "today" | "week" | "month" | "year" | "all" | "custom";

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
  all: "Depuis le début",
  custom: "Période personnalisée",
};

export function periodRange(period: Period, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
  } else if (period === "month") {
    start.setDate(1);
  } else if (period === "year") {
    start.setMonth(0, 1);
  } else if (period === "all") {
    start.setFullYear(1970, 0, 1);
  } else if (period === "custom") {
    if (from) start.setTime(new Date(from).setHours(0, 0, 0, 0));
    if (to) end.setTime(new Date(to).setHours(23, 59, 59, 999));
  }
  return { start, end };
}

/** Toutes les données brutes du chauffeur : aucune valeur fictive. */
export function useDriverData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["driver-data", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [rides, invoices, requests, conns, reviews, payments] = await Promise.all([
        supabase.from("rides").select("*").eq("driver_id", user!.id).eq("is_block", false),
        supabase.from("invoices").select("*").eq("driver_id", user!.id),
        supabase.from("ride_requests").select("*").eq("driver_id", user!.id),
        supabase.from("driver_client_connections").select("*").eq("driver_id", user!.id),
        supabase.from("ride_reviews").select("*").eq("driver_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("driver_id", user!.id),
      ]);
      return {
        rides: rides.data ?? [],
        invoices: invoices.data ?? [],
        requests: requests.data ?? [],
        conns: conns.data ?? [],
        reviews: reviews.data ?? [],
        payments: payments.data ?? [],
      };
    },
  });
}

type Raw = NonNullable<ReturnType<typeof useDriverData>["data"]>;

const CANCELLED_INVOICE = ["cancelled"];

export function computeStats(raw: Raw | undefined, period: Period, from?: string, to?: string) {
  const empty = {
    completed: 0,
    billed: 0,
    collected: 0,
    outstanding: 0,
    average: 0,
    newClients: 0,
    regularClients: 0,
    acceptRate: 0,
    refuseRate: 0,
    cancelRate: 0,
    recurrenceRate: 0,
    km: 0,
    hours: 0,
    topServices: [] as { label: string; count: number }[],
    perClient: [] as { clientId: string; revenue: number; rides: number }[],
    daily: [] as { label: string; total: number }[],
    monthly: [] as { label: string; total: number }[],
    reviews: {
      count: 0,
      average: 0,
      punctuality: 0,
      driving: 0,
      cleanliness: 0,
      service: 0,
      distribution: [0, 0, 0, 0, 0],
      latest: [] as Raw["reviews"],
    },
  };
  if (!raw) return empty;

  const { start, end } = periodRange(period, from, to);
  const inRange = (d?: string | null) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const rides = raw.rides.filter((r) => inRange(r.completed_at ?? r.scheduled_at));
  const completedRides = rides.filter((r) => r.status === "completed");
  const invoices = raw.invoices.filter((i) => inRange(i.issued_on));

  // CA facturé : factures émises/envoyées/payées/en retard (jamais les annulées ni les brouillons)
  const billed = invoices
    .filter((i) => !CANCELLED_INVOICE.includes(i.status) && i.status !== "draft")
    .reduce((s, i) => s + Number(i.amount_ttc), 0);
  // CA encaissé : uniquement les factures payées
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const collected = paidInvoices.reduce((s, i) => s + Number(i.amount_ttc), 0);
  const outstanding = billed - collected;

  const requests = raw.requests.filter((r) => inRange(r.created_at));
  const refused = requests.filter((r) => r.status === "refused").length;
  const cancelled = rides.filter((r) => r.status === "cancelled").length;
  const accepted = requests.filter((r) => !["refused", "new", "reviewing"].includes(r.status)).length;

  const perClientMap = new Map<string, { revenue: number; rides: number }>();
  completedRides.forEach((r) => {
    if (!r.client_id) return;
    const inv = raw.invoices.find((i) => i.ride_id === r.id && i.status !== "cancelled");
    const cur = perClientMap.get(r.client_id) ?? { revenue: 0, rides: 0 };
    cur.rides += 1;
    cur.revenue += inv ? Number(inv.amount_ttc) : Number(r.price ?? 0);
    perClientMap.set(r.client_id, cur);
  });

  const services = new Map<string, number>();
  raw.requests.forEach((r) => {
    const key = r.trip_type || "Course standard";
    services.set(key, (services.get(key) ?? 0) + 1);
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const total = raw.invoices
      .filter((inv) => inv.status !== "cancelled" && new Date(inv.issued_on).toDateString() === d.toDateString())
      .reduce((s, inv) => s + Number(inv.amount_ttc), 0);
    return { label: d.toLocaleDateString("fr-FR", { weekday: "short" }), total };
  });

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const total = raw.invoices
      .filter((inv) => {
        const dd = new Date(inv.issued_on);
        return inv.status !== "cancelled" && dd.getMonth() === d.getMonth() && dd.getFullYear() === d.getFullYear();
      })
      .reduce((s, inv) => s + Number(inv.amount_ttc), 0);
    return { label: d.toLocaleDateString("fr-FR", { month: "short" }), total };
  });

  const visible = raw.reviews.filter((r) => r.status !== "hidden");
  const avgOf = (key: "rating" | "punctuality_rating" | "driving_rating" | "cleanliness_rating" | "service_rating") => {
    const vals = visible.map((r) => r[key]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const distribution = [1, 2, 3, 4, 5].map((n) => visible.filter((r) => r.rating === n).length);

  const km = completedRides.reduce((s, r) => s + Number(r.mileage_km ?? 0), 0);
  const hours = completedRides.reduce((s, r) => {
    if (!r.started_at || !r.completed_at) return s;
    return s + (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 3600000;
  }, 0);

  return {
    completed: completedRides.length,
    billed,
    collected,
    outstanding,
    average: completedRides.length ? billed / completedRides.length : 0,
    newClients: raw.conns.filter((c) => inRange(c.created_at)).length,
    regularClients: raw.conns.filter((c) => c.crm_status === "regular").length,
    acceptRate: requests.length ? Math.round((accepted / requests.length) * 100) : 0,
    refuseRate: requests.length ? Math.round((refused / requests.length) * 100) : 0,
    cancelRate: rides.length ? Math.round((cancelled / rides.length) * 100) : 0,
    recurrenceRate: perClientMap.size
      ? Math.round(([...perClientMap.values()].filter((c) => c.rides > 1).length / perClientMap.size) * 100)
      : 0,
    km,
    hours: Math.round(hours * 10) / 10,
    topServices: [...services.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    perClient: [...perClientMap.entries()]
      .map(([clientId, v]) => ({ clientId, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    daily: days,
    monthly: months,
    reviews: {
      count: visible.length,
      average: avgOf("rating"),
      punctuality: avgOf("punctuality_rating"),
      driving: avgOf("driving_rating"),
      cleanliness: avgOf("cleanliness_rating"),
      service: avgOf("service_rating"),
      distribution,
      latest: visible.slice(0, 5),
    },
  };
}
