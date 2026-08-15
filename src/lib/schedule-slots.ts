/**
 * Types et helpers partagés de l'agenda de réservation Relink.
 * Aucune donnée privée du planning chauffeur ne transite ici : uniquement
 * « disponible » ou « indisponible ».
 */
import { RELINK_TZ } from "@/lib/schedule";

/** Pas d'affichage des créneaux proposés au client (minutes). */
export const SLOT_UI_STEP_MIN = 15;
/** Délai minimal entre maintenant et le début d'une course planifiée. */
export const MIN_NOTICE_MIN = 30;
/** Période maximale de réservation à l'avance (jours). */
export const MAX_ADVANCE_DAYS = 90;

export type DayStatus = "free" | "partial" | "full" | "closed" | "past";

export type ScheduleDay = {
  /** "YYYY-MM-DD" (heure de Paris) */
  date: string;
  status: DayStatus;
  /** Départs réellement réservables (ISO UTC). */
  slots: string[];
};

export type DriverSchedule = {
  timeZone: string;
  tripMin: number;
  days: ScheduleDay[];
  /** Date locale (Europe/Paris) du chauffeur au moment du calcul. */
  today: string;
  /** Le chauffeur s'est déclaré non disponible : journée en cours entièrement bloquée. */
  unavailableToday: boolean;
};

/** Message affiché lorsqu'un créneau du jour est refusé pour cause d'indisponibilité. */
export const UNAVAILABLE_TODAY_MSG =
  "Ce chauffeur n'est plus disponible aujourd'hui. Veuillez choisir une autre date.";

/** Décalage (minutes) du fuseau Relink pour un instant donné. */
function offsetMinutes(d: Date) {
  const local = new Date(d.toLocaleString("en-US", { timeZone: RELINK_TZ }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 60_000);
}

/** Instant UTC correspondant à une heure murale de Paris (gère l'heure d'été). */
export function parisInstant(day: string, minutesFromMidnight: number): Date {
  const base = Date.parse(`${day}T00:00:00Z`) + minutesFromMidnight * 60_000;
  let t = base - offsetMinutes(new Date(base)) * 60_000;
  t = base - offsetMinutes(new Date(t)) * 60_000;
  return new Date(t);
}

/** "YYYY-MM-DD" d'un instant, exprimé dans le fuseau Relink. */
export function parisDay(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RELINK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts;
}

export function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: RELINK_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSlotFull(iso: string) {
  const label = new Date(iso).toLocaleString("fr-FR", {
    timeZone: RELINK_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return label.replace(" à ", " à ").replace(/^./, (c) => c.toUpperCase());
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
