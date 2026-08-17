/** Helpers partagés pour l'information du client par SMS (aucune donnée sensible dans l'URL). */

export const RELINK_PUBLIC_URL = "https://relinkdrive.lovable.app";

/** Statuts pendant lesquels l'action SMS « je pars chez le client » reste pertinente. */
export const SMS_STATUSES = ["driver_enroute", "driver_arrived"] as const;

/** Normalise un numéro français/international en E.164, ou null si invalide. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s().-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return cleaned;
  if (/^0[1-9]\d{8}$/.test(cleaned)) return `+33${cleaned.slice(1)}`;
  if (/^00[1-9]\d{7,14}$/.test(cleaned)) return `+${cleaned.slice(2)}`;
  return null;
}

/** Lien HTTPS officiel vers la fiche côté client (authentification requise côté serveur). */
export function rideClientUrl(rideId: string, origin?: string) {
  const base =
    origin && origin.startsWith("https://") && !origin.includes("localhost")
      ? origin
      : RELINK_PUBLIC_URL;
  return `${base}/espace/courses/${rideId}`;
}

export function formatPickupHour(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}


/**
 * Message prérempli : aucune adresse, aucun nom complet, aucune donnée de paiement.
 * ReLink n'apparaît que comme signature technique du message, jamais comme auteur.
 */
export function buildSmsMessage(opts: {
  kind?: SmsKind;
  driverFirstName?: string | null;
  scheduledAt: string;
  link: string;
}) {
  const who = opts.driverFirstName?.trim();
  const prefix = who ? `Bonjour, ${who}, votre chauffeur, ` : "Bonjour, votre chauffeur ";
  const body =
    opts.kind === "arrival"
      ? "est arrivé au lieu de prise en charge."
      : `est en route pour votre prise en charge prévue à ${formatPickupHour(opts.scheduledAt)}.`;
  return `${prefix}${body} Vous pouvez consulter votre course ici : ${opts.link}\n— Message transmis via ReLink, l'outil de réservation utilisé par votre chauffeur.`;
}



export function isIosDevice(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
}

export function isMobileDevice(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /Android|iPad|iPhone|iPod|Mobile/i.test(ua);
}

/** iPhone attend « & » avant body, Android « ? ». */
export function buildSmsHref(phone: string, message: string, ua?: string) {
  const separator = isIosDevice(ua) ? "&" : "?";
  return `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
}
