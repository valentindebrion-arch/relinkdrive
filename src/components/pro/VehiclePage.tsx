import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyVehicle } from "@/lib/driver-queries";
import { useSignedUrl } from "@/lib/storage";
import { PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";


const OPTIONS = [
  ["air_conditioning", "Climatisation"],
  ["chargers", "Chargeurs"],
  ["water", "Bouteilles d'eau"],
  ["card_payment", "Paiement par carte"],
  ["quiet_ride", "Trajet silencieux sur demande"],
  ["luggage_help", "Aide aux bagages"],
  ["pets_allowed", "Animaux acceptés"],
] as const;

export function VehiclePage() {
  const { user } = useAuth();
  const vehicle = useMyVehicle();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    brand: "",
    model: "",
    color: "",
    plate: "",
    year: "",
    max_passengers: "4",
    luggage_capacity: "2",
    mileage: "",
    insurance_provider: "",
    insurance_expires_at: "",
    inspection_expires_at: "",
    next_service_date: "",
    photo_url: "",
    photo_interior_url: "",
    category: "",
  });
  const [flags, setFlags] = useState({
    air_conditioning: true,
    chargers: false,
    water: false,
    card_payment: true,
    quiet_ride: true,
    luggage_help: true,
    pets_allowed: false,
  });

  useEffect(() => {
    const v = vehicle.data;
    if (!v) return;
    setForm({
      brand: v.brand ?? "",
      model: v.model ?? "",
      color: v.color ?? "",
      plate: v.plate ?? "",
      year: v.year ? String(v.year) : "",
      max_passengers: String(v.max_passengers),
      luggage_capacity: String(v.luggage_capacity),
      mileage: v.mileage ? String(v.mileage) : "",
      insurance_provider: v.insurance_provider ?? "",
      insurance_expires_at: v.insurance_expires_at ?? "",
      inspection_expires_at: v.inspection_expires_at ?? "",
      next_service_date: v.next_service_date ?? "",
      photo_url: v.photo_url ?? "",
      photo_interior_url: v.photo_interior_url ?? "",
      category: v.category ?? "",
    });
    setFlags({
      air_conditioning: v.air_conditioning,
      chargers: v.chargers,
      water: v.water,
      card_payment: v.card_payment,
      quiet_ride: v.quiet_ride,
      luggage_help: v.luggage_help,
      pets_allowed: v.pets_allowed,
    });
  }, [vehicle.data]);

  async function upload(file: File, field: "photo_url" | "photo_interior_url" = "photo_url") {
    setUploading(true);
    const path = `${user!.id}/vehicle-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("vehicles").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm((f) => ({ ...f, [field]: path }));
    toast.success("Photo ajoutée");
  }

  async function save() {
    const payload = {
      driver_id: user!.id,
      brand: form.brand || null,
      model: form.model || null,
      color: form.color || null,
      plate: form.plate || null,
      year: form.year ? Number(form.year) : null,
      max_passengers: Number(form.max_passengers) || 4,
      luggage_capacity: Number(form.luggage_capacity) || 2,
      mileage: form.mileage ? Number(form.mileage) : null,
      insurance_provider: form.insurance_provider || null,
      insurance_expires_at: form.insurance_expires_at || null,
      inspection_expires_at: form.inspection_expires_at || null,
      next_service_date: form.next_service_date || null,
      photo_url: form.photo_url || null,
      photo_interior_url: form.photo_interior_url || null,
      category: form.category || null,
      ...flags,
    };
    const { error } = vehicle.data
      ? await supabase.from("vehicles").update(payload).eq("id", vehicle.data.id)
      : await supabase.from("vehicles").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Véhicule enregistré");
    void qc.invalidateQueries({ queryKey: ["my-vehicle"] });
  }

  const photo = useSignedUrl("vehicles", form.photo_url);
  const interior = useSignedUrl("vehicles", form.photo_interior_url);

  const text = (key: keyof typeof form, label: string, type = "text") => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <>
      <PageHeader title="Mon véhicule" description="Ces informations sont affichées sur votre page publique." />
      <div className="surface grid gap-4 p-5 sm:grid-cols-2">
        {text("brand", "Marque")}
        {text("model", "Modèle")}
        {text("color", "Couleur")}
        {text("plate", "Immatriculation")}
        {text("year", "Année", "number")}
        {text("category", "Catégorie (berline, van…)")}
        {text("max_passengers", "Passagers max", "number")}
        {text("luggage_capacity", "Bagages", "number")}
        {text("mileage", "Kilométrage", "number")}
        {text("insurance_provider", "Assureur")}
        {text("insurance_expires_at", "Échéance assurance", "date")}
        {text("inspection_expires_at", "Échéance contrôle technique", "date")}
        {text("next_service_date", "Prochain entretien", "date")}

        <div className="sm:col-span-2">
          <Label htmlFor="photo">Photo du véhicule</Label>
          <Input
            id="photo"
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          {photo.data ? (
            <img src={photo.data} alt="Véhicule" className="mt-3 h-40 rounded-lg object-cover" />
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="photo-in">Photo intérieure (facultatif)</Label>
          <Input
            id="photo-in"
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file, "photo_interior_url");
            }}
          />
          {interior.data ? (
            <img src={interior.data} alt="Intérieur du véhicule" className="mt-3 h-40 rounded-lg object-cover" />
          ) : null}
        </div>

        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
          {OPTIONS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <Switch id={key} checked={flags[key]} onCheckedChange={(v) => setFlags({ ...flags, [key]: v })} />
              <Label htmlFor={key}>{label}</Label>
            </div>
          ))}
        </div>

        <div className="sm:col-span-2">
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </>
  );
}
