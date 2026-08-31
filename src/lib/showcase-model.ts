/**
 * Modèle unique de la vitrine chauffeur ReLink.
 *
 * La page publique (`/chauffeur/$slug`) et l'éditeur « Ma vitrine » (`/pro`)
 * consomment exactement le même objet : il n'existe aucune copie parallèle des
 * données. L'éditeur écrit dans les tables d'origine (`profiles`,
 * `driver_profiles`, `vehicles`, `driver_tariffs`) et la page publique les relit.
 */

import { DEPARTMENT_NAMES } from "@/lib/departments";

export type VehiclePhotoSlots = {
  exterior: string | null;
  side: string | null;
  front: string | null;
  interior: string | null;
};

export type ShowcaseVehicle = {
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  category: string | null;
  maxPassengers: number | null;
  luggage: number | null;
  largeLuggage: number | null;
  cabinLuggage: number | null;
  petsPolicy: string | null;
  petsMax: number | null;
  petsConditions: string | null;
  flags: Record<string, boolean>;
};

export type ShowcaseTariff = {
  pricePerKm: number | null;
  minimum: number | null;
  pickupPct: number | null;
};

export type ShowcaseContact = {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
};

export type ShowcaseLinks = {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  linkedin: string | null;
};

export type ShowcaseData = {
  slug: string | null;
  fullName: string | null;
  firstName: string;
  lastInitial: string | null;
  /** URL publique (OAuth) ou chemin de stockage dans le bucket `avatars`. */
  avatarUrl: string | null;
  businessName: string | null;
  city: string | null;
  zone: string | null;
  memberSince: string | null;
  womanForWoman: boolean;
  about: string | null;
  departments: string[];
  serviceAreas: string[];
  stations: string[];
  airports: string[];
  longDistance: boolean;
  services: string[];
  languages: string[];
  vehicle: ShowcaseVehicle;
  photos: VehiclePhotoSlots;
  tariff: ShowcaseTariff | null;
  contact: ShowcaseContact;
  links: ShowcaseLinks;
};

const str = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
};

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const list = (v: unknown) => (Array.isArray(v) ? (v as string[]).filter(Boolean) : []);

/** Prénom affiché publiquement (jamais le nom complet). */
export function showcaseFirstName(fullName?: string | null) {
  return (fullName ?? "").trim().split(" ").filter(Boolean)[0] || "Votre profil";
}

export function showcaseLastInitial(fullName?: string | null) {
  const parts = (fullName ?? "").trim().split(" ").filter(Boolean);
  return parts.length > 1 ? (parts[parts.length - 1]?.charAt(0).toUpperCase() ?? null) : null;
}

/** « Puy-de-Dôme (63) » — libellé lisible d'un département d'intervention. */
export function departmentLabel(code: string) {
  const c = code.trim().toUpperCase();
  const name = DEPARTMENT_NAMES[c];
  return name ? `${name} (${c})` : c;
}

/** Libellé court du véhicule (« Mercedes Classe E »). */
export function vehicleTitle(v: ShowcaseVehicle) {
  return [v.brand, v.model].filter(Boolean).join(" ") || "Mon véhicule";
}

const EMPTY_VEHICLE: ShowcaseVehicle = {
  brand: null,
  model: null,
  color: null,
  year: null,
  category: null,
  maxPassengers: null,
  luggage: null,
  largeLuggage: null,
  cabinLuggage: null,
  petsPolicy: null,
  petsMax: null,
  petsConditions: null,
  flags: {},
};

type Row = Record<string, unknown>;

