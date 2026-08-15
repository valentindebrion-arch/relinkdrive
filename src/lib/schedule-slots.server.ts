/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Calcul serveur de l'agenda de réservation d'un chauffeur.
 * Réutilise les règles Relink existantes : horaires déclarés, absences,
 * marge de sécurité, durée réelle du trajet.
 */
import { BLOCK_DURATION_MIN, SAFETY_MARGIN_MIN } from "@/lib/availability";
import {
  fitsDeclaredAvailability,
  RELINK_TZ,
  type Absence,
  type WorkingHour,
} from "@/lib/schedule";
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

/** Engagement existant du chauffeur, enrichi des temps de liaison réels. */
type Engagement = {
  start: number;
  end: number;
  /** Minutes pour rejoindre le départ du nouveau client (null = inconnu). */
  linkFrom: number | null;
  /** Minutes pour rejoindre cet engagement depuis la destination du nouveau client. */
  linkTo: number | null;
};

/** "HH:MM[:SS]" → minutes depuis minuit. */
function hhmmToMin(value: string) {
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m);
}

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

  const [{ data: hoursRows }, { data: absenceRows }, { data: rides }, { data: requests }, { data: driverProfile }] =
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
      supabaseAdmin
        .from("driver_profiles")
        .select("on_duty")
        .eq("user_id", data.driverId)
        .maybeSingle(),
    ]);

  // Horaires exceptionnels, pauses et temps tampon configurés par le chauffeur.
  const [{ data: overrideRows }, { data: breakRows }, { data: settingsRow }] = await Promise.all([
    supabaseAdmin
      .from("driver_day_overrides")
      .select("day, available, start_time, end_time")
      .eq("driver_id", data.driverId)
      .gte("day", `${data.month}-01`)
      .lte("day", `${data.month}-31`),
    supabaseAdmin
      .from("driver_breaks")
      .select("day, weekday, start_time, end_time")
      .eq("driver_id", data.driverId),
    supabaseAdmin
      .from("driver_schedule_settings")
      .select("buffer_min")
      .eq("driver_id", data.driverId)
      .maybeSingle(),
  ]);

  const overrides = new Map<string, any>(((overrideRows ?? []) as any[]).map((o) => [o.day as string, o]));
  const breaksAll = (breakRows ?? []) as any[];
  const bufferMin: number = (settingsRow as any)?.buffer_min ?? SAFETY_MARGIN_MIN;

  // Statut « Non disponible » : la journée locale en cours est entièrement bloquée.
  const unavailableToday = !(driverProfile as any)?.on_duty;

  const hours: WorkingHour[] = (hoursRows ?? []) as WorkingHour[];
  const absences: Absence[] = (absenceRows ?? []) as Absence[];

  // Engagements existants : durée estimée + temps de liaison réels avec la
  // nouvelle course (calculés une seule fois par couple d'adresses).
  const durationCache = new Map<string, number>();
  const busy: Interval[] = [];
  const engagements: Engagement[] = [];
  const entries = [
    ...((rides ?? []) as any[]).map((r) => ({ ...r, block: !!r.is_block })),
    ...((requests ?? []) as any[]).map((r) => ({ ...r, block: false })),
  ];
  const gapMin = Math.max(SAFETY_MARGIN_MIN, bufferMin);
  const linkCache = new Map<string, number | null>();
  async function link(from: string, to: string) {
    const key = `${from}|${to}`;
    if (linkCache.has(key)) return linkCache.get(key)!;
    let value: number | null = null;
    try {
      value = await travelMinutes(from, to);
    } catch {
      value = null;
    }
    linkCache.set(key, value);
    return value;
  }

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
    const end = start + minutes * 60_000;
    busy.push({
      start: start - SAFETY_MARGIN_MIN * 60_000,
      end: end + gapMin * 60_000,
    });
    engagements.push({
      start,
      end,
      // Temps réel pour rejoindre le nouveau client depuis la fin de cet
      // engagement : c'est ce qui autorise une prise en charge « sur le retour ».
      linkFrom: entry.block ? 0 : await link(entry.dropoff_address, data.pickup),
      // Temps réel pour rejoindre l'engagement suivant après la nouvelle course.
      linkTo: entry.block ? 0 : await link(data.dropoff, entry.pickup_address),
    });
  }
  engagements.sort((a, b) => a.start - b.start);

  const overlaps = (start: number, end: number) => busy.some((b) => start < b.end && end > b.start);

  /** Le créneau respecte-t-il les temps de liaison réels avec les courses voisines ? */
  function linksFit(startMs: number, endMs: number) {
    const previous = [...engagements].filter((e) => e.end <= startMs).pop();
    const next = engagements.find((e) => e.start > startMs);
    if (previous) {
      // Aucune estimation fiable : on ne propose jamais un créneau inventé.
      if (previous.linkFrom === null) return false;
      if (startMs < previous.end + (previous.linkFrom + gapMin) * 60_000) return false;
    }
    if (next) {
      if (next.linkTo === null) return false;
      if (endMs + (next.linkTo + gapMin) * 60_000 > next.start) return false;
    }
    return true;
  }


  const todayKey = parisDay(now);
  const horizonKey = parisDay(horizon);
  const days: ScheduleDay[] = [];

  for (let d = 1; d <= new Date(Date.UTC(year, month, 0)).getUTCDate(); d++) {
    const date = `${data.month}-${String(d).padStart(2, "0")}`;
    if (date < todayKey || date > horizonKey) {
      days.push({ date, status: date < todayKey ? "past" : "closed", slots: [] });
      continue;
    }

    if (unavailableToday && date === todayKey) {
      days.push({ date, status: "full", slots: [] });
      continue;
    }

    const override = overrides.get(date);
    const absentDay = absences.some((a) => date >= a.starts_on && date <= a.ends_on);
    if (absentDay || (override && override.available === false)) {
      days.push({ date, status: "closed", slots: [] });
      continue;
    }

    // Pauses du jour (ponctuelles ou récurrentes) : créneaux bloqués.
    const dayIsoWeekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const dayBreaks = breaksAll.filter((b) =>
      b.day ? b.day === date : b.weekday === dayIsoWeekday,
    );
    const breakIntervals = dayBreaks.map((b) => ({
      start: parisInstant(date, hhmmToMin(b.start_time)).getTime(),
      end: parisInstant(date, hhmmToMin(b.end_time)).getTime(),
    }));

    const windowStart = override ? hhmmToMin(override.start_time) : null;
    const windowEnd = override ? hhmmToMin(override.end_time) : null;

    const slots: string[] = [];
    let candidates = 0;
    for (let m = 0; m < 24 * 60; m += SLOT_UI_STEP_MIN) {
      const start = parisInstant(date, m);
      const startMs = start.getTime();
      if (startMs < now.getTime() + MIN_NOTICE_MIN * 60_000) continue;
      if (startMs > horizon.getTime()) continue;
      const end = new Date(startMs + tripMin * 60_000);
      if (windowStart !== null && windowEnd !== null) {
        // Horaires exceptionnels de la journée : ils remplacent les horaires habituels.
        if (m < windowStart || m + tripMin > windowEnd) continue;
      } else if (!fitsDeclaredAvailability(hours, absences, start, end)) continue;
      candidates++;
      const endWithBuffer = end.getTime() + gapMin * 60_000;
      if (breakIntervals.some((b) => startMs < b.end && endWithBuffer > b.start)) continue;
      if (overlaps(startMs, endWithBuffer)) continue;
      if (!linksFit(startMs, end.getTime())) continue;
      slots.push(start.toISOString());
    }

    let status: DayStatus;
    if (candidates === 0) status = "closed";
    else if (slots.length === 0) status = "full";
    else if (slots.length < candidates) status = "partial";
    else status = "free";

    days.push({ date, status, slots });
  }

  return { timeZone: RELINK_TZ, tripMin, days, today: todayKey, unavailableToday };
}
