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

type PhotoField = "photo_url" | "photo_interior_url";

export function VehiclePage() {
  const { user } = useAuth();
  const vehicle = useMyVehicle();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<PhotoField | null>(null);

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

  const MAX_BYTES = 8 * 1024 * 1024;
  const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  /** Garantit l'existence d'une ligne véhicule avant d'y rattacher une photo. */
  async function ensureVehicleId(): Promise<string | null> {
    if (vehicle.data?.id) return vehicle.data.id;
    const { data, error } = await supabase
      .from("vehicles")
      .insert({ driver_id: user!.id })
      .select("id")
      .single();
    if (error) {
      toast.error("La photo n'a pas pu être enregistrée. Votre ancienne photo a été conservée.");
      return null;
    }
    return data.id;
  }

  /** Envoi puis enregistrement immédiat du chemin permanent (jamais une URL temporaire). */
  async function upload(file: File, field: PhotoField) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non pris en charge (JPEG, PNG, WebP ou HEIC).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photo trop lourde (8 Mo maximum).");
      return;
    }
    setBusy(field);
    const previous = form[field];
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const kind = field === "photo_url" ? "exterior" : "interior";
    const vehicleId = await ensureVehicleId();
    if (!vehicleId) {
      setBusy(null);
      return;
    }
    const path = `${user!.id}/vehicles/${vehicleId}/${kind}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("vehicles").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      setBusy(null);
      toast.error("La photo n'a pas pu être enregistrée. Votre ancienne photo a été conservée.");
      return;
    }
    const { error: dbError } = await supabase
      .from("vehicles")
      .update({ [field]: path })
      .eq("id", vehicleId);
    setBusy(null);
    if (dbError) {
      await supabase.storage.from("vehicles").remove([path]);
      toast.error("La photo n'a pas pu être enregistrée. Votre ancienne photo a été conservée.");
      return;
    }
    setForm((f) => ({ ...f, [field]: path }));
    void qc.invalidateQueries({ queryKey: ["my-vehicle"] });
    // L'ancien fichier n'est supprimé qu'une fois la nouvelle référence confirmée.
    if (previous && previous !== path) await supabase.storage.from("vehicles").remove([previous]);
    toast.success("Les photos de votre véhicule ont bien été enregistrées.");
  }

  /** Suppression volontaire d'une seule photo, sans toucher à l'autre. */
  async function removePhoto(field: PhotoField) {
    const current = form[field];
    if (!current || !vehicle.data?.id) return;
    if (!window.confirm("Supprimer définitivement cette photo ?")) return;
    setBusy(field);
    const { error } = await supabase
      .from("vehicles")
      .update({ [field]: null })
      .eq("id", vehicle.data.id);
    setBusy(null);
    if (error) {
      toast.error("La suppression a échoué. Votre photo a été conservée.");
      return;
    }
    setForm((f) => ({ ...f, [field]: "" }));
    void qc.invalidateQueries({ queryKey: ["my-vehicle"] });
    await supabase.storage.from("vehicles").remove([current]);
    toast.success("Photo supprimée.");
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

        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <PhotoSlot
            id="photo"
            label="Photo extérieure du véhicule"
            url={photo.data ?? null}
            loading={busy === "photo_url" || photo.isLoading}
            hasPath={!!form.photo_url}
            onSelect={(file) => void upload(file, "photo_url")}
            onRemove={() => void removePhoto("photo_url")}
          />
          <PhotoSlot
            id="photo-in"
            label="Photo intérieure du véhicule"
            url={interior.data ?? null}
            loading={busy === "photo_interior_url" || interior.isLoading}
            hasPath={!!form.photo_interior_url}
            onSelect={(file) => void upload(file, "photo_interior_url")}
            onRemove={() => void removePhoto("photo_interior_url")}
          />
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

/** Emplacement photo autonome : aperçu, ajout/modification, suppression, chargement. */
function PhotoSlot({
  id,
  label,
  url,
  loading,
  hasPath,
  onSelect,
  onRemove,
}: {
  id: string;
  label: string;
  url: string | null;
  loading: boolean;
  hasPath: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 p-3">
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-2 aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {loading ? (
          <div className="size-full animate-pulse bg-muted" />
        ) : url ? (
          <img src={url} alt={label} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-muted-foreground">
            Aucune photo
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          disabled={loading}
          className="flex-1"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
            e.target.value = "";
          }}
        />
        {hasPath ? (
          <Button type="button" variant="outline" disabled={loading} onClick={onRemove}>
            Supprimer
          </Button>
        ) : null}
      </div>
    </div>
  );
}
