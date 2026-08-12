import { useEffect, useId, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Baby,
  Accessibility,
  Check,
  Dog,
  Loader2,
  Luggage,
  MapPin,
  MoveRight,
  PackageOpen,
  Pencil,
  Signpost,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ReturnMode = "immediate" | "scheduled";

export type SpecialNeedsState = {
  keys: string[];
  details: Record<string, string>;
};

export const SPECIAL_NEEDS = [
  { key: "siege_enfant", label: "Siège enfant", icon: Baby, detail: "Âge de l'enfant" },
  { key: "rehausseur", label: "Rehausseur", icon: Baby, detail: null },
  { key: "animal", label: "Animal", icon: Dog, detail: "Type d'animal" },
  {
    key: "accessibilite",
    label: "Accessibilité",
    icon: Accessibility,
    detail: "Nature du besoin",
  },
  { key: "fauteuil", label: "Fauteuil roulant", icon: Accessibility, detail: null },
  {
    key: "bagages_volumineux",
    label: "Bagages volumineux",
    icon: PackageOpen,
    detail: "Dimensions approximatives",
  },
  { key: "pancarte", label: "Pancarte d'accueil", icon: Signpost, detail: "Texte à afficher" },
  { key: "autre", label: "Autre", icon: Sparkles, detail: "Précisez votre besoin" },
] as const;

/** Texte métier envoyé dans `special_needs` (champ existant). */
export function serializeNeeds(state: SpecialNeedsState) {
  return state.keys
    .map((k) => {
      const item = SPECIAL_NEEDS.find((n) => n.key === k);
      if (!item) return "";
      const detail = state.details[k]?.trim();
      return detail ? `${item.label} (${detail})` : item.label;
    })
    .filter(Boolean)
    .join(", ");
}

function Stepper({
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
    <div className="flex items-center gap-3 py-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">{label}</p>
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Retirer un ${label.toLowerCase().replace(/s$/, "")}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="tap tap-active flex size-11 items-center justify-center rounded-full bg-muted text-xl font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-35"
        >
          −
        </button>
        <output
          aria-live="polite"
          className="w-8 text-center text-[18px] font-extrabold tabular-nums"
        >
          {value}
        </output>
        <button
          type="button"
          aria-label={`Ajouter un ${label.toLowerCase().replace(/s$/, "")}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="tap tap-active flex size-11 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-35"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function OptionsStep({
  pickup,
  dropoff,
  whenLabel,
  whenMode,
  driverName,
  passengers,
  luggage,
  roundTrip,
  comment,
  needs,
  returnMode,
  returnAt,
  returnPickup,
  returnDropoff,
  minReturnLocal,
  busy,
  onEditTrip,
  onChange,
  onContinue,
}: {
  pickup: string;
  dropoff: string;
  whenLabel: string;
  whenMode: "now" | "later";
  driverName?: string | undefined;
  passengers: number;
  luggage: number;
  roundTrip: boolean;
  comment: string;
  needs: SpecialNeedsState;
  returnMode: ReturnMode;
  returnAt: string;
  returnPickup: string;
  returnDropoff: string;
  minReturnLocal: string;
  busy: boolean;
  onEditTrip: () => void;
  onChange: (patch: {
    passengers?: number;
    luggage?: number;
    roundTrip?: boolean;
    comment?: string;
    needs?: SpecialNeedsState;
    returnMode?: ReturnMode;
    returnAt?: string;
    returnPickup?: string;
    returnDropoff?: string;
  }) => void;
  onContinue: () => void;
}) {
  const commentId = useId();
  const [askDropReturn, setAskDropReturn] = useState(false);

  // Préremplissage logique du trajet retour (inversé), modifiable ensuite.
  useEffect(() => {
    if (!roundTrip || returnMode !== "scheduled") return;
    if (!returnPickup && dropoff) onChange({ returnPickup: dropoff });
    if (!returnDropoff && pickup) onChange({ returnDropoff: pickup });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundTrip, returnMode]);

  const returnInvalid =
    roundTrip &&
    returnMode === "scheduled" &&
    (!returnAt || (!!minReturnLocal && returnAt <= minReturnLocal));
  const returnIncomplete =
    roundTrip &&
    returnMode === "scheduled" &&
    (!returnPickup.trim() || !returnDropoff.trim() || !returnAt);
  const needsDetailMissing = needs.keys.some((k) => {
    const item = SPECIAL_NEEDS.find((n) => n.key === k);
    return item?.key === "autre" && !needs.details[k]?.trim();
  });
  const blocked = returnInvalid || returnIncomplete || needsDetailMissing;

  const toggleNeed = (key: string) => {
    const on = needs.keys.includes(key);
    const keys = on ? needs.keys.filter((k) => k !== key) : [...needs.keys, key];
    onChange({ needs: { keys, details: needs.details } });
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg space-y-6">
          <div className="rise-in pt-1">
            <h2 className="text-[27px] leading-[1.15] font-extrabold tracking-tight">
              Personnalisez votre trajet
            </h2>
            <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
              Ajoutez les informations utiles pour adapter la course à vos besoins.
            </p>
          </div>

          {/* Résumé compact du trajet */}
          <div className="flex items-center gap-3 rounded-3xl bg-card px-4 py-3.5 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold">
                {pickup} <MoveRight className="inline size-3.5" /> {dropoff}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {whenMode === "now" ? "Maintenant" : "Planifié"} · {whenLabel}
                {driverName ? ` · ${driverName}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onEditTrip}
              className="tap tap-active flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-[13px] font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Pencil className="size-3.5" /> Modifier
            </button>
          </div>

          {/* Votre groupe */}
          <section
            aria-labelledby="grp"
            className="rounded-3xl bg-card px-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]"
          >
            <h3
              id="grp"
              className="pt-4 text-[13px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              Votre groupe
            </h3>
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
            <div className="pb-1">
              <Stepper
                label="Bagages"
                hint="Valises et sacs"
                icon={Luggage}
                value={luggage}
                min={0}
                max={10}
                onChange={(n) => onChange({ luggage: n })}
              />
            </div>
          </section>

          {/* Type de trajet */}
          <section aria-labelledby="tt">
            <h3 id="tt" className="mb-3 text-[17px] font-extrabold tracking-tight">
              Type de trajet
            </h3>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              {(
                [
                  {
                    key: false,
                    label: "Aller simple",
                    sub: "Un seul trajet",
                    icon: ArrowRight,
                  },
                  {
                    key: true,
                    label: "Aller-retour",
                    sub: "Prévoir également le retour",
                    icon: ArrowLeftRight,
                  },
                ] as const
              ).map((o) => {
                const on = roundTrip === o.key;
                const Icon = o.icon;
                return (
                  <button
                    key={String(o.key)}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      if (!o.key && roundTrip && (returnAt || returnPickup || returnDropoff)) {
                        setAskDropReturn(true);
                      }
                      onChange({ roundTrip: o.key });
                    }}
                    className={cn(
                      "relative rounded-3xl px-4 py-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      on
                        ? "bg-primary/8 ring-2 ring-primary"
                        : "bg-card shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]",
                    )}
                  >
                    <Icon className={cn("size-6", on ? "text-primary" : "text-foreground")} />
                    <p className="mt-2.5 text-[16px] font-bold">{o.label}</p>
                    <p className="text-[13px] text-muted-foreground">{o.sub}</p>
                    {on ? (
                      <span className="animate-scale-in absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {roundTrip ? (
              <div className="rise-in mt-3 space-y-3 rounded-3xl bg-card p-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
                <p className="text-[13px] font-bold">Votre retour</p>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {(
                    [
                      { key: "immediate", label: "Immédiatement après" },
                      { key: "scheduled", label: "Planifier le retour" },
                    ] as const
                  ).map((o) => {
                    const on = returnMode === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange({ returnMode: o.key })}
                        className={cn(
                          "flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          on ? "bg-primary/8 ring-2 ring-primary" : "bg-muted",
                        )}
                      >
                        {on ? <Check className="size-4 shrink-0 text-primary" /> : null}
                        {o.label}
                      </button>
                    );
                  })}
                </div>

                {returnMode === "scheduled" ? (
                  <div className="rise-in space-y-3">
                    <div>
                      <Label htmlFor="ret-at" className="text-[13px] font-bold">
                        Date et heure du retour
                      </Label>
                      <Input
                        id="ret-at"
                        type="datetime-local"
                        min={minReturnLocal}
                        aria-invalid={returnInvalid || undefined}
                        aria-describedby={returnInvalid ? "ret-err" : undefined}
                        className="mt-1.5 h-12 rounded-2xl border-0 bg-muted text-[15px]"
                        value={returnAt}
                        onChange={(e) => onChange({ returnAt: e.target.value })}
                      />
                      {returnInvalid ? (
                        <p
                          id="ret-err"
                          className="mt-1.5 text-[12px] font-semibold text-destructive"
                        >
                          Le retour doit avoir lieu après le trajet aller.
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <Label htmlFor="ret-from" className="text-[13px] font-bold">
                        Départ du retour
                      </Label>
                      <Input
                        id="ret-from"
                        className="mt-1.5 h-12 rounded-2xl border-0 bg-muted text-[15px]"
                        value={returnPickup}
                        onChange={(e) => onChange({ returnPickup: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ret-to" className="text-[13px] font-bold">
                        Destination du retour
                      </Label>
                      <Input
                        id="ret-to"
                        className="mt-1.5 h-12 rounded-2xl border-0 bg-muted text-[15px]"
                        value={returnDropoff}
                        onChange={(e) => onChange({ returnDropoff: e.target.value })}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {askDropReturn ? (
              <div className="rise-in mt-3 rounded-2xl bg-muted p-3 text-[13px]">
                <p className="font-semibold">Conserver les informations de retour ?</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      onChange({ returnAt: "", returnPickup: "", returnDropoff: "" });
                      setAskDropReturn(false);
                    }}
                  >
                    Supprimer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setAskDropReturn(false)}
                  >
                    Conserver
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {/* Besoins particuliers */}
          <section aria-labelledby="bp">
            <div className="mb-3 flex items-baseline gap-2">
              <h3 id="bp" className="text-[17px] font-extrabold tracking-tight">
                Besoins particuliers
              </h3>
              <span className="text-[12px] font-semibold text-muted-foreground">Facultatif</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SPECIAL_NEEDS.map((n) => {
                const on = needs.keys.includes(n.key);
                const Icon = n.icon;
                return (
                  <button
                    key={n.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleNeed(n.key)}
                    className={cn(
                      "tap tap-active flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      on
                        ? "bg-primary/8 text-foreground ring-2 ring-primary"
                        : "bg-card shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]",
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

            {needs.keys.some((k) => SPECIAL_NEEDS.find((n) => n.key === k)?.detail) ? (
              <div className="rise-in mt-3 space-y-3 rounded-3xl bg-card p-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
                {needs.keys.map((k) => {
                  const item = SPECIAL_NEEDS.find((n) => n.key === k);
                  if (!item?.detail) return null;
                  return (
                    <div key={k}>
                      <Label htmlFor={`nd-${k}`} className="text-[13px] font-bold">
                        {item.detail}
                      </Label>
                      <Input
                        id={`nd-${k}`}
                        maxLength={60}
                        className="mt-1.5 h-12 rounded-2xl border-0 bg-muted text-[15px]"
                        value={needs.details[k] ?? ""}
                        onChange={(e) =>
                          onChange({
                            needs: {
                              keys: needs.keys,
                              details: { ...needs.details, [k]: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>

          {/* Informations pour le chauffeur */}
          <section aria-labelledby="ic">
            <div className="mb-3 flex items-baseline gap-2">
              <h3 id="ic" className="text-[17px] font-extrabold tracking-tight">
                Informations pour le chauffeur
              </h3>
              <span className="text-[12px] font-semibold text-muted-foreground">Facultatif</span>
            </div>
            <Textarea
              id={commentId}
              aria-label="Informations pour le chauffeur"
              rows={4}
              maxLength={500}
              placeholder="Numéro de vol, étage, point de rendez-vous ou consigne particulière…"
              className="min-h-28 rounded-3xl border-0 bg-card p-4 text-[15px] shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]"
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
          </section>
        </div>
      </div>

      <div
        className="shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-lg">
          <Button
            size="lg"
            className="h-13 w-full rounded-2xl text-[15px] font-bold transition-transform active:scale-[0.99]"
            disabled={busy || blocked}
            onClick={onContinue}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Continuer
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
