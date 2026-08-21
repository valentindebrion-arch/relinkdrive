/**
 * Photos contextuelles du véhicule dans le parcours de réservation.
 *
 * Règle ReLink : chaque photo est fournie par le chauffeur et illustre la
 * décision de l'étape en cours. Aucune image générique, aucun agrandissement
 * au clic, aucune promesse de compatibilité non déclarée.
 */
import { useState } from "react";
import {
  Accessibility,
  Baby,
  Camera,
  Car,
  Check,
  Dog,
  Images,
  Luggage,
  PackageOpen,
  Snowflake,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  firstName,
  luggageCapacityState,
  type VehicleMedia,
  type VehiclePhotoKind,
} from "@/lib/vehicle-photos";

/** Cadre photo strictement non interactif (pas de zoom, pas de plein écran). */
function Frame({
  url,
  alt,
  ratio = "aspect-[16/9]",
  loading,
  fallback,
}: {
  url: string | null;
  alt: string;
  ratio?: string;
  loading?: boolean;
  fallback: React.ReactNode;
}) {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl bg-muted", ratio)}>
      {loading ? (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      ) : url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full cursor-default object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center px-4 text-center">{fallback}</div>
      )}
    </div>
  );
}

function EmptySlot({ icon: Icon, message }: { icon: typeof Car; message: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
      <Icon className="size-6" aria-hidden />
      <p className="text-[12.5px] leading-snug font-semibold">{message}</p>
    </div>
  );
}

function DeclaredBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <Camera className="size-3" aria-hidden /> {children}
    </span>
  );
}

function vehicleLabel(media: VehicleMedia) {
  const v = media.vehicle;
  if (!v) return null;
  return [v.brand, v.model].filter(Boolean).join(" ") || null;
}

/* ─────────────── Étape 1 : photo extérieure de profil ─────────────── */

export function VehicleExteriorCard({
  media,
  driverName,
  available,
  onChangeVehicle,
}: {
  media: VehicleMedia;
  driverName?: string | null;
  available: boolean;
  onChangeVehicle: () => void;
}) {
  const who = firstName(driverName);
  const label = vehicleLabel(media);
  const url = media.profileUrl();
  return (
    <section className="overflow-hidden rounded-[26px] bg-card p-3 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
      <div className="max-h-[190px] overflow-hidden rounded-2xl">
        <Frame
          url={url}
          alt={label ? `${label} vu de profil` : "Véhicule du chauffeur"}
          ratio="aspect-[16/9]"
          loading={media.isLoading}
          fallback={
            <EmptySlot
              icon={Car}
              message={`${who} n'a pas encore ajouté de photo de son véhicule.`}
            />
          }
        />
      </div>
      <div className="mt-3 flex items-start gap-3 px-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-bold">{label ?? "Véhicule non renseigné"}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {media.vehicle?.color ? `${media.vehicle.color} · ` : ""}
            {driverName ?? "Votre chauffeur"}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[12.5px] font-bold",
              available ? "text-primary" : "text-muted-foreground",
            )}
          >
            {available ? "Disponible maintenant" : "Hors service actuellement"}
          </p>
          {url ? <span className="mt-1.5 inline-flex"><DeclaredBadge>Photo fournie par {who}</DeclaredBadge></span> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full"
          onClick={onChangeVehicle}
        >
          Changer de véhicule
        </Button>
      </div>
    </section>
  );
}

/* ─────────────── Étape 2 : habitacle et coffre ─────────────── */

