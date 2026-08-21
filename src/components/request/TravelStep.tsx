/**
 * Étape 2 sur 4 — Voyage et règlement.
 *
 * Galerie habitacle / coffre reliée aux compteurs, puis choix du mode de
 * règlement. Le trajet saisi à l'étape 1 n'est jamais répété ici.
 */
import { useState } from "react";
import { ArrowRight, Loader2, Luggage, PackageOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CabinTrunkGallery } from "@/components/request/VehiclePhotos";
import { PaymentBlock, PAYMENT_SECTION_ID } from "@/components/request/PaymentChoice";
import type { PaymentMethodOption } from "@/lib/payment-methods";
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
  busy,
  onChange,
  onContinue,
}: {
  driverName?: string | undefined;
  vehicleMedia?: VehicleMedia | null;
  passengers: number;
  largeLuggage: number;
  cabinLuggage: number;
  busy: boolean;
  onChange: (patch: {
    passengers?: number;
    largeLuggage?: number;
    cabinLuggage?: number;
  }) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg space-y-4">
          <div className="rise-in pt-1">
            <h2 className="text-[24px] leading-tight font-extrabold tracking-tight">
              Préparez votre voyage
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">
              Indiquez le nombre de voyageurs, vos bagages et votre mode de règlement.
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
              hint="Vous inclus"
              icon={Users}
              value={passengers}
              min={1}
              max={8}
              onChange={(n) => onChange({ passengers: n })}
            />
            <div className="h-px bg-border/70" />
            <Stepper
              label="Grands bagages"
              hint="Valises de soute"
              icon={Luggage}
              value={largeLuggage}
              min={0}
              max={10}
              onChange={(n) => onChange({ largeLuggage: n })}
            />
            <div className="h-px bg-border/70" />
            <Stepper
              label="Bagages cabine"
              hint="Sacs et petits bagages"
              icon={PackageOpen}
              value={cabinLuggage}
              min={0}
              max={10}
              onChange={(n) => onChange({ cabinLuggage: n })}
            />
          </section>

          <PaymentBlock
            options={paymentOptions}
            loading={paymentLoading}
            value={paymentMethod}
            onSelect={(k) => {
              setPaymentError(false);
              onSelectPayment(k);
            }}
            driverName={driverName ?? null}
            onContactDriver={onContactDriver}
            showError={paymentError}
          />
        </div>
      </div>

      <div
        className="shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-lg">
          {noPaymentConfigured ? (
            <p aria-live="polite" className="mb-2 text-center text-[12px] text-muted-foreground">
              Ce chauffeur n'a pas encore renseigné de mode de règlement.
            </p>
          ) : !paymentMethod ? (
            <p aria-live="polite" className="mb-2 text-center text-[12px] text-muted-foreground">
              Choisissez un mode de règlement pour continuer.
            </p>
          ) : null}
          <Button
            size="lg"
            className="h-13 w-full rounded-2xl text-[15px] font-bold transition-transform active:scale-[0.99]"
            disabled={busy || blocked}
            onClick={() => {
              if (!paymentMethod) {
                setPaymentError(true);
                document
                  .getElementById(PAYMENT_SECTION_ID)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
              }
              onContinue();
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Continuer — Vos options
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
