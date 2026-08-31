/** Fiche client administrative : consultation, correction et support. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/labels";
import { logAdminChange } from "@/lib/support-queries";
import {
  AdminGenderCard,
  AdminHistoryCard,
  AdminTicketsCard,
} from "@/components/admin/AdminSupportCards";
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

export const Route = createFileRoute("/_authenticated/admin/utilisateurs/$clientId")({
  head: () => ({
    meta: [
      { title: "Profil client — Administration ReLink" },
      {
        name: "description",
        content:
          "Fiche client ReLink : informations du compte, chauffeurs enregistrés, demandes SAV et historique administratif.",
      },
      { property: "og:title", content: "Profil client — Administration ReLink" },
      { property: "og:description", content: "Gestion et support d'un compte client ReLink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientProfilePage,
});

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  email_unverified: "E-mail non vérifié",
  phone_unverified: "Téléphone non vérifié",
  restricted: "Restreint",
  suspended: "Suspendu",
  deleted: "Supprimé",
};

function IdentityCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [emailConfirm, setEmailConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<
    "restricted" | "suspended" | "deleted" | null
  >(null);
  const [busy, setBusy] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["admin", "client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, status, created_at, gender, gender_correction_used")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  function startEdit() {
    setForm({
      full_name: profile?.full_name ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
    });
    setEditing(true);
  }

  async function persist() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        })
        .eq("id", clientId);
      if (error) throw error;
      await logAdminChange({
        targetUserId: clientId,
        action: "admin.profile_update",
        field: "profiles",
        oldValue: {
          full_name: profile?.full_name,
          email: profile?.email,
          phone: profile?.phone,
        },
        newValue: form,
      });
      await qc.invalidateQueries();
      toast.success("Informations mises à jour");
      setEditing(false);
      setEmailConfirm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "active" | "restricted" | "suspended" | "deleted") {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", clientId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAdminChange({
      targetUserId: clientId,
      action: "admin.status_update",
      field: "status",
      oldValue: profile?.status ?? null,
      newValue: status,
    });
    await qc.invalidateQueries();
    toast.success("Statut du compte mis à jour");
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!profile) return <EmptyState title="Compte introuvable" />;

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Client
        </span>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">
          {STATUS_LABELS[profile.status] ?? profile.status}
        </span>
      </div>
      <PageHeader
        title={profile.full_name || "Profil client"}
        description={`Inscrit le ${formatDate(profile.created_at)}`}
        action={
          editing ? null : (
            <Button size="sm" variant="outline" className="min-h-10" onClick={startEdit}>
              <Pencil className="size-3.5" /> Modifier le profil
            </Button>
          )
        }
      />

      <section className="surface mb-4 p-5">
        <h2 className="text-base font-semibold">Informations personnelles</h2>
        {editing ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Prénom et nom
              <Input
                className="mt-1"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </label>
            <label className="text-sm">
              E-mail
              <Input
                className="mt-1"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Téléphone
              <Input
                className="mt-1"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <div className="flex items-end gap-2">
              <Button
                className="min-h-10"
                disabled={busy}
                onClick={() => {
                  if (form.email.trim() !== (profile.email ?? "")) setEmailConfirm(true);
                  else void persist();
                }}
              >
                Enregistrer les modifications
              </Button>
              <Button variant="ghost" className="min-h-10" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Nom</dt>
              <dd>{profile.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd>{profile.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Téléphone</dt>
              <dd>{profile.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sexe</dt>
              <dd>
                {profile.gender === "female"
                  ? "Femme"
                  : profile.gender === "male"
                    ? "Homme"
                    : "Non renseigné"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Correction autonome utilisée</dt>
              <dd>{profile.gender_correction_used ? "Oui" : "Non"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Date d'inscription</dt>
              <dd>{formatDate(profile.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Statut du compte</dt>
              <dd>{STATUS_LABELS[profile.status] ?? profile.status}</dd>
            </div>
          </dl>
        )}

      </section>

      <section className="surface mb-4 p-5">
        <h2 className="text-base font-semibold">Gestion du compte</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Statut actuel : {STATUS_LABELS[profile.status] ?? profile.status}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["active", "restricted", "suspended", "deleted"] as const)
            .filter((s) => s !== profile.status)
            .map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "active" ? "outline" : "ghost"}
                onClick={() => {
                  if (s === "suspended" || s === "deleted") setPendingStatus(s);
                  else void setStatus(s);
                }}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
        </div>
      </section>

      <AlertDialog open={pendingStatus !== null} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "deleted" ? "Supprimer ce compte ?" : "Suspendre ce compte ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              L'utilisateur perdra l'accès à ReLink. Cette action est enregistrée dans l'historique
              administratif et reste réversible depuis cette fiche.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const next = pendingStatus;
                setPendingStatus(null);
                if (next) void setStatus(next);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emailConfirm} onOpenChange={setEmailConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifier l'adresse e-mail ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'adresse enregistrée dans ReLink va changer. Le mot de passe n'est jamais visible ni
              modifiable : en cas de problème de connexion, utilisez la réinitialisation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void persist();
              }}
            >
              Confirmer la modification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConnectionsCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [removing, setRemoving] = useState<string | null>(null);

  const { data: rows } = useQuery({
    queryKey: ["admin", "client-connections", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_client_connections")
        .select("id, driver_id, created_at")
        .eq("client_id", clientId);
      const ids = (data ?? []).map((r) => r.driver_id);
      if (ids.length === 0)
        return [] as {
          id: string;
          driver_id: string;
          name: string;
          vehicle: string | null;
          created_at: string;
        }[];
      const [{ data: profiles }, { data: vehicles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids),
        supabase.from("vehicles").select("driver_id, brand, model, is_primary").in("driver_id", ids),
      ]);
      return (data ?? []).map((r) => {
        const v =
          vehicles?.find((x) => x.driver_id === r.driver_id && x.is_primary) ??
          vehicles?.find((x) => x.driver_id === r.driver_id);
        const vehicle = [v?.brand, v?.model].filter(Boolean).join(" ") || null;
        return {
          id: r.id,
          driver_id: r.driver_id,
          name: profiles?.find((p) => p.id === r.driver_id)?.full_name ?? "Chauffeur",
          vehicle,
          created_at: r.created_at,
        };
      });
    },
  });

  async function remove(connectionId: string, driverId: string) {
    const { error } = await supabase
      .from("driver_client_connections")
      .delete()
      .eq("id", connectionId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAdminChange({
      targetUserId: clientId,
      action: "admin.connection_delete",
      field: "driver_client_connections",
      oldValue: { driver_id: driverId },
      newValue: null,
      reason: "Suppression SAV d'une relation",
    });
    await qc.invalidateQueries({ queryKey: ["admin", "client-connections", clientId] });
    setRemoving(null);
    toast.success("Relation supprimée");
  }

  const list = rows ?? [];

  return (
    <section className="surface mb-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Users className="size-4 text-primary" /> Chauffeurs dans son réseau
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Information de support. Ne supprimez une relation que sur demande explicite.
      </p>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Aucun chauffeur ajouté pour le moment.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.vehicle ?? "Véhicule non renseigné"} · ajouté le {formatDate(c.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/chauffeurs/$driverId" params={{ driverId: c.driver_id }}>
                    Voir le chauffeur
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(c.id)}>
                  Retirer
                </Button>
              </div>
              <AlertDialog
                open={removing === c.id}
                onOpenChange={(o) => !o && setRemoving(null)}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette relation ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Le client ne retrouvera plus {c.name} dans « Mes chauffeurs ». Cette action
                      est enregistrée dans l'historique administratif.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void remove(c.id, c.driver_id);
                      }}
                    >
                      Confirmer la suppression
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ClientProfilePage() {
  const { clientId } = Route.useParams();
  return (
    <div>
      <Link
        to="/admin/utilisateurs"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <IdentityCard clientId={clientId} />
      <AdminGenderCard userId={clientId} />
      <ConnectionsCard clientId={clientId} />
      <AdminTicketsCard userId={clientId} />
      <AdminHistoryCard userId={clientId} />
    </div>
  );
}
