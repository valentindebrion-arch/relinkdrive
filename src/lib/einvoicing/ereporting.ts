/**
 * E-reporting : transactions B2C / hors champ B2B domestique et données
 * d'encaissement.
 *
 * Le registre est distinct des factures : une facture B2C n'est jamais routée
 * vers un destinataire, elle alimente des agrégats. Aucune information
 * personnelle du particulier n'est transmise dans ces agrégats.
 *
 * La fréquence n'est pas codée en dur : elle dépend du régime de TVA du
 * chauffeur et reste modifiable dans la configuration.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notifyEinvoicing } from "@/lib/einvoicing/notify";
import { connectionContext, type EInvoicingConnection } from "@/lib/einvoicing/connections";
import { getProvider, type ReportPayload } from "@/lib/einvoicing/provider";

export type ReportingFrequency = "daily" | "decadal" | "monthly" | "quarterly";

export const FREQUENCY_LABELS: Record<ReportingFrequency, string> = {
  daily: "Quotidienne",
  decadal: "Tous les 10 jours",
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
};

export type PeriodStatus =
  | "draft"
  | "ready"
  | "validation_failed"
  | "awaiting_confirmation"
  | "submitted"
  | "acknowledged"
  | "rejected"
  | "corrected";

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  draft: "Brouillon",
  ready: "Prête",
  validation_failed: "Contrôles en échec",
  awaiting_confirmation: "En attente de confirmation",
  submitted: "Transmise",
  acknowledged: "Accusée",
  rejected: "Rejetée",
  corrected: "Corrigée",
};

/**
 * Fréquence par défaut selon le régime de TVA déclaré. Elle est proposée, pas
 * imposée : la configuration validée par le chauffeur prime.
 */
