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

const AVAILABILITY_OPTIONS = [
  ["advance", "Sur réservation à l'avance"],
  ["day", "Service de jour"],
  ["night", "Service de nuit"],
  ["weekend", "Disponible le week-end"],
] as const;

const toList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function ProSettings() {
  const { user, profile, refresh } = useAuth();
  const driver = useDriverProfile();
  const qc = useQueryClient();

  const [account, setAccount] = useState({ full_name: "", phone: "" });
  const [pro, setPro] = useState({
    business_name: "",
    bio: "",
    public_intro: "",
    city: "",
    zone: "",
    service_areas: "",
    stations: "",
    airports: "",
    booking_notice: "",
    professional_address: "",
    vtc_card_number: "",
    languages: "",
    services: "",
    long_distance: false,
    accepting_requests: true,
    on_duty: true,
    page_published: true,
  });
  const [availability, setAvailability] = useState<string[]>([]);

  useEffect(() => {
    if (profile) setAccount({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  useEffect(() => {
    const d = driver.data;
    if (!d) return;
    setPro({
      business_name: d.business_name ?? "",
      bio: d.bio ?? "",
      public_intro: d.public_intro ?? "",
      city: d.city ?? "",
      zone: d.zone ?? "",
      service_areas: (d.service_areas ?? []).join(", "),
      stations: (d.stations ?? []).join(", "),
      airports: (d.airports ?? []).join(", "),
      booking_notice: d.booking_notice ?? "",
      professional_address: d.professional_address ?? "",
      vtc_card_number: d.vtc_card_number ?? "",
      languages: d.languages.join(", "),
      services: d.services.join(", "),
      long_distance: d.long_distance ?? false,
      accepting_requests: d.accepting_requests ?? true,
      on_duty: d.on_duty,
      page_published: d.page_published,
    });
    setAvailability(d.availability ?? []);
  }, [driver.data]);

  async function save() {
    const { error: e1 } = await supabase.from("profiles").update(account).eq("id", user!.id);
    const { error: e2 } = await supabase
      .from("driver_profiles")
      .update({
        business_name: pro.business_name || null,
        bio: pro.bio || null,
        public_intro: pro.public_intro || null,
        city: pro.city || null,
        zone: pro.zone || null,
        service_areas: toList(pro.service_areas),
        stations: toList(pro.stations),
        airports: toList(pro.airports),
        booking_notice: pro.booking_notice || null,
        professional_address: pro.professional_address || null,
        vtc_card_number: pro.vtc_card_number || null,
        languages: toList(pro.languages),
        services: toList(pro.services),
        long_distance: pro.long_distance,
        availability,
        accepting_requests: pro.accepting_requests,
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
      <PageHeader title="Paramètres" description="Votre profil chauffeur et votre page publique." />
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
          <Label htmlFor="city">Ville principale</Label>
          <Input id="city" value={pro.city} maxLength={60} onChange={(e) => setPro({ ...pro, city: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="zone">Agglomération / zone</Label>
          <Input id="zone" value={pro.zone} maxLength={80} onChange={(e) => setPro({ ...pro, zone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="areas">Départements / zones couverts (virgules)</Label>
          <Input id="areas" value={pro.service_areas} maxLength={200} onChange={(e) => setPro({ ...pro, service_areas: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="stations">Gares desservies (virgules)</Label>
          <Input id="stations" value={pro.stations} maxLength={200} onChange={(e) => setPro({ ...pro, stations: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="airports">Aéroports desservis (virgules)</Label>
          <Input id="airports" value={pro.airports} maxLength={200} onChange={(e) => setPro({ ...pro, airports: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="notice">Délai de réservation conseillé</Label>
          <Input id="notice" value={pro.booking_notice} maxLength={160} onChange={(e) => setPro({ ...pro, booking_notice: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="addr">Adresse professionnelle (jamais publique)</Label>
          <Input id="addr" value={pro.professional_address} maxLength={160} onChange={(e) => setPro({ ...pro, professional_address: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="lang">Langues parlées (virgules)</Label>
          <Input id="lang" value={pro.languages} maxLength={120} onChange={(e) => setPro({ ...pro, languages: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="serv">Services (virgules)</Label>
          <Input id="serv" value={pro.services} maxLength={200} onChange={(e) => setPro({ ...pro, services: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="intro">Message d'accueil de votre page publique</Label>
          <Textarea
            id="intro"
            rows={4}
            value={pro.public_intro}
            maxLength={800}
            placeholder="Bonjour, je suis… Merci d'avoir voyagé avec moi…"
            onChange={(e) => setPro({ ...pro, public_intro: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="bio">Présentation courte (interne)</Label>
          <Textarea id="bio" value={pro.bio} maxLength={600} onChange={(e) => setPro({ ...pro, bio: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          {AVAILABILITY_OPTIONS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <Switch
                id={key}
                checked={availability.includes(key)}
                onCheckedChange={(v) =>
                  setAvailability((prev) => (v ? [...prev, key] : prev.filter((x) => x !== key)))
                }
              />
              <Label htmlFor={key}>{label}</Label>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Switch id="ld" checked={pro.long_distance} onCheckedChange={(v) => setPro({ ...pro, long_distance: v })} />
            <Label htmlFor="ld">Longue distance</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="acc" checked={pro.accepting_requests} onCheckedChange={(v) => setPro({ ...pro, accepting_requests: v })} />
            <Label htmlFor="acc">J'accepte de nouvelles demandes</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="duty" checked={pro.on_duty} onCheckedChange={(v) => setPro({ ...pro, on_duty: v })} />
            <Label htmlFor="duty">En service</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="pub" checked={pro.page_published} onCheckedChange={(v) => setPro({ ...pro, page_published: v })} />
            <Label htmlFor="pub">Page publique visible</Label>
          </div>
        </div>
        <div className="sm:col-span-2">
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </>
  );
}
