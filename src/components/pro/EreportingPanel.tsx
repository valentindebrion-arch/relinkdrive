/**
 * Pilotage de l'e-reporting : périodes, agrégats, mode contrôlé et mode
 * automatique (jamais actif par défaut).
 */
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatEuro } from "@/lib/labels";
import type { EInvoicingConnection } from "@/lib/einvoicing/connections";
import { useConnectionMutations } from "@/lib/einvoicing/connections";
import {
  FREQUENCY_LABELS,
  PERIOD_STATUS_LABELS,
  buildPeriod,
  defaultFrequency,
  syncReportablePayments,
  syncReportableTransactions,
  submitPeriod,
  useEreportingPeriods,
  useInvalidateEreporting,
  type Aggregate,
  type EreportingPeriod,
  type ReportingFrequency,
} from "@/lib/einvoicing/ereporting";

export function EreportingPanel({
  driverId,
  connection,
  taxRegime,
}: {
  driverId: string;
  connection: EInvoicingConnection | null;
  taxRegime?: string | null;
}) {
  const periods = useEreportingPeriods(driverId);
  const invalidate = useInvalidateEreporting();
  const { update } = useConnectionMutations(driverId);
  const [busy, setBusy] = useState(false);
  const frequency: ReportingFrequency = defaultFrequency(taxRegime);

  async function refresh(kind: "transaction" | "payment") {
    setBusy(true);
    try {
      if (kind === "transaction") await syncReportableTransactions(driverId);
      else await syncReportablePayments(driverId);
      await buildPeriod({ driverId, kind, frequency });
      invalidate();
      toast.success("Période mise à jour");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function transmit(period: EreportingPeriod) {
    if (!connection) {
      toast.error("Connexion à une plateforme agréée nécessaire pour transmettre cet e-reporting.");
      return;
    }
    setBusy(true);
    try {
      const res = await submitPeriod({ driverId, period, connection });
      invalidate();
      if (res.status === "submitted") toast.success("E-reporting transmis — accusé en attente");
      else toast.error(res.errorMessage ?? "Transmission refusée");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">E-reporting</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Transactions avec des particuliers ou hors routage B2B domestique, et données d'encaissement. Fréquence
            déterminée par votre régime de TVA : {FREQUENCY_LABELS[frequency]}.
          </p>
        </div>
        <CalendarClock className="size-5 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh("transaction")}>
          {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}
          Recalculer les transactions
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh("payment")}>
          <RefreshCw className="mr-1 size-4" /> Recalculer les encaissements
        </Button>
      </div>

      {connection ? (
        <label className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
          <span>
            Transmettre automatiquement mon e-reporting
            <span className="block text-[11px] text-muted-foreground">
              À n'activer qu'après un test de connexion réussi : les agrégats de chaque période seront transmis sans
              validation manuelle.
            </span>
          </span>
          <Switch
            checked={connection.auto_reporting_enabled}
            onCheckedChange={(v) => {
              if (v && connection.connection_status !== "connected") {
                toast.error("Testez d'abord la connexion à votre plateforme agréée.");
                return;
              }
              update.mutate({ id: connection.id, values: { auto_reporting_enabled: v } });
            }}
          />
        </label>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Connexion à une plateforme agréée nécessaire pour transmettre votre e-reporting.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {(periods.data ?? []).map((p) => (
          <PeriodCard key={p.id} period={p} onSubmit={() => void transmit(p)} busy={busy} />
        ))}
        {(periods.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune période calculée pour le moment.</p>
        ) : null}
      </div>
    </section>
  );
}

function PeriodCard({ period, onSubmit, busy }: { period: EreportingPeriod; onSubmit: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const aggregates = (period.aggregates as Aggregate[] | null) ?? [];
  return (
    <div className="rounded-xl border border-border p-3">
      <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {period.kind === "transaction" ? "Transactions" : "Encaissements"} · {formatDate(period.period_start)} →{" "}
              {formatDate(period.period_end)}
            </p>
            <p className="text-xs text-muted-foreground">
              {period.transaction_count} opération(s) · {formatEuro(Number(period.total_ht))} HT ·{" "}
              {formatEuro(Number(period.total_vat))} TVA · {formatEuro(Number(period.total_ttc))} TTC
            </p>
            <p className="text-xs text-muted-foreground">
              Échéance : {period.due_on ? formatDate(period.due_on) : "—"}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
            {PERIOD_STATUS_LABELS[period.status]}
          </span>
        </div>
      </button>

      {open ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <ul className="space-y-1 text-xs text-muted-foreground">
            {aggregates.map((a, i) => (
              <li key={`${a.date}-${a.vatRate}-${i}`}>
                {formatDate(a.date)} · TVA {a.vatRate}% · {a.regime} · {a.count} opération(s) ·{" "}
                {formatEuro(a.totalHt)} HT / {formatEuro(a.totalVat)} TVA / {formatEuro(a.totalTtc)} TTC
              </li>
            ))}
            {aggregates.length === 0 ? <li>Aucun agrégat.</li> : null}
          </ul>
          {period.last_error_message ? <p className="text-xs text-destructive">{period.last_error_message}</p> : null}
          <Button
            size="sm"
            disabled={busy || period.transaction_count === 0 || ["submitted", "acknowledged"].includes(period.status)}
            onClick={onSubmit}
          >
            <Send className="mr-1 size-4" /> Vérifier et transmettre
          </Button>
        </div>
      ) : null}
    </div>
  );
}
