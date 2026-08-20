import { Check, Crown, Sparkles } from "lucide-react";
import { formatEuro } from "@/lib/labels";
import {
  FREE_FEATURES,
  PLAN_LABELS,
  PRO_FEATURES,
  PRO_PRICE_PER_MONTH,
  PRO_TAGLINE,
  useMyPlan,
} from "@/lib/plan";
import { Button } from "@/components/ui/button";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Écran « Mon abonnement » : offre en cours et comparatif Gratuit / Pro. */
export function SubscriptionSection() {
  const { plan, data, isLoading } = useMyPlan();
  const isPro = plan === "pro";

  return (
    <section className="space-y-4">
      <div className="surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
              Mon abonnement
            </p>
            <p className="mt-1 flex items-center gap-2 text-[20px] font-extrabold tracking-tight">
              {isPro ? <Crown className="size-5 text-primary" /> : null}
              {isLoading ? "Chargement…" : PLAN_LABELS[plan]}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {isPro
                ? `${formatEuro(PRO_PRICE_PER_MONTH)} / mois · 0 % de commission`
                : "Gratuit à vie · 0 % de commission"}
            </p>
            {isPro && data?.renews_at ? (
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Prochain renouvellement : {formatDate(data.renews_at)}
              </p>
            ) : null}
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[12px] font-bold text-primary">
            {isPro ? "Actif" : "Offre de base"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`surface p-5 ${isPro ? "" : "ring-2 ring-primary"}`}>
          <p className="text-[16px] font-extrabold">ReLink Gratuit</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">L'essentiel pour être réservé.</p>
          <ul className="mt-3 space-y-1.5 text-[13.5px]">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`surface p-5 ${isPro ? "ring-2 ring-primary" : "border-primary/30"}`}>
          <p className="flex items-center gap-2 text-[16px] font-extrabold">
            <Sparkles className="size-4 text-primary" /> ReLink Pro
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{PRO_TAGLINE}</p>
          <p className="mt-2 text-[20px] font-extrabold">
            {formatEuro(PRO_PRICE_PER_MONTH)}
            <span className="text-[13px] font-semibold text-muted-foreground"> / mois</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-[13.5px]">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {isPro ? (
            <p className="mt-4 text-[13px] font-semibold text-primary">
              Vous profitez déjà de toutes ces fonctionnalités.
            </p>
          ) : (
            <Button asChild className="mt-4 w-full">
              <a href="mailto:contact@relinkconnect.app?subject=Passer%20%C3%A0%20ReLink%20Pro">
                Passer à ReLink Pro
              </a>
            </Button>
          )}
        </div>
      </div>

      <p className="text-center text-[12.5px] text-muted-foreground">
        ReLink ne prélève aucune commission sur vos courses, quelle que soit votre offre.
      </p>
    </section>
  );
}
