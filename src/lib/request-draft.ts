/**
 * Sauvegarde temporaire du brouillon « Nouvelle course » pour ne rien perdre
 * lorsque le client quitte le formulaire pour ajouter un chauffeur (QR / lien).
 */
const KEY = "relink.request.draft";

export type RequestDraft = {
  driver_id: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  whenMode: "now" | "later";
  pickupOk: boolean;
  dropoffOk: boolean;
};

export function saveRequestDraft(draft: RequestDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* stockage indisponible */
  }
}

export function loadRequestDraft(): RequestDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RequestDraft;
    if (typeof parsed?.pickup_address !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRequestDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
}