/** Adaptateur : ligne renvoyée par `get_public_driver_page` → modèle vitrine. */
export function showcaseFromPublicRow(row: Row): ShowcaseData {
  const fullName = str(row["full_name"]);
  return {
    slug: str(row["slug"]),
    fullName,
    firstName: showcaseFirstName(fullName),
    lastInitial: showcaseLastInitial(fullName),
    avatarUrl: str(row["avatar_url"]),
    businessName: str(row["business_name"]),
    city: str(row["city"]),
    zone: str(row["zone"]),
    memberSince: str(row["member_since"]),
    womanForWoman: !!row["woman_for_woman"],
    about: str(row["public_intro"]) ?? str(row["bio"]),
    departments: list(row["service_departments"]),
    serviceAreas: list(row["service_areas"]),
    stations: list(row["stations"]),
    airports: list(row["airports"]),
    longDistance: !!row["long_distance"],
    services: list(row["services"]),
    languages: list(row["languages"]),
    vehicle: {
      brand: str(row["vehicle_brand"]),
      model: str(row["vehicle_model"]),
      color: str(row["vehicle_color"]),
      year: num(row["vehicle_year"]),
      category: str(row["vehicle_category"]),
      maxPassengers: num(row["max_passengers"]),
      luggage: num(row["luggage_capacity"]),
      largeLuggage: num(row["large_luggage_capacity"]),
      cabinLuggage: num(row["cabin_luggage_capacity"]),
      petsPolicy: str(row["pets_policy"]),
      petsMax: num(row["pets_max"]),
      petsConditions: str(row["pets_conditions"]),
      flags: {
        air_conditioning: !!row["air_conditioning"],
        chargers: !!row["chargers"],
        water: !!row["water"],
        card_payment: !!row["card_payment"],
        quiet_ride: !!row["quiet_ride"],
        luggage_help: !!row["luggage_help"],
        child_seat: !!row["child_seat"],
        booster_seat: !!row["booster_seat"],
        stroller_space: !!row["stroller_space"],
        accessible: !!row["accessible"],
        large_trunk: !!row["large_trunk"],
      },
    },
    photos: {
      exterior: str(row["vehicle_photo_url"]),
      side: str(row["vehicle_side_photo_url"]),
      front: str(row["vehicle_front_photo_url"]),
      interior: str(row["vehicle_interior_photo_url"]),
    },
    tariff: null,
    contact: {
      phone: str(row["public_phone"]),
      whatsapp: str(row["whatsapp_number"]),
      email: str(row["public_email"]),
      website: str(row["website_url"]),
    },
    links: {
      instagram: str(row["instagram_url"]),
      facebook: str(row["facebook_url"]),
      tiktok: str(row["tiktok_url"]),
      linkedin: str(row["linkedin_url"]),
    },
  };
}

/**
 * Adaptateur propriétaire : mêmes tables que la page publique, lues directement
 * par le chauffeur connecté (sa vitrine peut ne pas encore être publiée).
 */
