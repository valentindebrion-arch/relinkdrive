/* eslint-disable @typescript-eslint/no-explicit-any */
export type MapsNamespace = any;

declare global {
  interface Window {
    google?: { maps: MapsNamespace };
    __relinkMapsReady?: Promise<void>;
  }
}

/** Palette carte alignée sur l'identité verte du projet */
export const RELINK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f2f7f4" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6b64" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#d8e6de" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#e8f2eb" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#d6f0e2" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#b6e3cd" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c8e6dd" }] },
];

export function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.__relinkMapsReady) return window.__relinkMapsReady;
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
    | string
    | undefined;
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as
    | string
    | undefined;
  if (!key) return Promise.reject(new Error("Clé cartographie manquante"));
  window.__relinkMapsReady = new Promise<void>((resolve, reject) => {
    const cbName = "__relinkMapsInit";
    (window as unknown as Record<string, unknown>)[cbName] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=geometry&callback=${cbName}${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    script.onerror = () => reject(new Error("Chargement de la carte impossible"));
    document.head.appendChild(script);
  });
  return window.__relinkMapsReady;
}

/** Voiture vue de dessus, verte — illustration des chauffeurs fictifs. */
export const CAR_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <g transform="translate(17,17)">
      <rect x="-7" y="-11" width="14" height="22" rx="5" fill="#00a86b" stroke="#0b6b47" stroke-width="1.2"/>
      <rect x="-5" y="-8" width="10" height="6" rx="2.5" fill="#d6f0e2" opacity="0.95"/>
      <rect x="-5" y="2" width="10" height="6" rx="2.5" fill="#b6e3cd" opacity="0.9"/>
      <rect x="-7.8" y="-4" width="2" height="6" rx="1" fill="#0b6b47"/>
      <rect x="5.8" y="-4" width="2" height="6" rx="1" fill="#0b6b47"/>
    </g>
  </svg>`,
);
