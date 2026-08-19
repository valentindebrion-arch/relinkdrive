/**
 * Notifications du module de facturation électronique.
 *
 * Règle : aucune notification de réussite tant que l'accusé correspondant n'a
 * pas été reçu. Une transmission déposée est annoncée comme « transmise à ma
 * plateforme », jamais comme « acceptée » ou « transmise à l'administration ».
 */
import { supabase } from "@/integrations/supabase/client";

export type EinvoiceNotificationKey =
  | "invoice_submitted"
  | "invoice_acknowledged"
  | "invoice_delivered"
  | "invoice_rejected"
  | "ereporting_submitted"
  | "ereporting_acknowledged"
  | "ereporting_rejected"
  | "connection_expired"
  | "deadline_soon"
  | "missing_data"
  | "payment_to_confirm";

const MESSAGES: Record<EinvoiceNotificationKey, { title: string; body: string }> = {
  invoice_submitted: { title: "Facture transmise à votre plateforme", body: "L'accusé de la plateforme est en attente." },
  invoice_acknowledged: { title: "Accusé reçu", body: "Votre plateforme agréée a accusé réception de la facture." },
  invoice_delivered: { title: "Facture livrée", body: "La facture a été remise au destinataire." },
  invoice_rejected: { title: "Facture rejetée", body: "Consultez le motif détaillé dans Facturation électronique." },
  ereporting_submitted: { title: "E-reporting transmis", body: "L'accusé de la plateforme est en attente." },
  ereporting_acknowledged: { title: "E-reporting accusé", body: "Votre déclaration a été accusée par la plateforme." },
  ereporting_rejected: { title: "E-reporting rejeté", body: "Corrigez la période puis retransmettez." },
  connection_expired: { title: "Connexion plateforme expirée", body: "Reconnectez votre plateforme agréée." },
  deadline_soon: { title: "Échéance d'e-reporting proche", body: "Une période attend votre transmission." },
  missing_data: { title: "Données manquantes", body: "Des informations sont requises avant transmission." },
  payment_to_confirm: { title: "Encaissement à confirmer", body: "Confirmez le règlement pour fiabiliser vos déclarations." },
};

export async function notifyEinvoicing(userId: string, key: EinvoiceNotificationKey, extra?: string) {
  const base = MESSAGES[key];
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title: base.title,
    body: extra ? `${base.body} ${extra}` : base.body,
    kind: "invoice",
    link: "/pro/einvoicing",
  });
  if (error) console.warn("notification e-invoicing ignorée:", error.message);
}