export function CabinTrunkGallery({
  media,
  driverName,
  largeLuggage,
  cabinLuggage,
}: {
  media: VehicleMedia;
  driverName?: string | null;
  largeLuggage: number;
  cabinLuggage: number;
}) {
  const [tab, setTab] = useState<"cabin" | "trunk">("cabin");
  const who = firstName(driverName);
  const v = media.vehicle;
  const capacity = luggageCapacityState(v, largeLuggage, cabinLuggage, who);

  const comfort = [
    v?.max_passengers ? `Jusqu'à ${v.max_passengers} passagers` : null,
    v?.air_conditioning ? "Climatisation" : null,
    v?.large_trunk ? "Intérieur spacieux" : null,
  ].filter(Boolean) as string[];

  return (
    <section className="rounded-3xl bg-card p-3 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
      <div
        role="tablist"
        aria-label="Photos du véhicule"
        className="mb-3 flex gap-1 rounded-full bg-muted p-1"
      >
        {(
          [
            { key: "cabin", label: "Habitacle", icon: Users },
            { key: "trunk", label: "Coffre", icon: Luggage },
          ] as const
        ).map((t) => {
          const on = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[13.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "cabin" ? (
        <div>
          <Frame
            url={media.urlOf("interior")}
            alt="Intérieur du véhicule, places arrière"
            loading={media.isLoading}
            fallback={
              <EmptySlot
                icon={Users}
                message={`${who} n'a pas encore ajouté de photo de l'habitacle.`}
              />
            }
          />
          {media.hasPhoto("interior") ? (
            <p className="mt-2"><DeclaredBadge>Photo fournie par {who}</DeclaredBadge></p>
          ) : null}
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {comfort.length ? (
              comfort.map((c) => (
                <li
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold"
                >
                  {c === "Climatisation" ? (
                    <Snowflake className="size-3.5 text-primary" aria-hidden />
                  ) : (
                    <Check className="size-3.5 text-primary" aria-hidden />
                  )}
                  {c}
                </li>
              ))
            ) : (
              <li className="text-[12px] text-muted-foreground">
                Équipements de confort non renseignés.
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div>
          <Frame
            url={media.urlOf("trunk")}
            alt="Coffre vide et ouvert du véhicule"
            loading={media.isLoading}
            fallback={
              <EmptySlot
                icon={Luggage}
                message={`${who} n'a pas encore ajouté de photo du coffre.`}
              />
            }
          />
          <p className="mt-2 text-[12.5px] font-bold">Capacité déclarée par {who}</p>
          <p className="text-[12.5px] text-muted-foreground">
            {v?.large_luggage_capacity != null
              ? `${v.large_luggage_capacity} grand(s) bagage(s)`
              : "Grands bagages non renseignés"}
            {" · "}
            {v?.cabin_luggage_capacity != null
              ? `${v.cabin_luggage_capacity} bagage(s) cabine`
              : "Bagages cabine non renseignés"}
          </p>
          {media.hasPhoto("trunk") ? (
            <p className="mt-2"><DeclaredBadge>Photo fournie par {who}</DeclaredBadge></p>
          ) : null}
        </div>
      )}

      <div
        aria-live="polite"
        className={cn(
          "mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-[12.5px] font-semibold",
          capacity.tone === "ok"
            ? "bg-primary/10 text-primary"
            : capacity.tone === "unknown"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-destructive/8 text-destructive",
        )}
      >
        <PackageOpen className="size-4 shrink-0" aria-hidden />
        <span>
          {largeLuggage + cabinLuggage} bagage(s) sélectionné(s) — {capacity.label}
        </span>
      </div>
      <p className="mt-1.5 px-1 text-[11.5px] text-muted-foreground">
        La capacité dépend également des dimensions de vos bagages.
      </p>
    </section>
  );
}

/* ─────────────── Étape 3 : équipements et préférences ─────────────── */

type EquipmentView = {
  kind: VehiclePhotoKind;
  title: string;
  icon: typeof Baby;
  declared: boolean;
};

function equipmentView(
  media: VehicleMedia,
  needs: string[],
  petsCount: number,
): EquipmentView | null {
  const v = media.vehicle;
  if (needs.includes("siege_enfant") || needs.includes("rehausseur")) {
    return {
      kind: "childSeat",
      title: "Siège enfant",
      icon: Baby,
      declared: !!(v?.child_seat || v?.booster_seat),
    };
  }
  if (needs.includes("accessibilite") || needs.includes("fauteuil")) {
    return {
      kind: needs.includes("fauteuil") ? "trunk" : "access",
      title: needs.includes("fauteuil") ? "Coffre pour fauteuil roulant" : "Accès au véhicule",
      icon: Accessibility,
      declared: !!v?.accessible,
    };
  }
  if (needs.includes("poussette") || needs.includes("bagages_volumineux")) {
    return {
      kind: "trunk",
      title: "Coffre du véhicule",
      icon: PackageOpen,
      declared: !!(v?.stroller_space || v?.large_trunk),
    };
  }
  if (petsCount > 0) {
    return {
      kind: "pet",
      title: "Protection intérieure pour animaux",
      icon: Dog,
      declared: v?.pets_policy === "accepted" || v?.pets_policy === "conditional",
    };
  }
  return { kind: "interior", title: "Vue intérieure du véhicule", icon: Users, declared: true };
}

export function EquipmentContextPhoto({
  media,
  driverName,
  needs,
  petsCount,
}: {
  media: VehicleMedia;
  driverName?: string | null;
  needs: string[];
  petsCount: number;
}) {
  const who = firstName(driverName);
  const view = equipmentView(media, needs, petsCount);
  if (!view) return null;
  const url = media.urlOf(view.kind);
  const Icon = view.icon;

  return (
    <section className="rounded-3xl bg-card p-3 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
      <p className="mb-2 flex items-center gap-2 px-1 text-[13px] font-bold">
        <Icon className="size-4 text-primary" aria-hidden /> {view.title}
      </p>
      {url ? (
        <>
          <Frame url={url} alt={view.title} loading={media.isLoading} fallback={null} />
          <p className="mt-2 px-1"><DeclaredBadge>Photo fournie par {who}</DeclaredBadge></p>
        </>
      ) : (
        <p className="rounded-2xl bg-muted px-3 py-2.5 text-[12.5px] leading-snug text-muted-foreground">
          {view.declared
            ? `Équipement déclaré par ${who} — photo non disponible`
            : `Cet équipement n'est pas déclaré par ${who}.`}
        </p>
      )}
    </section>
  );
}

/* ─────────────── Étape 4 : confirmation ─────────────── */

const GALLERY: { kind: VehiclePhotoKind; label: string }[] = [
  { kind: "side", label: "Extérieur (profil)" },
  { kind: "exterior", label: "Extérieur" },
  { kind: "front", label: "Face" },
  { kind: "interior", label: "Habitacle" },
  { kind: "trunk", label: "Coffre" },
  { kind: "childSeat", label: "Siège enfant" },
  { kind: "access", label: "Accès au véhicule" },
  { kind: "pet", label: "Protection animaux" },
];

export function VehicleConfirmCard({
  media,
  driverName,
  passengers,
  largeLuggage,
  cabinLuggage,
}: {
  media: VehicleMedia;
  driverName?: string | null;
  passengers: number;
  largeLuggage: number;
  cabinLuggage: number;
}) {
  const [open, setOpen] = useState(false);
  const who = firstName(driverName);
  const label = vehicleLabel(media);
  const photos = GALLERY.map((g) => ({ ...g, url: media.urlOf(g.kind) })).filter((g) => g.url);

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-3 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          <Frame
            url={media.profileUrl()}
            alt={label ? `${label} vu de profil` : "Véhicule"}
            ratio="aspect-square"
            loading={media.isLoading}
            fallback={<Car className="size-5 text-muted-foreground" aria-hidden />}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold">{label ?? "Véhicule non renseigné"}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {media.vehicle?.color ? `${media.vehicle.color} · ` : ""}
            {driverName ?? "Votre chauffeur"}
          </p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {passengers} passager(s) · {largeLuggage} grand(s) · {cabinLuggage} cabine
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full"
          disabled={photos.length === 0}
          onClick={() => setOpen(true)}
        >
          <Images className="size-4" aria-hidden /> Voir les photos
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Photos du véhicule</DialogTitle>
            <DialogDescription>Photos fournies par {who}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {photos.map((p) => (
              <div key={p.kind}>
                <Frame url={p.url} alt={p.label} loading={false} fallback={null} />
                <p className="mt-1 text-[12.5px] font-semibold">{p.label}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
