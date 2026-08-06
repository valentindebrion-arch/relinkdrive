import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/espace/parametres")({
  component: ClientSettings,
});

function ClientSettings() {
  const { user, profile, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "" });

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  async function save() {
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil mis à jour");
    await refresh();
  }

  return (
    <>
      <PageHeader title="Paramètres" description="Vos informations personnelles." />
      <div className="surface grid max-w-xl gap-4 p-5">
        <div>
          <Label htmlFor="fn">Nom complet</Label>
          <Input id="fn" value={form.full_name} maxLength={80} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ph">Téléphone</Label>
          <Input id="ph" value={form.phone} maxLength={20} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={profile?.email ?? ""} disabled />
        </div>
        <div>
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </>
  );
}
