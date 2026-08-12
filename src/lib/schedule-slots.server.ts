/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Calcul serveur de l'agenda de réservation d'un chauffeur.
 * Réutilise les règles Relink existantes : horaires déclarés, absences,
 * marge de sécurité, durée réelle du trajet.
 */
import { BLOCK_DURATION_MIN, SAFETY_MARGIN_MIN } from "@/lib/availability";
import { fitsDeclaredAvailability, RELINK_TZ, type Absence, type WorkingHour } from "@/lib/schedule";
import {
  MAX_ADVANCE_DAYS,
  MIN_NOTICE_MIN,
  SLOT_UI_STEP_MIN,
  parisDay,
  parisInstant,
  type DayStatus,
  type DriverSchedule,
  type ScheduleDay,
} from "@/lib/schedule-slots";

/** Statuts qui occupent réellement un créneau du planning. */
const BUSY_RIDE_STATUSES = [
  "confirmed",
  "driver_enroute",
  "driver_arrived",
  "client_onboard",
  "in_progress",
] as const;

/** Demandes planifiées qui réservent le créneau tant qu'elles ne sont ni refusées ni expirées. */
const BUSY_REQUEST_STATUSES = [
  "new",
  "reviewing",
  "proposal_sent",
  "awaiting_client",
  "confirmed",
] as const;

type Params = {
  driverId: string;
  pickup: string;
  dropoff: string;
  month: string;
  roundTrip?: boolean | undefined;
};

type Interval = { start: number; end: number };

export async function buildDriverSchedule(
  data: Params,
  supabase: any,
  userId: string,
): Promise<DriverSchedule> {
  // Le client doit être relié à ce chauffeur (ou être le chauffeur lui-même).
  if (data.driverId !== userId) {
    const { data: link } = await supabase
      .from("driver_client_connections")
      .select("driver_id")
      .eq("client_id", userId)
      .eq("driver_id", data.driverId)
      .maybeSingle();
    if (!link) throw new Error("Chauffeur indisponible pour cette vérification");
  }

  const { travelMinutes } = await import("@/lib/travel-time.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tripOne = await travelMinutes(data.pickup, data.dropoff);
  if (tripOne === null) throw new Error("Disponibilités indisponibles pour le moment");
  const tripMin = data.roundTrip ? tripOne * 2 : tripOne;

  const [year, month] = data.month.split("-").map(Number) as [number, number];
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const now = new Date();
  const horizon = new Date(now.getTime() + MAX_ADVANCE_DAYS * 86_400_000);

  const rangeFrom = new Date(monthStart.getTime() - 86_400_000).toISOString();
  const rangeTo = new Date(monthEnd.getTime() + 2 * 86_400_000).toISOString();

  const [{ data: hoursRows }, { data: absenceRows }, { data: rides }, { data: requests }] =
    await Promise.all([
      supabaseAdmin
        .from("driver_working_hours")
        .select("weekday, active, start_time, end_time")
        .eq("driver_id", data.driverId),
      supabaseAdmin
        .from("driver_absences")
        .select("starts_on, ends_on")
        .eq("driver_id", data.driverId),
      supabaseAdmin
        .from("rides")
        .select("pickup_address, dropoff_address, scheduled_at, is_block, status")
        .eq("driver_id", data.driverId)
        .in("status", [...BUSY_RIDE_STATUSES])
        .gte("scheduled_at", rangeFrom)
        .lte("scheduled_at", rangeTo),
      supabaseAdmin
        .from("ride_requests")
        .select("pickup_address, dropoff_address, scheduled_at, status, is_immediate")
        .eq("driver_id", data.driverId)
        .in("status", [...BUSY_REQUEST_STATUSES])
        .eq("is_immediate", false)
        .gte("scheduled_at", rangeFrom)
        .lte("scheduled_at", rangeTo),
    ]);

  const hours: WorkingHour[] = (hoursRows ?? []) as WorkingHour[];
  const absences: Absence[] = (absenceRows ?? []) as Absence[];

  // Durées estimées des engagements existants (mémoïsées par couple d'adresses).
  const durationCache = new Map<string, number>();
  const busy: Interval[] = [];
  const entries = [
    ...((rides ?? []) as any[]).map((r) => ({ ...r, block: !!r.is_block })),
    ...((requests ?? []) as any[]).map((r) => ({ ...r, block: false })),
  ];
  for (const entry of entries) {
    const start = new Date(entry.scheduled_at).getTime();
    let minutes = BLOCK_DURATION_MIN;
    if (!entry.block) {
      const key = `${entry.pickup_address}|${entry.dropoff_address}`;
      if (durationCache.has(key)) minutes = durationCache.get(key)!;
      else {
        const d = await travelMinutes(entry.pickup_address, entry.dropoff_address);
        minutes = d ?? BLOCK_DURATION_MIN;
        durationCache.set(key, minutes);
      }
    }
    busy.push({
      start: start - SAFETY_MARGIN_MIN * 60_000,
      end: start + (minutes + SAFETY_MARGIN_MIN) * 60_000,
    });
  }

  const overlaps = (start: number, end: number) =>
    busy.some((b) => start < b.end && end > b.start);

  const todayKey = parisDay(now);
  const horizonKey = parisDay(horizon);
  const days: ScheduleDay[] = [];

  for (let d = 1; d <= new Date(Date.UTC(year, month, 0)).getUTCDate(); d++) {
    const date = `${data.month}-${String(d).padStart(2, "0")}`;
    if (date < todayKey || date > horizonKey) {
      days.push({ date, status: date < todayKey ? "past" : "closed", slots: [] });
      continue;
    }

    const slots: string[] = [];
    let candidates = 0;
    for (let m = 0; m < 24 * 60; m += SLOT_UI_STEP_MIN) {
      const start = parisInstant(date, m);
      const startMs = start.getTime();
      if (startMs < now.getTime() + MIN_NOTICE_MIN * 60_000) continue;
      if (startMs > horizon.getTime()) continue;
      const end = new Date(startMs + tripMin * 60_000);
      if (!fitsDeclaredAvailability(hours, absences, start, end)) continue;
      candidates++;
      if (overlaps(startMs, end.getTime() + SAFETY_MARGIN_MIN * 60_000)) continue;
      slots.push(start.toISOString());
    }

    let status: DayStatus;
    if (candidates === 0) status = "closed";
    else if (slots.length === 0) status = "full";
    else if (slots.length < candidates) status = "partial";
    else status = "free";

    days.push({ date, status, slots });
  }

  return { timeZone: RELINK_TZ, tripMin, days };
}
