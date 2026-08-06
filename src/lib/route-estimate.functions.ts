import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Service de cartographie indisponible");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
  };
}

async function failure(response: Response) {
  const body = await response.text();
  console.error(`Google Maps gateway failed [${response.status}]: ${body}`);
  if (response.status === 403) {
    throw new Error("Requête cartographie refusée (403).");
  }
  throw new Error(`Cartographie indisponible (${response.status})`);
}

/** Tarification Relink : 1,90 €/km, minimum 9 €, arrondi à l'euro supérieur (pourboire chauffeur). */
export function priceForKm(km: number) {
  const base = Math.max(9, km * 1.9);
  const total = Math.ceil(base);
  return { base: Math.round(base * 100) / 100, total, tip: Math.round((total - base) * 100) / 100 };
}

export const estimateRoute = createServerFn({ method: "POST" })
  .inputValidator((input: { origin: string; destination: string }) =>
    z
      .object({
        origin: z.string().trim().min(3).max(200),
        destination: z.string().trim().min(3).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        ...gatewayHeaders(),
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.viewport",
      },
      body: JSON.stringify({
        origin: { address: data.origin },
        destination: { address: data.destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        polylineEncoding: "ENCODED_POLYLINE",
        languageCode: "fr-FR",
        units: "METRIC",
      }),
    });
    if (!response.ok) await failure(response);
    const json = (await response.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        polyline?: { encodedPolyline?: string };
      }>;
    };
    const route = json.routes?.[0];
    if (!route?.distanceMeters) throw new Error("Itinéraire introuvable pour ces adresses");
    const km = route.distanceMeters / 1000;
    const minutes = Math.round(Number((route.duration ?? "0s").replace("s", "")) / 60);
    return {
      distanceKm: Math.round(km * 10) / 10,
      durationMin: minutes,
      polyline: route.polyline?.encodedPolyline ?? "",
      price: priceForKm(km),
    };
  });

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lng: number }) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input),
  )
  .handler(async ({ data }) => {
    const response = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?latlng=${data.lat},${data.lng}&language=fr`,
      { headers: gatewayHeaders() },
    );
    if (!response.ok) await failure(response);
    const json = (await response.json()) as { results?: Array<{ formatted_address?: string }> };
    const address = json.results?.[0]?.formatted_address;
    if (!address) throw new Error("Adresse introuvable à votre position");
    return { address };
  });
