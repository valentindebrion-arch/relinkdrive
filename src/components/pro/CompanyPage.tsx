import { useQuery, useQueryClient } from "@tanstack/react-query";
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


export function CompanyPage() {
  const { user } = useAuth();
  const driver = useDriverProfile();
  const qc = useQueryClient();

  const company = useQuery({
    queryKey: ["company", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("driver_id", user!.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    legal_name: "",
    legal_form: "",
    siret: "",
    vat_number: "",
    address: "",
    postal_code: "",
    city: "",
  });
  const [billing, setBilling] = useState({ vat_applicable: false, billing_legal_info: "" });

  useEffect(() => {
    if (company.data) {
      setForm({
        legal_name: company.data.legal_name ?? "",
        legal_form: company.data.legal_form ?? "",
        siret: company.data.siret ?? "",
        vat_number: company.data.vat_number ?? "",
        address: company.data.address ?? "",
        postal_code: company.data.postal_code ?? "",
        city: company.data.city ?? "",
      });
    }
  }, [company.data]);

  useEffect(() => {
    if (driver.data) {
      setBilling({
        vat_applicable: driver.data.vat_applicable,
        billing_legal_info: driver.data.billing_legal_info ?? "",
      });
    }
  }, [driver.data]);

  async function save() {
    const { error } = company.data
      ? await supabase.from("companies").update(form).eq("id", company.data.id)
      : await supabase.from("companies").insert({ driver_id: user!.id, ...form });
    const { error: e2 } = await supabase
      .from("driver_profiles")
      .update({ ...billing, siret: form.siret || null })
      .eq("user_id", user!.id);
    if (error || e2) {
      toast.error((error ?? e2)!.message);
      return;
    }
    toast.success("Informations enregistrées");
    void qc.invalidateQueries({ queryKey: ["company"] });
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
  }

  const field = (key: keyof typeof form, label: string) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} value={form[key]} maxLength={120} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <>
      <PageHeader title="Mon entreprise" description="Informations légales utilisées sur vos factures." />
      <div className="surface grid gap-4 p-5 sm:grid-cols-2">
        {field("legal_name", "Raison sociale")}
        {field("legal_form", "Forme juridique")}
        {field("siret", "SIRET")}
        {field("vat_number", "Numéro de TVA")}
        {field("address", "Adresse")}
        {field("postal_code", "Code postal")}
        {field("city", "Ville")}
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="vat"
            checked={billing.vat_applicable}
            onCheckedChange={(v) => setBilling({ ...billing, vat_applicable: v })}
          />
          <Label htmlFor="vat">Assujetti à la TVA</Label>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="mentions">Mentions légales de facturation</Label>
          <Textarea
            id="mentions"
            value={billing.billing_legal_info}
            maxLength={400}
            placeholder="TVA non applicable, art. 293 B du CGI"
            onChange={(e) => setBilling({ ...billing, billing_legal_info: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </>
  );
}
