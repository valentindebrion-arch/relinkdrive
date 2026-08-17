import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import type { CompatibilityResult } from "@/lib/compatibility";
import { Button } from "@/components/ui/button";

/**
 * Affiche le résultat du moteur de compatibilité.
 * Les formulations attribuent la contrainte au véhicule ou au chauffeur,
 * jamais à ReLink.
 */
export function CompatibilityNotice({
  result,
  loading,
  driverName,
  onChangeDriver,
  onEditNeeds,
  compact,
}: {
  result: CompatibilityResult | null;
  loading?: boolean;
  driverName?: string | null;
  onChangeDriver?: () => void;
  onEditNeeds?: () => void;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-muted/70 p-3 text-[13px] text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Vérification de la compatibilité…
      </div>
    );
  }
  if (!result) return null;

  if (result.compatible) {
    return (
      <div className="rounded-2xl border border-primary/35 bg-primary/8 p-3">
        <p className="flex items-start gap-2 text-[13px] font-semibold">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {compact
              ? "Ce véhicule est compatible avec votre demande."
              : `Votre demande est compatible avec les capacités déclarées par ${driverName ?? "ce chauffeur"}.`}
          </span>
        </p>
        {result.warnings.map((w, i) => (
          <p
            key={`${w.code}-${i}`}
            className="mt-2 flex items-start gap-2 text-[12.5px] text-muted-foreground"
          >
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>{w.message}</span>
          </p>
        ))}
        {!compact ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Le chauffeur reste libre d'accepter ou de refuser la demande.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3">
      <p className="flex items-start gap-2 text-[13.5px] font-bold">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <span>Ce trajet ne peut pas être réservé auprès de ce chauffeur :</span>
      </p>
      <ul className="mt-2 space-y-1.5 pl-6">
        {result.blockingIssues.map((issue, i) => (
          <li key={`${issue.code}-${i}`} className="list-disc text-[13px]">
            {issue.message}
          </li>
        ))}
      </ul>
      {result.warnings.length ? (
        <ul className="mt-2 space-y-1 pl-6">
          {result.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="list-disc text-[12.5px] text-muted-foreground">
              {w.message}
            </li>
          ))}
        </ul>
      ) : null}
      {onEditNeeds || onChangeDriver ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {onEditNeeds ? (
            <Button size="sm" variant="outline" className="rounded-full" onClick={onEditNeeds}>
              Modifier ma demande
            </Button>
          ) : null}
          {onChangeDriver ? (
            <Button size="sm" className="rounded-full" onClick={onChangeDriver}>
              Choisir un autre de mes chauffeurs
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
