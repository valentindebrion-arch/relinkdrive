import { useId, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Info,
  Loader2,
  Pencil,
  Send,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LEGAL_LINKS } from "@/lib/legal-versions";
import { formatEuro } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type ReviewEstimate = {
  distanceKm: number;
  durationMin: number;
  price: { base: number; total: number; tip: number };
  quote?: {
    amount_ht: number;
    vat_rate: number | null;
    vat_amount: number | null;
    amount_ttc: number;
    regime: "franchise" | "liable";
    legal_mention: string | null;
    price_per_km_ht: number;
    minimum_ht: number;
    base_ht: number;
    rounding_ht: number;
  } | null;
};

export type ReviewStepProps = {
  pickup: string;
  dropoff: string;
  whenLabel: string;
  whenMode: "now" | "later";
  estimate: ReviewEstimate | null;
  roundTrip: boolean;
  returnLabel: string | null;
  passengers: number;
  luggage: number;
  needsLabel: string;
  comment: string;
  driver: { name: string; available: boolean; zone?: string | null } | null;
  driverStatusLabel: string | null;
  busy: boolean;
  blockedReason: string | null;
  errorMessage: string | null;
  onEditTrip: () => void;
  onEditDriver: () => void;
  onEditOptions: () => void;
  onSubmit: () => void;
};

function Card({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-extrabold tracking-tight">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Pencil className="size-3.5" /> Modifier
        </button>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="max-w-[62%] text-right text-[13px] font-semibold break-words">{value}</dd>
    </div>
  );
}