export function showcaseFromOwnRows({
  profile,
  driver,
  vehicle,
  tariff,
}: {
  profile: Row | null | undefined;
  driver: Row | null | undefined;
  vehicle: Row | null | undefined;
  tariff: Row | null | undefined;
}): ShowcaseData {
  const fullName = str(profile?.["full_name"]);
  return {
    slug: str(driver?.["slug"]),
    fullName,
    firstName: showcaseFirstName(fullName),
    lastInitial: showcaseLastInitial(fullName),
    avatarUrl: str(profile?.["avatar_url"]),
    businessName: str(driver?.["business_name"]),
    city: str(driver?.["city"]),
    zone: str(driver?.["zone"]),
    memberSince: str(driver?.["created_at"]),
    womanForWoman: !!driver?.["woman_for_woman"],
    about: str(driver?.["public_intro"]) ?? str(driver?.["bio"]),
    departments: list(driver?.["service_departments"]),
    serviceAreas: list(driver?.["service_areas"]),
    stations: list(driver?.["stations"]),
    airports: list(driver?.["airports"]),
    longDistance: !!driver?.["long_distance"],
    services: list(driver?.["services"]),
    languages: list(driver?.["languages"]),
    vehicle: vehicle
      ? {
          brand: str(vehicle["brand"]),
          model: str(vehicle["model"]),
          color: str(vehicle["color"]),
          year: num(vehicle["year"]),
          category: str(vehicle["category"]),
          maxPassengers: num(vehicle["max_passengers"]),
          luggage: num(vehicle["luggage_capacity"]),
          largeLuggage: num(vehicle["large_luggage_capacity"]),
          cabinLuggage: num(vehicle["cabin_luggage_capacity"]),
          petsPolicy: str(vehicle["pets_policy"]),
          petsMax: num(vehicle["pets_max"]),
          petsConditions: str(vehicle["pets_conditions"]),
          flags: {
            air_conditioning: !!vehicle["air_conditioning"],
            chargers: !!vehicle["chargers"],
            water: !!vehicle["water"],
            card_payment: !!vehicle["card_payment"],
            quiet_ride: !!vehicle["quiet_ride"],
            luggage_help: !!vehicle["luggage_help"],
            child_seat: !!vehicle["child_seat"],
            booster_seat: !!vehicle["booster_seat"],
            stroller_space: !!vehicle["stroller_space"],
            accessible: !!vehicle["accessible"],
            large_trunk: !!vehicle["large_trunk"],
          },
        }
      : EMPTY_VEHICLE,
    photos: {
      exterior: str(vehicle?.["photo_url"]),
      side: str(vehicle?.["photo_side_url"]),
      front: str(vehicle?.["photo_front_url"]),
      interior: str(vehicle?.["photo_interior_url"]),
    },
    tariff: tariff
      ? {
          pricePerKm: num(tariff["price_per_km_ht"]),
          minimum: num(tariff["minimum_ht"]),
          pickupPct: num(tariff["pickup_pct"]),
        }
      : null,
    contact: {
      phone:
        driver?.["show_public_phone"] === false ? null : (str(driver?.["public_phone"]) ?? null),
      whatsapp:
        driver?.["show_whatsapp"] === false ? null : (str(driver?.["whatsapp_number"]) ?? null),
      email: str(profile?.["email"]),
      website: str(driver?.["website_url"]),
    },
    links: {
      instagram: str(driver?.["instagram_url"]),
      facebook: str(driver?.["facebook_url"]),
      tiktok: str(driver?.["tiktok_url"]),
      linkedin: str(driver?.["linkedin_url"]),
    },
  };
}

export type CompletionStep = { id: string; label: string; next: string; done: boolean };

/** Complétude simplifiée de la vitrine (une ligne par bloc public). */
export function showcaseCompletion(data: ShowcaseData) {
  const steps: CompletionStep[] = [
    {
      id: "photo",
      label: "Photo de profil",
      next: "ajoutez votre photo de profil",
      done: !!data.avatarUrl,
    },
    {
      id: "about",
      label: "Présentation",
      next: "présentez votre activité",
      done: !!data.about,
    },
    {
      id: "sectors",
      label: "Secteurs d'intervention",
      next: "ajoutez vos secteurs d'intervention",
      done: data.departments.length > 0 || !!data.city,
    },
    {
      id: "services",
      label: "Prestations",
      next: "ajoutez vos prestations",
      done: data.services.length > 0,
    },
    {
      id: "languages",
      label: "Langues parlées",
      next: "ajoutez les langues que vous parlez",
      done: data.languages.length > 0,
    },
    {
      id: "vehicle",
      label: "Mon véhicule",
      next: "renseignez votre véhicule",
      done: !!(data.vehicle.brand || data.vehicle.model),
    },
    {
      id: "photos",
      label: "Photos du véhicule",
      next: "ajoutez les photos de votre véhicule",
      done: !!(data.photos.exterior || data.photos.interior),
    },
    {
      id: "tariffs",
      label: "Tarifs",
      next: "renseignez vos tarifs",
      done: !!data.tariff?.pricePerKm,
    },
    {
      id: "contact",
      label: "Moyens de contact",
      next: "ajoutez vos moyens de contact",
      done: !!(data.contact.phone || data.contact.whatsapp || data.contact.email),
    },
  ];
  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    done,
    total: steps.length,
    pct: Math.round((done / steps.length) * 100),
    nextStep: steps.find((s) => !s.done) ?? null,
  };
}
