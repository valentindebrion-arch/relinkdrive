import { AlertTriangle, Check, Loader2, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaymentMethodOption } from "@/lib/payment-methods";

export const PAYMENT_SECTION_ID = "mode-de-reglement";

export type PaymentMethodSectionProps = {
  options: PaymentMethodOption[];
  loading: boolean;
  value: string | null;
  onSelect: (key: string) => void;
  driverName?: string | null;
  onContactDriver: () => void;
  /** Affiche le message d'erreur lorsque l'envoi a été tenté sans sélection. */
  showError?: boolean;
};

export function PaymentMethodSection({
  options,
  loading,
  value,
  onSelect,
  driverName,
  onContactDriver,
  showError,
}: PaymentMethodSectionProps) {
  return (
    <section
      id={PAYMENT_SECTION_ID}
      aria-labelledby="reglement-title"
      className="scroll-mt-24 rounded-3xl bg-card p-4 shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]"
    >
      <h3 id="reglement-title" className="text-[17px] font-extrabold tracking-tight">
        Comment souhaitez-vous régler la course ?
      </h3>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
        Le règlement s'effectuera directement auprès de votre chauffeur.
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
      ) : (
        <>
          <ul className="mt-3 space-y-2">
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
                      "tap tap-active flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      on ? "bg-primary/8 ring-2 ring-primary" : "bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                        on ? "bg-primary/15 text-primary" : "bg-card text-muted-foreground",
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
          <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
            {driverName ? `${driverName} ` : "Votre chauffeur "}
            est responsable de ses moyens d'encaissement. ReLink transmet uniquement votre choix et
            n'encaisse aucun montant.
          </p>
          {showError && !value ? (
            <p role="alert" className="mt-2 text-[13px] font-semibold text-destructive">
              Sélectionnez un mode de règlement avant d'envoyer votre demande.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
