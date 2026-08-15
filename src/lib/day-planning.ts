/**
 * Vue journalière du planning chauffeur : types partagés client/serveur et
 * helpers d'affichage. Toutes les heures sont exprimées en heure murale
 * Europe/Paris ("HH:MM") ou en minutes depuis minuit.
 */

export type DayEventKind = "ride" | "request" | "block";

export type DayEvent = {
  id: string;
  kind: DayEventKind;
  /** Instant de prise en charge (ISO UTC). */
  startIso: string;
  /** Minutes depuis minuit (Europe/Paris). */
  startMin: number;
  /** Durée estimée en minutes, null si non estimable. */
  durationMin: number | null;
  clientLabel: string | null;
  pickup: string;
  dropoff: string;
  status: string;
  price: number | null;
  /** Course « flash » (demandée pour tout de suite). */
  flash: boolean;
};

export type DayBreak = {
  id: string;
  startMin: number;
  endMin: number;
  reason: string | null;
  /** Pause récurrente sur ce jour de la semaine. */
  recurring: boolean;
};

export type DayPlan = {
  /** "YYYY-MM-DD" */
  date: string;
  /** Horaires réellement déclarés pour cette journée ? */
  defined: boolean;
  available: boolean;
  /** Minutes depuis minuit. */
  startMin: number;
  endMin: number;
  /** Horaires exceptionnels propres à cette date. */
  overridden: boolean;
  bufferMin: number;
  onDuty: boolean;
  absent: boolean;
  events: DayEvent[];
  breaks: DayBreak[];
};

export const BUFFER_OPTIONS = [0, 10, 15, 30] as const;

export function minutesToTime(min: number) {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function timeToMin(value: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "1 h 20", "45 min". */
export function formatDuration(min: number) {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

export function formatLongDate(date: string) {
  const label = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Statuts de course qui occupent réellement le planning. */
export const ACTIVE_RIDE_STATUSES = [
  "confirmed",
  "driver_enroute",
  "driver_arrived",
  "client_onboard",
  "in_progress",
  "completed",
] as const;

export const PENDING_REQUEST_STATUSES = [
  "new",
  "reviewing",
  "proposal_sent",
  "awaiting_client",
] as const;

export type TimelineSlice =
  | { type: "event"; event: DayEvent; startMin: number; endMin: number; estimated: boolean; conflict: boolean }
  | { type: "break"; item: DayBreak; startMin: number; endMin: number }
  | { type: "buffer"; startMin: number; endMin: number; unknownEnd: boolean }
  | { type: "gap"; startMin: number; endMin: number };

/**
 * Construit la frise de la journée : événements positionnés à leur heure
 * réelle, pauses théoriques après chaque course et temps libres intercalés.
 */
export function buildTimeline(plan: DayPlan): { slices: TimelineSlice[]; conflicts: number; busyMin: number } {
  const blocks: TimelineSlice[] = [];

  const sorted = [...plan.events].sort((a, b) => a.startMin - b.startMin);
  let prevEnd: number | null = null;
  let conflicts = 0;

  for (const ev of sorted) {
    const estimated = ev.durationMin === null;
    const end = ev.startMin + (ev.durationMin ?? 60);
    const conflict = prevEnd !== null && ev.startMin < prevEnd;
    if (conflict) conflicts++;
    blocks.push({ type: "event", event: ev, startMin: ev.startMin, endMin: end, estimated, conflict });
    if (plan.bufferMin > 0) {
      blocks.push({ type: "buffer", startMin: end, endMin: end + plan.bufferMin, unknownEnd: estimated });
    }
    prevEnd = end + plan.bufferMin;
  }

  for (const b of plan.breaks) {
    blocks.push({ type: "break", item: b, startMin: b.startMin, endMin: b.endMin });
  }

  blocks.sort((a, b) => a.startMin - b.startMin);

  // Temps libres entre deux éléments, bornés par la prise et la fin de poste.
  const slices: TimelineSlice[] = [];
  let cursor = plan.startMin;
  for (const b of blocks) {
    if (b.startMin > cursor) slices.push({ type: "gap", startMin: cursor, endMin: b.startMin });
    slices.push(b);
    cursor = Math.max(cursor, b.endMin);
  }
  if (cursor < plan.endMin) slices.push({ type: "gap", startMin: cursor, endMin: plan.endMin });

  const busyMin = blocks.reduce((acc, b) => acc + Math.max(0, b.endMin - b.startMin), 0);
  return { slices, conflicts, busyMin };
}
