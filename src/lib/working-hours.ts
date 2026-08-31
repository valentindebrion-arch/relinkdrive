/**
 * Horaires habituels de travail du chauffeur.
 *
 * ReLink ne gère plus aucune disponibilité manuelle : le badge « Disponible »
 * est calculé automatiquement à partir des horaires renseignés par le chauffeur
 * dans sa vitrine, interprétés dans le fuseau de la France métropolitaine
 * (Europe/Paris, changements d'heure inclus).
 *
 * La structure reste évolutive : chaque jour porte une liste de créneaux, même
 * si l'éditeur n'en propose qu'un seul pour cette première version.
 */

export type WorkingSlot = { start: string; end: string };
/** `day` : 0 = lundi … 6 = dimanche. */
export type WorkingDay = { day: number; enabled: boolean; slots: WorkingSlot[] };

export const DAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

export const DRIVER_TIME_ZONE = "Europe/Paris";

export const WORKING_HOURS_DISCLAIMER =
  "Horaires renseignés par le chauffeur. Sa disponibilité réelle est à confirmer directement avec lui.";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isTime(v: unknown): v is string {
  return typeof v === "string" && TIME_RE.test(v);
}

export function emptyWorkingHours(): WorkingDay[] {
  return DAY_LABELS.map((_, day) => ({ day, enabled: false, slots: [{ start: "", end: "" }] }));
}

/** Valeur par défaut proposée à un chauffeur qui n'a encore rien renseigné. */
export function defaultWorkingHours(): WorkingDay[] {
  return DAY_LABELS.map((_, day) => ({
    day,
    enabled: day < 5,
    slots: [{ start: "08:00", end: "19:00" }],
  }));
}

/** Normalise n'importe quelle valeur venant de la base en semaine complète. */
export function parseWorkingHours(value: unknown): WorkingDay[] {
  const raw = Array.isArray(value) ? value : [];
  return DAY_LABELS.map((_, day) => {
    const found = raw.find(
      (r) => r && typeof r === "object" && Number((r as { day?: unknown }).day) === day,
    ) as { enabled?: unknown; slots?: unknown } | undefined;
    const slots = Array.isArray(found?.slots)
      ? (found.slots as unknown[])
          .map((s) => {
            const o = (s ?? {}) as { start?: unknown; end?: unknown };
            return { start: isTime(o.start) ? o.start : "", end: isTime(o.end) ? o.end : "" };
          })
          .filter((s) => s.start && s.end)
      : [];
    return {
      day,
      enabled: !!found?.enabled && slots.length > 0,
      slots: slots.length ? slots : [{ start: "", end: "" }],
    };
  });
}

/** Vrai si au moins un jour est renseigné. */
export function hasWorkingHours(week: WorkingDay[]) {
  return week.some((d) => d.enabled && d.slots.some((s) => s.start && s.end));
}

/** Sérialisation destinée à `driver_profiles.working_hours`. */
export function serializeWorkingHours(week: WorkingDay[]) {
  return week.map((d) => ({
    day: d.day,
    enabled: d.enabled && d.slots.some((s) => isTime(s.start) && isTime(s.end)),
    slots: d.slots.filter((s) => isTime(s.start) && isTime(s.end)),
  }));
}

const minutes = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

/** Heure locale du chauffeur (Europe/Paris), indépendante du fuseau du visiteur. */
export function driverLocalNow(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DRIVER_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const day = Math.max(0, order.indexOf(get("weekday")));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return { day, minutes: hour * 60 + minute };
}

/** Le chauffeur se trouve-t-il actuellement dans l'un de ses créneaux ? */
export function isWithinWorkingHours(week: WorkingDay[], now: Date = new Date()) {
  const { day, minutes: current } = driverLocalNow(now);
  const today = week.find((d) => d.day === day);
  if (!today?.enabled) return false;
  return today.slots.some((s) => {
    if (!isTime(s.start) || !isTime(s.end)) return false;
    const start = minutes(s.start);
    const end = minutes(s.end);
    // Créneau de nuit (22:00 – 02:00) : il court sur le lendemain.
    return end > start ? current >= start && current < end : current >= start || current < end;
  });
}

/** Créneaux du jour, pour l'affichage « Aujourd'hui ». */
export function todaySlots(week: WorkingDay[], now: Date = new Date()) {
  const { day } = driverLocalNow(now);
  const today = week.find((d) => d.day === day);
  return today?.enabled ? today.slots.filter((s) => s.start && s.end) : [];
}

export function formatSlots(slots: WorkingSlot[]) {
  return slots.length ? slots.map((s) => `${s.start} – ${s.end}`).join(" · ") : "Fermé";
}

/**
 * Indication sobre hors horaires : « Disponible à partir de 8h » lorsque le
 * prochain créneau est facilement calculable, sinon `null`.
 */
export function nextOpeningLabel(week: WorkingDay[], now: Date = new Date()): string | null {
  const { day, minutes: current } = driverLocalNow(now);
  for (let i = 0; i < 7; i++) {
    const d = week.find((w) => w.day === (day + i) % 7);
    if (!d?.enabled) continue;
    const slots = d.slots
      .filter((s) => s.start && s.end)
      .slice()
      .sort((a, b) => minutes(a.start) - minutes(b.start));
    const next = i === 0 ? slots.find((s) => minutes(s.start) > current) : slots[0];
    if (!next) continue;
    const label = next.start.replace(":00", "h").replace(":", "h");
    if (i === 0) return `Disponible à partir de ${label}`;
    if (i === 1) return `Disponible demain à partir de ${label}`;
    return `Disponible ${DAY_LABELS[d.day]?.toLowerCase()} à partir de ${label}`;
  }
  return null;
}
