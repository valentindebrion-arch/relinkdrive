/**
 * Blocs communs aux fiches administratives : tickets SAV du compte,
 * historique des modifications sensibles et correction SAV du sexe.
 *
 * Aucune donnée n'est dupliquée : ces composants lisent et écrivent
 * directement dans les tables réellement utilisées par l'application.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, LifeBuoy, Lock, Venus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listAdminHistory, listUserTickets } from "@/lib/support-queries";
import { SUPPORT_STATUS_LABELS } from "@/lib/support";
import { formatDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AdminTicketsCard({ userId }: { userId: string }) {
  const { data: tickets } = useQuery({
    queryKey: ["admin", "user-tickets", userId],
    queryFn: () => listUserTickets(userId),
  });
  const rows = tickets ?? [];

  return (
    <section className="surface mb-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <LifeBuoy className="size-4 text-primary" /> Support
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {rows.length === 0
          ? "Aucune demande"
          : `${rows.length} demande${rows.length > 1 ? "s" : ""}`}
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((t) => (
          <li key={t.id}>
            <Link
              to="/admin/support/$ticketId"
              params={{ ticketId: t.id }}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm hover:border-primary/40"
            >
              <span className="truncate">
                #{t.ticket_number} {t.subject}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {SUPPORT_STATUS_LABELS[t.status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminHistoryCard({ userId }: { userId: string }) {
  const { data: logs } = useQuery({
    queryKey: ["admin", "history", userId],
    queryFn: () => listAdminHistory(userId),
  });

  return (
    <section className="surface mb-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <History className="size-4 text-primary" /> Historique Admin
      </h2>
      {(logs ?? []).length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Aucune modification enregistrée.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {(logs ?? []).map((l) => (
            <li key={l.id} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">{formatDateTime(l.created_at)}</p>
              <p className="mt-0.5">
                <span className="font-medium">{l.resource ?? l.action}</span>{" "}
                {JSON.stringify(l.old_value)} → {JSON.stringify(l.new_value)}
              </p>
              {l.reason ? <p className="text-xs text-muted-foreground">{l.reason}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const GENDER_LABELS: Record<string, string> = {
  female: "Femme",
  male: "Homme",
  undisclosed: "Non précisé",
};

/** Correction SAV du sexe : autorisée même après la correction autonome. */
export function AdminGenderCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string>("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "gender", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("gender, gender_correction_used")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
  });

  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_set_user_gender", {
        _user_id: userId,
        _gender: value,
      });
      if (error) throw error;
      await qc.invalidateQueries();
      toast.success("Information corrigée. Les règles Woman for Woman sont réappliquées.");
      setConfirm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification impossible");
    } finally {
      setBusy(false);
    }
  }

  const locked = Boolean(data?.gender_correction_used);

  return (
    <section className="surface mb-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Venus className="size-4 text-primary" /> Sexe
      </h2>
      <p className="mt-1 text-sm">
        Sexe : <strong>{GENDER_LABELS[data?.gender ?? ""] ?? "Non renseigné"}</strong>
      </p>
      <p className="text-xs text-muted-foreground">
        Correction autonome utilisée : {locked ? "Oui" : "Non"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Nouvelle valeur du sexe"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-10 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">Choisir…</option>
          <option value="female">Femme</option>
          <option value="male">Homme</option>
          <option value="undisclosed">Non précisé</option>
        </select>
        <Button
          size="sm"
          variant="outline"
          className="min-h-10"
          disabled={!value || value === data?.gender}
          onClick={() => setConfirm(true)}
        >
          {locked ? (
            <>
              <Lock className="size-3.5" /> Corriger (SAV)
            </>
          ) : (
            "Corriger"
          )}
        </Button>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifier une information verrouillée</AlertDialogTitle>
            <AlertDialogDescription>
              {locked
                ? "Cet utilisateur a déjà utilisé sa correction autonome. Vous êtes sur le point d'effectuer une modification SAV."
                : "Vous êtes sur le point de modifier le sexe déclaré de cet utilisateur."}{" "}
              Les droits Woman for Woman et le thème de vitrine seront réalignés immédiatement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {busy ? "Enregistrement…" : "Confirmer la modification"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
