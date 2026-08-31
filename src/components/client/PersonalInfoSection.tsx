import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Home, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAddress, saveMyAddress, updateMyProfile } from "@/lib/account.functions";
import { GenderField } from "@/components/GenderField";
import type { GenderValue } from "@/lib/woman-for-woman";


type Address = { id: string; label: string; address: string };

export function PersonalInfoSection({ openSignal }: { openSignal?: number }) {
  const { user, profile, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ full_name: string; phone: string; gender: GenderValue | "" }>({
    full_name: "",
    phone: "",
    gender: "",
  });
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddress, setNewAddress] = useState({ label: "", address: "" });
  const [addingAddress, setAddingAddress] = useState(false);

  // Le genre est une déclaration unique : une fois enregistré, il est définitif.
  const genderLocked = !!profile?.gender;
  const [confirmGender, setConfirmGender] = useState(false);

  useEffect(() => {
    if (profile)
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        gender: (profile.gender as GenderValue | null) ?? "",
      });
  }, [profile]);

  useEffect(() => {
    if (openSignal) setEditing(true);
  }, [openSignal]);

  async function loadAddresses() {
    if (!user?.id) return;
    const { data } = await supabase
      .from("client_addresses")
      .select("id, label, address")
      .eq("client_id", user.id)
      .order("created_at", { ascending: true });
    setAddresses((data ?? []) as Address[]);
  }

  useEffect(() => {
    void loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function save() {
    setBusy(true);
    try {
      await updateMyProfile({
        data: { full_name: form.full_name, phone: form.phone, gender: form.gender || null },
      });
      toast.success("Informations mises à jour");
      setConfirmGender(false);
      setEditing(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  async function addAddress() {
    setBusy(true);
    try {
      await saveMyAddress({ data: newAddress });
      setNewAddress({ label: "", address: "" });
      setAddingAddress(false);
      await loadAddresses();
      toast.success("Adresse enregistrée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adresse invalide");
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id: string) {
    try {
      await deleteMyAddress({ data: { id } });
      await loadAddresses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
    }
  }

  return (
    <section className="surface p-5">
      <h2 className="text-base font-semibold">Informations personnelles</h2>

      {editing ? (
        <div className="mt-3 grid gap-3">
          <div>
            <Label htmlFor="pi-name">Prénom et nom</Label>
            <Input
              id="pi-name"
              value={form.full_name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pi-phone">Téléphone</Label>
            <Input
              id="pi-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              maxLength={20}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pi-email">E-mail</Label>
            <Input id="pi-email" value={profile?.email ?? ""} disabled />
            <p className="mt-1 text-xs text-muted-foreground">
              L'adresse e-mail est liée à votre connexion et ne peut pas être modifiée ici.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={busy} className="min-h-11">
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <dl className="mt-3 divide-y divide-border text-sm">
          <Row label="Prénom et nom" value={profile?.full_name || "—"} />
          <Row label="E-mail" value={profile?.email || "—"} />
          <Row label="Téléphone" value={profile?.phone || "Non renseigné"} />
        </dl>
      )}

      {/* Sexe : toujours visible, 1 choix initial + 1 correction autonome. */}
      <div className="mt-3">
        <GenderField
          gender={profile?.gender ?? null}
          correctionUsed={!!profile?.gender_correction_used}
          onSaved={refresh}
        />
      </div>


      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Mes adresses</p>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-10"
            onClick={() => setAddingAddress((v) => !v)}
          >
            <Plus className="size-4" /> Ajouter
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Vos adresses fréquentes pour remplir vos demandes de course plus vite.
        </p>

        {addingAddress ? (
          <div className="mt-3 grid gap-2">
            <Input
              placeholder="Libellé (Domicile, Bureau…)"
              value={newAddress.label}
              maxLength={40}
              onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
            />
            <Input
              placeholder="Adresse complète"
              value={newAddress.address}
              maxLength={200}
              onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
            />
            <Button className="min-h-11" onClick={() => void addAddress()} disabled={busy}>
              Enregistrer l'adresse
            </Button>
          </div>
        ) : null}

        <ul className="mt-3 space-y-2">
          {addresses.length === 0 ? (
            <li className="text-xs text-muted-foreground">Aucune adresse enregistrée.</li>
          ) : (
            addresses.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Home className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.address}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Supprimer ${a.label}`}
                  className="min-h-10 px-2 text-muted-foreground"
                  onClick={() => void removeAddress(a.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {!editing ? (
        <Button variant="outline" className="mt-4 min-h-11 w-full" onClick={() => setEditing(true)}>
          Modifier mes informations
        </Button>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
