/**
 * Fiche chauffeur — photos du véhicule côté administration.
 *
 * RÈGLE CRITIQUE ReLink : cette carte écrit sur la MÊME source de vérité que
 * l'espace chauffeur (colonnes `vehicles.photo_url` et
 * `vehicles.photo_interior_url`, bucket permanent `vehicles`). Aucune copie
 * spécifique à l'admin n'est créée : une photo remplacée ici apparaît
 * immédiatement sur l'espace chauffeur, la fiche publique et l'espace client.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Car, History, ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PhotoField =
  "photo_url" | "photo_interior_url" | "photo_front_url" | "photo_side_url" | "photo_trunk_url";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const FIELD_LABEL: Record<PhotoField, string> = {
  photo_url: "Photo extérieure",
  photo_interior_url: "Photo intérieure",
  photo_front_url: "Photo de face",
  photo_side_url: "Photo de côté",
  photo_trunk_url: "Photo du coffre",
};

const PHOTO_KIND: Record<PhotoField, string> = {
  photo_url: "exterior",
  photo_interior_url: "interior",
  photo_front_url: "front",
  photo_side_url: "side",
  photo_trunk_url: "trunk",
};

function useDriverVehicle(driverId: string) {
  return useQuery({
    queryKey: ["admin", "driver-vehicle", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id, photo_url, photo_interior_url, photo_front_url, photo_side_url, photo_trunk_url",
        )
        .eq("driver_id", driverId)
        .order("is_primary", { ascending: false })
        .order("created_at")
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

function PhotoSlot({
  field,
  path,
  busy,
  onSelect,
  onRemove,
}: {
  field: PhotoField;
  path: string | null;
  busy: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const signed = useSignedUrl("vehicles", path);
  const url = signed.data ?? null;

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-sm font-medium">{FIELD_LABEL[field]}</p>
      <div className="mt-2 aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-muted">
        {url ? (
          <img src={url} alt={FIELD_LABEL[field]} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            {signed.isLoading && path ? (
              <Loader2 className="size-5 animate-spin" />
            ) : path ? (
              <ImageOff className="size-5" />
            ) : (
              <Car className="size-5" />
            )}
            <p className="text-[11px] font-semibold">
              {path
                ? "Photo indisponible"
                : field === "photo_trunk_url"
                  ? "Aucune photo du coffre ajoutée"
                  : "Aucune photo"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2">
        <label className="text-xs text-muted-foreground" htmlFor={`admin-${field}`}>
          {path ? "Remplacer la photo" : "Ajouter une photo"}
        </label>
        <Input
          id={`admin-${field}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onSelect(f);
          }}
        />
        {path ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start text-destructive"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 className="mr-1 size-4" /> Supprimer la photo
          </Button>
        ) : null}
        {busy ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Envoi en cours…
          </p>
        ) : (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Upload className="size-3.5" /> JPEG, PNG, WebP ou HEIC · 8 Mo maximum
          </p>
        )}
      </div>
    </div>
  );
}

function PhotoHistory({ driverId }: { driverId: string }) {
  const q = useQuery({
    queryKey: ["admin", "vehicle-photo-history", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, resource, created_at")
        .eq("resource_id", driverId)
        .in("action", ["vehicle_photo_replaced", "vehicle_photo_deleted"])
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  if (!q.data?.length) return null;

  return (
    <div className="mt-4">
      <p className="flex items-center gap-2 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
        <History className="size-3.5" /> Historique administratif
      </p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {q.data.map((row) => (
          <li key={row.id}>
            {new Date(row.created_at).toLocaleDateString("fr-FR")} —{" "}
            {FIELD_LABEL[(row.resource as PhotoField) ?? "photo_url"] ?? "Photo"}{" "}
            {row.action === "vehicle_photo_deleted" ? "supprimée" : "modifiée"} par l'administration
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VehiclePhotosAdminCard({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const vehicle = useDriverVehicle(driverId);
  const [busy, setBusy] = useState<PhotoField | null>(null);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["admin", "driver-vehicle", driverId] });
    void qc.invalidateQueries({ queryKey: ["admin", "vehicle-photo-history", driverId] });
    void qc.invalidateQueries({ queryKey: ["my-vehicle"] });
    void qc.invalidateQueries({ queryKey: ["signed-url"] });
    void qc.invalidateQueries({ queryKey: ["signed-urls"] });
  }

  /**
   * Remplacement sécurisé : envoi du nouveau fichier → vérification dans le
   * stockage → mise à jour de la base → seulement ensuite l'ancienne référence
   * est abandonnée. En cas d'échec, l'ancienne photo est conservée.
   */
  async function replace(file: File, field: PhotoField) {
    const vehicleId = vehicle.data?.id;
    if (!vehicleId) {
      toast.error("Aucun véhicule enregistré pour ce chauffeur.");
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non pris en charge (JPEG, PNG, WebP ou HEIC).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photo trop lourde (8 Mo maximum).");
      return;
    }
    const previous = (vehicle.data?.[field] as string | null) ?? null;
    if (previous && !window.confirm("Remplacer cette photo du véhicule ?")) return;

    setBusy(field);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const kind = PHOTO_KIND[field];
    const path = `${driverId}/vehicles/${vehicleId}/${kind}/${crypto.randomUUID()}.${ext}`;

    const { error: upError } = await supabase.storage
      .from("vehicles")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upError) {
      setBusy(null);
      toast.error("La photo n'a pas pu être envoyée. L'ancienne photo est conservée.");
      return;
    }

    const { error: dbError } = await supabase
      .from("vehicles")
      .update({ [field]: path } as Record<PhotoField, string>)
      .eq("id", vehicleId);
    if (dbError) {
      await supabase.storage.from("vehicles").remove([path]);
      setBusy(null);
      toast.error("La photo n'a pas pu être enregistrée. L'ancienne photo est conservée.");
      return;
    }

    // Contrôle final : la référence est relue et le fichier doit exister.
    const { data: saved } = await supabase
      .from("vehicles")
      .select("photo_url, photo_interior_url, photo_front_url, photo_side_url, photo_trunk_url")
      .eq("id", vehicleId)
      .maybeSingle();
    const { data: check } = await supabase.storage.from("vehicles").createSignedUrl(path, 3600);
    if (saved?.[field] !== path || !check?.signedUrl) {
      setBusy(null);
      toast.error("La photo n'a pas pu être vérifiée. L'ancienne photo est conservée.");
      return;
    }

    await supabase.rpc("admin_log_vehicle_photo", {
      _driver_id: driverId,
      _field: field,
      _action: "replace",
      _old_path: previous ?? "",
      _new_path: path,
    });
    // L'ancien fichier n'est retiré qu'après confirmation complète du nouveau.
    if (previous && previous !== path) {
      await supabase.storage.from("vehicles").remove([previous]);
    }
    setBusy(null);
    refresh();
    toast.success("Photo mise à jour avec succès");
  }

  async function remove(field: PhotoField) {
    const vehicleId = vehicle.data?.id;
    const previous = (vehicle.data?.[field] as string | null) ?? null;
    if (!vehicleId || !previous) return;
    if (!window.confirm("Supprimer définitivement cette photo ?")) return;

    setBusy(field);
    const { error } = await supabase
      .from("vehicles")
      .update({ [field]: null } as Record<PhotoField, null>)
      .eq("id", vehicleId);
    if (error) {
      setBusy(null);
      toast.error("La suppression a échoué. La photo est conservée.");
      return;
    }
    await supabase.rpc("admin_log_vehicle_photo", {
      _driver_id: driverId,
      _field: field,
      _action: "delete",
      _old_path: previous,
      _new_path: "",
    });
    await supabase.storage.from("vehicles").remove([previous]);
    setBusy(null);
    refresh();
    toast.success("Photo supprimée.");
  }

  return (
    <section className="surface mb-4 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Car className="size-4 text-muted-foreground" /> Véhicule — photos
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Ces photos sont la source unique utilisée par l'espace chauffeur, la fiche publique et
        l'espace client. Toute modification est visible immédiatement partout.
      </p>

      {vehicle.isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Chargement…</p>
      ) : !vehicle.data ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Ce chauffeur n'a pas encore de véhicule enregistré.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PhotoSlot
            field="photo_url"
            path={vehicle.data.photo_url}
            busy={busy === "photo_url"}
            onSelect={(f) => void replace(f, "photo_url")}
            onRemove={() => void remove("photo_url")}
          />
          <PhotoSlot
            field="photo_interior_url"
            path={vehicle.data.photo_interior_url}
            busy={busy === "photo_interior_url"}
            onSelect={(f) => void replace(f, "photo_interior_url")}
            onRemove={() => void remove("photo_interior_url")}
          />
          <PhotoSlot
            field="photo_front_url"
            path={vehicle.data.photo_front_url}
            busy={busy === "photo_front_url"}
            onSelect={(f) => void replace(f, "photo_front_url")}
            onRemove={() => void remove("photo_front_url")}
          />
          <PhotoSlot
            field="photo_side_url"
            path={vehicle.data.photo_side_url}
            busy={busy === "photo_side_url"}
            onSelect={(f) => void replace(f, "photo_side_url")}
            onRemove={() => void remove("photo_side_url")}
          />
          <PhotoSlot
            field="photo_trunk_url"
            path={vehicle.data.photo_trunk_url}
            busy={busy === "photo_trunk_url"}
            onSelect={(f) => void replace(f, "photo_trunk_url")}
            onRemove={() => void remove("photo_trunk_url")}
          />
        </div>
      )}

      <PhotoHistory driverId={driverId} />
    </section>
  );
}
