/**
 * Support SAV ReLink — modèle partagé utilisateur / administration.
 *
 * Ce système n'est PAS une messagerie : il n'existe aucun échange direct entre
 * clients et chauffeurs. Une conversation lie uniquement un utilisateur à
 * l'équipe support ReLink, au sein d'un ticket.
 */

export const SUPPORT_CATEGORIES = [
  "Problème avec mon compte",
  "Modifier mes informations personnelles",
  "Problème avec ma vitrine",
  "Problème avec mon véhicule",
  "Problème avec l'estimateur",
  "Problème avec mon QR Code",
  "Problème technique",
  "Autre",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUSES = [
  "new",
  "in_progress",
  "waiting_user",
  "resolved",
  "closed",
] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  waiting_user: "En attente utilisateur",
  resolved: "Résolu",
  closed: "Fermé",
};

export function supportStatusTone(
  status: string,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "new":
      return "info";
    case "in_progress":
      return "warning";
    case "waiting_user":
      return "warning";
    case "resolved":
      return "success";
    default:
      return "neutral";
  }
}

export const USER_KIND_LABELS: Record<string, string> = {
  client: "Client",
  driver: "Chauffeur",
};

export type SupportTicket = {
  id: string;
  ticket_number: number;
  user_id: string;
  user_kind: "client" | "driver";
  category: string;
  subject: string;
  status: SupportStatus;
  origin_path: string | null;
  assigned_admin: string | null;
  last_message_at: string;
  last_admin_reply_at: string | null;
  user_unread: boolean;
  admin_unread: boolean;
  created_at: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_kind: "user" | "admin";
  body: string;
  attachment_path: string | null;
  created_at: string;
};

export const ATTACHMENT_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

/** Message prérempli du parcours « correction du sexe déjà utilisée ». */
export const GENDER_TICKET = {
  category: "Modifier mes informations personnelles" as SupportCategory,
  message:
    "Je souhaite demander une nouvelle modification de l'information Sexe de mon profil.",
};
