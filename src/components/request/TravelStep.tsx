/**
 * Étape 2 sur 4 — Voyageurs et bagages.
 *
 * Galerie habitacle / coffre reliée aux compteurs. Le trajet saisi à
 * l'étape 1 n'est jamais répété ici, et le règlement arrive à l'étape 3.
 */
import { ArrowRight, Loader2, Luggage, PackageOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CabinTrunkGallery } from "@/components/request/VehiclePhotos";
import type { VehicleMedia } from "@/lib/vehicle-photos";

export function Stepper({
  label,
  hint,
  icon: Icon,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  icon: typeof Users;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-bold">{label}</p>
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Retirer : ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="tap tap-active flex size-10 items-center justify-center rounded-full bg-muted text-xl font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-35"
        >
          −
        </button>
        <output
          aria-live="polite"
          className="w-7 text-center text-[17px] font-extrabold tabular-nums"
        >
          {value}
        </output>
        <button
          type="button"
          aria-label={`Ajouter : ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="tap tap-active flex size-10 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-35"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function TravelStep({
  driverName,
  vehicleMedia,
  passengers,
  largeLuggage,
  cabinLuggage,
  maxPassengers,
  maxLargeLuggage,
  maxCabinLuggage,
  capacityLoading,
  blockingMessages = [],
  busy,
  onChange,
  onContinue,
}: {
  driverName?: string | undefined;
  vehicleMedia?: VehicleMedia | null;
  passengers: number;
  largeLuggage: number;
  cabinLuggage: number;
  /** Capacités réelles du véhicule sélectionné (null = non renseignée). */
  maxPassengers?: number | null;
  maxLargeLuggage?: number | null;
  maxCabinLuggage?: number | null;
  capacityLoading?: boolean;
  blockingMessages?: string[];
  busy: boolean;
  onChange: (patch: {
    passengers?: number;
    largeLuggage?: number;
    cabinLuggage?: number;
  }) => void;
  onContinue: () => void;
}) {
  const passengerMax = maxPassengers ?? 8;
  const largeMax = maxLargeLuggage ?? 10;
  const cabinMax = maxCabinLuggage ?? 10;
  const blocked = blockingMessages.length > 0;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
          <div className="rise-in pt-1">
            <h2 className="text-[24px] leading-tight font-extrabold tracking-tight">
              Préparez votre voyage
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">
              Indiquez le nombre de voyageurs et les bagages à transporter.
            </p>
          </div>

          {vehicleMedia ? (
            <CabinTrunkGallery
              media={vehicleMedia}
              driverName={driverName ?? null}
              largeLuggage={largeLuggage}
              cabinLuggage={cabinLuggage}
            />
          ) : null}


          <section
            aria-label="Voyageurs et bagages"
            className="rounded-3xl border border-border/70 bg-card px-4 py-1.5 shadow-[0_10px_30px_-30px_rgba(0,0,0,0.45)]"
          >
            <Stepper
              label="Passagers"
              hint={
                maxPassengers != null
                  ? `Vous inclus · ${maxPassengers} maximum`
                  : "Vous inclus"
              }
              icon={Users}
              value={passengers}
              min={1}
              max={passengerMax}
              onChange={(n) => onChange({ passengers: n })}
            />
            <div className="h-px bg-border/70" />
            <Stepper
              label="Grands bagages"
              hint={
                maxLargeLuggage != null
                  ? `Valises de soute · ${maxLargeLuggage} maximum`
                  : "Valises de soute"
              }
              icon={Luggage}
              value={largeLuggage}
              min={0}
              max={largeMax}
              onChange={(n) => onChange({ largeLuggage: n })}
            />
            <div className="h-px bg-border/70" />
            <Stepper
              label="Bagages cabine"
              hint={
                maxCabinLuggage != null
                  ? `Sacs et petits bagages · ${maxCabinLuggage} maximum`
                  : "Sacs et petits bagages"
              }
              icon={PackageOpen}
              value={cabinLuggage}
              min={0}
              max={cabinMax}
              onChange={(n) => onChange({ cabinLuggage: n })}
            />
          </section>

          {blocked ? (
            <div
              role="alert"
              className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3"
            >
              <p className="text-[13.5px] font-bold">
                Cette configuration dépasse les capacités du véhicule :
              </p>
              <ul className="mt-2 space-y-1 pl-5">
                {blockingMessages.map((m, i) => (
                  <li key={i} className="list-disc text-[13px]">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="pt-2">
            {blocked ? (
              <p aria-live="polite" className="mb-2 text-center text-[12px] text-muted-foreground">
                {blockingMessages[0]}
              </p>
            ) : null}
            <Button
              size="lg"
              className="h-13 w-full rounded-2xl text-[15px] font-bold transition-transform active:scale-[0.99]"
              disabled={busy || blocked || !!capacityLoading}
              onClick={onContinue}
            >
              {busy || capacityLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              Continuer — Règlement et demandes
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

    </>
  );
}
