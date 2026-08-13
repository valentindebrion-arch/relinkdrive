import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useMyTariff, useMyTaxPeriods } from "@/lib/tax-queries";

/** Rappel tant que la configuration fiscale n'est pas complète. */
export function TaxSetupBanner() {
  const periods = useMyTaxPeriods();
  const tariff = useMyTariff();
  if (periods.isLoading || tariff.isLoading) return null;

  const hasRegime = (periods.data?.length ?? 0) > 0;
  const tariffConfirmed = (tariff.data?.basis ?? "unqualified") === "ht";
  if (hasRegime && tariffConfirmed) return null;

  return (
    <Link
      to="/pro/profil"
      search={{ section: "entreprise" }}
      className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-[13px]"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <span>
        <span className="font-semibold">
          {hasRegime
            ? "Confirmez la nature HT de vos tarifs."
            : "Complétez votre régime de TVA pour générer des estimations et des factures correctes."}
        </span>{" "}
        Entreprise &gt; Fiscalité
      </span>
    </Link>
  );
}