export function ReviewStep(props: ReviewStepProps) {
  const {
    pickup,
    dropoff,
    whenLabel,
    whenMode,
    estimate,
    roundTrip,
    returnLabel,
    passengers,
    luggage,
    needsLabel,
    comment,
    driver,
    driverStatusLabel,
    busy,
    blockedReason,
    errorMessage,
  } = props;

  const [accepted, setAccepted] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const acceptId = useId();

  const hasOptions =
    passengers > 1 || luggage > 0 || roundTrip || !!needsLabel.trim() || !!comment.trim();

  const disabled = busy || !accepted || !estimate || !!blockedReason;
  const helper = !accepted
    ? "Acceptez les CGU et les CGV pour envoyer votre demande."
    : (blockedReason ?? (!estimate ? "Le tarif doit être recalculé avant l'envoi." : null));

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg space-y-4">
          <div className="rise-in pt-1">
            <h2 className="text-[26px] leading-[1.15] font-extrabold tracking-tight">
              Vérifiez et confirmez
            </h2>
            <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
              Contrôlez les informations avant d'envoyer votre demande.
            </p>
          </div>

          {/* Tarif — priorité visuelle */}
          <section
            aria-labelledby="tarif"
            className="rounded-3xl border border-primary/35 bg-primary/8 p-4"
          >
            <p id="tarif" className="text-[12px] font-bold tracking-wide text-primary uppercase">
              {estimate?.quote?.regime === "liable" ? "Prix TTC estimé" : "Total à payer estimé"}
            </p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-[34px] leading-none font-extrabold tabular-nums">
                {estimate ? formatEuro(estimate.price.total) : "—"}
              </p>
              <div className="text-right text-[13px] font-semibold text-muted-foreground">
                <p>{estimate ? `${estimate.distanceKm} km` : "— km"}</p>
                <p>{estimate ? `~${estimate.durationMin} min` : "— min"}</p>
              </div>
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
              Montant calculé sur l'itinéraire estimé. Il peut évoluer si le chauffeur propose un
              autre horaire ou un autre prix en répondant, ou si le trajet réellement effectué
              diffère. Il devient ferme à l'acceptation du chauffeur.
            </p>

            <button
              type="button"
              aria-expanded={detailOpen}
              onClick={() => setDetailOpen((v) => !v)}
              className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Voir le détail du tarif
              <ChevronDown
                className={cn("size-4 transition-transform", detailOpen && "rotate-180")}
              />
            </button>

            {detailOpen && estimate ? (
              <dl className="mt-2 rounded-2xl bg-card p-3">
                <Row
                  label={`Distance estimée${roundTrip ? " (aller-retour)" : ""}`}
                  value={`${estimate.distanceKm} km`}
                />
                <Row
                  label="Tarif kilométrique HT"
                  value={
                    estimate.quote
                      ? `${formatEuro(estimate.quote.price_per_km_ht)} / km (minimum ${formatEuro(estimate.quote.minimum_ht)})`
                      : "—"
                  }
                />
                {estimate.quote ? (
                  <>
                    <Row label="Sous-total HT" value={formatEuro(estimate.quote.base_ht)} />
                    {estimate.quote.rounding_ht > 0 ? (
                      <Row
                        label="Arrondi reversé au chauffeur"
                        value={formatEuro(estimate.quote.rounding_ht)}
                      />
                    ) : null}
                    <Row
                      label={
                        estimate.quote.regime === "liable" ? "Montant HT" : "Montant de la prestation"
                      }
                      value={formatEuro(estimate.quote.amount_ht)}
                    />
                    {estimate.quote.regime === "liable" ? (
                      <Row
                        label={`TVA (${estimate.quote.vat_rate} %)`}
                        value={formatEuro(estimate.quote.vat_amount ?? 0)}
                      />
                    ) : (
                      <Row label="TVA" value="Non applicable" />
                    )}
                  </>
                ) : (
                  <Row label="Sous-total" value={formatEuro(estimate.price.base)} />
                )}
                <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-2">
                  <dt className="text-[14px] font-bold">
                    {estimate.quote?.regime === "liable" ? "Total TTC" : "Total à payer"}
                  </dt>
                  <dd className="text-[16px] font-extrabold tabular-nums">
                    {formatEuro(estimate.price.total)}
                  </dd>
                </div>
                {estimate.quote?.regime === "franchise" && estimate.quote.legal_mention ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    {estimate.quote.legal_mention}
                  </p>
                ) : null}
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Aucun autre frais n'est ajouté par Relink. Le règlement s'effectue directement
                  auprès du chauffeur.
                </p>
              </dl>
            ) : null}
          </section>

          {/* Votre trajet */}
          <Card title="Votre trajet" editLabel="Modifier le trajet" onEdit={props.onEditTrip}>
            <div className="relative pl-6">
              <span className="absolute top-2.5 left-[5px] h-[calc(100%-1.5rem)] w-px bg-primary/30" />
              <div className="pb-3">
                <span className="absolute left-0 mt-1.5 size-2.5 rounded-full bg-primary" />
                <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
                  Départ
                </p>
                <p className="text-[14px] font-semibold break-words">{pickup}</p>
              </div>
              <div>
                <span className="absolute left-0 mt-1.5 size-2.5 rounded-[3px] bg-foreground" />
                <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
                  Arrivée
                </p>
                <p className="text-[14px] font-semibold break-words">{dropoff}</p>
              </div>
            </div>
            <dl className="mt-3 border-t border-border pt-2">
              <Row
                label="Départ"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    {whenMode === "now" ? (
                      <Clock className="size-3.5" />
                    ) : (
                      <CalendarClock className="size-3.5" />
                    )}
                    {whenMode === "now" ? "Maintenant" : "Planifié"} · {whenLabel}
                  </span>
                }
              />
              <Row label="Distance estimée" value={estimate ? `${estimate.distanceKm} km` : "—"} />
              <Row label="Durée estimée" value={estimate ? `~${estimate.durationMin} min` : "—"} />
            </dl>
          </Card>

          {/* Votre chauffeur */}
          <Card
            title="Votre chauffeur"
            editLabel="Modifier le chauffeur"
            onEdit={props.onEditDriver}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-bold text-primary">
                {driver ? driver.name.slice(0, 2).toUpperCase() : <UserRound className="size-5" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold">
                  {driver ? driver.name : "Chauffeur à attribuer"}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {driver
                    ? (driverStatusLabel ??
                      (driver.available ? "En service actuellement" : "Hors service actuellement"))
                    : "Relink recherchera un chauffeur adapté à votre demande"}
                </p>
                {driver?.zone ? (
                  <p className="text-[12px] text-muted-foreground">Zone : {driver.zone}</p>
                ) : null}
              </div>
            </div>
          </Card>

          {/* Vos options */}
          <Card title="Vos options" editLabel="Modifier les options" onEdit={props.onEditOptions}>
            {hasOptions ? (
              <dl>
                <Row label="Nombre de passagers" value={passengers} />
                <Row label="Nombre de bagages" value={luggage} />
                <Row label="Type de trajet" value={roundTrip ? "Aller-retour" : "Aller simple"} />
                {roundTrip && returnLabel ? <Row label="Retour" value={returnLabel} /> : null}
                {needsLabel.trim() ? <Row label="Besoins particuliers" value={needsLabel} /> : null}
                {comment.trim() ? (
                  <Row label="Informations pour le chauffeur" value={comment} />
                ) : null}
              </dl>
            ) : (
              <p className="text-[13px] text-muted-foreground">Aucune option particulière</p>
            )}
          </Card>

          {/* Information sur l'envoi */}
          <div className="flex items-start gap-2.5 rounded-3xl bg-muted/70 p-4">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-[13px] leading-snug text-muted-foreground">
              {driver
                ? `En envoyant votre demande, celle-ci sera transmise à ${driver.name}. Elle restera en attente jusqu'à son acceptation.`
                : "En envoyant votre demande, elle sera proposée aux chauffeurs de votre carnet. Elle restera en attente jusqu'à l'acceptation d'un chauffeur."}
            </p>
          </div>

          {/* Acceptation CGU / CGV */}
          <section
            className={cn(
              "rounded-3xl border-2 p-4 transition-colors",
              accepted ? "border-primary/60 bg-primary/5" : "border-border bg-card",
            )}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                id={acceptId}
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                className="mt-0.5 size-6 rounded-md"
              />
              <label htmlFor={acceptId} className="text-[13.5px] leading-snug">
                J'ai lu et j'accepte les{" "}
                <a
                  href={LEGAL_LINKS.cgu}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-primary underline underline-offset-2"
                >
                  Conditions générales d'utilisation
                </a>{" "}
                et les{" "}
                <a
                  href={LEGAL_LINKS.cgv}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-primary underline underline-offset-2"
                >
                  Conditions générales de vente
                </a>
                .
              </label>
            </div>
            <p className="mt-3 border-t border-border/70 pt-3 text-[12.5px] leading-snug text-muted-foreground">
              Annulation possible à tout moment depuis l'application, sans frais appliqués par
              Relink.{" "}
              <a
                href={LEGAL_LINKS.cancellation}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-primary underline underline-offset-2"
              >
                Consulter les conditions d'annulation
              </a>
            </p>
          </section>

          {errorMessage ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-[13px] font-medium"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div
        className="shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-lg">
          {helper ? (
            <p aria-live="polite" className="mb-2 text-center text-[12px] text-muted-foreground">
              {helper}
            </p>
          ) : null}
          <Button
            size="lg"
            className="h-13 w-full rounded-2xl text-[15px] font-bold transition-transform active:scale-[0.99]"
            disabled={disabled}
            onClick={props.onSubmit}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : accepted ? (
              <Send className="size-4" />
            ) : (
              <Check className="size-4" />
            )}
            {busy ? "Envoi en cours…" : "Envoyer ma demande"}
          </Button>
        </div>
      </div>
    </>
  );
}
