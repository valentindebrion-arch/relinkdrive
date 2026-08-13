/** Types du service de géolocalisation interne (indépendant du fournisseur). */

export type GeoPoint = { lat: number; lng: number };

export type GeoAddress = {
  /** Libellé complet lisible ("10 Rue de Rivoli 75004 Paris"). */
  label: string;
  /** Numéro et rue lorsque disponibles. */
  street: string;
  postcode: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  /** Identifiant technique du fournisseur (facultatif). */
  id: string | null;
  /** Fournisseur d'origine du résultat. */
  source: string;
};

export type GeoRoute = {
  distanceKm: number;
  durationMin: number;
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints: GeoPoint[];
  status: "ok";
  provider: string;
};

/** Entrée d'itinéraire : adresse textuelle ou coordonnées déjà connues. */
export type RoutePlace = { address?: string; lat?: number; lng?: number };
