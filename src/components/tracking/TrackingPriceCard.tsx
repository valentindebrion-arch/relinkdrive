import { cn } from "@/lib/utils";

/**
 * Prix final à régler directement au chauffeur.
 * ReLink n'encaisse rien : la mention est explicite et non négociable.
 */
export function TrackingPriceCard({
  amount,
  paymentLabel,
  estimated,
}: {
  amount: string | null;
  paymentLabel?: string | null;
  estimated?: boolean;
}) {
  return (
    <section
      className={cn(
        "motion-safe:animate-fade-in rounded-3xl border border-primary/20 bg-primary/[0.05] p-[clamp(1rem,4vw,1.35rem)]",
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {estimated ? "Prix estimé" : "Prix à régler"}
          </p>
          <p className="text-2xl leading-tight font-extrabold tabular-nums">
            {amount ?? "À définir"}
          </p>
        </div>
        {paymentLabel ? (
          <span className="rounded-full border border-primary/25 bg-background/70 px-3 py-1 text-xs font-semibold">
            {paymentLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">
        Le règlement se fait directement auprès de votre chauffeur. ReLink est le logiciel de
        gestion utilisé par le chauffeur et n'encaisse aucun paiement.
      </p>
    </section>
  );
}
