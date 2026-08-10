/**
 * Disponibilités déclarées d'un chauffeur : horaires hebdomadaires + absences.
 * Toutes les comparaisons se font dans le fuseau horaire de référence Relink.
 */
export const RELINK_TZ = "Europe/Paris";

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Lundi", short: "Lun" },
  { value: 2, label: "Mardi", short: "Mar" },
  { value: 3, label: "Mercredi", short: "Mer" },
  { value: 4, label: "Jeudi", short: "Jeu" },
  { value: 5, label: "Vendredi", short: "Ven" },
  { value: 6, label: "Samedi", short: "Sam" },
  { value: 7, label: "Dimanche", short: "Dim" },
];

export type WorkingHour = {
  weekday: number;
  active: boolean;
  /** "HH:MM" ou "HH:MM:SS" */
  start_time: string;
  end_time: string;
};

export type Absence = {
  id?: string;
  /** "YYYY-MM-DD" */
  starts_on: string;
  ends_on: string;
  reason?: string | null;
};

/** Heure "HH:MM[:SS]" → minutes depuis minuit. */
export function timeToMinutes(value: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatTime(value: string) {
  return value.slice(0, 5);
}

/** Représentation "heure murale Relink" d'un instant, manipulable avec l'API Date locale. */
function wallClock(date: Date) {
  return new Date(date.toLocaleString("en-US", { timeZone: RELINK_TZ }));
}

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isoWeekday(d: Date) {
  return ((d.getDay() + 6) % 7) + 1;
}

/**
 * La totalité de l'intervalle [start, end] tient-elle dans les disponibilités déclarées ?
 * Un chauffeur qui n'a jamais renseigné d'horaires reste réservable.
 */
export function fitsDeclaredAvailability(
  hours: WorkingHour[],
  absences: Absence[],
  start: Date,
  end: Date,
): boolean {
  if (end.getTime() < start.getTime()) return false;
  if (!hours.length) return absences.every((a) => !overlapsAbsence(a, start, end));

  const s = wallClock(start);
  const e = wallClock(end);
  const cursor = new Date(s);
  cursor.setHours(0, 0, 0, 0);
  const lastDay = new Date(e);
  lastDay.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= lastDay.getTime()) {
    const day = ymd(cursor);
    if (absences.some((a) => day >= a.starts_on && day <= a.ends_on)) return false;
    const row = hours.find((h) => h.weekday === isoWeekday(cursor));
    if (!row || !row.active) return false;
    const startMin = timeToMinutes(row.start_time);
    const endMin = timeToMinutes(row.end_time);
    if (startMin === null || endMin === null) return false;
    const dayStart = cursor.getTime() + startMin * 60_000;
    const dayEnd = cursor.getTime() + endMin * 60_000;
    if (Math.max(s.getTime(), cursor.getTime()) < dayStart) return false;
    if (Math.min(e.getTime(), cursor.getTime() + 86_400_000) > dayEnd) return false;
    cursor.setDate(cursor.getDate() + 1);
  }
  return true;
}

function overlapsAbsence(a: Absence, start: Date, end: Date) {
  const s = wallClock(start);
  const e = wallClock(end);
  const cursor = new Date(s);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(e);
  last.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= last.getTime()) {
    const day = ymd(cursor);
    if (day >= a.starts_on && day <= a.ends_on) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export function formatAbsenceRange(a: Absence) {
  const fmt = (v: string) =>
    new Date(`${v}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return a.starts_on === a.ends_on ? fmt(a.starts_on) : `Du ${fmt(a.starts_on)} au ${fmt(a.ends_on)}`;
}
