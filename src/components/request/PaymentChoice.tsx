/**
 * Choix du mode de règlement (étape 2) et rappel sous le prix (étape 4).
 *
 * ReLink n'encaisse jamais : le client règle directement son chauffeur.
 */
import { AlertTriangle, Check, Loader2, PhoneCall, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { paymentMethodIcon, type PaymentMethodOption } from "@/lib/payment-methods";
import { firstName } from "@/lib/vehicle-photos";

export const PAYMENT_SECTION_ID = "mode-de-reglement";

export function PaymentChoiceList({
  options,
  value,
  onSelect,
}: {
  options: PaymentMethodOption[];
  value: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {options.map((o) => {
        const on = value === o.key;
        const Icon = o.icon;
        return (
          <li key={o.key}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(o.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                on ? "border-primary bg-primary/5" : "border-border bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                  on ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold">{o.label}</span>
                <span className="block text-[12.5px] leading-snug text-muted-foreground">
                  {o.description}
                </span>
              </span>
              {on ? <Check className="size-5 shrink-0 text-primary" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Résumé compact d'un mode sélectionné, avec bouton « Modifier ». */
export function PaymentSummary({
  option,
  driverName,
  onEdit,
}: {
  option: PaymentMethodOption | null;
  driverName?: string | null | undefined;
  onEdit: () => void;
}) {
  const who = firstName(driverName);
  const Icon = option ? option.icon : paymentMethodIcon(null);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold">
          {option?.label ?? "Mode de règlement à choisir"}
        </span>
        <span className="block text-[12.5px] leading-snug text-muted-foreground">
          {option
            ? option.key === "card"
              ? `${who} dispose d'un terminal de paiement à bord.`
              : `Paiement directement auprès de ${who}.`
            : `Indiquez comment vous réglerez ${who}.`}
        </span>
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-full px-2 py-1 text-[13px] font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Modifier
      </button>
    </div>
  );
}

/** Bloc complet de l'étape 2 : liste puis résumé replié. */
export function PaymentBlock({
  options,
  loading,
  value,
  onSelect,
  driverName,
  onContactDriver,
  showError,
}: {
  options: PaymentMethodOption[];
  loading: boolean;
  value: string | null;
  onSelect: (key: string) => void;
  driverName?: string | null | undefined;
  onContactDriver: () => void;
  showError?: boolean | undefined;
}) {
  const who = firstName(driverName);
  const selected = options.find((o) => o.key === value) ?? null;

  return (
    <section
      id={PAYMENT_SECTION_ID}
      aria-labelledby="reglement-title"
      className="scroll-mt-24 rounded-3xl border border-border/70 bg-card p-4 shadow-[0_10px_30px_-30px_rgba(0,0,0,0.45)]"
    >
      <h3 id="reglement-title" className="text-[15px] font-extrabold tracking-tight">
        Mode de règlement souhaité
      </h3>
      <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
        Vous réglerez directement {who} à la fin de la course.
      </p>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement des modes de règlement…
        </p>
      ) : options.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-muted/70 p-3.5">
          <p className="flex items-start gap-2 text-[13px] leading-snug">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              Aucun mode de règlement n'a encore été renseigné par ce chauffeur. Vous pouvez le
              contacter avant de réserver.
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 rounded-full"
            onClick={onContactDriver}
          >
            <PhoneCall className="size-4" />
            Contacter mon chauffeur
          </Button>
        </div>
      ) : selected ? (
        <div className="mt-3">
          <PaymentSummary
            option={selected}
            driverName={driverName}
            onEdit={() => onSelect("")}
          />
        </div>
      ) : (
        <div className="mt-3">
          <PaymentChoiceList options={options} value={value} onSelect={onSelect} />
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Wallet className="size-3.5 shrink-0" aria-hidden /> Aucun paiement n'est encaissé par
        ReLink.
      </p>
      {showError && !value ? (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-destructive">
          Sélectionnez un mode de règlement pour continuer.
        </p>
      ) : null}
    </section>
  );
}

/** Bottom sheet de modification rapide depuis l'étape 4. */
export function PaymentSheet({
  open,
  onOpenChange,
  options,
  value,
  onSelect,
  driverName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  options: PaymentMethodOption[];
  value: string | null;
  onSelect: (key: string) => void;
  driverName?: string | null | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mode de règlement</DialogTitle>
          <DialogDescription>
            Vous réglerez directement {firstName(driverName)}. Aucun paiement n'est encaissé par
            ReLink.
          </DialogDescription>
        </DialogHeader>
        <PaymentChoiceList
          options={options}
          value={value}
          onSelect={(k) => {
            onSelect(k);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
