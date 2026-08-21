import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyVehicle } from "@/lib/driver-queries";
import { ensureVehicleRowId } from "@/lib/vehicle-row";
import { useSignedUrl } from "@/lib/storage";
import { PageHeader } from "@/components/Ui";
import { evaluateCompatibility, type VehicleCapacity } from "@/lib/compatibility";
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
  ["child_seat", "Siège enfant disponible"],
  ["booster_seat", "Rehausseur disponible"],
  ["stroller_space", "Espace pour poussette"],
  ["accessible", "Accessible en fauteuil roulant"],
  ["large_trunk", "Grand coffre (bagages volumineux)"],
] as const;

const PETS_POLICIES = [
  ["refused", "Non acceptés"],
  ["accepted", "Acceptés"],
  ["conditional", "Acceptés sous conditions"],
] as const;

type PhotoField =
  | "photo_url"
  | "photo_interior_url"
  | "photo_front_url"
  | "photo_side_url"
  | "photo_trunk_url"
  | "photo_child_seat_url"
  | "photo_access_url"
  | "photo_pet_url";

const PHOTO_KIND: Record<PhotoField, string> = {
  photo_url: "exterior",
  photo_interior_url: "interior",
  photo_front_url: "front",
  photo_side_url: "side",
  photo_trunk_url: "trunk",
  photo_child_seat_url: "child-seat",
  photo_access_url: "access",
  photo_pet_url: "pet",
};

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
    large_luggage_capacity: "",
    cabin_luggage_capacity: "",
    pets_policy: "refused",
    pets_max: "",
    pets_conditions: "",
    mileage: "",
    insurance_provider: "",
    insurance_expires_at: "",
    inspection_expires_at: "",
    next_service_date: "",
    photo_url: "",
    photo_interior_url: "",
    photo_front_url: "",
    photo_side_url: "",
    photo_trunk_url: "",
    photo_child_seat_url: "",
    photo_access_url: "",
    photo_pet_url: "",
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
    child_seat: false,
    booster_seat: false,
    stroller_space: false,
    accessible: false,
    large_trunk: false,
    pets_carrier_required: false,
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
      large_luggage_capacity:
        v.large_luggage_capacity === null || v.large_luggage_capacity === undefined
          ? ""
          : String(v.large_luggage_capacity),
      cabin_luggage_capacity:
        v.cabin_luggage_capacity === null || v.cabin_luggage_capacity === undefined
          ? ""
          : String(v.cabin_luggage_capacity),
      pets_policy: v.pets_policy ?? "refused",
      pets_max: v.pets_max === null || v.pets_max === undefined ? "" : String(v.pets_max),
      pets_conditions: v.pets_conditions ?? "",
      mileage: v.mileage ? String(v.mileage) : "",
      insurance_provider: v.insurance_provider ?? "",
      insurance_expires_at: v.insurance_expires_at ?? "",
      inspection_expires_at: v.inspection_expires_at ?? "",
      next_service_date: v.next_service_date ?? "",
      photo_url: v.photo_url ?? "",
      photo_interior_url: v.photo_interior_url ?? "",
      photo_front_url: v.photo_front_url ?? "",
      photo_side_url: v.photo_side_url ?? "",
      photo_trunk_url: v.photo_trunk_url ?? "",
      photo_child_seat_url: v.photo_child_seat_url ?? "",
      photo_access_url: v.photo_access_url ?? "",
      photo_pet_url: v.photo_pet_url ?? "",
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
      child_seat: v.child_seat,
      booster_seat: v.booster_seat ?? false,
      stroller_space: v.stroller_space ?? false,
      accessible: v.accessible,
      large_trunk: v.large_trunk ?? false,
      pets_carrier_required: v.pets_carrier_required ?? false,
    });
  }, [vehicle.data]);

  const MAX_BYTES = 8 * 1024 * 1024;
  const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  /** Garantit l'existence d'une ligne véhicule (jamais de doublon) avant toute écriture. */
  async function ensureVehicleId(): Promise<string | null> {
    try {
      return await ensureVehicleRowId(user!.id);
    } catch {
      return null;
    }
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
    const kind = PHOTO_KIND[field];
    const vehicleId = await ensureVehicleId();
    if (!vehicleId) {
      setBusy(null);
      toast.error("La photo n'a pas pu être enregistrée. Votre ancienne photo a été conservée.");
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
      .update({ [field]: path } as Record<PhotoField, string>)
      .eq("id", vehicleId);
    if (dbError) {
      setBusy(null);
      await supabase.storage.from("vehicles").remove([path]);
      toast.error("La photo n'a pas pu être enregistrée. Votre ancienne photo a été conservée.");
      return;
    }
    // Contrôle après upload : la référence est relue depuis le serveur et le
    // fichier doit exister réellement dans le stockage permanent.
    const { data: saved } = await supabase
      .from("vehicles")
      .select(
        "photo_url, photo_interior_url, photo_front_url, photo_side_url, photo_trunk_url, photo_child_seat_url, photo_access_url, photo_pet_url",
      )
      .eq("id", vehicleId)
      .maybeSingle();
    const storedPath = saved?.[field] ?? null;
    const { data: check } = await supabase.storage
      .from("vehicles")
      .createSignedUrl(path, 60 * 60);
    setBusy(null);
    if (storedPath !== path || !check?.signedUrl) {
      toast.error("La photo n'a pas pu être vérifiée. Votre ancienne photo a été conservée.");
      return;
    }
    setForm((f) => ({ ...f, [field]: path }));
    void qc.invalidateQueries({ queryKey: ["my-vehicle"] });
    void qc.invalidateQueries({ queryKey: ["signed-url", "vehicles"] });
    // L'ancien fichier n'est supprimé qu'une fois la nouvelle référence confirmée.
    if (previous && previous !== path) await supabase.storage.from("vehicles").remove([previous]);
    toast.success("Photo enregistrée");
  }


  /** Suppression volontaire d'une seule photo, sans toucher à l'autre. */
  async function removePhoto(field: PhotoField) {
    const current = form[field];
    if (!current || !vehicle.data?.id) return;
    if (!window.confirm("Supprimer définitivement cette photo ?")) return;
    setBusy(field);
    const { error } = await supabase
      .from("vehicles")
      .update({ [field]: null } as Record<PhotoField, null>)
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
    const maxPassengers = Number(form.max_passengers);
    if (!Number.isInteger(maxPassengers) || maxPassengers < 1 || maxPassengers > 8) {
      toast.error("Indiquez un nombre maximal de passagers compris entre 1 et 8.");
      return;
    }
    const optionalCount = (value: string, label: string) => {
      if (!value.trim()) return null;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 20) {
        throw new Error(`Valeur invalide pour « ${label} ».`);
      }
      return n;
    };
    let largeLuggage: number | null;
    let cabinLuggage: number | null;
    let petsMax: number | null;
    try {
      largeLuggage = optionalCount(form.large_luggage_capacity, "Grands bagages");
      cabinLuggage = optionalCount(form.cabin_luggage_capacity, "Bagages cabine");
      petsMax = optionalCount(form.pets_max, "Nombre maximal d'animaux");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Valeur invalide");
      return;
    }
    const payload = {
      driver_id: user!.id,
      brand: form.brand || null,
      model: form.model || null,
      color: form.color || null,
      plate: form.plate || null,
      year: form.year ? Number(form.year) : null,
      max_passengers: maxPassengers,
      luggage_capacity: Number(form.luggage_capacity) || 0,
      large_luggage_capacity: largeLuggage,
      cabin_luggage_capacity: cabinLuggage,
      pets_policy: form.pets_policy,
      pets_max: petsMax,
      pets_conditions: form.pets_conditions.trim() || null,
      mileage: form.mileage ? Number(form.mileage) : null,
      insurance_provider: form.insurance_provider || null,
      insurance_expires_at: form.insurance_expires_at || null,
      inspection_expires_at: form.inspection_expires_at || null,
      next_service_date: form.next_service_date || null,
      category: form.category || null,
      ...flags,
      pets_allowed: form.pets_policy !== "refused",
    };
    // On met toujours à jour la ligne existante : un INSERT créerait un doublon
    // et masquerait les photos déjà enregistrées sur le véhicule.
    const vehicleId = await ensureVehicleId();
    if (!vehicleId) {
      toast.error("Enregistrement impossible. Réessayez.");
      return;
    }
    const { error } = await supabase.from("vehicles").update(payload).eq("id", vehicleId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Véhicule enregistré");
    void qc.invalidateQueries({ queryKey: ["my-vehicle"] });
    void warnAboutFutureRides({
      vehicle_id: vehicle.data?.id ?? "",
      brand: payload.brand,
      model: payload.model,
      max_passengers: payload.max_passengers,
      luggage_capacity: payload.luggage_capacity,
      large_luggage_capacity: payload.large_luggage_capacity,
      cabin_luggage_capacity: payload.cabin_luggage_capacity,
      pets_policy: payload.pets_policy as VehicleCapacity["pets_policy"],
      pets_max: payload.pets_max,
      pets_carrier_required: flags.pets_carrier_required,
      pets_conditions: payload.pets_conditions,
      child_seat: flags.child_seat,
      booster_seat: flags.booster_seat,
      stroller_space: flags.stroller_space,
      accessible: flags.accessible,
      large_trunk: flags.large_trunk,
    });
  }

  /**
   * Une modification des capacités ne touche jamais une réservation existante :
   * le chauffeur est simplement informé des courses futures devenues incompatibles.
   */
  async function warnAboutFutureRides(capacity: VehicleCapacity) {
    const { data } = await supabase
      .from("ride_requests")
      .select(
        "id, scheduled_at, passengers, large_luggage, cabin_luggage, pets_count, pet_carrier, equipment_needs",
      )
      .eq("driver_id", user!.id)
      .gte("scheduled_at", new Date().toISOString())
      .in("status", ["new", "reviewing", "proposal_sent", "awaiting_client", "confirmed"]);
    const impacted = (data ?? []).filter(
      (r) =>
        !evaluateCompatibility(capacity, {
          passengers: r.passengers,
          largeLuggage: r.large_luggage ?? 0,
          cabinLuggage: r.cabin_luggage ?? 0,
          petsCount: r.pets_count ?? 0,
          petCarrier: r.pet_carrier ?? false,
          equipmentNeeds: r.equipment_needs ?? [],
        }).compatible,
    );
    if (!impacted.length) return;
    toast.warning(
      `${impacted.length} course(s) à venir ne correspondent plus aux capacités de votre véhicule.`,
      {
        description:
          "Aucune réservation n'a été modifiée. Contactez les clients concernés depuis vos demandes.",
        duration: 10000,
      },
    );
  }

  const photo = useSignedUrl("vehicles", form.photo_url);
  const interior = useSignedUrl("vehicles", form.photo_interior_url);
  const front = useSignedUrl("vehicles", form.photo_front_url);
  const side = useSignedUrl("vehicles", form.photo_side_url);
  const trunk = useSignedUrl("vehicles", form.photo_trunk_url);
  const childSeat = useSignedUrl("vehicles", form.photo_child_seat_url);
  const access = useSignedUrl("vehicles", form.photo_access_url);
  const petPhoto = useSignedUrl("vehicles", form.photo_pet_url);

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
        {text("max_passengers", "Passagers max (obligatoire)", "number")}
        {text("luggage_capacity", "Bagages (capacité totale)", "number")}
        {text("large_luggage_capacity", "Grands bagages (valises)", "number")}
        {text("cabin_luggage_capacity", "Bagages cabine", "number")}
        {text("mileage", "Kilométrage", "number")}
        {text("insurance_provider", "Assureur")}
        {text("insurance_expires_at", "Échéance assurance", "date")}
        {text("inspection_expires_at", "Échéance contrôle technique", "date")}
        {text("next_service_date", "Prochain entretien", "date")}

        <div className="sm:col-span-2">
          <h3 className="border-b border-border pb-2 text-lg font-bold">
            Photos et capacité du véhicule
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces photos réelles sont montrées à vos clients pendant leur réservation. Aucune image
            générique n'est ajoutée à votre place : un emplacement vide reste vide.
          </p>
        </div>

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
          <PhotoSlot
            id="photo-front"
            label="Photo de face du véhicule"
            url={front.data ?? null}
            loading={busy === "photo_front_url" || front.isLoading}
            hasPath={!!form.photo_front_url}
            onSelect={(file) => void upload(file, "photo_front_url")}
            onRemove={() => void removePhoto("photo_front_url")}
          />
          <PhotoSlot
            id="photo-side"
            label="Photo de côté du véhicule"
            url={side.data ?? null}
            loading={busy === "photo_side_url" || side.isLoading}
            hasPath={!!form.photo_side_url}
            onSelect={(file) => void upload(file, "photo_side_url")}
            onRemove={() => void removePhoto("photo_side_url")}
          />
          <PhotoSlot
            id="photo-trunk"
            label="Photo du coffre vide et ouvert"
            url={trunk.data ?? null}
            loading={busy === "photo_trunk_url" || trunk.isLoading}
            hasPath={!!form.photo_trunk_url}
            onSelect={(file) => void upload(file, "photo_trunk_url")}
            onRemove={() => void removePhoto("photo_trunk_url")}
          />
          <PhotoSlot
            id="photo-child-seat"
            label="Photo du siège enfant disponible"
            url={childSeat.data ?? null}
            loading={busy === "photo_child_seat_url" || childSeat.isLoading}
            hasPath={!!form.photo_child_seat_url}
            onSelect={(file) => void upload(file, "photo_child_seat_url")}
            onRemove={() => void removePhoto("photo_child_seat_url")}
          />
          <PhotoSlot
            id="photo-access"
            label="Photo de l'accès au véhicule (accessibilité)"
            url={access.data ?? null}
            loading={busy === "photo_access_url" || access.isLoading}
            hasPath={!!form.photo_access_url}
            onSelect={(file) => void upload(file, "photo_access_url")}
            onRemove={() => void removePhoto("photo_access_url")}
          />
          <PhotoSlot
            id="photo-pet"
            label="Photo de la protection intérieure (animaux)"
            url={petPhoto.data ?? null}
            loading={busy === "photo_pet_url" || petPhoto.isLoading}
            hasPath={!!form.photo_pet_url}
            onSelect={(file) => void upload(file, "photo_pet_url")}
            onRemove={() => void removePhoto("photo_pet_url")}
          />
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Ces photos sont montrées au client à l'étape correspondante de sa réservation. Une
            capacité déclarée sans photo est affichée au client comme « déclarée par vous, photo non
            disponible » : aucune image générique n'est utilisée à votre place.
          </p>
        </div>

        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <div>
            <Label htmlFor="pets_policy">Animaux à bord</Label>
            <select
              id="pets_policy"
              value={form.pets_policy}
              onChange={(e) => setForm({ ...form, pets_policy: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PETS_POLICIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {text("pets_max", "Nombre maximal d'animaux", "number")}
          {text("pets_conditions", "Conditions pour les animaux")}
          <div className="flex items-center gap-3">
            <Switch
              id="pets_carrier_required"
              checked={flags.pets_carrier_required}
              onCheckedChange={(v) => setFlags({ ...flags, pets_carrier_required: v })}
            />
            <Label htmlFor="pets_carrier_required">Caisse ou sac de transport obligatoire</Label>
          </div>
        </div>

        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Ces capacités sont utilisées pour vérifier automatiquement qu'une demande client est
          réalisable avec votre véhicule. Laissez un champ vide uniquement si l'information n'est
          pas encore connue.
        </p>

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
