/**
 * Analyse des QR codes chauffeur ReLink.
 *
 * Règle de sécurité : on n'ouvre jamais une adresse arbitraire contenue dans
 * un QR code. Seul un lien ReLink pointant vers `/q/<slug>` ou
 * `/chauffeur/<slug>` est accepté, et la navigation reste interne à
 * l'application. Les règles d'accès (dont Woman for Woman) sont appliquées
 * ensuite par la vitrine elle-même.
 */

/** Domaines ReLink reconnus, en plus de l'origine courante. */
const RELINK_HOSTS = [
  "relinkconnect.app",
  "www.relinkconnect.app",
  "relinkdrive.lovable.app",
];

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/i;

function isRelinkHost(host: string) {
  const clean = host.toLowerCase();
  if (RELINK_HOSTS.includes(clean)) return true;
  if (typeof window !== "undefined" && clean === window.location.host.toLowerCase()) return true;
  // Préviews et domaines de projet Lovable de ReLink.
  return clean.endsWith(".lovable.app") || clean.endsWith(".relinkconnect.app");
}

/**
 * Renvoie le slug du chauffeur si le contenu scanné est un QR code ReLink,
 * sinon `null`.
 */
export function parseDriverQr(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let path: string;
  if (value.startsWith("/")) {
    path = value;
  } else {
    let url: URL;
    try {
      url = new URL(value.includes("://") ? value : `https://${value}`);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!isRelinkHost(url.host)) return null;
    path = url.pathname;
  }

  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const prefix = segments[0];
  const slug = segments[1];
  if (!slug || (prefix !== "q" && prefix !== "chauffeur")) return null;
  const decoded = decodeURIComponent(slug);
  return SLUG_RE.test(decoded) ? decoded.toLowerCase() : null;
}

export const QR_INVALID_MESSAGE = "Ce QR code ne correspond pas à un chauffeur ReLink.";
export const QR_DENIED_MESSAGE =
  "L'accès à votre caméra est nécessaire pour scanner le QR code du chauffeur.";
