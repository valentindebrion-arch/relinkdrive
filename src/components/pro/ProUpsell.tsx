import { Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { formatEuro } from "@/lib/labels";
import { PRO_FEATURES, PRO_PRICE_PER_MONTH, PRO_TAGLINE } from "@/lib/plan";
import { Button } from "@/components/ui/button";

/** Écran affiché aux chauffeurs Gratuit sur une fonctionnalité ReLink Pro. */
export function ProUpsell() {
  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="surface p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </span>
        <h1 className="mt-3 text-[20px] font-extrabold tracking-tight">
          Fonctionnalité ReLink Pro
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{PRO_TAGLINE}</p>
        <p className="mt-3 text-[22px] font-extrabold">
          {formatEuro(PRO_PRICE_PER_MONTH)}
          <span className="text-[13px] font-semibold text-muted-foreground"> / mois</span>
        </p>
        <ul className="mt-4 space-y-1.5 text-left text-[13.5px]">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Button asChild className="mt-5 w-full">
          <Link to="/pro/profil" search={{ section: "abonnement" }}>
            Découvrir ReLink Pro
          </Link>
        </Button>
      </div>
    </div>
  );
}
