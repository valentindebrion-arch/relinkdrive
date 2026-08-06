import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/pro/parametres")({
  component: ProSettings,
});

function ProSettings() {
  const { user, profile, refresh } = useAuth();
  const driver = useDriverProfile();
  const qc = useQueryClient();

  const [account, setAccount] = useState({ full_name: "", phone: "" });
  const [pro, setPro] = useState({
    business_name: "",
    bio: "",
    city: "",
    zone: "",
    professional_address: "",
    vtc_card_number: "",
    languages: "",
    services: "",
    on_duty: true,
    page_published: true,
  });

  useEffect(() => {
    if (profile) setAccount({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  useEffect(() => {
    const d = driver.data;
    if (!d) return;
    setPro({
      business_name: d.business_name ?? "",
      bio: d.bio ?? "",
      city: d.city ?? "",
      zone: d.zone ?? "",
      professional_address: d.professional_address ?? "",
      vtc_card_number: d.vtc_card_number ?? "",
      languages: d.languages.join(", "),
      services: d.services.join(", "),
      on_duty: d.on_duty,
      page_published: d.page_published,
    });
  }, [driver.data]);

  async function save() {
    const { error: e1 } = await supabase.from("profiles").update(account).eq("id", user!.id);
    const { error: e2 } = await supabase
      .from("driver_profiles")
      .update({
        business_name: pro.business_name || null,
        bio: pro.bio || null,
        city: pro.city || null,
        zone: pro.zone || null,
        professional_address: pro.professional_address || null,
        vtc_card_number: pro.vtc_card_number || null,
        languages: pro.languages.split(",").map((s) => s.trim()).filter(Boolean),
        services: pro.services.split(",").map((s) => s.trim()).filter(Boolean),
        on_duty: pro.on_duty,
        page_published: pro.page_published,
      })
      .eq("user_id", user!.id);
    if (e1 || e2) {
      toast.error((e1 ?? e2)!.message);
      return;
    }
    toast.success("Profil mis à jour");
    await refresh();
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
  }

  return (
    <>
      <PageHeader title="Paramètres" description="Votre profil chauffeur et vos informations de contact." />
      <div className="surface grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="fn">Nom complet</Label>
          <Input id="fn" value={account.full_name} maxLength={80} onChange={(e) => setAccount({ ...account, full_name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ph">Téléphone</Label>
          <Input id="ph" value={account.phone} maxLength={20} onChange={(e) => setAccount({ ...account, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="bn">Nom commercial</Label>
          <Input id="bn" value={pro.business_name} maxLength={80} onChange={(e) => setPro({ ...pro, business_name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="vtc">Numéro de carte VTC</Label>
          <Input id="vtc" value={pro.vtc_card_number} maxLength={40} onChange={(e) => setPro({ ...pro, vtc_card_number: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="city">Ville</Label>
          <Input id="city" value={pro.city} maxLength={60} onChange={(e) => setPro({ ...pro, city: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="zone">Zone d'intervention</Label>
          <Input id="zone" value={pro.zone} maxLength={80} onChange={(e) => setPro({ ...pro, zone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="addr">Adresse professionnelle</Label>
          <Input id="addr" value={pro.professional_address} maxLength={160} onChange={(e) => setPro({ ...pro, professional_address: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="lang">Langues parlées (séparées par des virgules)</Label>
          <Input id="lang" value={pro.languages} maxLength={120} onChange={(e) => setPro({ ...pro, languages: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="serv">Services (séparés par des virgules)</Label>
          <Input id="serv" value={pro.services} maxLength={160} onChange={(e) => setPro({ ...pro, services: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="bio">Présentation</Label>
          <Textarea id="bio" value={pro.bio} maxLength={600} onChange={(e) => setPro({ ...pro, bio: e.target.value })} />
        </div>
        <div className="flex items-center gap-3">
          <Switch id="duty" checked={pro.on_duty} onCheckedChange={(v) => setPro({ ...pro, on_duty: v })} />
          <Label htmlFor="duty">Disponible pour de nouvelles demandes</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="pub" checked={pro.page_published} onCheckedChange={(v) => setPro({ ...pro, page_published: v })} />
          <Label htmlFor="pub">Page publique visible</Label>
        </div>
        <div className="sm:col-span-2">
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </>
  );
}
