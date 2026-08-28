/**
 * Classement des courses de l'espace chauffeur.
 *
 * Une course appartient toujours à une seule catégorie :
 * - `activeRide`            : la seule course affichée dans le grand bloc
 * - `upcomingScheduled`     : section « Prochainement » (> 1 h avant le départ)
 * - `toFollow`              : courses programmées imminentes masquées par une course flash
 * - `pendingRequests`       : demandes à accepter ou refuser
 *
 * Le type de course (`ride_type`) est une donnée persistée à la création :
 * il n'est jamais déduit de l'heure, du statut ou du temps restant.
 */

export type RideType = "flash" | "scheduled";

/** Seuil de bascule d'une course programmée vers le grand bloc. */
export const IMMINENT_WINDOW_MIN = 60;

export const OPERATIONAL_STATUSES = [
  "driver_enroute",
  "driver_arrived",
  "client_onboard",
  "in_progress",
] as const;

/** Statuts d'une course encore ouverte (hors clôture). */
export const OPEN_RIDE_STATUSES = ["confirmed", ...OPERATIONAL_STATUSES] as const;

export const CLOSED_RIDE_STATUSES = ["completed", "cancelled", "refused", "expired"] as const;

export const PENDING_REQUEST_STATUSES = ["new", "reviewing", "proposal_sent", "awaiting_client"] as const;

export type BoardRide = {
  id: string;
  ride_type: RideType;
  status: string;
  scheduled_at: string;
  pickup_address: string;
  dropoff_address: string;
  client_label: string | null;
  /** Téléphone du client, uniquement si le chauffeur est réellement lié à la course. */
  client_phone: string | null;
  client_id: string | null;
  price: number | null;
  passengers: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  payment_method: string | null;
  cancel_request_status: string | null;
};

export type BoardRequest = {
  id: string;
  ride_type: RideType;
  status: string;
  scheduled_at: string;
  created_at: string;
  pickup_address: string;
  dropoff_address: string;
  proposed_price: number | null;
};

export type DriverBoard = {
  /** Heure serveur de référence (le navigateur peut être désynchronisé). */
  nowIso: string;
  activeRide: BoardRide | null;
  /** Pourquoi cette course occupe le grand bloc. */
  activeReason: "operational" | "flash" | "imminent" | null;
  upcomingScheduled: BoardRide[];
  toFollow: BoardRide[];
  pendingRequests: BoardRequest[];
  /** Deux courses programmées se trouvent dans la fenêtre d'une heure. */
  scheduleConflict: boolean;
};

export const CONFLICT_MESSAGE =
  "Deux courses proches nécessitent votre attention. Consultez votre planning.";

export function isClosed(status: string) {
  return (CLOSED_RIDE_STATUSES as readonly string[]).includes(status);
}

export function isOperational(status: string) {
  return (OPERATIONAL_STATUSES as readonly string[]).includes(status);
}

/** Une course programmée devient éligible au grand bloc à T - 1 h. */
export function isImminent(scheduledIso: string, now: Date) {
  const diff = new Date(scheduledIso).getTime() - now.getTime();
  return diff <= IMMINENT_WINDOW_MIN * 60_000;
}

/** Classement central, partagé par le serveur et l'affichage. */
export function classifyDriverRides(
  rides: BoardRide[],
  requests: BoardRequest[],
  now: Date,
): Omit<DriverBoard, "nowIso"> {
  const open = rides
    .filter((r) => !isClosed(r.status))
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));

  const operational = open.filter((r) => isOperational(r.status));
  const confirmed = open.filter((r) => r.status === "confirmed");
  const flash = confirmed.filter((r) => r.ride_type === "flash");
  const scheduled = confirmed.filter((r) => r.ride_type !== "flash");
  const imminent = scheduled.filter((r) => isImminent(r.scheduled_at, now));
  const later = scheduled.filter((r) => !isImminent(r.scheduled_at, now));

  let activeRide: BoardRide | null = null;
  let activeReason: DriverBoard["activeReason"] = null;
  if (operational[0]) {
    activeRide = operational[0];
    activeReason = operational[0].ride_type === "flash" ? "flash" : "operational";
  } else if (flash[0]) {
    activeRide = flash[0];
    activeReason = "flash";
  } else if (imminent[0]) {
    activeRide = imminent[0];
    activeReason = "imminent";
  }

  const activeId = activeRide?.id;
  const toFollow = imminent.filter((r) => r.id !== activeId);
  const upcomingScheduled = later.filter((r) => r.id !== activeId);

  return {
    activeRide,
    activeReason,
    upcomingScheduled,
    toFollow,
    pendingRequests: requests
      .filter((r) => (PENDING_REQUEST_STATUSES as readonly string[]).includes(r.status))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    scheduleConflict: imminent.length > 1,
  };
}

/* -------------------------------------------------------------------------- */
/* Formatage (fuseau Europe/Paris)                                             */
/* -------------------------------------------------------------------------- */

const PARIS = "Europe/Paris";

export function parisDayKey(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: PARIS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parisTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function parisDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** « Aujourd'hui dans 5 h 30 », « Demain à 09:00 », « lundi 24 août à 14:30 ». */
export function relativeStart(iso: string, now: Date) {
  const target = new Date(iso);
  const diff = target.getTime() - now.getTime();
  const today = parisDayKey(now);
  const tomorrow = parisDayKey(new Date(now.getTime() + 86_400_000));
  const day = parisDayKey(target);

  if (diff <= 0) return `Prévue à ${parisTime(iso)}`;
  if (day === today) {
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return h > 0
      ? `Aujourd'hui dans ${h} h ${String(m).padStart(2, "0")}`
      : `Aujourd'hui dans ${m} min`;
  }
  if (day === tomorrow) return `Demain à ${parisTime(iso)}`;
  return `${parisDate(iso)} à ${parisTime(iso)}`;
}

/** Compte à rebours court : « 45 min », « 3 h 20 ». */
export function countdownLabel(iso: string, now: Date) {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export const RIDE_TYPE_LABELS: Record<RideType, string> = {
  flash: "Course flash",
  scheduled: "Course programmée",
};