export function defaultFrequency(regime?: string | null): ReportingFrequency {
  switch (regime) {
    case "normal":
    case "reel_normal":
      return "decadal";
    case "simplifie":
    case "reel_simplifie":
      return "monthly";
    case "franchise":
      return "quarterly";
    default:
      return "monthly";
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Bornes de la période courante pour une fréquence donnée. */
export function periodBounds(frequency: ReportingFrequency, ref = new Date()) {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const day = ref.getUTCDate();
  if (frequency === "daily") {
    const d = new Date(Date.UTC(y, m, day));
    return { start: iso(d), end: iso(d) };
  }
  if (frequency === "decadal") {
    const startDay = day <= 10 ? 1 : day <= 20 ? 11 : 21;
    const end = startDay === 21 ? new Date(Date.UTC(y, m + 1, 0)) : new Date(Date.UTC(y, m, startDay + 9));
    return { start: iso(new Date(Date.UTC(y, m, startDay))), end: iso(end) };
  }
  if (frequency === "quarterly") {
    const q = Math.floor(m / 3);
    return { start: iso(new Date(Date.UTC(y, q * 3, 1))), end: iso(new Date(Date.UTC(y, q * 3 + 3, 0))) };
  }
  return { start: iso(new Date(Date.UTC(y, m, 1))), end: iso(new Date(Date.UTC(y, m + 1, 0))) };
}

/** Échéance de transmission : 10 jours après la clôture de la période. */
export function dueDateFor(periodEnd: string) {
  const d = new Date(`${periodEnd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 10);
  return iso(d);
}

export type EreportingPeriod = {
  id: string;
  kind: "transaction" | "payment";
  frequency: ReportingFrequency;
  period_start: string;
  period_end: string;
  due_on: string | null;
  status: PeriodStatus;
  transaction_count: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  currency: string;
  aggregates: unknown;
  external_submission_id: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  rejected_at: string | null;
  last_error_message: string | null;
  receipt_storage_path: string | null;
  auto_submitted: boolean;
};

export function useEreportingPeriods(driverId?: string) {
  return useQuery({
    queryKey: ["ereporting-periods", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ereporting_periods")
        .select("*")
        .eq("driver_id", driverId!)
        .order("period_start", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as unknown as EreportingPeriod[];
    },
  });
}

export type Aggregate = {
  date: string;
  vatRate: number;
  regime: string;
  category: string;
  currency: string;
  count: number;
  totalHt: number;
  totalVat: number;
  totalTtc: number;
};

/** Agrégats journaliers requis : date × taux × régime × catégorie × devise. */
export function buildAggregates(
  rows: Array<{
    transaction_date: string;
    vat_rate: number;
    tax_regime: string | null;
    operation_category: string;
    currency: string;
    amount_ht: number;
    vat_amount: number;
    amount_ttc: number;
  }>,
): Aggregate[] {
  const map = new Map<string, Aggregate>();
  for (const r of rows) {
    const regime = r.tax_regime ?? "inconnu";
    const key = [r.transaction_date, r.vat_rate, regime, r.operation_category, r.currency].join("|");
    const cur =
      map.get(key) ??
      ({
        date: r.transaction_date,
        vatRate: Number(r.vat_rate),
        regime,
        category: r.operation_category,
        currency: r.currency,
        count: 0,
        totalHt: 0,
        totalVat: 0,
        totalTtc: 0,
      } satisfies Aggregate);
    cur.count += 1;
    cur.totalHt = Math.round((cur.totalHt + Number(r.amount_ht)) * 100) / 100;
    cur.totalVat = Math.round((cur.totalVat + Number(r.vat_amount)) * 100) / 100;
    cur.totalTtc = Math.round((cur.totalTtc + Number(r.amount_ttc)) * 100) / 100;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.vatRate - b.vatRate);
}

/**
 * Alimente le registre depuis les factures émises hors routage B2B domestique
 * (particuliers et, selon les règles, opérations internationales).
 */
export async function syncReportableTransactions(driverId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, issued_on, service_date, amount_ht, vat_rate, amount_ttc, currency, tax_regime, customer_kind, customer_snapshot, document_type, number",
    )
    .eq("driver_id", driverId)
    .not("number", "is", null)
    .in("customer_kind", ["individual", "company_foreign"]);
  if (error) throw error;

  const rows = (data ?? []).map((i) => {
    const ht = Number(i.amount_ht ?? 0);
    const ttc = Number(i.amount_ttc ?? 0);
    const country = String(
      ((i.customer_snapshot as Record<string, unknown> | null)?.["country_code"] as string) ?? "FR",
    );
    return {
      driver_id: driverId,
      invoice_id: i.id,
      transaction_date: i.issued_on,
      service_date: (i.service_date ?? i.issued_on)?.slice(0, 10) ?? i.issued_on,
      amount_ht: ht,
      vat_rate: Number(i.vat_rate ?? 0),
      vat_amount: Math.round((ttc - ht) * 100) / 100,
      amount_ttc: ttc,
      currency: i.currency ?? "EUR",
      tax_regime: i.tax_regime,
      operation_category: "services",
      country_code: country,
      counterparty_kind: i.customer_kind,
      eligibility: "eligible",
    };
  });
  if (rows.length === 0) return 0;

  const { error: upErr } = await supabase
    .from("ereporting_transactions")
    .upsert(rows as never, { onConflict: "driver_id,invoice_id" });
  if (upErr) throw upErr;
  return rows.length;
}

/** Alimente le registre des encaissements depuis le module « Encaissement ». */
export async function syncReportablePayments(driverId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, invoice_id, amount, method, paid_at, invoices(amount_ttc, amount_paid, vat_rate, currency)")
    .eq("driver_id", driverId);
  if (error) throw error;

  const rows = (data ?? []).map((p) => {
    const inv = (p as unknown as { invoices: { amount_ttc: number; amount_paid: number; vat_rate: number; currency: string } | null })
      .invoices;
    const ttc = Number(inv?.amount_ttc ?? 0);
    const paid = Number(inv?.amount_paid ?? 0);
    const rate = Number(inv?.vat_rate ?? 0);
    const amount = Number(p.amount ?? 0);
    return {
      driver_id: driverId,
      payment_id: p.id,
      invoice_id: p.invoice_id,
      paid_on: String(p.paid_at).slice(0, 10),
      amount,
      currency: inv?.currency ?? "EUR",
      method: p.method,
      vat_rate: rate,
      vat_amount: rate > 0 ? Math.round((amount - amount / (1 + rate / 100)) * 100) / 100 : 0,
      is_partial: paid < ttc,
      remaining_amount: Math.round((ttc - paid) * 100) / 100,
      confirmed_by: driverId,
    };
  });
  if (rows.length === 0) return 0;

  const { error: upErr } = await supabase
    .from("ereporting_payment_entries")
    .upsert(rows as never, { onConflict: "driver_id,payment_id" });
  if (upErr) throw upErr;
  return rows.length;
}

/** Construit (ou met à jour) la période courante à partir du registre. */
export async function buildPeriod(args: {
  driverId: string;
  kind: "transaction" | "payment";
  frequency: ReportingFrequency;
  ref?: Date;
}) {
  const { start, end } = periodBounds(args.frequency, args.ref ?? new Date());

  if (args.kind === "transaction") {
    const { data, error } = await supabase
      .from("ereporting_transactions")
      .select("*")
      .eq("driver_id", args.driverId)
      .eq("eligibility", "eligible")
      .gte("transaction_date", start)
      .lte("transaction_date", end);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Parameters<typeof buildAggregates>[0];
    const aggregates = buildAggregates(rows);
    const totals = aggregates.reduce(
      (a, g) => ({
        ht: Math.round((a.ht + g.totalHt) * 100) / 100,
        vat: Math.round((a.vat + g.totalVat) * 100) / 100,
        ttc: Math.round((a.ttc + g.totalTtc) * 100) / 100,
      }),
      { ht: 0, vat: 0, ttc: 0 },
    );
    return upsertPeriod({
      driverId: args.driverId,
      kind: "transaction",
      frequency: args.frequency,
      start,
      end,
      count: rows.length,
      totals,
      aggregates,
    });
  }

  const { data, error } = await supabase
    .from("ereporting_payment_entries")
    .select("*")
    .eq("driver_id", args.driverId)
    .gte("paid_on", start)
    .lte("paid_on", end);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{ paid_on: string; amount: number; vat_amount: number | null; vat_rate: number | null; currency: string }>;
  const aggregates = buildAggregates(
    rows.map((r) => ({
      transaction_date: r.paid_on,
      vat_rate: Number(r.vat_rate ?? 0),
      tax_regime: null,
      operation_category: "services",
      currency: r.currency,
      amount_ht: Math.round((Number(r.amount) - Number(r.vat_amount ?? 0)) * 100) / 100,
      vat_amount: Number(r.vat_amount ?? 0),
      amount_ttc: Number(r.amount),
    })),
  );
  const totals = aggregates.reduce(
    (a, g) => ({
      ht: Math.round((a.ht + g.totalHt) * 100) / 100,
      vat: Math.round((a.vat + g.totalVat) * 100) / 100,
      ttc: Math.round((a.ttc + g.totalTtc) * 100) / 100,
    }),
    { ht: 0, vat: 0, ttc: 0 },
  );
  return upsertPeriod({
    driverId: args.driverId,
    kind: "payment",
    frequency: args.frequency,
    start,
    end,
    count: rows.length,
    totals,
    aggregates,
  });
}

async function upsertPeriod(args: {
  driverId: string;
  kind: "transaction" | "payment";
  frequency: ReportingFrequency;
  start: string;
  end: string;
  count: number;
  totals: { ht: number; vat: number; ttc: number };
  aggregates: Aggregate[];
}) {
  const { data, error } = await supabase
    .from("ereporting_periods")
    .upsert(
      {
        driver_id: args.driverId,
        kind: args.kind,
        frequency: args.frequency,
        period_start: args.start,
        period_end: args.end,
        due_on: dueDateFor(args.end),
        status: args.count > 0 ? "ready" : "draft",
        transaction_count: args.count,
        total_ht: args.totals.ht,
        total_vat: args.totals.vat,
        total_ttc: args.totals.ttc,
        aggregates: args.aggregates as never,
      } as never,
      { onConflict: "driver_id,kind,period_start,period_end" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as unknown as EreportingPeriod;
}

/** Transmission d'une période via la plateforme agréée (mode contrôlé ou automatique). */
export async function submitPeriod(args: {
  driverId: string;
  period: EreportingPeriod;
  connection: EInvoicingConnection;
  auto?: boolean;
}) {
  const provider = getProvider(args.connection.provider_key);
  if (args.connection.connection_status !== "connected")
    throw new Error("Connexion à une plateforme agréée nécessaire pour transmettre cet e-reporting.");
  if (args.period.transaction_count === 0) throw new Error("La période ne contient aucune donnée à déclarer.");

  const payload: ReportPayload = {
    kind: args.period.kind,
    periodStart: args.period.period_start,
    periodEnd: args.period.period_end,
    currency: args.period.currency,
    totals: {
      totalHt: Number(args.period.total_ht),
      totalVat: Number(args.period.total_vat),
      totalTtc: Number(args.period.total_ttc),
      count: args.period.transaction_count,
    },
    aggregates: args.period.aggregates,
  };

  const result =
    args.period.kind === "transaction"
      ? await provider.submitTransactionReport(connectionContext(args.connection), payload)
      : await provider.submitPaymentReport(connectionContext(args.connection), payload);

  const now = new Date().toISOString();
  await supabase
    .from("ereporting_periods")
    .update({
      status: result.status === "submitted" ? "submitted" : result.status === "rejected" ? "rejected" : "validation_failed",
      provider_key: provider.key,
      environment: args.connection.environment,
      external_submission_id: result.externalId ?? null,
      submitted_at: result.status === "submitted" ? now : null,
      rejected_at: result.status === "rejected" ? now : null,
      last_error_message: result.errorMessage ?? null,
      auto_submitted: !!args.auto,
    } as never)
    .eq("id", args.period.id);

  if (result.status === "submitted") await notifyEinvoicing(args.driverId, "ereporting_submitted");
  if (result.status === "rejected")
    await notifyEinvoicing(args.driverId, "ereporting_rejected", result.errorMessage ?? undefined);
  return result;
}

export function useInvalidateEreporting() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["ereporting-periods"] });
}
