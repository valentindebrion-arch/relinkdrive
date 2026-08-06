import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/utilisateurs")({
  component: AdminUsers,
});

const ACCOUNT_STATUSES = ["active", "restricted", "suspended", "deleted"] as const;
type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  email_unverified: "E-mail non vérifié",
  phone_unverified: "Téléphone non vérifié",
  restricted: "Restreint",
  suspended: "Suspendu",
  deleted: "Supprimé",
};

const ROLE_LABELS: Record<string, string> = {
  client: "Passager",
  driver: "Chauffeur",
  admin: "Admin",
  superadmin: "Super admin",
};

function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (data ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      }));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AccountStatus }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut du compte mis à jour");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const filtered = (users ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [u.full_name, u.email, u.phone].some((v) => (v ?? "").toLowerCase().includes(q));
  });

  return (
    <div>
      <PageHeader title="Utilisateurs" description="Passagers, chauffeurs et administrateurs de la plateforme." />

      <Input
        placeholder="Rechercher un nom, un e-mail, un téléphone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun utilisateur" />
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{u.full_name || "Sans nom"}</p>
                <p className="text-sm text-muted-foreground">
                  {u.email ?? "—"} · {u.phone ?? "—"} · inscrit le {formatDate(u.created_at)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {u.roles.length ? u.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") : "Aucun rôle"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={u.status} labels={STATUS_LABELS} />
                {ACCOUNT_STATUSES.filter((s) => s !== u.status).map((s) => (
                  <Button key={s} size="sm" variant={s === "active" ? "outline" : "ghost"} onClick={() => setStatus.mutate({ id: u.id, status: s })}>
                    {STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
