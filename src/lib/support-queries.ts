/**
 * Accès aux tickets SAV. Toutes les requêtes passent par le client Supabase du
 * navigateur : les règles RLS garantissent qu'un utilisateur ne voit que ses
 * propres demandes et qu'un administrateur accède à l'ensemble du support.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME,
  type SupportMessage,
  type SupportStatus,
  type SupportTicket,
} from "@/lib/support";

const BUCKET = "support-attachments";

export async function uploadAttachment(userId: string, file: File) {
  if (!ATTACHMENT_MIME.includes(file.type)) {
    throw new Error("Format non pris en charge (JPG, PNG, WEBP ou PDF).");
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error("Fichier trop volumineux (8 Mo maximum).");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function attachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function createTicket(input: {
  userId: string;
  userKind: "client" | "driver";
  category: string;
  message: string;
  originPath?: string | null;
  attachment?: File | null;
}) {
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: input.userId,
      user_kind: input.userKind,
      category: input.category,
      subject: input.category,
      origin_path: input.originPath ?? null,
    })
    .select("id, ticket_number")
    .single();
  if (error) throw error;

  let attachmentPath: string | null = null;
  if (input.attachment) attachmentPath = await uploadAttachment(input.userId, input.attachment);

  const { error: msgError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: input.userId,
    author_kind: "user",
    body: input.message,
    attachment_path: attachmentPath,
  });
  if (msgError) throw msgError;

  return ticket as { id: string; ticket_number: number };
}

export async function listMyTickets(userId: string) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function getTicket(ticketId: string) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as SupportTicket | null;
}

export async function listMessages(ticketId: string) {
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportMessage[];
}

export async function replyToTicket(input: {
  ticketId: string;
  authorId: string;
  authorKind: "user" | "admin";
  body: string;
  attachment?: File | null;
}) {
  let attachmentPath: string | null = null;
  if (input.attachment) attachmentPath = await uploadAttachment(input.authorId, input.attachment);
  const { error } = await supabase.from("support_messages").insert({
    ticket_id: input.ticketId,
    author_id: input.authorId,
    author_kind: input.authorKind,
    body: input.body,
    attachment_path: attachmentPath,
  });
  if (error) throw error;
}

/** Marque le fil comme lu côté utilisateur (aucune notification push). */
export async function markUserRead(ticketId: string) {
  await supabase.from("support_tickets").update({ user_unread: false }).eq("id", ticketId);
}

export async function adminSetStatus(ticketId: string, status: SupportStatus, adminId: string) {
  const { error } = await supabase
    .from("support_tickets")
    .update({ status, assigned_admin: adminId, admin_unread: false })
    .eq("id", ticketId);
  if (error) throw error;
}

export async function adminMarkRead(ticketId: string) {
  await supabase.from("support_tickets").update({ admin_unread: false }).eq("id", ticketId);
}

export async function listAllTickets() {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function listUserTickets(userId: string) {
  return listMyTickets(userId);
}

export async function countAdminPending() {
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .in("status", ["new", "in_progress"]);
  return count ?? 0;
}

/** Historique des actions administratives sensibles sur un compte. */
export async function listAdminHistory(targetUserId: string) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, resource, old_value, new_value, reason, created_at, actor_id")
    .eq("target_user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function logAdminChange(input: {
  targetUserId: string;
  action: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason?: string | null;
  ticketId?: string | null;
}) {
  const args = {
    _target_user_id: input.targetUserId,
    _action: input.action,
    _field: input.field,
    _old_value: (input.oldValue ?? null) as never,
    _new_value: (input.newValue ?? null) as never,
    ...(input.reason ? { _reason: input.reason } : {}),
    ...(input.ticketId ? { _ticket_id: input.ticketId } : {}),
  };
  const { error } = await supabase.rpc("admin_log_change", args);
  if (error) throw error;
}
