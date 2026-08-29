import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Facebook, Globe, Instagram, Linkedin, MessageCircle, Music2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/pro/liens")({
  component: ProLinksPage,
});

type LinkField = {
  key: "website_url" | "instagram_url" | "facebook_url" | "tiktok_url" | "linkedin_url";
  label: string;
  placeholder: string;
  icon: typeof Globe;
};

const LINK_FIELDS: LinkField[] = [
  { key: "website_url", label: "Site internet", placeholder: "https://…", icon: Globe },
  {
    key: "instagram_url",
    label: "Instagram",
    placeholder: "https://instagram.com/…",
    icon: Instagram,
  },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/…", icon: Facebook },
  { key: "tiktok_url", label: "TikTok", placeholder: "https://tiktok.com/@…", icon: Music2 },
  {
    key: "linkedin_url",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/…",
    icon: Linkedin,
  },
];

function ProLinksPage() {
  const { user } = useAuth();
  const driver = useDriverProfile();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    public_phone: "",
    show_public_phone: false,
    whatsapp_number: "",
    show_whatsapp: false,
    website_url: "",
    instagram_url: "",
    facebook_url: "",
    tiktok_url: "",
    linkedin_url: "",
  });

  useEffect(() => {
    const d = driver.data as Record<string, unknown> | null | undefined;
    if (!d) return;
    setForm({
      public_phone: (d["public_phone"] as string) ?? "",
      show_public_phone: (d["show_public_phone"] as boolean) ?? false,
      whatsapp_number: (d["whatsapp_number"] as string) ?? "",
      show_whatsapp: (d["show_whatsapp"] as boolean) ?? false,
      website_url: (d["website_url"] as string) ?? "",
      instagram_url: (d["instagram_url"] as string) ?? "",
      facebook_url: (d["facebook_url"] as string) ?? "",
      tiktok_url: (d["tiktok_url"] as string) ?? "",
      linkedin_url: (d["linkedin_url"] as string) ?? "",
    });
  }, [driver.data]);

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("driver_profiles")
      .update({
        public_phone: form.public_phone || null,
        show_public_phone: form.show_public_phone && !!form.public_phone,
        whatsapp_number: form.whatsapp_number || null,
        show_whatsapp: form.show_whatsapp && !!form.whatsapp_number,
        website_url: form.website_url || null,
        instagram_url: form.instagram_url || null,
        facebook_url: form.facebook_url || null,
        tiktok_url: form.tiktok_url || null,
        linkedin_url: form.linkedin_url || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Moyens de contact mis à jour");
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
  }

  return (
    <>
      <PageHeader
        title="Mes liens"
        description={`Les moyens par lesquels vos clients vous joignent depuis votre vitrine ${BRAND.name}.`}
      />

      <div className="surface grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="phone">
            <Phone className="mr-1 inline size-3.5" /> Téléphone professionnel
          </Label>
          <Input
            id="phone"
            value={form.public_phone}
            maxLength={20}
            placeholder="06 12 34 56 78"
            onChange={(e) => setForm({ ...form, public_phone: e.target.value })}
          />
          <label className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span className="text-sm">Afficher sur ma vitrine (appel et SMS)</span>
            <Switch
              checked={form.show_public_phone}
              onCheckedChange={(v) => setForm({ ...form, show_public_phone: v })}
            />
          </label>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="wa">
            <MessageCircle className="mr-1 inline size-3.5" /> WhatsApp professionnel
          </Label>
          <Input
            id="wa"
            value={form.whatsapp_number}
            maxLength={20}
            placeholder="+33 6 12 34 56 78"
            onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
          />
          <label className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span className="text-sm">Afficher sur ma vitrine</span>
            <Switch
              checked={form.show_whatsapp}
              onCheckedChange={(v) => setForm({ ...form, show_whatsapp: v })}
            />
          </label>
        </div>

        {LINK_FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>
              <f.icon className="mr-1 inline size-3.5" /> {f.label}
            </Label>
            <Input
              id={f.key}
              value={form[f.key]}
              maxLength={200}
              placeholder={f.placeholder}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Button onClick={() => void save()} disabled={saving}>
          Enregistrer
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Ces coordonnées apparaissent dans le bloc « Contacter le chauffeur » de votre profil public.{" "}
        {BRAND.name} ne reçoit ni ne transmet aucune réservation : vos clients vous joignent
        directement.
      </p>
    </>
  );
}
