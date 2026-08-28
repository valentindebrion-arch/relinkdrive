/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Construction serveur de la vue journalière du planning d'un chauffeur.
 * Utilise uniquement les données réelles du chauffeur connecté.
 */
import { RELINK_TZ } from "@/lib/schedule";
import {
  ACTIVE_RIDE_STATUSES,
  PENDING_REQUEST_STATUSES,
  timeToMin,
  type DayBreak,
  type DayEvent,
  type DayPlan,
} from "@/lib/day-planning";

function parisMinutes(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RELINK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return timeToMin(parts);
}

function isoWeekday(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

export async function buildDayPlan(
  date: string,
  supabase: any,
  driverId: string,
): Promise<DayPlan> {
  const weekday = isoWeekday(date);
  const dayStart = new Date(`${date}T00:00:00Z`);
  // Marge large : la conversion Paris/UTC décale au plus de 2 h.
  const from = new Date(dayStart.getTime() - 3 * 3_600_000).toISOString();
  const to = new Date(dayStart.getTime() + 27 * 3_600_000).toISOString();

  const [
    { data: override },
    { data: hours },
    { data: absences },
    { data: settings },
    { data: breaks },
    { data: rides },
    { data: requests },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("driver_day_overrides")
      .select("available, start_time, end_time")
      .eq("driver_id", driverId)
      .eq("day", date)
      .maybeSingle(),
    supabase
      .from("driver_working_hours")
      .select("active, start_time, end_time")
      .eq("driver_id", driverId)
      .eq("weekday", weekday)
      .maybeSingle(),
    supabase
      .from("driver_absences")
      .select("id")
      .eq("driver_id", driverId)
      .lte("starts_on", date)
      .gte("ends_on", date),
    supabase.from("driver_schedule_settings").select("buffer_min").eq("driver_id", driverId).maybeSingle(),
    supabase
      .from("driver_breaks")
      .select("id, day, weekday, start_time, end_time, reason")
      .eq("driver_id", driverId),
    supabase
      .from("rides")
      .select("id, client_id, client_label, pickup_address, dropoff_address, scheduled_at, created_at, price, status, is_block")
      .eq("driver_id", driverId)
      .in("status", [...ACTIVE_RIDE_STATUSES])
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
    supabase
      .from("ride_requests")
      .select("id, client_id, pickup_address, dropoff_address, scheduled_at, created_at, proposed_price, amount_ttc, status, is_immediate")
      .eq("driver_id", driverId)
      .in("status", [...PENDING_REQUEST_STATUSES])
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
    supabase.from("driver_profiles").select("on_duty").eq("user_id", driverId).maybeSingle(),
  ]);

  const inDay = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: RELINK_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso)) === date;

  const absent = (absences ?? []).length > 0;
  const defined = !!override || !!hours;
  const available = absent
    ? false
    : override
      ? !!override.available
      : hours
        ? !!hours.active
        : true;
  const startMin = timeToMin(override?.start_time ?? hours?.start_time ?? "08:00");
  const endMin = timeToMin(override?.end_time ?? hours?.end_time ?? "19:00");

  const { travelMinutes } = await import("@/lib/travel-time.server");
  const cache = new Map<string, number | null>();
  async function duration(pickup: string, dropoff: string) {
    const key = `${pickup}|${dropoff}`;
    if (cache.has(key)) return cache.get(key)!;
    let value: number | null = null;
    try {
      value = await travelMinutes(pickup, dropoff);
    } catch {
      value = null;
    }
    cache.set(key, value);
    return value;
  }

  // Nom réel du client (espace authentifié du chauffeur uniquement, via RLS).
  const clientIds = Array.from(
    new Set(
      [
        ...((rides ?? []) as any[]).filter((r) => !r.is_block).map((r) => r.client_id),
        ...((requests ?? []) as any[]).map((r) => r.client_id),
      ].filter((id): id is string => !!id),
    ),
  );
  const names = new Map<string, string>();
  const phones = new Map<string, string>();
  if (clientIds.length) {
    // get_connected_profiles ne renvoie le téléphone qu'au chauffeur réellement lié au client.
    const { data: clients } = await supabase.rpc("get_connected_profiles", { _ids: clientIds });
    ((clients ?? []) as any[]).forEach((c) => {
      const label = (c.full_name ?? "").trim();
      if (label) names.set(c.id, label);
      const phone = (c.phone ?? "").trim();
      if (phone) phones.set(c.id, phone);
    });
  }
  const clientName = (id: string | null, fallback: string | null) =>
    (id ? names.get(id) : null) ?? (fallback?.trim() || null) ?? "Client non renseigné";
  const clientPhone = (id: string | null) => (id ? (phones.get(id) ?? null) : null);

  const events: DayEvent[] = [];

  for (const r of ((rides ?? []) as any[]).filter((r) => inDay(r.scheduled_at))) {
    events.push({
      id: r.id,
      kind: r.is_block ? "block" : "ride",
      startIso: r.scheduled_at,
      startMin: parisMinutes(r.scheduled_at),
      durationMin: r.is_block ? 60 : await duration(r.pickup_address, r.dropoff_address),
      clientLabel: r.is_block
        ? (r.client_label ?? "Indisponibilité")
        : clientName(r.client_id, r.client_label),
      pickup: r.pickup_address,
      dropoff: r.dropoff_address,
      status: r.status,
      price: r.price === null ? null : Number(r.price),
      flash:
        !r.is_block &&
        new Date(r.scheduled_at).getTime() - new Date(r.created_at).getTime() <= 20 * 60 * 1000,
    });
  }

  for (const q of ((requests ?? []) as any[]).filter((r) => inDay(r.scheduled_at))) {
    events.push({
      id: q.id,
      kind: "request",
      startIso: q.scheduled_at,
      startMin: parisMinutes(q.scheduled_at),
      durationMin: await duration(q.pickup_address, q.dropoff_address),
      clientLabel: clientName(q.client_id, null),
      pickup: q.pickup_address,
      dropoff: q.dropoff_address,
      status: q.status,
      price: q.amount_ttc ?? q.proposed_price ? Number(q.amount_ttc ?? q.proposed_price) : null,
      flash: !!q.is_immediate,
    });
  }

  events.sort((a, b) => a.startMin - b.startMin);

  const dayBreaks: DayBreak[] = ((breaks ?? []) as any[])
    .filter((b) => (b.day ? b.day === date : b.weekday === weekday))
    .map((b) => ({
      id: b.id,
      startMin: timeToMin(b.start_time),
      endMin: timeToMin(b.end_time),
      reason: b.reason ?? null,
      recurring: !b.day,
    }))
    .sort((a, b) => a.startMin - b.startMin);

  // Retour à vide vers le secteur de référence, après la dernière course.
  let returnLeg = null as DayPlan["returnLeg"];
  const lastRide = [...events].reverse().find((e) => e.kind !== "block");
  if (lastRide && lastRide.durationMin !== null && available && !absent) {
    const { getDriverReference } = await import("@/lib/driver-reference-address.server");
    const reference = await getDriverReference(supabase, driverId);
    if (reference.address) {
      const back = await duration(lastRide.dropoff, reference.address);
      if (back !== null && back > 0) {
        const startMin = lastRide.startMin + lastRide.durationMin;
        const endTime = new Date(
          new Date(lastRide.startIso).getTime() + (lastRide.durationMin + back) * 60_000,
        );
        returnLeg = {
          startMin,
          endMin: startMin + back,
          durationMin: back,
          from: lastRide.dropoff,
          destination: reference.label ?? reference.address,
          interrupted: false,
          endIso: endTime.toISOString(),
        };
      }
    }
  }

  return {
    date,
    returnLeg,
    defined,
    available,
    startMin,
    endMin,
    overridden: !!override,
    bufferMin: settings?.buffer_min ?? 15,
    onDuty: !!profile?.on_duty,
    absent,
    events,
    breaks: dayBreaks,
  };
}
