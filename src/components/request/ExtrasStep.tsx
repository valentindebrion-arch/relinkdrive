/**
 * Étape 3 sur 4 — Options et demandes (facultative).
 *
 * Tout est replié par défaut : seules les options réellement choisies
 * apparaissent, sous forme de tags supprimables. La compatibilité n'est
 * annoncée qu'après une sélection, jamais par défaut.
 */
import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Loader2, MessageSquare, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CompatibilityNotice } from "@/components/request/CompatibilityNotice";
import { EquipmentContextPhoto } from "@/components/request/VehiclePhotos";
import type { CompatibilityResult } from "@/lib/compatibility";
import type { VehicleMedia } from "@/lib/vehicle-photos";
import { firstName } from "@/lib/vehicle-photos";
import {
  PET_NEED,
  PET_NEED_KEY,
  SPECIAL_NEEDS,
  type PetsState,
  type SpecialNeedsState,
} from "@/components/request/needs";

export function ExtrasStep({
  driverName,
  vehicleMedia,
  needs,
  pets,
  compatibility,
  compatibilityLoading,
  comment,
  busy,
  onChangeDriver,
  onChange,
  onContinue,
}: {
  driverName?: string | undefined;
  vehicleMedia?: VehicleMedia | null;
  needs: SpecialNeedsState;
  pets: PetsState;
  compatibility: CompatibilityResult | null;
  compatibilityLoading: boolean;
  comment: string;
  busy: boolean;
  onChangeDriver: () => void;
  onChange: (patch: {
    needs?: SpecialNeedsState;
    pets?: PetsState;
    comment?: string;
  }) => void;
  onContinue: () => void;
}) {
  const who = firstName(driverName);
  const [listOpen, setListOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(!!comment.trim());

  const petSelected = pets.count > 0;
  const selectedKeys = [...needs.keys, ...(petSelected ? [PET_NEED_KEY] : [])];
  const anySelected = selectedKeys.length > 0;

  const toggle = (key: string) => {
    if (key === PET_NEED_KEY) {
      onChange({
        pets: petSelected
          ? { count: 0, type: "", carrier: false }
          : { ...pets, count: Math.max(1, pets.count) },
      });
      return;
    }
    const on = needs.keys.includes(key);
    onChange({
      needs: {
        keys: on ? needs.keys.filter((k) => k !== key) : [...needs.keys, key],
        details: needs.details,
      },
    });
  };

  const detailFields = needs.keys
    .map((k) => SPECIAL_NEEDS.find((n) => n.key === k))
    .filter((n): n is (typeof SPECIAL_NEEDS)[number] => !!n?.detail);

  const needsDetailMissing = needs.keys.some(
    (k) => k === "autre" && !needs.details[k]?.trim(),
  );
  const incompatible = !!compatibility && !compatibility.compatible;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg space-y-4">
          <div className="rise-in pt-1">
            <h2 className="text-[24px] leading-tight font-extrabold tracking-tight">
              Personnalisez votre course
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">
              Ajoutez uniquement les informations utiles à {who}.
            </p>
          </div>

          {vehicleMedia ? (
            <EquipmentContextPhoto
              media={vehicleMedia}
              driverName={driverName ?? null}
              needs={needs.keys}
              petsCount={pets.count}
              compact
            />
          ) : null}

          {/* Options et demandes particulières — replié par défaut */}
          <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-[0_10px_30px_-30px_rgba(0,0,0,0.45)]">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[15px] font-extrabold tracking-tight">
                Options et demandes particulières
              </h3>
              <span className="text-[11.5px] font-semibold text-muted-foreground">Facultatif</span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
              Siège enfant, accessibilité, animal, pancarte…
            </p>

            {anySelected ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {selectedKeys.map((k) => {
                  const item = k === PET_NEED_KEY ? PET_NEED : SPECIAL_NEEDS.find((n) => n.key === k);
                  if (!item) return null;
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => toggle(k)}
                        aria-label={`Retirer ${item.label}`}
                        className="tap tap-active flex min-h-9 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-[13px] font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {item.label}
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <button
              type="button"
              aria-expanded={listOpen}
              onClick={() => setListOpen((v) => !v)}
              className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-muted/60 px-3.5 text-[14px] font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex items-center gap-2 text-primary">
                <Plus className="size-4" aria-hidden /> Ajouter une option
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  listOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {listOpen ? (
              <div className="rise-in mt-3">
                <div className="flex flex-wrap gap-2">
                  {[...SPECIAL_NEEDS, PET_NEED].map((n) => {
                    const on = selectedKeys.includes(n.key);
                    const Icon = n.icon;
                    return (
                      <button
                        key={n.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(n.key)}
                        className={cn(
                          "tap tap-active flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[14px] font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          on ? "border-primary bg-primary/8" : "border-border bg-background",
                        )}
                      >
                        {on ? (
                          <Check className="size-4 text-primary" />
                        ) : (
                          <Icon className="size-4 text-muted-foreground" />
                        )}
                        {n.label}
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={() => setListOpen(false)}
                >
                  Terminer
                </Button>
              </div>
            ) : null}

            {detailFields.length ? (
              <div className="rise-in mt-3 space-y-3">
                {detailFields.map((item) => (
                  <div key={item.key}>
                    <Label htmlFor={`nd-${item.key}`} className="text-[13px] font-bold">
                      {item.detail}
                    </Label>
                    <Input
                      id={`nd-${item.key}`}
                      maxLength={60}
                      className="mt-1.5 h-12 rounded-2xl border-0 bg-muted text-[15px]"
                      value={needs.details[item.key] ?? ""}
                      onChange={(e) =>
                        onChange({
                          needs: {
                            keys: needs.keys,
                            details: { ...needs.details, [item.key]: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {petSelected ? (
              <div className="rise-in mt-3 space-y-3">
                <div>
                  <Label htmlFor="pet-type" className="text-[13px] font-bold">
                    Type d'animal
                  </Label>
                  <Input
                    id="pet-type"
                    placeholder="Chien, chat…"
                    className="mt-1.5 h-12 rounded-2xl border-0 bg-muted text-[15px]"
                    value={pets.type}
                    onChange={(e) => onChange({ pets: { ...pets, type: e.target.value } })}
                  />
                </div>
                <button
                  type="button"
                  aria-pressed={pets.carrier}
                  onClick={() => onChange({ pets: { ...pets, carrier: !pets.carrier } })}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-[14px] font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    pets.carrier ? "bg-primary/8 ring-2 ring-primary" : "bg-muted",
                  )}
                >
                  {pets.carrier ? <Check className="size-4 shrink-0 text-primary" /> : null}
                  Animal transporté dans une caisse ou un sac
                </button>
              </div>
            ) : null}
          </section>

          {/* Compatibilité : uniquement après une sélection */}
          {anySelected ? (
            <section aria-live="polite">
              <CompatibilityNotice
                result={compatibility}
                loading={compatibilityLoading}
                driverName={driverName ?? null}
                onChangeDriver={onChangeDriver}
                compact
              />
            </section>
          ) : null}

          {/* Message pour le chauffeur — replié par défaut */}
          <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-[0_10px_30px_-30px_rgba(0,0,0,0.45)]">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[15px] font-extrabold tracking-tight">Message pour {who}</h3>
              <span className="text-[11.5px] font-semibold text-muted-foreground">Facultatif</span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
              Numéro de vol, étage, point de rendez-vous ou autre consigne…
            </p>

            {messageOpen ? (
              <div className="rise-in mt-3">
                <Textarea
                  aria-label={`Message pour ${who}`}
                  rows={4}
                  maxLength={500}
                  placeholder="Numéro de vol, étage, point de rendez-vous…"
                  className="min-h-24 rounded-2xl border-0 bg-muted p-3.5 text-[15px]"
                  value={comment}
                  onChange={(e) => onChange({ comment: e.target.value })}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3 px-1">
                  <p className="text-[12px] text-muted-foreground">
                    Ne partagez aucune information bancaire ou donnée sensible.
                  </p>
                  <p
                    aria-live="polite"
                    className="shrink-0 text-[12px] tabular-nums text-muted-foreground"
                  >
                    {comment.length}/500
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMessageOpen(true)}
                className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-2xl bg-muted/60 px-3.5 text-[14px] font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <MessageSquare className="size-4" aria-hidden /> + Ajouter un message
              </button>
            )}
          </section>
        </div>
      </div>

      <div
        className="shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-lg">
          {incompatible ? (
            <p aria-live="polite" className="mb-2 text-center text-[12px] text-muted-foreground">
              Ajustez votre demande ou choisissez un autre de vos chauffeurs pour continuer.
            </p>
          ) : needsDetailMissing ? (
            <p aria-live="polite" className="mb-2 text-center text-[12px] text-muted-foreground">
              Précisez votre demande « Autre » pour continuer.
            </p>
          ) : null}
          <Button
            size="lg"
            className="h-13 w-full rounded-2xl text-[15px] font-bold transition-transform active:scale-[0.99]"
            disabled={busy || incompatible || needsDetailMissing}
            onClick={onContinue}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Continuer — Vérifier la course
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
